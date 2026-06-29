from dotenv import load_dotenv
import os
import time
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

from database import init_db
from services.prometheus_service import get_cpu_usage, get_memory_usage, get_disk_usage
from services.reliability_service import calculate_reliability, get_health_status
from services.incident_service import create_incident, get_incidents, get_incident_stats
from services.docker_service import get_containers
from services.history_service import save_snapshot, get_history, log_request, get_request_analytics
from services.recommendation_service import get_recommendations
from services.ai_service import get_ai_analysis, get_ai_chat_response, API_KEY
from services.auth_service import create_api_key, list_api_keys, revoke_api_key
from services.redis_service import cache_get, cache_set, cache_delete, get_cache_stats
from auth_middleware import get_api_key, get_optional_api_key

app = FastAPI(
    title="CortexOps AI",
    version="2.0.0",
    description="Production-grade ML Infrastructure Observability Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    try:
        log_request(
            endpoint=request.url.path,
            method=request.method,
            status_code=response.status_code,
            response_time_ms=round(duration, 2)
        )
    except Exception:
        pass
    return response

@app.on_event("startup")
async def startup():
    print("Starting CortexOps v2...")
    init_db()
    # init Redis connection
    from services.redis_service import get_redis
    get_redis()
    print("CortexOps v2 ready!")

class ChatRequest(BaseModel):
    message: str
    context: dict = {}

class CreateKeyRequest(BaseModel):
    name: str

# ── Public endpoints ────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {
        "project": "CortexOps AI",
        "version": "2.0.0",
        "status": "running",
        "features": ["monitoring", "ai-analysis", "incidents",
                     "api-keys", "redis-cache", "request-logging"]
    }

@app.get("/health")
def health():
    return {"status": "UP", "timestamp": datetime.now().isoformat(), "version": "2.0.0"}

@app.get("/ai-status")
def ai_status():
    return {"ai_enabled": bool(API_KEY)}

# ── API Key management ───────────────────────────────────────────────────────

@app.post("/api-keys")
def create_key(request: CreateKeyRequest, auth: dict = Depends(get_api_key)):
    return create_api_key(request.name)

@app.get("/api-keys")
def get_keys(auth: dict = Depends(get_api_key)):
    return list_api_keys()

@app.delete("/api-keys/{key_id}")
def delete_key(key_id: int, auth: dict = Depends(get_api_key)):
    success = revoke_api_key(key_id)
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": f"Key {key_id} revoked successfully"}

# ── Protected endpoints with Redis caching ──────────────────────────────────

@app.get("/cpu")
def cpu(auth: dict = Depends(get_api_key)):
    # cache 10 seconds — CPU changes fast!
    cached = cache_get("metrics:cpu")
    if cached:
        cached["cache"] = "HIT"
        return cached

    data = {"cpu": get_cpu_usage(), "timestamp": datetime.now().isoformat()}
    cache_set("metrics:cpu", data, ttl=10)
    data["cache"] = "MISS"
    return data

@app.get("/memory")
def memory(auth: dict = Depends(get_api_key)):
    cached = cache_get("metrics:memory")
    if cached:
        cached["cache"] = "HIT"
        return cached

    data = {"memory": get_memory_usage(), "timestamp": datetime.now().isoformat()}
    cache_set("metrics:memory", data, ttl=10)
    data["cache"] = "MISS"
    return data

@app.get("/disk")
def disk(auth: dict = Depends(get_api_key)):
    # disk changes slow — cache 60 seconds!
    cached = cache_get("metrics:disk")
    if cached:
        cached["cache"] = "HIT"
        return cached

    data = {"disk": get_disk_usage(), "timestamp": datetime.now().isoformat()}
    cache_set("metrics:disk", data, ttl=60)
    data["cache"] = "MISS"
    return data

@app.get("/dashboard")
def dashboard(auth: dict = Depends(get_api_key)):
    # dashboard cache 15 seconds
    cache_key = "dashboard:main"
    cached = cache_get(cache_key)
    if cached:
        cached["cache"] = "HIT"
        return cached

    cpu = get_cpu_usage()
    memory = get_memory_usage()
    disk = get_disk_usage()
    containers = get_containers()
    running = sum(1 for c in containers if c["status"] == "running")
    stopped = len(containers) - running
    score = calculate_reliability(cpu, memory, disk)
    save_snapshot(cpu, memory, disk, score)

    if cpu > 80:
        create_incident("CRITICAL", f"CPU usage exceeded threshold: {cpu}%")
    if memory > 80:
        create_incident("WARNING", f"Memory usage exceeded: {memory}%")
    if disk > 90:
        create_incident("CRITICAL", f"Disk usage critical: {disk}%")

    data = {
        "cpu": cpu, "memory": memory, "disk": disk,
        "reliability_score": score,
        "health_status": get_health_status(score),
        "timestamp": datetime.now().isoformat(),
        "recommendations": get_recommendations(cpu, memory, disk, running, stopped),
        "containers_running": running,
        "containers_stopped": stopped,
        "containers_total": len(containers),
        "requested_by": auth.get("name", "unknown"),
        "cache": "MISS"
    }
    cache_set(cache_key, data, ttl=15)
    return data

