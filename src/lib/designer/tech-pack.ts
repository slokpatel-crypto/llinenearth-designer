import type { ProductionHandoff } from "@/lib/designer/production-handoff";
import type { LockedDesignRevision } from "./design-lock.ts";
import { verifyProductionHandoff } from "./production-handoff.ts";
import { auditHandoffFitProvenance, auditHandoffMeasurements } from "./handoff-measurements.ts";
import { validateStyleSpecV2 } from "./style-spec-v2.ts";

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
  if(!items.length) return `<tr><td colspan="5">No finished-garment targets are available yet. Obtain physical measurements before cutting.</td></tr>`;
  return items.map((item)=>{
    const ease=item.easeCm
      ? `${item.easeCm.min.toFixed(1)}–${item.easeCm.max.toFixed(1)} cm`
      : "— (not an ease calculation)";
    const basis=item.basis==="recorded_anchor" ? "recorded anchor — verify against pattern"
      : item.basis==="customer_desired" ? "customer desired — tailor to verify"
      : "body + provisional/approved ease (see source)";
    return `<tr><td>${esc(item.label)}</td><td>${item.bodyCm.toFixed(1)} cm</td><td>${esc(ease)}</td><td>${item.finishedCm.min.toFixed(1)}–${item.finishedCm.max.toFixed(1)} cm</td><td>${esc(basis)}</td></tr>`;
  }).join("");
}

function list(items:string[]){
  if(!items.length) return "<li>None recorded.</li>";
  return items.map((item)=>`<li>${esc(item)}</li>`).join("");
}

