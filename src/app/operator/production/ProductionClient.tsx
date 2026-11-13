"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { buildVerifiedProductionHandoff } from "@/lib/designer/production-handoff";
import { buildTailorTechPackHtml, techPackFilename } from "@/lib/designer/tech-pack";
import { buildVerifiedProductionPacket } from "@/lib/designer/production-packet";
import { ORDER_TRANSITIONS, canTransitionQuote, type ProductionOrderStatus, type ProductionQuoteStatus } from "@/lib/designer/production-state";
import {verifiedProductionMutationReadback} from "@/lib/designer/production-desk-readback";
import {isCertainProductionPrewriteRejection} from "@/lib/designer/production-post-retry";
import {isCurrentVerifiedProductionLedger} from "@/lib/designer/production-ledger-generation";
import {isCurrentVerifiedOperatorLock} from "@/lib/designer/verified-operator-lock";
import {
  PRODUCTION_WRITE_HOLD_KEY,productionWriteHoldPending,beginProductionWriteHoldAtomically,PRODUCTION_WRITE_LOCK_NAME,
  PRODUCTION_WRITE_SESSION_LOCK_NAME,
  releaseProductionWriteHold,acknowledgeProductionWriteHold,
  captureProductionWriteEpoch,productionWriteEpochUnchanged,
  PRODUCTION_WRITE_EPOCH_KEY,captureProductionWriteReviewSnapshot,
  productionWriteReviewSnapshotUnchanged,type ProductionWriteReviewSnapshot,
} from "@/lib/designer/production-write-hold";
import {productionWriteReviewSummary, type ProductionWriteReviewSummary} from "@/lib/designer/production-review-summary";
import {parseProductionCreationReceiptResponse, type ProductionCreationReceipt} from "@/lib/designer/production-creation-receipt-lookup";
import {parseProductionStatusReceiptResponse, type ProductionStatusReceipt} from "@/lib/designer/production-status-receipt-lookup";
import {parseProductionDeliveryEligibility,hasVerifiedSqlDeliveryEligibility,type ProductionDeliveryEligibility} from "@/lib/designer/production-delivery-eligibility";
import { validProductionDeskResponse, validProductionDeskMutationReceipt, sameProductionRecordId, sameProductionRecipeHash, selectProductionPacketRecords } from "@/lib/designer/production-desk-ledger";

type Quote={quote_id:string;revision_id:string;recipe_hash:string;currency:string;line_items:Array<{label:string;amount:number}>;subtotal:number;adjustment:number;total:number;note:string;status:string;created_at:string};
type Order={order_id:string;revision_id:string;recipe_hash:string;quote_id:string|null;status:string;note:string;created_at:string;updated_at:string};
type QcInspection={inspection_id:string;order_id:string;decision:"approved"|"rework";created_at:string};
type CustomerOutcome={outcome_id:string;order_id:string;revision_id:string;overall_rating:string;fit_result:string;worn_confirmed:boolean;note:string;created_at:string};
type LearningContext={order_id:string;revision_id:string;recipe_hash:string;context:Record<string,unknown>;created_at:string};

// Browsers may throw when retrieving localStorage itself (privacy policy,
// sandboxed frames or browser configuration). Do not let that bypass the hold.
function safeProductionHoldStorage():Storage|null{
  try{return window.localStorage;}
  catch{return null;}
}
// Web Locks is origin-wide. If unavailable, fail closed instead of relying on
// the non-atomic localStorage check-and-set across competing browser tabs.
function safeProductionWriteLock():((claim:()=>boolean)=>Promise<boolean>)|null{
  try{
    const locks=navigator.locks;
    if(!locks||typeof locks.request!=="function")return null;
    return (claim)=>locks.request(PRODUCTION_WRITE_LOCK_NAME,{mode:"exclusive"},claim);
  }catch{return null;}
}

