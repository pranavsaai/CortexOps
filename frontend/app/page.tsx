"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ─── Types ────────────────────────────────────────────────────
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

type Tab = "dashboard" | "containers" | "incidents" | "ai";

// ─── Design tokens ────────────────────────────────────────────
const C = {
  bg: "#050810", surface: "#0a0f1e", surface2: "#0f1628",
  border: "#1a2540", border2: "#243050",
  text: "#e2e8f8", muted: "#4a5880",
  accent: "#3d6fff", accent2: "#00d4ff",
  green: "#00ff88", yellow: "#ffcc00", red: "#ff3d6e", purple: "#9d6fff",
};

const metricColor = (v: number) => v > 80 ? C.red : v > 60 ? C.yellow : C.green;
const scoreColor = (s: number) => s >= 80 ? C.green : s >= 50 ? C.yellow : C.red;
const SEV: Record<string, string> = { CRITICAL: C.red, WARNING: C.yellow, INFO: C.accent2 };
const RISK: Record<string, string> = { LOW: C.green, MEDIUM: C.yellow, HIGH: C.red, CRITICAL: C.red };

// ─── Reusable components ──────────────────────────────────────

function Card({ children, style = {}, glow }: { children: React.ReactNode; style?: React.CSSProperties; glow?: string }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${glow ? glow + "40" : C.border}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: glow ? `0 0 24px ${glow}15, inset 0 0 40px ${glow}05` : "none",
      transition: "box-shadow 0.3s",
      ...style
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" as const as const, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 12, background: C.accent, borderRadius: 2 }} />
      {children}
    </div>
  );
}

function StatusDot({ active, pulse }: { active: boolean; pulse?: boolean }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {pulse && active && (
        <span style={{
          position: "absolute", width: 12, height: 12, borderRadius: "50%",
          background: C.green, opacity: 0.3,
          animation: "pulse-glow 1.5s ease-in-out infinite",
          transform: "translate(-2px, -2px)"
        }} />
      )}
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? C.green : C.red, display: "inline-block", flexShrink: 0, boxShadow: active ? `0 0 8px ${C.green}` : "none" }} />
    </span>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ background: `${color}18`, color, border: `1px solid ${color}35`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const as const }}>      {text}
    </span>
  );
}

