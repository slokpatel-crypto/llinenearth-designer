const DATA_URL=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i;

export const DIRECT_FABRIC_CAPTURE_MAX_BYTES=1_100_000;
export const DIRECT_FABRIC_CAPTURE_MAX_CHARS=1_600_000;

export function directFabricCaptureBytes(value:string):Uint8Array|null {
  const raw=String(value||"").trim();
  if(!raw.startsWith("data:image/")) return null;
  if(raw.length>DIRECT_FABRIC_CAPTURE_MAX_CHARS) {
    throw new Error("Direct fabric capture is too large. Use the built-in compressed upload or a trusted HTTPS image URL.");
  }
  const match=DATA_URL.exec(raw);
  if(!match) throw new Error("Direct fabric capture must be a base64 JPEG, PNG or WebP image.");
  const bytes=new Uint8Array(Buffer.from(match[2],"base64"));
  if(bytes.byteLength<500) throw new Error("Direct fabric capture is empty or too small.");
  if(bytes.byteLength>DIRECT_FABRIC_CAPTURE_MAX_BYTES) {
    throw new Error("Direct fabric capture is too large. Use the built-in compressed upload or a trusted HTTPS image URL.");
  }
  return bytes;
}

export function isDirectFabricCapture(value:unknown) {
  const raw=String(value??"").trim();
  return raw.startsWith("data:image/");
}

export function storedFabricCaptureReference(value:unknown) {
  return isDirectFabricCapture(value) ? "operator-direct-capture" : String(value??"").replace(/\s+/g," ").trim().slice(0,1800);
}
