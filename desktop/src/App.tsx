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
  status: "unverified" | "in-stock" | "low" | "out";
  quantityMeters?: number | null;
  note: string;
  updatedAt: string;
};

type InventoryView = {
  generatedAt?: string | null;
  cachedAt?: string | null;
  fabrics: FabricInventoryItem[];
};

type BrainActionState = {
  status: "open" | "watching" | "done" | "dismissed";
  note: string;
  updatedAt: string;
};

type BrainSignal = {
  id: string;
  level: "priority" | "opportunity" | "watch" | "info";
  title: string;
  evidence: string;
  action: string;
  module: "Leads" | "Fabrics" | "Visuals" | "Analytics" | "Customers" | "Orders";
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
  const [archivingVisuals, setArchivingVisuals] = useState(false);
  const [fabricDraft, setFabricDraft] = useState({ status: "in-stock", quantity: "", note: "" });
  const [brainActions, setBrainActions] = useState<Record<string, BrainActionState>>({});
  const [brainQuery, setBrainQuery] = useState("");
  const [brainAnswer, setBrainAnswer] = useState("Ask about demand, leads, fabrics, visuals, revenue or what needs attention.");

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

  async function loadBrainActions() {
    try {
      setBrainActions(await invoke<Record<string, BrainActionState>>("get_brain_actions"));
    } catch (error) {
      setStatus(`Brain action memory unavailable: ${String(error)}`);
    }
  }

  useEffect(() => {
    void refresh();
    void loadInventory();
    void loadBrainActions();
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

  const visuals = useMemo(
    () => (summary?.sessions || [])
      .flatMap((session) => session.events
        .filter((event) => event.type === "render_completed")
        .map((event) => ({ session, event })))
      .sort((a, b) => new Date(b.event.at).getTime() - new Date(a.event.at).getTime()),
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

  const analytics = useMemo(() => {
    const sessions = summary?.sessions || [];
    const total = sessions.length;
    const whatsappSessions = sessions.filter((session) => hasEvent(session, "whatsapp_clicked"));
    const saleSessions = sessions.filter((session) => hasEvent(session, "sale_logged"));
    const visualSessions = sessions.filter((session) => hasEvent(session, "render_completed"));
    const nonVisualSessions = sessions.filter((session) => !hasEvent(session, "render_completed"));
    const visualWhatsapp = visualSessions.filter((session) => hasEvent(session, "whatsapp_clicked")).length;
    const nonVisualWhatsapp = nonVisualSessions.filter((session) => hasEvent(session, "whatsapp_clicked")).length;

    const percent = (part: number, whole: number) => whole ? Math.round((part / whole) * 100) : 0;
    const countBy = (key: keyof SessionRecord["answers"]) => {
      const counts = new Map<string, number>();
      for (const session of sessions) {
        const value = session.answers[key] || "Unknown";
        counts.set(value, (counts.get(value) || 0) + 1);
      }
      return Array.from(counts.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const revenueBy = (key: keyof SessionRecord["answers"]) => {
      const counts = new Map<string, number>();
      for (const session of saleSessions) {
        const value = session.answers[key] || "Unknown";
        counts.set(value, (counts.get(value) || 0) + saleValue(session));
      }
      return Array.from(counts.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };

    const topFabrics = Array.from(fabricSignals.entries())
      .map(([id, signal]) => {
        const fabric = inventory.fabrics.find((item) => item.id === id);
        return {
          id,
          label: fabric?.colorName || id,
          line: fabric?.line || "Unknown line",
          hex: fabric?.hex || "#8A8178",
          ...signal,
        };
      })
      .sort((a, b) => b.interest - a.interest || b.sales - a.sales)
      .slice(0, 6);

    const hotStockRisks = topFabrics.filter((fabric) => {
      const item = inventory.fabrics.find((candidate) => candidate.id === fabric.id);
      return item && fabric.interest > 0 && (item.status === "low" || item.status === "out" || item.status === "unverified");
    });

    const insights: Array<{ level: "watch" | "good" | "info"; title: string; text: string }> = [];
    const waRate = percent(whatsappSessions.length, total);
    const saleRate = percent(saleSessions.length, total);
    const visualRate = percent(visualWhatsapp, visualSessions.length);
    const nonVisualRate = percent(nonVisualWhatsapp, nonVisualSessions.length);

    if (attention.length > 0) insights.push({
      level: "watch",
      title: `${attention.length} high-intent lead${attention.length === 1 ? "" : "s"} need follow-up`,
      text: "These journeys reached WhatsApp but do not have a recorded sale or lost outcome yet.",
    });
    if (hotStockRisks.length > 0) insights.push({
      level: "watch",
      title: "Demand is touching uncertain stock",
      text: `${hotStockRisks.length} currently popular fabric${hotStockRisks.length === 1 ? "" : "s"} are low, out or still unverified.`,
    });
    if (visualSessions.length >= 3) insights.push({
      level: visualRate >= nonVisualRate ? "good" : "info",
      title: `Visual journeys reached WhatsApp at ${visualRate}%`,
      text: `Journeys without a recorded visual reached WhatsApp at ${nonVisualRate}%. This is descriptive, not proof that the visual caused the difference.`,
    });
    if (saleSessions.length > 0) insights.push({
      level: "good",
      title: `${money(summary?.totals.revenue || 0)} in recorded revenue`,
      text: `${saleRate}% of recorded style sessions currently end in a logged sale. Keep staff outcome logging consistent for this number to become more reliable.`,
    });
    if (total < 20) insights.push({
      level: "info",
      title: "Analytics are still early",
      text: `Only ${total} customer journey${total === 1 ? "" : "s"} are recorded. Use the patterns as signals, not firm business conclusions yet.`,
    });

    return {
      total,
      whatsappRate: waRate,
      saleRate,
      averageOrder: saleSessions.length ? (summary?.totals.revenue || 0) / saleSessions.length : 0,
      visualWhatsappRate: visualRate,
      nonVisualWhatsappRate: nonVisualRate,
      occasions: countBy("occasion"),
      garments: countBy("garment"),
      colors: countBy("colorDirection"),
      revenueByGarment: revenueBy("garment"),
      topFabrics,
      insights,
    };
  }, [summary, inventory, fabricSignals, attention]);

  const brain = useMemo(() => {
    const unverified = inventory.fabrics.filter((fabric) => fabric.status === "unverified");
    const riskyTopFabrics = analytics.topFabrics.filter((ranked) => {
      const fabric = inventory.fabrics.find((item) => item.id === ranked.id);
      return fabric && ["unverified", "low", "out"].includes(fabric.status);
    });
    const topOccasion = analytics.occasions[0];
    const topGarment = analytics.garments[0];
    const identified = (summary?.sessions || []).filter((session) => session.customer.name).length;
    const signals: BrainSignal[] = [];

    if (attention.length) signals.push({
      id: "follow-up-leads",
      level: "priority",
      title: `${attention.length} customer${attention.length === 1 ? "" : "s"} showed intent but have no outcome`,
      evidence: `They reached WhatsApp and are still open. ${attention.filter((session) => hasEvent(session, "visit_logged")).length} also have a store-visit signal.`,
      action: "Open the lead queue, contact the oldest high-intent customer first, then record contacted / visit / won / lost.",
      module: "Leads",
    });

    if (riskyTopFabrics.length) signals.push({
      id: "demand-stock-risk",
      level: "priority",
      title: "Popular fabric demand is touching uncertain stock",
      evidence: riskyTopFabrics.slice(0, 3).map((fabric) => fabric.label).join(" · "),
      action: "Verify physical stock and metres before these colours are promoted or recommended confidently.",
      module: "Fabrics",
    });

    if (unverified.length) signals.push({
      id: "verify-legacy-stock",
      level: "watch",
      title: `${unverified.length} website swatches still need shop verification`,
      evidence: "These colours came from the older LLinen Earth website and are deliberately not assumed to be physically available.",
      action: "Work through the highest-demand lines first and mark each colour In Stock, Low or Out.",
      module: "Fabrics",
    });

    if (analytics.total >= 3 && analytics.visualWhatsappRate > analytics.nonVisualWhatsappRate) signals.push({
      id: "visual-signal",
      level: "opportunity",
      title: "Visual journeys are progressing further in the current sample",
      evidence: `${analytics.visualWhatsappRate}% of visual journeys reached WhatsApp vs ${analytics.nonVisualWhatsappRate}% without a recorded visual.`,
      action: "Use photoreal visuals consistently for high-intent customers and keep measuring; this is correlation, not proof of causation.",
      module: "Visuals",
    });

    if (topOccasion && topOccasion.label !== "Unknown") signals.push({
      id: "top-occasion",
      level: "opportunity",
      title: `${topOccasion.label} is the strongest recorded occasion signal`,
      evidence: `${topOccasion.value} of ${analytics.total} recorded journeys selected this occasion. Top garment: ${topGarment?.label || "not enough data"}.`,
      action: "Use this as a content and merchandising signal, then compare whether it also converts into WhatsApp and sales.",
      module: "Analytics",
    });

    if (analytics.total && analytics.whatsappRate > analytics.saleRate + 20) signals.push({
      id: "conversion-gap",
      level: "watch",
      title: "There is a meaningful gap between enquiry and recorded sale",
      evidence: `WhatsApp rate is ${analytics.whatsappRate}% while recorded sale rate is ${analytics.saleRate}%.`,
      action: "Review follow-up speed, store-visit handling and whether staff are consistently logging final outcomes.",
      module: "Leads",
    });

    if (analytics.total >= 5 && identified / analytics.total < 0.5) signals.push({
      id: "identity-gap",
      level: "info",
      title: "Many valuable journeys are still anonymous",
      evidence: `${identified} of ${analytics.total} recorded journeys currently have a customer name.`,
      action: "Capture name/phone only at a natural high-intent moment such as save, WhatsApp or fitting—not before the customer receives value.",
      module: "Customers",
    });

    if (!signals.length) signals.push({
      id: "collect-more-data",
      level: "info",
      title: "The Brain is still collecting evidence",
      evidence: `${analytics.total} journey${analytics.total === 1 ? "" : "s"} recorded so far.`,
      action: "Keep using Style Director and logging outcomes. The Brain will become more useful as real customer behavior accumulates.",
      module: "Analytics",
    });

    const open = signals.filter((signal) => !["done", "dismissed"].includes(brainActions[signal.id]?.status || "open"));
    const top = open[0] || signals[0];
    const brief = analytics.total === 0
      ? "No customer journeys are recorded yet. Your first priority is collecting real Style Director and shop outcome data."
      : `You have ${analytics.total} recorded customer journey${analytics.total === 1 ? "" : "s"}, ${attention.length} unresolved high-intent lead${attention.length === 1 ? "" : "s"}, and ${money(summary?.totals.revenue || 0)} in logged revenue. ${top ? `The strongest current action is: ${top.title}.` : ""}`;

    return { signals, open, brief, topOccasion, topGarment };
  }, [analytics, attention, inventory, summary, brainActions]);

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

  async function archiveVisuals() {
    setArchivingVisuals(true);
    try {
      const result = await invoke<SyncResult>("archive_visuals");
      setStatus(result.message);
    } catch (error) {
      setStatus(`Visual archive failed: ${String(error)}`);
    } finally {
      setArchivingVisuals(false);
    }
  }

  async function updateBrainAction(actionId: string, nextStatus: BrainActionState["status"]) {
    await invoke("update_brain_action", { actionId, status: nextStatus, note: brainActions[actionId]?.note || "" });
    await loadBrainActions();
    setStatus(`Brain action marked ${titleCase(nextStatus)}`);
  }

  function askBrain() {
    const query = brainQuery.trim().toLowerCase();
    if (!query) return;
    if (/attention|priority|today|next|do first/.test(query)) {
      const top = brain.open[0] || brain.signals[0];
      setBrainAnswer(top ? `${top.title}. ${top.evidence} Recommended action: ${top.action}` : brain.brief);
    } else if (/fabric|colour|color|stock/.test(query)) {
      const top = analytics.topFabrics[0];
      const unverified = inventory.fabrics.filter((fabric) => fabric.status === "unverified").length;
      setBrainAnswer(top ? `The strongest recorded fabric signal is ${top.label} with ${top.interest} selection(s), ${top.whatsapp} WhatsApp journey(s) and ${top.sales} recorded sale(s). ${unverified} inventory entries are still unverified.` : `No customer fabric ranking exists yet. ${unverified} inventory entries are still unverified.`);
    } else if (/lead|whatsapp|follow/.test(query)) {
      setBrainAnswer(`${attention.length} high-intent lead(s) currently reached WhatsApp without a recorded final outcome. The session-to-WhatsApp rate is ${analytics.whatsappRate}%.`);
    } else if (/sale|revenue|money|order/.test(query)) {
      setBrainAnswer(`Recorded revenue is ${money(summary?.totals.revenue || 0)} from ${summary?.totals.sales || 0} sale(s). Average recorded order value is ${money(analytics.averageOrder)} and session-to-sale conversion is ${analytics.saleRate}%.`);
    } else if (/visual|render|fashn|photo/.test(query)) {
      setBrainAnswer(`Recorded visual journeys reached WhatsApp at ${analytics.visualWhatsappRate}% versus ${analytics.nonVisualWhatsappRate}% for journeys without a recorded visual. Treat this as a directional association, not proof that visuals caused the difference.`);
    } else if (/occasion|garment|demand|popular/.test(query)) {
      setBrainAnswer(`Top recorded occasion is ${brain.topOccasion?.label || "not enough data"} (${brain.topOccasion?.value || 0} journey(s)); top garment is ${brain.topGarment?.label || "not enough data"} (${brain.topGarment?.value || 0} journey(s)).`);
    } else {
      setBrainAnswer(`${brain.brief} Ask specifically about leads, fabrics, visuals, revenue, demand, or what needs attention for a more targeted answer.`);
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
               activeNav === "Visuals" ? <>See what customers saw.<br/><em>Connect imagery to intent.</em></> :
               activeNav === "Analytics" ? <>See the signal.<br/><em>Know where to act.</em></> :
               activeNav === "AI Brain" ? <>Think across the business.<br/><em>Turn signals into action.</em></> :
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
                  <article><small>UNVERIFIED</small><strong>{inventory.fabrics.filter((fabric) => fabric.status === "unverified").length}</strong><span>Website colours awaiting stock check</span></article>\n                  <article><small>LOW STOCK</small><strong>{inventory.fabrics.filter((fabric) => fabric.status === "low").length}</strong><span>Needs operator attention</span></article>
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
                          <span className="fabricSwatch" style={fabric.swatchImageUrl.startsWith("http") ? { backgroundImage: `url("${fabric.swatchImageUrl}")` } : { background: fabric.hex }} />
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
                  <div className="fabricHeroSwatch" style={selectedFabric.swatchImageUrl.startsWith("http") ? { backgroundImage: `url("${selectedFabric.swatchImageUrl}")` } : { background: selectedFabric.hex }}><span>{selectedFabric.sourceDocument === "llinenearth.com" ? "Website swatch" : selectedFabric.hex}</span></div>
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
                      {["unverified", "in-stock", "low", "out"].map((value) => <button key={value} className={fabricDraft.status === value ? "active" : ""} onClick={() => setFabricDraft((draft) => ({ ...draft, status: value }))}>{titleCase(value)}</button>)}
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

          {activeNav === "Visuals" && (
            <motion.section key="visuals" className="visualWorkspace" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="visualMain">
                <div className="visualMetrics">
                  <article><small>GENERATED</small><strong>{visuals.length}</strong><span>All recorded renders</span></article>
                  <article><small>PHOTOREAL</small><strong>{visuals.filter(({ event }) => String(event.payload?.mode || "") === "photo").length}</strong><span>FASHN customer-facing visuals</span></article>
                  <article><small>WHATSAPP AFTER VISUAL</small><strong>{visuals.filter(({ session }) => hasEvent(session, "whatsapp_clicked")).length}</strong><span>Visual journeys that moved forward</span></article>
                  <article className="accent"><small>SALES AFTER VISUAL</small><strong>{visuals.filter(({ session }) => hasEvent(session, "sale_logged")).length}</strong><span>Recorded conversions</span></article>
                </div>

                <article className="card visualLibrary">
                  <div className="cardHead">
                    <div><small>VISUAL LIBRARY</small><h2>Every generated look, tied to its customer journey.</h2></div>
                    <span>{visuals.length} records</span>
                  </div>
                  {visuals.length ? <div className="visualGrid">
                    {visuals.map(({ session, event }) => {
                      const imageUrl = String(event.payload?.imageUrl || "");
                      const fabric = String(event.payload?.fabric || session.selectedLook?.fabric || "Fabric not recorded");
                      const provider = String(event.payload?.provider || "LLinen Earth renderer");
                      return <button key={event.id} className="visualCard" onClick={() => setSelected(session.sessionId)}>
                        <span className="visualMedia">
                          {imageUrl.startsWith("https://") ? <img src={imageUrl} alt={String(event.payload?.label || "Generated LLinen Earth look")} /> : <i><b>LE</b><small>{String(event.payload?.mode || "preview").toUpperCase()}</small></i>}
                          <em>{String(event.payload?.mode || "preview") === "photo" ? "PHOTOREAL" : "PREVIEW"}</em>
                        </span>
                        <span className="visualCopy">
                          <small>{session.customer.name || session.answers.occasion || "Anonymous customer"}</small>
                          <b>{fabric}</b>
                          <span>{provider}</span>
                          <i>{ago(event.at)} · {hasEvent(session, "sale_logged") ? "SALE ✓" : hasEvent(session, "whatsapp_clicked") ? "WHATSAPP ↗" : intentLabel(session)}</i>
                        </span>
                      </button>;
                    })}
                  </div> : <div className="empty tall">Generated visuals will appear here as Style Director sessions are recorded and synced.</div>}
                </article>
              </div>
              <aside className="visualDetail">
                <AnimatePresence mode="wait">{customerEditor}</AnimatePresence>
                <article className="card visualPolicy">
                  <div className="cardHead"><div><small>LOCAL ARCHIVE</small><h2>PC visual memory.</h2></div><span>TRUSTED HOSTS ONLY</span></div>
                  <p>Photoreal FASHN images can be copied into the LLinen Earth hard-drive vault so important work is not dependent on a remote image URL. Other hosts are ignored.</p>
                  <button className="smallAction archiveAction" onClick={() => void archiveVisuals()} disabled={archivingVisuals}>{archivingVisuals ? "Archiving…" : "Archive visuals to PC"}</button>
                </article>
              </aside>
            </motion.section>
          )}


          {activeNav === "Analytics" && (
            <motion.section key="analytics" className="analyticsWorkspace" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="analyticsMetrics">
                <article><small>SESSION → WHATSAPP</small><strong>{analytics.whatsappRate}%</strong><span>{summary?.totals.whatsapp || 0} intent actions from {analytics.total} sessions</span></article>
                <article><small>SESSION → SALE</small><strong>{analytics.saleRate}%</strong><span>{summary?.totals.sales || 0} recorded conversions</span></article>
                <article><small>AVERAGE ORDER</small><strong>{money(analytics.averageOrder)}</strong><span>Based on recorded sale values</span></article>
                <article className="accent"><small>RECORDED REVENUE</small><strong>{money(summary?.totals.revenue || 0)}</strong><span>Operator-confirmed outcomes</span></article>
              </div>

              <div className="analyticsGrid">
                <div className="analyticsMain">
                  <article className="card decisionCard">
                    <div className="cardHead">
                      <div><small>DECISION ROOM</small><h2>What deserves attention now.</h2></div>
                      <span>{analytics.insights.length} signals</span>
                    </div>
                    <div className="insightList">
                      {analytics.insights.map((insight, index) => (
                        <div key={`${insight.title}-${index}`} className={`insight insight-${insight.level}`}>
                          <i>{insight.level === "watch" ? "!" : insight.level === "good" ? "✓" : "i"}</i>
                          <span><b>{insight.title}</b><small>{insight.text}</small></span>
                        </div>
                      ))}
                      {!analytics.insights.length && <div className="empty">More customer activity is needed before useful patterns can be shown.</div>}
                    </div>
                  </article>

                  <article className="card analyticsPanel">
                    <div className="cardHead"><div><small>DEMAND MIX</small><h2>What customers are asking for.</h2></div><span>All recorded sessions</span></div>
                    <div className="demandColumns">
                      {[
                        ["Occasion", analytics.occasions],
                        ["Garment", analytics.garments],
                        ["Colour direction", analytics.colors],
                      ].map(([title, rows]) => {
                        const typedRows = rows as Array<{label:string;value:number}>;
                        const max = Math.max(1, ...typedRows.map((row) => row.value));
                        return <div className="demandGroup" key={String(title)}>
                          <small>{String(title).toUpperCase()}</small>
                          {typedRows.slice(0, 6).map((row) => <div className="rankBar" key={row.label}>
                            <span><b>{row.label}</b><em>{row.value}</em></span>
                            <i><motion.u initial={{ width: 0 }} animate={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} transition={{ duration: .5 }} /></i>
                          </div>)}
                        </div>;
                      })}
                    </div>
                  </article>

                  <article className="card analyticsPanel">
                    <div className="cardHead"><div><small>FABRIC INTELLIGENCE</small><h2>What is attracting interest.</h2></div><span>Selection → WhatsApp → sale</span></div>
                    <div className="fabricRanking">
                      {analytics.topFabrics.map((fabric, index) => <button key={fabric.id} onClick={() => { setSelectedFabricId(fabric.id); setActiveNav("Fabrics"); }}>
                        <span className="rankNumber">{String(index + 1).padStart(2, "0")}</span>
                        <i className="rankSwatch" style={{ background: fabric.hex }} />
                        <span className="rankName"><b>{fabric.label}</b><small>{fabric.line}</small></span>
                        <span><b>{fabric.interest}</b><small>selected</small></span>
                        <span><b>{fabric.whatsapp}</b><small>WhatsApp</small></span>
                        <span><b>{fabric.sales}</b><small>sales</small></span>
                      </button>)}
                      {!analytics.topFabrics.length && <div className="empty">Fabric rankings will appear after customers select Style Director looks.</div>}
                    </div>
                  </article>
                </div>

                <aside className="analyticsSide">
                  <article className="card analyticsPanel">
                    <div className="cardHead"><div><small>VISUAL SIGNAL</small><h2>Do visual journeys move further?</h2></div></div>
                    <div className="compareRates">
                      <div><span><b>{analytics.visualWhatsappRate}%</b><small>Visual → WhatsApp</small></span><i><u style={{ width: `${analytics.visualWhatsappRate}%` }} /></i></div>
                      <div><span><b>{analytics.nonVisualWhatsappRate}%</b><small>No visual → WhatsApp</small></span><i><u style={{ width: `${analytics.nonVisualWhatsappRate}%` }} /></i></div>
                    </div>
                    <p className="analyticsNote">This compares recorded journeys. It does not claim that generating a visual caused the customer to move forward.</p>
                  </article>

                  <article className="card analyticsPanel">
                    <div className="cardHead"><div><small>REVENUE MIX</small><h2>Which garment types are converting value.</h2></div></div>
                    <div className="revenueRows">
                      {analytics.revenueByGarment.slice(0, 6).map((row) => {
                        const max = Math.max(1, ...analytics.revenueByGarment.map((item) => item.value));
                        return <div key={row.label}><span><b>{titleCase(row.label)}</b><em>{money(row.value)}</em></span><i><u style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} /></i></div>;
                      })}
                      {!analytics.revenueByGarment.length && <div className="empty">Record sale values to see revenue by garment.</div>}
                    </div>
                  </article>

                  <article className="card analyticsPanel dataQuality">
                    <div className="cardHead"><div><small>DATA QUALITY</small><h2>How much should you trust this view?</h2></div></div>
                    <div>
                      <span><b>{analytics.total}</b><small>journeys</small></span>
                      <span><b>{(summary?.sessions || []).filter((s) => s.customer.name).length}</b><small>identified</small></span>
                      <span><b>{summary?.totals.sales || 0}</b><small>sales logged</small></span>
                    </div>
                    <p>{analytics.total < 20 ? "Early signal stage — useful for observation, not strong conclusions." : analytics.total < 100 ? "Growing evidence — directional patterns are becoming useful." : "Mature evidence base — still check for staff logging gaps before making major decisions."}</p>
                  </article>
                </aside>
              </div>
            </motion.section>
          )}



          {activeNav === "AI Brain" && (
            <motion.section key="ai-brain" className="brainWorkspace" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <article className="brainBrief">
                <div className="brainOrb"><span>LE</span><i /></div>
                <div><small>LOCAL BUSINESS INTELLIGENCE</small><h2>Morning brief.</h2><p>{brain.brief}</p></div>
                <span className="brainMode">LOCAL · NO CLOUD LLM REQUIRED</span>
              </article>

              <div className="brainGrid">
                <div className="brainMain">
                  <article className="card">
                    <div className="cardHead">
                      <div><small>ACTION QUEUE</small><h2>What the system thinks deserves attention.</h2></div>
                      <span>{brain.open.length} active</span>
                    </div>
                    <div className="brainSignals">
                      {brain.signals.map((signal) => {
                        const actionState = brainActions[signal.id]?.status || "open";
                        return <article key={signal.id} className={`brainSignal brain-${signal.level} brain-state-${actionState}`}>
                          <div className="brainSignalTop">
                            <span className="brainSignalType">{signal.level.toUpperCase()}</span>
                            <span className="brainSignalState">{titleCase(actionState)}</span>
                          </div>
                          <h3>{signal.title}</h3>
                          <p><b>Evidence</b>{signal.evidence}</p>
                          <p><b>Next action</b>{signal.action}</p>
                          <div className="brainSignalActions">
                            <button onClick={() => setActiveNav(signal.module)}>Open {signal.module}</button>
                            <button className={actionState === "watching" ? "active" : ""} onClick={() => void updateBrainAction(signal.id, "watching")}>Watch</button>
                            <button className={actionState === "done" ? "active" : ""} onClick={() => void updateBrainAction(signal.id, "done")}>Done</button>
                            <button onClick={() => void updateBrainAction(signal.id, "dismissed")}>Dismiss</button>
                          </div>
                        </article>;
                      })}
                    </div>
                  </article>
                </div>

                <aside className="brainSide">
                  <article className="card brainAsk">
                    <div className="cardHead"><div><small>ASK THE BRAIN</small><h2>Ask a business question.</h2></div><span>LOCAL</span></div>
                    <p>This first Brain answers from the records on your PC. It does not invent outside market facts.</p>
                    <textarea value={brainQuery} onChange={(e) => setBrainQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askBrain(); } }} placeholder="What needs attention today?&#10;Which fabric is most popular?&#10;How are visuals performing?" />
                    <button onClick={askBrain}>Ask LLinen Brain ↗</button>
                    <div className="brainAnswer"><small>ANSWER</small><p>{brainAnswer}</p></div>
                  </article>

                  <article className="card brainEvidence">
                    <div className="cardHead"><div><small>EVIDENCE BASE</small><h2>What the Brain can see.</h2></div></div>
                    <div className="brainEvidenceGrid">
                      <span><b>{analytics.total}</b><small>customer journeys</small></span>
                      <span><b>{leads.length}</b><small>intent records</small></span>
                      <span><b>{inventory.fabrics.length}</b><small>fabric entries</small></span>
                      <span><b>{visuals.length}</b><small>visual records</small></span>
                      <span><b>{summary?.totals.sales || 0}</b><small>sales</small></span>
                      <span><b>{money(summary?.totals.revenue || 0)}</b><small>revenue</small></span>
                    </div>
                    <p>Recommendations are based on the data you record. Missing staff outcomes, anonymous sessions, or unverified stock reduce confidence.</p>
                  </article>

                  <article className="card brainPrinciple">
                    <small>DESIGN PRINCIPLE</small>
                    <blockquote>Evidence first. Recommendation second. Never pretend weak data is certainty.</blockquote>
                  </article>
                </aside>
              </div>
            </motion.section>
          )}


          {!["Today", "Customers", "Leads", "Orders", "Fabrics", "Visuals", "Analytics", "AI Brain"].includes(activeNav) && (
            <motion.section key={activeNav} className="placeholder" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span>NEXT MODULE</span><h2>{activeNav}</h2><p>The desktop foundation, Customers and Leads are now functional. This module is intentionally waiting for its real data workflow rather than showing fake controls.</p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
