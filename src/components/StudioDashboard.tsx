"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AtelierMannequin } from "@/components/AtelierMannequin";

type Mode = "studio" | "operator" | "catalog";
type Tier = "safe" | "elevated" | "statement";

const fabrics = [
  { sku: "LNL-2024-09", name: "Sky Blue Herringbone", color: "#AFC9D4", gsm: 160, weave: "Herringbone", family: "Blue", undertone: "Cool", role: "Shirt" },
  { sku: "LNL-2024-88", name: "Sand Beige Plain", color: "#D5C3A4", gsm: 240, weave: "Plain Weave", family: "Neutral", undertone: "Warm", role: "Trouser" },
  { sku: "LNL-2024-31", name: "Oatmeal Slub", color: "#C9B99F", gsm: 260, weave: "Slub", family: "Neutral", undertone: "Warm", role: "Trouser" },
  { sku: "LNL-2024-17", name: "Slate Linen", color: "#7C8589", gsm: 180, weave: "Plain Weave", family: "Grey", undertone: "Cool", role: "Shirt" },
  { sku: "LNL-2024-44", name: "Olive Twill", color: "#707762", gsm: 230, weave: "Twill", family: "Green", undertone: "Warm", role: "Trouser" },
  { sku: "LNL-2024-52", name: "Ink Navy", color: "#27344C", gsm: 250, weave: "Plain Weave", family: "Navy", undertone: "Cool", role: "Trouser" },
];

const recommendations: Record<Tier, { title: string; score: number; accent: string; subtitle: string; items: string[]; rationale: string }> = {
  safe: { title: "Safe", score: 96, accent: "#4A5568", subtitle: "Classic neutral balance", items: ["Sky Blue Herringbone Shirt", "Sand Beige Plain Trouser"], rationale: "A low-contrast pairing with compatible natural warmth. The 160 GSM shirt keeps the silhouette light while the 240 GSM trouser adds quiet structure." },
  elevated: { title: "Elevated", score: 94, accent: "#6B7A63", subtitle: "Complementary tone + texture", items: ["Sky Blue Herringbone Shirt", "Oatmeal Slub Trouser"], rationale: "The 160 GSM herringbone shirt balances the heavier 260 GSM oatmeal trouser, creating structural balance for daytime outdoor events." },
  statement: { title: "Statement", score: 88, accent: "#C86D51", subtitle: "High-contrast editorial pairing", items: ["Sky Blue Herringbone Shirt", "Olive Twill Trouser"], rationale: "Cool blue against a warm olive creates deliberate contrast while the twill texture adds depth without overwhelming the base fabric." }
};

