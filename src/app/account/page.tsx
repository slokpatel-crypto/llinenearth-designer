"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerFitResult, CustomerOutcomeRating } from "@/lib/designer/customer-production-outcomes";

type Customer={id?:string;email:string|null};
type OwnedDesign={vaultId:string;revisionId:string;recipeHash:string;createdAt:string;expiresAt:string};
type OwnedProfile={vaultId:string;createdAt:string;expiresAt:string;unit?:string};
type OwnedQuote={quote_id:string;revision_id:string;currency:string;line_items:Array<{label:string;amount:number|string}>;subtotal:number|string;adjustment:number|string;total:number|string;status:string;created_at:string;updated_at:string};
type OwnedOrder={order_id:string;revision_id:string;quote_id:string|null;status:string;created_at:string;updated_at:string};
type OwnedOrderEvent={event_id:string;order_id:string;status:string;created_at:string};
type OwnedOutcome={outcome_id:string;order_id:string;overall_rating:CustomerOutcomeRating;fit_result:CustomerFitResult;worn_confirmed:boolean;note:string;created_at:string};
type OutcomeDraft={overallRating:CustomerOutcomeRating;fitResult:CustomerFitResult;wornConfirmed:boolean;note:string};

const card:React.CSSProperties={border:"1px solid #ddd7cc",borderRadius:18,padding:20,background:"#fff"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"12px 14px",border:"1px solid #cfc7ba",borderRadius:10,fontSize:15};
const button:React.CSSProperties={padding:"11px 15px",border:0,borderRadius:10,background:"#1a1a1a",color:"#fff",cursor:"pointer",fontWeight:700};
const statusPill:React.CSSProperties={display:"inline-block",padding:"4px 9px",borderRadius:999,background:"#f0ede6",fontSize:12,fontWeight:700,textTransform:"capitalize"};

function money(currency:string,value:number|string){
  const amount=Number(value);
  if(!Number.isFinite(amount)) return currency+" —";
  try{return new Intl.NumberFormat("en-IN",{style:"currency",currency}).format(amount);}
  catch{return currency+" "+amount.toFixed(2);}
}

function labelStatus(value:string){
  return value.replaceAll("_"," ");
}

