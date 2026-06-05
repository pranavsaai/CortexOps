import requests  # 🤖 Groq API se baat karne ke liye — free tier! 🆓
import json
import os

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"  # 🚀 Fast + free!

# 🔑 .env se load — UI mein kabhi expose nahi hoga
API_KEY = os.getenv("GROQ_API_KEY", "")


def get_ai_analysis(cpu: float, memory: float, disk: float,
                    running: int, stopped: int, score: int,
                    incidents: list) -> dict:
    """
    Groq AI se infrastructure analysis — free mein! 🧠
    """
    recent_incidents = incidents[:5]
    incident_text = "\n".join([
        f"- [{i['severity']}] {i['message']} at {i['timestamp']}"
        for i in recent_incidents
    ]) if recent_incidents else "No recent incidents."

    prompt = f"""You are CortexOps AI, an expert SRE assistant analyzing live infrastructure metrics.

Current Infrastructure State:
- CPU Usage: {cpu}%
- Memory Usage: {memory}%
- Disk Usage: {disk}%
- Reliability Score: {score}/100
- Running Containers: {running}
- Stopped Containers: {stopped}

Recent Incidents:
{incident_text}

Respond with ONLY a valid JSON object, no markdown, no extra text:
{{
  "overall_assessment": "2-3 sentence summary of infrastructure health",
  "risk_level": "LOW or MEDIUM or HIGH or CRITICAL",
  "recommendations": [
    {{"priority": "HIGH or MEDIUM or LOW", "action": "specific action", "reason": "why this matters"}}
  ],
  "predicted_issues": "What might go wrong in the next hour if no action taken",
  "quick_win": "Single most impactful thing to do right now"
}}

Max 3 recommendations. Be specific and technical."""

    result = _call_groq(prompt, system="You are an expert SRE assistant. Always respond with valid JSON only.")

    if result:
        return result
    return _fallback_analysis(cpu, memory, disk, score)


def get_ai_chat_response(user_message: str, context: dict) -> str:
    """
    SRE chatbot — Groq se, free mein, server side only! 💬
    """
    system = f"""You are CortexOps AI, a senior Site Reliability Engineer assistant.

Live infrastructure context:
- CPU: {context.get('cpu', 'N/A')}%
- Memory: {context.get('memory', 'N/A')}%
- Disk: {context.get('disk', 'N/A')}%
- Reliability Score: {context.get('score', 'N/A')}/100
- Health Status: {context.get('health_status', 'N/A')}
- Running Containers: {context.get('running', 'N/A')}
- Stopped Containers: {context.get('stopped', 'N/A')}

Answer SRE questions concisely. Suggest Linux commands when relevant. Use bullet points for steps."""

    result = _call_groq(user_message, system=system, json_mode=False)

    if isinstance(result, str):
        return result
    return "AI service unavailable. Check GROQ_API_KEY in your .env file."


def _call_groq(user_message: str, system: str = "", json_mode: bool = True):
    """
    🔧 Groq API caller — OpenAI-compatible format!
    """
    if not API_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 1024,
        "temperature": 0.3,
    }

    # 🎯 JSON mode — only for structured responses
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        response = requests.post(
            GROQ_API_URL,
            headers=headers,
            json=payload,
            timeout=15
        )

        if response.status_code != 200:
            print(f"Groq error: {response.status_code} — {response.text}")
            return None

        text = response.json()["choices"][0]["message"]["content"].strip()

        if json_mode:
            # 🧹 Strip markdown if any
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            return json.loads(text)

        return text  # Plain text for chat

    except Exception as e:
        print(f"Groq call failed: {e}")
        return None


def _fallback_analysis(cpu, memory, disk, score) -> dict:
    """
    ⚡ Groq unavailable aithe basic fallback!
    """
    risk = "LOW"
    if score < 50:
        risk = "CRITICAL"
    elif score < 80:
        risk = "MEDIUM"

    recs = []
    if cpu > 80:
        recs.append({"priority": "HIGH", "action": "Investigate high CPU processes", "reason": f"CPU at {cpu}% exceeds safe threshold"})
    if memory > 80:
        recs.append({"priority": "HIGH", "action": "Check for memory leaks", "reason": f"Memory at {memory}% is critical"})
    if disk > 90:
        recs.append({"priority": "HIGH", "action": "Free disk space immediately", "reason": f"Disk at {disk}% — service failure imminent"})
    if not recs:
        recs.append({"priority": "LOW", "action": "Continue monitoring", "reason": "All metrics within normal range"})

    return {
        "overall_assessment": f"Reliability score is {score}/100. {'System operating normally.' if score >= 80 else 'Attention required.'}",
        "risk_level": risk,
        "recommendations": recs,
        "predicted_issues": "Set GROQ_API_KEY in .env for AI-powered predictions.",
        "quick_win": "Ensure Prometheus and Node Exporter are running."
    }