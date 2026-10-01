export type StockEventType="receipt"|"adjustment_in"|"adjustment_out"|"reserve"|"release"|"consume";

export type StockEvent={type:StockEventType;quantityMetres:number};

export function stockSnapshot(events:StockEvent[]){
  let physicalMetres=0;
  let reservedMetres=0;
  for(const event of events){
    const q=Number(event.quantityMetres);
    if(!Number.isFinite(q)||q<=0) throw new Error("Stock event quantity must be positive.");
    if(event.type==="receipt"||event.type==="adjustment_in") physicalMetres+=q;
    if(event.type==="adjustment_out"||event.type==="consume") physicalMetres-=q;
    if(event.type==="reserve") reservedMetres+=q;
    if(event.type==="release"||event.type==="consume") reservedMetres-=q;
  }
  const availableMetres=physicalMetres-reservedMetres;
  return {
    physicalMetres:Math.round(physicalMetres*1000)/1000,
    reservedMetres:Math.round(reservedMetres*1000)/1000,
    availableMetres:Math.round(availableMetres*1000)/1000,
  };
}


export function normalizeManualStockEvent(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock event evidence is required.");
  const source=input as Record<string,unknown>;
  const fabricId=String(source.fabricId||"").trim().slice(0,160);
  const eventType=String(source.eventType||"") as StockEventType;
  const quantityMetres=Number(source.quantityMetres);
  const note=String(source.note||"").replace(/\s+/g," ").trim().slice(0,600);
  const recordedBy=String(source.recordedBy||"").replace(/\s+/g," ").trim().slice(0,120);
  const sourceReference=String(source.sourceReference||"").replace(/\s+/g," ").trim().slice(0,240);

  if(!fabricId) throw new Error("Fabric ID is required.");
  if(!["receipt","adjustment_in","adjustment_out"].includes(eventType)) throw new Error("Unsupported manual stock event.");
  if(!Number.isFinite(quantityMetres)||quantityMetres<=0||quantityMetres>100000) throw new Error("Stock quantity must be positive.");
  if(recordedBy.length<2) throw new Error("Named stock checker / recorder is required.");
  if(sourceReference.length<3) throw new Error("Physical stock source reference is required.");

  return {
    fabricId,eventType,quantityMetres:Math.round(quantityMetres*1000)/1000,
    note,recordedBy,sourceReference,
  };
}


export function normalizeStockReservation(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock reservation evidence is required.");
  const source=input as Record<string,unknown>;
  const fabricId=String(source.fabricId||"").trim().slice(0,160);
  const revisionId=String(source.revisionId||"").trim().slice(0,220);
  const requestKey=String(source.requestKey||"").trim().slice(0,180);
  const quantityMetres=Number(source.quantityMetres);
  const requestedBy=String(source.requestedBy||"").replace(/\s+/g," ").trim().slice(0,120);
  const sourceReference=String(source.sourceReference||"").replace(/\s+/g," ").trim().slice(0,240);

  if(!fabricId) throw new Error("Fabric ID is required.");
  if(revisionId.length<12) throw new Error("Locked revision ID is required.");
  if(requestKey.length<12) throw new Error("Reservation request key is required.");
  if(!Number.isFinite(quantityMetres)||quantityMetres<=0||quantityMetres>100) throw new Error("Reservation quantity must be positive.");
  if(requestedBy.length<2) throw new Error("Named reservation checker / requester is required.");
  if(sourceReference.length<3) throw new Error("Reservation quantity evidence reference is required.");

  return {
    fabricId,revisionId,requestKey,
    quantityMetres:Math.round(quantityMetres*1000)/1000,
    requestedBy,sourceReference,
  };
}