export default function AccountPage(){
  const [customer,setCustomer]=useState<Customer|null>(null);
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [codeSent,setCodeSent]=useState(false);
  const [designs,setDesigns]=useState<OwnedDesign[]>([]);
  const [profiles,setProfiles]=useState<OwnedProfile[]>([]);
  const [quotes,setQuotes]=useState<OwnedQuote[]>([]);
  const [orders,setOrders]=useState<OwnedOrder[]>([]);
  const [orderEvents,setOrderEvents]=useState<OwnedOrderEvent[]>([]);
  const [outcomes,setOutcomes]=useState<OwnedOutcome[]>([]);
  const [outcomeDrafts,setOutcomeDrafts]=useState<Record<string,OutcomeDraft>>({});
  const [claimDesign,setClaimDesign]=useState("");
  const [claimMeasurement,setClaimMeasurement]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  const refresh=useCallback(async()=>{
    const session=await fetch("/api/customer-auth/session",{cache:"no-store"}).then(r=>r.json());
    const next=session.customer||null;
    setCustomer(next);
    if(!next){setDesigns([]);setProfiles([]);setQuotes([]);setOrders([]);setOrderEvents([]);setOutcomes([]);setOutcomeDrafts({});return;}

    const [d,m,p]=await Promise.all([
      fetch("/api/designer/vault",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"listOwned"})}).then(r=>r.json()),
      fetch("/api/measurements/vault",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"listOwned"})}).then(r=>r.json()),
      fetch("/api/customer-account/production",{cache:"no-store"}).then(r=>r.json()),
    ]);
    setDesigns(Array.isArray(d.designs)?d.designs:[]);
    setProfiles(Array.isArray(m.profiles)?m.profiles:[]);
    setQuotes(Array.isArray(p.quotes)?p.quotes:[]);
    setOrders(Array.isArray(p.orders)?p.orders:[]);
    setOrderEvents(Array.isArray(p.orderEvents)?p.orderEvents:[]);
    setOutcomes(Array.isArray(p.outcomes)?p.outcomes:[]);
  },[]);

  useEffect(()=>{void refresh();},[refresh]);

  async function sendCode(){
    setBusy(true);setMessage("");
    const response=await fetch("/api/customer-auth/otp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email})});
    const data=await response.json();
    setBusy(false);
    if(!response.ok){setMessage(data.error||"Could not send code.");return;}
    setCodeSent(true);setMessage("A sign-in code was sent to your email.");
  }

  async function verify(){
    setBusy(true);setMessage("");
    const response=await fetch("/api/customer-auth/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,token:code})});
    const data=await response.json();
    setBusy(false);
    if(!response.ok){setMessage(data.error||"Could not sign in.");return;}
    setCode("");setMessage("Signed in securely.");
    await refresh();
  }

  async function claim(kind:"design"|"measurement"){
    const token=kind==="design"?claimDesign:claimMeasurement;
    if(!token.trim()) return;
    setBusy(true);setMessage("");
    const url=kind==="design"?"/api/designer/vault":"/api/measurements/vault";
    const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"claim",recoveryToken:token.trim()})});
    const data=await response.json();
    setBusy(false);
    if(!response.ok||!data.claimed){setMessage(data.error||"That secure copy could not be linked.");return;}
    if(kind==="design") setClaimDesign(""); else setClaimMeasurement("");
    setMessage(kind==="design"?"Design linked to your account.":"Measurements linked to your account.");
    await refresh();
  }

  async function deleteOwned(kind:"design"|"measurement",vaultId:string){
    const label=kind==="design"?"secure design copy":"secure measurement copy";
    if(!window.confirm(`Delete this ${label}? Production records, if any, are not deleted by this action.`)) return;
    setBusy(true);setMessage("");
    try{
      const url=kind==="design"?"/api/designer/vault":"/api/measurements/vault";
      const response=await fetch(url,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"deleteOwned",vaultId}),
      });
      const data=await response.json();
      if(!response.ok||!data.deleted) throw new Error(data.error||"Secure copy could not be deleted.");
      setMessage(kind==="design"?"Secure design copy deleted.":"Secure measurement copy deleted.");
      await refresh();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Secure copy could not be deleted.");
    }finally{setBusy(false);}
  }

  async function logout(){
    await fetch("/api/customer-auth/logout",{method:"POST"});
    setMessage("Signed out.");setCodeSent(false);
    await refresh();
  }

  async function acceptQuote(quoteId:string){
    if(!window.confirm("Accept this quote and lock it for production handoff?")) return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/customer-account/production",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"accept_quote",quoteId}),
      });
      const data=await response.json();
      if(!response.ok||!data.accepted) throw new Error(data.error||"Quote could not be accepted.");
      setMessage("Quote accepted. Linen Earth can now create the production order from this exact locked design.");
      await refresh();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Quote could not be accepted.");
    }finally{setBusy(false);}
  }


  function outcomeDraft(orderId:string):OutcomeDraft{
    return outcomeDrafts[orderId]||{overallRating:"good",fitResult:"not_checked",wornConfirmed:false,note:""};
  }

  function updateOutcomeDraft(orderId:string,patch:Partial<OutcomeDraft>){
    setOutcomeDrafts(current=>{
      const base=current[orderId]||{overallRating:"good",fitResult:"not_checked",wornConfirmed:false,note:""};
      return {...current,[orderId]:{...base,...patch}};
    });
  }

  async function recordOutcome(orderId:string){
    const draft=outcomeDraft(orderId);
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/customer-account/production",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"record_outcome",orderId,...draft}),
      });
      const data=await response.json();
      if(!response.ok||!data.recorded) throw new Error(data.error||"Feedback could not be saved.");
      setMessage("Post-delivery feedback saved as evidence for this exact production order.");
      setOutcomeDrafts(current=>{const next={...current};delete next[orderId];return next;});
      await refresh();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Feedback could not be saved.");
    }finally{setBusy(false);}
  }

  return <main style={{minHeight:"100vh",background:"#f8f6f0",color:"#1a1a1a",padding:"42px 18px"}}>
    <div style={{maxWidth:900,margin:"0 auto",display:"grid",gap:18}}>
      <header>
        <p style={{fontSize:12,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Linen Earth</p>
        <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,6vw,58px)",lineHeight:1,margin:"0 0 12px"}}>My private design account</h1>
        <p style={{maxWidth:700,lineHeight:1.6,opacity:.72}}>Keep locked designs, measurements, quotes and production progress tied to one private account while preserving the recovery-token backup.</p>
      </header>

      {!customer?<section style={card}>
        <h2 style={{marginTop:0}}>Email sign in</h2>
        <div style={{display:"grid",gap:10,maxWidth:520}}>
          <input style={input} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
          <button style={button} disabled={busy} onClick={sendCode}>{busy?"Working…":"Send secure code"}</button>
          {codeSent&&<>
            <input style={input} inputMode="numeric" autoComplete="one-time-code" placeholder="Email code" value={code} onChange={e=>setCode(e.target.value)}/>
            <button style={button} disabled={busy} onClick={verify}>Verify and sign in</button>
          </>}
        </div>
      </section>:<>
        <section style={{...card,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div><strong>Signed in</strong><div style={{opacity:.7,marginTop:4}}>{customer.email}</div></div>
          <button style={{...button,background:"#6b7a63"}} onClick={logout}>Sign out</button>
        </section>

        <section style={card}>
          <h2 style={{marginTop:0}}>Production progress <span style={{opacity:.45}}>({orders.length})</span></h2>
          {orders.length===0?<p style={{opacity:.65}}>No production order is linked to this account yet.</p>:<div style={{display:"grid",gap:12}}>
            {orders.map(order=>{
              const quote=quotes.find(item=>item.quote_id===order.quote_id);
              const timeline=orderEvents
                .filter(event=>event.order_id===order.order_id)
                .sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
              return <div key={order.order_id} style={{borderTop:"1px solid #ece6dc",paddingTop:12,display:"grid",gap:7}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                  <strong>{order.revision_id}</strong>
                  <span style={statusPill}>{labelStatus(order.status)}</span>
                </div>
                <div style={{fontSize:13,opacity:.65}}>Order {order.order_id.slice(0,8)}… · updated {new Date(order.updated_at).toLocaleDateString()}</div>
                {quote&&<div style={{fontSize:13,opacity:.8}}>Quote {money(quote.currency,quote.total)} · {labelStatus(quote.status)}</div>}
                {timeline.length>0&&<div style={{display:"grid",gap:5,marginTop:3}}>
                  <strong style={{fontSize:12,letterSpacing:.5,textTransform:"uppercase",opacity:.65}}>Timeline</strong>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    {timeline.map(event=><span key={event.event_id} style={{...statusPill,fontWeight:600}}>
                      {labelStatus(event.status)} · {new Date(event.created_at).toLocaleDateString()}
                    </span>)}
                  </div>
                </div>}
                {order.status==="delivered"&&(()=>{
                  const saved=outcomes.find(item=>item.order_id===order.order_id);
                  const draft=outcomeDraft(order.order_id);
                  return saved?<div style={{borderTop:"1px dashed #ddd7cc",paddingTop:8,display:"grid",gap:4,fontSize:13}}>
                    <strong>Post-delivery feedback</strong>
                    <span>{labelStatus(saved.overall_rating)} · {labelStatus(saved.fit_result)}{saved.worn_confirmed?" · worn and checked":""}</span>
                    {saved.note&&<span style={{opacity:.7}}>{saved.note}</span>}
                    <small style={{opacity:.55}}>Recorded {new Date(saved.created_at).toLocaleDateString()}</small>
                  </div>:<div style={{borderTop:"1px dashed #ddd7cc",paddingTop:10,display:"grid",gap:8}}>
                    <strong>How did the finished garment turn out?</strong>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>
                      <label style={{fontSize:12}}>Overall
                        <select style={input} value={draft.overallRating} onChange={e=>updateOutcomeDraft(order.order_id,{overallRating:e.target.value as CustomerOutcomeRating})}>
                          <option value="love">Love it</option><option value="good">Good</option><option value="needs_work">Needs work</option>
                        </select>
                      </label>
                      <label style={{fontSize:12}}>Fit result
                        <select style={input} disabled={!draft.wornConfirmed} value={draft.fitResult} onChange={e=>updateOutcomeDraft(order.order_id,{fitResult:e.target.value as CustomerFitResult})}>
                          <option value="not_checked">Not checked yet</option><option value="clean_first_fit">Clean first fit</option><option value="minor_alteration">Minor alteration</option><option value="major_alteration">Major alteration</option>
                        </select>
                      </label>
                    </div>
                    <label style={{fontSize:13,display:"flex",gap:8,alignItems:"center"}}>
                      <input type="checkbox" checked={draft.wornConfirmed} onChange={e=>updateOutcomeDraft(order.order_id,{wornConfirmed:e.target.checked,fitResult:e.target.checked?draft.fitResult:"not_checked"})}/>
                      I have worn the garment and checked the fit
                    </label>
                    <textarea style={input} rows={2} placeholder="Optional note. Required when something needs work." value={draft.note} onChange={e=>updateOutcomeDraft(order.order_id,{note:e.target.value})}/>
                    <button style={{...button,justifySelf:"start"}} disabled={busy} onClick={()=>void recordOutcome(order.order_id)}>Save post-delivery feedback</button>
                    <small style={{opacity:.6,lineHeight:1.5}}>This is stored as outcome evidence for this order. It does not automatically change Designer recommendations.</small>
                  </div>;
                })()}
              </div>;
            })}
          </div>}
          {quotes.length>0&&<div style={{marginTop:18}}>
            <strong>Quotes</strong>
            {quotes.map(quote=><div key={quote.quote_id} style={{borderTop:"1px solid #ece6dc",paddingTop:12,marginTop:10,display:"grid",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                <span><strong>{money(quote.currency,quote.total)}</strong> · <span style={{textTransform:"capitalize"}}>{labelStatus(quote.status)}</span></span>
                {quote.status==="sent"&&<button style={{...button,padding:"8px 11px"}} disabled={busy} onClick={()=>void acceptQuote(quote.quote_id)}>Accept quote</button>}
              </div>
              <div style={{fontSize:13,opacity:.6}}>{quote.revision_id}</div>
              {Array.isArray(quote.line_items)&&quote.line_items.length>0&&<div style={{display:"grid",gap:4,fontSize:13}}>
                {quote.line_items.map((item,index)=><div key={quote.quote_id+"-"+index} style={{display:"flex",justifyContent:"space-between",gap:12}}>
                  <span>{item.label}</span><span>{money(quote.currency,item.amount)}</span>
                </div>)}
                <div style={{display:"flex",justifyContent:"space-between",gap:12,borderTop:"1px dashed #ddd7cc",paddingTop:5,marginTop:2}}>
                  <span>Subtotal</span><span>{money(quote.currency,quote.subtotal)}</span>
                </div>
                {Number(quote.adjustment)!==0&&<div style={{display:"flex",justifyContent:"space-between",gap:12}}>
                  <span>Adjustment</span><span>{money(quote.currency,quote.adjustment)}</span>
                </div>}
              </div>}
              {quote.status==="sent"&&<div style={{fontSize:12,lineHeight:1.5,opacity:.65}}>Accepting confirms this quoted amount for the exact locked revision shown above. It does not create a production order by itself.</div>}
            </div>)}
          </div>}
        </section>

        <section style={card}>
          <h2 style={{marginTop:0}}>Locked designs <span style={{opacity:.45}}>({designs.length})</span></h2>
          <div style={{display:"grid",gap:10}}>
            {designs.length===0&&<p style={{opacity:.65}}>No account-owned locked designs yet. New secure copies created while signed in will appear here.</p>}
            {designs.map(item=><div key={item.vaultId} style={{borderTop:"1px solid #ece6dc",paddingTop:12,display:"grid",gap:7}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}>
                <div><strong>{item.revisionId}</strong><div style={{fontSize:13,opacity:.65,marginTop:4}}>Saved {new Date(item.createdAt).toLocaleDateString()} · integrity hash {item.recipeHash.slice(0,12)}…</div></div>
                <button style={{...button,background:"#fff",color:"#7a2f2f",border:"1px solid #d8c6c1",padding:"7px 10px"}} disabled={busy} onClick={()=>void deleteOwned("design",item.vaultId)}>Delete secure copy</button>
              </div>
            </div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,marginTop:18}}>
            <input style={input} placeholder="Paste an older design recovery token to claim it" value={claimDesign} onChange={e=>setClaimDesign(e.target.value)}/>
            <button style={button} disabled={busy} onClick={()=>claim("design")}>Link</button>
          </div>
        </section>

        <section style={card}>
          <h2 style={{marginTop:0}}>Measurement profiles <span style={{opacity:.45}}>({profiles.length})</span></h2>
          <div style={{display:"grid",gap:10}}>
            {profiles.length===0&&<p style={{opacity:.65}}>No account-owned measurement profile yet. Measurements remain private and are shown here only as saved-profile metadata.</p>}
            {profiles.map(item=><div key={item.vaultId} style={{borderTop:"1px solid #ece6dc",paddingTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}>
                <div><strong>Private measurement profile</strong><div style={{fontSize:13,opacity:.65,marginTop:4}}>Saved {new Date(item.createdAt).toLocaleDateString()} · unit {item.unit||"—"}</div></div>
                <button style={{...button,background:"#fff",color:"#7a2f2f",border:"1px solid #d8c6c1",padding:"7px 10px"}} disabled={busy} onClick={()=>void deleteOwned("measurement",item.vaultId)}>Delete secure copy</button>
              </div>
            </div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,marginTop:18}}>
            <input style={input} placeholder="Paste an older measurement recovery token to claim it" value={claimMeasurement} onChange={e=>setClaimMeasurement(e.target.value)}/>
            <button style={button} disabled={busy} onClick={()=>claim("measurement")}>Link</button>
          </div>
        </section>
      </>}

      {message&&<div role="status" style={{padding:"12px 14px",borderRadius:10,background:"#ece8df"}}>{message}</div>}
      <p style={{fontSize:12,lineHeight:1.6,opacity:.6}}>Raw measurement values and private operator notes are not exposed here. Secure recovery tokens remain valid until expiry unless their vault item is deleted.</p>
    </div>
  </main>;
}
