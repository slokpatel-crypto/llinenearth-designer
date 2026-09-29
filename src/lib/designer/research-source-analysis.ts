import type { CreativeResearchSignal } from "@/lib/designer/creative-research";

export type ResearchSourceAnalysisInput = {
  name:string;
  url:string;
  sourceType:CreativeResearchSignal["sourceType"];
};

export type ResearchSourceAnalysisResult = Omit<CreativeResearchSignal,"id"|"active"|"createdAt">;

const MAX_SOURCE_TEXT=18_000;

function gatewayToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "";
}

function gatewayModels() {
  const configured=(process.env.LINEN_RESEARCH_MODEL || "").trim();
  return [...new Set([
    ...(configured?[configured]:[]),
    "openai/gpt-5.4",
    "google/gemini-3-flash",
  ])].slice(0,2);
}

function isPrivateIpv4(host:string) {
  const parts=host.split(".").map(Number);
  if(parts.length!==4 || parts.some((part)=>!Number.isInteger(part)||part<0||part>255)) return false;
  return parts[0]===10 ||
    parts[0]===127 ||
    (parts[0]===169 && parts[1]===254) ||
    (parts[0]===172 && parts[1]>=16 && parts[1]<=31) ||
    (parts[0]===192 && parts[1]===168) ||
    parts[0]===0;
}

function safePublicUrl(value:string) {
  const url=new URL(value);
  if(!["http:","https:"].includes(url.protocol)) throw new Error("Only public HTTP(S) research URLs are allowed.");
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if(!host || host==="localhost" || host.endsWith(".local") || host.endsWith(".internal") || host==="::1" || host.startsWith("[") || isPrivateIpv4(host)) {
    throw new Error("Private or local research URLs are not allowed.");
  }
  url.username=""; url.password=""; url.hash="";
  return url;
}

async function fetchPublicHtml(input:string) {
  let url=safePublicUrl(input);
  for(let hop=0;hop<4;hop+=1) {
    const response=await fetch(url,{
      headers:{
        accept:"text/html,application/xhtml+xml;q=0.9,text/plain;q=0.7",
        "user-agent":"LinenEarthDesignerResearch/1.0",
      },
      redirect:"manual",
      cache:"no-store",
      signal:AbortSignal.timeout(9_000),
    });
    if([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get("location");
      if(!location) throw new Error("Research source redirected without a location.");
      url=safePublicUrl(new URL(location,url).toString());
      continue;
    }
    if(!response.ok) throw new Error(`Research source returned ${response.status}.`);
    const type=response.headers.get("content-type")||"";
    if(!/text\/html|application\/xhtml\+xml|text\/plain/i.test(type)) throw new Error("Research source did not return readable page text.");
    const html=(await response.text()).slice(0,500_000);
    return {html,url:url.toString()};
  }
  throw new Error("Research source redirected too many times.");
}

function decodeEntities(text:string) {
  return text
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,value)=>String.fromCodePoint(Number(value)||32));
}

function readablePageText(html:string) {
  const title=decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/\s+/g," ").trim();
  const description=decodeEntities(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ||
    ""
  ).replace(/\s+/g," ").trim();
  const body=decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi," ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi," ")
      .replace(/<[^>]+>/g," ")
  ).replace(/\s+/g," ").trim();
  return [title,description,body].filter(Boolean).join("\n").slice(0,MAX_SOURCE_TEXT);
}

function outputText(payload:unknown) {
  if(!payload || typeof payload!=="object") return "";
  const value=payload as Record<string,unknown>;
  if(typeof value.output_text==="string") return value.output_text;
  const output=Array.isArray(value.output)?value.output:[];
  for(const item of output) {
    if(!item || typeof item!=="object") continue;
    const content=Array.isArray((item as Record<string,unknown>).content)?(item as Record<string,unknown>).content as unknown[]:[];
    for(const part of content) {
      if(part && typeof part==="object" && typeof (part as Record<string,unknown>).text==="string") return String((part as Record<string,unknown>).text);
    }
  }
  return "";
}

