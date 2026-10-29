/** A full PostgREST page may hide an older sold-out override.
 * Completion is established only by a short final page. Fail closed on
 * malformed/oversized pages instead of labelling partial history healthy.
 */
export type MetadataPageDisposition="invalid"|"continue"|"complete";

export function metadataPageDisposition(rows:unknown,pageSize:number):MetadataPageDisposition{
  if(!Number.isSafeInteger(pageSize)||pageSize<1||!Array.isArray(rows)||rows.length>pageSize)
    return "invalid";
  return rows.length===pageSize?"continue":"complete";
}
