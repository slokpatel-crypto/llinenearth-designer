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
