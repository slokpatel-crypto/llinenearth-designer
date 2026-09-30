"use client";

import { useRef, useState } from "react";

export type DirectFabricCapture={
  dataUrl:string;
  name:string;
  bytes:number;
  width:number;
  height:number;
};

type Role="flat"|"macro"|"fold";

function readDataUrl(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(reader.error||new Error("Capture could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function compressCapture(file:File):Promise<DirectFabricCapture>{
  if(!file.type.startsWith("image/")) throw new Error("Choose a JPEG, PNG or WebP image.");
  const bitmap=await createImageBitmap(file);
  try{
    let width=bitmap.width;
    let height=bitmap.height;
    const maxSide=Math.max(width,height);
    if(maxSide>1600){
      const scale=1600/maxSide;
      width=Math.max(1,Math.round(width*scale));
      height=Math.max(1,Math.round(height*scale));
    }

    const canvas=document.createElement("canvas");
    const ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx) throw new Error("Browser image compression is unavailable.");

    const targetBytes=850_000;
    let blob:Blob|null=null;
    let quality=.92;

    for(let attempt=0;attempt<8;attempt++){
      canvas.width=width;
      canvas.height=height;
      ctx.fillStyle="#ffffff";
      ctx.fillRect(0,0,width,height);
      ctx.drawImage(bitmap,0,0,width,height);
      blob=await new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,"image/jpeg",quality));
      if(!blob) throw new Error("Browser image compression failed.");
      if(blob.size<=targetBytes) break;
      if(quality>.72) quality-=.07;
      else{
        width=Math.max(640,Math.round(width*.84));
        height=Math.max(640,Math.round(height*.84));
        quality=.82;
      }
    }

    if(!blob || blob.size>1_100_000) throw new Error("Capture is still too large after compression. Crop closer to the cloth and try again.");
    const dataUrl=await readDataUrl(blob);
    return {dataUrl,name:file.name.slice(0,120),bytes:blob.size,width,height};
  }finally{
    bitmap.close();
  }
}

export default function FabricCapturePicker({
  role,
  capture,
  onChange,
}:{
  role:Role;
  capture:DirectFabricCapture|null;
  onChange:(value:DirectFabricCapture|null)=>void;
}){
  const ref=useRef<HTMLInputElement|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function pick(file:File|null){
    if(!file) return;
    setBusy(true);setError("");
    try{
      onChange(await compressCapture(file));
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Capture could not be prepared.");
    }finally{
      setBusy(false);
      if(ref.current) ref.current.value="";
    }
  }

  return <div className="directCapture" data-role={role}>
    <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" capture={role==="flat"?"environment":undefined} hidden onChange={(event)=>void pick(event.target.files?.[0]||null)} />
    <button type="button" onClick={()=>ref.current?.click()} disabled={busy}>{busy?"Compressing…":capture?"Replace local photo":"Use photo from device"}</button>
    {capture&&<span><b>LOCAL</b>{capture.name} · {capture.width}×{capture.height} · {Math.round(capture.bytes/1024)} KB <button type="button" onClick={()=>onChange(null)}>Remove</button></span>}
    {error&&<small>{error}</small>}
  </div>;
}
