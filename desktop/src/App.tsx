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

type CustomerMeta = {
  name: string;
  phone: string;
  note: string;
  leadStatus: string;
};

type SessionRecord = {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  answers: Record<string, string>;
  selectedLook?: Record<string, unknown> | null;
  sale?: Record<string, unknown> | null;
  customer: CustomerMeta;
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

type SyncResult = {
  configured: boolean;
  imported: number;
  nextCursor?: string | null;
  message: string;
};

type FabricInventoryItem = {
  id: string;
  family: string;
  line: string;
  colorName: string;
  hex: string;
  swatchImageUrl: string;
  suitableFor: string[];
  pattern: string;
  compositionNote?: string | null;
  sourceDocument: string;
  sourcePage: number;
  sourceInStock: boolean;
  status: "in-stock" | "low" | "out";
  quantityMeters?: number | null;
  note: string;
  updatedAt: string;
};

type InventoryView = {
  generatedAt?: string | null;
  cachedAt?: string | null;
  fabrics: FabricInventoryItem[];
};

const nav = ["Today", "Customers", "Leads", "Orders", "Fabrics", "Visuals", "Marketing", "Analytics", "AI Brain", "Memory"];
const leadStatuses = ["new", "follow-up", "contacted", "visit-booked", "won", "lost"];

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
  return input.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function shortId(value: string) {
  return value.length > 13 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function hasEvent(session: SessionRecord, type: string) {
  return session.events.some((event) => event.type === type);
}

function inferredStage(session: SessionRecord) {
  if (session.customer.leadStatus) return session.customer.leadStatus;
  if (hasEvent(session, "sale_logged")) return "won";
  if (hasEvent(session, "visit_logged")) return "visit-booked";
  if (hasEvent(session, "whatsapp_clicked")) return "follow-up";
  if (hasEvent(session, "render_completed")) return "new";
  return "browsing";
}

function intentLabel(session: SessionRecord) {
  if (hasEvent(session, "sale_logged")) return "Sale";
  if (hasEvent(session, "visit_logged")) return "Visited";
  if (hasEvent(session, "whatsapp_clicked")) return "WhatsApp";
  if (hasEvent(session, "render_completed")) return "Visual";
  if (hasEvent(session, "look_selected")) return "Look selected";
  return "Browsing";
}

function saleValue(session?: SessionRecord | null) {
  const raw = session?.sale?.amount;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw) || 0;
  return 0;
}

export default function App() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saleAmount, setSaleAmount] = useState("");
  const [status, setStatus] = useState("Opening local memory…");
  const [activeNav, setActiveNav] = useState("Today");
  const [syncing, setSyncing] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({ name: "", phone: "", note: "" });
  const [inventory, setInventory] = useState<InventoryView>({ fabrics: [] });
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryLine, setInventoryLine] = useState("All");
  const [inventorySyncing, setInventorySyncing] = useState(false);
  const [fabricDraft, setFabricDraft] = useState({ status: "in-stock", quantity: "", note: "" });

  async function refresh() {
    try {
      const data = await invoke<DashboardSummary>("get_dashboard_summary");
      setSummary(data);
      setSelected((current) => current && data.sessions.some((session) => session.sessionId === current) ? current : data.sessions[0]?.sessionId || null);
      setStatus("Local memory connected");
    } catch (error) {
      setStatus(`Desktop memory unavailable: ${String(error)}`);
    }
  }

  async function loadInventory() {
    try {
      const data = await invoke<InventoryView>("get_fabric_inventory");
      setInventory(data);
      setSelectedFabricId((current) => current && data.fabrics.some((fabric) => fabric.id === current) ? current : data.fabrics[0]?.id || null);
    } catch (error) {
      setStatus(`Inventory unavailable: ${String(error)}`);
    }
  }

  useEffect(() => {
    void refresh();
    void loadInventory();
  }, []);

  const selectedSession = useMemo(
    () => summary?.sessions.find((session) => session.sessionId === selected) || summary?.sessions[0] || null,
    [selected, summary],
  );

  useEffect(() => {
    setCustomerDraft({
      name: selectedSession?.customer.name || "",
      phone: selectedSession?.customer.phone || "",
      note: selectedSession?.customer.note || "",
    });
  }, [selectedSession?.sessionId, selectedSession?.customer.name, selectedSession?.customer.phone, selectedSession?.customer.note]);

  const attention = useMemo(
    () =>
      (summary?.sessions || []).filter((session) => {
        const whatsapp = hasEvent(session, "whatsapp_clicked");
        const sale = hasEvent(session, "sale_logged");
        const lost = inferredStage(session) === "lost";
        return whatsapp && !sale && !lost;
      }),
    [summary],
  );

  const leads = useMemo(
    () =>
      (summary?.sessions || []).filter((session) =>
        Boolean(session.customer.name) ||
        Boolean(session.customer.leadStatus) ||
        hasEvent(session, "render_completed") ||
        hasEvent(session, "whatsapp_clicked") ||
        hasEvent(session, "visit_logged") ||
        hasEvent(session, "sale_logged"),
      ),
    [summary],
  );

  const orders = useMemo(
    () => (summary?.sessions || []).filter((session) => hasEvent(session, "sale_logged")),
    [summary],
  );

  const selectedFabric = useMemo(
    () => inventory.fabrics.find((fabric) => fabric.id === selectedFabricId) || inventory.fabrics[0] || null,
    [inventory, selectedFabricId],
  );

  const fabricLines = useMemo(
    () => ["All", ...Array.from(new Set(inventory.fabrics.map((fabric) => fabric.line))).sort()],
    [inventory],
  );

  const fabricSignals = useMemo(() => {
    const signals = new Map<string, { interest: number; whatsapp: number; sales: number }>();
    for (const session of summary?.sessions || []) {
      const fabricId = String(session.selectedLook?.fabricId || "");
      if (!fabricId) continue;
      const current = signals.get(fabricId) || { interest: 0, whatsapp: 0, sales: 0 };
      current.interest += 1;
      if (hasEvent(session, "whatsapp_clicked")) current.whatsapp += 1;
      if (hasEvent(session, "sale_logged")) current.sales += 1;
      signals.set(fabricId, current);
    }
    return signals;
  }, [summary]);

  const filteredFabrics = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    return inventory.fabrics.filter((fabric) => {
      const lineMatch = inventoryLine === "All" || fabric.line === inventoryLine;
      const searchMatch = !query || [fabric.colorName, fabric.line, fabric.pattern, ...fabric.suitableFor]
        .join(" ")
        .toLowerCase()
        .includes(query);
      return lineMatch && searchMatch;
    });
  }, [inventory, inventoryLine, inventorySearch]);

  useEffect(() => {
    setFabricDraft({
      status: selectedFabric?.status || "in-stock",
      quantity: selectedFabric?.quantityMeters == null ? "" : String(selectedFabric.quantityMeters),
      note: selectedFabric?.note || "",
    });
  }, [selectedFabric?.id, selectedFabric?.status, selectedFabric?.quantityMeters, selectedFabric?.note]);

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

  async function saveCustomer() {
    if (!selectedSession) return;
    await invoke("update_customer", {
      sessionId: selectedSession.sessionId,
      name: customerDraft.name,
      phone: customerDraft.phone,
      note: customerDraft.note,
    });
    setStatus("Customer details saved locally");
    await refresh();
  }

  async function changeLeadStatus(nextStatus: string) {
    if (!selectedSession) return;
    await invoke("set_lead_status", {
      sessionId: selectedSession.sessionId,
      status: nextStatus,
    });
    setStatus(`Lead moved to ${titleCase(nextStatus)}`);
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

  async function syncCloud() {
    setSyncing(true);
    try {
      const result = await invoke<SyncResult>("sync_from_cloud");
      setStatus(result.message);
      if (result.configured) await refresh();
    } catch (error) {
      setStatus(`Cloud sync failed: ${String(error)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function syncInventory() {
    setInventorySyncing(true);
    try {
      const result = await invoke<SyncResult>("sync_fabric_inventory");
      setStatus(result.message);
      await loadInventory();
    } catch (error) {
      setStatus(`Inventory sync failed: ${String(error)}`);
    } finally {
      setInventorySyncing(false);
    }
  }

  async function saveFabric() {
    if (!selectedFabric) return;
    await invoke("update_fabric_inventory", {
      fabricId: selectedFabric.id,
      status: fabricDraft.status,
      quantityMeters: fabricDraft.quantity === "" ? null : Number(fabricDraft.quantity),
      note: fabricDraft.note,
    });
    setStatus(`${selectedFabric.colorName} inventory saved locally`);
    await loadInventory();
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

  const customerEditor = selectedSession ? (
    <motion.article
      key={selectedSession.sessionId}
      className="card detailCard"
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.24 }}
    >
      <div className="cardHead">
        <div>
          <small>CUSTOMER STORY</small>
          <h2>{selectedSession.customer.name || selectedSession.answers.occasion || "Anonymous session"}</h2>
        </div>
        <span>{ago(selectedSession.lastAt)}</span>
      </div>

      <div className="contactForm">
        <label><small>NAME</small><input value={customerDraft.name} onChange={(e) => setCustomerDraft((v) => ({ ...v, name: e.target.value }))} placeholder="Add customer name" /></label>
        <label><small>PHONE</small><input value={customerDraft.phone} onChange={(e) => setCustomerDraft((v) => ({ ...v, phone: e.target.value }))} placeholder="Add phone / WhatsApp" /></label>
        <label className="wide"><small>NOTE</small><textarea value={customerDraft.note} onChange={(e) => setCustomerDraft((v) => ({ ...v, note: e.target.value }))} placeholder="Fit, budget, date, follow-up note…" /></label>
        <button onClick={() => void saveCustomer()}>Save customer</button>
      </div>

      <div className="leadStatusBlock">
        <small>LEAD STATUS</small>
        <div>
          {leadStatuses.map((leadStatus) => (
            <button key={leadStatus} className={inferredStage(selectedSession) === leadStatus ? "active" : ""} onClick={() => void changeLeadStatus(leadStatus)}>
              {titleCase(leadStatus)}
            </button>
          ))}
        </div>
      </div>

      <div className="chips">
        {Object.entries(selectedSession.answers).map(([key, value]) => <span key={key}><small>{key}</small><b>{value}</b></span>)}
      </div>

      {selectedSession.selectedLook && (
        <div className="look">
          <small>SELECTED LOOK</small>
          <strong>{String(selectedSession.selectedLook.title || "Selected direction")}</strong>
          <span>{String(selectedSession.selectedLook.fabric || "")}</span>
        </div>
      )}

      <div className="timeline">
        {selectedSession.events.slice(-10).reverse().map((event) => (
          <div key={event.id}><i/><span><b>{titleCase(event.type)}</b><small>{ago(event.at)}</small></span></div>
        ))}
      </div>

      <div className="outcome">
        <small>REAL-WORLD OUTCOME</small>
        <button onClick={() => void logOutcome("visit_logged")}>Mark store visit</button>
        <div><span>₹</span><input value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} placeholder="Sale amount" inputMode="numeric"/><button onClick={() => void logOutcome("sale_logged")}>Save sale</button></div>
      </div>
    </motion.article>
  ) : (
    <div className="card empty tall">Choose a customer journey to inspect it.</div>
  );

  function sessionRows(rows: SessionRecord[], leadMode = false) {
    return (
      <div className="sessionTable richTable">
        {rows.map((session) => (
          <button key={session.sessionId} className={selectedSession?.sessionId === session.sessionId ? "selected" : ""} onClick={() => setSelected(session.sessionId)}>
            <span>
              <b>{session.customer.name || session.answers.occasion || "Anonymous journey"}</b>
              <small>{session.customer.phone || shortId(session.sessionId)}</small>
            </span>
            <span><b className="tableStrong">{session.answers.garment || "—"}</b><small>{session.answers.colorDirection || "—"}</small></span>
            <span><em className={`stageTag stage-${inferredStage(session)}`}>{titleCase(inferredStage(session))}</em><small>{intentLabel(session)}</small></span>
            <span>{saleValue(session) ? money(saleValue(session)) : leadMode ? String(session.selectedLook?.fabric || "—") : ago(session.lastAt)}</span>
            <span>{ago(session.lastAt)} ↗</span>
          </button>
        ))}
        {!rows.length && <div className="empty tall">No matching customer journeys yet.</div>}
      </div>
    );
  }

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
            <h1>
              {activeNav === "Today" ? <>Know what happened.<br/><em>Know what to do next.</em></> :
               activeNav === "Customers" ? <>Every customer.<br/><em>One continuous story.</em></> :
               activeNav === "Leads" ? <>Intent first.<br/><em>Follow up at the right moment.</em></> :
               activeNav === "Orders" ? <>From intent to value.<br/><em>Know what converted.</em></> :
               activeNav === "Fabrics" ? <>Know every colour.<br/><em>Know what is moving.</em></> :
               titleCase(activeNav)}
            </h1>
          </div>
          <div className="topActions">
            <button onClick={() => void syncCloud()} disabled={syncing}>{syncing ? "Syncing…" : "Sync cloud"}</button>
            <button onClick={() => void refresh()}>Refresh</button>
            <button className="primary" onClick={() => void backup()}>Create backup</button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeNav === "Today" && (
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
                          <button key={session.sessionId} onClick={() => { setSelected(session.sessionId); setActiveNav("Leads"); }}>
                            <span className="alertMark">!</span>
                            <span><b>{session.customer.name || session.answers.occasion || "Style session"} · {session.answers.mood || "Intent captured"}</b><small>{String(session.selectedLook?.fabric || "Look selected")} · {titleCase(inferredStage(session))}</small></span>
                            <em>{ago(session.lastAt)} ↗</em>
                          </button>
                        ))}
                    </div>
                  </motion.article>

                  <motion.article layout className="card">
                    <div className="cardHead">
                      <div><small>RECENT SESSIONS</small><h2>Every customer story, compressed.</h2></div>
                    </div>
                    {sessionRows((summary?.sessions || []).slice(0, 12))}
                  </motion.article>
                </div>

                <aside className="detailColumn">
                  <AnimatePresence mode="wait">{customerEditor}</AnimatePresence>
                  <motion.article layout className="card vaultCard">
                    <div className="cardHead"><div><small>MEMORY VAULT</small><h2>Stored on this PC.</h2></div><span className="good">● LIVE</span></div>
                    <p>The desktop app owns the local LLinen Earth business vault. Cloud website activity can be imported without giving the web app access to your files.</p>
                    <code>{summary?.vaultPath || "Preparing vault…"}</code>
                    <div className="vaultRows">
                      <span><b>Customer events</b> Append-only records</span>
                      <span><b>Backups</b> Local snapshots</span>
                      <span><b>Cloud sync</b> Token-protected import</span>
                    </div>
                  </motion.article>
                </aside>
              </div>
            </motion.section>
          )}

          {activeNav === "Customers" && (
            <motion.section key="customers" className="moduleGrid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="card moduleList">
                <div className="cardHead">
                  <div><small>CUSTOMER MEMORY</small><h2>{summary?.totals.sessions || 0} recorded journeys.</h2></div>
                  <span>{(summary?.sessions || []).filter((s) => s.customer.name).length} identified</span>
                </div>
                <div className="tableHeader"><span>Customer / session</span><span>Interest</span><span>Status</span><span>Value</span><span>Last</span></div>
                {sessionRows(summary?.sessions || [])}
              </div>
              <aside className="moduleDetail"><AnimatePresence mode="wait">{customerEditor}</AnimatePresence></aside>
            </motion.section>
          )}

          {activeNav === "Leads" && (
            <motion.section key="leads" className="moduleGrid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="card moduleList">
                <div className="cardHead">
                  <div><small>INTENT QUEUE</small><h2>{leads.length} journeys worth watching.</h2></div>
                  <span>{attention.length} need follow-up</span>
                </div>
                <div className="leadSummary">
                  <span><b>{leads.filter((s) => hasEvent(s, "whatsapp_clicked") && !hasEvent(s, "sale_logged")).length}</b><small>WhatsApp, no sale</small></span>
                  <span><b>{leads.filter((s) => hasEvent(s, "visit_logged") && !hasEvent(s, "sale_logged")).length}</b><small>Visited, no sale</small></span>
                  <span><b>{leads.filter((s) => hasEvent(s, "sale_logged")).length}</b><small>Won</small></span>
                </div>
                <div className="tableHeader"><span>Lead</span><span>Interest</span><span>Status</span><span>Look / value</span><span>Last</span></div>
                {sessionRows(leads, true)}
              </div>
              <aside className="moduleDetail"><AnimatePresence mode="wait">{customerEditor}</AnimatePresence></aside>
            </motion.section>
          )}


          {activeNav === "Orders" && (
            <motion.section key="orders" className="moduleGrid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="card moduleList">
                <div className="cardHead">
                  <div><small>CONFIRMED BUSINESS</small><h2>{orders.length} recorded sales.</h2></div>
                  <span>{money(summary?.totals.revenue || 0)} total</span>
                </div>
                <div className="leadSummary orderSummary">
                  <span><b>{orders.length}</b><small>Orders</small></span>
                  <span><b>{orders.length ? money((summary?.totals.revenue || 0) / orders.length) : money(0)}</b><small>Average value</small></span>
                  <span><b>{summary?.totals.sessions ? Math.round((orders.length / summary.totals.sessions) * 100) : 0}%</b><small>Session → sale</small></span>
                </div>
                <div className="tableHeader"><span>Customer / session</span><span>Garment</span><span>Status</span><span>Sale value</span><span>Last</span></div>
                {sessionRows(orders)}
              </div>
              <aside className="moduleDetail"><AnimatePresence mode="wait">{customerEditor}</AnimatePresence></aside>
            </motion.section>
          )}

          {activeNav === "Fabrics" && (
            <motion.section key="fabrics" className="fabricWorkspace" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="fabricMain">
                <div className="fabricMetrics">
                  <article><small>STRUCTURED COLOURS</small><strong>{inventory.fabrics.length}</strong><span>{fabricLines.length - 1} fabric lines</span></article>
                  <article><small>LOW STOCK</small><strong>{inventory.fabrics.filter((fabric) => fabric.status === "low").length}</strong><span>Needs operator attention</span></article>
                  <article><small>OUT OF STOCK</small><strong>{inventory.fabrics.filter((fabric) => fabric.status === "out").length}</strong><span>Hidden from confident selling</span></article>
                  <article className="accent"><small>CUSTOMER SIGNALS</small><strong>{Array.from(fabricSignals.values()).reduce((sum, signal) => sum + signal.interest, 0)}</strong><span>Selected fabric directions</span></article>
                </div>

                <article className="card fabricCatalog">
                  <div className="cardHead">
                    <div><small>FABRIC LIBRARY</small><h2>Stock and demand on one surface.</h2></div>
                    <button className="smallAction" onClick={() => void syncInventory()} disabled={inventorySyncing}>{inventorySyncing ? "Syncing…" : "Refresh from website"}</button>
                  </div>
                  <div className="fabricFilters">
                    <input value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} placeholder="Search colour, line, pattern or garment…" />
                    <select value={inventoryLine} onChange={(e) => setInventoryLine(e.target.value)}>
                      {fabricLines.map((line) => <option key={line}>{line}</option>)}
                    </select>
                    <span>{filteredFabrics.length} shown</span>
                  </div>
                  {inventory.fabrics.length === 0 ? (
                    <div className="empty tall">
                      No structured inventory has been cached on this PC yet. Press <b>Refresh from website</b> once the inventory feed is live.
                    </div>
                  ) : (
                    <div className="fabricGrid">
                      {filteredFabrics.map((fabric) => {
                        const signal = fabricSignals.get(fabric.id) || { interest: 0, whatsapp: 0, sales: 0 };
                        return <button key={fabric.id} className={selectedFabric?.id === fabric.id ? "fabricTile selected" : "fabricTile"} onClick={() => setSelectedFabricId(fabric.id)}>
                          <span className="fabricSwatch" style={{ background: fabric.hex }} />
                          <span className="fabricTileBody">
                            <small>{fabric.line}</small>
                            <b>{fabric.colorName}</b>
                            <em>{fabric.pattern} · {fabric.suitableFor.join(" / ")}</em>
                            <span className="fabricSignal"><i>{signal.interest}</i> selected <i>{signal.sales}</i> sales</span>
                          </span>
                          <span className={`stockPill stock-${fabric.status}`}>{titleCase(fabric.status)}</span>
                        </button>;
                      })}
                    </div>
                  )}
                </article>
              </div>

              <aside className="fabricDetail">
                {selectedFabric ? <motion.article key={selectedFabric.id} className="card fabricEditor" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
                  <div className="fabricHeroSwatch" style={{ background: selectedFabric.hex }}><span>{selectedFabric.hex}</span></div>
                  <div className="cardHead">
                    <div><small>{selectedFabric.line}</small><h2>{selectedFabric.colorName}</h2></div>
                    <span>{selectedFabric.pattern}</span>
                  </div>

                  <div className="fabricFacts">
                    <span><small>SUITABLE FOR</small><b>{selectedFabric.suitableFor.join(" · ")}</b></span>
                    <span><small>CATALOGUE</small><b>{selectedFabric.sourceDocument} · p{selectedFabric.sourcePage}</b></span>
                    <span><small>INTEREST</small><b>{fabricSignals.get(selectedFabric.id)?.interest || 0} selections</b></span>
                    <span><small>CONVERTED</small><b>{fabricSignals.get(selectedFabric.id)?.sales || 0} sales</b></span>
                  </div>

                  <div className="inventoryEditor">
                    <small>SHOP INVENTORY STATUS</small>
                    <div className="stockButtons">
                      {["in-stock", "low", "out"].map((value) => <button key={value} className={fabricDraft.status === value ? "active" : ""} onClick={() => setFabricDraft((draft) => ({ ...draft, status: value }))}>{titleCase(value)}</button>)}
                    </div>
                    <label><span>Metres available</span><input inputMode="decimal" value={fabricDraft.quantity} onChange={(e) => setFabricDraft((draft) => ({ ...draft, quantity: e.target.value }))} placeholder="e.g. 18.5" /></label>
                    <label><span>Operator note</span><textarea value={fabricDraft.note} onChange={(e) => setFabricDraft((draft) => ({ ...draft, note: e.target.value }))} placeholder="Supplier, roll location, reorder note…" /></label>
                    <button className="saveFabric" onClick={() => void saveFabric()}>Save inventory</button>
                  </div>

                  <div className="fabricDemand">
                    <small>WHY THIS MATTERS</small>
                    <p>{(fabricSignals.get(selectedFabric.id)?.interest || 0) > 0
                      ? `Customers have selected this colour ${fabricSignals.get(selectedFabric.id)?.interest || 0} time(s). ${fabricSignals.get(selectedFabric.id)?.whatsapp || 0} reached WhatsApp and ${fabricSignals.get(selectedFabric.id)?.sales || 0} became recorded sales.`
                      : "No customer selection signal yet. The system will update this automatically as Style Director activity is synced."}</p>
                  </div>
                </motion.article> : <div className="card empty tall">Sync inventory and choose a fabric colour.</div>}

                <article className="card legacyInventory">
                  <div className="cardHead"><div><small>LLINENEARTH.COM</small><h2>Legacy website sources.</h2></div><span>8 categories</span></div>
                  <p>The importer is scanning the existing public website for additional swatches. New website-only colours stay separate until their image/name can be verified, so we do not pollute inventory with guessed colours.</p>
                  <div className="legacyLines">{["60 Lea Plain","60 Lea Formals","75 Lea Formals","Cotton Plain","Cotton Print","Digital Print","Linen Suiting","Luxurious Cotton"].map((line)=><span key={line}>{line}<i>↗</i></span>)}</div>
                </article>
              </aside>
            </motion.section>
          )}

          {!["Today", "Customers", "Leads", "Orders", "Fabrics"].includes(activeNav) && (
            <motion.section key={activeNav} className="placeholder" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span>NEXT MODULE</span><h2>{activeNav}</h2><p>The desktop foundation, Customers and Leads are now functional. This module is intentionally waiting for its real data workflow rather than showing fake controls.</p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
