/** Only these explicit HTTP responses are emitted before any production RPC
 * is attempted. Every other failed/missing/invalid response is ambiguous:
 * the database may already have committed a quote, order or status change.
 * Never treat a transport error, 409, 5xx or malformed receipt as proof that
 * retrying the write cannot create a duplicate. */
const CERTAIN_PREWRITE_REJECTIONS=new Set([400,401,403,413,429]);

export function isCertainProductionPrewriteRejection(status:unknown):boolean{
  return typeof status==="number"&&CERTAIN_PREWRITE_REJECTIONS.has(status);
}
