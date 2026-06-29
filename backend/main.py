from dotenv import load_dotenv
import os
import time
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
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

# request logging middleware — every request log avutundi!
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000  # ms lo

    # background lo log cheyyi — request slow avvadam ledu!
    try:
        log_request(
            endpoint=request.url.path,
            method=request.method,
            status_code=response.status_code,
            response_time_ms=round(duration, 2)
        )
    except Exception:
        pass  # logging fail aithe app crash avvadam ledu

    return response

# startup lo DB init cheyyi
@app.on_event("startup")
async def startup():
    print("Starting CortexOps v2...")
    init_db()
    print("CortexOps v2 ready!")

class ChatRequest(BaseModel):
    message: str
    context: dict = {}

@app.get("/")
def home():
    return {
        "project": "CortexOps AI",
        "version": "2.0.0",
        "status": "running",
        "ai_enabled": bool(API_KEY),
        "database": "PostgreSQL",
        "features": ["monitoring", "ai-analysis", "incidents", "request-logging"]
    }

@app.get("/health")
def health():
    return {"status": "UP", "timestamp": datetime.now().isoformat(), "version": "2.0.0"}

@app.get("/ai-status")
def ai_status():
    return {"ai_enabled": bool(API_KEY)}

@app.get("/cpu")
def cpu():
    return {"cpu": get_cpu_usage()}

@app.get("/memory")
def memory():
    return {"memory": get_memory_usage()}

@app.get("/disk")
def disk():
    return {"disk": get_disk_usage()}

@app.get("/dashboard")
def dashboard():
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
        "containers_total": len(containers)
    }

@app.post("/ai-analyze")
def ai_analyze():
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
def chat(request: ChatRequest):
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
def incidents():
    return get_incidents()

@app.get("/incident-summary")
def incident_summary():
    return get_incident_stats()

@app.get("/containers")
def containers():
    return get_containers()

@app.get("/container-summary")
def container_summary():
    containers = get_containers()
    running = sum(1 for c in containers if c["status"] == "running")
    stopped = len(containers) - running
    return {"running": running, "stopped": stopped, "total": len(containers)}

@app.get("/reliability-history")
def reliability_history():
    return get_history()

# NEW — request analytics endpoint
@app.get("/analytics")
def analytics():
    return {
        "request_analytics": get_request_analytics(),
        "timestamp": datetime.now().isoformat()
    }