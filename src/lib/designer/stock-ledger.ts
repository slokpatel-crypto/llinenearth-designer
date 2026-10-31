export type StockEventType="receipt"|"adjustment_in"|"adjustment_out"|"reserve"|"release"|"consume";

export type StockEvent={type:StockEventType;quantityMetres:number};
/** A retry after a lost response must use the SAME request key for the SAME
 * reservation intent. A different fabric, revision, quantity or provenance
 * needs a different key. Browser state cannot replace the SQL idempotency gate. */
export type StockReservationIntent={
  fabricId:string; revisionId:string; quantityMetres:number;
  requestedBy:string; sourceReference:string;
};
export function stockReservationSignature(intent:StockReservationIntent):string{
  return JSON.stringify([
    intent.fabricId,intent.revisionId,intent.quantityMetres,
    intent.requestedBy,intent.sourceReference,
  ]);
}
export function stockReservationAttempt(
  existing:ReadonlyMap<string,string>,
  intent:StockReservationIntent,
  newKey:()=>string,
):{signature:string;requestKey:string}{
  const signature=stockReservationSignature(intent);
  return {signature,requestKey:existing.get(signature)??newKey()};
}

/**
 * Operators must supply actual measured quantities at ledger precision.
 * Silently rounding incoming evidence (especially a receipt) can mint fabric,
 * misstate usage or create a different reserved quantity from the approved sheet.
 */
function exactStockMetres(raw:unknown,field:string,maxMetres:number):number{
  if(typeof raw!=="number"||!Number.isFinite(raw)||raw<0.001||raw>maxMetres)
    throw new Error(`${field} must be at least 0.001 metres and no more than ${maxMetres} metres.`);
  const millimetres=Math.round(raw*1000);
  if(!Number.isSafeInteger(millimetres)||Math.abs(raw*1000-millimetres)>1e-7)
    throw new Error(`${field} must have at most 3 decimal places (0.001m precision).`);
  return millimetres/1000;
}


/** Never alias inventory subjects or idempotency keys by truncation. */
function requiredStockIdentity(value:unknown,label:string,min:number,max:number):string {
  if(typeof value!=="string") throw new Error(`${label} is required.`);
  const identity=value.trim();
  if(identity.length<min) throw new Error(`${label} is required.`);
  if(identity.length>max) throw new Error(`${label} exceeds ${max} characters; identities cannot be truncated.`);
  return identity;
}

/** Physical catalogue IDs are exact keys. Trimming a supplied stock ID can
 * silently record a roll against a different fabric than the operator entered.
 * Human names and source-reference prose retain their existing normalization.
 */
function requiredStockFabricId(value:unknown):string {
  const id=requiredStockIdentity(value,"Fabric ID",1,160);
  if(value!==id) throw new Error("Fabric ID must match the catalogue identity exactly.");
  return id;
}

/** A cut-off source reference would no longer identify the source worksheet. */
function requiredStockAuditText(value:unknown,label:string,min:number,max:number):string {
  if(typeof value!=="string") throw new Error(`${label} is required.`);
  const text=value.replace(/\s+/g," ").trim();
  if(text.length<min) throw new Error(`${label} is required.`);
  if(text.length>max) throw new Error(`${label} exceeds ${max} characters; source provenance cannot be truncated.`);
  return text;
}


/** Optional human stock notes are audit evidence: never silently truncate or
 * coerce JSON objects/arrays/numbers into a fabricated text explanation.
 */
function optionalStockAuditNote(value:unknown):string {
  if(value===undefined||value===null) return "";
  if(typeof value!=="string") throw new Error("Stock note must be text.");
  const note=value.replace(/\s+/g," ").trim();
  if(note.length>600) throw new Error("Stock note exceeds 600 characters; evidence cannot be truncated.");
  return note;
}

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
  const fabricId=requiredStockFabricId(source.fabricId);
  if(typeof source.eventType!=="string") throw new Error("Unsupported manual stock event.");
  const eventType=source.eventType as StockEventType;
  const quantityMetres=exactStockMetres(source.quantityMetres,"Stock quantity",100000);
  const note=optionalStockAuditNote(source.note);
  const recordedBy=requiredStockAuditText(source.recordedBy,"Named stock checker / recorder",2,120);
  const sourceReference=requiredStockAuditText(source.sourceReference,"Physical stock source reference",3,240);

  if(!fabricId) throw new Error("Fabric ID is required.");
  if(!["receipt","adjustment_in","adjustment_out"].includes(eventType)) throw new Error("Unsupported manual stock event.");
  
  if(recordedBy.length<2) throw new Error("Named stock checker / recorder is required.");
  if(sourceReference.length<3) throw new Error("Physical stock source reference is required.");

  return {
    fabricId,eventType,quantityMetres,
    note,recordedBy,sourceReference,
  };
}


export function normalizeStockReservation(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock reservation evidence is required.");
  const source=input as Record<string,unknown>;
  const fabricId=requiredStockFabricId(source.fabricId);
  const revisionId=requiredStockIdentity(source.revisionId,"Locked revision ID",12,220);
  const requestKey=requiredStockIdentity(source.requestKey,"Reservation request key",12,180);
  const quantityMetres=exactStockMetres(source.quantityMetres,"Stock quantity",100000);
  const requestedBy=requiredStockAuditText(source.requestedBy,"Named reservation checker / requester",2,120);
  const sourceReference=requiredStockAuditText(source.sourceReference,"Reservation quantity evidence reference",3,240);

  if(!fabricId) throw new Error("Fabric ID is required.");
  if(revisionId.length<12) throw new Error("Locked revision ID is required.");
  if(requestKey.length<12) throw new Error("Reservation request key is required.");
  
  if(requestedBy.length<2) throw new Error("Named reservation checker / requester is required.");
  if(sourceReference.length<3) throw new Error("Reservation quantity evidence reference is required.");

  return {
    fabricId,revisionId,requestKey,
    quantityMetres,
    requestedBy,sourceReference,
  };
}


export function normalizeStockConsumption(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock consumption evidence is required.");
  const source=input as Record<string,unknown>;
  const reservationId=typeof source.reservationId==="string"?source.reservationId:"";
  const actualMetres=exactStockMetres(source.actualMetres,"Actual consumed metres",100);
  const note=optionalStockAuditNote(source.note);
  const checkedBy=requiredStockAuditText(source.checkedBy,"Named consumption checker",2,120);
  const sourceReference=requiredStockAuditText(source.sourceReference,"Actual cloth-usage evidence reference",3,240);

  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId)) throw new Error("Valid reservation ID is required.");
  
  if(checkedBy.length<2) throw new Error("Named consumption checker is required.");
  if(sourceReference.length<3) throw new Error("Actual cloth-usage evidence reference is required.");

  return {
    reservationId,
    actualMetres,
    note,checkedBy,sourceReference,
  };
}


export function normalizeStockRelease(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock release evidence is required.");
  const source=input as Record<string,unknown>;
  const reservationId=typeof source.reservationId==="string"?source.reservationId:"";
  const note=optionalStockAuditNote(source.note);
  const releasedBy=requiredStockAuditText(source.releasedBy,"Named reservation release checker",2,120);
  const sourceReference=requiredStockAuditText(source.sourceReference,"Reservation release reference",3,240);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId)) throw new Error("Valid reservation ID is required.");
  if(releasedBy.length<2) throw new Error("Named reservation release checker is required.");
  if(sourceReference.length<3) throw new Error("Reservation release reference is required.");
  return {reservationId,note,releasedBy,sourceReference};
}
