export function nextUnlabelledBenchmarkIndex(
  caseIds:string[],
  labelledCaseIds:Iterable<string>,
  currentIndex:number,
):number|null{
  if(!caseIds.length) return null;
  const labelled=new Set([...labelledCaseIds].map((id)=>String(id||"").trim()).filter(Boolean));
  const start=Math.max(0,Math.min(caseIds.length-1,Math.floor(currentIndex)||0));

  for(let offset=1;offset<=caseIds.length;offset++){
    const index=(start+offset)%caseIds.length;
    if(!labelled.has(caseIds[index])) return index;
  }
  return null;
}
