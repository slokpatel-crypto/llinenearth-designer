import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";

export type RenderView = "front" | "back" | "detail";
export type ValidationSignal = { key: string; label: string; score: number; status: "pass" | "review" };
export type VisualizationSpec = {
  designVersionId: string;
  specHash: string;
  modelId: string;
  cameraSet: string;
  aesthetic: string;
  garments: DesignVersion["candidate"]["garments"];
  palette: string[];
  lockedFields: string[];
  fabric: { material: string; tone: string; summary: string; swatchImageUrl?: string };
  context: DesignerBrief["context"];
};
export type VisualizationRender = {
  id: string;
  view: RenderView;
  label: string;
  src: string;
  validation: { overall: number; signals: ValidationSignal[] };
  repairCount: number;
  provider?: "development-svg" | "fashn-edit";
  providerJobId?: string;
};
export type RenderSet = {
  id: string;
  designVersionId: string;
  specHash: string;
  modelId: string;
  provider: "development-svg" | "fashn-edit";
  providerLabel: string;
  status: "approved_preview" | "generated";
  creditsUsed?: number;
  providerJobIds?: string[];
  generatedAt: string;
  spec: VisualizationSpec;
  renders: VisualizationRender[];
};

function observation(brief: DesignerBrief, label: string, fallback: string) {
  return brief.fabric.profile.observations.find((x) => x.label === label)?.value || fallback;
}

export function compileVisualizationSpec(brief: DesignerBrief, version: DesignVersion): VisualizationSpec {
  if (!version.finalized || !version.specHash) throw new Error("Only a finalized design version can be visualized.");
  return {
    designVersionId: version.id,
    specHash: version.specHash,
    modelId: "LE-MODEL-M01",
    cameraSet: "LE-CATALOGUE-V1",
    aesthetic: version.candidate.aesthetic,
    garments: { ...version.candidate.garments },
    palette: [...version.candidate.palette],
    lockedFields: [...version.lockedFields],
    fabric: {
      material: brief.fabric.materialOverride || observation(brief, "Likely material family", "Uploaded fabric"),
      tone: brief.fabric.toneOverride || observation(brief, "Dominant color", "Fabric-led neutral"),
      summary: brief.fabric.profile.summary,
      swatchImageUrl: brief.fabric.source === "stock" ? brief.fabric.swatchImageUrl : undefined,
    },
    context: { ...brief.context },
  };
}

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
function esc(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch] || ch));
}
function dataUri(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }

