export type StockEventType="receipt"|"adjustment_in"|"adjustment_out"|"reserve"|"release"|"consume";

export type StockEvent={type:StockEventType;quantityMetres:number};

export function stockSnapshot(events:StockEvent[]){
  // Local ledger replay must agree with the server's no-oversell invariants.
  // A "plausible" negative number is not usable physical stock evidence.
  // Quantities are millimetres of fabric in metres rounded to 0.001.
  if(!Array.isArray(events)) throw new Error("Stock ledger events must be an array.");
  let physicalMillis=0;
  let reservedMillis=0;
  for(const [index,event] of events.entries()){
    if(!event||typeof event!=="object") throw new Error(`Invalid stock event #${index+1}.`);
    const q=event.quantityMetres;
    if(!Number.isFinite(q)||q<=0||Math.abs(Math.round(q*1000)-q*1000)>1e-7)
      throw new Error("Stock event quantity must be positive and have at most 3 decimal places.");
    const millimetres=Math.round(q*1000);
    if(!Number.isSafeInteger(millimetres)||!Number.isSafeInteger(physicalMillis+millimetres)||!Number.isSafeInteger(reservedMillis+millimetres))
      throw new Error("Stock quantity exceeds exact ledger precision.");
    if(event.type==="receipt"||event.type==="adjustment_in") physicalMillis+=millimetres;
    else if(event.type==="adjustment_out"){
      if(physicalMillis-reservedMillis<millimetres)
        throw new Error(`Stock adjustment #${index+1} would remove reserved or unavailable fabric.`);
      physicalMillis-=millimetres;
    }else if(event.type==="reserve"){
      if(physicalMillis-reservedMillis<millimetres)
        throw new Error(`Stock reservation #${index+1} exceeds available real fabric.`);
      reservedMillis+=millimetres;
    }else if(event.type==="release"){
      if(reservedMillis<millimetres)
        throw new Error(`Stock release #${index+1} exceeds the recorded reservation.`);
      reservedMillis-=millimetres;
    }else if(event.type==="consume"){
      if(reservedMillis<millimetres||physicalMillis<millimetres)
        throw new Error(`Stock consumption #${index+1} exceeds physically reserved fabric.`);
      physicalMillis-=millimetres;
      reservedMillis-=millimetres;
    }else throw new Error("Unsupported stock event type.");
    if(physicalMillis<reservedMillis||reservedMillis<0)
      throw new Error("Physical fabric ledger violates reservation invariants.");
  }
  return {
    physicalMetres:physicalMillis/1000,
    reservedMetres:reservedMillis/1000,
    availableMetres:(physicalMillis-reservedMillis)/1000,
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
  if(!Number.isFinite(quantityMetres)||Math.round(quantityMetres*1000)<1||quantityMetres>100000) throw new Error("Stock quantity must be at least 0.001 metres.");
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
  if(!Number.isFinite(quantityMetres)||Math.round(quantityMetres*1000)<1||quantityMetres>100) throw new Error("Reservation quantity must be at least 0.001 metres.");
  if(requestedBy.length<2) throw new Error("Named reservation checker / requester is required.");
  if(sourceReference.length<3) throw new Error("Reservation quantity evidence reference is required.");

  return {
    fabricId,revisionId,requestKey,
    quantityMetres:Math.round(quantityMetres*1000)/1000,
    requestedBy,sourceReference,
  };
}


export function normalizeStockConsumption(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock consumption evidence is required.");
  const source=input as Record<string,unknown>;
  const reservationId=String(source.reservationId||"").trim();
  const actualMetres=Number(source.actualMetres);
  const note=String(source.note||"").replace(/\s+/g," ").trim().slice(0,600);
  const checkedBy=String(source.checkedBy||"").replace(/\s+/g," ").trim().slice(0,120);
  const sourceReference=String(source.sourceReference||"").replace(/\s+/g," ").trim().slice(0,240);

  if(!/^[0-9a-f-]{36}$/i.test(reservationId)) throw new Error("Valid reservation ID is required.");
  if(!Number.isFinite(actualMetres)||Math.round(actualMetres*1000)<1||actualMetres>100) throw new Error("Actual consumed metres must be at least 0.001 metres.");
  if(checkedBy.length<2) throw new Error("Named consumption checker is required.");
  if(sourceReference.length<3) throw new Error("Actual cloth-usage evidence reference is required.");

  return {
    reservationId,
    actualMetres:Math.round(actualMetres*1000)/1000,
    note,checkedBy,sourceReference,
  };
}


export function normalizeStockRelease(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock release evidence is required.");
  const source=input as Record<string,unknown>;
  const reservationId=String(source.reservationId||"").trim();
  const note=String(source.note||"").replace(/\s+/g," ").trim().slice(0,600);
  const releasedBy=String(source.releasedBy||"").replace(/\s+/g," ").trim().slice(0,120);
  const sourceReference=String(source.sourceReference||"").replace(/\s+/g," ").trim().slice(0,240);
  if(!/^[0-9a-f-]{36}$/i.test(reservationId)) throw new Error("Valid reservation ID is required.");
  if(releasedBy.length<2) throw new Error("Named reservation release checker is required.");
  if(sourceReference.length<3) throw new Error("Reservation release reference is required.");
  return {reservationId,note,releasedBy,sourceReference};
}
