import "server-only";
export type ClaudeKnowledgeTask = "fabric" | "shirt" | "trouser" | "cross-garment" | "style-recipe" | "quality";

/** Bounded server-only Anthropic integration; callers MUST authenticate and claim spend before invoking. */
export async function requestClaudeKnowledge(task: ClaudeKnowledgeTask):Promise<{text:string;model:string;inputTokens:number;outputTokens:number}> {
  const credential=process.env.ANTHROPIC_API_KEY;
  if(!credential) throw Error("Provider credential not configured in this runtime");
  const prompts:Record<ClaudeKnowledgeTask,string>={
    fabric:"Give 8 practical linen fabric taxonomy/visual evidence rules for plain, print, blend, formal shirting and suiting, including unknown physical details.",
    shirt:"Give 8 tailoring compatibility proposals for collars, cuffs, sleeves, plackets, shirt fit and tucking, with actionable constraints.",
    trouser:"Give 8 tailoring compatibility proposals for rise, waistband, pleats, leg silhouette, hem/break and drape evidence.",
    "cross-garment":"Give 8 shirt/trouser proportion and compatibility proposals for occasion, climate, tuck and pattern collisions.",
    "style-recipe":"Give 8 outfit recipes covering India office, summer resort, wedding, dinner and smart-casual linen styling; stock is unknown.",
    quality:"Give 8 edge-case fashion rule evaluation proposals including contradictory garments and absent supplier evidence."
  };
  const domainSchema={
    type:"object",additionalProperties:false,
    properties:{proposals:{type:"array",items:{type:"object",additionalProperties:false,
      properties:{
        id:{type:"string"},domain:{type:"string",enum:[task]},claim:{type:"string"},
        rationale:{type:"string"},constraints:{type:"array",items:{type:"string"}},
        evidenceNeeded:{type:"array",items:{type:"string"}}
      },required:["id","domain","claim","rationale","constraints","evidenceNeeded"]
    }}},required:["proposals"]
  };
  const response=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"x-api-key":credential,"anthropic-version":"2023-06-01","content-type":"application/json"},
    body:JSON.stringify({
      model:process.env.ANTHROPIC_MODEL||"claude-haiku-4-5-20251001",
      max_tokens:4200,
      output_config:{format:{type:"json_schema",schema:domainSchema}},
      system:"You are a linen menswear construction specialist. Generate actionable preliminary proposals. Never fabricate real supplier measurements, stock, physical drape, body identity, or owner/tailor approval. Each proposal id must be unique lowercase kebab-case, at least three characters. Keep descriptions concise and reviewable.",
      messages:[{role:"user",content:prompts[task]}]
    }),
    signal:AbortSignal.timeout(50000)
  });
  if(!response.ok) throw Error("Claude API request failed with HTTP "+response.status);
  const data=await response.json() as {
    model:string;stop_reason:string;usage:{input_tokens:number;output_tokens:number};
    content:Array<{type:string;text?:string}>;
  };
  if(data.stop_reason!=="end_turn") throw Error("Claude output did not finish successfully");
  const text=data.content.filter(item=>item.type==="text").map(item=>item.text||"").join("");
  if(text.length>350_000) throw Error("Provider response exceeded bounded output limit");
  return {text,model:data.model,inputTokens:data.usage.input_tokens,outputTokens:data.usage.output_tokens};
}
