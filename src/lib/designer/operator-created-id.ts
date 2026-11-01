// A successful PostgREST response is not proof that a quote/order was
// created. PostgreSQL UUID-returning RPCs must yield one canonical UUID string.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireOperatorCreatedId(value:unknown):string {
  if(typeof value!=="string"||!UUID.test(value))
    throw new Error("Invalid production creation acknowledgement.");
  return value.toLowerCase();
}
