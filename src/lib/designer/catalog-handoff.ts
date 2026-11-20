import type { DesignerFabric } from "./engine.ts";

const VALID_ID=/^[a-z0-9][a-z0-9._:-]{0,159}$/i;

/** A public catalogue selection is a fabric pair, never a lock, secret or stock guarantee. */
export function catalogHandoffPath(shirt:DesignerFabric|null,pant:DesignerFabric|null):string|null {
  if(!shirt||!pant||!VALID_ID.test(shirt.id)||!VALID_ID.test(pant.id)||
    !shirt.allowedGarments.includes("shirt")||!pant.allowedGarments.includes("pant"))return null;
  return "/designer-studio?"+new URLSearchParams({from:"fabric-catalog",shirt:shirt.id,pant:pant.id}).toString();
}

/** Fail closed on duplicate, unknown, overlong or cross-garment URL values. */
export function readCatalogFabricHandoff(
  params:URLSearchParams,
  shirts:readonly DesignerFabric[],
  pants:readonly DesignerFabric[],
):{shirtId:string;pantId:string}|null {
  if(params.toString().length>500||params.get("from")!=="fabric-catalog")return null;
  if([...params.keys()].length!==3||params.getAll("from").length!==1||
     params.getAll("shirt").length!==1||params.getAll("pant").length!==1)return null;
  const shirtId=params.get("shirt"),pantId=params.get("pant");
  if(!shirtId||!pantId||!VALID_ID.test(shirtId)||!VALID_ID.test(pantId))return null;
  const shirt=shirts.find(item=>item.id===shirtId&&item.allowedGarments.includes("shirt"));
  const pant=pants.find(item=>item.id===pantId&&item.allowedGarments.includes("pant"));
  return shirt&&pant?{shirtId:shirt.id,pantId:pant.id}:null;
}
