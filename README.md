# CortexOps v2

**Production-grade ML Infrastructure Observability Platform**

Live on Azure: `https://cortexops-api.ashycoast-10eb3ab5.centralindia.azurecontainerapps.io`
GitHub: `github.com/pranavsaai/CortexOps`

---

## 1. The Problem

Infrastructure monitoring tools today mostly just show numbers — CPU is at 80%, memory is at 90% — and leave the interpretation to a human. For a small team without a dedicated SRE, that's a gap: someone has to notice the dashboard, understand what the numbers mean, decide whether it's an emergency, and figure out what to do about it.

CortexOps was built to close that gap. It's a platform that watches a system's vitals (CPU, memory, disk, container health), reasons about what those numbers actually mean using an LLM, and surfaces that reasoning in plain language — while being architected the way a real production observability service would be: authenticated, cached, horizontally communicable between services, and cloud-deployed.

The v1 version of this project (built earlier) proved the concept — FastAPI backend, Groq-powered analysis, Docker/Kubernetes manifests, Prometheus and Grafana for metrics. v2, documented here, is the production hardening pass: the part where a side project starts looking like something a company would actually run.

---

## 2. What We Set Out to Fix

Six concrete gaps were identified between the v1 prototype and what a production system needs:

| # | Gap | Why it matters |
|---|---|---|
| 1 | SQLite for storage | Single-writer, not safe under concurrent load, no real indexing strategy |
| 2 | No authentication | Anyone could hit any endpoint |
| 3 | No caching | Every dashboard refresh re-computed everything from scratch |
| 4 | No inter-service communication | Everything lived in one process — no separation of concerns |
| 5 | No real-time channel | Frontend had to poll for updates |
| 6 | No cloud deployment | Ran only on a laptop |

Each of these became a GitHub Issue, its own feature branch, and its own pull request — the same workflow used at any company with code review discipline.

---

## 3. Architecture

```
                        ┌─────────────────────┐
                        │   Next.js Frontend    │
                        └──────────┬───────────┘
                                   │ REST + WebSocket
                                   ▼
                  ┌────────────────────────────────┐
                  │     FastAPI Gateway (port 8000)  │
                  │  ┌──────────────────────────┐    │
                  │  │  Auth Middleware (API Key) │    │
                  │  └──────────────────────────┘    │
                  │  ┌──────────────────────────┐    │
                  │  │  Redis Cache (cache-aside)  │    │
                  │  └──────────────────────────┘    │
                  └───────┬──────────────┬───────────┘
                          │              │
              gRPC (50051)│              │ SQL
                          ▼              ▼
                 ┌────────────────┐  ┌──────────────┐
                 │  Metrics/AI       │  │  PostgreSQL    │
                 │  gRPC Service     │  │  (Neon, cloud) │
                 └────────────────┘  └──────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │  psutil / Prometheus │
                 │  (system metrics)   │
                 └────────────────┘
```

The FastAPI process is the single entry point for clients. Internally it talks to a separate gRPC service for metrics and AI analysis — simulating the kind of service boundary a larger system would have between an API gateway and a metrics microservice. Redis sits in front of the expensive operations (dashboard aggregation, AI analysis) as a cache-aside layer. PostgreSQL is the system of record. WebSockets give the frontend a live feed instead of polling.

---

## 4. Tech Stack and Why Each Piece Is There

| Layer | Technology | Reason |
|---|---|---|
| API framework | FastAPI | Async-native, automatic OpenAPI docs, dependency injection for auth |
| Inter-service | gRPC + Protocol Buffers | Binary, typed, low-latency — what real microservices use instead of REST internally |
| Cache | Redis | Sub-millisecond reads, TTL-based expiry, the standard cache-aside pattern |
| Database | PostgreSQL (Neon) | ACID guarantees, connection pooling, proper indexing — SQLite can't do concurrent writes safely |
| Real-time | FastAPI WebSockets | Push-based updates instead of client polling |
| AI | Groq (Llama 3.1) | Fast inference for turning raw metrics into a written diagnosis |
| Auth | SHA-256 hashed API keys | Keys are never stored in plaintext, only their hash — same principle as how passwords are stored |
| Containerization | Docker (multi-stage build) | Smaller production image, build dependencies don't ship to prod |
| Orchestration | Kubernetes manifests | HPA, DaemonSet, Ingress — declarative scaling and routing |
| Cloud | Azure Container Apps | Managed container hosting with autoscaling, chosen because Azure was the target platform for this round of work |
| CI/CD | GitHub Actions | Automated build → push to registry → deploy on every merge to main |
| Monitoring | Prometheus + Grafana + Node Exporter | Industry-standard metrics collection and visualization |

---

## 5. The Six Issues — Problem, Approach, Code

### Issue #1 — PostgreSQL Migration

**Problem:** SQLite has a single writer at a time. Under any real concurrent load — multiple API requests hitting the database simultaneously — that becomes a bottleneck or a source of "database is locked" errors.

**Approach:** Replace SQLite with PostgreSQL accessed through a connection pool, so the app holds a small number of live connections (2–10) and reuses them rather than opening a new connection per request.

