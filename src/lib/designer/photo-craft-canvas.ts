import type { CreativeCraftSpec } from "./creative-spec.ts";
import { PHOTO_CRAFT_MOTIF_PATHS, photoCraftMarks, type PhotoCraftArea } from "./photo-craft.ts";

/** Local drawing only; the caller applies photographed garment and zone masks. */
export function drawPhotoCraftDecoration(context:CanvasRenderingContext2D,decoration:NonNullable<CreativeCraftSpec["decoration"]>,areas:PhotoCraftArea[]) {
  const path=new Path2D(PHOTO_CRAFT_MOTIF_PATHS[decoration.motif]);
  context.save();
  context.strokeStyle=decoration.colour;
  context.fillStyle=decoration.colour;
  context.lineCap="round";
  context.lineJoin="round";
  for(const mark of photoCraftMarks(decoration,areas)){
    context.save();
    context.translate(mark.x,mark.y);
    const scale=mark.size/16;
    context.scale(scale,scale);
    context.lineWidth=Math.max(.65,Math.min(3,decoration.threadWidthMm*2))/scale;
    // These distinguish proposed stitch treatments, not actual stitch execution.
    if(decoration.stitch==="running")context.setLineDash([2.4/scale,1.8/scale]);
    if(decoration.stitch==="satin"&&["leaf","diamond"].includes(decoration.motif)){
      context.globalAlpha=.8;
      context.fill(path);
      context.globalAlpha=1;
    }
    context.stroke(path);
    if(decoration.stitch==="chain"){
      context.lineWidth*=.35;
      context.strokeStyle="#F5F2E9";
      context.globalAlpha=.35;
      context.stroke(path);
    }
    context.restore();
  }
  context.restore();
}
