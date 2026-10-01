"use client";

import { useCallback, useEffect, useState } from "react";

type Customer={id?:string;email:string|null};
type OwnedDesign={vaultId:string;revisionId:string;recipeHash:string;createdAt:string;expiresAt:string};
type OwnedProfile={vaultId:string;createdAt:string;expiresAt:string;profile:{unit?:string;shirt?:Record<string,unknown>;pants?:Record<string,unknown>}};

const card:React.CSSProperties={border:"1px solid #ddd7cc",borderRadius:18,padding:20,background:"#fff"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"12px 14px",border:"1px solid #cfc7ba",borderRadius:10,fontSize:15};
const button:React.CSSProperties={padding:"11px 15px",border:0,borderRadius:10,background:"#1a1a1a",color:"#fff",cursor:"pointer",fontWeight:700};

export default function AccountPage(){
  const [customer,setCustomer]=useState<Customer|null>(null);
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [codeSent,setCodeSent]=useState(false);
  const [designs,setDesigns]=useState<OwnedDesign[]>([]);
  const [profiles,setProfiles]=useState<OwnedProfile[]>([]);
  const [claimDesign,setClaimDesign]=useState("");
  const [claimMeasurement,setClaimMeasurement]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  const refresh=useCallback(async()=>{
    const session=await fetch("/api/customer-auth/session",{cache:"no-store"}).then(r=>r.json());
    const next=session.customer||null;
    setCustomer(next);
    if(!next){setDesigns([]);setProfiles([]);return;}
    const [d,m]=await Promise.all([
      fetch("/api/designer/vault",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"listOwned"})}).then(r=>r.json()),
      fetch("/api/measurements/vault",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"listOwned"})}).then(r=>r.json()),
    ]);
    setDesigns(Array.isArray(d.designs)?d.designs:[]);
    setProfiles(Array.isArray(m.profiles)?m.profiles:[]);
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

  async function logout(){
    await fetch("/api/customer-auth/logout",{method:"POST"});
    setMessage("Signed out.");setCodeSent(false);
    await refresh();
  }

  return <main style={{minHeight:"100vh",background:"#f8f6f0",color:"#1a1a1a",padding:"42px 18px"}}>
    <div style={{maxWidth:900,margin:"0 auto",display:"grid",gap:18}}>
      <header>
        <p style={{fontSize:12,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Linen Earth</p>
        <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,6vw,58px)",lineHeight:1,margin:"0 0 12px"}}>My private design account</h1>
        <p style={{maxWidth:680,lineHeight:1.6,opacity:.72}}>Keep locked designs and measurement profiles tied to your account while preserving the existing recovery-token backup.</p>
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
          <h2 style={{marginTop:0}}>Locked designs <span style={{opacity:.45}}>({designs.length})</span></h2>
          <div style={{display:"grid",gap:10}}>
            {designs.length===0&&<p style={{opacity:.65}}>No account-owned locked designs yet. New secure copies created while signed in will appear here.</p>}
            {designs.map(item=><div key={item.vaultId} style={{borderTop:"1px solid #ece6dc",paddingTop:12}}>
              <strong>{item.revisionId}</strong>
              <div style={{fontSize:13,opacity:.65,marginTop:4}}>Saved {new Date(item.createdAt).toLocaleDateString()} · integrity hash {item.recipeHash.slice(0,12)}…</div>
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
              <strong>Private measurement profile</strong>
              <div style={{fontSize:13,opacity:.65,marginTop:4}}>Saved {new Date(item.createdAt).toLocaleDateString()} · unit {item.profile?.unit||"—"}</div>
            </div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,marginTop:18}}>
            <input style={input} placeholder="Paste an older measurement recovery token to claim it" value={claimMeasurement} onChange={e=>setClaimMeasurement(e.target.value)}/>
            <button style={button} disabled={busy} onClick={()=>claim("measurement")}>Link</button>
          </div>
        </section>
      </>}

      {message&&<div role="status" style={{padding:"12px 14px",borderRadius:10,background:"#ece8df"}}>{message}</div>}
      <p style={{fontSize:12,lineHeight:1.6,opacity:.6}}>Raw measurement values are not exposed in this account summary. Secure recovery tokens remain valid until expiry unless their vault item is deleted.</p>
    </div>
  </main>;
}
