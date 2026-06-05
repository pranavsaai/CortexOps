"use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DashboardData {
  cpu: number; memory: number; disk: number;
  reliability_score: number; health_status: string;
  timestamp: string; recommendations: string[];
  containers_running: number; containers_stopped: number; containers_total: number;
}
interface Incident { id: number; severity: string; message: string; timestamp: string; }
interface Container { id: string; name: string; status: string; image: string[]; }
interface HistoryPoint { cpu: number; memory: number; disk: number; score: number; timestamp: string; }
interface ChatMessage { role: "user" | "ai"; content: string; timestamp: string; }
interface AIAnalysis {
  overall_assessment: string; risk_level: string;
  recommendations: { priority: string; action: string; reason: string }[];
  predicted_issues: string; quick_win: string;
}

function Gauge({ label, value }: { label: string; value: number }) {
  const color = value > 80 ? "#ef4444" : value > 60 ? "#f59e0b" : "#22c55e";
  const r = 52, circ = 2 * Math.PI * r, dash = (value / 100) * circ;
  return (
    <div style={{ background: "#0f172a", border: `1px solid ${color}25`, borderRadius: 16, padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: `0 0 24px ${color}10` }}>
      <div style={{ position: "relative", width: 128, height: 128 }}>
        <svg width={128} height={128} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={64} cy={64} r={r} fill="none" stroke="#1e293b" strokeWidth={9} />
          <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={9}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "monospace" }}>{value}%</div>
        </div>
      </div>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 12 }}>{label}</div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  const map: Record<string, string> = { red: "#ef4444", yellow: "#f59e0b", green: "#22c55e", blue: "#3b82f6", purple: "#a855f7", gray: "#64748b" };
  const c = map[color] || color;
  return <span style={{ background: `${c}18`, color: c, border: `1px solid ${c}35`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}>{text}</span>;
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isAI = msg.role === "ai";
  return (
    <div style={{ display: "flex", justifyContent: isAI ? "flex-start" : "flex-end", marginBottom: 12, alignItems: "flex-end", gap: 8 }}>
      {isAI && <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🤖</div>}
      <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: isAI ? "4px 12px 12px 12px" : "12px 4px 12px 12px", background: isAI ? "#1e293b" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#f1f5f9", fontSize: 13, lineHeight: 1.65, border: isAI ? "1px solid #334155" : "none", whiteSpace: "pre-wrap" }}>
        {msg.content}
        <div style={{ fontSize: 10, color: isAI ? "#475569" : "#c4b5fd", marginTop: 5 }}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

const SEV_COLOR: Record<string, string> = { CRITICAL: "#ef4444", WARNING: "#f59e0b", INFO: "#3b82f6" };
const SEV_BADGE: Record<string, string> = { CRITICAL: "red", WARNING: "yellow", INFO: "blue" };
const RISK_COLOR: Record<string, string> = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444", CRITICAL: "#dc2626" };

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [incidentSummary, setIncidentSummary] = useState<any>(null);
  const [aiEnabled, setAiEnabled] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      content: "Hi! I'm CortexOps AI 👋\n\nI'm connected to your infrastructure and ready to help. Click Analyze Infrastructure to get a full assessment, or ask me anything!",
      timestamp: new Date().toISOString()
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "containers" | "incidents" | "ai">("dashboard");
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchAll = async () => {
    try {
      const [dash, inc, cont, hist, incSum, aiStat] = await Promise.all([
        fetch("http://127.0.0.1:8000/dashboard").then(r => r.json()),
        fetch("http://127.0.0.1:8000/incidents").then(r => r.json()),
        fetch("http://127.0.0.1:8000/containers").then(r => r.json()),
        fetch("http://127.0.0.1:8000/reliability-history").then(r => r.json()),
        fetch("http://127.0.0.1:8000/incident-summary").then(r => r.json()),
        fetch("http://127.0.0.1:8000/ai-status").then(r => r.json()),
      ]);
      setData(dash); setIncidents(inc); setContainers(cont);
      setHistory([...hist].reverse().slice(-30));
      setIncidentSummary(incSum);
      setAiEnabled(aiStat.ai_enabled);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) { console.error("Fetch error:", e); }
  };

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const handleAIAnalyze = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/ai-analyze", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail);
        setAiLoading(false);
        return;
      }
      const result = await res.json();
      setAiAnalysis(result.analysis);
    } catch { alert("AI analysis failed. Check backend."); }
    setAiLoading(false);
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    const context = data ? {
      cpu: data.cpu, memory: data.memory, disk: data.disk,
      score: data.reliability_score, health_status: data.health_status,
      running: data.containers_running, stopped: data.containers_stopped
    } : {};
    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, context })
      });
      const result = await res.json();
      setChatMessages(prev => [...prev, { role: "ai", content: result.response || result.detail, timestamp: result.timestamp || new Date().toISOString() }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "ai", content: "Connection error. Check backend.", timestamp: new Date().toISOString() }]);
    }
    setChatLoading(false);
  };

  const scoreColor = (s: number) => s >= 80 ? "#22c55e" : s >= 50 ? "#f59e0b" : "#ef4444";
  const card = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 24 };

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "#020617", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#f1f5f9", fontFamily: "Inter,sans-serif" }}>
      <div style={{ fontSize: 44 }}>⚡</div>
      <div style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CortexOps AI</div>
      <div style={{ color: "#475569", fontSize: 14 }}>Connecting to backend...</div>
    </div>
  );

  const healthColor = data.health_status === "HEALTHY" ? "green" : data.health_status === "WARNING" ? "yellow" : "red";

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#f1f5f9", fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* TOPBAR */}
      <div style={{ background: "#0a1628", borderBottom: "1px solid #1e293b", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{ fontSize: 19, fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CortexOps</span>
          <Badge text="v2.0" color="purple" />
        </div>

        <div style={{ display: "flex", gap: 2 }}>
          {(["dashboard", "containers", "incidents", "ai"] as const).map(tab => {
            const labels: Record<string, string> = { dashboard: "📊 Dashboard", containers: "🐳 Containers", incidents: "🚨 Incidents", ai: "🤖 AI Analysis" };
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent", color: active ? "#fff" : "#64748b", fontWeight: 600, fontSize: 13, transition: "all 0.2s", position: "relative" }}>
                {labels[tab]}
                {tab === "incidents" && incidentSummary?.critical > 0 && (
                  <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{incidentSummary.critical}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge text={data.health_status} color={healthColor} />
          {/* 🤖 AI status indicator — no key shown, just green/red dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "5px 12px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: aiEnabled ? "#22c55e" : "#ef4444", boxShadow: `0 0 6px ${aiEnabled ? "#22c55e" : "#ef4444"}` }} />
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>AI {aiEnabled ? "Ready" : "Offline"}</span>
          </div>
          <span style={{ color: "#334155", fontSize: 12 }}>🔄 {lastUpdated}</span>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1380, margin: "0 auto" }}>

        {/* ════ DASHBOARD ════ */}
        {activeTab === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 18, marginBottom: 20 }}>
              <Gauge label="CPU Usage" value={data.cpu} />
              <Gauge label="Memory Usage" value={data.memory} />
              <Gauge label="Disk Usage" value={data.disk} />
              <div style={{ ...card, border: `1px solid ${scoreColor(data.reliability_score)}25`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 0 24px ${scoreColor(data.reliability_score)}10` }}>
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Reliability Score</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor(data.reliability_score), fontFamily: "monospace", lineHeight: 1 }}>{data.reliability_score}</div>
                <div style={{ fontSize: 11, color: "#334155" }}>out of 100</div>
                <Badge text={data.health_status} color={healthColor} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 20 }}>
              {[{ label: "Running Containers", value: data.containers_running, color: "#22c55e", icon: "🟢" },
                { label: "Stopped Containers", value: data.containers_stopped, color: "#ef4444", icon: "🔴" },
                { label: "Total Containers", value: data.containers_total, color: "#6366f1", icon: "🐳" }
              ].map(item => (
                <div key={item.label} style={card}>
                  <div style={{ color: "#475569", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{item.icon} {item.label}</div>
                  <div style={{ fontSize: 40, fontWeight: 900, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 18, marginBottom: 20 }}>
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div style={{ color: "#475569", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>📈 System Metrics Trend</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[{ label: "CPU", color: "#ef4444" }, { label: "Memory", color: "#f59e0b" }, { label: "Disk", color: "#6366f1" }].map(l => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 10, height: 3, background: l.color, borderRadius: 2 }} />
                        <span style={{ fontSize: 11, color: "#64748b" }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                    <XAxis dataKey="timestamp" tick={false} stroke="#1e293b" />
                    <YAxis domain={[0, 100]} stroke="#1e293b" tick={{ fill: "#475569", fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
                      formatter={(v: any, name: string) => [`${v}%`, name.toUpperCase()]}
                      labelFormatter={() => ""}
                    />
                    <Line type="monotone" dataKey="cpu" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="memory" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="disk" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={card}>
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🚨 Recent Incidents</span>
                  <button onClick={() => setActiveTab("incidents")} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>View all →</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {incidents.slice(0, 5).map(inc => (
                    <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#060f1e", borderRadius: 8, border: `1px solid ${SEV_COLOR[inc.severity]}20` }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: SEV_COLOR[inc.severity], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.message}</span>
                      <Badge text={inc.severity} color={SEV_BADGE[inc.severity]} />
                    </div>
                  ))}
                  {incidents.length === 0 && <div style={{ color: "#334155", fontSize: 13, textAlign: "center", padding: 20 }}>✅ All clear</div>}
                </div>
              </div>
            </div>

            {incidentSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
                {[{ label: "INFO", value: incidentSummary.info, color: "#3b82f6", icon: "ℹ️" },
                  { label: "WARNING", value: incidentSummary.warning, color: "#f59e0b", icon: "⚠️" },
                  { label: "CRITICAL", value: incidentSummary.critical, color: "#ef4444", icon: "🔴" }
                ].map(item => (
                  <div key={item.label} style={{ ...card, border: `1px solid ${item.color}22`, display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{item.icon}</div>
                    <div>
                      <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{item.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════ CONTAINERS ════ */}
        {activeTab === "containers" && (
          <div style={card}>
            <div style={{ color: "#475569", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 }}>🐳 Docker Containers — {containers.length} total</div>
            <div style={{ display: "grid", gap: 10 }}>
              {containers.map(c => (
                <div key={c.id} style={{ background: "#060f1e", border: `1px solid ${c.status === "running" ? "#22c55e22" : "#ef444422"}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: c.status === "running" ? "#22c55e" : "#ef4444", boxShadow: `0 0 8px ${c.status === "running" ? "#22c55e" : "#ef4444"}` }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                      <div style={{ color: "#475569", fontSize: 12, fontFamily: "monospace", marginTop: 2 }}>{c.image[0] || "unknown"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Badge text={c.status.toUpperCase()} color={c.status === "running" ? "green" : "red"} />
                    <span style={{ color: "#334155", fontSize: 11, fontFamily: "monospace" }}>{c.id}</span>
                  </div>
                </div>
              ))}
              {containers.length === 0 && <div style={{ color: "#334155", textAlign: "center", padding: 48 }}>No containers found</div>}
            </div>
          </div>
        )}

        {/* ════ INCIDENTS ════ */}
        {activeTab === "incidents" && (
          <>
            {incidentSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 20 }}>
                {[{ label: "INFO", value: incidentSummary.info, color: "#3b82f6", icon: "ℹ️" },
                  { label: "WARNING", value: incidentSummary.warning, color: "#f59e0b", icon: "⚠️" },
                  { label: "CRITICAL", value: incidentSummary.critical, color: "#ef4444", icon: "🔴" }
                ].map(item => (
                  <div key={item.label} style={{ ...card, border: `1px solid ${item.color}25`, display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${item.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{item.icon}</div>
                    <div>
                      <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{item.label}</div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={card}>
              <div style={{ color: "#475569", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>🚨 Incident Log — {incidents.length} total</div>
              <div style={{ display: "grid", gap: 8 }}>
                {incidents.slice(0, 60).map(inc => (
                  <div key={inc.id} style={{ background: "#060f1e", border: `1px solid ${SEV_COLOR[inc.severity]}20`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: SEV_COLOR[inc.severity], flexShrink: 0 }} />
                    <Badge text={inc.severity} color={SEV_BADGE[inc.severity]} />
                    <span style={{ flex: 1, color: "#94a3b8", fontSize: 13 }}>{inc.message}</span>
                    <span style={{ color: "#334155", fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap" }}>{new Date(inc.timestamp).toLocaleString()}</span>
                  </div>
                ))}
                {incidents.length === 0 && <div style={{ color: "#334155", textAlign: "center", padding: 48 }}>✅ No incidents</div>}
              </div>
            </div>
          </>
        )}

        {/* ════ AI ANALYSIS ════ */}
        {activeTab === "ai" && (
          <>
            {/* AI status banner — no key input, just status + analyze button */}
            <div style={{ ...card, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: aiEnabled ? "#22c55e" : "#ef4444", boxShadow: `0 0 8px ${aiEnabled ? "#22c55e" : "#ef4444"}` }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>AI Engine — {aiEnabled ? "Connected" : "Not Configured"}</div>
                  <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
                    {aiEnabled ? "Claude AI is ready. Click Analyze to get infrastructure insights." : "Set ANTHROPIC_API_KEY in backend/.env to enable AI features."}
                  </div>
                </div>
              </div>
              <button onClick={handleAIAnalyze} disabled={!aiEnabled || aiLoading}
                style={{ padding: "12px 28px", borderRadius: 10, border: "none", cursor: !aiEnabled || aiLoading ? "not-allowed" : "pointer", background: !aiEnabled || aiLoading ? "#1e293b" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: !aiEnabled || aiLoading ? "#475569" : "#fff", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
                {aiLoading ? "⏳ Analyzing..." : "🧠 Analyze Infrastructure"}
              </button>
            </div>

            {!aiEnabled && (
              <div style={{ ...card, marginBottom: 20, background: "#1a0a0a", border: "1px solid #ef444430" }}>
                <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: 10 }}>⚙️ Setup Required</div>
                <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8, fontFamily: "monospace" }}>
                  # Create backend/.env file and add:<br />
                  ANTHROPIC_API_KEY=sk-ant-api03-your-key-here<br /><br />
                  # Then restart backend:<br />
                  uvicorn main:app --reload
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Analysis results */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {aiAnalysis ? (
                  <>
                    <div style={{ ...card, border: `1px solid ${RISK_COLOR[aiAnalysis.risk_level]}30` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>🧠 Overall Assessment</div>
                        <Badge text={`Risk: ${aiAnalysis.risk_level}`} color={aiAnalysis.risk_level === "LOW" ? "green" : aiAnalysis.risk_level === "MEDIUM" ? "yellow" : "red"} />
                      </div>
                      <p style={{ color: "#cbd5e1", lineHeight: 1.75, fontSize: 14, margin: 0 }}>{aiAnalysis.overall_assessment}</p>
                    </div>
                    <div style={card}>
                      <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>⚡ Quick Win</div>
                      <div style={{ background: "#022c1a", border: "1px solid #22c55e25", borderRadius: 10, padding: "14px 16px", color: "#22c55e", fontSize: 14, lineHeight: 1.6 }}>{aiAnalysis.quick_win}</div>
                    </div>
                    <div style={card}>
                      <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>🎯 Recommendations</div>
                      {aiAnalysis.recommendations.map((rec, i) => (
                        <div key={i} style={{ background: "#060f1e", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <Badge text={rec.priority} color={rec.priority === "HIGH" ? "red" : rec.priority === "MEDIUM" ? "yellow" : "green"} />
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{rec.action}</span>
                          </div>
                          <div style={{ color: "#64748b", fontSize: 13 }}>{rec.reason}</div>
                        </div>
                      ))}
                    </div>
                    <div style={card}>
                      <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>🔮 Predicted Issues</div>
                      <p style={{ color: "#f59e0b", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{aiAnalysis.predicted_issues}</p>
                    </div>
                  </>
                ) : (
                  <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, gap: 16, color: "#334155" }}>
                    <div style={{ fontSize: 52 }}>🧠</div>
                    <div style={{ textAlign: "center", lineHeight: 1.8, fontSize: 14 }}>
                      {aiEnabled ? <>Click <strong style={{ color: "#6366f1" }}>Analyze Infrastructure</strong><br />to get AI-powered insights</> : "Configure API key in backend/.env to enable AI"}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat */}
              <div style={{ ...card, display: "flex", flexDirection: "column", height: 680 }}>
                <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>💬 SRE AI Chat</div>
                <div style={{ flex: 1, overflowY: "auto", marginBottom: 14 }}>
                  {chatMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                  {chatLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 13 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div>
                      <span>Thinking...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {["Why is CPU high?", "How to free disk space?", "Explain my reliability score", "What commands should I run?"].map(q => (
                    <button key={q} onClick={() => setChatInput(q)} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "4px 10px", color: "#64748b", fontSize: 11, cursor: "pointer" }}>{q}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                    placeholder={aiEnabled ? "Ask anything about your infrastructure..." : "AI offline — configure .env first"}
                    disabled={!aiEnabled || chatLoading}
                    style={{ flex: 1, background: "#020617", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13, outline: "none" }} />
                  <button onClick={handleChat} disabled={!aiEnabled || chatLoading || !chatInput.trim()}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: !aiEnabled || !chatInput.trim() ? "#1e293b" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: !aiEnabled || !chatInput.trim() ? "#475569" : "#fff", fontWeight: 700, fontSize: 13 }}>
                    Send ➤
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}