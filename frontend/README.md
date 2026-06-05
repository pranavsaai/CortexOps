# ⚡ CortexOps — AI-Powered Infrastructure Monitoring Dashboard

A production-grade Site Reliability Engineering (SRE) dashboard built with **FastAPI**, **Next.js**, **Docker**, **Prometheus**, and **Groq AI** (LLaMA 3.1). Monitor your infrastructure in real time with AI-powered analysis, incident tracking, and an SRE chatbot.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React, Recharts |
| Backend | FastAPI, Python, SQLite |
| Monitoring | Prometheus, Node Exporter, Grafana |
| Containerization | Docker, Docker Compose |
| AI Engine | Groq API (LLaMA 3.1 8B — Free) |
| Automation | Ansible-ready provisioning |

---

## 📦 Features

- 🔴 **Live Metrics** — CPU, Memory, Disk via Prometheus + Node Exporter
- 🐳 **Docker Container Monitoring** — running/stopped status in real time
- 🚨 **Incident Management** — auto-created alerts with severity levels (INFO / WARNING / CRITICAL)
- 📈 **Trend Charts** — historical CPU/Memory/Disk visualization
- 🤖 **AI Infrastructure Analysis** — powered by Groq (free LLaMA 3.1)
- 💬 **SRE AI Chatbot** — context-aware assistant that knows your live infra state
- 🔒 **Secure** — API keys server-side only via `.env`, never exposed to browser

---

## 🛠️ Setup & Run

### Prerequisites
- Docker Desktop (running)
- Python 3.10+
- Node.js 18+
- Free Groq API key → [console.groq.com](https://console.groq.com)

---

### Step 1 — Start Monitoring Stack

```bash
cd monitoring
docker compose up -d
```

Starts: Prometheus (`:9090`) · Grafana (`:3000`) · Node Exporter (`:9100`)

---

### Step 2 — Configure & Start Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env → paste your GROQ_API_KEY

# Run
uvicorn main:app --reload
```

Backend runs on `http://localhost:8000`

---

### Step 3 — Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard at `http://localhost:3001`

---

## 🏗️ Architecture

```
Your Machine
    ↓
Node Exporter (:9100)     ← reads CPU / RAM / Disk
    ↓
Prometheus (:9090)        ← scrapes metrics every 15s
    ↓
FastAPI Backend (:8000)   ← queries Prometheus, calls Groq AI, stores incidents
    ↓
Next.js Frontend (:3001)  ← displays dashboard, auto-refreshes every 5s
```

---

## 📁 Project Structure

```
CortexOps/
├── backend/
│   ├── main.py                  # FastAPI app + all endpoints
│   ├── database.py              # SQLite connection
│   ├── requirements.txt
│   ├── .env.example             # copy to .env, add Groq key
│   └── services/
│       ├── ai_service.py        # Groq AI analysis + chatbot
│       ├── prometheus_service.py
│       ├── docker_service.py
│       ├── incident_service.py
│       ├── reliability_service.py
│       ├── history_service.py
│       └── recommendation_service.py
├── frontend/
│   └── app/page.tsx             # Full dashboard UI
└── monitoring/
    ├── docker-compose.yml       # Prometheus + Grafana + Node Exporter
    └── prometheus.yml           # Scrape config
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | All metrics + health status |
| GET | `/containers` | Docker container list |
| GET | `/incidents` | All incidents |
| GET | `/incident-summary` | Count by severity |
| GET | `/reliability-history` | Last 50 snapshots |
| GET | `/ai-status` | AI engine online check |
| POST | `/ai-analyze` | Full AI infrastructure analysis |
| POST | `/chat` | SRE AI chatbot |

---

## 👨‍💻 Author

**Kuchipudi Pranav Sai** · B.Tech CSE · GITAM University, Visakhapatnam · 2026