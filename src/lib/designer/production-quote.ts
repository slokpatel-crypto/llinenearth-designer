export type ProductionQuoteLine={label:string;amount:number};

export type ProductionQuoteDraft={
  currency:string;
  lineItems:ProductionQuoteLine[];
  adjustment:number;
  subtotal:number;
  total:number;
};

/** Human-entered money cannot be coerced from null/boolean/hex/exponent. */
function enteredMoney(raw:unknown,label:string):number {
  if(typeof raw==="number") return raw;
  if(typeof raw==="string" && /^(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  throw new Error(`Invalid ${label}.`);
}

export function normalizeProductionQuoteDraft(input:{
  currency?:unknown;
  lineItems?:unknown;
  adjustment?:unknown;
}):ProductionQuoteDraft{
  const currency=String(input.currency||"INR").trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid quote currency.");

  if(!Array.isArray(input.lineItems) || input.lineItems.length<1 || input.lineItems.length>30) {
    throw new Error("Quote must contain 1 to 30 line items.");
  }

  const lineItems:ProductionQuoteLine[]=input.lineItems.map((raw)=>{
    const item=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
    const label=String(item.label||"").trim().slice(0,160);
    const amount=enteredMoney(item.amount,"quote line item amount");
    if(!label) throw new Error("Quote line item label is required.");
    if(!Number.isFinite(amount)||amount<0||amount>10_000_000) throw new Error("Invalid quote line item amount.");
    return {label,amount:Math.round(amount*100)/100};
  });

  const adjustment=input.adjustment===undefined ? 0 : enteredMoney(input.adjustment,"quote adjustment");
  if(!Number.isFinite(adjustment)||Math.abs(adjustment)>10_000_000) throw new Error("Invalid quote adjustment.");

  const subtotal=Math.round(lineItems.reduce((sum,item)=>sum+item.amount,0)*100)/100;
  const total=Math.round((subtotal+adjustment)*100)/100;
  if(total<0) throw new Error("Quote total cannot be negative.");

  return {currency,lineItems,adjustment:Math.round(adjustment*100)/100,subtotal,total};
}
