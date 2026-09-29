import fs from "node:fs/promises";
import path from "node:path";

const url=(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/,"");
const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if(!url || !key) throw new Error("SUPABASE_URL and a server-only Supabase admin key are required.");

const response=await fetch(`${url}/rest/v1/rpc/fabric_analyzer_reference_snapshot`,{
  method:"POST",
  headers:{
    apikey:key,
    authorization:`Bearer ${key}`,
    "content-type":"application/json",
    accept:"application/json",
  },
  body:"{}",
});
if(!response.ok) throw new Error(`Reference snapshot failed (${response.status}): ${(await response.text()).slice(0,400)}`);
const snapshot=await response.json();

const root=process.cwd();
const out=(name)=>path.join(root,"src","lib",name);

const index=`import "server-only";

export const REAL_MENSWEAR_MATERIAL_TERMS = ${JSON.stringify(snapshot.materials,null,2)} as const;

export const REAL_MENSWEAR_PATTERN_TERMS = ${JSON.stringify(snapshot.patterns,null,2)} as const;

export const STANDARD_COLOR_REFERENCE_TERMS = ${JSON.stringify(snapshot.colors,null,2)} as const;

export const FABRIC_REFERENCE_SOURCES = ${JSON.stringify(snapshot.sources,null,2)} as const;

export const FABRIC_REFERENCE_INDEX_VERSION = "real-reference-v3" as const;

export const FABRIC_REFERENCE_COUNTS = {
  materials: REAL_MENSWEAR_MATERIAL_TERMS.length,
  patterns: REAL_MENSWEAR_PATTERN_TERMS.length,
  colors: STANDARD_COLOR_REFERENCE_TERMS.length,
  sources: FABRIC_REFERENCE_SOURCES.length,
} as const;
`;

const provenance=`import "server-only";

/**
 * AUTO-GENERATED provenance map from the private Fabric Analyzer corpus.
 * Each vocabulary term is tied back to the real source that introduced it.
 */
export const FABRIC_REFERENCE_PROVENANCE = ${JSON.stringify(snapshot.provenance,null,2)} as const;
`;

const examples=`import "server-only";

/**
 * AUTO-GENERATED from source-backed real menswear fabric examples.
 * These records are used only as backend reference anchors.
 */
export const REAL_MENSWEAR_FABRIC_EXAMPLES = ${JSON.stringify(snapshot.examples,null,2)} as const;

export const REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT = REAL_MENSWEAR_FABRIC_EXAMPLES.length;
`;

await Promise.all([
  fs.writeFile(out("fabric-analyzer-reference-index.ts"),index),
  fs.writeFile(out("fabric-analyzer-provenance-map.ts"),provenance),
  fs.writeFile(out("fabric-analyzer-real-examples.ts"),examples),
]);

console.log(JSON.stringify({
  materials:snapshot.materials.length,
  patterns:snapshot.patterns.length,
  colors:snapshot.colors.length,
  sources:snapshot.sources.length,
  examples:snapshot.examples.length,
},null,2));
