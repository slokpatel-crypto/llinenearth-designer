import {parseVaultTimestamptz} from "./vault-read-integrity.ts";

const CURSOR_ID=/^[A-Za-z0-9_:/-]{1,160}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const MAX_OPERATOR_SYNC_EVENTS=250;
export const MAX_OPERATOR_SYNC_BODY_BYTES=256_000;

export type OperatorSyncCursor={receivedAt:string;id:string|null};
export type OperatorSyncPage={limit:number;cursor:OperatorSyncCursor|null};

/** PostgREST filters are syntax, not SQL parameters: never interpolate arbitrary cursor text. */
export function validOperatorSyncId(value:unknown):value is string{
  return typeof value==="string"&&CURSOR_ID.test(value);
}
export function validOperatorSyncSession(value:unknown):value is string{
  return typeof value==="string"&&value.length>=1&&value.length<=140&&!/[\x00-\x1f\x7f]/.test(value);
}
export function validOperatorSyncTimestamp(value:unknown):value is string{
  return typeof value==="string"&&parseVaultTimestamptz(value)!==null;
}
export function validOperatorLocalDate(value:unknown):value is string{
  return typeof value==="string"&&DATE.test(value)&&
    parseVaultTimestamptz(value+"T00:00:00Z")!==null;
}
export function validOperatorLocalDateTime(value:unknown):value is string{
  return typeof value==="string"&&LOCAL_TIME.test(value)&&
    parseVaultTimestamptz(value+":00Z")!==null;
}
export function operatorSyncNumber(value:unknown,min:number,max:number):number|null{
  return typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
}

export function parseOperatorSyncPage(url:URL):OperatorSyncPage|null{
  const rawLimit=url.searchParams.get("limit");
  if(rawLimit!==null&&!/^[0-9]{1,8}$/.test(rawLimit))return null;
  const parsed=rawLimit===null?500:Number(rawLimit);
  if(!Number.isSafeInteger(parsed)||parsed<1)return null;
  const limit=Math.min(1000,parsed);
  const rawCursor=url.searchParams.get("cursor");
  if(rawCursor===null)return {limit,cursor:null};
  if(rawCursor.length>260||!rawCursor.length)return null;
  const split=rawCursor.lastIndexOf("|");
  const receivedAt=split<0?rawCursor:rawCursor.slice(0,split);
  const id=split<0?null:rawCursor.slice(split+1);
  if(!validOperatorSyncTimestamp(receivedAt)||
     (id!==null&&!validOperatorSyncId(id)))return null;
  return {limit,cursor:{receivedAt,id}};
}

/** Do not silently discard event 251 or coerce a malformed batch into an empty success. */
export class OperatorSyncBatchError extends Error{
  readonly status:number;
  constructor(message:string,status:number=400){super(message);this.status=status;}
}
export async function readOperatorSyncBatch(request:Request):Promise<unknown[]>{
  if(!request.body)throw new OperatorSyncBatchError("Operator sync JSON body is required.");
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const next=await reader.read();
      if(next.done)break;
      total+=next.value.byteLength;
      if(total>MAX_OPERATOR_SYNC_BODY_BYTES){
        await reader.cancel();
        throw new OperatorSyncBatchError("Operator sync batch is too large.",413);
      }
      chunks.push(next.value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let body:unknown;
  try{body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
  catch{throw new OperatorSyncBatchError("Operator sync body must be valid UTF-8 JSON.");}
  if(!body||typeof body!=="object"||Array.isArray(body)||
     !Array.isArray((body as Record<string,unknown>).events))
    throw new OperatorSyncBatchError("An events array is required.");
  const events=(body as {events:unknown[]}).events;
  if(events.length>MAX_OPERATOR_SYNC_EVENTS)
    throw new OperatorSyncBatchError("A sync batch cannot exceed 250 events.",413);
  return events;
}

export type OperatorSyncReadRow={
  id:string;session_id:string;type:string;at:string;source:string;
  payload:Record<string,unknown>;received_at:string;
};
/** A malformed backend page must not advance the desktop's durable cursor. */
export function validateOperatorSyncReadRows(value:unknown,limit:number):OperatorSyncReadRow[]|null{
  if(!Array.isArray(value)||value.length>limit)return null;
  let previousTime=-Infinity;
  const seenIds=new Set<string>();
  for(const row of value){
    if(!row||typeof row!=="object"||Array.isArray(row))return null;
    const item=row as Record<string,unknown>;
    if(!validOperatorSyncId(item.id)||!validOperatorSyncSession(item.session_id)||
       typeof item.type!=="string"||!item.type||typeof item.source!=="string"||
       !validOperatorSyncTimestamp(item.at)||!validOperatorSyncTimestamp(item.received_at)||
       !item.payload||typeof item.payload!=="object"||Array.isArray(item.payload))
      return null;
    const received=parseVaultTimestamptz(item.received_at)!;
    // PostgreSQL text collation and microsecond timestamps do not have
    // JavaScript's code-point/millisecond ordering. Only reject real
    // descending instants and duplicate IDs; preserve the server's tie order.
    if(received<previousTime||seenIds.has(item.id))return null;
    previousTime=received;
    seenIds.add(item.id);
  }
  return value as OperatorSyncReadRow[];
}
