import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { loadLatestGarmentViewerReadiness } from "@/lib/garment-viewer-evidence-server";
import { LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM, LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM } from "@/lib/designer/model-identity";
import GarmentViewerEvidenceForm from "./GarmentViewerEvidenceForm";
import "./garment-viewer.css";

export const dynamic="force-dynamic";

export default async function GarmentViewerOperatorPage(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    redirect("/operator/login?next=/operator/garment-viewer");
  }

  const report=await loadLatestGarmentViewerReadiness();
  const status=report.asset;
  const latest=report.latest;
  const model=status.model;
  const manifest=status.manifest;
  const panels=model?.panels||[];

  return <main className="garmentQa">
    <header>
      <div>
        <span>LINEN EARTH / OPERATOR / 3D</span>
        <h1>GarmentViewer Asset Gate</h1>
        <p>Structural checks only. Passing this desk does not promote 3D to the customer Designer; realism, boundaries, pattern scale and mobile evidence still have separate gates.</p>
      </div>
      <nav><Link href="/lab/garment-viewer">Open 3D Lab ↗</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    <section className="garmentQaHero" data-ready={status.assetReady&&manifest?.productionAssetReady===true}>
      <small>PRODUCTION ASSET STATUS</small>
      <strong>{status.assetReady&&manifest?.productionAssetReady===true?"REALISTIC CANDIDATE READY":status.assetReady?"STRUCTURE READY / EVIDENCE OPEN":"NOT READY"}</strong>
      <p>{status.configured ? status.modelSrc : "LINEN_GARMENT_MODEL_SRC is not configured."}</p>
      {manifest?.productionAssetStatus&&<p><b>Asset status:</b> {manifest.productionAssetStatus}</p>}
    </section>

    <section className="garmentQaGrid garmentQaGridSix">
      <article><small>MODEL FILE</small><strong>{status.configured?"Configured":"Missing"}</strong><p>{status.modelSrc||"Add an approved /models/*.glb source."}</p></article>
      <article><small>SOURCE / LICENSE</small><strong>{manifest?.sourceReady?"Verified":"Open"}</strong><p>{manifest?.source ? `${manifest.source.name} · ${manifest.source.license} · verified ${manifest.source.verifiedAt}` : "Production manifest must record source name, license and verification date."}</p></article>
      <article><small>SIX-PANEL CONTRACT</small><strong>{model?.contract.readiness==="contract_ready"?"Pass":"Open"}</strong><p>{model?model.contract.reasons.join(" "):"GLB has not been structurally inspected."}</p></article>
      <article><small>UV + NORMALS</small><strong>{model?.uvReady?"Pass":"Open"}</strong><p>Every shirt/trouser panel needs POSITION, NORMAL and TEXCOORD_0.</p></article>
      <article><small>PHYSICAL SIDECAR</small><strong>{manifest?.valid?"Pass":"Open"}</strong><p>{status.manifestSrc||"Matching .viewer.json is required."}</p></article>
      <article><small>MOBILE PREFLIGHT</small><strong>{model?.performanceBudgetReady?"Pass":"Review"}</strong><p>{model ? `${Math.round(model.fileBytes/1024/1024*10)/10} MB · ${model.triangleCount.toLocaleString()} triangles · ${model.vertexCount.toLocaleString()} vertices` : "Complexity will be checked after a production GLB is configured."}</p></article>
    </section>

    <section className="garmentQaPanel">
      <div className="garmentQaPanelHead"><div><small>LOCKED MODEL IDENTITY</small><h2>{LINEN_EARTH_MODEL_IDENTITY_ID}</h2></div><b>{LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM} mm</b></div>
      <div className="garmentQaRows">
        {([
          ["Shoulder seam",LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM.shoulderSeamWidth],
          ["Outer arm silhouette",LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM.outerArmSilhouette],
          ["Shirt waist",LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM.shirtWaistWidth],
          ["Trouser waist",LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM.trouserWaistWidth],
          ["Hand-center spacing",LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM.handCenterSpacing],
          ["Leg-center spacing",LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM.legCenterSpacing],
          ["Trouser hem",LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM.hemWidth],
        ] as const).map(([label,value])=><div key={label} data-ready={true}>
          <strong>{label}</strong><span>{value} mm</span><em>Canonical production target</em>
        </div>)}
      </div>
    </section>

    {manifest?.panelMeasurementEvidence&&<section className="garmentQaPanel">
      <div className="garmentQaPanelHead"><div><small>PANEL SCALE PROVENANCE</small><h2>Measured garment dimensions</h2></div><b>{manifest.panelMeasurementEvidence.source}</b></div>
      <div className="garmentQaRows">
        <div data-ready={true}><strong>Measured at</strong><span>{manifest.panelMeasurementEvidence.measuredAt}</span><em>Physical scale evidence</em></div>
        <div data-ready={true}><strong>Measurement note</strong><span>{manifest.panelMeasurementEvidence.note}</span><em>No anonymous/guessed panel scale</em></div>
      </div>
    </section>}

    {manifest?.productionFitEvidence&&<section className="garmentQaPanel">
      <div className="garmentQaPanelHead"><div><small>PRODUCTION FIT EVIDENCE</small><h2>Blender preflight geometry checks</h2></div><b>{manifest.productionFitEvidence.gate||"RECORDED"}</b></div>
      <div className="garmentQaRows">
        <div data-ready={true}><strong>Identity fit</strong><span>{Object.keys(manifest.productionFitEvidence.identityFitMeasurementsMm||{}).length} measurements</span><em>Locked silhouette + stance</em></div>
        <div data-ready={true}><strong>Boundary intersections</strong><span>{Object.keys(manifest.productionFitEvidence.boundaryIntersections||{}).length} checks</span><em>Body / garment / tuck</em></div>
        <div data-ready={true}><strong>Boundary clearances</strong><span>{Object.keys(manifest.productionFitEvidence.boundaryClearanceMm||{}).length} checks</span><em>Upper torso · waist · cuffs · trouser gap</em></div>
      </div>
    </section>}

    {panels.length>0&&<section className="garmentQaPanel">
      <div className="garmentQaPanelHead"><div><small>PANEL CONTRACT</small><h2>Fabric-mappable garment pieces</h2></div><b>{panels.filter((panel)=>panel.position&&panel.normal&&panel.uv0).length}/{panels.length}</b></div>
      <div className="garmentQaRows">
        {panels.map((panel)=><div key={panel.material} data-ready={panel.position&&panel.normal&&panel.uv0}>
          <strong>{panel.material}</strong>
          <span>{panel.primitiveCount} primitive{panel.primitiveCount===1?"":"s"}</span>
          <em>{panel.position?"POSITION ✓":"POSITION !"} · {panel.normal?"NORMAL ✓":"NORMAL !"} · {panel.uv0?"UV0 ✓":"UV0 !"}</em>
        </div>)}
      </div>
    </section>}

    <GarmentViewerEvidenceForm assetIdentity={status.assetIdentity}/>

    <section className="garmentQaPanel">
      <div className="garmentQaPanelHead"><div><small>CUSTOMER PROMOTION GATE</small><h2>3D stays in the lab until every evidence gate passes</h2></div><b>{latest?.readiness.ready?"READY":"BLOCKED"}</b></div>
      {latest?<div className="garmentQaPromotion">
        {([
          ["Model contract",latest.readiness.contractReady],
          ["Physical manifest",latest.readiness.manifestReady],
          ["Realistic production candidate",latest.readiness.productionAssetReady],
          ["Stripe + check scale",latest.readiness.scaleReady],
          ["Interaction p95",latest.readiness.latencyReady],
          ["Independent realism",latest.readiness.realismReady],
          ["Garment boundaries",latest.readiness.boundaryReady],
        ] as const).map(([label,ready])=><span key={label} data-ready={ready}><i>{ready?"✓":"!"}</i><b>{label}</b></span>)}
        <p>Latest evidence: {new Date(latest.at).toLocaleString("en-IN")} · {latest.readiness.realism.uniqueViewers} realism viewers · {latest.readiness.latency.count} latency samples.</p>
        {latest.readiness.reasons.length>0&&<div className="garmentQaReasons">{latest.readiness.reasons.map((reason,index)=><p key={index}>{reason}</p>)}</div>}
      </div>:<p className="garmentQaReasons">No GarmentViewer readiness evidence has been recorded yet. Structural asset checks alone cannot promote 3D to customers.</p>}
    </section>

    <section className="garmentQaPanel">
      <div className="garmentQaPanelHead"><div><small>BLOCKERS</small><h2>What still prevents asset approval</h2></div></div>
      {status.reasons.length||model?.performanceWarnings.length?<div className="garmentQaReasons">{[...status.reasons,...(model?.performanceWarnings||[])].map((reason,index)=><p key={index}>{reason}</p>)}</div>:<p className="garmentQaClear">No structural blockers. Continue to physical-scale, performance, boundary and independent-realism evidence before customer promotion.</p>}
    </section>
  </main>;
}
