export type RenderOutcomeMetricInput={
  credits_used:number;
  cached:boolean;
  human_status:"pending"|"approved"|"rejected";
  qa_status:"pass"|"review"|null;
};

export function summarizeRenderOutcomes(rows:RenderOutcomeMetricInput[]){
  const generated=rows.filter((row)=>!row.cached);
  const reviewed=rows.filter((row)=>row.human_status!=="pending");
  const approved=rows.filter((row)=>row.human_status==="approved");
  const rejected=rows.filter((row)=>row.human_status==="rejected");
  const qaPass=rows.filter((row)=>row.qa_status==="pass");
  const totalCredits=generated.reduce((sum,row)=>sum+Math.max(0,Number(row.credits_used)||0),0);
  const approvalRate=reviewed.length?approved.length/reviewed.length:null;
  const creditsPerApproved=approved.length?totalCredits/approved.length:null;
  return {
    total:rows.length,
    generated:generated.length,
    cached:rows.length-generated.length,
    reviewed:reviewed.length,
    pending:rows.length-reviewed.length,
    approved:approved.length,
    rejected:rejected.length,
    qaPass:qaPass.length,
    totalCredits:Math.round(totalCredits*10000)/10000,
    approvalRate:approvalRate===null?null:Math.round(approvalRate*1000)/10,
    creditsPerApproved:creditsPerApproved===null?null:Math.round(creditsPerApproved*10000)/10000,
  };
}
