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

/** A matching total and Content-Range cannot detect repeated/shifted rows
 * between offset pages. Verify the actual ordered identity boundary too.
 * PostgREST returns canonical timestamps/IDs for the at.desc,id.desc query.
 * This is a fail-closed consistency guard, not an atomic database snapshot.
 */
export type OperatorMetadataRowCursor={at:string;id:string};
export function verifyOperatorMetadataRowSequence(
  rows:unknown[],previous:OperatorMetadataRowCursor|null,
):OperatorMetadataRowCursor|null {
  let last=previous;
  for(const raw of rows){
    if(!raw||typeof raw!=="object"||Array.isArray(raw)) return null;
    const {at,id}=raw as Record<string,unknown>;
    if(typeof at!=="string"||typeof id!=="string"||
       !/^\d{4}-\d{2}-\d{2}T/.test(at)||!Number.isFinite(Date.parse(at))||
       !id||id!==id.trim()) return null;
    // Descending timestamp, with descending stable ID for timestamp ties.
    // A duplicate across pages, offset shift or out-of-order row fails closed.
    if(last&&(at>last.at||(at===last.at&&id>=last.id))) return null;
    last={at,id};
  }
  return last;
}


/** The newest operator metadata event must not shadow an older sold-out veto
 * through JSON coercion (e.g. availability:["available"]) or a padded ID.
 * Unrelated operator notes and retired catalogue IDs are not availability
 * instructions. A malformed current-catalogue instruction is an outage,
 * never a verified absence of an operator veto.
 */
export function validateOperatorMetadataAvailability(
  payload:unknown,knownFabricIds:ReadonlySet<string>,
):"unrelated"|"valid"|"invalid" {
  if(!payload||typeof payload!=="object"||Array.isArray(payload)) return "unrelated";
  const {subtype,fabricId,availability}=payload as Record<string,unknown>;
  if(subtype!=="designer_fabric_metadata"){
    // A one-element array must not be coerced into the metadata subtype.
    if(Array.isArray(subtype)&&subtype.length===1&&subtype[0]==="designer_fabric_metadata")
      return "invalid";
    return "unrelated";
  }
  if(typeof fabricId!=="string"||!fabricId||fabricId!==fabricId.trim()) return "invalid";
  if(!knownFabricIds.has(fabricId)) return "unrelated";
  if(availability!=="unknown"&&availability!=="available"&&availability!=="unavailable")
    return "invalid";
  return "valid";
}


/** Operator physical measurements must retain their JSON types. Number()
 * accepts ["145"], "145" and other values that are not measured GSM.
 */
export function literalOperatorPhysicalNumber(value:unknown,min:number,max:number):number|null {
  return typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
}

export function literalOperatorPhysicalEnum<T extends string>(
  value:unknown,allowed:readonly T[],
):T|null {
  return typeof value==="string"&&allowed.includes(value as T)?value as T:null;
}
