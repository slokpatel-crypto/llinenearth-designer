/** Route error diagnostics may include a confidential supplier, customer
 * phone, recovery token, SQL query, pricing details or internal URL. Only
 * closed diagnostic categories may enter server logs. Never stringify errors,
 * use their message, stack, cause, arbitrary fields or user-supplied names. */
export function safeOperatorProductionErrorCode(error:unknown):string{
  if(!(error instanceof Error))return "unknown_error";
  // Compare against a closed set, never return Error.name itself.
  if(error.name==="AbortError"||error.name==="TimeoutError")return "backend_timeout";
  if(error.name==="SyntaxError")return "malformed_response";
  if(error.name==="TypeError")return "backend_transport";
  return "production_integrity_failure";
}
