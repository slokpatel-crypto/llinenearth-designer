import type { FashionResearchSource } from "@/lib/designer/fashion-research-source-pool";

export type DiscoveredFashionWebsite = {
  id:string;
  name:string;
  baseUrl:string;
  category:FashionResearchSource["category"];
  authority:FashionResearchSource["authority"];
  wikidataId:string;
  domain:string;
  discovery:"wikidata-fashion-house"|"wikidata-clothing-industry"|"wikidata-textile-industry";
};

type Binding={
  item?:{value?:string};
  itemLabel?:{value?:string};
  website?:{value?:string};
  route?:{value?:string};
};

type SparqlResponse={results?:{bindings?:Binding[]}};

const ENDPOINT="https://query.wikidata.org/sparql";

function safeHttpUrl(value:string) {
  try {
    const url=new URL(value);
    if(!["http:","https:"].includes(url.protocol)) return null;
    url.hash="";
    return url;
  } catch {
    return null;
  }
}

function canonicalDomain(url:URL) {
  return url.hostname.toLowerCase().replace(/^www\./,"");
}

function slug(value:string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
}

function categoryFor(route:string):DiscoveredFashionWebsite["category"] {
  return route==="textile" ? "materials" : "industry";
}

function authorityFor(route:string):DiscoveredFashionWebsite["authority"] {
  return route==="fashion-house" ? "industry" : "primary";
}

function discoveryFor(route:string):DiscoveredFashionWebsite["discovery"] {
  if(route==="fashion-house") return "wikidata-fashion-house";
  if(route==="textile") return "wikidata-textile-industry";
  return "wikidata-clothing-industry";
}

export function fashionWebsiteDiscoveryQuery(limit=1200) {
  const safeLimit=Math.max(50,Math.min(1500,Math.round(limit)));
  return `
SELECT DISTINCT ?item ?itemLabel ?website ?route WHERE {
  {
    ?item wdt:P31/wdt:P279* wd:Q3661311;
          wdt:P856 ?website.
    BIND("fashion-house" AS ?route)
  }
  UNION
  {
    ?item wdt:P452 wd:Q11828862;
          wdt:P856 ?website.
    BIND("clothing" AS ?route)
  }
  UNION
  {
    ?item wdt:P452 wd:Q607081;
          wdt:P856 ?website.
    BIND("textile" AS ?route)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${safeLimit}`.trim();
}

export async function discoverFashionWebsites(limit=1000):Promise<DiscoveredFashionWebsite[]> {
  const query=fashionWebsiteDiscoveryQuery(Math.max(limit+200,1200));
  const url=`${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response=await fetch(url,{
    headers:{
      accept:"application/sparql-results+json, application/json",
      "user-agent":"LinenEarthDesignerResearch/1.0 (fashion research source discovery)",
    },
    cache:"no-store",
    signal:AbortSignal.timeout(18_000),
  });
  if(!response.ok) throw new Error(`Wikidata discovery failed with ${response.status}.`);
  const payload=await response.json() as SparqlResponse;
  const bindings=payload.results?.bindings || [];
  const byDomain=new Map<string,DiscoveredFashionWebsite>();

  for(const row of bindings) {
    const website=safeHttpUrl(String(row.website?.value||""));
    const itemUrl=String(row.item?.value||"");
    if(!website || !itemUrl) continue;
    const domain=canonicalDomain(website);
    if(!domain || /wikimedia|wikipedia|facebook|instagram|twitter|x\.com$/i.test(domain)) continue;
    const route=String(row.route?.value||"clothing");
    const wikidataId=itemUrl.split("/").pop() || "";
    const name=String(row.itemLabel?.value||domain).trim().slice(0,160);
    if(!wikidataId) continue;
    const current=byDomain.get(domain);
    const candidate:DiscoveredFashionWebsite={
      id:`wd-${slug(wikidataId)}-${slug(domain)}`,
      name,
      baseUrl:`${website.protocol}//${website.host}`,
      category:categoryFor(route),
      authority:authorityFor(route),
      wikidataId,
      domain,
      discovery:discoveryFor(route),
    };
    if(!current || (current.discovery!=="wikidata-fashion-house" && candidate.discovery==="wikidata-fashion-house")) {
      byDomain.set(domain,candidate);
    }
  }

  return [...byDomain.values()]
    .sort((a,b)=>a.name.localeCompare(b.name))
    .slice(0,Math.max(1,Math.min(1000,Math.round(limit))));
}
