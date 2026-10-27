export type PreviewOptionReviewStatus="approved"|"rejected";

export type PreviewCoverageRow={
  id:string;
  styleKey:string;
  label:string;
  livePreview:"exact"|"approximate"|"none";
  constructionStatus:"approved"|"rejected"|"pending"|"not_required";
  previewStatus:PreviewOptionReviewStatus|"pending";
};

const PREVIEW_SUPPORT=new Set(["exact","approximate","none"]);
const CONSTRUCTION_STATUS=new Set(["approved","rejected","pending","not_required"]);
const REVIEW_STATUS=new Set(["approved","rejected","pending"]);

/**
 * The operator coverage gate is a release signal, not just a UI counter.
 * Duplicate/malformed rows must never make a partial or corrupt option
 * catalogue appear fully approved. The input is typed in TS but arrives from
 * runtime catalogue/review data, so validate it independently.
 */
export function summarizePreviewOptionCoverage(rows:PreviewCoverageRow[]){
  const input=Array.isArray(rows)?rows:[];
  const seen=new Set<string>();
  const valid=input.map((row)=>{
    if(!row || typeof row!=="object") return false;
    const id=typeof row.id==="string"?row.id.trim():"";
    const isValid=Boolean(id) &&
      typeof row.styleKey==="string" && Boolean(row.styleKey.trim()) &&
      typeof row.label==="string" && Boolean(row.label.trim()) &&
      PREVIEW_SUPPORT.has(row.livePreview) &&
      CONSTRUCTION_STATUS.has(row.constructionStatus) &&
      REVIEW_STATUS.has(row.previewStatus) &&
      !seen.has(id);
    if(id) seen.add(id);
    return isValid;
  });
  const total=input.length;
  const invalidRows=valid.filter((value)=>!value).length;
  const previewApproved=input.filter((row)=>row?.previewStatus==="approved").length;
  const previewRejected=input.filter((row)=>row?.previewStatus==="rejected").length;
  const previewPending=input.filter((row)=>row?.previewStatus==="pending").length;
  const noPreviewSupport=input.filter((row)=>row?.livePreview==="none").length;
  const constructionBlocked=input.filter((row)=>row?.constructionStatus==="rejected").length;
  const constructionPending=input.filter((row)=>row?.constructionStatus==="pending").length;
  const fullyCleared=input.filter((row,index)=>
    valid[index] &&
    (row.livePreview==="exact"||row.livePreview==="approximate") &&
    row.previewStatus==="approved" &&
    (row.constructionStatus==="approved"||row.constructionStatus==="not_required")
  ).length;
  return {
    total,
    invalidRows,
    previewApproved,
    previewRejected,
    previewPending,
    noPreviewSupport,
    constructionBlocked,
    constructionPending,
    fullyCleared,
    coveragePercent:total?Math.round(fullyCleared/total*100):0,
    gateComplete:total>0&&invalidRows===0&&fullyCleared===total,
  };
}
