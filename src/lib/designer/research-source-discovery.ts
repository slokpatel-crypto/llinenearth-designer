import type { FashionResearchSource } from "@/lib/designer/fashion-research-source-pool";

export type DiscoveredFashionWebsite = {
  id:string;
  name:string;
  baseUrl:string;
  category:FashionResearchSource["category"];
  authority:FashionResearchSource["authority"];
  wikidataId:string;
  domain:string;
  discovery:
    |"wikidata-fashion-house"
    |"wikidata-clothing-industry"
    |"wikidata-textile-industry"
    |"wikidata-textile-manufacturing"
    |"wikidata-fashion-magazine"
    |"wikidata-fashion-museum"
    |"wikidata-fashion-designer"
    |"wikidata-fashion-design";
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
  if(route==="textile" || route==="textile-manufacturing") return "materials";
  if(route==="fashion-magazine") return "runway";
  if(route==="fashion-museum") return "museum";
  return "industry";
}

function authorityFor(route:string):DiscoveredFashionWebsite["authority"] {
  if(route==="fashion-magazine") return "editorial";
  if(route==="fashion-house" || route==="fashion-designer") return "industry";
  return "primary";
}

function discoveryFor(route:string):DiscoveredFashionWebsite["discovery"] {
  if(route==="fashion-house") return "wikidata-fashion-house";
  if(route==="textile") return "wikidata-textile-industry";
  if(route==="textile-manufacturing") return "wikidata-textile-manufacturing";
  if(route==="fashion-magazine") return "wikidata-fashion-magazine";
  if(route==="fashion-museum") return "wikidata-fashion-museum";
  if(route==="fashion-designer") return "wikidata-fashion-designer";
  if(route==="fashion-design") return "wikidata-fashion-design";
  return "wikidata-clothing-industry";
}

type DiscoveryRoute=
  |"fashion-house"
  |"clothing"
  |"textile"
  |"textile-manufacturing"
  |"fashion-magazine"
  |"fashion-museum"
  |"fashion-designer"
  |"fashion-design";

function queryFor(route:DiscoveryRoute,limit:number) {
  const safeLimit=Math.max(50,Math.min(1200,Math.round(limit)));
  const selector=route==="fashion-house"
    ? "?item wdt:P31/wdt:P279* wd:Q3661311; wdt:P856 ?website."
    : route==="textile"
      ? "?item wdt:P452 wd:Q607081; wdt:P856 ?website."
      : route==="textile-manufacturing"
        ? "?item wdt:P452 wd:Q1505660; wdt:P856 ?website."
        : route==="fashion-magazine"
          ? "?item wdt:P31/wdt:P279* wd:Q6297581; wdt:P856 ?website."
          : route==="fashion-museum"
            ? "?item wdt:P31/wdt:P279* wd:Q5436782; wdt:P856 ?website."
            : route==="fashion-designer"
              ? "?item wdt:P106 wd:Q3501317; wdt:P856 ?website."
              : route==="fashion-design"
                ? "?item wdt:P101 wd:Q29583; wdt:P856 ?website."
                : "?item wdt:P452 wd:Q11828862; wdt:P856 ?website.";
  return `
SELECT DISTINCT ?item ?itemLabel ?website WHERE {
  ${selector}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${safeLimit}`.trim();
}

export function fashionWebsiteDiscoveryQuery(limit=1200) {
  return queryFor("fashion-house",limit);
}

async function discoverRoute(route:DiscoveryRoute,limit:number):Promise<Binding[]> {
  const query=queryFor(route,limit);
  const url=`${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response=await fetch(url,{
    headers:{
      accept:"application/sparql-results+json, application/json",
      "user-agent":"LinenEarthDesignerResearch/1.0 (fashion research source discovery)",
    },
    cache:"no-store",
    signal:AbortSignal.timeout(16_000),
  });
  if(!response.ok) throw new Error(`Wikidata ${route} discovery failed with ${response.status}.`);
  const payload=await response.json() as SparqlResponse;
  return (payload.results?.bindings || []).map((row)=>({
    ...row,
    route:{value:route},
  }));
}

export async function discoverFashionWebsites(limit=1000):Promise<DiscoveredFashionWebsite[]> {
  const requested=Math.max(1,Math.min(1000,Math.round(limit)));
  const routeLimits={
    "fashion-house":Math.min(700,Math.max(250,requested)),
    clothing:Math.min(1000,Math.max(500,requested)),
    textile:Math.min(1000,Math.max(400,requested)),
    "textile-manufacturing":Math.min(1000,Math.max(400,requested)),
    "fashion-magazine":Math.min(500,Math.max(150,Math.ceil(requested*.35))),
    "fashion-museum":Math.min(400,Math.max(120,Math.ceil(requested*.25))),
    "fashion-designer":Math.min(900,Math.max(400,requested)),
    "fashion-design":Math.min(700,Math.max(250,Math.ceil(requested*.6))),
  } satisfies Record<DiscoveryRoute,number>;

  const settled=await Promise.allSettled([
    discoverRoute("fashion-house",routeLimits["fashion-house"]),
    discoverRoute("clothing",routeLimits.clothing),
    discoverRoute("textile",routeLimits.textile),
    discoverRoute("textile-manufacturing",routeLimits["textile-manufacturing"]),
    discoverRoute("fashion-magazine",routeLimits["fashion-magazine"]),
    discoverRoute("fashion-museum",routeLimits["fashion-museum"]),
    discoverRoute("fashion-designer",routeLimits["fashion-designer"]),
    discoverRoute("fashion-design",routeLimits["fashion-design"]),
  ]);
  const bindings=settled.flatMap((result)=>result.status==="fulfilled"?result.value:[]);
  if(!bindings.length) throw new Error("All Wikidata fashion research discovery routes failed.");
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
    const priority:Record<DiscoveredFashionWebsite["discovery"],number>={
      "wikidata-fashion-museum":8,
      "wikidata-fashion-magazine":7,
      "wikidata-textile-manufacturing":6,
      "wikidata-textile-industry":5,
      "wikidata-fashion-design":4,
      "wikidata-fashion-house":3,
      "wikidata-fashion-designer":2,
      "wikidata-clothing-industry":1,
    };
    if(!current || priority[candidate.discovery]>priority[current.discovery]) {
      byDomain.set(domain,candidate);
    }
  }

  return [...byDomain.values()]
    .sort((a,b)=>a.name.localeCompare(b.name))
    .slice(0,requested);
}