export function buildTailorTechPackHtml(handoff:ProductionHandoff){
  const shirt=handoff.construction.shirt;
  const trouser=handoff.construction.trouser;
  const audit=auditHandoffMeasurements({
    shirt:shirt.finishedTargets,
    trouser:trouser.finishedTargets,
  });
  if(audit.errors.length) {
    throw new Error(`Unsafe tailor tech pack measurements: ${audit.errors.join(" ")}`);
  }
  const fitAudit=auditHandoffFitProvenance(handoff.construction.fitProvenance);
  if(fitAudit.errors.length) {
    throw new Error(`Unsafe tailor tech pack fit provenance: ${fitAudit.errors.join(" ")}`);
  }
  const originalStyleSpec=handoff.construction.styleSpec;
  const validStyleSpec=validateStyleSpecV2(originalStyleSpec) ? originalStyleSpec : null;
  const invalidConstruction=Boolean(originalStyleSpec) && !validStyleSpec;
  const missingConstruction=invalidConstruction ? [
    "StyleSpec v2 contains invalid or unknown garment choices; the raw selection is included for review only and cannot authorise cutting.",
  ] : validStyleSpec ? [] : [
    "Exact StyleSpec v2 garment construction is absent; tailor must verify legacy options.",
  ];
  const outstanding=[...new Set([...handoff.unresolved,...audit.missing,...fitAudit.missing,...missingConstruction])];
  const displayStatus=handoff.status==="ready_for_tailor_review"
    && !audit.missing.length && !fitAudit.missing.length && !missingConstruction.length
    ? handoff.status : "review_required";
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
    <div class="badge">${esc(displayStatus.replaceAll("_"," "))}</div>
    <div class="muted" style="margin-top:8px">Recipe ${esc(handoff.recipeHash.slice(0,16).toUpperCase())}</div>
    <div class="muted">Generated ${esc(handoff.generatedAt)} · export metadata (not lock-signed)</div>
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
  ${invalidConstruction?`
    <p><b>INVALID VERSIONED CONSTRUCTION — TAILOR REVIEW REQUIRED.</b> These values are unverified input, not exact cut instructions. Do not cut from this document.</p>
    <pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(originalStyleSpec).slice(0,6000))}</pre>
  `:validStyleSpec?`
    <p class="muted">These are the actual locked tailoring choices. The earlier shorthand above may only describe the closest photographic preview.</p>
    <div class="grid">
      <table>${rows([
        ["Shirt construction",validStyleSpec.shirt.type],
        ["Collar",validStyleSpec.shirt.collar],
        ["Collar finish",validStyleSpec.shirt.collarFinish],
        ["Sleeve length",validStyleSpec.shirt.sleeve],
        ["Cuff construction",validStyleSpec.shirt.cuff],
        ["Placket",validStyleSpec.shirt.placket],
        ["Pocket",validStyleSpec.shirt.pocket],
        ["Fit",validStyleSpec.shirt.fit],
        ["Body length",validStyleSpec.shirt.length],
        ["Shirt hem",validStyleSpec.shirt.hem],
        ["Back shaping",validStyleSpec.shirt.back],
        ["Wear",validStyleSpec.shirt.wear],
        ["Button",validStyleSpec.shirt.button],
      ])}</table>
      <table>${rows([
        ["Trouser construction",validStyleSpec.pant.type],
        ["Leg shape",validStyleSpec.pant.fit],
        ["Rise",validStyleSpec.pant.rise],
        ["Pleat",validStyleSpec.pant.pleat],
        ["Waistband",validStyleSpec.pant.waistband],
        ["Hem",validStyleSpec.pant.hem],
        ["Break",validStyleSpec.pant.break],
        ["Occasion",handoff.construction.context?.occasion],
        ["Climate",handoff.construction.context?.climate],
        ["Intention",handoff.construction.context?.intention],
      ])}</table>
    </div>
    <p class="muted">Raw option identifiers are included intentionally to avoid ambiguous label substitutions. Tailor must confirm construction, ease and actual garment dimensions.</p>
  `:`<p>Older legacy design: confirm the cut in person before pattern making; no StyleSpec v2 construction details were locked.</p>`}
</section>

${handoff.construction.creative?`<section class="card" style="margin-bottom:12px"><h2>Creative recipe / sample review</h2><p>${esc(handoff.construction.creative.name)} · ${esc(handoff.construction.creative.thesis)}</p><ul>${list(handoff.construction.creative.treatments.map(t=>`${t.zone}: ${t.instruction}`))}</ul>${handoff.construction.creative.craft?`<p>Craft version: ${esc(handoff.construction.creative.craft.version)} · Proposed sample dimensions</p><ul>${list(handoff.construction.creative.craft.panels.map(p=>`${p.zone}: ${p.fabric.name} (${p.fabric.id}); provenance: ${p.fabric.source}`))}</ul><pre>${esc(JSON.stringify(handoff.construction.creative.craft.decoration,null,2))}</pre>`:""}</section>`:""}
<section class="card" style="margin-bottom:12px">
  <h2>Shirt finished-garment targets</h2>
  <table class="measure"><thead><tr><th>Target</th><th>Body (cm)</th><th>Ease (cm)</th><th>Finished range (cm)</th><th>Basis</th></tr></thead><tbody>${measurementRows(shirt.finishedTargets)}</tbody></table>
</section>

<section class="card" style="margin-bottom:12px">
  <h2>Trouser finished-garment targets</h2>
  <table class="measure"><thead><tr><th>Target</th><th>Body (cm)</th><th>Ease (cm)</th><th>Finished range (cm)</th><th>Basis</th></tr></thead><tbody>${measurementRows(trouser.finishedTargets)}</tbody></table>
</section>

<section class="grid">
  <article class="card">
    <h2>Starting block / construction checks</h2>
    <table>${rows([
      ["Shirt block",handoff.construction.blockStrategy?.shirtBlock??"Not resolved"],
      ["Trouser block",handoff.construction.blockStrategy?.trouserBlock??"Not resolved"],
      ["Torso",handoff.construction.blockStrategy?.torsoShape??"Not resolved"],
      ["Seat",handoff.construction.blockStrategy?.seatShape??"Not resolved"],
      ["Fit assessment",handoff.construction.fitProvenance.fitConstructionVersion??"NOT RECORDED"],
      ["Ease provenance",handoff.construction.fitProvenance.easeSource??"NOT RECORDED"],
      ["Ease table version",handoff.construction.fitProvenance.easeTableVersion??"NOT RECORDED"],
    ])}</table>
    <p class="muted">Starting blocks and ranges are review guidance, not signed cutting dimensions. Physical measurements use centimetres.</p>
    <h2>Pattern and fit adjustments for tailor review</h2>
    <ul>${list((handoff.construction.blockStrategy?.adjustments??[]).map((item)=>
      `${item.garment} / ${item.area} [${item.id}] ${item.severity.toUpperCase()}: ${item.message}`
    ))}</ul>
    <h2>Construction checks</h2>
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
  <article class="card"><h2>Unresolved before production</h2><ul>${list(outstanding)}</ul></article>
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
    ["Body landmarks, centimetre units and conversion checked","________________________"],
    ["Body versus finished garment measurements and ease confirmed","________________________"],
    ["Seam allowances for shirt and trouser pattern pieces approved","________________________"],
    ["Shrinkage and finished-garment tolerances signed","________________________"],
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

/**
 * Trusted print/export boundary. The legacy synchronous HTML builder remains
 * available for explicitly unverified, review-only packets. Export flows must
 * use this async variant so all displayed measurements, material identities,
 * locked cut IDs and unresolved items match the original SHA256 design lock.
 * This check does NOT grant physical cutting authorization.
 */
export async function buildVerifiedTailorTechPackHtml(
  handoff: ProductionHandoff,
  revision: LockedDesignRevision,
): Promise<string> {
  if (!await verifyProductionHandoff(handoff, revision)) {
    throw new Error("Unsafe tailor tech pack export: the packet does not match its verified locked design revision.");
  }
  return buildTailorTechPackHtml(handoff);
}

export function techPackFilename(handoff:ProductionHandoff){
  return `linen-earth-tech-pack-${handoff.designRevisionId.toLowerCase()}.html`;
}