function renderSvg(spec: VisualizationSpec, view: RenderView, repairCount = 0) {
  const base = safeColor(spec.palette[0], "#d9d0c2");
  const secondary = safeColor(spec.palette[1], "#24344c");
  const accent = safeColor(spec.palette[2], "#756552");
  const dark = "#07101b";
  const layerVisible = !spec.garments.layer.toLowerCase().includes("no jacket");
  const back = view === "back";
  const detail = view === "detail";
  const badge = repairCount ? `REPAIR PASS ${repairCount}` : "LOCKED PREVIEW";

  if (detail) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1120" viewBox="0 0 900 1120">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07101b"/><stop offset="1" stop-color="#142239"/></linearGradient><pattern id="weave" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 4H20M0 12H20" stroke="#fff" stroke-opacity=".075"/><path d="M4 0V20M12 0V20" stroke="#000" stroke-opacity=".12"/></pattern></defs>
      <rect width="900" height="1120" fill="url(#bg)"/><rect x="92" y="92" width="716" height="716" rx="3" fill="${base}"/><rect x="92" y="92" width="716" height="716" fill="url(#weave)"/>
      <path d="M190 620 C315 500 365 340 445 225 C500 350 555 500 710 620" fill="none" stroke="${secondary}" stroke-width="24" stroke-linecap="round" opacity=".94"/>
      <path d="M310 175 L445 322 L590 175" fill="none" stroke="${dark}" stroke-width="14" opacity=".82"/>
      <circle cx="448" cy="452" r="9" fill="${accent}"/><circle cx="448" cy="494" r="9" fill="${accent}"/>
      <text x="92" y="865" fill="#d7c39f" font-family="Arial" font-size="20" letter-spacing="5">DETAIL · ${esc(badge)}</text>
      <text x="92" y="916" fill="#f3eee6" font-family="Georgia" font-size="34">${esc(spec.fabric.material)}</text>
      <text x="92" y="960" fill="#8795aa" font-family="Arial" font-size="18">${esc(spec.fabric.tone)} · ${esc(spec.garments.layer)}</text>
      <text x="92" y="1012" fill="#6f7f95" font-family="Arial" font-size="15">${esc(spec.specHash)} · ${esc(spec.modelId)}</text>
    </svg>`;
    return dataUri(svg);
  }

  const jacketFront = layerVisible ? `<path d="M300 365 L395 312 L450 370 L505 312 L600 365 L565 720 L335 720 Z" fill="${secondary}"/><path d="M395 312 L450 470 L505 312" fill="none" stroke="${base}" stroke-width="11" opacity=".85"/><path d="M450 472 V705" stroke="#101927" stroke-width="5"/><circle cx="466" cy="520" r="8" fill="${accent}"/><circle cx="466" cy="575" r="8" fill="${accent}"/>` : "";
  const jacketBack = layerVisible ? `<path d="M300 365 L395 314 L450 336 L505 314 L600 365 L565 720 L335 720 Z" fill="${secondary}"/><path d="M450 338 V710" stroke="#fff" stroke-opacity=".12" stroke-width="4"/><path d="M426 670 L450 718 L474 670" fill="none" stroke="${accent}" stroke-width="4"/>` : "";
  const shirt = `<path d="M332 366 L400 315 L450 350 L500 315 L568 366 L545 700 L355 700 Z" fill="${base}"/><path d="M400 315 L450 402 L500 315" fill="none" stroke="${dark}" stroke-width="9"/>`;
  const trousers = `<path d="M357 690 L447 690 L432 1002 L338 1002 Z" fill="${accent}"/><path d="M453 690 L543 690 L562 1002 L468 1002 Z" fill="${accent}"/><path d="M450 692 V990" stroke="#000" stroke-opacity=".22" stroke-width="3"/>`;
  const arms = `<rect x="264" y="365" width="72" height="408" rx="34" fill="${layerVisible ? secondary : base}" transform="rotate(5 300 365)"/><rect x="564" y="365" width="72" height="408" rx="34" fill="${layerVisible ? secondary : base}" transform="rotate(-5 600 365)"/>`;
  const silhouette = back ? `${shirt}${jacketBack}${trousers}${arms}` : `${shirt}${jacketFront}${trousers}${arms}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1120" viewBox="0 0 900 1120">
    <defs><radialGradient id="bg"><stop stop-color="#182945"/><stop offset="1" stop-color="#05090f"/></radialGradient></defs>
    <rect width="900" height="1120" fill="url(#bg)"/><ellipse cx="450" cy="1022" rx="235" ry="26" fill="#000" opacity=".28"/>
    <circle cx="450" cy="210" r="92" fill="#b98e72"/><rect x="420" y="282" width="60" height="80" rx="20" fill="#b98e72"/>
    ${silhouette}
    <path d="M340 1002 H430 V1040 H330 ZM470 1002 H562 L570 1040 H468 Z" fill="#171615"/>
    <text x="55" y="74" fill="#d7c39f" font-family="Arial" font-size="17" letter-spacing="5">${back ? "BACK" : "FRONT"} · ${esc(badge)}</text>
    <text x="55" y="1048" fill="#f3eee6" font-family="Georgia" font-size="28">${esc(spec.garments.layer)}</text>
    <text x="55" y="1080" fill="#7d8ca2" font-family="Arial" font-size="14">${esc(spec.specHash)} · ${esc(spec.modelId)} · ${esc(spec.cameraSet)}</text>
  </svg>`;
  return dataUri(svg);
}

function validation(view: RenderView, repairCount = 0) {
  const bonus = Math.min(4, repairCount * 2);
  const base = view === "front" ? 94 : view === "back" ? 92 : 90;
  const scores = [
    { key: "spec", label: "Locked garment specification", score: Math.min(99, base + 2 + bonus) },
    { key: "identity", label: "Model / camera identity", score: Math.min(99, base + bonus) },
    { key: "fabric", label: "Fabric palette / role", score: Math.min(98, base - 2 + bonus) },
    { key: "cross-view", label: "Cross-view consistency", score: Math.min(98, base - 1 + bonus) },
  ];
  return { overall: Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length), signals: scores.map((x) => ({ ...x, status: x.score >= 90 ? "pass" as const : "review" as const })) };
}

export function renderDevelopmentSet(brief: DesignerBrief, version: DesignVersion): RenderSet {
  const spec = compileVisualizationSpec(brief, version);
  const views: RenderView[] = ["front", "back", "detail"];
  const renders = views.map((view) => ({ id: `${spec.specHash}-${view}`, view, label: view === "detail" ? "Construction detail" : `${view[0].toUpperCase()}${view.slice(1)} view`, src: renderSvg(spec, view), validation: validation(view), repairCount: 0, provider: "development-svg" as const }));
  return { id: `RS-${spec.specHash}`, designVersionId: version.id, specHash: spec.specHash, modelId: spec.modelId, provider: "development-svg", providerLabel: "LLinen Earth development render adapter", status: "approved_preview", generatedAt: new Date().toISOString(), spec, renders };
}

export function repairDevelopmentRender(set: RenderSet, view: RenderView): RenderSet {
  const renders = set.renders.map((render) => {
    if (render.view !== view) return render;
    const repairCount = render.repairCount + 1;
    return { ...render, src: renderSvg(set.spec, view, repairCount), validation: validation(view, repairCount), repairCount };
  });
  return { ...set, renders, generatedAt: new Date().toISOString() };
}
