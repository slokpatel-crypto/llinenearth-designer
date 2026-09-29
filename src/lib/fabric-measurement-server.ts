import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { assessImageQuality, averageHash, measuredPalette, measurePattern } from "./fabric-measurement-core";
import type { FabricMeasuredData } from "./fabric-measurement-types";

export async function measureFabricImageBytes(
  bytes:Uint8Array,
  physical?:{swatchRealWidthMm?:number;repeatRealMm?:number},
):Promise<FabricMeasuredData> {
  if(bytes.byteLength<500) throw new Error("Fabric image is empty or too small.");
  const contentSha256=createHash("sha256").update(bytes).digest("hex");
  const image=sharp(bytes,{failOn:"warning"}).rotate();
  const metadata=await image.metadata();
  const originalWidth=metadata.width||0,originalHeight=metadata.height||0;
  if(!originalWidth||!originalHeight) throw new Error("Fabric image dimensions are unavailable.");

  const size=128;
  const rgbResult=await image.clone().resize(size,size,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const grayResult=await image.clone().resize(size,size,{fit:"fill"}).greyscale().raw().toBuffer({resolveWithObject:true});
  const rgb=new Uint8Array(rgbResult.data);
  const gray=new Uint8Array(grayResult.data);
  const paletteResult=measuredPalette(rgb,size,size,3,4);
  const imageQuality=assessImageQuality(rgb,gray,size,size,3,originalWidth,originalHeight);
  const pattern=measurePattern(gray,size,size,paletteResult.palette,{
    ...physical,
    originalWidthPx:originalWidth,
  });
  const perceptualHash=averageHash(gray,size,size);

  return {
    contentSha256,
    perceptualHash,
    colour:{
      hex:paletteResult.dominant.hex,
      lab:paletteResult.dominant.lab,
      palette:paletteResult.palette,
      mappedColorFamily:paletteResult.mappedColorFamily,
      deltaE:Math.round(paletteResult.deltaE*10)/10,
    },
    pattern,
    imageQuality,
    measuredAt:new Date().toISOString(),
  };
}
