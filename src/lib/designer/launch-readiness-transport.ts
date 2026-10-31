/** Operator-only launch release evidence transport.
 * Never forward unrecognized PostgREST columns, even if an upstream SQL
 * function changes. This is a disclosure and memory bound, NOT proof that
 * a human beta reviewer or physical delivery actually signed off. */
const BETA_STRING_LIMITS={
  attempt_id:64,case_id:80,device_class:24,note:1200,revision_id:180,
  recipe_hash:128,evidence_kind:24,created_at:64,
} as const;
const BETA_BOOLEAN_KEYS=[
  "core_flow_completed","design_locked","share_or_enquiry_completed",
  "blocking_bug","share_audit_confirmed","enquiry_audit_confirmed",
] as const;
const CHECKLIST_STRING_LIMITS={
  event_id:64,item_id:80,status:24,signed_by:120,note:1200,created_at:64,
} as const;

type SafeEvidenceRow=Record<string,string|boolean|null>;

function plainObject(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}
function boundedString(value:unknown,max:number):string|null{
  if(value===null||value===undefined)return null;
  if(typeof value!=="string"||value.length>max)
    throw new Error("Invalid operator launch evidence field.");
  return value;
}
function boundedBoolean(value:unknown):boolean|null{
  if(value===null||value===undefined)return null;
  if(typeof value!=="boolean")
    throw new Error("Invalid operator launch evidence boolean.");
  return value;
}
function allowlist(
  row:Record<string,unknown>,
  limits:Record<string,number>,
  booleans:readonly string[],
):SafeEvidenceRow{
  const result:SafeEvidenceRow={};
  for(const [key,max] of Object.entries(limits)){
    result[key]=boundedString(row[key],max);
  }
  for(const key of booleans)result[key]=boundedBoolean(row[key]);
  return result;
}
/** A corrupt or excessive SQL reply fails the entire read closed; never
 * silently discard a bad newer beta attempt that would invalidate success. */
export function safeLaunchReadinessRows(
  source:unknown,kind:"beta"|"checklist",
):SafeEvidenceRow[]{
  if(!Array.isArray(source)||source.length>500)
    throw new Error("Invalid or oversized operator launch evidence list.");
  return source.map(row=>{
    if(!plainObject(row))throw new Error("Invalid operator launch evidence row.");
    return kind==="beta"
      ?allowlist(row,BETA_STRING_LIMITS,BETA_BOOLEAN_KEYS)
      :allowlist(row,CHECKLIST_STRING_LIMITS,[]);
  });
}
