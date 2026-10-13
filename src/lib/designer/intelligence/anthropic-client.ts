export type ClaudeKnowledgeTask = "fabric" | "shirt" | "trouser" | "cross-garment" | "style-recipe" | "quality";

/** Server-only provider client. Never reveal or log the credential. */
export async function requestClaudeKnowledge(task: ClaudeKnowledgeTask): Promise<{text:string;model:string;inputTokens:number;outputTokens:number}> {
  const credential=process.env.ANTHROPIC_API_KEY;
  if (!credential) throw new Error("Provider credential not configured in this runtime");
  const prompts: Record<ClaudeKnowledgeTask,string>={
    fabric:"Propose linen cloth classification heuristics. Do not invent fiber percentages, pattern scale, GSM, drape, or stock.",
    shirt:"Propose shirt construction compatibility for collar, cuff, placket, fit and wear.",
    trouser:"Propose trouser construction compatibility for rise, pleats, fit and break.",
    "cross-garment":"Propose shirt-trouser cross-garment compatibility checks and exceptions.",
    "style-recipe":"Propose reusable linen outfit recipes for casual, smart casual and formal occasions.",
    quality:"Propose test fixtures for conflicting construction and absent supplier evidence."
  };
  const response=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"x-api-key":credential,"anthropic-version":"2023-06-01","content-type":"application/json"},
    body:JSON.stringify({
      model:process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens:2100,
      messages:[{role:"user",content:"Return only JSON with proposals array; each proposal has id, domain, claim, rationale, constraints string array, evidenceNeeded string array. All proposals are unverified. "+prompts[task]}]
    }),
    signal:AbortSignal.timeout(60000)
  });
  if(!response.ok) throw new Error("Claude provider returned HTTP "+response.status);
  const result=await response.json() as {model:string;usage:{input_tokens:number;output_tokens:number};content:Array<{type:string;text?:string}>};
  return {text:result.content.filter(item=>item.type==="text").map(item=>item.text||"").join(""),model:result.model,inputTokens:result.usage.input_tokens,outputTokens:result.usage.output_tokens};
}
