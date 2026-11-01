"use strict";

// Synthetic inventory for isolated GitHub Actions browser tests ONLY.
// NEVER imported by the application, deployed, or treated as real physical stock.
// The public/customer path must continue to fail closed on missing real ledger rows.
const http=require("node:http");
const FIXTURE_KEY="sb_secret_titan_ci_fixture_only";
const FIXTURE_PORT=54324;
const STOCK_PATH="/rest/v1/rpc/fabric_stock_snapshot_v2";
const AUDIT_PATH="/rest/v1/rpc/fabric_stock_source_audit_v1";
const BETA_LIST_PATH="/rest/v1/rpc/launch_beta_attempt_list";
const CHECKLIST_LIST_PATH="/rest/v1/rpc/launch_checklist_event_list";
const QUOTE_LIST_PATH="/rest/v1/rpc/production_quote_list";
const ORDER_LIST_PATH="/rest/v1/rpc/production_order_list";
const ELIGIBILITY_LIST_PATH="/rest/v1/rpc/production_delivery_eligibility_list";
const STATUS_RECEIPT_LOOKUP_PATH="/rest/v1/rpc/production_status_request_receipt_lookup";
const CREATION_RECEIPT_LOOKUP_PATH="/rest/v1/rpc/production_creation_request_receipt_lookup";
const CI_CREATION_REQUEST_KEY="123e4567-e89b-42d3-a456-426614174071";
const CI_STATUS_REQUEST_KEY="123e4567-e89b-42d3-a456-426614174070";
// Read-only receipt response modes are synthetic and isolated to CI.
let ciStatusReceiptMode="valid";
let ciCreationReceiptMode="valid";
// Only the local GitHub Actions fake server can switch this. NEVER imported or
// used to synthesize actual physical QC, order delivery or supplier receipts.
let ciEligibilityMode="absent";
// CI-only optional evidence failures, never used by runtime production routes.
let ciOptionalLedgerMode="normal";
const CI_ELIGIBILITY_EXAMPLE=Object.freeze({
  order_id:"123e4567-e89b-42d3-a456-426614174051",
  revision_id:"CI-LOCKED-DESIGN-M117",recipe_hash:"f".repeat(64),
  status:"ready",updated_at:"2026-10-31T18:59:00Z",eligible:true,
});
const DELIVERY_EVIDENCE_LIST_PATH="/rest/v1/rpc/production_delivery_evidence_list";
const DELIVERY_FIRST_TEN_PATH="/rest/v1/rpc/production_first_ten_delivery_audit";
const QC_LIST_PATH="/rest/v1/rpc/finished_garment_qc_list";
const CUSTOMER_OUTCOME_LIST_PATH="/rest/v1/rpc/production_customer_outcome_list";
const OUTCOME_LEARNING_PATH="/rest/v1/rpc/production_customer_outcome_learning_list";
const OUTCOME_REVIEW_PATH="/rest/v1/rpc/production_customer_outcome_review_list";
const OUTCOME_POLICY_PATH="/rest/v1/rpc/production_customer_outcome_policy_list";
const OUTCOME_REVIEW_RECORD_PATH="/rest/v1/rpc/production_customer_outcome_review_record";
const OUTCOME_POLICY_RECORD_PATH="/rest/v1/rpc/production_customer_outcome_policy_record";
// Deliberately negative, fictional customer feedback; never a real delivery.
const OUTCOME_REVIEW_FIXTURE=Object.freeze({
  [OUTCOME_LEARNING_PATH]:[{
    outcome_id:"123e4567-e89b-42d3-a456-426614174013",
    order_id:"123e4567-e89b-42d3-a456-426614174011",
    revision_id:"LE-LOCK-CI-QUOTE-20261031",
    overall_rating:"needs_work",fit_result:"major_alteration",
    worn_confirmed:true,note:"CI only; fit is NOT satisfactory",
    created_at:"2026-10-31T03:00:00Z",
    secret_customer_phone:"DO-NOT-LEAK-CI-OUTCOME-REVIEW",
    learning_context:{
      version:"linen-earth-production-learning-context-v1",
      revisionId:"LE-LOCK-CI-QUOTE-20261031",
      recipeHash:"a".repeat(64),
      fabrics:{shirtId:"ci-shirt",trouserId:"ci-trouser",
        secret_supplier:"DO-NOT-LEAK-CI-OUTCOME-FABRIC"},
      context:{occasion:"Semi-Formal",secret_customer:"DO-NOT-LEAK-CI-OUTCOME-NESTED"},
      shirt:{fit:"Regular",wear:"Tucked",collar:"Point",cuff:"Barrel"},
      trouser:{shape:"Pleated",rise:"Mid Rise",break:"Slight Break"},
      hidden_cost:"DO-NOT-LEAK-CI-OUTCOME-CONTEXT",
    },
  }],
  [OUTCOME_REVIEW_PATH]:[{
    review_id:"123e4567-e89b-42d3-a456-426614174015",
    outcome_id:"123e4567-e89b-42d3-a456-426614174013",
    decision:"rejected",reviewer:"CI-only reviewer",
    note:"Await physical inspection",created_at:"2026-10-31T04:00:00Z",
    private_reviewer_contact:"DO-NOT-LEAK-CI-REVIEWER",
  }],
  [OUTCOME_POLICY_PATH]:[{
    policy_id:"123e4567-e89b-42d3-a456-426614174016",
    minimum_approved_cases:2,approved_by:"CI-only owner",
    note:"Human owner approval still required",created_at:"2026-10-31T04:30:00Z",
    private_signoff_token:"DO-NOT-LEAK-CI-POLICY",
  }],
});
// Isolated CI-only write/readback. One negative review and one high-threshold
// policy can be recorded; neither is real human approval or a live DB write.
const CI_REVIEW_RECEIPT="123e4567-e89b-42d3-a456-426614174037";
const CI_POLICY_RECEIPT="123e4567-e89b-42d3-a456-426614174038";
const ciRecordedReviews=[];
const ciRecordedPolicies=[];
const LEARNING_CONTEXT_LIST_PATH="/rest/v1/rpc/production_order_learning_context_list";
const LEARNING_CONTEXT_LISTS=Object.freeze({
  [LEARNING_CONTEXT_LIST_PATH]:[{
    order_id:"123e4567-e89b-42d3-a456-426614174011",
    revision_id:"LE-LOCK-CI-QUOTE-20261031",
    recipe_hash:"a".repeat(64),
    created_at:"2026-10-31T02:30:00Z",
    private_supplier_account:"DO-NOT-LEAK-CI-LEARNING-ROW",
    context:{
      version:"linen-earth-production-learning-context-v1",
      revisionId:"LE-LOCK-CI-QUOTE-20261031",
      recipeHash:"a".repeat(64),
      source:{
        designerRuleSetVersion:"ci-only-rules",fitConstructionVersion:null,
        styleSchemaVersion:2,private_optimizer_key:"DO-NOT-LEAK-CI-LEARNING-SOURCE",
      },
      context:{occasion:"Semi-Formal",climate:"Cool",intention:"Balanced",
        private_customer_phone:"DO-NOT-LEAK-CI-LEARNING-CONTEXT"},
      fabrics:{shirtId:"ci-shirt",trouserId:"ci-trouser",
        private_roll_supplier:"DO-NOT-LEAK-CI-LEARNING-FABRIC"},
      shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",
        cuff:"Barrel",placket:"Standard",button:"Corozo",
        internal_wholesale_cost:"DO-NOT-LEAK-CI-LEARNING-SHIRT"},
      trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",
        break:"Slight Break",private_factory_cost:"DO-NOT-LEAK-CI-LEARNING-TROUSER"},
      creative:{conceptId:"ci-concept",explorationClass:"essential",
        treatmentIds:["ci-treatment-1"],patternId:null,
        private_user_note:"DO-NOT-LEAK-CI-LEARNING-CREATIVE"},
      private_client_record:"DO-NOT-LEAK-CI-LEARNING-NESTED",
    },
  }],
});
const CUSTOMER_OUTCOME_LISTS=Object.freeze({
  [CUSTOMER_OUTCOME_LIST_PATH]:[{
    outcome_id:"123e4567-e89b-42d3-a456-426614174013",
    order_id:"123e4567-e89b-42d3-a456-426614174011",
    revision_id:"LE-LOCK-CI-QUOTE-20261031",
    overall_rating:"needs_work",fit_result:"major_alteration",
    worn_confirmed:true,note:"CI only: physical fit NOT approved",
    created_at:"2026-10-31T03:00:00Z",
    private_customer_contact:"DO-NOT-LEAK-CI-OUTCOME",
    private_shop_account:"DO-NOT-LEAK-CI-ACCOUNT",
  }],
});
const PRODUCTION_LISTS=Object.freeze({
  [QUOTE_LIST_PATH]:[{
    quote_id:"123e4567-e89b-42d3-a456-426614174010",
    revision_id:"LE-LOCK-CI-QUOTE-20261031",
    recipe_hash:"a".repeat(64),currency:"INR",
    line_items:[{label:"CI-only stitched garment",amount:1000,
      secret_factory_cost:"DO-NOT-LEAK-CI-LINE-ITEM"}],
    subtotal:1000,adjustment:0,total:1000,note:"CI-only private quote",
    status:"accepted",created_at:"2026-10-31T00:00:00Z",
    updated_at:"2026-10-31T00:00:00Z",
    private_customer_phone:"DO-NOT-LEAK-CI-QUOTE",
  }],
  [ORDER_LIST_PATH]:[{
    order_id:"123e4567-e89b-42d3-a456-426614174011",
    revision_id:"LE-LOCK-CI-QUOTE-20261031",
    recipe_hash:"a".repeat(64),
    quote_id:"123e4567-e89b-42d3-a456-426614174010",
    status:"created",note:"CI-only production order",
    created_at:"2026-10-31T01:00:00Z",updated_at:"2026-10-31T01:00:00Z",
    private_supplier_rate:"DO-NOT-LEAK-CI-ORDER",
  }],
});
// CI-only adverse delivery history: manual re-entry happened; release gate OPEN.
// Poisoned fields must never reach an authenticated operator browser.
const DELIVERY_FIXTURE_ORDER=Object.freeze({
  order_id:"123e4567-e89b-42d3-a456-426614174031",
  revision_id:"CI-DELIVERY-LOCKED-20261031",recipe_hash:"b".repeat(64),
  status:"delivered",note:"CI fake delivery, not a real garment",
  created_at:"2026-10-31T01:00:00Z",delivered_at:"2026-10-31T03:00:00Z",
  private_customer_contact:"DO-NOT-LEAK-CI-DELIVERY-ORDER",
  private_supplier_cost:"DO-NOT-LEAK-CI-DELIVERY-COST",
});
const DELIVERY_FIXTURE_EVIDENCE=Object.freeze({
  evidence_id:"123e4567-e89b-42d3-a456-426614174032",
  order_id:DELIVERY_FIXTURE_ORDER.order_id,
  revision_id:DELIVERY_FIXTURE_ORDER.revision_id,
  recipe_hash:DELIVERY_FIXTURE_ORDER.recipe_hash,
  manual_design_reentry:true,reentry_fields:["fabric_identity"],
  note:"CI-only manual re-entry was recorded",operator:"CI checker",
  evidence_reference:"CI-JOB-CARD-DELIVERY-001",
  created_at:"2026-10-31T04:00:00Z",order_created_at:DELIVERY_FIXTURE_ORDER.created_at,
  private_supplier_phone:"DO-NOT-LEAK-CI-DELIVERY-EVIDENCE",
});
const DELIVERY_FIXTURE_BASIS=Object.freeze({
  version:"linen-earth-production-first-ten-audit-v2",historyValid:true,
  orders:[{...DELIVERY_FIXTURE_ORDER,
    private_factory_cost:"DO-NOT-LEAK-CI-FIRSTTEN-ORDER"}],
  evidence:[{...DELIVERY_FIXTURE_EVIDENCE,
    private_customer_token:"DO-NOT-LEAK-CI-FIRSTTEN-EVIDENCE"}],
  private_owner_passphrase:"DO-NOT-LEAK-CI-FIRSTTEN-BASIS",
});
const QC_LISTS=Object.freeze({
  [QC_LIST_PATH]:[{
    inspection_id:"123e4567-e89b-42d3-a456-426614174012",
    order_id:"123e4567-e89b-42d3-a456-426614174011",
    revision_id:"LE-LOCK-CI-QUOTE-20261031",
    recipe_hash:"a".repeat(64),decision:"rework",
    checks:{recipe_match:false,fabric_match:false,measurement_check:false,
      pattern_alignment:false,stitching_finish:false,clean_damage_free:false},
    defects:["stitching"],note:"Synthetic rework; never physical approval",
    inspector:"CI-only checker",inspection_reference:"CI-UNVERIFIED-001",
    created_at:"2026-10-31T02:00:00Z",
    private_customer_phone:"DO-NOT-LEAK-CI-QC",
  }],
});
const LAUNCH_LISTS=Object.freeze({
  [BETA_LIST_PATH]:[{
    attempt_id:"123e4567-e89b-42d3-a456-426614174001",
    case_id:"CI-BETA-PRIVATE-001",device_class:"mobile",
    core_flow_completed:false,design_locked:true,
    share_or_enquiry_completed:false,blocking_bug:true,
    note:"CI-only incomplete flow",revision_id:null,recipe_hash:null,
    evidence_kind:null,share_audit_confirmed:false,
    enquiry_audit_confirmed:false,created_at:"2026-10-31T00:00:00Z",
    private_customer_phone:"DO-NOT-LEAK-CI-PHONE",
  }],
  [CHECKLIST_LIST_PATH]:[{
    event_id:"123e4567-e89b-42d3-a456-426614174002",
    item_id:"privacy_notice",status:"review",signed_by:"Synthetic Reviewer",
    note:"CI only, human approval pending",created_at:"2026-10-31T00:00:00Z",
    private_supplier_document:"DO-NOT-LEAK-CI-SUPPLIER",
  }],
});
const METADATA_PATH="/rest/v1/style_events";
// An intentionally ANOMALOUS, fictional CI ledger audit. Never call it real
// supplier evidence, stock readiness or an authorized production read.
const AUDIT_FIXTURE=Object.freeze({
  reservationRows:3,duplicateLineGroups:1,duplicateLineRows:2,
  missingLockedRevision:1,missingSource:1,missingChecker:1,
  missingRequestKey:0,missingReservationUuid:0,paddedSource:0,
  placeholderSource:1,
});

