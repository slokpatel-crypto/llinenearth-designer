// PostgREST scalar-boolean status RPCs return JSON true or false.
// Never coerce an unexpected success body (such as "false", {}, or [])
// into a positive operator acknowledgment.
export function requireOperatorStatusAcknowledgment(value:unknown):boolean {
  if(typeof value!=="boolean")
    throw new Error("Invalid operator status acknowledgement.");
  return value;
}
