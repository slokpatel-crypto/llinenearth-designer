/** In-memory operator-only comparison of a possibly committed write.
 * Never copy recovery tokens, browser credentials, arbitrary request objects
 * or backend errors into the review panel (or persistent browser storage). */
export type ProductionWriteReviewSummary={
  action:string;
  revisionId:string;
  recipeHash:string;
  quoteId:string;
  orderId:string;
  status:string;
  currency:string;
  note:string;
  adjustment:number|null;
  lineItems:readonly {label:string;amount:number}[];
};
export function productionWriteReviewSummary(request:Record<string,unknown>):ProductionWriteReviewSummary{
  const text=(raw:unknown,limit:number):string=>
    typeof raw==="string"?raw.trim().slice(0,limit):"";
  const action=text(request.action,32);
  const allowed=new Set(["create_quote","create_order","quote_status","order_status"]);
  const rawLines=Array.isArray(request.lineItems)?request.lineItems.slice(0,30):[];
  const lineItems: {label:string;amount:number}[]=[];
  for(const raw of rawLines){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
    const line=raw as Record<string,unknown>;
    const label=text(line.label,160);
    if(label&&typeof line.amount==="number"&&Number.isFinite(line.amount)
      &&line.amount>=0&&line.amount<=10_000_000)
      lineItems.push({label,amount:line.amount});
  }
  const adjustment=typeof request.adjustment==="number"&&Number.isFinite(request.adjustment)
    ?request.adjustment:null;
  return {
    action:allowed.has(action)?action:"unknown",
    revisionId:text(request.revisionId,220),
    recipeHash:text(request.recipeHash,64),
    quoteId:text(request.quoteId,36),
    orderId:text(request.orderId,36),
    status:text(request.status,32),
    currency:text(request.currency,3),
    note:text(request.note,1000),
    adjustment,
    lineItems,
  };
}
