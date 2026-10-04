import type { CreativeCraftSpec } from "./creative-spec.ts";
export const CRAFT_SHIRT_PATH="M85 54 L117 40 L143 40 L175 54 L207 131 L182 142 L165 95 L168 230 L92 230 L95 95 L78 142 L53 131 Z";
export const CRAFT_PANT_PATH="M94 242 L166 242 L173 415 L142 415 L130 291 L118 415 L87 415 Z";
export const CRAFT_ZONE_RECTS={collar:[108,40,44,24],cuff:[55,126,149,17],placket:[125,65,10,151],"shirt-body":[94,78,72,149],pocket:[142,91,22,26],waistband:[94,242,72,15],pleat:[104,258,52,49],"trouser-leg":[140,298,23,99]} as const;
function esc(value:unknown){return String(value).replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
export function creativePlacementSvg(spec:CreativeCraftSpec,base:{shirt:{image:string;hex:string};pant:{image:string;hex:string}},id="craft"):string {
  // Fixed drafting coordinates. Photograph scale and cloth repeat are deliberately
  // not inferred from this illustration. Every mark is clipped to its garment.
  const prefix=id.replace(/[^a-z0-9_-]/gi,""), defs:string[]=[], layers:string[]=[];
  const swatch=(key:string,image:string,hex:string)=>{defs.push(`<pattern id="${prefix}-${key}" width="70" height="70" patternUnits="userSpaceOnUse"><rect width="70" height="70" fill="${esc(hex)}"/><image href="${esc(image)}" width="70" height="70" preserveAspectRatio="xMidYMid slice"/></pattern>`);return `url(#${prefix}-${key})`;};
  const shirt=swatch("shirt",base.shirt.image,base.shirt.hex),pant=swatch("pant",base.pant.image,base.pant.hex);
  defs.push(`<clipPath id="${prefix}-shirt-clip"><path d="${CRAFT_SHIRT_PATH}"/></clipPath><clipPath id="${prefix}-pant-clip"><path d="${CRAFT_PANT_PATH}"/></clipPath>`);
  const clip=(zone:string)=>`url(#${prefix}-${["waistband","pleat","trouser-leg"].includes(zone)?"pant":"shirt"}-clip)`;
  for(const [i,p] of spec.panels.entries()){
    const [x,y,w,h]=CRAFT_ZONE_RECTS[p.zone],fill=swatch(`accent-${i}`,p.fabric.image,p.fabric.hex);
    layers.push(`<g clip-path="${clip(p.zone)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>${p.zone==="cuff"?`<rect x="91" y="126" width="78" height="17" fill="${shirt}"/>`:""}</g>`);
  }
  const d=spec.decoration;
  if(d){
    const [x,y,w,h]=CRAFT_ZONE_RECTS[d.zone],step=Math.max(7,d.repeatMm*.7),width=d.threadWidthMm*(d.technique==="embroidery"?2:1.4);
    const motif=d.motif==="leaf"?"M2 12 Q2 1 12 2 Q11 12 2 12 M2 12 L10 4":d.motif==="diamond"?"M7 1 L13 7 L7 13 L1 7 Z":d.motif==="wave"?"M0 7 Q4 0 8 7 T16 7":"M2 2 L2 14";
    defs.push(`<pattern id="${prefix}-motif" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="${motif}" transform="scale(${step/19})" fill="none" stroke="${d.colour}" stroke-width="${width}" ${d.stitch==="running"?'stroke-dasharray="2 2"':""}/></pattern>`);
    const dh=Math.max(5,h*d.coverage/35);
    layers.push(`<g clip-path="${clip(d.zone)}"><rect x="${x}" y="${y}" width="${w}" height="${dh}" fill="url(#${prefix}-motif)"/>${d.zone==="cuff"?`<rect x="91" y="126" width="78" height="${dh}" fill="${shirt}"/>`:""}</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 440" role="img" aria-label="Fabric and craft placement illustration"><defs>${defs.join("")}</defs><rect width="260" height="440" fill="#e9e4d9"/><path d="${CRAFT_SHIRT_PATH}" fill="${shirt}" stroke="#3b4146" stroke-width="1.5"/><path d="${CRAFT_PANT_PATH}" fill="${pant}" stroke="#3b4146" stroke-width="1.5"/>${layers.join("")}<g fill="none" stroke="#37414a" stroke-width="1" opacity=".65"><path d="M117 40 L130 59 L143 40 M130 59 V228 M94 256 H166 M130 256 V291 M108 259 L106 292 M152 259 L155 292"/></g></svg>`;
}
