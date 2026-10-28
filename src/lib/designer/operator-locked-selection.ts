/** 
 * Strict input boundary for creating a quote/order against the same signed
 * garment recipe. Never stringify arrays or silently truncate user selections.
 * The actual recovered revision must still pass independent SHA-256 validation.
 */
export type OperatorLockedSelection={
  revisionId:string;recipeHash:string;recoveryToken:string;note:string;quoteId:string|null;
};

export function parseOperatorLockedSelection(input:Record<string,unknown>):OperatorLockedSelection|null{
  if(typeof input.revisionId!=="string"||typeof input.recipeHash!=="string"
    ||typeof input.recoveryToken!=="string")return null;
  const revisionId=input.revisionId.trim();
  const recipeHash=input.recipeHash.trim().toLowerCase();
  const recoveryToken=input.recoveryToken.trim();
  if(revisionId.length<12||revisionId.length>180
    ||!/^[a-f0-9]{64}$/.test(recipeHash)
    ||recoveryToken.length<8||recoveryToken.length>4096) return null;
  if(input.note!==undefined&&input.note!==null&&typeof input.note!=="string")return null;
  const note=typeof input.note==="string"?input.note.trim():"";
  if(note.length>1000)return null;
  if(input.quoteId!==undefined&&input.quoteId!==null&&typeof input.quoteId!=="string")return null;
  const quoteId=typeof input.quoteId==="string"?input.quoteId.trim():"";
  if(quoteId.length>180)return null;
  return {revisionId,recipeHash,recoveryToken,note,quoteId:quoteId||null};
}
