"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  readBridgeConfig,
  readBrowserStyleEvents,
  recordStyleMemoryEvent,
  saveBridgeConfig,
  type StyleMemoryEvent,
} from "@/lib/browser-style-memory";
import "./operator.css";

type Session = {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  events: StyleMemoryEvent[];
  answers: Record<string,string>;
  selectedLook?: Record<string,unknown> | null;
  sale?: Record<string,unknown> | null;
  customer?: {name:string;phone:string;note:string};
  leadStatus?: string;
  order?: {status:string;dueDate:string;note:string;orderValue:number} | null;
  measurements?: {unit:string;values:Record<string,number>;note:string;at:string} | null;
  payments?: Array<{amount:number;method:string;note:string;at:string}>;
  appointment?: {kind:string;dateTime:string;status:string;note:string;at:string} | null;
};

type BridgeSummary = {
  ok: boolean;
  dataDirectory?: string;
  totals?: { sessions:number; renders:number; whatsapp:number; sales:number };
  counts?: Record<string,number>;
  sessions?: Session[];
  lastEventAt?: string | null;
};

type CloudSummary = {
  configured: boolean;
  truncated?: boolean;
  totals?: { sessions:number; renders:number; whatsapp:number; sales:number };
  counts?: Record<string,number>;
  sessions?: Session[];
  lastEventAt?: string | null;
};

function aggregate(events:StyleMemoryEvent[]) {
  const map = new Map<string,Session>();
  const counts:Record<string,number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
    const current = map.get(event.sessionId) || {
      sessionId:event.sessionId, firstAt:event.at, lastAt:event.at, events:[], answers:{}, selectedLook:null, sale:null,
      customer:{name:"",phone:"",note:""}, leadStatus:"", order:null, measurements:null, payments:[], appointment:null,
    };
    current.lastAt = event.at;
    current.events.push(event);
    if (event.type === "answer_selected" && event.payload?.step) current.answers[String(event.payload.step)] = String(event.payload.value ?? "");
    if (event.type === "look_selected") current.selectedLook = event.payload || null;
    if (event.type === "sale_logged") current.sale = event.payload || null;
    if (event.type === "customer_updated") current.customer = {
      name:String(event.payload?.name || current.customer?.name || ""),
      phone:String(event.payload?.phone || current.customer?.phone || ""),
      note:String(event.payload?.note || current.customer?.note || ""),
    };
    if (event.type === "lead_status_changed") current.leadStatus = String(event.payload?.status || "");
    if (event.type === "order_status_changed") current.order = {
      status:String(event.payload?.status || ""),
      dueDate:String(event.payload?.dueDate || ""),
      note:String(event.payload?.note || ""),
      orderValue:Number(event.payload?.orderValue || 0) || 0,
    };
    if (event.type === "payment_logged") {
      const amount = Number(event.payload?.amount || 0);
      current.payments = [...(current.payments || []),{
        amount:Number.isFinite(amount) ? amount : 0,
        method:String(event.payload?.method || "other"),
        note:String(event.payload?.note || ""),
        at:event.at,
      }];
    }
    if (event.type === "appointment_updated") {
      current.appointment = {
        kind:String(event.payload?.kind || "fitting"),
        dateTime:String(event.payload?.dateTime || ""),
        status:String(event.payload?.status || "scheduled"),
        note:String(event.payload?.note || ""),
        at:event.at,
      };
    }
    if (event.type === "measurements_updated") {
      const raw = event.payload?.measurements;
      const values:Record<string,number> = {};
      if (raw && typeof raw === "object") {
        for (const [key,value] of Object.entries(raw as Record<string,unknown>)) {
          const number = Number(value);
          if (Number.isFinite(number)) values[key] = number;
        }
      }
      current.measurements = {
        unit:String(event.payload?.unit || "in"),
        values,
        note:String(event.payload?.note || ""),
        at:event.at,
      };
    }
    map.set(event.sessionId,current);
  }
  const sessions = [...map.values()].sort((a,b)=>new Date(b.lastAt).getTime()-new Date(a.lastAt).getTime());
  return {
    sessions,
    counts,
    totals:{
      sessions:sessions.length,
      renders:counts.render_completed || 0,
      whatsapp:counts.whatsapp_clicked || 0,
      sales:counts.sale_logged || 0,
    },
  };
}

