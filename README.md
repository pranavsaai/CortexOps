# ⚡ CortexOps — AI-Powered SRE Monitoring Dashboard

> Real-time infrastructure monitoring with Docker, Prometheus, and Groq AI — built for Site Reliability Engineers.

---

## 📌 Problem Statement

Modern infrastructure runs across dozens of containers, services, and servers. SREs (Site Reliability Engineers) spend enormous time:

- Manually checking CPU, memory, and disk across multiple terminals
- Digging through log files to identify the root cause of incidents
- Writing repetitive runbooks for recurring failure patterns
- Context-switching between Prometheus, Grafana, and shell sessions just to answer "is the system healthy?"

There is no single pane of glass that combines **live metrics + incident tracking + AI-powered diagnosis** in one place — especially not one that's lightweight, open-source, and free to run.

---

## 💡 Solution

**CortexOps** is a full-stack SRE dashboard that:

- Pulls live CPU, memory, and disk metrics from **Prometheus + Node Exporter**
- Tracks and classifies incidents automatically (INFO / WARNING / CRITICAL)
- Monitors all running **Docker containers** in real time
- Provides an **AI-powered infrastructure analysis** using Groq (LLaMA 3.1 — free tier)
- Includes a **context-aware SRE chatbot** that knows your live infra state and answers questions in plain English
- Keeps everything secure — API keys never touch the browser, stored only in `.env`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Machine                          │
│                                                         │
│  ┌─────────────┐    ┌──────────────┐                   │
│  │ Node        │───▶│  Prometheus  │                   │
│  │ Exporter    │    │  :9090       │                   │
│  │ :9100       │    └──────┬───────┘                   │
│  │ (CPU/RAM/   │           │ scrapes every 15s          │
│  │  Disk)      │           ▼                            │
│  └─────────────┘    ┌──────────────┐    ┌───────────┐  │
│                     │  FastAPI     │───▶│  Groq AI  │  │
│                     │  Backend     │    │  (LLaMA)  │  │
│                     │  :8000       │    └───────────┘  │
│                     │  + SQLite    │                   │
│                     └──────┬───────┘                   │
│                            │ REST API                   │
│                            ▼                            │
│                     ┌──────────────┐                   │
│                     │  Next.js     │                   │
│                     │  Frontend    │                   │
│                     │  :3001       │                   │
│                     └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 Live Metric Gauges | Arc-style SVG gauges for CPU, Memory, Disk — color-coded green/yellow/red |
| 🔢 Reliability Score | Composite score (0–100) calculated from all metrics combined |
| 🐳 Container Monitoring | Real-time Docker container status — running, stopped, total |
| 📈 Trend Chart | Historical CPU/Memory/Disk line chart — last 40 snapshots |
| 🚨 Incident Engine | Auto-creates incidents when thresholds breach; severity levels INFO/WARNING/CRITICAL |
| 🤖 AI Analysis | Full infrastructure analysis via Groq AI — risk level, recommendations, predicted issues |
| 💬 SRE Chatbot | Context-aware AI assistant — knows your live metrics, answers SRE questions |
| 🔒 Secure by Design | API key lives only in `.env` on the server — never sent to browser |
| 🔄 Auto Refresh | Dashboard refreshes every 5 seconds automatically |
| 📱 Mobile Friendly | Responsive grid layout works on all screen sizes |

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** — async Python REST API framework
- **Uvicorn** — ASGI server
- **SQLite** — lightweight database for incidents and history
- **Python Requests** — Groq API communication
- **python-dotenv** — secure environment variable loading
- **Docker SDK** — container status polling

### Frontend
- **Next.js 15** — React framework with App Router
- **TypeScript** — type-safe component development
- **Recharts** — line charts for metric trends
- **JetBrains Mono + Syne** — terminal-aesthetic typography
- **Custom SVG** — hand-crafted arc gauge components

### Infrastructure & Monitoring
- **Docker + Docker Compose** — container orchestration
- **Prometheus** — metrics collection and storage
- **Node Exporter** — exposes host CPU/RAM/Disk to Prometheus
- **Grafana** — optional extended dashboarding

### AI
- **Groq API** — free LLaMA 3.1 8B inference
- **LLaMA 3.1 8B Instant** — fast, capable open-source LLM

---

## 🔄 System Flow

### Metrics Flow
```
Node Exporter reads OS metrics (CPU/RAM/Disk)
        ↓
Prometheus scrapes Node Exporter every 15 seconds
        ↓
FastAPI queries Prometheus via HTTP on /dashboard call
        ↓
Backend calculates reliability score and creates incidents
        ↓
SQLite stores incidents and history snapshots
        ↓
Next.js fetches /dashboard every 5 seconds and renders UI
```

### AI Analysis Flow
```
User clicks "Analyze Infrastructure"
        ↓
Frontend → POST /ai-analyze → FastAPI Backend
        ↓
Backend reads GROQ_API_KEY from .env (never from request)
        ↓
Backend collects live metrics + last 5 incidents
        ↓
Sends structured prompt to Groq API (LLaMA 3.1)
        ↓
Groq returns JSON: risk level, recommendations, predictions
        ↓
Frontend renders AI analysis panel
```

