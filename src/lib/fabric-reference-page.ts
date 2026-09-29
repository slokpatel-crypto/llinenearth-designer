import "server-only";
import { FABRIC_REFERENCE_SOURCES } from "@/lib/fabric-analyzer-reference-index";

const TRUSTED_IMAGE_CDNS=new Set([
  "cdn.shopify.com",
  "cdn.shopifycdn.net",
  "images.ctfassets.net",
]);

function normalizedHost(value:string) {
  return value.toLowerCase().replace(/^www\./,"");
}

const SOURCE_HOSTS=new Set(
  FABRIC_REFERENCE_SOURCES
    .map((source)=>{
      try{return normalizedHost(new URL(source.url).hostname);}catch{return "";}
    })
    .filter(Boolean),
);

function isTrustedSourceHost(hostname:string) {
  const host=normalizedHost(hostname);
  for(const sourceHost of SOURCE_HOSTS) {
    if(host===sourceHost || host.endsWith(\`.${sourceHost}\`)) return true;
  }
  return false;
}

export function isTrustedFabricReferenceUrl(value:string) {
  try {
    const url=new URL(value);
    return url.protocol==="https:" && isTrustedSourceHost(url.hostname);
  } catch {
    return false;
  }
}

export function isTrustedFabricReferenceImageUrl(value:string,sourcePage?:string) {
  try {
    const url=new URL(value);
    if(url.protocol!=="https:") return false;
    if(isTrustedSourceHost(url.hostname)) return true;
    if(TRUSTED_IMAGE_CDNS.has(normalizedHost(url.hostname))) {
      return Boolean(sourcePage && isTrustedFabricReferenceUrl(sourcePage));
    }
    return false;
  } catch {
    return false;
  }
}

function decodeHtml(value:string) {
  return value
    .replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .replace(/\s+/g," ")
    .trim();
}

function meta(html:string,key:string,attribute:"property"|"name"="property") {
  const escaped=key.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
  const patterns=[
    new RegExp(\`<meta[^>]+${attribute}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>\`,"i"),
    new RegExp(\`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escaped}["'][^>]*>\`,"i"),
  ];
  for(const pattern of patterns) {
    const match=html.match(pattern);
    if(match?.[1]) return decodeHtml(match[1]).slice(0,1800);
  }
  return "";
}

function title(html:string) {
  const og=meta(html,"og:title");
  if(og) return og.slice(0,240);
  const match=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]).slice(0,240) : "";
}

function canonical(html:string,base:string) {
  const match=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  if(!match?.[1]) return base;
  try{return new URL(match[1],base).toString();}catch{return base;}
}

export type ResolvedFabricReferencePage = {
  pageUrl:string;
  canonicalUrl:string;
  sourceId:string|null;
  title:string;
  description:string;
  imageUrl:string|null;
};

export async function resolveFabricReferencePage(pageUrl:string):Promise<ResolvedFabricReferencePage> {
  if(!isTrustedFabricReferenceUrl(pageUrl)) throw new Error("Fabric reference page is not on the approved source registry.");

  const response=await fetch(pageUrl,{
    headers:{
      "user-agent":"LinenEarthFabricResearch/1.0 (+private textile reference tool)",
      accept:"text/html,application/xhtml+xml",
    },
    redirect:"follow",
    cache:"no-store",
    signal:AbortSignal.timeout(15_000),
  });
  if(!response.ok) throw new Error(\`Fabric reference page returned HTTP ${response.status}.\`);
  if(!isTrustedFabricReferenceUrl(response.url)) throw new Error("Fabric reference page redirected outside the approved source registry.");

  const contentType=response.headers.get("content-type") || "";
  if(!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("Fabric reference source is not an HTML page.");
  const length=Number(response.headers.get("content-length") || 0);
  if(length>3_000_000) throw new Error("Fabric reference page is too large to inspect safely.");

  const html=(await response.text()).slice(0,3_000_000);
  const imageCandidate=meta(html,"og:image") || meta(html,"twitter:image","name");
  let imageUrl:string|null=null;
  if(imageCandidate) {
    try {
      const resolved=new URL(imageCandidate,response.url).toString();
      if(isTrustedFabricReferenceImageUrl(resolved,response.url)) imageUrl=resolved;
    } catch {}
  }

  const host=normalizedHost(new URL(response.url).hostname);
  const source=FABRIC_REFERENCE_SOURCES.find((item)=>{
    try {
      const sourceHost=normalizedHost(new URL(item.url).hostname);
      return host===sourceHost || host.endsWith(\`.${sourceHost}\`);
    } catch {
      return false;
    }
  });

  return {
    pageUrl:response.url,
    canonicalUrl:canonical(html,response.url),
    sourceId:source?.id || null,
    title:title(html),
    description:(meta(html,"og:description") || meta(html,"description","name")).slice(0,1000),
    imageUrl,
  };
}