function label(value?:string) {
  return value || "Not chosen";
}

function inr(value:number) {
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value || 0);
}

function relativeTime(iso:string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff/60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes/60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours/24)}d ago`;
}

type DesignerPairingOutput = {
  pairingId:string;
  shirtId:string;
  shirtName:string;
  shirtLine:string;
  shirtPattern:string;
  trouserId:string;
  trouserName:string;
  trouserLine:string;
  trouserPattern:string;
  confidenceScore:number;
  occasionBand:string;
  relationship:string;
  forced:boolean;
  needsHumanFallback:boolean;
  humanApprovedFallback?:boolean;
  customerReason:string;
};

function phase1Recommendation(session:Session|null) {
  if (!session) return null;
  const event = [...session.events].reverse().find((item)=>
    item.type === "looks_generated" && item.payload?.experience === "designer-phase1-shirt-pant"
  );
  if (!event?.payload) return null;
  const output = event.payload.output;
  if (!output || typeof output !== "object") return null;
  return {
    event,
    rulesVersion:String(event.payload.rulesVersion || ""),
    input:(event.payload.input && typeof event.payload.input === "object" ? event.payload.input : {}) as Record<string,unknown>,
    output:output as DesignerPairingOutput,
    rules:Array.isArray(event.payload.rules) ? event.payload.rules as Array<Record<string,unknown>> : [],
  };
}

function latestDesignerReview(session:Session|null, pairingId:string) {
  if (!session || !pairingId) return null;
  return [...session.events].reverse().find((item)=>
    item.type === "operator_note" &&
    item.payload?.subtype === "designer_pairing_review" &&
    item.payload?.pairingId === pairingId
  ) || null;
}

export default function OperatorClient() {
  const [browserEvents,setBrowserEvents] = useState<StyleMemoryEvent[]>([]);
  const [bridgeUrl,setBridgeUrl] = useState("http://127.0.0.1:4317");
  const [bridgeToken,setBridgeToken] = useState("");
  const [bridge,setBridge] = useState<BridgeSummary|null>(null);
  const [bridgeState,setBridgeState] = useState<"unknown"|"offline"|"paired">("unknown");
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [saleAmount,setSaleAmount] = useState("");
  const [message,setMessage] = useState("");
  const [loggingOut,setLoggingOut] = useState(false);
  const [cloud,setCloud] = useState<CloudSummary|null>(null);
  const [cloudState,setCloudState] = useState<"loading"|"live"|"unconfigured"|"error">("loading");
  const [designerReviewReason,setDesignerReviewReason] = useState("");
  const [designerReviewSaving,setDesignerReviewSaving] = useState(false);

  useEffect(()=>{
    setBrowserEvents(readBrowserStyleEvents());
    const saved = readBridgeConfig();
    if (saved) { setBridgeUrl(saved.url); setBridgeToken(saved.token); }
    void loadCloud();
  },[]);

  async function loadCloud() {
    setCloudState("loading");
    try {
      const response = await fetch("/api/operator/cloud-summary?days=60",{cache:"no-store"});
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = "/operator/login";
        return;
      }
      if (!response.ok) throw new Error(data.error || "Cloud memory could not be read.");
      setCloud(data);
      setCloudState(data.configured ? "live" : "unconfigured");
    } catch (error) {
      setCloudState("error");
      setMessage(error instanceof Error ? error.message : "Cloud memory could not be read.");
    }
  }

  async function connectBridge() {
    setMessage("");
    try {
      const health = await fetch(`${bridgeUrl.replace(/\/$/,"")}/health`);
      if (!health.ok) throw new Error("Local bridge did not answer.");
      const response = await fetch(`${bridgeUrl.replace(/\/$/,"")}/summary?days=60`,{
        headers:{authorization:`Bearer ${bridgeToken}`},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pairing token was not accepted.");
      saveBridgeConfig({url:bridgeUrl,token:bridgeToken});
      setBridge(data);
      setBridgeState("paired");
      setMessage("Local hard-drive vault connected.");
    } catch(e) {
      setBridgeState("offline");
      setMessage(e instanceof Error ? e.message : "Could not connect to local vault.");
    }
  }

  async function createBackup() {
    try {
      const response = await fetch(`${bridgeUrl.replace(/\/$/,"")}/backup`,{
        method:"POST",headers:{authorization:`Bearer ${bridgeToken}`},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backup failed.");
      setMessage(`Backup created: ${data.file}`);
    } catch(e) { setMessage(e instanceof Error ? e.message : "Backup failed."); }
  }

  function refreshBrowser() {
    setBrowserEvents(readBrowserStyleEvents());
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/operator/logout",{method:"POST"});
    } finally {
      window.location.href = "/operator/login";
    }
  }

  const local = useMemo(()=>aggregate(browserEvents),[browserEvents]);
  const usingBridge = bridgeState === "paired" && Boolean(bridge?.sessions);
  const usingCloud = !usingBridge && cloudState === "live" && Boolean(cloud?.sessions);
  const sessions = usingBridge ? (bridge?.sessions || []) : usingCloud ? (cloud?.sessions || []) : local.sessions;
  const totals = usingBridge ? (bridge?.totals || local.totals) : usingCloud ? (cloud?.totals || local.totals) : local.totals;
  const counts = usingBridge ? (bridge?.counts || local.counts) : usingCloud ? (cloud?.counts || local.counts) : local.counts;
  const recordSource = usingBridge ? "LOCAL PC VAULT" : usingCloud ? "CLOUD MEMORY" : "THIS BROWSER";
  const selected = sessions.find((s)=>s.sessionId===selectedId)
    || (cloud?.sessions || []).find((s)=>s.sessionId===selectedId)
    || sessions[0]
    || cloud?.sessions?.[0]
    || null;
  const cloudSelected = selected ? (cloud?.sessions || []).find((session)=>session.sessionId===selected.sessionId) || null : null;
  const designerReviewSession = cloudSelected || selected;
  const designerRecommendation = phase1Recommendation(designerReviewSession);
  const designerOutput = designerRecommendation?.output || null;
  const latestReview = latestDesignerReview(designerReviewSession,designerOutput?.pairingId || "");

  useEffect(()=>{
    if (!selectedId && sessions[0]) setSelectedId(sessions[0].sessionId);
  },[selectedId,sessions]);

  const attention = sessions.filter((session)=>{
    const whatsapp = session.events.some((event)=>event.type==="whatsapp_clicked");
    const sale = session.events.some((event)=>event.type==="sale_logged");
    return whatsapp && !sale;
  }).slice(0,5);

  const designerReviewSessions = (cloud?.sessions?.length ? cloud.sessions : sessions);
  const designerReviewQueue = designerReviewSessions.map((session)=>{
    const recommendation = phase1Recommendation(session);
    const output = recommendation?.output || null;
    const review = latestDesignerReview(session,output?.pairingId || "");
    return {session,recommendation,output,review};
  }).filter((item)=>item.output && (!item.review || item.output.needsHumanFallback))
    .sort((a,b)=>{
      const aNeeds = a.output?.needsHumanFallback ? 0 : 1;
      const bNeeds = b.output?.needsHumanFallback ? 0 : 1;
      if (aNeeds !== bNeeds) return aNeeds-bNeeds;
      return Number(a.output?.confidenceScore || 0)-Number(b.output?.confidenceScore || 0);
    })
    .slice(0,8);

  async function logOutcome(type:"visit_logged"|"sale_logged") {
    if (!selected) return;
    const payload = type === "sale_logged" ? {amount:saleAmount ? Number(saleAmount) : undefined,currency:"INR"} : {status:"visited"};
    const event = recordStyleMemoryEvent(selected.sessionId,type,payload,"operator");
    setSaleAmount("");
    refreshBrowser();

    if (cloudState === "live") {
      try {
        await fetch("/api/memory/event",{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify(event),
        });
        await loadCloud();
      } catch {
        // Browser/local memory remains the fallback if cloud refresh fails.
      }
    }

    setMessage(type === "sale_logged" ? "Sale outcome saved." : "Store visit saved.");
  }

  async function logDesignerReview(decision:"approve"|"wrong"|"safe_fallback") {
    if (!selected || !designerRecommendation || !designerOutput) return;
    const reason = designerReviewReason.trim();
    if (decision === "wrong" && reason.length < 3) {
      setMessage("Add a short reason before flagging this pairing as wrong.");
      return;
    }

    setDesignerReviewSaving(true);
    const event = recordStyleMemoryEvent(selected.sessionId,"operator_note",{
      subtype:"designer_pairing_review",
      decision,
      pairingId:designerOutput.pairingId,
      shirtId:designerOutput.shirtId,
      trouserId:designerOutput.trouserId,
      shirtName:designerOutput.shirtName,
      trouserName:designerOutput.trouserName,
      occasionBand:designerOutput.occasionBand,
      rulesVersion:designerRecommendation.rulesVersion,
      confidenceScore:designerOutput.confidenceScore,
      reason,
      note:decision === "safe_fallback"
        ? "Approved as an LLinen Earth safe fallback for this formality band."
        : decision === "wrong"
          ? "Operator rejected the designer pairing."
          : "Operator approved the designer pairing.",
    },"operator");
    refreshBrowser();

    try {
      if (cloudState === "live") {
        const response = await fetch("/api/memory/event",{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify(event),
        });
        if (!response.ok && response.status !== 202) throw new Error("Cloud review write failed.");
        await loadCloud();
      }
      setDesignerReviewReason("");
      setMessage(
        decision === "safe_fallback"
          ? "Pairing approved as a safe fallback."
          : decision === "wrong"
            ? "Pairing flagged as wrong with your reason."
            : "Pairing approved for review history."
      );
    } catch {
      setMessage("Review saved locally; cloud memory will receive it when available.");
    } finally {
      setDesignerReviewSaving(false);
    }
  }

  const funnel = [
    {label:"Started",value:counts.session_started || 0},
    {label:"Looks built",value:counts.looks_generated || 0},
    {label:"Visual made",value:counts.render_completed || 0},
    {label:"WhatsApp",value:counts.whatsapp_clicked || 0},
    {label:"Sale",value:counts.sale_logged || 0},
  ];
  const funnelMax = Math.max(1,...funnel.map((item)=>item.value));

  return <AppShell>
    <main className="operator">
      <header className="operatorHero">
        <div>
          <p>LLINEN EARTH / OPERATOR DESK</p>
          <h1>Know what happened.<br/><em>Know what to do next.</em></h1>
          <span>One screen for customer intent, visual activity, follow-up and local hard-drive memory.</span>
        </div>
        <div className="operatorStatus">
          <span className={bridgeState==="paired"?"live":""}><i/>{bridgeState==="paired"?"LOCAL VAULT PAIRED":"LOCAL VAULT NOT PAIRED"}</span>
          <span className={cloudState==="live"?"live":""}><i className={cloudState==="live"?"":"amber"}/>{cloudState==="live"?"CLOUD MEMORY LIVE":cloudState==="unconfigured"?"CLOUD NOT CONFIGURED":cloudState==="error"?"CLOUD ERROR":"CHECKING CLOUD"}</span>
          <button className="operatorLogout" onClick={logout} disabled={loggingOut}>{loggingOut?"SIGNING OUT…":"SIGN OUT"}</button>
        </div>
      </header>

      <section className="pulseGrid" aria-label="Business pulse">
        <article><small>STYLE SESSIONS</small><strong>{totals.sessions}</strong><p>People whose style journey was recorded.</p></article>
        <article><small>VISUALS CREATED</small><strong>{totals.renders}</strong><p>Signals stronger intent than browsing alone.</p></article>
        <article><small>WHATSAPP INTENT</small><strong>{totals.whatsapp}</strong><p>Customers who moved toward a conversation.</p></article>
        <article className="accent"><small>SALES LOGGED</small><strong>{totals.sales}</strong><p>The feedback that teaches the system what converts.</p></article>
      </section>

      <section className="operatorGrid">
        <div className="operatorMain">
          <article className="panel funnelPanel">
            <div className="panelHead"><div><small>JOURNEY</small><h2>Where interest is becoming business.</h2></div><b>{totals.sessions ? Math.round((totals.whatsapp/totals.sessions)*100) : 0}% <span>session → WhatsApp</span></b></div>
            <div className="funnel">
              {funnel.map((item)=><div key={item.label}><span>{item.label}<b>{item.value}</b></span><i><em style={{width:`${Math.max(4,(item.value/funnelMax)*100)}%`}}/></i></div>)}
            </div>
            <p className="readThis"><b>Read this:</b> the biggest drop between two stages is where the operator should investigate first.</p>
          </article>

          <article className="panel">
            <div className="panelHead"><div><small>ATTENTION QUEUE</small><h2>People worth following up.</h2></div><span>{attention.length} open</span></div>
            {attention.length ? <div className="attentionList">
              {attention.map((session)=><button key={session.sessionId} onClick={()=>setSelectedId(session.sessionId)}>
                <i>!</i><div><strong>{session.customer?.name || label(session.answers.occasion)} · {label(session.answers.mood)}</strong><small>{session.selectedLook?.fabric ? String(session.selectedLook.fabric) : "Look selected"} · {session.leadStatus ? session.leadStatus.replaceAll("-"," ") + " · " : ""}WhatsApp clicked · no sale logged</small></div><span>{relativeTime(session.lastAt)} ↗</span>
              </button>)}
            </div> : <div className="empty"><b>No follow-up signals yet.</b><span>When a customer clicks WhatsApp but no sale is recorded, they appear here.</span></div>}
          </article>

          <article className="panel designerQueuePanel">
            <div className="panelHead"><div><small>DESIGNER REVIEW QUEUE</small><h2>Pairings that need your eye.</h2></div><span>{designerReviewQueue.length} open</span></div>
            {designerReviewQueue.length ? <div className="designerQueueList">
              {designerReviewQueue.map(({session,output})=><button key={`${session.sessionId}:${output?.pairingId}`} onClick={()=>setSelectedId(session.sessionId)}>
                <i>{output?.needsHumanFallback ? "!" : "?"}</i>
                <div>
                  <strong>{output?.shirtName || output?.shirtId} + {output?.trouserName || output?.trouserId}</strong>
                  <small>{output?.occasionBand} · {output?.relationship} · {output?.confidenceScore}/100</small>
                </div>
                <span>{output?.needsHumanFallback ? "Needs fallback" : "Unreviewed"} ↗</span>
              </button>)}
            </div> : <div className="empty"><b>No designer reviews waiting.</b><span>Low-confidence or unreviewed Phase-1 pairings will appear here automatically.</span></div>}
          </article>

          <article className="panel">
            <div className="panelHead"><div><small>RECENT SESSIONS · {recordSource}</small><h2>Every customer story, compressed.</h2></div><button className="textButton" onClick={()=>{refreshBrowser();void loadCloud();}}>Refresh records</button></div>
            {sessions.length ? <div className="sessionTable">
              <div className="tableRow tableHeader"><span>Customer intent</span><span>Hero</span><span>Colour</span><span>Last signal</span></div>
              {sessions.slice(0,12).map((session)=><button className={selected?.sessionId===session.sessionId?"tableRow active":"tableRow"} key={session.sessionId} onClick={()=>setSelectedId(session.sessionId)}>
                <span><b>{session.customer?.name || label(session.answers.occasion)}</b><small>{session.customer?.phone || `${label(session.answers.mood)} · ${label(session.answers.time)}`}</small></span>
                <span>{label(session.answers.garment)}</span><span>{session.order?.status ? session.order.status.replaceAll("-"," ") : label(session.answers.colorDirection)}</span><span>{relativeTime(session.lastAt)} ↗</span>
              </button>)}
            </div> : <div className="empty large"><b>No customer memory yet.</b><span>Use Style Director on this device; its journey will appear here automatically.</span></div>}
          </article>
        </div>

        <aside className="operatorSide">
          <article className="panel detailPanel">
            <div className="panelHead"><div><small>CUSTOMER STORY</small><h2>{selected ? (selected.customer?.name || label(selected.answers.occasion)) : "Select a session"}</h2></div>{selected&&<span>{relativeTime(selected.lastAt)}</span>}</div>
            {selected ? <>
              <div className="storyChips">
                {selected.customer?.phone && <span><small>phone</small><b>{selected.customer.phone}</b></span>}
                {selected.leadStatus && <span><small>lead status</small><b>{selected.leadStatus.replaceAll("-"," ")}</b></span>}
                {selected.order?.status && <span><small>order</small><b>{selected.order.status.replaceAll("-"," ")}{selected.order.dueDate ? ` · ${selected.order.dueDate}` : ""}</b></span>}
                {selected.appointment && <span><small>appointment</small><b>{selected.appointment.kind.replaceAll("-"," ")} · {selected.appointment.status}{selected.appointment.dateTime ? ` · ${selected.appointment.dateTime.replace("T"," ")}` : ""}</b></span>}
                {selected.order?.orderValue ? <span><small>order value</small><b>{inr(selected.order.orderValue)}</b></span> : null}
                {(selected.payments?.length || 0) > 0 && <span><small>paid</small><b>{inr((selected.payments || []).reduce((sum,payment)=>sum+payment.amount,0))}</b></span>}
                {selected.order?.orderValue ? <span><small>balance</small><b>{inr(Math.max(0,selected.order.orderValue-(selected.payments || []).reduce((sum,payment)=>sum+payment.amount,0)))}</b></span> : null}
                {Object.entries(selected.answers).map(([key,value])=><span key={key}><small>{key}</small><b>{value}</b></span>)}
              </div>
              {selected.selectedLook && <div className="selectedLook"><small>SELECTED LOOK</small><strong>{String(selected.selectedLook.title || "Look selected")}</strong><span>{String(selected.selectedLook.fabric || "")}</span></div>}
              {designerRecommendation && designerOutput && <div className="designerReviewPanel">
                <div className="designerReviewHead">
                  <div><small>DESIGNER PHASE 1 REVIEW</small><strong>{designerOutput.shirtName || designerOutput.shirtId} + {designerOutput.trouserName || designerOutput.trouserId}</strong></div>
                  <b>{designerOutput.confidenceScore}<span>/100</span></b>
                </div>
                <div className="designerReviewFacts">
                  <span><small>shirt</small><b>{designerOutput.shirtLine || designerOutput.shirtId}</b><em>{designerOutput.shirtPattern}</em></span>
                  <span><small>trouser</small><b>{designerOutput.trouserLine || designerOutput.trouserId}</b><em>{designerOutput.trouserPattern}</em></span>
                  <span><small>band</small><b>{designerOutput.occasionBand}</b><em>{designerOutput.relationship}</em></span>
                </div>
                <p>{designerOutput.customerReason}</p>
                <div className="designerRuleStrip">
                  {designerRecommendation.rules.map((rule,index)=><span key={String(rule.id || index)} className={String(rule.status || "unknown")}><b>{String(rule.id || "CR")}</b>{String(rule.status || "unknown")}</span>)}
                </div>
                {latestReview && <div className="designerLatestReview"><b>LATEST REVIEW · {String(latestReview.payload?.decision || "").replaceAll("_"," ")}</b><span>{String(latestReview.payload?.reason || latestReview.payload?.note || "")}</span></div>}
                <label>Why approve or reject this pairing?
                  <textarea value={designerReviewReason} onChange={(e)=>setDesignerReviewReason(e.target.value)} placeholder="Example: trouser is too cool/flat for this shirt, or this is a dependable formal fallback." />
                </label>
                <div className="designerReviewActions">
                  <button onClick={()=>void logDesignerReview("approve")} disabled={designerReviewSaving}>Approve pairing</button>
                  <button className="wrong" onClick={()=>void logDesignerReview("wrong")} disabled={designerReviewSaving}>Flag wrong</button>
                  <button className="fallback" onClick={()=>void logDesignerReview("safe_fallback")} disabled={designerReviewSaving}>Set safe fallback</button>
                </div>
                <small className="designerReviewFoot">Safe fallback approvals only apply to {designerRecommendation.rulesVersion} and this formality band. A newer review supersedes an older one.</small>
              </div>}
              {selected.measurements && <div className="webMeasurementPassport">
                <div><small>MEASUREMENT PASSPORT</small><b>{selected.measurements.unit === "cm" ? "CENTIMETRES" : "INCHES"} · {relativeTime(selected.measurements.at)}</b></div>
                <div className="webMeasurementGrid">
                  {Object.entries(selected.measurements.values).map(([key,value])=><span key={key}><small>{key.replace(/([A-Z])/g," $1")}</small><b>{value} {selected.measurements?.unit}</b></span>)}
                </div>
                {selected.measurements.note && <p><b>FIT NOTE</b>{selected.measurements.note}</p>}
              </div>}
              <div className="timeline">
                {selected.events.slice(-8).reverse().map((event)=><p key={event.id}><i/><span><b>{event.type.replaceAll("_"," ")}</b><small>{relativeTime(event.at)}</small></span></p>)}
              </div>
              <div className="outcomeBox">
                <small>REAL-WORLD OUTCOME</small>
                <button onClick={()=>void logOutcome("visit_logged")}>Mark store visit</button>
                <div><span>₹</span><input value={saleAmount} onChange={(e)=>setSaleAmount(e.target.value)} inputMode="numeric" placeholder="Sale amount" /><button onClick={()=>void logOutcome("sale_logged")}>Save sale</button></div>
              </div>
            </> : <div className="empty"><span>Choose a customer session to see the full story.</span></div>}
          </article>

          <article className="panel vaultPanel">
            <div className="panelHead"><div><small>HARD-DRIVE MEMORY</small><h2>Local vault.</h2></div><span className={bridgeState==="paired"?"paired":""}>{bridgeState}</span></div>
            <p>The bridge writes approved business records to your laptop, not your whole computer.</p>
            <label>Bridge address<input value={bridgeUrl} onChange={(e)=>setBridgeUrl(e.target.value)} /></label>
            <label>Pairing token<input value={bridgeToken} onChange={(e)=>setBridgeToken(e.target.value)} type="password" placeholder="Paste token from bridge terminal" /></label>
            <div className="vaultActions"><button onClick={connectBridge}>Pair / refresh</button><button onClick={createBackup} disabled={bridgeState!=="paired"}>Create backup</button></div>
            {bridge?.dataDirectory && <code>{bridge.dataDirectory}</code>}
            <div className="vaultFacts"><span><b>Local browser capture</b> Active on this device</span><span><b>Hard-drive mirror</b> {bridgeState==="paired"?"Connected":"Waiting"}</span><span><b>Cloud memory</b> {cloudState==="live"?`Live · ${cloud?.totals?.sessions || 0} sessions`:cloudState==="unconfigured"?"Waiting for database credentials":cloudState==="error"?"Connection error":"Checking"}</span></div>
          </article>
        </aside>
      </section>

      {message && <div className="operatorToast">{message}<button onClick={()=>setMessage("")}>×</button></div>}
    </main>
  </AppShell>;
}
