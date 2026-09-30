export const PREVIEW_PERFORMANCE_STORAGE_KEY="linen-earth:preview-performance:v1";
export const PREVIEW_PERFORMANCE_TARGET_MS=100;
export type PreviewPerformanceKind="garment-option"|"body-option"|"view";
export type PreviewPerformanceSample={kind:PreviewPerformanceKind;durationMs:number;at:number};
export type PreviewPerformanceSummary={
  samples:number;
  medianMs:number|null;
  p95Ms:number|null;
  maxMs:number|null;
  withinTarget:boolean|null;
};

function round(value:number){return Math.round(value*10)/10;}
function summarize(samples:PreviewPerformanceSample[]):PreviewPerformanceSummary {
  const values=samples.map((item)=>item.durationMs).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!values.length) return {samples:0,medianMs:null,p95Ms:null,maxMs:null,withinTarget:null};
  const at=(p:number)=>values[Math.min(values.length-1,Math.floor((values.length-1)*p))];
  const p95=at(.95);
  return {
    samples:values.length,
    medianMs:round(at(.5)),
    p95Ms:round(p95),
    maxMs:round(values.at(-1) || 0),
    withinTarget:p95<PREVIEW_PERFORMANCE_TARGET_MS,
  };
}

function readSamples():PreviewPerformanceSample[] {
  if(typeof window==="undefined") return [];
  try {
    const parsed=JSON.parse(sessionStorage.getItem(PREVIEW_PERFORMANCE_STORAGE_KEY)||"[]") as unknown;
    if(!Array.isArray(parsed)) return [];
    return parsed.filter((item):item is PreviewPerformanceSample=>{
      if(!item||typeof item!=="object") return false;
      const row=item as Partial<PreviewPerformanceSample>;
      return ["garment-option","body-option","view"].includes(String(row.kind))
        && Number.isFinite(row.durationMs) && Number(row.durationMs)>=0
        && Number.isFinite(row.at);
    }).slice(-120);
  } catch { return []; }
}

export function readPreviewPerformanceSummary() {
  return summarize(readSamples());
}

export function recordPreviewPerformance(kind:PreviewPerformanceKind,durationMs:number) {
  if(typeof window==="undefined" || !Number.isFinite(durationMs) || durationMs<0) return readPreviewPerformanceSummary();
  const samples=readSamples();
  samples.push({kind,durationMs:Math.min(durationMs,10_000),at:Date.now()});
  const recent=samples.slice(-120);
  try { sessionStorage.setItem(PREVIEW_PERFORMANCE_STORAGE_KEY,JSON.stringify(recent)); } catch { /* local telemetry is optional */ }
  const summary=summarize(recent);
  (window as typeof window & {__linenPreviewPerformance?:PreviewPerformanceSummary}).__linenPreviewPerformance=summary;
  return summary;
}

export function measurePreviewCommit(kind:PreviewPerformanceKind,startedAt:number) {
  if(typeof window==="undefined" || typeof requestAnimationFrame!=="function") return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    recordPreviewPerformance(kind,performance.now()-startedAt);
  }));
}
