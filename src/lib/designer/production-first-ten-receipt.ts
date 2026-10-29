import { validProductionFirstTenAuditBasis } from "./production-delivery-evidence.ts";

/**
 * Distinguish an installed first-ten audit returning a genuine incomplete
 * history from a broken or forged 200 RPC receipt. Neither grants release.
 */
export function verifiedFirstTenAuditReceipt(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new Error("Malformed first-ten delivery audit receipt.");
  const basis=value as Record<string,unknown>;
  if(basis.version!=="linen-earth-production-first-ten-audit-v2"
    ||typeof basis.historyValid!=="boolean"
    ||!Array.isArray(basis.orders)||basis.orders.length>10
    ||!Array.isArray(basis.evidence)
    ||!basis.orders.every((row:unknown)=>row!==null&&typeof row==="object"&&!Array.isArray(row))
    ||!basis.evidence.every((row:unknown)=>row!==null&&typeof row==="object"&&!Array.isArray(row))
    ||(basis.historyValid===true&&!validProductionFirstTenAuditBasis(basis)))
    throw new Error("Malformed first-ten delivery audit receipt.");
  return basis;
}
