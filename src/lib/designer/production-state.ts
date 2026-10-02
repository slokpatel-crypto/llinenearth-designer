export type ProductionOrderStatus="created"|"cloth_reserved"|"cutting"|"stitching"|"fitting"|"ready"|"delivered"|"cancelled";
export type ProductionQuoteStatus="draft"|"sent"|"accepted"|"void";

export const ORDER_TRANSITIONS:Record<ProductionOrderStatus,readonly ProductionOrderStatus[]>={
  created:["cloth_reserved","cancelled"],
  cloth_reserved:["cutting","cancelled"],
  cutting:["stitching","cancelled"],
  stitching:["fitting","ready","cancelled"],
  fitting:["stitching","ready","cancelled"],
  ready:["delivered","cancelled"],
  delivered:[],
  cancelled:[],
};

export const QUOTE_TRANSITIONS:Record<ProductionQuoteStatus,readonly ProductionQuoteStatus[]>={
  draft:["sent","void"],
  sent:["accepted","void"],
  accepted:[],
  void:[],
};

export function canTransitionOrder(from:ProductionOrderStatus,to:ProductionOrderStatus){
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionQuote(from:ProductionQuoteStatus,to:ProductionQuoteStatus){
  return QUOTE_TRANSITIONS[from].includes(to);
}
