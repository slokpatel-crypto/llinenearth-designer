/** Pure customer-account RPC shape contract: no private Supabase data can be
 * displayed as an account history or recorded success without a valid ack. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireOwnedProductionRows(value:unknown,maxRows:number):Record<string,unknown>[]{
  if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>300||
    !Array.isArray(value)||value.length>maxRows||
    value.some(row=>!row||typeof row!=="object"||Array.isArray(row)))
    throw new Error("Invalid customer account history response.");
  return value as Record<string,unknown>[];
}

export function requireCustomerOutcomeId(value:unknown):string{
  if(typeof value!=="string"||!UUID.test(value))
    throw new Error("Invalid customer outcome creation acknowledgment.");
  return value.toLowerCase();
}
