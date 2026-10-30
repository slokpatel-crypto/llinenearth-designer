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
  if(typeof raw==="string" && /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  throw new Error(`Invalid ${label}.`);
}

export function normalizeProductionQuoteDraft(input:{
  currency?:unknown;
  lineItems?:unknown;
  adjustment?:unknown;
}):ProductionQuoteDraft{
  // Only an absent currency uses the legacy INR default. Arrays, objects and
  // null must not become apparently authoritative three-letter currency codes.
  const currency=input.currency===undefined?"INR":
    typeof input.currency==="string"?input.currency.trim().toUpperCase():"";
  if(!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid quote currency.");

  if(!Array.isArray(input.lineItems) || input.lineItems.length<1 || input.lineItems.length>30) {
    throw new Error("Quote must contain 1 to 30 line items.");
  }

  const lineItems:ProductionQuoteLine[]=input.lineItems.map((raw)=>{
    const item=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
    // A production quote label is an operator-entered scalar, not a coerced
    // JSON array/object or a silently truncated tailor/customer instruction.
    if(typeof item.label!=="string" || !item.label.trim())
      throw new Error("Quote line item label is required.");
    const label=item.label.trim();
    if(label.length>160 || /[\u0000-\u001F\u007F]/.test(label))
      throw new Error("Invalid quote line item label.");
    const amount=enteredMoney(item.amount,"quote line item amount");
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
