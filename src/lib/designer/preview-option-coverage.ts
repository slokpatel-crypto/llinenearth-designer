export type PreviewOptionReviewStatus="approved"|"rejected";

export type PreviewCoverageRow={
  id:string;
  styleKey:string;
  label:string;
  livePreview:"exact"|"approximate"|"none";
  constructionStatus:"approved"|"rejected"|"pending"|"not_required";
  previewStatus:PreviewOptionReviewStatus|"pending";
};

export function summarizePreviewOptionCoverage(rows:PreviewCoverageRow[]){
  const total=rows.length;
  const previewApproved=rows.filter((row)=>row.previewStatus==="approved").length;
  const previewRejected=rows.filter((row)=>row.previewStatus==="rejected").length;
  const previewPending=rows.filter((row)=>row.previewStatus==="pending").length;
  const noPreviewSupport=rows.filter((row)=>row.livePreview==="none").length;
  const constructionBlocked=rows.filter((row)=>row.constructionStatus==="rejected").length;
  const constructionPending=rows.filter((row)=>row.constructionStatus==="pending").length;
  const fullyCleared=rows.filter((row)=>
    row.livePreview!=="none"
    && row.previewStatus==="approved"
    && (row.constructionStatus==="approved"||row.constructionStatus==="not_required")
  ).length;
  return {
    total,
    previewApproved,
    previewRejected,
    previewPending,
    noPreviewSupport,
    constructionBlocked,
    constructionPending,
    fullyCleared,
    coveragePercent:total?Math.round(fullyCleared/total*100):0,
    gateComplete:total>0&&fullyCleared===total,
  };
}
