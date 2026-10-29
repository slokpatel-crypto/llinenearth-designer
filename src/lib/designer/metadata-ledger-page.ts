/** A truncated operator event history can hide an older sold-out veto.
 * PostgREST must return an exact count and every row for this bounded read.
 * Until a paginated reader exists, oversized histories fail closed.
 */
export const OPERATOR_METADATA_PAGE_LIMIT = 1000;

export function hasCompleteOperatorMetadataPage(rows: unknown, contentRange: string | null): rows is unknown[] {
  if (!Array.isArray(rows) || rows.length > OPERATOR_METADATA_PAGE_LIMIT) return false;
  if (rows.length === 0) return contentRange === "*/0";
  if (!contentRange) return false;
  const match = /^(\d+)-(\d+)\/(\d+)$/.exec(contentRange);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  return [start, end, total].every(Number.isSafeInteger)
    && start === 0 && end === rows.length - 1 && total === rows.length;
}


export type OperatorMetadataPageReceipt =
  | {status:"invalid";total:null}
  | {status:"continue"|"complete";total:number};

/** A full count and contiguous range must accompany EVERY page. This
 * rejects silent PostgREST server truncation, moving/contradictory totals,
 * offset gaps, and incomplete last pages. All pages share one time budget.
 */
export function verifyOperatorMetadataPage(
  rows:unknown,contentRange:string|null,offset:number,expectedTotal:number|null,
  pageSize:number=OPERATOR_METADATA_PAGE_LIMIT,
):OperatorMetadataPageReceipt {
  const invalid:OperatorMetadataPageReceipt={status:"invalid",total:null};
  if(!Array.isArray(rows)||!Number.isSafeInteger(offset)||offset<0||
    !Number.isSafeInteger(pageSize)||pageSize<1||rows.length>pageSize) return invalid;
  if(rows.length===0&&offset===0&&contentRange==="*/0"&&expectedTotal===null)
    return {status:"complete",total:0};
  if(rows.length===0||!contentRange) return invalid;
  const match=/^(\d+)-(\d+)\/(\d+)$/.exec(contentRange);
  if(!match) return invalid;
  const start=Number(match[1]),end=Number(match[2]),total=Number(match[3]);
  if(![start,end,total].every(Number.isSafeInteger)||start!==offset||
    end!==offset+rows.length-1||total<end+1||
    (expectedTotal!==null&&total!==expectedTotal)) return invalid;
  // A short page must be the exact last page. If it is shorter than the
  // requested limit while rows are still outstanding, evidence is partial.
  if(rows.length<pageSize&&total!==end+1) return invalid;
  return {status:total===end+1?"complete":"continue",total};
}