```python
connection_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=2,
    maxconn=10,
    dsn=DATABASE_URL
)
```

Four tables were introduced: `incidents`, `reliability_history`, `api_keys`, and `request_logs` — the last one specifically to support per-endpoint analytics later (Issue #3 builds on this).

A practical lesson from this stage: the app also needed to keep working when Prometheus wasn't running locally, so `get_cpu_usage()` and friends were written to try Prometheus first and silently fall back to `psutil` if Prometheus is unreachable — a small example of graceful degradation rather than a hard crash.

---

### Issue #2 — API Key Authentication

**Problem:** Every endpoint was open. Anyone with the URL could pull metrics, trigger AI analysis (which costs API credits), or read incident history.

**Approach:** A standard hashed-API-key scheme. Keys are generated once, shown to the user exactly once, and only their SHA-256 hash is ever stored — so even a database leak doesn't expose usable keys.

```python
def generate_api_key() -> str:
    return f"cx-{secrets.token_urlsafe(32)}"

def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()
```

Validation is wired in as a FastAPI dependency, which keeps the auth check declarative rather than repeated in every handler:

```python
@app.get("/dashboard")
def dashboard(auth: dict = Depends(get_api_key)):
    ...
```

A master key exists for admin operations (creating/revoking other keys), separate from per-user keys.

---

### Issue #3 — Redis Caching

**Problem:** The `/dashboard` endpoint recomputed CPU, memory, disk, container status, and a reliability score on every single call — expensive, and unnecessary if nothing has changed in the last few seconds. `/ai-analyze` is worse: it makes a real LLM call every time, which is both slow and costs money.

**Approach:** Cache-aside pattern, with TTLs chosen per endpoint based on how fast that data actually changes:

| Endpoint | TTL | Reasoning |
|---|---|---|
| `/cpu`, `/memory` | 10s | Changes fast, but a 10s staleness window is fine for a dashboard |
| `/disk` | 60s | Disk usage moves slowly |
| `/dashboard` | 15s | Aggregate view, balances freshness and load |
| `/ai-analyze` | 120s | Expensive LLM call — 2 minutes of staleness is an acceptable tradeoff |

```python
def cache_get(key: str) -> dict | None:
    r = get_redis()
    if r is None:
        return None
    data = r.get(key)
    return json.loads(data) if data else None
```

Every cached response carries a `"cache": "HIT"` or `"cache": "MISS"` field — useful for debugging and for proving the cache is actually working, which is exactly how it was verified during development: two consecutive calls to `/dashboard` returned the identical timestamp on the second call, confirming the data came from Redis rather than being recomputed.

If Redis is unreachable, every cache function returns `None` rather than raising — the app keeps working, just without the speed benefit. That fallback behavior matters more than it sounds: a cache should never be a single point of failure.

---

### Issue #4 — gRPC Inter-Service Communication

**Problem:** Everything ran in one FastAPI process. There was no real boundary between "the thing that serves HTTP requests" and "the thing that knows how to read system metrics or call the AI model" — which is fine for a prototype, but doesn't reflect how multi-service systems are actually built.

**Approach:** A separate gRPC server (`grpc_server.py`, port 50051) implements two services — `MetricsService` and `AIService` — defined in a `.proto` schema:

```protobuf
service MetricsService {
    rpc GetAllMetrics (MetricsRequest) returns (AllMetricsResponse);
}

message AllMetricsResponse {
    double cpu_percent = 1;
    double memory_percent = 2;
    double disk_percent = 3;
    int32 reliability_score = 4;
    string health_status = 5;
}
```

The FastAPI app acts as the gateway and calls into this service over gRPC using a generated client stub:

```python
def get_metrics_via_grpc(requester: str = "api-gateway") -> dict:
    metrics_stub, _ = get_stubs()
    request = metrics_pb2.MetricsRequest(requester=requester)
    response = metrics_stub.GetAllMetrics(request, timeout=5)
    return {"cpu": response.cpu_percent, ...}
```

One real bug worth mentioning: the first version of this hung indefinitely, because `psutil.cpu_percent(interval=1)` blocks for a full second inside the gRPC handler thread, and gRPC's threadpool doesn't love being blocked like that. Switching to `interval=0` (non-blocking, returns the last computed value instead of sampling fresh) fixed it. It's a small detail, but it's the kind of thing that only shows up once you've actually wired two services together and watched a request hang.

---

### Issue #5 — WebSocket Real-Time Streaming

**Problem:** A frontend dashboard built on REST has to poll — call `/dashboard` every few seconds and re-render. That's wasteful and adds latency between "something changed" and "the user sees it."

**Approach:** A `ConnectionManager` tracks active WebSocket clients, and a streaming loop pushes a metrics update every 5 seconds, plus immediate alerts when thresholds are crossed:

```python
async def stream_metrics(websocket: WebSocket):
    await manager.connect(websocket)
    while True:
        cpu = get_cpu_usage()
        memory = get_memory_usage()
        await websocket.send_json({"type": "metrics", "data": {...}})
        if cpu > 80:
            await websocket.send_json({"type": "alert", "severity": "CRITICAL", ...})
        await asyncio.sleep(5)
```

Two endpoints came out of this: `/ws/metrics` (full stream) and `/ws/alerts` (alert-only, lower frequency, for clients that just want to know when something is wrong). A `/ws/stats` REST endpoint reports how many clients are currently connected, which is a small but genuinely useful thing to expose for ops visibility.

---

### Issue #6 — Azure Deployment

**Problem:** All of the above only meant anything if it could run somewhere other than a developer's laptop.

**Approach:** A multi-stage Dockerfile keeps the production image lean — build tools like `gcc` are only present in the builder stage and don't ship in the final image:

```dockerfile
FROM python:3.11-slim as builder
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim
COPY --from=builder /root/.local /root/.local
CMD ["sh", "-c", "python grpc_server.py & python -m uvicorn main:app --host 0.0.0.0 --port 8000"]
```

Deployment path: build the image → push to Azure Container Registry → deploy to Azure Container Apps, with PostgreSQL hosted on Neon (chosen over Azure's own PostgreSQL offering to keep cost near zero during this build-out) and environment variables (`DATABASE_URL`, `GROQ_API_KEY`, `MASTER_API_KEY`) injected at the Container App level rather than baked into the image.

```bash
az containerapp create \
  --name cortexops-api \
  --image cortexopsacr.azurecr.io/cortexops:latest \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 --max-replicas 2
```

This stage also surfaced two real-world deployment problems worth recording: the first Container Apps Environment creation failed in `eastus` due to regional AKS capacity limits, requiring a retry in `centralindia`; and the first deployment crash-looped because environment variables had been declared but not given values, with the container logs clearly showing `psycopg2.OperationalError: connection to server at "localhost"` — a reminder that "the env var exists" and "the env var has a value" are different things, and that reading container logs is the fastest way to find out which one you're dealing with.

GitHub Actions automates this end-to-end for future changes — push to `main`, image builds, pushes to ACR, and the Container App updates automatically.

---

## 6. Workflow Used

Each issue followed the same cycle, the way it would in a team with code review:

```
git checkout main && git pull
git checkout -b feat/<name>
   ... implement, test locally ...
git commit -m "feat: <description>

Closes #<issue-number>"
git push origin feat/<name>
   ... open PR on GitHub, merge to main ...
```

This wasn't friction-free — there were real merge conflicts along the way (notably `.env` accidentally being committed and caught by GitHub's secret-scanning push protection, which forced a key rotation and a `.gitignore` fix), and a divergent branch history that needed reconciling with `git checkout --ours` to keep the PostgreSQL migration intact. Both are exactly the kind of thing that happens on a real team, and both got fixed the same way a real team would fix them.

---

## 7. End-to-End Example

A single call to `/dashboard` touches nearly every piece of this system:

1. Client sends `GET /dashboard` with header `X-API-Key: cx-...`
2. **Auth middleware** validates the key against its SHA-256 hash in PostgreSQL
3. **Redis** is checked first — if a fresh cached response exists (< 15s old), it's returned immediately with `"cache": "HIT"`
4. On a cache miss, the app calls **psutil/Prometheus** for CPU, memory, disk
5. If thresholds are exceeded, an **incident** is written to PostgreSQL
6. The response is cached in **Redis** for the next 15 seconds and returned
7. Every request — regardless of outcome — is logged to the `request_logs` table by the **logging middleware**, feeding the `/analytics` endpoint

Separately, any connected WebSocket client is receiving this same data automatically every 5 seconds without asking for it, and the metrics themselves are also independently servable via **gRPC** to any other internal service that needs them — the REST gateway is just one of the front doors.

---

## 8. What This Demonstrates

- **Database design**: connection pooling, indexing, migration from a prototype-grade store to a production one
- **Security**: hashed credential storage, dependency-injected auth, secrets kept out of version control
- **Performance**: cache-aside strategy with endpoint-appropriate TTLs, measured and verified
- **Distributed systems basics**: a real service boundary over gRPC, with the failure modes (blocking calls, timeouts) that come with it
- **Real-time systems**: WebSocket push instead of polling, including a separate low-frequency alert channel
- **Cloud deployment**: containerization, registry, managed container hosting, environment-based configuration, and the debugging process for getting a containerized app to actually boot in production
- **Engineering process**: issue-driven, branch-per-feature, PR-reviewed workflow — not just "it works on my machine"

---

## 9. Stack Summary

```
Backend     : FastAPI, Python 3.11
RPC         : gRPC + Protocol Buffers
Cache       : Redis (cache-aside, TTL-based)
Database    : PostgreSQL (Neon, connection-pooled)
Real-time   : WebSockets (native FastAPI)
AI          : Groq API (Llama 3.1)
Auth        : SHA-256 hashed API keys
Container   : Docker (multi-stage builds)
Orchestration: Kubernetes manifests (HPA, DaemonSet, Ingress)
Cloud       : Azure Container Apps + Azure Container Registry
CI/CD       : GitHub Actions
Monitoring  : Prometheus, Grafana, Node Exporter
```