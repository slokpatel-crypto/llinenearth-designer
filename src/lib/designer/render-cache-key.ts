import { createHash } from "node:crypto";

type SelectedLookCacheInput={
  shirt:{id:string};
  pant:{id:string};
  style:unknown;
  styleSpec?:unknown;
  bodyProfile?:unknown;
  renderEvidence?:unknown;
};

function canonicalUrlIdentity(value:string|undefined) {
  const raw=String(value||"").trim();
  if(!raw) return "";
  try {
    const url=new URL(raw);
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`;
  } catch {
    return raw.slice(0,1800);
  }
}

function stableValue(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(stableValue);
  if(value && typeof value==="object") {
    return Object.fromEntries(
      Object.entries(value as Record<string,unknown>)
        .filter(([,item])=>item!==undefined)
        .sort(([a],[b])=>a.localeCompare(b))
        .map(([key,item])=>[key,stableValue(item)])
    );
  }
  return value;
}

export function selectedLookRenderCacheKey(
  input:SelectedLookCacheInput,
  view:"front"|"three-quarter"|"side"|"back"="front",
  frontImage?:string,
) {
  const canonical=stableValue({
    version:"linen-final-render-cache-v1",
    view,
    shirtId:input.shirt.id,
    pantId:input.pant.id,
    style:input.style,
    styleSpec:input.styleSpec||null,
    bodyProfile:input.bodyProfile||null,
    renderEvidence:input.renderEvidence||null,
    frontImage:view==="front"?"":canonicalUrlIdentity(frontImage),
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
