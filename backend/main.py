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

# request logging middleware
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
    print("CortexOps v2 ready!")

class ChatRequest(BaseModel):
    message: str
    context: dict = {}

class CreateKeyRequest(BaseModel):
    name: str

# ── Public endpoints — no auth needed ──────────────────────────────────────

@app.get("/")
def home():
    return {
        "project": "CortexOps AI",
        "version": "2.0.0",
        "status": "running",
        "ai_enabled": bool(API_KEY),
        "database": "PostgreSQL",
        "auth": "API Key",
        "features": ["monitoring", "ai-analysis", "incidents", "request-logging", "api-keys"]
    }

@app.get("/health")
def health():
    return {"status": "UP", "timestamp": datetime.now().isoformat(), "version": "2.0.0"}

@app.get("/ai-status")
def ai_status():
    return {"ai_enabled": bool(API_KEY)}

# ── API Key management endpoints ────────────────────────────────────────────

@app.post("/api-keys")
def create_key(
    request: CreateKeyRequest,
    auth: dict = Depends(get_api_key)  # only authenticated users can create keys
):
    """Create new API key — master key required!"""
    return create_api_key(request.name)

@app.get("/api-keys")
def get_keys(auth: dict = Depends(get_api_key)):
    """List all API keys"""
    return list_api_keys()

@app.delete("/api-keys/{key_id}")
def delete_key(key_id: int, auth: dict = Depends(get_api_key)):
    """Revoke API key"""
    success = revoke_api_key(key_id)
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": f"Key {key_id} revoked successfully"}

# ── Protected endpoints — API key required ──────────────────────────────────

@app.get("/cpu")
def cpu(auth: dict = Depends(get_api_key)):
    return {"cpu": get_cpu_usage()}

@app.get("/memory")
def memory(auth: dict = Depends(get_api_key)):
    return {"memory": get_memory_usage()}

@app.get("/disk")
def disk(auth: dict = Depends(get_api_key)):
    return {"disk": get_disk_usage()}

@app.get("/dashboard")
def dashboard(auth: dict = Depends(get_api_key)):
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
        create_incident("WARNING", f"Memory usage exceeded threshold: {memory}%")
    if disk > 90:
        create_incident("CRITICAL", f"Disk usage critical: {disk}%")

    status = get_health_status(score)
    recommendations = get_recommendations(cpu, memory, disk, running, stopped)

    return {
        "cpu": cpu, "memory": memory, "disk": disk,
        "reliability_score": score, "health_status": status,
        "timestamp": datetime.now().isoformat(),
        "recommendations": recommendations,
        "containers_running": running,
        "containers_stopped": stopped,
        "containers_total": len(containers),
        "requested_by": auth.get("name", "unknown")  # who called this!
    }

@app.post("/ai-analyze")
def ai_analyze(auth: dict = Depends(get_api_key)):
    if not API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured.")

    cpu = get_cpu_usage()
    memory = get_memory_usage()
    disk = get_disk_usage()
    containers = get_containers()
    running = sum(1 for c in containers if c["status"] == "running")
    stopped = len(containers) - running
    score = calculate_reliability(cpu, memory, disk)
    incidents = get_incidents()

    analysis = get_ai_analysis(cpu, memory, disk, running, stopped, score, incidents)
    return {
        "analysis": analysis,
        "metrics_snapshot": {
            "cpu": cpu, "memory": memory, "disk": disk,
            "score": score, "running": running, "stopped": stopped
        },
        "timestamp": datetime.now().isoformat()
    }

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
    return get_incidents()

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
    return get_history()

@app.get("/analytics")
def analytics(auth: dict = Depends(get_api_key)):
    return {
        "request_analytics": get_request_analytics(),
        "timestamp": datetime.now().isoformat()
    }