@app.post("/ai-analyze")
def ai_analyze(auth: dict = Depends(get_api_key)):
    if not API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured.")

    # AI analysis cache 2 minutes — expensive operation!
    cache_key = "ai:analysis"
    cached = cache_get(cache_key)
    if cached:
        cached["cache"] = "HIT"
        return cached

    cpu = get_cpu_usage()
    memory = get_memory_usage()
    disk = get_disk_usage()
    containers = get_containers()
    running = sum(1 for c in containers if c["status"] == "running")
    stopped = len(containers) - running
    score = calculate_reliability(cpu, memory, disk)
    incidents = get_incidents()

    analysis = get_ai_analysis(cpu, memory, disk, running, stopped, score, incidents)
    data = {
        "analysis": analysis,
        "metrics_snapshot": {
            "cpu": cpu, "memory": memory, "disk": disk,
            "score": score, "running": running, "stopped": stopped
        },
        "timestamp": datetime.now().isoformat(),
        "cache": "MISS"
    }
    cache_set(cache_key, data, ttl=120)
    return data

@app.post("/chat")
def chat(request: ChatRequest, auth: dict = Depends(get_api_key)):
    if not API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured.")
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    context = request.context
    if not context:
        cpu = get_cpu_usage()
        memory = get_memory_usage()
        disk = get_disk_usage()
        containers = get_containers()
        running = sum(1 for c in containers if c["status"] == "running")
        stopped = len(containers) - running
        score = calculate_reliability(cpu, memory, disk)
        context = {
            "cpu": cpu, "memory": memory, "disk": disk,
            "score": score, "health_status": get_health_status(score),
            "running": running, "stopped": stopped
        }

    response = get_ai_chat_response(request.message, context)
    return {"response": response, "timestamp": datetime.now().isoformat()}

@app.get("/incidents")
def incidents(auth: dict = Depends(get_api_key)):
    # incidents cache 5 seconds
    cached = cache_get("incidents:list")
    if cached:
        return cached
    data = get_incidents()
    cache_set("incidents:list", data, ttl=5)
    return data

@app.get("/incident-summary")
def incident_summary(auth: dict = Depends(get_api_key)):
    return get_incident_stats()

@app.get("/containers")
def containers(auth: dict = Depends(get_api_key)):
    return get_containers()

@app.get("/container-summary")
def container_summary(auth: dict = Depends(get_api_key)):
    containers = get_containers()
    running = sum(1 for c in containers if c["status"] == "running")
    stopped = len(containers) - running
    return {"running": running, "stopped": stopped, "total": len(containers)}

@app.get("/reliability-history")
def reliability_history(auth: dict = Depends(get_api_key)):
    cached = cache_get("history:reliability")
    if cached:
        return cached
    data = get_history()
    cache_set("history:reliability", data, ttl=30)
    return data

@app.get("/analytics")
def analytics(auth: dict = Depends(get_api_key)):
    return {
        "request_analytics": get_request_analytics(),
        "timestamp": datetime.now().isoformat()
    }

# NEW — cache stats endpoint!
@app.get("/cache-stats")
def cache_stats(auth: dict = Depends(get_api_key)):
    return get_cache_stats()

# ── WebSocket endpoints ─────────────────────────────────────────────────────

from fastapi import WebSocket, WebSocketDisconnect
from websocket_manager import manager, stream_metrics

@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    """
    Real-time metrics streaming via WebSocket!
    Connect: ws://localhost:8000/ws/metrics
    Updates every 5 seconds automatically!
    """
    await stream_metrics(websocket)

@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """Alert-only WebSocket — only sends when something is wrong!"""
    from services.prometheus_service import get_cpu_usage, get_memory_usage, get_disk_usage
    import asyncio

    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "CortexOps alert stream connected!"
        })
        while True:
            cpu = get_cpu_usage()
            memory = get_memory_usage()
            disk = get_disk_usage()

            alerts = []
            if cpu > 80:
                alerts.append({"severity": "CRITICAL", "metric": "cpu", "value": cpu})
            if memory > 85:
                alerts.append({"severity": "WARNING", "metric": "memory", "value": memory})
            if disk > 90:
                alerts.append({"severity": "CRITICAL", "metric": "disk", "value": disk})

            if alerts:
                await websocket.send_json({
                    "type": "alerts",
                    "alerts": alerts,
                    "timestamp": __import__("datetime").datetime.now().isoformat()
                })

            await asyncio.sleep(10)
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)

@app.get("/ws/stats")
def ws_stats(auth: dict = Depends(get_api_key)):
    """How many WebSocket clients connected?"""
    return {
        "active_connections": manager.connection_count,
        "timestamp": datetime.now().isoformat()
    }