export default function ProductionClient(){
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [orders,setOrders]=useState<Order[]>([]);
  const [qcInspections,setQcInspections]=useState<QcInspection[]>([]);
  const [deliveryEligibility,setDeliveryEligibility]=useState<ProductionDeliveryEligibility[]>([]);
  const [customerOutcomes,setCustomerOutcomes]=useState<CustomerOutcome[]>([]);
  const [learningContexts,setLearningContexts]=useState<LearningContext[]>([]);
  // No mutation or linked packet export until the current backend ledger is verified.
  const [configured,setConfigured]=useState(false);
  const [optionalEvidenceSources,setOptionalEvidenceSources]=useState<{qcInstalled:boolean;customerOutcomesInstalled:boolean;learningContextInstalled:boolean}|null>(null);
  const [busy,setBusy]=useState(false);
  // A lost POST acknowledgement may follow a durable mutation. A capped
  // ledger cannot prove absence, so require manual review before more writes.
  const [requiresWriteReview,setRequiresWriteReview]=useState(false);
  const [pendingWriteReview,setPendingWriteReview]=useState<ProductionWriteReviewSummary|null>(null);
  const [recoveredCreationReceipts,setRecoveredCreationReceipts]=useState<ProductionCreationReceipt[]|null>(null);
  const [recoveredStatusReceipts,setRecoveredStatusReceipts]=useState<ProductionStatusReceipt[]|null>(null);
  // State updates are asynchronous: a second click in the same render must
  // not create a second quote/order or overlap a locked-design recovery.
  const actionInFlight=useRef(false);
  // A late initial GET must never overwrite a newer post-mutation refresh.
  const ledgerReadVersion=useRef(0);
  const verifiedLedgerReadVersion=useRef(0);
  const verifiedWriteReviewSnapshot=useRef<ProductionWriteReviewSnapshot|null>(null);
  // A review must be refreshed AFTER acquiring the full-request session lock.
  // A GET made while a remote SQL write was active cannot authorize its clearance.
  const verifiedReviewSessionReadVersion=useRef(0);
  // A verified HTTP response is not yet visible to an operator until React
  // commits its corresponding history. Do not acknowledge an unseen ledger.
  const [renderedLedgerReadVersion,setRenderedLedgerReadVersion]=useState(0);
  function hasCurrentVerifiedLedger(){
    return isCurrentVerifiedProductionLedger(ledgerReadVersion.current,verifiedLedgerReadVersion.current,renderedLedgerReadVersion);
  }
  const [message,setMessage]=useState("");
  const [quote,setQuote]=useState({revisionId:"",recipeHash:"",currency:"INR",adjustment:"0",note:"",line1Label:"Shirt fabric",line1Amount:"",line2Label:"Tailoring",line2Amount:""});
  const [order,setOrder]=useState({revisionId:"",recipeHash:"",quoteId:"",note:""});
  const [recoveryToken,setRecoveryToken]=useState("");
  const [loadedRevision,setLoadedRevision]=useState<LockedDesignRevision|null>(null);
  // React has not necessarily rendered an invalidated lock in the same event turn.
  // Only the exact object committed by the latest verified recovery may authorize
  // a quote, order or export. Identity is revoked synchronously on token changes.
  const verifiedLockedRevision=useRef<LockedDesignRevision|null>(null);

  async function load(expected?:{action:unknown;body:Record<string,unknown>;receipt:unknown}):Promise<boolean>{
    const readVersion=++ledgerReadVersion.current;
    verifiedReviewSessionReadVersion.current=0;
    const reviewSnapshot=captureProductionWriteReviewSnapshot(safeProductionHoldStorage());
    verifiedWriteReviewSnapshot.current=null;
    verifiedLedgerReadVersion.current=0;
    setRenderedLedgerReadVersion(0);
    // Clear old receipts immediately; stale rows must not authorize actions.
    setConfigured(false);
    setQuotes([]);setOrders([]);setQcInspections([]);setDeliveryEligibility([]);
    setCustomerOutcomes([]);setLearningContexts([]);
    setOptionalEvidenceSources(null);
    try{
      // Do not block ordinary production history on the optional physical-QC
      // hint: an older deployment may return 404/503 or wait for RPC timeout.
      // Delivery stays disabled until a separate validated hint arrives.
      const response=await fetch("/api/operator/production",{cache:"no-store"});
      if(response.status===401){if(readVersion===ledgerReadVersion.current)window.location.href="/operator/login?next=/operator/production";return false;}
      if(!response.ok) throw new Error("Production records are unavailable.");
      const data:unknown=await response.json();
      if(!validProductionDeskResponse(data)){
        throw new Error("Production ledger response is malformed.");
      }
      if(readVersion!==ledgerReadVersion.current) return false;
      if(!productionWriteReviewSnapshotUnchanged(safeProductionHoldStorage(),reviewSnapshot)){
        throw new Error("Production write marker changed during history refresh.");
      }
      // A mutation is not confirmed until this newly verified ledger contains
      // the exact created UUID or updated status on the intended quote/order.
      if(expected&&(!data.configured||!verifiedProductionMutationReadback(
        expected.action,expected.body,expected.receipt,data.quotes,data.orders,data.learningContexts,
      )))throw new Error("The changed production record was not confirmed in refreshed history.");
      // Commit the verified generation synchronously; React state is only UI.
      verifiedWriteReviewSnapshot.current=data.configured?reviewSnapshot:null;
      verifiedLedgerReadVersion.current=data.configured?readVersion:0;
      setRenderedLedgerReadVersion(data.configured?readVersion:0);
      setConfigured(data.configured);
      setQuotes(data.quotes as Quote[]);
      setOrders(data.orders as Order[]);
      setDeliveryEligibility([]);
      // Separate advisory read must never delay history or mutation readback.
      // Only the newest verified ledger generation may accept its answer.
      // A missing, malformed or delayed SQL hint leaves delivery hidden.
      if(data.configured){
        void (async()=>{
          let rows:ProductionDeliveryEligibility[]=[];
          try{
            const hint=await fetch("/api/operator/production/delivery-eligibility",{cache:"no-store"});
            if(hint.ok){
              const payload:unknown=await hint.json();
              if(payload&&typeof payload==="object"&&!Array.isArray(payload)
                &&"eligibility" in payload){
                rows=parseProductionDeliveryEligibility(payload.eligibility)??[];
              }
            }
          }catch{
            // Advisory evidence is unavailable: fail closed without hiding orders.
          }
          if(readVersion===ledgerReadVersion.current)setDeliveryEligibility(rows);
        })();
      }
      setQcInspections(data.configured?data.qcInspections as QcInspection[]:[]);
      setCustomerOutcomes(data.configured?data.customerOutcomes as CustomerOutcome[]:[]);
      setLearningContexts(data.configured?data.learningContexts as LearningContext[]:[]);
      setOptionalEvidenceSources(data.configured?data.optionalEvidenceSources:null);
      return data.configured;
    }catch{
      if(readVersion!==ledgerReadVersion.current) return false;
      verifiedWriteReviewSnapshot.current=null;
      // Never keep stale quotes/orders or leave mutation controls enabled when
      // the operator's current production ledger cannot be verified.
      setConfigured(false);
      setQuotes([]);
      setOrders([]);
      setQcInspections([]);
      setDeliveryEligibility([]);
      setCustomerOutcomes([]);
      setLearningContexts([]);
      setOptionalEvidenceSources(null);
      setMessage(expected
        ?"The mutation may have been saved, but its exact quote/order history could not be verified. Inspect the records before retrying to avoid duplicate orders or status changes."
        :"Production records could not be verified. Retry after the operator backend is available.");
      return false;
    }
  }
  useEffect(()=>{
    // This marker contains only a random UUID; it survives reloads and
    // broadcasts pending writes from other same-origin tabs. Never auto-clear
    // it after a GET, and never persist private production request bodies.
    if(productionWriteHoldPending(safeProductionHoldStorage()))setRequiresWriteReview(true);
    const onStorage=(event:StorageEvent)=>{
      if(event.key===PRODUCTION_WRITE_HOLD_KEY||event.key===PRODUCTION_WRITE_EPOCH_KEY){
        // Another tab may have begun AND confirmed a write. React state from
        // an earlier GET must not permit same-turn acknowledgement or mutation.
        ledgerReadVersion.current+=1;
        verifiedLedgerReadVersion.current=0;
        verifiedWriteReviewSnapshot.current=null;
        verifiedReviewSessionReadVersion.current=0;
        setRenderedLedgerReadVersion(0);
        setConfigured(false);
        setRecoveredCreationReceipts(null);setRecoveredStatusReceipts(null);
        setRequiresWriteReview(true);
        setMessage("Production writes changed in another tab. Refresh current history before acknowledging or exporting.");
      }
    };
    window.addEventListener("storage",onStorage);
    return ()=>window.removeEventListener("storage",onStorage);
  },[]);
  useEffect(()=>{void load();},[]);

  async function post(body:Record<string,unknown>,success:string,sessionLockHeld=false){
    // The marker claim lock only serializes its first storage write. A live SQL
    // request needs a SECOND origin-wide lock until its result/review is settled.
    // Otherwise another tab can refresh a capped ledger and acknowledge the
    // still-active request, removing the marker while SQL is committing.
    if(!sessionLockHeld){
      if(busy||actionInFlight.current)return;
      try{
        const locks=navigator.locks;
        if(!locks||typeof locks.request!=="function")throw new Error("Web Locks unavailable");
        await locks.request(PRODUCTION_WRITE_SESSION_LOCK_NAME,{mode:"exclusive",ifAvailable:true},async lock=>{
          if(!lock){
            setRequiresWriteReview(true);
            setMessage("Another tab has an active production write. Wait for its result, then refresh verified history before any further action.");
            return;
          }
          await post(body,success,true);
        });
      }catch{
        setRequiresWriteReview(true);
        setMessage("Cannot verify the exclusive production session. Writes remain blocked until history is refreshed.");
      }
      return;
    }
    if(busy||actionInFlight.current) return;
    if(!configured||requiresWriteReview) return;
    if(!hasCurrentVerifiedLedger()) return;
    if((body.action==="create_quote"||body.action==="create_order")
      &&(!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current)))return;
    // Persist an anonymous uncertainty marker *before* the network request:
    // a crash or navigation while the SQL transaction commits must still
    // leave this desk blocked on the next page load.
    const holdToken=crypto.randomUUID();
    const storage=safeProductionHoldStorage();
    const beforeLock=captureProductionWriteReviewSnapshot(storage);
    // Block same-tab actions BEFORE waiting for the cross-tab exclusive lock.
    actionInFlight.current=true;
    setBusy(true);
    const claimed=await beginProductionWriteHoldAtomically(
      storage,holdToken,safeProductionWriteLock(),beforeLock,
    );
    // A different tab may have completed a write while we waited for the lock,
    // or changed the verified ledger/locked design. Do not send a stale POST.
    if(!claimed||!hasCurrentVerifiedLedger()
      ||((body.action==="create_quote"||body.action==="create_order")
        &&!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current))){
      if(claimed)releaseProductionWriteHold(storage,holdToken);
      actionInFlight.current=false;
      setBusy(false);
      setRequiresWriteReview(true);
      setMessage("Cannot safely start production write: another tab changed production history, the exclusive browser lock is unavailable, or protected storage could not be verified. Refresh and review history before retrying.");
      return;
    }
    setRequiresWriteReview(true);
    // Invalidate any in-flight GET before sending a potentially durable write.
    ledgerReadVersion.current+=1;
    verifiedLedgerReadVersion.current=0;
    setRenderedLedgerReadVersion(0);
    setConfigured(false);
    setMessage("");
    setRecoveredCreationReceipts(null);setRecoveredStatusReceipts(null);
    const attempt=productionWriteReviewSummary(body);
    let certainPrewriteRejection=false;
    try{
      const response=await fetch("/api/operator/production",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,requestKey:holdToken})});
      const data=await response.json() as {error?:unknown};
      if(!response.ok){
        // These explicit input/auth/size/rate denials happen before the SQL
        // mutation. Unknown HTTP responses and invalid receipts are NOT safe
        // to retry automatically: a write may already have committed.
        certainPrewriteRejection=isCertainProductionPrewriteRejection(response.status);
        throw new Error(typeof data?.error==="string"?data.error:"Production operation failed.");
      }
      if(!validProductionDeskMutationReceipt(body.action,data)) throw new Error("Production operation receipt could not be verified.");
      const confirmed=await load({action:body.action,body,receipt:data});
      if(confirmed){
        if(releaseProductionWriteHold(safeProductionHoldStorage(),holdToken)){
          setRequiresWriteReview(false);
          setMessage(success);
        }else{
          // Another tab's marker or unavailable storage must not be erased
          // simply because *this* write had an exact durable receipt.
          setRequiresWriteReview(true);
          setMessage("The operation was confirmed, but a separate pending production review remains. Inspect history before enabling further writes.");
        }
      }else{
        // Keep the submitted instruction frozen even if the editable form
        // changes while the operator inspects the capped production ledger.
        setPendingWriteReview(attempt);
        setRequiresWriteReview(true);
        setMessage("The production mutation may already have been saved, but its exact record could not be confirmed. Inspect and refresh quote/order history before enabling another write.");
      }
    }catch(error){
      // Set the hold before refresh; a healthy ledger cannot prove absence.
      if(!certainPrewriteRejection){
        setPendingWriteReview(attempt);
        setRequiresWriteReview(true);
      }
      // Reload first: load() may update its own message, but no generic fetch
      // failure may overwrite a warning that an order might already exist.
      const refreshed=await load();
      if(certainPrewriteRejection){
        // An explicit route-level denial before SQL can safely release only
        // this write's matching marker, never one owned by another tab.
        if(releaseProductionWriteHold(safeProductionHoldStorage(),holdToken)){
          setRequiresWriteReview(false);
        }
        setMessage(error instanceof Error?error.message:"Production operation rejected before saving.");
      }else{
        setMessage(refreshed
          ?"The production mutation may already have been saved, but its exact result was not confirmed. Inspect the refreshed quote/order records before retrying to avoid duplicates."
          :"The production mutation may already have been saved, and its history could not be verified. Do not retry until the production ledger can be inspected to avoid duplicate orders or status changes.");
      }
    }
    finally{actionInFlight.current=false;setBusy(false);}
  }

  async function lookupPendingCreationReceipt(){
    if(!requiresWriteReview||busy||actionInFlight.current)return;
    const snapshot=captureProductionWriteReviewSnapshot(safeProductionHoldStorage());
    const pendingKey=snapshot?.holdToken;
    if(!pendingKey){
      setRecoveredCreationReceipts(null);setRecoveredStatusReceipts(null);
      setMessage("The original request ID is missing or inaccessible. Writes remain paused; inspect authoritative records before any retry.");
      return;
    }
    actionInFlight.current=true;
    setBusy(true);setRecoveredCreationReceipts(null);setRecoveredStatusReceipts(null);
    try{
      const response=await fetch("/api/operator/production",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"creation_receipt_lookup",requestKey:pendingKey}),
      });
      if(!response.ok)throw new Error("Receipt lookup unavailable.");
      const data:unknown=await response.json();
      if(!data||typeof data!=="object"||Array.isArray(data)
        ||!("receipts" in data))throw new Error("Invalid receipt lookup response.");
      const receipts=parseProductionCreationReceiptResponse(data.receipts);
      if(!receipts)throw new Error("Unverified receipt lookup response.");
      // A concurrent tab may have changed the marker while the read was in
      // flight, even if the old UUID is unchanged. Require both its token
      // and write epoch; never present superseded results as current evidence.
      if(!productionWriteReviewSnapshotUnchanged(safeProductionHoldStorage(),snapshot)){
        throw new Error("Pending request key changed while checking its receipt.");
      }
      setRecoveredCreationReceipts(receipts);
      setMessage(receipts.length
        ?"Committed quote/order creation receipt located. Check the exact UUID against history before acknowledging this review; do not recreate that record."
        :"No committed creation receipt was visible at lookup time. A delayed transaction or status update may still commit; never treat this as safe to recreate.");
    }catch{
      setRecoveredCreationReceipts(null);setRecoveredStatusReceipts(null);
      setMessage("Original production receipt could not be verified. Keep the review hold and inspect the authoritative records before retrying.");
    }finally{actionInFlight.current=false;setBusy(false);}
  }

  async function lookupPendingStatusReceipt(){
    if(!requiresWriteReview||busy||actionInFlight.current)return;
    const snapshot=captureProductionWriteReviewSnapshot(safeProductionHoldStorage());
    const pendingKey=snapshot?.holdToken;
    if(!pendingKey){
      setRecoveredStatusReceipts(null);
      setMessage("The original request ID is missing or inaccessible. A status change may still commit; keep writes paused.");
      return;
    }
    actionInFlight.current=true;
    setBusy(true);
    setRecoveredStatusReceipts(null);
    try{
      const response=await fetch("/api/operator/production",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"status_receipt_lookup",requestKey:pendingKey}),
      });
      if(!response.ok)throw new Error("Status receipt lookup unavailable.");
      const data:unknown=await response.json();
      if(!data||typeof data!=="object"||Array.isArray(data)
        ||!("receipts" in data))throw new Error("Invalid status receipt response.");
      const receipts=parseProductionStatusReceiptResponse(data.receipts);
      if(!receipts)throw new Error("Unverified status receipt response.");
      // Another tab may complete a write while the lookup is in flight.
      // Never display stale results or clear the pending marker.
      if(!productionWriteReviewSnapshotUnchanged(safeProductionHoldStorage(),snapshot)){
        throw new Error("Pending request changed during status receipt lookup.");
      }
      setRecoveredStatusReceipts(receipts);
      setMessage(receipts.length
        ?"Committed status receipt located for the exact original request UUID. Compare its record and status with authoritative history; do not submit the transition again."
        :"No committed status receipt was visible at lookup time. An in-flight SQL transaction may still commit. Keep writes paused.");
    }catch{
      setRecoveredStatusReceipts(null);
      setMessage("Original status receipt could not be verified. Keep the review hold and inspect authoritative records before retrying.");
    }finally{actionInFlight.current=false;setBusy(false);}
  }

  function confirmReviewedProductionHistory(){
    // A verified GET cannot distinguish a completed crashed write from a
    // concurrent still-in-flight SQL transaction. Refuse acknowledgement while
    // ANY same-origin tab holds the full-request Web Lock. The non-queuing
    // attempt prevents an old click from clearing the marker after that write.
    if(!requiresWriteReview||!configured||busy||actionInFlight.current)return;
    if(!hasCurrentVerifiedLedger())return;
    try{
      const locks=navigator.locks;
      if(!locks||typeof locks.request!=="function")throw new Error("Web Locks unavailable");
      void locks.request(PRODUCTION_WRITE_SESSION_LOCK_NAME,{mode:"exclusive",ifAvailable:true},async lock=>{
        if(!lock){
          setMessage("Another tab has an active production write. Do not acknowledge until it completes and current history is refreshed.");
          return;
        }
        if(!requiresWriteReview||!configured||busy||actionInFlight.current)return;
        if(!hasCurrentVerifiedLedger())return;
        const storage=safeProductionHoldStorage();
        const snapshot=verifiedWriteReviewSnapshot.current;
        if(!snapshot||!productionWriteReviewSnapshotUnchanged(storage,snapshot)){
          setMessage("Production write history changed after the last verified refresh. Refresh again before acknowledging.");
          return;
        }
        if(verifiedReviewSessionReadVersion.current!==ledgerReadVersion.current){
          // The old GET may have overlapped an active SQL POST. Re-read under
          // the acquired session lock and require a SECOND deliberate click
          // after React renders that independently verified history.
          const refreshed=await load();
          if(refreshed&&verifiedLedgerReadVersion.current===ledgerReadVersion.current){
            verifiedReviewSessionReadVersion.current=ledgerReadVersion.current;
            setMessage("Production history rechecked with no active browser write. Review the updated records, then click acknowledgement again.");
          }
          return;
        }
        // A completed remote write may have removed its marker. Clear stale UI
        // only after checking the exact reviewed epoch under the session lock.
        if(snapshot.holdToken!==null&&!acknowledgeProductionWriteHold(storage,snapshot.holdToken)){
          setMessage("Pending production request changed. Do not clear another write; refresh history and review again.");
          return;
        }
        verifiedReviewSessionReadVersion.current=0;
        setRequiresWriteReview(false);
        setPendingWriteReview(null);
        setRecoveredCreationReceipts(null);setRecoveredStatusReceipts(null);
        setMessage("Reviewed current production history. Writes are enabled; the earlier ambiguous operation may still exist outside the visible ledger. Check before recreating a quote or order.");
      }).catch(()=>{
        setMessage("Cannot verify the exclusive production session. Refresh history and keep the review hold.");
      });
    }catch{
      setMessage("Web Locks unavailable. Production review cannot safely clear an active request.");
    }
  }

  async function loadLockedDesign(){
    if(!recoveryToken.trim()||busy||actionInFlight.current) return;
    actionInFlight.current=true;
    verifiedLockedRevision.current=null;
    setBusy(true);setMessage("");
    // A new recovery attempt invalidates any previously verified design.
    // Never allow exports from the old lock while a different token loads.
    setLoadedRevision(null);
    setQuote((current)=>({...current,revisionId:"",recipeHash:""}));
    setOrder((current)=>({...current,revisionId:"",recipeHash:"",quoteId:""}));
    try{
      const response=await fetch("/api/designer/vault",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"load",recoveryToken:recoveryToken.trim()}),
      });
      const data=await response.json() as {revision?:unknown;error?:unknown}|null;
      // HTTP 200 and a truthy payload do not prove a recoverable immutable lock.
      // Verify the exact recipe hash and revision identity before enabling
      // quote/order creation or showing any production export controls.
      if(!response.ok||!data?.revision||!await verifyLockedDesignRevision(data.revision)){
        throw new Error(typeof data?.error==="string"?data.error:"Locked design could not be verified.");
      }
      const revision=data.revision as LockedDesignRevision;
      verifiedLockedRevision.current=revision;
      setLoadedRevision(revision);
      setQuote((current)=>({...current,revisionId:revision.revisionId,recipeHash:revision.recipeHash}));
      setOrder((current)=>({...current,revisionId:revision.revisionId,recipeHash:revision.recipeHash,quoteId:""}));
      setMessage("Locked recipe loaded. Quote and order fields were filled from the same immutable revision.");
    }catch(error){
      verifiedLockedRevision.current=null;
      setLoadedRevision(null);
      setMessage(error instanceof Error?error.message:"Locked design could not be recovered.");
    }finally{actionInFlight.current=false;setBusy(false);}
  }

  function download(name:string,type:string,content:string){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  function exportError(error:unknown){
    setMessage(error instanceof Error
      ? "Cannot export: "+error.message
      : "Cannot export: verify the original locked design revision and reload it.");
  }

  async function exportHandoff(){
    if(!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current)||busy||actionInFlight.current)return;
    try{
      const handoff=await buildVerifiedProductionHandoff(loadedRevision);
      if(!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current))throw new Error("locked design changed during handoff export.");
      download(`linen-earth-production-handoff-${handoff.designRevisionId.toLowerCase()}.json`,
        "application/json",JSON.stringify(handoff,null,2));
    }catch(error){exportError(error);}
  }

  async function exportTechPack(){
    if(!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current)||busy||actionInFlight.current)return;
    try{
      const handoff=await buildVerifiedProductionHandoff(loadedRevision);
      if(!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current))throw new Error("locked design changed during tech-pack export.");
      download(techPackFilename(handoff),"text/html;charset=utf-8",buildTailorTechPackHtml(handoff));
    }catch(error){exportError(error);}
  }

  async function exportProductionPacket(){
    // An uncertain mutation may be missing from a capped history page. Never
    // export a production-status packet while the operator review hold is on.
    if(!loadedRevision||!configured||requiresWriteReview||busy||actionInFlight.current) return;
    if(!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current))return;
    if(!hasCurrentVerifiedLedger()) return;
    // A second tab may begin a write before its storage event reaches React.
    // Capture an anonymous epoch before reading the fresh production ledger.
    const packetWriteEpoch=captureProductionWriteEpoch(safeProductionHoldStorage());
    if(packetWriteEpoch===null){
      setRequiresWriteReview(true);
      setMessage("Cannot export while another production write is pending or protected storage is unavailable. Refresh and review the ledger.");
      return;
    }
    const packetLedgerVersion=ledgerReadVersion.current;
    actionInFlight.current=true;
    setBusy(true);
    try{
      // The displayed React ledger may predate another operator's mutation.
      // Require a new authenticated, independently validated no-store read
      // immediately before building the packet; never reuse cached rows.
      const response=await fetch("/api/operator/production",{cache:"no-store"});
      if(!response.ok) throw new Error("fresh production history is unavailable.");
      const fresh:unknown=await response.json();
      if(!validProductionDeskResponse(fresh)||!fresh.configured){
        throw new Error("fresh production history could not be verified.");
      }
      const {quote:quoteMatch,order:orderMatch}=selectProductionPacketRecords(
        fresh.quotes as Quote[],fresh.orders as Order[],
        loadedRevision.revisionId,loadedRevision.recipeHash,
      );
      const packet=await buildVerifiedProductionPacket({
        revision:loadedRevision,
        quote:quoteMatch?{
          quoteId:quoteMatch.quote_id,currency:quoteMatch.currency,total:Number(quoteMatch.total),status:quoteMatch.status,createdAt:quoteMatch.created_at,
        }:null,
        order:orderMatch?{
          orderId:orderMatch.order_id,status:orderMatch.status,createdAt:orderMatch.created_at,
        }:null,
      });
      // A write in another tab can begin AND finish while this async packet
      // is being built. A pending-marker-only check would miss that race.
      if(!productionWriteEpochUnchanged(safeProductionHoldStorage(),packetWriteEpoch)){
        verifiedLedgerReadVersion.current=0;
        setRenderedLedgerReadVersion(0);
        setConfigured(false);
        if(productionWriteHoldPending(safeProductionHoldStorage()))setRequiresWriteReview(true);
        throw new Error("production writes changed in another tab during packet export; refresh and review current history.");
      }
      if(!isCurrentVerifiedProductionLedger(ledgerReadVersion.current,verifiedLedgerReadVersion.current,renderedLedgerReadVersion)
        ||ledgerReadVersion.current!==packetLedgerVersion){
        throw new Error("production history changed during packet export; refresh and review before retrying.");
      }
      if(!isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current))throw new Error("locked design changed during packet export.");
      download(`linen-earth-production-packet-${packet.revisionId.toLowerCase()}.json`,
        "application/json",JSON.stringify(packet,null,2));
    }catch(error){exportError(error);}
    finally{actionInFlight.current=false;setBusy(false);}
  }


  const quoteRows=useMemo(()=>[
    {label:quote.line1Label.trim(),amountText:quote.line1Amount.trim()},
    {label:quote.line2Label.trim(),amountText:quote.line2Amount.trim()},
  ],[quote.line1Label,quote.line1Amount,quote.line2Label,quote.line2Amount]);
  const decimalPrice=(text:string)=>/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text)
    && Number.isFinite(Number(text))&&Number(text)>=0&&Number(text)<=10_000_000;
  const quoteRowsValid=quoteRows.every((row)=>
    (!row.label&&!row.amountText)||(Boolean(row.label)&&decimalPrice(row.amountText)));
  const quoteItems=quoteRows.filter((row)=>row.label&&decimalPrice(row.amountText))
    .map((row)=>({label:row.label,amount:Number(row.amountText)}));
  const adjustmentValid=/^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(quote.adjustment.trim())
    && Number.isFinite(Number(quote.adjustment))&&Math.abs(Number(quote.adjustment))<=10_000_000;
  const lockedQuoteMatches=Boolean(loadedRevision)&&quote.revisionId===loadedRevision?.revisionId
    &&sameProductionRecipeHash(quote.recipeHash,loadedRevision?.recipeHash);
  const lockedOrderMatches=Boolean(loadedRevision)&&order.revisionId===loadedRevision?.revisionId
    &&sameProductionRecipeHash(order.recipeHash,loadedRevision?.recipeHash);
  const canQuote=lockedQuoteMatches&&quoteItems.length>0
    &&quoteRowsValid&&adjustmentValid;
  const acceptedQuotes=useMemo(()=>quotes.filter((item)=>item.status==="accepted"&&(
    !order.revisionId || (item.revision_id===order.revisionId&&sameProductionRecipeHash(item.recipe_hash,order.recipeHash))
  )),[quotes,order.revisionId,order.recipeHash]);

  return <main className="productionDesk">
    <header className="productionHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Production Desk</h1><p>Create traceable quotes and production orders from locked design revisions. Amounts are entered by the operator; this desk never invents prices.</p></div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/stock">Stock Ledger</Link><Link href="/operator/production-calibration">Usage Calibration</Link><Link href="/operator/garment-qc">Garment QC</Link><Link href="/operator/production-evidence">Zero-Reentry Proof</Link><Link href="/operator/customer-outcomes">Outcome Review</Link></nav>
    </header>

    <section className="productionLoad">
      <div>
        <span>00 / LOCKED RECIPE</span>
        <h2>Load the exact design before production.</h2>
        <p>Paste the secure recovery token from Designer. New quotes and production orders are blocked until this immutable revision is verified, so recipe identity cannot be typed or guessed manually.</p>
      </div>
      <div className="productionLoadForm">
        <textarea rows={3} value={recoveryToken} disabled={busy} onChange={(e)=>{
          verifiedLockedRevision.current=null;
          setRecoveryToken(e.target.value);
          setLoadedRevision(null);
          setQuote((current)=>({...current,revisionId:"",recipeHash:""}));
          setOrder((current)=>({...current,revisionId:"",recipeHash:"",quoteId:""}));
        }} placeholder="lev1.…" spellCheck={false}/>
        <button disabled={busy||!recoveryToken.trim()} onClick={()=>void loadLockedDesign()}>{busy?"Loading…":"Load locked design"}</button>
      </div>
      {loadedRevision&&<div className="productionLoadedRecipe">
        <span><small>REVISION</small><b>{loadedRevision.revisionId}</b></span>
        <span><small>SHIRT</small><b>{loadedRevision.garmentSpec.fabrics.shirt.name}</b></span>
        <span><small>TROUSER</small><b>{loadedRevision.garmentSpec.fabrics.trouser.name}</b></span>
        <span><small>CONSTRUCTION</small><b>{loadedRevision.garmentSpec.shirt.collar} · {loadedRevision.garmentSpec.shirt.cuff}</b></span>
        <div>
          <button onClick={()=>void exportHandoff()}>Export tailor handoff</button>
          <button onClick={()=>void exportTechPack()}>Export tech pack</button>
          <button disabled={!configured||requiresWriteReview||busy} onClick={()=>void exportProductionPacket()}>Export production packet</button>
          <Link href={`/operator/stock?fabric=${encodeURIComponent(loadedRevision.garmentSpec.fabrics.shirt.id)}&revision=${encodeURIComponent(loadedRevision.revisionId)}`}>Reserve shirt stock</Link>
          <Link href={`/operator/stock?fabric=${encodeURIComponent(loadedRevision.garmentSpec.fabrics.trouser.id)}&revision=${encodeURIComponent(loadedRevision.revisionId)}`}>Reserve trouser stock</Link>
        </div>
      </div>}
    </section>

    <section className="productionGrid">
      <article className="productionPanel">
        <span>01 / QUOTE</span><h2>Create from locked recipe.</h2>
        <label>Verified revision ID<input value={quote.revisionId} readOnly aria-readonly="true" title="Loaded from the verified locked design" /></label>
        <label>Verified recipe hash<input value={quote.recipeHash} readOnly aria-readonly="true" title="Loaded from the verified locked design" placeholder="Load locked design first" /></label>
        <div className="productionPair">
          <label>Currency<input value={quote.currency} maxLength={3} onChange={(e)=>setQuote({...quote,currency:e.target.value.toUpperCase()})}/></label>
          <label>Adjustment<input type="number" step=".01" value={quote.adjustment} onChange={(e)=>setQuote({...quote,adjustment:e.target.value})}/></label>
        </div>
        <div className="productionPair">
          <fieldset className="productionLine"><legend>Line 1</legend><input aria-label="Line 1 label" value={quote.line1Label} onChange={(e)=>setQuote({...quote,line1Label:e.target.value})} placeholder="Label"/><input aria-label="Line 1 amount" type="number" min="0" step=".01" value={quote.line1Amount} onChange={(e)=>setQuote({...quote,line1Amount:e.target.value})} placeholder="Amount"/></fieldset>
          <fieldset className="productionLine"><legend>Line 2</legend><input aria-label="Line 2 label" value={quote.line2Label} onChange={(e)=>setQuote({...quote,line2Label:e.target.value})} placeholder="Label"/><input aria-label="Line 2 amount" type="number" min="0" step=".01" value={quote.line2Amount} onChange={(e)=>setQuote({...quote,line2Amount:e.target.value})} placeholder="Amount"/></fieldset>
        </div>
        <label>Note<textarea rows={2} value={quote.note} onChange={(e)=>setQuote({...quote,note:e.target.value})}/></label>
        <button disabled={busy||!configured||requiresWriteReview||!canQuote} onClick={()=>void post({action:"create_quote",revisionId:loadedRevision?.revisionId,recipeHash:loadedRevision?.recipeHash,currency:quote.currency,lineItems:quoteItems,adjustment:Number(quote.adjustment||0),note:quote.note,recoveryToken:recoveryToken.trim()},"Quote created from verified locked revision.")}>Create quote</button>
      </article>

      <article className="productionPanel">
        <span>02 / ORDER</span><h2>Create production order.</h2>
        <label>Verified revision ID<input value={order.revisionId} readOnly aria-readonly="true" title="Loaded from the verified locked design" /></label>
        <label>Verified recipe hash<input value={order.recipeHash} readOnly aria-readonly="true" title="Loaded from the verified locked design" /></label>
        <label>Accepted quote (optional)<select value={order.quoteId} onChange={(e)=>setOrder({...order,quoteId:e.target.value})}><option value="">No quote attached</option>{acceptedQuotes.map((item)=><option key={item.quote_id} value={item.quote_id}>{item.currency} {Number(item.total).toFixed(2)} · {item.quote_id.slice(0,8)}</option>)}</select></label>
        <label>Note<textarea rows={2} value={order.note} onChange={(e)=>setOrder({...order,note:e.target.value})}/></label>
        <button disabled={busy||!configured||requiresWriteReview||!lockedOrderMatches} onClick={()=>void post({
          action:"create_order",...order,revisionId:loadedRevision?.revisionId,recipeHash:loadedRevision?.recipeHash,recoveryToken:recoveryToken.trim(),
        },"Production order created from verified locked revision with durable design context.")}>Create order</button>
        <small style={{lineHeight:1.45,opacity:.62}}>{loadedRevision?"Locked recipe verified: privacy-safe style/fabric/construction context will be retained for future outcome learning.":"Load and verify the locked recipe before creating quotes or production orders."}</small>
      </article>
    </section>

    {message&&<p className="productionMessage" role="status">{message}</p>}
    {requiresWriteReview&&<section className="productionPanel" role="alert" aria-label="Production write review required">
      <h2>Production writes paused for manual review</h2>
      <p>A previous request may already have created or updated a record. Compare the frozen submission below with persisted quote and order history. Missing records on this limited page do not prove a failed write.</p>
      {pendingWriteReview&&<div className="productionRecord" aria-label="Unconfirmed submitted instruction">
        <strong>UNCONFIRMED SUBMISSION · {pendingWriteReview.action.replaceAll("_"," ").toUpperCase()}</strong>
        {pendingWriteReview.revisionId&&<p>Revision: {pendingWriteReview.revisionId}</p>}
        {pendingWriteReview.recipeHash&&<p>Recipe SHA-256: {pendingWriteReview.recipeHash}</p>}
        {pendingWriteReview.quoteId&&<p>Quote ID: {pendingWriteReview.quoteId}</p>}
        {pendingWriteReview.orderId&&<p>Order ID: {pendingWriteReview.orderId}</p>}
        {pendingWriteReview.status&&<p>Requested status: {pendingWriteReview.status}</p>}
        {pendingWriteReview.currency&&<p>Currency: {pendingWriteReview.currency}</p>}
        {pendingWriteReview.lineItems.length>0&&<ul>{pendingWriteReview.lineItems.map((line,index)=><li key={index}>{line.label}: {line.amount.toFixed(2)}</li>)}</ul>}
        {pendingWriteReview.adjustment!==null&&<p>Adjustment: {pendingWriteReview.adjustment.toFixed(2)}</p>}
        <p>Submitted note: {pendingWriteReview.note||"(empty / unchanged for status updates)"}</p>
        <small>Recovery tokens and other private request fields are never displayed or saved in this summary.</small>
      </div>}

      <button disabled={busy||actionInFlight.current} onClick={()=>void lookupPendingCreationReceipt()}>Find original quote/order receipt by request ID</button>
      {recoveredCreationReceipts!==null&&<div className="productionRecord" aria-label="Original committed creation receipts">
        {recoveredCreationReceipts.length>0
          ?<><strong>COMMITTED CREATION RECEIPTS</strong><ul>{recoveredCreationReceipts.map(item=>
            <li key={item.action}>{item.action==="create_quote"?"Quote":"Order"} ID: {item.receiptId}</li>)}</ul>
            <p>These IDs were retrieved from the committed request ledger. Compare with quote/order history before enabling further writes; do not recreate them.</p></>
          :<p>No committed creation receipt found for this request ID yet. A delayed commit or status update is still possible. Writes remain paused.</p>}
      </div>}
      <button disabled={busy||actionInFlight.current} onClick={()=>void lookupPendingStatusReceipt()}>Find original status receipt by request ID</button>
      {recoveredStatusReceipts!==null&&<div className="productionRecord" aria-label="Original committed status receipts">
        {recoveredStatusReceipts.length>0
          ?<><strong>COMMITTED STATUS RECEIPTS</strong><ul>{recoveredStatusReceipts.map(item=>
            <li key={item.action+item.recordId+item.status}>{item.action==="quote_status"?"Quote":"Order"} ID: {item.recordId}; committed status: {item.status}</li>)}</ul>
            <p>Exact committed SQL receipts, not capped history. Compare with current history before acknowledging; never repeat a confirmed transition.</p></>
          :<p>No committed status receipt visible yet. An in-flight transaction can still commit. This is NOT proof that retrying is safe.</p>}
      </div>}
      <button disabled={!configured||busy||actionInFlight.current} onClick={confirmReviewedProductionHistory}>I reviewed history — enable writes</button>
    </section>}
    {optionalEvidenceSources&&(!optionalEvidenceSources.qcInstalled||!optionalEvidenceSources.customerOutcomesInstalled||!optionalEvidenceSources.learningContextInstalled)&&
      <p className="productionMessage" role="status">Some optional production evidence services are not installed. Missing history is unverified, not proof that no inspection, customer outcome or design lineage exists.</p>}


    {/* Verified history can be refreshed in normal operation as well as while
        a lost-write acknowledgement is held for manual inspection. This also
        reloads the current SQL QC hint, never assuming the previous one. */}
    <div className="productionRecordsToolbar">
      <button type="button" disabled={busy||actionInFlight.current}
        onClick={()=>void load()}>Refresh production history</button>
    </div>
    <section className="productionRecords">
      <article>
        <div><span>QUOTES</span><h2>Quote history.</h2></div>
        {!quotes.length&&<p>No quotes recorded yet.</p>}
        {quotes.map((item)=><section key={item.quote_id} className="productionRecord">
          <div><b>{item.revision_id}</b><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>
          <strong>{item.currency} {Number(item.total).toFixed(2)} · {item.status.toUpperCase()}</strong>
          <small>{item.quote_id}</small>
          <small>Recipe SHA-256: {item.recipe_hash}</small>
          <ul aria-label="Saved quote lines">{item.line_items.map((line,index)=><li key={index}>{line.label}: {item.currency} {Number(line.amount).toFixed(2)}</li>)}</ul>
          <p>Subtotal {item.currency} {Number(item.subtotal).toFixed(2)} · Adjustment {Number(item.adjustment).toFixed(2)} · Total {Number(item.total).toFixed(2)}</p>
          <p>Saved note: {item.note||"(empty)"}</p>
          <div className="productionRecordActions">
            {item.status==="draft"&&<button disabled={busy||!configured||requiresWriteReview} onClick={()=>void post({action:"quote_status",quoteId:item.quote_id,status:"sent"},"Quote marked sent.")}>Mark sent</button>}
            {item.status==="sent"&&<button disabled={busy||!configured||requiresWriteReview} onClick={()=>void post({action:"quote_status",quoteId:item.quote_id,status:"accepted"},"Quote accepted.")}>Accept</button>}
            {canTransitionQuote(item.status as ProductionQuoteStatus,"void")&&<button disabled={busy||!configured||requiresWriteReview} onClick={()=>void post({action:"quote_status",quoteId:item.quote_id,status:"void"},"Quote voided.")}>Void</button>}
          </div>
        </section>)}
      </article>

      <article>
        <div><span>ORDERS</span><h2>Production status.</h2></div>
        {!orders.length&&<p>No production orders recorded yet.</p>}
        {orders.map((item)=>{
          const deliveryQcVerified=hasVerifiedSqlDeliveryEligibility(deliveryEligibility,item);
          const nextStatuses=(ORDER_TRANSITIONS[item.status as ProductionOrderStatus]||[]).filter((status)=>status!=="delivered"||deliveryQcVerified);
          const customerOutcome=customerOutcomes.find((outcome)=>sameProductionRecordId(outcome.order_id,item.order_id));
          const learningContext=learningContexts.find((context)=>sameProductionRecordId(context.order_id,item.order_id));
          return <section key={item.order_id} className="productionRecord">
            <div><b>{item.revision_id}</b><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>
            <strong>{item.status.replaceAll("_"," ").toUpperCase()}</strong>
            <small>{item.order_id}</small>
            <small>Recipe SHA-256: {item.recipe_hash}</small>
            <p>Linked quote: {item.quote_id||"(none)"}</p>
            <p>Saved note: {item.note||"(empty)"}</p>
            <small className={learningContext?"productionLineageAttached":"productionLineageMissing"}>
              Outcome lineage · {learningContext?"durable context attached":"context missing"}
            </small>
            {item.status==="ready"&&<Link className="productionQcLink" href={"/operator/garment-qc?order="+encodeURIComponent(item.order_id)}>Finished garment QC · {deliveryQcVerified?"SQL QC verified · rechecked on delivery":"pending / rework / unverified"}</Link>}
            {item.status==="delivered"&&<Link className="productionEvidenceLink" href={"/operator/production-evidence?order="+encodeURIComponent(item.order_id)}>Record zero-reentry evidence</Link>}
            {customerOutcome&&<div className="productionCustomerOutcome">
              <small>CUSTOMER OUTCOME · {new Date(customerOutcome.created_at).toLocaleDateString("en-IN")}</small>
              <strong>{customerOutcome.overall_rating.replaceAll("_"," ").toUpperCase()} · {customerOutcome.fit_result.replaceAll("_"," ").toUpperCase()}</strong>
              <span>{customerOutcome.worn_confirmed?"Worn + fit checked":"Fit not confirmed by wear"}</span>
              {customerOutcome.note&&<p>{customerOutcome.note}</p>}
              <small>Evidence only — not automatically applied to Designer ranking.</small>
            </div>}
            {nextStatuses.length>0&&<select disabled={busy||!configured||requiresWriteReview} defaultValue="" onChange={(e)=>{if(e.target.value) void post({action:"order_status",orderId:item.order_id,status:e.target.value},"Order status updated.");}}>
              <option value="">Update status…</option>
              {nextStatuses.map((status)=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}
            </select>}
          </section>;
        })}
      </article>
    </section>
  </main>;
}
