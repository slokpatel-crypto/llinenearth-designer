import type { ProductionHandoff } from "@/lib/designer/production-handoff";

export const TECH_PACK_VERSION="linen-earth-tech-pack-v1" as const;

function esc(value:unknown){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function rows(items:Array<[string,unknown]>){
  return items.map(([label,value])=>`<tr><th>${esc(label)}</th><td>${esc(value||"—")}</td></tr>`).join("");
}

function measurementRows(items:ProductionHandoff["construction"]["shirt"]["finishedTargets"]){
  if(!items.length) return `<tr><td colspan="4">No finished-garment targets are available yet.</td></tr>`;
  return items.map((item)=>`<tr><td>${esc(item.label)}</td><td>${item.bodyCm.toFixed(1)} cm</td><td>${item.finishedCm.min.toFixed(1)}–${item.finishedCm.max.toFixed(1)} cm</td><td>${esc(item.basis.replaceAll("_"," "))}</td></tr>`).join("");
}

function list(items:string[]){
  if(!items.length) return "<li>None recorded.</li>";
  return items.map((item)=>`<li>${esc(item)}</li>`).join("");
}

export function buildTailorTechPackHtml(handoff:ProductionHandoff){
  const shirt=handoff.construction.shirt;
  const trouser=handoff.construction.trouser;
  const title=`Linen Earth · Tailor Tech Pack · ${handoff.designRevisionId}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#1d242a;margin:0;font-size:11px;line-height:1.45}
header{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #1d242a;padding-bottom:12px;margin-bottom:16px}
h1{font-family:Georgia,serif;font-weight:400;font-size:24px;margin:2px 0 6px}
h2{font-family:Georgia,serif;font-weight:400;font-size:17px;margin:0 0 8px}
small,.muted{color:#68727c}
.badge{display:inline-block;border:1px solid #1d242a;padding:4px 7px;font-size:9px;letter-spacing:.08em;text-transform:uppercase}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.card{border:1px solid #cfd3d6;padding:11px;break-inside:avoid}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e0e3e5;padding:5px 4px}
th{width:38%;font-weight:600}
.measure th{width:auto}
ul{margin:6px 0 0;padding-left:18px}
footer{margin-top:14px;padding-top:10px;border-top:1px solid #cfd3d6;color:#68727c}
@media print{.no-print{display:none}}
</style>
</head>
<body>
<header>
  <div>
    <div class="muted">LINEN EARTH · ${TECH_PACK_VERSION}</div>
    <h1>Tailor Tech Pack</h1>
    <div>${esc(handoff.designRevisionId)}</div>
  </div>
  <div>
    <div class="badge">${esc(handoff.status.replaceAll("_"," "))}</div>
    <div class="muted" style="margin-top:8px">Recipe ${esc(handoff.recipeHash.slice(0,16).toUpperCase())}</div>
    <div class="muted">Generated ${esc(handoff.generatedAt)}</div>
  </div>
</header>

<section class="grid">
  <article class="card">
    <h2>Shirt fabric</h2>
    <table>${rows([
      ["Fabric",handoff.fabrics.shirt.name],
      ["Line",handoff.fabrics.shirt.line],
      ["Fabric ID",handoff.fabrics.shirt.id],
      ["Source",handoff.fabrics.shirt.source],
    ])}</table>
  </article>
  <article class="card">
    <h2>Trouser fabric</h2>
    <table>${rows([
      ["Fabric",handoff.fabrics.trouser.name],
      ["Line",handoff.fabrics.trouser.line],
      ["Fabric ID",handoff.fabrics.trouser.id],
      ["Source",handoff.fabrics.trouser.source],
    ])}</table>
  </article>
</section>

<section class="grid">
  <article class="card">
    <h2>Shirt construction</h2>
    <table>${rows([
      ["Fit",shirt.fit],
      ["Wear",shirt.wear],
      ["Collar",shirt.collar],
      ["Collar finish",shirt.collarFinish],
      ["Cuff",shirt.cuff],
      ["Placket",shirt.placket],
      ["Button",shirt.button],
    ])}</table>
  </article>
  <article class="card">
    <h2>Trouser construction</h2>
    <table>${rows([
      ["Shape",trouser.shape],
      ["Rise",trouser.rise],
      ["Waistband",trouser.waistband],
      ["Break",trouser.break],
    ])}</table>
  </article>
</section>

<section class="card" style="margin-bottom:12px">
  <h2>Exact selected cut · StyleSpec v2</h2>
  ${handoff.construction.styleSpec?`
    <p class="muted">These are the actual locked tailoring choices. The earlier shorthand above may only describe the closest photographic preview.</p>
    <div class="grid">
      <table>${rows([
        ["Shirt construction",handoff.construction.styleSpec.shirt.type],
        ["Collar",handoff.construction.styleSpec.shirt.collar],
        ["Collar finish",handoff.construction.styleSpec.shirt.collarFinish],
        ["Sleeve length",handoff.construction.styleSpec.shirt.sleeve],
        ["Cuff construction",handoff.construction.styleSpec.shirt.cuff],
        ["Placket",handoff.construction.styleSpec.shirt.placket],
        ["Pocket",handoff.construction.styleSpec.shirt.pocket],
        ["Fit",handoff.construction.styleSpec.shirt.fit],
        ["Body length",handoff.construction.styleSpec.shirt.length],
        ["Shirt hem",handoff.construction.styleSpec.shirt.hem],
        ["Back shaping",handoff.construction.styleSpec.shirt.back],
        ["Wear",handoff.construction.styleSpec.shirt.wear],
        ["Button",handoff.construction.styleSpec.shirt.button],
      ])}</table>
      <table>${rows([
        ["Trouser construction",handoff.construction.styleSpec.pant.type],
        ["Leg shape",handoff.construction.styleSpec.pant.fit],
        ["Rise",handoff.construction.styleSpec.pant.rise],
        ["Pleat",handoff.construction.styleSpec.pant.pleat],
        ["Waistband",handoff.construction.styleSpec.pant.waistband],
        ["Hem",handoff.construction.styleSpec.pant.hem],
        ["Break",handoff.construction.styleSpec.pant.break],
        ["Occasion",handoff.construction.context.occasion],
        ["Climate",handoff.construction.context.climate],
        ["Intention",handoff.construction.context.intention],
      ])}</table>
    </div>
    <p class="muted">Raw option identifiers are included intentionally to avoid ambiguous label substitutions. Tailor must confirm construction, ease and actual garment dimensions.</p>
  `:`<p>Older legacy design: confirm the cut in person before pattern making; no StyleSpec v2 construction details were locked.</p>`}
</section>

${handoff.construction.creative?`<section class="card" style="margin-bottom:12px"><h2>Creative recipe / sample review</h2><p>${esc(handoff.construction.creative.name)} · ${esc(handoff.construction.creative.thesis)}</p><ul>${list(handoff.construction.creative.treatments.map(t=>`${t.zone}: ${t.instruction}`))}</ul>${handoff.construction.creative.craft?`<p>Craft version: ${esc(handoff.construction.creative.craft.version)} · Proposed sample dimensions</p><ul>${list(handoff.construction.creative.craft.panels.map(p=>`${p.zone}: ${p.fabric.name} (${p.fabric.id}); provenance: ${p.fabric.source}`))}</ul><pre>${esc(JSON.stringify(handoff.construction.creative.craft.decoration,null,2))}</pre>`:""}</section>`:""}
<section class="card" style="margin-bottom:12px">
  <h2>Shirt finished-garment targets</h2>
  <table class="measure"><thead><tr><th>Target</th><th>Body</th><th>Finished range</th><th>Basis</th></tr></thead><tbody>${measurementRows(shirt.finishedTargets)}</tbody></table>
</section>

<section class="card" style="margin-bottom:12px">
  <h2>Trouser finished-garment targets</h2>
  <table class="measure"><thead><tr><th>Target</th><th>Body</th><th>Finished range</th><th>Basis</th></tr></thead><tbody>${measurementRows(trouser.finishedTargets)}</tbody></table>
</section>

<section class="grid">
  <article class="card">
    <h2>Starting block / construction checks</h2>
    <table>${rows([
      ["Shirt block",handoff.construction.blockStrategy?.shirtBlock??"Not resolved"],
      ["Trouser block",handoff.construction.blockStrategy?.trouserBlock??"Not resolved"],
      ["Torso",handoff.construction.blockStrategy?.torsoShape??"Not resolved"],
      ["Seat",handoff.construction.blockStrategy?.seatShape??"Not resolved"],
    ])}</table>
    <ul>${list(handoff.construction.checks.map((item)=>`${item.severity.toUpperCase()}: ${item.message}`))}</ul>
  </article>
  <article class="card">
    <h2>Production fields</h2>
    <table>${rows([
      ["Shirt metres",handoff.production.clothEstimate.shirtMetres??"TAILOR REQUIRED"],
      ["Trouser metres",handoff.production.clothEstimate.trouserMetres??"TAILOR REQUIRED"],
      ["Stock reservation",handoff.production.stockReservation.reservationId??"NOT REQUESTED"],
      ["Quote",handoff.production.quote.amount==null?"PENDING":`${handoff.production.quote.currency??""} ${handoff.production.quote.amount}`],
    ])}</table>
    <p class="muted">${esc(handoff.production.clothEstimate.note)}</p>
  </article>
</section>

<section class="grid">
  <article class="card"><h2>Unresolved before production</h2><ul>${list(handoff.unresolved)}</ul></article>
  <article class="card"><h2>Caveats</h2><ul>${list(handoff.caveats)}</ul></article>
</section>

<section class="card" style="margin-top:14px;break-inside:avoid">
  <h2>Operator and tailor physical acceptance · unsigned</h2>
  <p class="muted">All fields below intentionally require a real human review. Nothing is considered checked or signed merely because this document was generated.</p>
  <table>${rows([
    ["Physical shirt roll/lot and stock checked","________________________"],
    ["Physical trouser roll/lot and stock checked","________________________"],
    ["Measured composition, weight (GSM), shrinkage","________________________"],
    ["Actual stripe/check repeat and swatch ruler reference","________________________"],
    ["Colour calibration and fabric drape checked","________________________"],
    ["Collar/cuff/sleeve/hem and trouser construction checked","________________________"],
    ["Body landmarks, ease table and all finished targets checked","________________________"],
    ["Customer preview versus exact chosen cut discrepancy explained","________________________"],
    ["Required cloth metres confirmed and stock reserved","________________________"],
    ["Operator, date and actual tailor approval","________________________"],
    ["Approved cutting/block/pattern ID","________________________"],
  ])}</table>
  <p><b>Status: PENDING HUMAN ACCEPTANCE — NO CUTTING AUTHORISATION.</b></p>
</section>

<footer>
This document is generated from an immutable Linen Earth design revision. It is a tailoring handoff, not a cutting pattern. Physical cloth, final measurements, stock and meterage must be verified before cutting.
</footer>
</body>
</html>`;
}

export function techPackFilename(handoff:ProductionHandoff){
  return `linen-earth-tech-pack-${handoff.designRevisionId.toLowerCase()}.html`;
}
