export type OperatorQuoteAmountInput={label:string;amount:string};

// A blank amount must never silently become a zero-priced fabric/tailoring line.
// Explicit "0" remains valid when a true zero is the operator's decision.
export function parseOperatorQuoteLines(inputs:readonly OperatorQuoteAmountInput[]):{
  lineItems:Array<{label:string;amount:number}>;valid:boolean
}{
  const lineItems:Array<{label:string;amount:number}>=[];
  let valid=true;
  for(const input of inputs){
    const label=input.label.trim();
    const entered=input.amount.trim();
    if(!label&&!entered)continue;
    if(!label||!entered||!/^(?:\d+|\d*\.\d{1,2})$/.test(entered)){
      valid=false;continue;
    }
    const amount=Number(entered);
    if(!Number.isFinite(amount)||amount<0||amount>10_000_000){
      valid=false;continue;
    }
    lineItems.push({label,amount});
  }
  return {lineItems,valid:valid&&lineItems.length>0};
}
