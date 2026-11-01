// Only explicitly authored operator validation messages may reach a client.
// Database, parser, framework, network and unexpected error text is untrusted.
const OPERATOR_SAFE_ERRORS = new Set([
  "Production backend is not configured.",
  "A valid locked-design recovery token is required.",
  "The locked design could not be verified for production.",
  "Invalid quote currency.",
  "Quote must contain 1 to 30 line items.",
  "Quote line item label is required.",
  "Invalid quote line item amount.",
  "Invalid quote adjustment.",
  "Quote total cannot be negative.",
]);

export function publicOperatorPostError(error:unknown):string {
  if(error instanceof Error && OPERATOR_SAFE_ERRORS.has(error.message))
    return error.message;
  return "Production operation failed.";
}
