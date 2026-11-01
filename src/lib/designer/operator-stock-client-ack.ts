// HTTP 200 alone is not evidence that a physical stock mutation completed.
// Validate the exact operator action's acknowledgment before success UI.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type StockAction="record"|"reserve"|"release"|"consume";
export function requireStockClientAcknowledgment(action:unknown,value:unknown):void{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new Error("Stock response could not be verified; check ledger before retrying.");
  const result=value as Record<string,unknown>;
  if(action==="record"||action==="reserve"){
    const id=result[action==="record"?"eventId":"reservationId"];
    if(typeof id==="string"&&UUID.test(id))return;
  }else if(action==="release"||action==="consume"){
    if(result[action==="release"?"released":"consumed"]===true)return;
  }
  throw new Error("Stock response could not be verified; check ledger before retrying.");
}