function Icon({ name }: { name: "search" | "sun" | "moon" | "chevron" | "check" | "bolt" | "download" | "more" }) {
  const paths: Record<string, string> = {
    search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
    sun: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z",
    chevron: "m9 18 6-6-6-6",
    check: "m5 12 4 4L19 6",
    bolt: "m13 2-9 12h7l-1 8 9-12h-7l1-8Z",
    download: "M12 3v12m0 0 5-5m-5 5-5-5M4 21h16",
    more: "M6 12h.01M12 12h.01M18 12h.01"
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function FabricSwatch({ fabric, selected, onClick }: { fabric: typeof fabrics[number]; selected: boolean; onClick: () => void }) {
  return <button className={"fabric-swatch" + (selected ? " selected" : "")} onClick={onClick}><span className="swatch-texture" style={{ backgroundColor: fabric.color }} /><span className="swatch-copy"><strong>{fabric.name}</strong><small>{fabric.gsm} GSM · {fabric.weave}</small></span></button>;
}

function TierCard({ tier, active, onSelect }: { tier: Tier; active: boolean; onSelect: () => void }) {
  const item = recommendations[tier];
  return <article className={"tier-card tier-" + tier + (active ? " active" : "")} onClick={onSelect}>
    <div className="tier-top"><span className="tier-dot" style={{ background: item.accent }} /><span className="tier-label" style={{ color: item.accent }}>{item.title}</span><strong>{item.score}% <small>match</small></strong></div>
    <p className="tier-subtitle">{item.subtitle}</p>
    <div className="mini-outfit">{item.items.map((name, i) => <div className="mini-piece" key={name}><span className="mini-swatch" style={{ background: i === 0 ? "#AFC9D4" : tier === "statement" ? "#707762" : "#D5C3A4" }} /><div><small>{i === 0 ? "SHIRT" : "TROUSER"}</small><span>{name.replace(" Shirt", "").replace(" Trouser", "")}</span></div></div>)}</div>
    <button className="text-action" onClick={(e) => { e.stopPropagation(); onSelect(); }}>Inspect match <Icon name="chevron" /></button>
  </article>;
}

export function StudioDashboard() {
  const [mode, setMode] = useState<Mode>("studio");
  const [selectedFabric, setSelectedFabric] = useState(fabrics[0]);
  const [selectedTier, setSelectedTier] = useState<Tier>("elevated");
  const [occasion, setOccasion] = useState("Business");
  const [formality, setFormality] = useState(3);
  const [time, setTime] = useState("Day");
  const [setting, setSetting] = useState("Outdoor");
  const [fit, setFit] = useState("Tailored");
  const [search, setSearch] = useState("");
  const visibleFabrics = useMemo(() => fabrics.filter(f => (f.name + f.sku + f.family).toLowerCase().includes(search.toLowerCase())), [search]);
  const selected = recommendations[selectedTier];

  return <div className="linen-app">
    <header className="studio-header">
      <div className="brand-lockup"><div className="brand-mark">L</div><div><strong>LLinen Earth</strong><span>DESIGNER STUDIO</span></div></div>
      <nav className="mode-nav"><button className={mode === "studio" ? "active" : ""} onClick={() => setMode("studio")}>Designer Studio</button><Link href="/style-director">Style Director</Link><button className={mode === "operator" ? "active" : ""} onClick={() => setMode("operator")}>Operator Lab</button><button className={mode === "catalog" ? "active" : ""} onClick={() => setMode("catalog")}>Fabric Catalogue</button></nav>
      <div className="admin-profile"><span className="profile-avatar">A</span><div><strong>Atelier Admin</strong><small>Operator</small></div><Icon name="chevron" /></div>
    </header>

    <div className="studio-layout">
      <aside className="studio-sidebar">
        <div className="sidebar-heading"><span>WORKSPACE</span><button><Icon name="more" /></button></div>
        <div className="step-list">{[["01","Base Fabric Selection","Anchor the outfit"],["02","Style & Context","Define the occasion"],["03","Filters & Constraints","Tune the match"]].map(([n,title,sub],i) => <button key={n} className={"step-item" + (mode === "studio" && i === 0 ? " active" : "")}><span className="step-num">{n}</span><span><strong>{title}</strong><small>{sub}</small></span><Icon name="chevron" /></button>)}</div>
        <div className="side-divider" />
        <div className="side-section"><div className="section-kicker">BASE FABRIC</div><div className="selected-fabric-card"><span className="large-swatch" style={{ background: selectedFabric.color }} /><div><strong>{selectedFabric.name}</strong><span>{selectedFabric.sku}</span><small>{selectedFabric.gsm} GSM · {selectedFabric.weave}</small></div><span className="status-dot" /></div></div>
        <div className="side-section compact"><div className="section-kicker">INVENTORY SEARCH</div><label className="search-field"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fabric or SKU" /></label><div className="sidebar-swatches">{visibleFabrics.slice(0,4).map(f => <FabricSwatch key={f.sku} fabric={f} selected={f.sku === selectedFabric.sku} onClick={() => setSelectedFabric(f)} />)}</div></div>
        <div className="sidebar-footer"><span className="inventory-pill"><i /> 48 fabrics in stock</span><button className="ghost-icon"><Icon name="download" /></button></div>
      </aside>

      <main className="studio-main">
        {mode === "studio" ? <>
          <div className="workspace-title"><div><span className="eyebrow">RECOMMENDATION ENGINE · 01 / 03</span><h1>Build the look around <em>{selectedFabric.name}</em></h1><p>Shape a considered outfit from fabric first, then let the rule engine balance tone, weight, season and occasion.</p></div><div className="live-badge"><i /> Engine live <span>v4.2</span></div></div>
          <section className="visual-hub"><div className="hub-heading"><div><span className="section-kicker">VISUALIZER HUB</span><h2>Fabric pairing preview</h2></div><span className="hub-note">2D preview · 3D engine coming soon</span></div><div className="preview-grid">
            <div className="fabric-pair-preview"><div className="pair-label">BASE FABRIC</div><div className="pair-large-swatch" style={{ background: selectedFabric.color }}><span>{selectedFabric.name}</span></div><div className="pair-label second">RECOMMENDED PAIR</div><div className="pair-large-swatch pair-trouser" style={{ background: selectedTier === "statement" ? "#707762" : "#D5C3A4" }}><span>{selectedTier === "statement" ? "Olive Twill" : "Sand Beige Plain"}</span></div></div>
            <div className="studio-model-preview">
              <div className="model-preview-badge"><span>LIVE MODEL</span><strong>Tucked office silhouette</strong></div>
              <AtelierMannequin
                compact
                shirtColor={selectedFabric.role === "Shirt" ? selectedFabric.color : "#AFC9D4"}
                trouserColor={selectedFabric.role === "Trouser" ? selectedFabric.color : selectedTier === "statement" ? "#707762" : selectedTier === "safe" ? "#D5C3A4" : "#C9B99F"}
                shirtStyle="classic"
                trouserStyle="straight"
                layerStyle="none"
                view="front"
              />
              <div className="model-preview-note">Real garment preview · clean tucked waist · same mannequin identity</div>
            </div>
          </div></section>
          <div className="recommendations-head"><div><span className="section-kicker">CURATED OUTPUT</span><h2>Three ways to wear it</h2></div><span>Scored against your context</span></div>
          <section className="tier-grid">{(Object.keys(recommendations) as Tier[]).map(tier => <TierCard key={tier} tier={tier} active={selectedTier === tier} onSelect={() => setSelectedTier(tier)} />)}</section>
          <button className="generate-button"><Icon name="bolt" /> Generate Recommendations <span>⌘ ↵</span></button>
        </> : <OperatorView mode={mode} />}
      </main>

      <aside className="studio-detail">
        <div className="detail-top"><span className="section-kicker">SELECTED OUTFIT SPECS</span><span className="detail-code">LL·{selectedTier === "safe" ? "096" : selectedTier === "elevated" ? "094" : "088"}</span></div>
        <div className="selected-title"><span className="tier-mini" style={{ background: selected.accent }}>{selected.title}</span><h2>{selected.score}% <small>match confidence</small></h2></div>
        <div className="confidence-gauge"><div style={{ width: selected.score + "%" }} /></div>
        <div className="score-grid"><div><span>Color harmony</span><strong>97%</strong></div><div><span>Weight match</span><strong>94%</strong></div><div><span>Season match</span><strong>92%</strong></div></div>
        <div className="detail-divider" />
        <div className="detail-section"><span className="section-kicker">STYLING RATIONALE</span><p>{selected.rationale}</p></div>
        <div className="detail-section"><span className="section-kicker">RULE ENGINE</span>{["Formality level matched (" + formality + "/5)","Complementary warm undertones","Contrast ratio within optimal range","Season / setting compatible"].map(rule => <div className="rule-row" key={rule}><span><Icon name="check" /></span>{rule}</div>)}</div>
        <div className="detail-section"><span className="section-kicker">COLOR HARMONY</span><div className="harmony-map"><i style={{ background: selectedFabric.color }} /><span>→</span><i style={{ background: selectedTier === "statement" ? "#707762" : "#D5C3A4" }} /><i style={{ background: "#F0E4CF" }} /></div><small>Warm-neutral harmony · medium contrast</small></div>
        <div className="detail-section"><span className="section-kicker">CONTEXT</span><div className="context-summary"><span>{occasion}</span><span>Formality {formality}/5</span><span>{time}</span><span>{setting}</span><span>{fit} fit</span></div></div>
        <div className="detail-actions"><button>View full breakdown</button><button className="primary">Select outfit <Icon name="chevron" /></button></div>
      </aside>
    </div>

    {mode === "studio" && <section className="context-drawer"><div><span className="section-kicker">STYLE & CONTEXT INPUTS</span><strong>Dial in the brief before generating</strong></div><div className="control-group"><label>Occasion</label><div className="segmented">{["Wedding","Business","Resort","Evening","Casual"].map(x => <button key={x} className={occasion === x ? "active" : ""} onClick={() => setOccasion(x)}>{x}</button>)}</div></div><div className="control-group formality"><label>Formality <strong>{formality}/5</strong></label><div className="steps">{[1,2,3,4,5].map(n => <button key={n} className={n <= formality ? "active" : ""} onClick={() => setFormality(n)}>{n}</button>)}</div></div><div className="control-group"><label>Time</label><div className="pill-toggle"><button className={time === "Day" ? "active" : ""} onClick={() => setTime("Day")}><Icon name="sun" /> Day</button><button className={time === "Night" ? "active" : ""} onClick={() => setTime("Night")}><Icon name="moon" /> Night</button></div></div><div className="control-group"><label>Setting</label><div className="pill-toggle"><button className={setting === "Indoor" ? "active" : ""} onClick={() => setSetting("Indoor")}>Indoor / AC</button><button className={setting === "Outdoor" ? "active" : ""} onClick={() => setSetting("Outdoor")}>Outdoor / Coastal</button></div></div><div className="control-group"><label>Silhouette</label><select value={fit} onChange={e => setFit(e.target.value)}><option>Slim</option><option>Tailored</option><option>Relaxed</option></select></div></section>}
  </div>;
}

function OperatorView({ mode }: { mode: Mode }) {
  const [tab, setTab] = useState("catalogue");
  const rows = [
    ["LNL-2024-09","Sky Blue Herringbone","Shirt","Blue","Cool","Fine","160","3","Spring / Summer","Verified"],
    ["LNL-2024-88","Sand Beige Plain","Trouser","Neutral","Warm","None","240","3","Spring / Summer","Verified"],
    ["LNL-2024-31","Oatmeal Slub","Trouser","Neutral","Warm","Medium","260","3","Spring / Summer","Needs Review"],
    ["LNL-2024-44","Olive Twill","Trouser","Green","Warm","None","230","4","All Season","Verified"],
  ];
  return <div className="operator-view"><div className="operator-title"><div><span className="eyebrow">OPERATOR LAB · DIAGNOSTICS</span><h1>{mode === "catalog" ? "Fabric Catalogue" : "Recommendation Control Room"}</h1><p>Verify metadata, inspect scoring behavior, and keep production recommendations explainable.</p></div><span className="operator-status"><i /> Production rules synced</span></div><div className="operator-tabs">{(mode === "catalog" ? ["catalogue"] : ["catalogue","logic","feedback"]).map(x => <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x === "catalogue" ? "Fabric Catalogue & Metadata Auditor" : x === "logic" ? "Logic & Recommendation Tester" : "Feedback Loop"}</button>)}</div>
  {tab === "catalogue" && <div className="data-card"><div className="table-toolbar"><strong>48 catalogue records</strong><span>Last verified 12 min ago</span><button>Export CSV <Icon name="download" /></button></div><div className="table-wrap"><table><thead><tr>{["SKU","Fabric Name","Category","Color Family","Undertone","Pattern Scale","GSM","Formality","Season","Status"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r[0]}>{r.map((v,i) => <td key={i}>{i === 9 ? <span className={"status-tag " + v.toLowerCase().replace(" ","-")}><i />{v}</span> : v}</td>)}</tr>)}</tbody></table></div></div>}
  {tab === "logic" && <div className="tester-grid"><div className="test-form data-card"><span className="section-kicker">BATCH TEST SANDBOX</span><h3>Edge-case scenario</h3>{["Base fabric: Sky Blue Herringbone","Occasion: Outdoor Wedding","Formality: 4 / 5","Season: Spring / Summer"].map(x => <button className="test-field" key={x}>{x}<Icon name="chevron" /></button>)}<div className="override-list"><label><input type="checkbox" /> Override Season Match</label><label><input type="checkbox" /> Force High Contrast</label><label><input type="checkbox" /> Ignore GSM Delta</label></div><button className="run-test"><Icon name="bolt" /> Run batch test</button></div><pre className="data-card json-log">{'{\n  "base": "LNL-2024-09",\n  "candidate": "LNL-2024-31",\n  "colorHarmony": 0.97,\n  "weightCompatibility": 0.94,\n  "seasonMatch": 0.92,\n  "finalScore": 0.94,\n  "decision": "elevated"\n}'}</pre></div>}
  {tab === "feedback" && <div className="feedback-grid">{["Sky Blue + Oatmeal","Slate + Oatmeal","Olive + Sand"].map((x,i) => <div className="feedback-card data-card" key={x}><div><span className="feedback-avatar">{["A","M","R"][i]}</span><strong>{x}</strong></div><span className={"feedback-state " + (i === 1 ? "adjusted" : "approved")}>{i === 1 ? "Adjusted" : "Approved"}</span><p>Operator feedback logged against recommendation {i + 18}. Rule trace retained for recalibration.</p><button>Open correction panel <Icon name="chevron" /></button></div>)}</div>}
  </div>;
}
