// A generated image can replace the instant photographic preview only after
// a complete, available check agrees that every fidelity dimension passes.
// Minor natural drape/artifacts remain allowed by the existing QA contract.
export function selectedLookQaPassed(check:unknown):boolean {
  if(!check || typeof check!=="object") return false;
  const value=check as Record<string,unknown>;
  return value.available===true && value.status==="pass"
    && ["fabricFidelity","colorFidelity","patternFidelity","boundary","construction","mannequinConsistency"].every((key)=>value[key]==="strong")
    && (value.artifact==="none" || value.artifact==="minor");
}
