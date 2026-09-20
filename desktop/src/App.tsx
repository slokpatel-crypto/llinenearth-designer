import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "motion/react";

type EventRecord = {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  payload?: Record<string, unknown>;
};

type SessionRecord = {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  answers: Record<string, string>;
  selectedLook?: Record<string, unknown> | null;
  sale?: Record<string, unknown> | null;
  events: EventRecord[];
};

type DashboardSummary = {
  vaultPath: string;
  totals: {
    sessions: number;
    renders: number;
    whatsapp: number;
    visits: number;
    sales: number;
    revenue: number;
  };
  counts: Record<string, number>;
  sessions: SessionRecord[];
};

const nav = ["Today", "Customers", "Leads", "Orders", "Fabrics", "Visuals", "Marketing", "Analytics", "AI Brain", "Memory"];

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function ago(iso?: string) {
  if (!iso) return "—";
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function titleCase(input: string) {
  return input.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function App() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saleAmount, setSaleAmount] = useState("");
  const [status, setStatus] = useState("Opening local memory…");
  const [activeNav, setActiveNav] = useState("Today");

  async function refresh() {
    try {
      const data = await invoke<DashboardSummary>("get_dashboard_summary");
      setSummary(data);
      setSelected((current) => current || data.sessions[0]?.sessionId || null);
      setStatus("Local memory connected");
    } catch (error) {
      setStatus(`Desktop memory unavailable: ${String(error)}`);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selectedSession = useMemo(
    () => summary?.sessions.find((session) => session.sessionId === selected) || summary?.sessions[0] || null,
    [selected, summary],
  );

  const attention = useMemo(
    () =>
      (summary?.sessions || []).filter((session) => {
        const whatsapp = session.events.some((event) => event.type === "whatsapp_clicked");
        const sale = session.events.some((event) => event.type === "sale_logged");
        return whatsapp && !sale;
      }),
    [summary],
  );

  async function logOutcome(kind: "visit_logged" | "sale_logged") {
    if (!selectedSession) return;
    await invoke("record_outcome", {
      sessionId: selectedSession.sessionId,
      kind,
      amount: kind === "sale_logged" && saleAmount ? Number(saleAmount) : null,
    });
    setSaleAmount("");
    await refresh();
  }

  async function backup() {
    try {
      const file = await invoke<string>("create_backup");
      setStatus(`Backup created: ${file}`);
    } catch (error) {
      setStatus(`Backup failed: ${String(error)}`);
    }
  }

  const funnel = [
    ["Started", summary?.counts.session_started || 0],
    ["Looks", summary?.counts.looks_generated || 0],
    ["Visual", summary?.counts.render_completed || 0],
    ["WhatsApp", summary?.counts.whatsapp_clicked || 0],
    ["Visit", summary?.counts.visit_logged || 0],
    ["Sale", summary?.counts.sale_logged || 0],
  ] as const;
  const funnelMax = Math.max(1, ...funnel.map(([, value]) => value));

  return (
    <div className="osShell">
      <aside className="sidebar">
        <div className="brandMark"><span>LE</span><div><b>LLINEN EARTH</b><small>OPERATOR SYSTEM</small></div></div>
        <nav>
          {nav.map((item) => (
            <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}>
              <span>{item}</span>
              {item === "Leads" && attention.length > 0 && <em>{attention.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <span className="liveDot" />
          <div><b>LOCAL VAULT</b><small>{status}</small></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <small>LLINEN EARTH OS / {activeNav.toUpperCase()}</small>
            <h1>{activeNav === "Today" ? <>Know what happened.<br/><em>Know what to do next.</em></> : titleCase(activeNav)}</h1>
          </div>
          <div className="topActions">
            <button onClick={() => void refresh()}>Refresh</button>
            <button className="primary" onClick={() => void backup()}>Create backup</button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeNav === "Today" ? (
            <motion.section
              key="today"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="metricGrid">
                {[
                  ["Style sessions", summary?.totals.sessions || 0, "Customer journeys recorded"],
                  ["Visuals created", summary?.totals.renders || 0, "High-intent design actions"],
                  ["WhatsApp intent", summary?.totals.whatsapp || 0, "Moved toward conversation"],
                  ["Revenue logged", money(summary?.totals.revenue || 0), "Confirmed outcomes"],
                ].map(([label, value, note], index) => (
                  <motion.article
                    layout
                    key={label}
                    className={index === 3 ? "metric accent" : "metric"}
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.045 }}
                  >
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <p>{note}</p>
                  </motion.article>
                ))}
              </div>

              <div className="contentGrid">
                <div className="mainColumn">
                  <motion.article layout className="card funnelCard">
                    <div className="cardHead">
                      <div><small>CUSTOMER JOURNEY</small><h2>Where interest becomes business.</h2></div>
                      <b>{summary?.totals.sessions ? Math.round(((summary?.totals.whatsapp || 0) / summary.totals.sessions) * 100) : 0}%<span>session → WhatsApp</span></b>
                    </div>
                    <div className="funnel">
                      {funnel.map(([label, value]) => (
                        <div key={label}>
                          <span><b>{label}</b><em>{value}</em></span>
                          <i><motion.u initial={{ width: 0 }} animate={{ width: `${Math.max(3, (value / funnelMax) * 100)}%` }} transition={{ duration: 0.55 }} /></i>
                        </div>
                      ))}
                    </div>
                    <p className="explain"><b>What to watch:</b> the largest drop between stages is the first place to investigate.</p>
                  </motion.article>

                  <motion.article layout className="card">
                    <div className="cardHead">
                      <div><small>FOLLOW-UP QUEUE</small><h2>People who showed real intent.</h2></div>
                      <span>{attention.length} open</span>
                    </div>
                    <div className="leadList">
                      {attention.length === 0 ? <div className="empty">No unresolved WhatsApp-intent customers yet.</div> :
                        attention.slice(0, 6).map((session) => (
                          <button key={session.sessionId} onClick={() => setSelected(session.sessionId)}>
                            <span className="alertMark">!</span>
                            <span><b>{session.answers.occasion || "Style session"} · {session.answers.mood || "Intent captured"}</b><small>{String(session.selectedLook?.fabric || "Look selected")} · no sale logged</small></span>
                            <em>{ago(session.lastAt)} ↗</em>
                          </button>
                        ))}
                    </div>
                  </motion.article>

                  <motion.article layout className="card">
                    <div className="cardHead">
                      <div><small>RECENT SESSIONS</small><h2>Every customer story, compressed.</h2></div>
                    </div>
                    <div className="sessionTable">
                      {(summary?.sessions || []).slice(0, 12).map((session) => (
                        <button key={session.sessionId} className={selectedSession?.sessionId === session.sessionId ? "selected" : ""} onClick={() => setSelected(session.sessionId)}>
                          <span><b>{session.answers.occasion || "Unfinished journey"}</b><small>{session.answers.mood || "—"} · {session.answers.time || "—"}</small></span>
                          <span>{session.answers.garment || "—"}</span>
                          <span>{session.answers.colorDirection || "—"}</span>
                          <span>{ago(session.lastAt)} ↗</span>
                        </button>
                      ))}
                      {!summary?.sessions.length && <div className="empty tall">No sessions yet. Website activity will sync here once cloud memory is connected.</div>}
                    </div>
                  </motion.article>
                </div>

                <aside className="detailColumn">
                  <AnimatePresence mode="wait">
                    <motion.article
                      key={selectedSession?.sessionId || "empty"}
                      className="card detailCard"
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.24 }}
                    >
                      <div className="cardHead">
                        <div><small>CUSTOMER STORY</small><h2>{selectedSession?.answers.occasion || "Select a session"}</h2></div>
                        <span>{ago(selectedSession?.lastAt)}</span>
                      </div>
                      {selectedSession ? (
                        <>
                          <div className="chips">
                            {Object.entries(selectedSession.answers).map(([key, value]) => <span key={key}><small>{key}</small><b>{value}</b></span>)}
                          </div>
                          {selectedSession.selectedLook && <div className="look"><small>SELECTED LOOK</small><strong>{String(selectedSession.selectedLook.title || "Selected direction")}</strong><span>{String(selectedSession.selectedLook.fabric || "")}</span></div>}
                          <div className="timeline">
                            {selectedSession.events.slice(-8).reverse().map((event) => <div key={event.id}><i/><span><b>{titleCase(event.type)}</b><small>{ago(event.at)}</small></span></div>)}
                          </div>
                          <div className="outcome">
                            <small>REAL-WORLD OUTCOME</small>
                            <button onClick={() => void logOutcome("visit_logged")}>Mark store visit</button>
                            <div><span>₹</span><input value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} placeholder="Sale amount" inputMode="numeric"/><button onClick={() => void logOutcome("sale_logged")}>Save sale</button></div>
                          </div>
                        </>
                      ) : <div className="empty tall">Choose a session to inspect its full journey.</div>}
                    </motion.article>
                  </AnimatePresence>

                  <motion.article layout className="card vaultCard">
                    <div className="cardHead"><div><small>MEMORY VAULT</small><h2>Stored on this PC.</h2></div><span className="good">● LIVE</span></div>
                    <p>Your desktop app reads and writes only the LLinen Earth business vault managed by the native app.</p>
                    <code>{summary?.vaultPath || "Preparing vault…"}</code>
                    <div className="vaultRows">
                      <span><b>Customer events</b> Append-only records</span>
                      <span><b>Backups</b> Local snapshots</span>
                      <span><b>Cloud sync</b> Ready for secure connection</span>
                    </div>
                  </motion.article>
                </aside>
              </div>
            </motion.section>
          ) : (
            <motion.section key={activeNav} className="placeholder" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span>MODULE</span><h2>{activeNav}</h2><p>This module is reserved in the desktop information architecture. The Today dashboard and Memory foundation are the first fully functional layer.</p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
