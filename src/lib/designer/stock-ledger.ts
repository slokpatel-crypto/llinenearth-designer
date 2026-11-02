export type StockEventType="receipt"|"adjustment_in"|"adjustment_out"|"reserve"|"release"|"consume";

export type StockEvent={type:StockEventType;quantityMetres:number};
// Closed reservations are UUIDs returned by the privileged stock ledger.
// A 36-character hex-and-dash string is not sufficient identity evidence.
const RESERVATION_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

// Physical checker names and signed source references are identity-bearing
// stock evidence, never coercible arrays/objects or fabricated numbers.
function literalStockEvidence(value:unknown,maxLength:number):string{
  return typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,maxLength):"";
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


// Privileged ledger identities and event types must be literal JSON strings.
// Arrays must not be coerced into valid supplier IDs or physical stock events.
export function normalizeManualStockEvent(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("Stock event evidence is required.");
  const source=input as Record<string,unknown>;
  const fabricId=typeof source.fabricId==="string"?source.fabricId.trim().slice(0,160):"";
  const eventType=(typeof source.eventType==="string"?source.eventType:"") as StockEventType;
  const quantityMetres=exactStockMetres(source.quantityMetres,"Stock quantity",100000);
  const note=String(source.note||"").replace(/\s+/g," ").trim().slice(0,600);
  const recordedBy=literalStockEvidence(source.recordedBy,120);
  const sourceReference=literalStockEvidence(source.sourceReference,240);

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
  const fabricId=typeof source.fabricId==="string"?source.fabricId.trim().slice(0,160):"";
  const revisionId=typeof source.revisionId==="string"?source.revisionId.trim().slice(0,220):"";
  const requestKey=typeof source.requestKey==="string"?source.requestKey.trim().slice(0,180):"";
  const quantityMetres=exactStockMetres(source.quantityMetres,"Stock quantity",100000);
  const requestedBy=literalStockEvidence(source.requestedBy,120);
  const sourceReference=literalStockEvidence(source.sourceReference,240);

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
  // A JSON array or object must not coerce into a privileged reservation identity.
  const reservationId=typeof source.reservationId==="string"?source.reservationId.trim():"";
  const actualMetres=exactStockMetres(source.actualMetres,"Actual consumed metres",100);
  const note=String(source.note||"").replace(/\s+/g," ").trim().slice(0,600);
  const checkedBy=literalStockEvidence(source.checkedBy,120);
  const sourceReference=literalStockEvidence(source.sourceReference,240);

  if(!RESERVATION_UUID.test(reservationId)) throw new Error("Valid reservation ID is required.");
  
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
  // A JSON array or object must not coerce into a privileged reservation identity.
  const reservationId=typeof source.reservationId==="string"?source.reservationId.trim():"";
  const note=String(source.note||"").replace(/\s+/g," ").trim().slice(0,600);
  const releasedBy=literalStockEvidence(source.releasedBy,120);
  const sourceReference=literalStockEvidence(source.sourceReference,240);
  if(!RESERVATION_UUID.test(reservationId)) throw new Error("Valid reservation ID is required.");
  if(releasedBy.length<2) throw new Error("Named reservation release checker is required.");
  if(sourceReference.length<3) throw new Error("Reservation release reference is required.");
  return {reservationId,note,releasedBy,sourceReference};
}
