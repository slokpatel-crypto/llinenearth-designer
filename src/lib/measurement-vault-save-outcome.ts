/** Server storage success must be reported separately from browser cache writes. */
export function describeMeasurementVaultSaveOutcome(input:{
  localSaved:boolean;tokenCopied:boolean;expiresInDays?:number;
}):string{
  const expiry=Number.isFinite(input.expiresInDays)&&Number(input.expiresInDays)>0
    ?`Expires in ${input.expiresInDays} days.`:"";
  if(!input.localSaved) {
    return input.tokenCopied
      ?`Secure copy saved on the server, but browser storage failed. Recovery token copied; keep it safe. ${expiry}`.trim()
      :`Secure copy saved on the server, but browser storage failed. Copy the recovery token shown here; it is required to retrieve or delete this copy. ${expiry}`.trim();
  }
  return input.tokenCopied
    ?`Recovery token copied. Secure copy saved. ${expiry}`.trim()
    :`Secure copy saved. Copy the recovery token shown here and keep it private. ${expiry}`.trim();
}