const schema={
  type:"object",
  properties:{
    title:{type:"string",maxLength:160},
    principle:{type:"string",maxLength:600},
    transformedIdea:{type:"string",maxLength:600},
    zone:{type:"string",enum:["collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"]},
    secondaryZone:{type:"string",enum:["","collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"]},
    treatmentLabel:{type:"string",maxLength:120},
    treatmentInstruction:{type:"string",maxLength:600},
    visualPurpose:{type:"string",maxLength:420},
    intensity:{type:"integer",minimum:1,maximum:100},
    buildability:{type:"string",enum:["supported","atelier","experimental"]},
    patternFamily:{type:"string",enum:["none","stripe","geometric","border","tonal","placement"]},
    patternName:{type:"string",maxLength:120},
    patternLayout:{type:"string",maxLength:600},
    patternPlacement:{type:"string",maxLength:360},
    patternScale:{type:"string",enum:["micro","fine","medium"]},
    patternCoverage:{type:"integer",minimum:0,maximum:60},
    note:{type:"string",maxLength:420},
  },
  required:["title","principle","transformedIdea","zone","secondaryZone","treatmentLabel","treatmentInstruction","visualPurpose","intensity","buildability","patternFamily","patternName","patternLayout","patternPlacement","patternScale","patternCoverage","note"],
  additionalProperties:false,
} as const;

export async function analyzeFashionResearchSource(input:ResearchSourceAnalysisInput):Promise<ResearchSourceAnalysisResult> {
  const token=gatewayToken();
  if(!token) throw new Error("AI Gateway is not configured for research synthesis.");
  const fetched=await fetchPublicHtml(input.url);
  const pageText=readablePageText(fetched.html);
  if(pageText.length<120) throw new Error("Research source did not expose enough readable text to analyze.");

  const prompt=[
    "You are the research translator for an experimental menswear design engine.",
    "Extract ONE transferable visual or construction principle from the supplied source page.",
    "Do not copy a finished garment, trademark detail, collection look, marketing phrase, or distinctive combination from the source.",
    "Translate the principle into a materially different Linen Earth design hypothesis that can mutate further.",
    "Prefer silhouette, proportion, geometry, placement, rhythm, surface structure, fastening, pocket, collar, cuff, pleat, or trouser-volume mechanisms over generic trend summaries.",
    "Unconventional ideas are allowed. Buildability is diagnostic, not a reason to make the idea safe.",
    "If the page contains little actual design information, state that in note and make the principle conservative rather than inventing source facts.",
    `Source name: ${input.name}`,
    `Source URL: ${fetched.url}`,
    `Source role: ${input.sourceType}`,
    "SOURCE PAGE TEXT:",
    pageText,
  ].join("\n");

  for(const model of gatewayModels()) {
    try {
      const response=await fetch("https://ai-gateway.vercel.sh/v1/responses",{
        method:"POST",
        headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
        body:JSON.stringify({
          model,
          input:[{role:"user",content:[{type:"input_text",text:prompt}]}],
          text:{format:{type:"json_schema",name:"linen_research_signal",strict:true,schema}},
        }),
        cache:"no-store",
        signal:AbortSignal.timeout(16_000),
      });
      if(!response.ok) continue;
      const raw=await response.json() as unknown;
      const text=outputText(raw);
      if(!text) continue;
      const parsed=JSON.parse(text) as Omit<CreativeResearchSignal,"id"|"sourceUrl"|"sourceType"|"active"|"createdAt">;
      return {
        ...parsed,
        sourceUrl:fetched.url,
        sourceType:input.sourceType,
        secondaryZone:parsed.secondaryZone || undefined,
        patternName:parsed.patternName || undefined,
        patternLayout:parsed.patternLayout || undefined,
        patternPlacement:parsed.patternPlacement || undefined,
      };
    } catch {
      // One fallback model is allowed before the source is returned for manual analysis.
    }
  }
  throw new Error("Research synthesis could not produce a reliable structured principle.");
}


export type BatchResearchAnalysis = {
  source:ResearchSourceAnalysisInput;
  analysis?:ResearchSourceAnalysisResult;
  error?:string;
};

export async function analyzeFashionResearchBatch(
  inputs:ResearchSourceAnalysisInput[],
  limit=4,
):Promise<BatchResearchAnalysis[]> {
  const selected=inputs
    .filter((item,index,array)=>array.findIndex((candidate)=>candidate.url===item.url)===index)
    .slice(0,Math.max(1,Math.min(4,Math.round(limit))));
  const settled=await Promise.allSettled(selected.map((input)=>analyzeFashionResearchSource(input)));
  return settled.map((result,index)=>result.status==="fulfilled"
    ? {source:selected[index],analysis:result.value}
    : {source:selected[index],error:result.reason instanceof Error?result.reason.message:"Research synthesis failed."}
  );
}