### Chat Flow
```
User types a question in SRE Chat
        ↓
Frontend → POST /chat → Backend (no API key in request)
        ↓
Backend auto-injects live infra context into system prompt
        ↓
Groq LLaMA answers with full infra awareness
        ↓
Response streams back to chat panel
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check + version info |
| GET | `/dashboard` | All live metrics, score, health, recommendations |
| GET | `/cpu` | Raw CPU usage percentage |
| GET | `/memory` | Raw memory usage percentage |
| GET | `/disk` | Raw disk usage percentage |
| GET | `/containers` | Full Docker container list with status |
| GET | `/container-summary` | Running / stopped / total counts |
| GET | `/incidents` | All stored incidents |
| GET | `/incident-summary` | Count by severity (INFO/WARNING/CRITICAL) |
| GET | `/reliability-history` | Last 50 metric snapshots |
| GET | `/ai-status` | Whether AI engine is configured and ready |
| POST | `/ai-analyze` | Trigger full AI infrastructure analysis |
| POST | `/chat` | Send message to SRE AI chatbot |
| GET | `/health` | Backend uptime check |

---

## 🖥️ Screenshots

> Dashboard — Live metric gauges, container stats, trend chart, recent incidents:

<img width="1910" height="919" alt="image" src="https://github.com/user-attachments/assets/56faf793-983d-4fee-af30-d20cdcd96033" />


> AI Analysis — Risk assessment, recommendations, predicted issues, SRE chatbot:

<img width="1913" height="916" alt="image" src="https://github.com/user-attachments/assets/6405b277-7ec3-4d33-a333-6f686ee9f28a" />


> Incidents — Full incident log with severity classification and timestamps:

<img width="1909" height="701" alt="image" src="https://github.com/user-attachments/assets/43ee640b-2e24-4f33-bd47-bd752b1e5458" />


> Containers — Real-time Docker container monitoring with status indicators:

<img width="1919" height="661" alt="image" src="https://github.com/user-attachments/assets/ba711dee-cba9-4611-9f2e-1f011feab538" />

<img width="1918" height="911" alt="image" src="https://github.com/user-attachments/assets/fd9ebb72-21f2-4075-8fac-ccba2c603d40" />



---

## ⚙️ Local Setup

### Prerequisites

- Docker Desktop (running)
- Python 3.10+
- Node.js 18+
- Free Groq API key → [console.groq.com](https://console.groq.com)

---

### Step 1 — Clone & Start Monitoring Stack

```bash
git clone https://github.com/yourusername/CortexOps
cd CortexOps

# Start Prometheus + Grafana + Node Exporter
cd monitoring
docker compose up -d

# Verify containers are running
docker ps
```

Services started:
- Prometheus → `http://localhost:9090`
- Grafana → `http://localhost:3000`
- Node Exporter → `http://localhost:9100`

---

### Step 2 — Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env

# Edit .env and add your Groq key:
# GROQ_API_KEY=gsk_your_key_here

# Initialize database
python init_db.py

# Start backend
uvicorn main:app --reload --port 8000
```

Backend running at `http://localhost:8000`

Verify: `curl http://localhost:8000/` should return `{"project": "CortexOps AI", "version": "2.0.0"}`

---

### Step 3 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Dashboard at `http://localhost:3001`

---

### Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# Get free key at https://console.groq.com
GROQ_API_KEY=gsk_your_key_here
```

The API key is **never sent to the frontend**. The browser only receives `{"ai_enabled": true/false}` from `/ai-status`.

---

## 🚀 Future Improvements

| Improvement | Description |
|---|---|
| **Multi-server monitoring** | Extend Node Exporter to monitor remote servers via Ansible inventory |
| **Alerting integration** | Send incident notifications to Slack / PagerDuty / email |
| **Kubernetes support** | Add kube-state-metrics for pod and node monitoring |
| **AI incident correlation** | Auto-group related incidents and suggest root cause across services |
| **Custom alert thresholds** | User-configurable CPU/memory/disk thresholds from the UI |
| **Log ingestion** | Integrate with Loki or Elasticsearch for log-based incident detection |
| **SLO/SLA tracking** | Define service level objectives and track error budgets |
| **Historical reports** | Weekly/monthly PDF reliability reports generated by AI |
| **Runbook automation** | AI-generated runbooks exported and stored per incident type |
| **Dark/Light theme toggle** | Optional light mode for daytime monitoring |

---

## 📚 Learnings

### Infrastructure & DevOps
- How Prometheus scrapes and stores time-series metrics from exporters
- Docker networking — why services need shared networks to communicate
- Container lifecycle management via Docker SDK in Python
- Bash scripting patterns for process and resource monitoring

### Backend Engineering
- Building async REST APIs with FastAPI and Pydantic models
- Secure API key handling — environment variables vs. request parameters
- SQLite for lightweight persistent storage of incidents and history
- Graceful degradation — AI fallback when Groq API is unavailable

### AI Integration
- Groq API (OpenAI-compatible) for free LLM inference
- Prompt engineering for structured JSON output from LLMs
- Context injection — giving the AI live system state in the system prompt
- Handling JSON parsing edge cases in LLM responses

### Frontend
- Next.js App Router architecture with server/client component separation
- Custom SVG arc gauges with animated stroke-dasharray transitions
- TypeScript strict mode — CSS property literal types require `as const`
- Recharts for real-time data visualization with live polling

### Security
- Never expose API keys to the frontend — proxy all AI calls through backend
- `.gitignore` discipline — `.env`, `node_modules`, `__pycache__`, SQLite DB
- Environment-based configuration with `.env.example` as safe template

---

## 👨‍💻 Author

**Kuchipudi Pranav Sai**
B.Tech Computer Science · GITAM University, Visakhapatnam · 2026

- GitHub: [Pranav-Sai](https://github.com/pranavsaai)
- Email: pkuchipu2@gitam.in

---

*Built as part of learning Site Reliability Engineering fundamentals — Docker, Ansible, Linux, Prometheus, CI/CD, and infrastructure automation.*
