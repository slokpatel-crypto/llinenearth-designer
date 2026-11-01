// Operator screens must never claim a status change when the RPC explicitly
// returned false (missing record) or an unexpected success envelope.
export function requireOperatorClientMutationAck(action:unknown,value:unknown):void {
  if(action!=="quote_status"&&action!=="order_status")return;
  if(!value||typeof value!=="object"||Array.isArray(value)||
     (value as {updated?:unknown}).updated!==true)
    throw new Error("Production status was not updated. Refresh and verify the record.");
}
