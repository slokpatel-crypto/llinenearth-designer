export type PreviewOptionReviewStatus="approved"|"rejected";

export type PreviewCoverageRow={
  id:string;
  styleKey:string;
  label:string;
  livePreview:"exact"|"approximate"|"none";
  constructionStatus:"approved"|"rejected"|"pending"|"not_required";
  previewStatus:PreviewOptionReviewStatus|"pending";
};

/**
 * Every selectable style ID must appear exactly once. A partial response
 * with all its visible rows approved is NOT complete production coverage.
 */
export function summarizePreviewOptionCoverage(
  rows:PreviewCoverageRow[], expectedIds:readonly string[],
){
  const expected=new Set(expectedIds);
  const observed=new Set(rows.map((row)=>row.id));
  const duplicateOptionCount=rows.length-observed.size;
  const missingOptionCount=expectedIds.filter((id)=>!observed.has(id)).length;
  const unknownOptionCount=rows.filter((row)=>!expected.has(row.id)).length;
  const catalogueComplete=expectedIds.length>0
    && expected.size===expectedIds.length
    && duplicateOptionCount===0
    && missingOptionCount===0
    && unknownOptionCount===0;
  const total=rows.length;
  const previewApproved=rows.filter((row)=>row.previewStatus==="approved").length;
  const previewRejected=rows.filter((row)=>row.previewStatus==="rejected").length;
  const previewPending=rows.filter((row)=>row.previewStatus==="pending").length;
  const noPreviewSupport=rows.filter((row)=>row.livePreview==="none").length;
  const approximatePreview=rows.filter((row)=>row.livePreview==="approximate").length;
  const constructionBlocked=rows.filter((row)=>row.constructionStatus==="rejected").length;
  const constructionPending=rows.filter((row)=>row.constructionStatus==="pending").length;
  const fullyCleared=rows.filter((row)=>
    // Human approval cannot make an approximate drawing exact for launch.
    row.livePreview==="exact"
    && row.previewStatus==="approved"
    && (row.constructionStatus==="approved"||row.constructionStatus==="not_required")
  ).length;
  return {
    total,
    previewApproved,
    previewRejected,
    previewPending,
    noPreviewSupport,
    approximatePreview,
    catalogueComplete,
    missingOptionCount,
    duplicateOptionCount,
    unknownOptionCount,
    constructionBlocked,
    constructionPending,
    fullyCleared,
    coveragePercent:total?Math.round(fullyCleared/total*100):0,
    gateComplete:catalogueComplete&&total>0&&fullyCleared===total,
  };
}
