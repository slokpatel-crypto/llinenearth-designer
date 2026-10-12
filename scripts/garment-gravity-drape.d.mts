export type GarmentGravityFoldPart="shirt"|"sleeve"|"leg";
export function garmentGravityFoldDisplacement(
  part:GarmentGravityFoldPart,
  point:{x:number;y:number;z:number},
  centerX?:number,
  depthCenter?:number,
):{x:number;z:number};
export function studioSleeveRadiusScale(heightM:number):number;