// Arc Gauge component
function ArcGauge({ label, value }: { label: string; value: number }) {
  const color = metricColor(value);
  const size = 140;
  const strokeW = 8;
  const r = (size / 2) - strokeW - 4;
  const startAngle = -210;
  const sweepAngle = 240;
  const angle = startAngle + (value / 100) * sweepAngle;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cx = size / 2, cy = size / 2;

  const arcPath = (start: number, end: number) => {
    const s = { x: cx + r * Math.cos(toRad(start)), y: cy + r * Math.sin(toRad(start)) };
    const e = { x: cx + r * Math.cos(toRad(end)), y: cy + r * Math.sin(toRad(end)) };
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const dotX = cx + r * Math.cos(toRad(angle));
  const dotY = cy + r * Math.sin(toRad(angle));

  return (
    <Card glow={color} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", position: "relative", overflow: "hidden" }}>
      {/* shimmer bg */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, ${color}08 0%, transparent 70%)`, pointerEvents: "none" as const as const }} />

      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Track */}
        <path d={arcPath(startAngle, startAngle + sweepAngle)} fill="none" stroke={C.border2} strokeWidth={strokeW} strokeLinecap="round" />
        {/* Value arc */}
        {value > 0 && (
          <path d={arcPath(startAngle, angle)} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
        )}
        {/* Dot indicator */}
        <circle cx={dotX} cy={dotY} r={5} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        {/* Center value */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={28} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
          {value}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill={C.muted} fontSize={11} fontFamily="'JetBrains Mono', monospace">
          %
        </text>
      </svg>

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" as const, marginTop: 4 }}>{label}</div>

      {/* Threshold ticks */}
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {[25, 50, 75, 100].map(t => (
          <div key={t} style={{ width: 24, height: 2, borderRadius: 1, background: value >= t ? color : C.border2, transition: "background 0.4s" }} />
        ))}
      </div>
    </Card>
  );
}

// Score ring
function ScoreRing({ score, status }: { score: number; status: string }) {
  const color = scoreColor(score);
  const r = 48, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <Card glow={color} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={60} cy={60} r={r} fill="none" stroke={C.border2} strokeWidth={8} />
          <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>/ 100</div>
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" as const, marginTop: 10 }}>Reliability</div>
      <div style={{ marginTop: 8 }}><Badge text={status} color={color} /></div>
    </Card>
  );
}

// Chat bubble
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isAI = msg.role === "ai";
  return (
    <div style={{ display: "flex", justifyContent: isAI ? "flex-start" : "flex-end", marginBottom: 10, alignItems: "flex-end", gap: 8, animation: "slide-in 0.2s ease" }}>
      {isAI && (
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>⚡</div>
      )}
      <div style={{
        maxWidth: "80%", padding: "9px 13px",
        borderRadius: isAI ? "3px 10px 10px 10px" : "10px 3px 10px 10px",
        background: isAI ? C.surface2 : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
        color: C.text, fontSize: 12, lineHeight: 1.7,
        border: isAI ? `1px solid ${C.border2}` : "none",
        whiteSpace: "pre-wrap" as const, fontFamily: "'JetBrains Mono', monospace"
      }}>
        {msg.content}
        <div style={{ fontSize: 9, color: isAI ? C.muted : "rgba(255,255,255,0.5)", marginTop: 4 }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [incSummary, setIncSummary] = useState<{ info: number; warning: number; critical: number } | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "CortexOps AI online ⚡\n\nI have full visibility into your infrastructure. Click Analyze to get a live assessment, or ask me anything.", timestamp: new Date().toISOString() }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [tick, setTick] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
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
      setHistory([...hist].reverse().slice(-40));
      setIncSummary(incSum); setAiEnabled(aiStat.ai_enabled);
      setTick(t => t + 1);
    } catch { /* backend not ready yet */ }
  }, []);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 5000); return () => clearInterval(t); }, [fetchAll]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const handleAnalyze = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/ai-analyze", { method: "POST" });
      const result = await res.json();
      if (!res.ok) { alert(result.detail); } else { setAiAnalysis(result.analysis); }
    } catch { alert("AI analysis failed. Check backend."); }
    setAiLoading(false);
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput, timestamp: new Date().toISOString() };
    setChatMessages(p => [...p, userMsg]);
    setChatInput(""); setChatLoading(true);
    const context = data ? { cpu: data.cpu, memory: data.memory, disk: data.disk, score: data.reliability_score, health_status: data.health_status, running: data.containers_running, stopped: data.containers_stopped } : {};
    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, context })
      });
      const result = await res.json();
      setChatMessages(p => [...p, { role: "ai", content: result.response || result.detail, timestamp: result.timestamp || new Date().toISOString() }]);
    } catch {
      setChatMessages(p => [...p, { role: "ai", content: "Connection error.", timestamp: new Date().toISOString() }]);
    }
    setChatLoading(false);
  };

  // ── Loading screen ──
  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 48, animation: "pulse-glow 1s ease-in-out infinite" }}>⚡</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        CORTEXOPS
      </div>
      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>CONNECTING TO BACKEND...</div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "containers", label: "Containers", icon: "◫" },
    { id: "incidents", label: "Incidents", icon: "◉" },
    { id: "ai", label: "AI Analysis", icon: "◆" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>

      {/* ── TOPBAR ── */}
      <header style={{
        background: `${C.surface}e8`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, zIndex: 100,
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 18, filter: `drop-shadow(0 0 6px ${C.accent})` }}>⚡</span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2 }}>
              CORTEXOPS
            </span>
            <span style={{ fontSize: 9, color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 3, padding: "1px 5px", letterSpacing: 1 }}>v2.0</span>
          </div>

          {/* Nav — scrollable on mobile */}
          <nav style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none" as const as const }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                background: tab === t.id ? `${C.accent}20` : "transparent",
                color: tab === t.id ? C.accent2 : C.muted,
                fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: 0.5, transition: "all 0.2s", whiteSpace: "nowrap" as const,
                borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              }}>
                <span style={{ fontSize: 13 }}>{t.icon}</span>
                {t.label}
                {t.id === "incidents" && (incSummary?.critical ?? 0) > 0 && (
                  <span style={{ background: C.red, color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: 9, fontWeight: 800 }}>
                    {incSummary!.critical}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Status pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "4px 10px" }}>
              <StatusDot active={data.health_status === "HEALTHY"} pulse />
              <span style={{ fontSize: 10, color: data.health_status === "HEALTHY" ? C.green : C.yellow, fontWeight: 700, letterSpacing: 1 }}>
                {data.health_status}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "4px 10px" }}>
              <StatusDot active={aiEnabled} />
              <span style={{ fontSize: 10, color: aiEnabled ? C.green : C.muted, fontWeight: 700, letterSpacing: 1 }}>
                AI {aiEnabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 48px", animation: "fade-in 0.3s ease" }}>

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Gauges row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              <ArcGauge label="CPU" value={data.cpu} />
              <ArcGauge label="Memory" value={data.memory} />
              <ArcGauge label="Disk" value={data.disk} />
              <ScoreRing score={data.reliability_score} status={data.health_status} />
            </div>

            {/* Container stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              {[
                { label: "Running", value: data.containers_running, color: C.green, icon: "▶" },
                { label: "Stopped", value: data.containers_stopped, color: C.red, icon: "■" },
                { label: "Total", value: data.containers_total, color: C.accent2, icon: "◫" },
              ].map(item => (
                <Card key={item.label} glow={item.color}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" as const }}>{item.label}</span>
                    <span style={{ fontSize: 14, color: item.color }}>{item.icon}</span>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>containers</div>
                </Card>
              ))}
            </div>

            {/* Chart + recent incidents */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", gap: 16 }}>
              <Card>
                <SectionLabel>System Metrics — Live</SectionLabel>
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  {[{ label: "CPU", color: C.red }, { label: "MEM", color: C.yellow }, { label: "DISK", color: C.accent }].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 18, height: 2, background: l.color, borderRadius: 1 }} />
                      <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>{l.label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 9, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{ background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono" }}
                      labelStyle={{ display: "none" }}
                      formatter={(value) => [`${value}%`]}
                    />
                    <Line type="monotone" dataKey="cpu" stroke={C.red} strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="memory" stroke={C.yellow} strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="disk" stroke={C.accent} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <SectionLabel>Recent Incidents</SectionLabel>
                  <button onClick={() => setTab("incidents")} style={{ background: "none", border: "none", color: C.accent, fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>ALL →</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {incidents.slice(0, 6).map(inc => (
                    <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.surface2, borderRadius: 7, border: `1px solid ${SEV[inc.severity]}20` }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: SEV[inc.severity], flexShrink: 0, boxShadow: `0 0 4px ${SEV[inc.severity]}` }} />
                      <span style={{ fontSize: 11, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>{inc.message}</span>
                    </div>
                  ))}
                  {incidents.length === 0 && (
                    <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 20 }}>✓ All clear</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Incident summary */}
            {incSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Info", value: incSummary.info, color: C.accent2, icon: "●" },
                  { label: "Warning", value: incSummary.warning, color: C.yellow, icon: "▲" },
                  { label: "Critical", value: incSummary.critical, color: C.red, icon: "◆" },
                ].map(item => (
                  <Card key={item.label} glow={item.color} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${item.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: item.color, flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" as const }}>{item.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: item.color, lineHeight: 1.1 }}>{item.value}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ CONTAINERS ══ */}
        {tab === "containers" && (
          <Card>
            <SectionLabel>Docker Containers — {containers.length} total</SectionLabel>
            <div style={{ display: "grid", gap: 8 }}>
              {containers.map(c => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", background: C.surface2,
                  border: `1px solid ${c.status === "running" ? C.green : C.red}25`,
                  borderRadius: 9, transition: "border-color 0.3s",
                  flexWrap: "wrap", gap: 10
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <StatusDot active={c.status === "running"} pulse={c.status === "running"} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                      <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{c.image[0] || "unknown"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Badge text={c.status} color={c.status === "running" ? C.green : C.red} />
                    <span style={{ color: C.border2, fontSize: 10 }}>{c.id}</span>
                  </div>
                </div>
              ))}
              {containers.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 48 }}>No containers</div>}
            </div>
          </Card>
        )}

        {/* ══ INCIDENTS ══ */}
        {tab === "incidents" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {incSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 16 }}>
                {[
                  { label: "Info", value: incSummary.info, color: C.accent2 },
                  { label: "Warning", value: incSummary.warning, color: C.yellow },
                  { label: "Critical", value: incSummary.critical, color: C.red },
                ].map(item => (
                  <Card key={item.label} glow={item.color} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 8 }}>{item.label}</div>
                    <div style={{ fontSize: 40, fontWeight: 900, color: item.color }}>{item.value}</div>
                  </Card>
                ))}
              </div>
            )}
            <Card>
              <SectionLabel>Incident Log — {incidents.length} events</SectionLabel>
              <div style={{ display: "grid", gap: 6 }}>
                {incidents.slice(0, 60).map(inc => (
                  <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.surface2, border: `1px solid ${SEV[inc.severity]}18`, borderRadius: 8, flexWrap: "wrap" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: SEV[inc.severity], flexShrink: 0 }} />
                    <Badge text={inc.severity} color={SEV[inc.severity]} />
                    <span style={{ flex: 1, color: C.text, fontSize: 12, minWidth: 120 }}>{inc.message}</span>
                    <span style={{ color: C.muted, fontSize: 10, whiteSpace: "nowrap" as const }}>{new Date(inc.timestamp).toLocaleString()}</span>
                  </div>
                ))}
                {incidents.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 48 }}>✓ No incidents</div>}
              </div>
            </Card>
          </div>
        )}

        {/* ══ AI ANALYSIS ══ */}
        {tab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Status + analyze button */}
            <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <StatusDot active={aiEnabled} pulse={aiEnabled} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>AI Engine — {aiEnabled ? "Connected" : "Offline"}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {aiEnabled ? "Groq LLaMA 3.1 · Ready for analysis" : "Set GROQ_API_KEY in backend/.env"}
                  </div>
                </div>
              </div>
              <button onClick={handleAnalyze} disabled={!aiEnabled || aiLoading} style={{
                padding: "10px 24px", borderRadius: 8, border: `1px solid ${aiEnabled && !aiLoading ? C.accent : C.border2}`,
                background: aiEnabled && !aiLoading ? `${C.accent}20` : "transparent",
                color: aiEnabled && !aiLoading ? C.accent2 : C.muted,
                fontWeight: 700, fontSize: 12, cursor: !aiEnabled || aiLoading ? "not-allowed" : "pointer",
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, transition: "all 0.2s",
                whiteSpace: "nowrap" as const
              }}>
                {aiLoading ? "◌ ANALYZING..." : "◆ ANALYZE INFRASTRUCTURE"}
              </button>
            </Card>

            {!aiEnabled && (
              <Card style={{ background: `${C.red}08`, border: `1px solid ${C.red}25` }}>
                <SectionLabel>Setup Required</SectionLabel>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 2 }}>
                  <span style={{ color: C.muted }}># Create </span><span style={{ color: C.accent2 }}>backend/.env</span><br />
                  <span style={{ color: C.green }}>GROQ_API_KEY</span>=<span style={{ color: C.yellow }}>gsk_your_key_here</span><br />
                  <span style={{ color: C.muted }}># Get free key → </span><span style={{ color: C.accent }}>console.groq.com</span><br />
                  <span style={{ color: C.muted }}># Then restart: </span><span style={{ color: C.text }}>uvicorn main:app --reload</span>
                </div>
              </Card>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
              {/* Analysis panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {aiAnalysis ? (
                  <>
                    <Card glow={RISK[aiAnalysis.risk_level]}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <SectionLabel>Assessment</SectionLabel>
                        <Badge text={`RISK: ${aiAnalysis.risk_level}`} color={RISK[aiAnalysis.risk_level]} />
                      </div>
                      <p style={{ color: C.text, fontSize: 13, lineHeight: 1.8 }}>{aiAnalysis.overall_assessment}</p>
                    </Card>

                    <Card style={{ border: `1px solid ${C.green}25` }}>
                      <SectionLabel>Quick Win</SectionLabel>
                      <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}20`, borderRadius: 8, padding: "12px 14px", color: C.green, fontSize: 13, lineHeight: 1.7 }}>
                        {aiAnalysis.quick_win}
                      </div>
                    </Card>

                    <Card>
                      <SectionLabel>Recommendations</SectionLabel>
                      {aiAnalysis.recommendations.map((rec, i) => (
                        <div key={i} style={{ background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <Badge text={rec.priority} color={rec.priority === "HIGH" ? C.red : rec.priority === "MEDIUM" ? C.yellow : C.green} />
                            <span style={{ fontWeight: 700, fontSize: 12 }}>{rec.action}</span>
                          </div>
                          <div style={{ color: C.muted, fontSize: 11 }}>{rec.reason}</div>
                        </div>
                      ))}
                    </Card>

                    <Card style={{ border: `1px solid ${C.yellow}25` }}>
                      <SectionLabel>Predicted Issues</SectionLabel>
                      <p style={{ color: C.yellow, fontSize: 13, lineHeight: 1.7 }}>{aiAnalysis.predicted_issues}</p>
                    </Card>
                  </>
                ) : (
                  <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 340, gap: 12 }}>
                    <div style={{ fontSize: 40, filter: `drop-shadow(0 0 12px ${C.accent})` }}>◆</div>
                    <div style={{ color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 1.8 }}>
                      {aiEnabled ? "Click ANALYZE INFRASTRUCTURE\nto get live AI insights" : "Configure GROQ_API_KEY to enable"}
                    </div>
                  </Card>
                )}
              </div>

              {/* Chat panel */}
              <Card style={{ display: "flex", flexDirection: "column", height: 620 }}>
                <SectionLabel>SRE AI Chat</SectionLabel>
                <div style={{ flex: 1, overflowY: "auto", marginBottom: 12, paddingRight: 4 }}>
                  {chatMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                  {chatLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 12 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center" }}>⚡</div>
                      <span style={{ animation: "pulse-glow 1s ease-in-out infinite" }}>thinking...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick prompts */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {["Why is CPU high?", "Free disk space?", "Explain score", "Run commands?"].map(q => (
                    <button key={q} onClick={() => setChatInput(q)} style={{
                      background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 5,
                      padding: "3px 9px", color: C.muted, fontSize: 10, cursor: "pointer",
                      fontFamily: "'JetBrains Mono', monospace", transition: "color 0.2s"
                    }}>{q}</button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                    placeholder={aiEnabled ? "Ask about your infrastructure..." : "AI offline..."}
                    disabled={!aiEnabled || chatLoading}
                    style={{
                      flex: 1, background: C.surface2, border: `1px solid ${C.border2}`,
                      borderRadius: 8, padding: "9px 13px", color: C.text, fontSize: 12, outline: "none",
                      fontFamily: "'JetBrains Mono', monospace", transition: "border-color 0.2s"
                    }}
                  />
                  <button onClick={handleChat} disabled={!aiEnabled || chatLoading || !chatInput.trim()} style={{
                    padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: !aiEnabled || !chatInput.trim() ? C.surface2 : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                    color: !aiEnabled || !chatInput.trim() ? C.muted : "#fff",
                    fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s"
                  }}>
                    SEND
                  </button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "12px 24px", textAlign: "center", fontSize: 9, color: C.muted, letterSpacing: 1.5 }}>
        CORTEXOPS v2.0 · SRE MONITORING · AUTO-REFRESH 5s · {new Date().getFullYear()}
      </footer>
    </div>
  );
}