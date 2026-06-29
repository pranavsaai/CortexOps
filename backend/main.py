from dotenv import load_dotenv
import os
load_dotenv()

from fastapi import FastAPI, HTTPException  # 🚀 Main framework!
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os

from services.prometheus_service import get_cpu_usage, get_memory_usage, get_disk_usage
from services.reliability_service import calculate_reliability, get_health_status
from services.incident_service import create_incident, get_incidents
from services.docker_service import get_containers
from services.history_service import save_snapshot, get_history
from services.recommendation_service import get_recommendations
from services.ai_service import get_ai_analysis, get_ai_chat_response, API_KEY

app = FastAPI(title="CortexOps AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 📦 Chat request — no api_key field anymore! Server handles it
class ChatRequest(BaseModel):
    message: str
    context: dict = {}


@app.get("/")
def home():
    return {
        "project": "CortexOps AI",
        "version": "2.0.0",
        "status": "running",
        "ai_enabled": bool(API_KEY)  # 🔍 Key set hai ya nahi — key value nahi!
    }


@app.get("/ai-status")
def ai_status():
    """
    🔍 Frontend check karega AI available hai ya nahi — key expose nahi hogi!
    """
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
    """
    🤖 No API key in request — server reads from .env!
    """
    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI not configured. Set ANTHROPIC_API_KEY in backend .env file."
        )

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
    """
    💬 SRE chatbot — API key never leaves the server!
    """
    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI not configured. Set ANTHROPIC_API_KEY in backend .env file."
        )

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
    incidents = get_incidents()
    return {
        "info": sum(1 for i in incidents if i["severity"] == "INFO"),
        "warning": sum(1 for i in incidents if i["severity"] == "WARNING"),
        "critical": sum(1 for i in incidents if i["severity"] == "CRITICAL")
    }


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


@app.get("/health")
def health():
    return {"status": "UP", "timestamp": datetime.now().isoformat()}