import type { VocabId } from "./types.ts";
import { deltaE2000, srgbHexToLab, type LabColor } from "./color-distance.ts";

export const colorFamilies=[
  {id:"white_family",label:"White family",aliases:["white","optic white","ivory","off white","off-white"]},
  {id:"neutral_warm",label:"Warm neutral",aliases:["cream","beige","taupe","camel","tan","sand","stone","ecru","khaki"]},
  {id:"neutral_cool",label:"Cool neutral",aliases:["grey","gray","light grey","mid grey","charcoal","silver"]},
  {id:"black_family",label:"Black family",aliases:["black","jet black"]},
  {id:"blue_family",label:"Blue family",aliases:["blue","navy","midnight blue","royal blue","cobalt","sky blue","powder blue","denim blue"]},
  {id:"teal_family",label:"Teal family",aliases:["teal","petrol","cyan","turquoise","blue green","blue-green"]},
  {id:"green_family",label:"Green family",aliases:["green","sage","olive","forest green","bottle green","mint"]},
  {id:"red_family",label:"Red family",aliases:["red","burgundy","wine","maroon","crimson"]},
  {id:"pink_family",label:"Pink family",aliases:["pink","blush","dusty rose","rose"]},
  {id:"purple_family",label:"Purple family",aliases:["purple","lavender","lilac","plum","aubergine","orchid","violet"]},
  {id:"yellow_family",label:"Yellow family",aliases:["yellow","mustard","ochre","gold"]},
  {id:"orange_family",label:"Orange family",aliases:["orange","rust","terracotta","coral"]},
  {id:"brown_family",label:"Brown family",aliases:["brown","chocolate","espresso","sienna","walnut","oak"]},
] as const;
export type ColorFamilyId=VocabId<typeof colorFamilies>;

const anchors:Record<ColorFamilyId,string>={
  white_family:"#F6F3EA",
  neutral_warm:"#C8B596",
  neutral_cool:"#8B9094",
  black_family:"#181818",
  blue_family:"#264B78",
  teal_family:"#207C7B",
  green_family:"#657A55",
  red_family:"#8F2F3B",
  pink_family:"#D99AAA",
  purple_family:"#7D5A8E",
  yellow_family:"#C7A52E",
  orange_family:"#C66A3A",
  brown_family:"#73533E",
};

export function nearestColorFamily(lab:LabColor) {
  let best:{id:ColorFamilyId;deltaE:number}|null=null;
  for(const entry of colorFamilies) {
    const anchor=srgbHexToLab(anchors[entry.id]);
    if(!anchor) continue;
    const deltaE=deltaE2000(lab,anchor);
    if(!best || deltaE<best.deltaE) best={id:entry.id,deltaE};
  }
  return best;
}
