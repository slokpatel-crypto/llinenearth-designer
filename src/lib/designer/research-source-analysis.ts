import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
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
    (parts[0]===100 && parts[1]>=64 && parts[1]<=127) ||
    parts[0]===0 ||
    parts[0]>=224;
}

function isPrivateIpv6(address:string) {
  const host=address.toLowerCase().replace(/^\[|\]$/g,"");
  if(host==="::1" || host==="::") return true;
  if(host.startsWith("fc") || host.startsWith("fd")) return true; // fc00::/7
  if(/^fe[89ab]/.test(host)) return true; // fe80::/10 link-local
  if(host.startsWith("::ffff:")) return isPrivateIpv4(host.slice(7));
  return false;
}

function isPrivateAddress(address:string) {
  const version=isIP(address);
  return version===4 ? isPrivateIpv4(address) : version===6 ? isPrivateIpv6(address) : false;
}

function safePublicUrl(value:string) {
  const url=new URL(value);
  if(!["http:","https:"].includes(url.protocol)) throw new Error("Only public HTTP(S) research URLs are allowed.");
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if(!host || host==="localhost" || host.endsWith(".local") || host.endsWith(".internal") || isPrivateAddress(host)) {
    throw new Error("Private or local research URLs are not allowed.");
  }
  url.username=""; url.password=""; url.hash="";
  return url;
}

type PublicAddress={address:string;family:4|6};

async function resolvePublicAddress(url:URL):Promise<PublicAddress> {
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if(isIP(host)) {
    if(isPrivateAddress(host)) throw new Error("Private or local research URLs are not allowed.");
    return {address:host,family:isIP(host) as 4|6};
  }
  const addresses=await lookup(host,{all:true,verbatim:true});
  if(!addresses.length) throw new Error("Research source hostname could not be resolved.");
  if(addresses.some((entry)=>isPrivateAddress(entry.address))) {
    throw new Error("Research source resolves to a private or local network address.");
  }
  const selected=addresses.find((entry)=>entry.family===4) || addresses[0];
  return {address:selected.address,family:selected.family as 4|6};
}

function pinnedPageRequest(url:URL,target:PublicAddress,timeout=9000) {
  return new Promise<{status:number;headers:Record<string,string|string[]|undefined>;body:string}>((resolve,reject)=>{
    const secure=url.protocol==="https:";
    const request=secure?httpsRequest:httpRequest;
    const defaultPort=secure?"443":"80";
    const port=url.port || defaultPort;
    const hostHeader=port===defaultPort?url.hostname:`${url.hostname}:${port}`;
    const req=request({
      protocol:url.protocol,
      hostname:target.address,
      family:target.family,
      port,
      method:"GET",
      path:`${url.pathname || "/"}${url.search}`,
      servername:secure?url.hostname:undefined,
      headers:{
        host:hostHeader,
        accept:"text/html,application/xhtml+xml;q=0.9,text/plain;q=0.7",
        "user-agent":"LinenEarthDesignerResearch/1.0",
        connection:"close",
      },
      timeout,
    },(response)=>{
      const chunks:Buffer[]=[];
      let bytes=0;
      response.on("data",(chunk:Buffer|string)=>{
        const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
        bytes+=buffer.length;
        if(bytes<=520_000) chunks.push(buffer);
        else response.destroy(new Error("Research source response exceeded the safe analysis limit."));
      });
      response.on("end",()=>{
        const headers=Object.fromEntries(Object.entries(response.headers).map(([key,value])=>[key,value]));
        resolve({status:response.statusCode || 0,headers,body:Buffer.concat(chunks).toString("utf8").slice(0,500_000)});
      });
    });
    req.on("timeout",()=>req.destroy(new Error("Research source request timed out.")));
    req.on("error",reject);
    req.end();
  });
}

async function fetchPublicHtml(input:string,budgetMs=36000) {
  const deadline=Date.now()+budgetMs;
  let url=safePublicUrl(input);
  for(let hop=0;hop<4;hop+=1) {
    const target=await resolvePublicAddress(url);
    const remaining=deadline-Date.now();
    if(remaining<=0)throw new Error("Research source fetch budget exceeded.");
    const response=await pinnedPageRequest(url,target,Math.min(9000,remaining));
    if([301,302,303,307,308].includes(response.status)) {
      const rawLocation=response.headers.location;
      const location=Array.isArray(rawLocation)?rawLocation[0]:rawLocation;
      if(!location) throw new Error("Research source redirected without a location.");
      url=safePublicUrl(new URL(location,url).toString());
      continue;
    }
    if(response.status<200 || response.status>=300) throw new Error(`Research source returned ${response.status}.`);
    const rawType=response.headers["content-type"];
    const type=Array.isArray(rawType)?rawType[0]||"":rawType||"";
    if(!/text\/html|application\/xhtml\+xml|text\/plain/i.test(type)) throw new Error("Research source did not return readable page text.");
    return {html:response.body,url:url.toString()};
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
  limit=8,
):Promise<BatchResearchAnalysis[]> {
  const selected=inputs
    .filter((item,index,array)=>array.findIndex((candidate)=>candidate.url===item.url)===index)
    .slice(0,Math.max(1,Math.min(8,Math.round(limit))));
  const output:BatchResearchAnalysis[]=[];
  // Analyze in small waves so broader research does not become a burst of
  // simultaneous page fetches + model calls.
  for(let offset=0;offset<selected.length;offset+=4) {
    const wave=selected.slice(offset,offset+4);
    const settled=await Promise.allSettled(wave.map((input)=>analyzeFashionResearchSource(input)));
    settled.forEach((result,index)=>{
      output.push(result.status==="fulfilled"
        ? {source:wave[index],analysis:result.value}
        : {source:wave[index],error:result.reason instanceof Error?result.reason.message:"Research synthesis failed."}
      );
    });
  }
  return output;
}

/** Safe text-only collection; no Gateway token or model call. */
export async function collectFashionResearchPage(url:string){
  const page=await fetchPublicHtml(url,22000),text=readablePageText(page.html);
  if(text.length<120)throw new Error("Source has too little readable text; review it manually.");
  return {url:page.url,text};
}