function rowsFor(payload){
  const ids=payload?.p_fabric_ids;
  if(!Array.isArray(ids)||ids.length>500||ids.some(id=>typeof id!=="string"||id.length<1||id.length>160||id!==id.trim())) return null;
  if(new Set(ids).size!==ids.length) return null;
  // Deliberately synthesized only inside the GitHub Actions mock server.
  return ids.map(fabric_id=>({fabric_id,available_metres:"5.000",provenance_ready:true,
    manual_event_count:1,provenance_event_count:1,legacy_unverified_event_count:0}));
}
// A reachable, genuinely empty metadata ledger is different from a 404 or
// timeout. Only isolated CI browser QA may use this deliberately synthetic
// empty ledger: it is NEVER an operator sold-out review or supplier receipt.
function metadataRowsFor(method,path,apiKey) {
  if(method!=="GET"||typeof path!=="string"||apiKey!==FIXTURE_KEY) return null;
  const url=new URL(path,"http://127.0.0.1");
  if(url.pathname!==METADATA_PATH) return null;
  if(url.searchParams.get("type")!=="eq.operator_note"||
     url.searchParams.get("source")!=="eq.operator") return null;
  return [];
}
function send(res,status,payload){
  res.writeHead(status,{"content-type":"application/json","cache-control":"private, no-store"});
  res.end(JSON.stringify(payload));
}
async function handle(req,res){
  if(req.method==="GET"&&req.url==="/__fixture/health") return send(res,200,{ciFixture:true,physicalEvidence:false});
  // A private, loopback-only test switch. Production never has this route.
  // Deliberately uses a CI-only secret so public/browser requests cannot
  // alter fake service responses while a test is running.
  if(req.method==="POST"&&req.url==="/__fixture/eligibility-mode"){
    if(req.headers.apikey!==FIXTURE_KEY) return send(res,403,{error:"Not a CI fixture request"});
    let raw="";
    for await(const chunk of req){
      raw+=chunk.toString("utf8");
      if(Buffer.byteLength(raw)>128)return send(res,413,{error:"CI mode too large"});
    }
    let mode;
    try{mode=JSON.parse(raw).mode;}catch{return send(res,400,{error:"Invalid CI mode"});}
    if(!["absent","valid","poisoned"].includes(mode))
      return send(res,400,{error:"Invalid CI eligibility mode"});
    ciEligibilityMode=mode;
    return send(res,200,{ciFixture:true,mode});
  }
  if(req.method==="POST"&&req.url==="/__fixture/optional-ledger-mode"){
    if(req.headers.apikey!==FIXTURE_KEY) return send(res,403,{error:"Not a CI fixture request"});
    let raw="";
    for await(const chunk of req){
      raw+=chunk.toString("utf8");
      if(Buffer.byteLength(raw)>128)return send(res,413,{error:"CI mode too large"});
    }
    let mode;
    try{mode=JSON.parse(raw).mode;}catch{return send(res,400,{error:"Invalid CI mode"});}
    if(!["normal","missing","gateway404","other404","oversized404"].includes(mode))
      return send(res,400,{error:"Invalid CI optional evidence mode"});
    ciOptionalLedgerMode=mode;
    return send(res,200,{ciFixture:true,mode});
  }
  if(req.method==="POST"&&req.url==="/__fixture/status-receipt-mode"){
    if(req.headers.apikey!==FIXTURE_KEY) return send(res,403,{error:"Not a CI fixture request"});
    let raw="";
    for await(const chunk of req){
      raw+=chunk.toString("utf8");
      if(Buffer.byteLength(raw)>128)return send(res,413,{error:"CI mode too large"});
    }
    let mode;
    try{mode=JSON.parse(raw).mode;}catch{return send(res,400,{error:"Invalid CI mode"});}
    if(!["valid","empty","malformed","duplicate","missing","upstream","oversized"].includes(mode))
      return send(res,400,{error:"Invalid CI status receipt mode"});
    ciStatusReceiptMode=mode;
    return send(res,200,{ciFixture:true,mode});
  }
  if(req.method==="POST"&&req.url==="/__fixture/creation-receipt-mode"){
    if(req.headers.apikey!==FIXTURE_KEY) return send(res,403,{error:"Not a CI fixture request"});
    let raw="";
    for await(const chunk of req){
      raw+=chunk.toString("utf8");
      if(Buffer.byteLength(raw)>128)return send(res,413,{error:"CI mode too large"});
    }
    let mode;
    try{mode=JSON.parse(raw).mode;}catch{return send(res,400,{error:"Invalid CI mode"});}
    if(!["valid","empty","malformed","duplicate","missing","upstream","oversized"].includes(mode))
      return send(res,400,{error:"Invalid CI creation receipt mode"});
    ciCreationReceiptMode=mode;
    return send(res,200,{ciFixture:true,mode});
  }
  if(req.method==="GET"&&req.url?.startsWith(METADATA_PATH+"?")){
    const rows=metadataRowsFor(req.method,req.url,req.headers.apikey);
    if(rows===null||req.headers.prefer!=="count=exact") return send(res,403,{error:"Not a CI metadata fixture request"});
    res.writeHead(200,{"content-type":"application/json","cache-control":"private, no-store","content-range":"*/0"});
    return res.end(JSON.stringify(rows));
  }
  if(req.method!=="POST"||![ELIGIBILITY_LIST_PATH,STOCK_PATH,AUDIT_PATH,BETA_LIST_PATH,CHECKLIST_LIST_PATH,QUOTE_LIST_PATH,ORDER_LIST_PATH,DELIVERY_EVIDENCE_LIST_PATH,DELIVERY_FIRST_TEN_PATH,QC_LIST_PATH,CUSTOMER_OUTCOME_LIST_PATH,LEARNING_CONTEXT_LIST_PATH,OUTCOME_LEARNING_PATH,OUTCOME_REVIEW_PATH,OUTCOME_POLICY_PATH,OUTCOME_REVIEW_RECORD_PATH,OUTCOME_POLICY_RECORD_PATH,STATUS_RECEIPT_LOOKUP_PATH,CREATION_RECEIPT_LOOKUP_PATH].includes(req.url)) return send(res,404,{error:"Unknown CI mock route"});
  if(req.headers.apikey!==FIXTURE_KEY) return send(res,403,{error:"Not a CI fixture request"});
  let raw="";
  try{
    for await (const chunk of req){
      raw+=chunk.toString("utf8");
      if(Buffer.byteLength(raw)>8192) return send(res,413,{error:"CI fixture request too large"});
    }
    const payload=JSON.parse(raw);
    if(req.url===CREATION_RECEIPT_LOOKUP_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         Object.keys(payload).join(",")!=="p_request_key"||
         payload.p_request_key!==CI_CREATION_REQUEST_KEY)
        return send(res,400,{error:"CI-only original creation request UUID required"});
      if(ciCreationReceiptMode==="empty")return send(res,200,[]);
      if(ciCreationReceiptMode==="missing")return send(res,404,{code:"PGRST202",message:"CI-only creation migration absent"});
      if(ciCreationReceiptMode==="upstream")return send(res,503,{error:"DO-NOT-LEAK-CI-CREATION-UPSTREAM"});
      if(ciCreationReceiptMode==="oversized")return send(res,200,[{padding:"DO-NOT-LEAK-CI-CREATION-"+"x".repeat(270000)}]);
      const quote={action:"create_quote",receipt_id:"123e4567-e89b-42d3-a456-426614174010"};
      const order={action:"create_order",receipt_id:"123e4567-e89b-42d3-a456-426614174011"};
      if(ciCreationReceiptMode==="malformed")return send(res,200,[{...quote,private_customer_phone:"DO-NOT-LEAK-CI-CREATION-PRIVATE"}]);
      if(ciCreationReceiptMode==="duplicate")return send(res,200,[quote,quote]);
      return send(res,200,[quote,order]);
    }
    if(req.url===STATUS_RECEIPT_LOOKUP_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         Object.keys(payload).join(",")!=="p_request_key"||
         payload.p_request_key!==CI_STATUS_REQUEST_KEY)
        return send(res,400,{error:"CI-only exact original request UUID required"});
      if(ciStatusReceiptMode==="empty")return send(res,200,[]);
      if(ciStatusReceiptMode==="missing")return send(res,404,{code:"PGRST202",message:"CI-only migration absent"});
      if(ciStatusReceiptMode==="upstream")return send(res,503,{error:"DO-NOT-LEAK-CI-UPSTREAM-RECEIPT"});
      if(ciStatusReceiptMode==="oversized")return send(res,200,[{padding:"DO-NOT-LEAK-CI-"+ "x".repeat(270000)}]);
      const quote={action:"quote_status",record_id:"123e4567-e89b-42d3-a456-426614174010",target_status:"accepted"};
      const order={action:"order_status",record_id:"123e4567-e89b-42d3-a456-426614174011",target_status:"delivered"};
      if(ciStatusReceiptMode==="malformed")return send(res,200,[{...quote,private_customer_phone:"DO-NOT-LEAK-CI-RECEIPT"}]);
      if(ciStatusReceiptMode==="duplicate")return send(res,200,[quote,quote]);
      return send(res,200,[quote,order]);
    }
    if([QC_LIST_PATH,CUSTOMER_OUTCOME_LIST_PATH,LEARNING_CONTEXT_LIST_PATH].includes(req.url)
       &&ciOptionalLedgerMode!=="normal"){
      if(ciOptionalLedgerMode==="missing") return send(res,404,{code:"PGRST202",message:"CI-only missing function"});
      if(ciOptionalLedgerMode==="gateway404") return send(res,404,{error:"CI-only gateway route not found"});
      if(ciOptionalLedgerMode==="other404") return send(res,404,{code:"PGRST116",message:"CI-only unrelated PostgREST 404"});
      if(ciOptionalLedgerMode==="oversized404") return send(res,404,{code:"PGRST202",padding:"x".repeat(5000)});
    }
    if(req.url===ELIGIBILITY_LIST_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         payload.p_limit!==100||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid CI eligibility read request"});
      if(ciEligibilityMode==="absent") return send(res,404,{error:"CI SQL RPC not installed"});
      if(ciEligibilityMode==="poisoned")
        return send(res,200,[{...CI_ELIGIBILITY_EXAMPLE,
          inspection_reference:"DO-NOT-LEAK-CI-QC-PROVENANCE"}]);
      return send(res,200,[CI_ELIGIBILITY_EXAMPLE]);
    }
    if(req.url===QUOTE_LIST_PATH||req.url===ORDER_LIST_PATH){
      // The production desk uses 100-row pages. Delivery evidence uses its
      // own 500-row browse contract; keep the synthetic shapes independent.
      if(req.url===ORDER_LIST_PATH&&payload?.p_limit===500
        &&Object.keys(payload).length===1)
        return send(res,200,[DELIVERY_FIXTURE_ORDER]);
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         payload.p_limit!==100||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid CI production page request"});
      return send(res,200,PRODUCTION_LISTS[req.url]);
    }
    if(req.url===DELIVERY_EVIDENCE_LIST_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)
        ||payload.p_limit!==500||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid CI delivery browse request"});
      return send(res,200,[DELIVERY_FIXTURE_EVIDENCE]);
    }
    if(req.url===DELIVERY_FIRST_TEN_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)
        ||Object.keys(payload).length!==0)
        return send(res,400,{error:"Invalid CI first-ten audit request"});
      return send(res,200,DELIVERY_FIXTURE_BASIS);
    }
    if(req.url===OUTCOME_REVIEW_RECORD_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)
        ||Object.keys(payload).sort().join(",")!=="p_decision,p_note,p_outcome_id,p_reviewer"
        ||payload.p_outcome_id!==OUTCOME_REVIEW_FIXTURE[OUTCOME_LEARNING_PATH][0].outcome_id
        ||payload.p_decision!=="rejected"
        ||payload.p_reviewer!=="CI synthetic reviewer"
        ||payload.p_note!=="CI synthetic review: actual tailoring fit unverified")
        return send(res,400,{error:"CI only: invalid synthetic review write"});
      if(ciRecordedReviews.length)return send(res,409,{error:"CI review already recorded"});
      ciRecordedReviews.push({
        review_id:CI_REVIEW_RECEIPT,outcome_id:payload.p_outcome_id,
        decision:payload.p_decision,reviewer:payload.p_reviewer,
        note:payload.p_note,created_at:new Date().toISOString(),
        private_reviewer_secret:"DO-NOT-LEAK-CI-POST-REVIEW",
      });
      return send(res,200,CI_REVIEW_RECEIPT);
    }
    if(req.url===OUTCOME_POLICY_RECORD_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)
        ||Object.keys(payload).sort().join(",")!=="p_approved_by,p_minimum_approved_cases,p_note"
        ||payload.p_minimum_approved_cases!==3
        ||payload.p_approved_by!=="CI synthetic policy signer"
        ||payload.p_note!=="CI only: three authentic customer approvals still required")
        return send(res,400,{error:"CI only: invalid synthetic policy write"});
      if(ciRecordedPolicies.length)return send(res,409,{error:"CI policy already recorded"});
      ciRecordedPolicies.push({
        policy_id:CI_POLICY_RECEIPT,minimum_approved_cases:payload.p_minimum_approved_cases,
        approved_by:payload.p_approved_by,note:payload.p_note,
        created_at:new Date().toISOString(),
        private_policy_secret:"DO-NOT-LEAK-CI-POST-POLICY",
      });
      return send(res,200,CI_POLICY_RECEIPT);
    }
    if([OUTCOME_LEARNING_PATH,OUTCOME_REVIEW_PATH,OUTCOME_POLICY_PATH].includes(req.url)){
      const limit=req.url===OUTCOME_LEARNING_PATH?1000:req.url===OUTCOME_REVIEW_PATH?5000:100;
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         payload.p_limit!==limit||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid synthetic outcome learning review request"});
      return send(res,200,req.url===OUTCOME_REVIEW_PATH
        ?[...ciRecordedReviews,...OUTCOME_REVIEW_FIXTURE[req.url]]
        :req.url===OUTCOME_POLICY_PATH
          ?[...ciRecordedPolicies,...OUTCOME_REVIEW_FIXTURE[req.url]]
          :OUTCOME_REVIEW_FIXTURE[req.url]);
    }
    if(req.url===LEARNING_CONTEXT_LIST_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         payload.p_limit!==500||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid synthetic learning context list request"});
      return send(res,200,LEARNING_CONTEXT_LISTS[req.url]);
    }
    if(req.url===CUSTOMER_OUTCOME_LIST_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         payload.p_limit!==250||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid synthetic outcome list request"});
      return send(res,200,CUSTOMER_OUTCOME_LISTS[req.url]);
    }
    if(req.url===QC_LIST_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         payload.p_limit!==250||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid CI QC evidence page request"});
      return send(res,200,QC_LISTS[req.url]);
    }
    if(req.url===BETA_LIST_PATH||req.url===CHECKLIST_LIST_PATH){
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         payload.p_limit!==500||Object.keys(payload).length!==1)
        return send(res,400,{error:"Invalid CI launch evidence request"});
      return send(res,200,LAUNCH_LISTS[req.url]);
    }
    if(req.url===AUDIT_PATH){
      // The only body accepted by the real read-only RPC is an empty object.
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
         Object.keys(payload).length!==0)
        return send(res,400,{error:"Invalid CI audit invocation"});
      return send(res,200,AUDIT_FIXTURE);
    }
    const rows=rowsFor(payload);
    if(!rows) return send(res,400,{error:"Invalid CI fixture fabric IDs"});
    return send(res,200,rows);
  }catch{return send(res,400,{error:"Invalid CI fixture request"});}
}
if(require.main===module){
  if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
    console.error("Refusing synthetic stock fixture outside GitHub Actions CI");
    process.exit(2);
  }
  http.createServer((req,res)=>{void handle(req,res);}).listen(FIXTURE_PORT,"127.0.0.1",()=>{
    console.log("Synthetic CI-only stock fixture listening on loopback; NOT physical evidence");
  });
}
module.exports={rowsFor,metadataRowsFor,handle,FIXTURE_KEY,STOCK_PATH,AUDIT_PATH,AUDIT_FIXTURE,BETA_LIST_PATH,CHECKLIST_LIST_PATH,LAUNCH_LISTS,QUOTE_LIST_PATH,ORDER_LIST_PATH,PRODUCTION_LISTS,QC_LIST_PATH,QC_LISTS,CUSTOMER_OUTCOME_LIST_PATH,CUSTOMER_OUTCOME_LISTS,LEARNING_CONTEXT_LIST_PATH,LEARNING_CONTEXT_LISTS,OUTCOME_LEARNING_PATH,OUTCOME_REVIEW_PATH,OUTCOME_POLICY_PATH,OUTCOME_REVIEW_RECORD_PATH,OUTCOME_POLICY_RECORD_PATH,CI_REVIEW_RECEIPT,CI_POLICY_RECEIPT,OUTCOME_REVIEW_FIXTURE,METADATA_PATH,DELIVERY_EVIDENCE_LIST_PATH,DELIVERY_FIRST_TEN_PATH,DELIVERY_FIXTURE_ORDER,DELIVERY_FIXTURE_EVIDENCE,DELIVERY_FIXTURE_BASIS};
