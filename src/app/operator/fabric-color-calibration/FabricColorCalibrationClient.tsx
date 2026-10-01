"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Fabric={id:string;colorName:string;line:string;pattern:string;swatchImageUrl:string};
type Profile={
  id:string;
  fabric_id:string|null;
  review_status:string;
  profile?:{measured?:{colour?:{hex?:string}}};
};
type Check={
  check_id:string;
  fabric_id:string;
  profile_id:string|null;
  digital_hex:string;
  method:string;
  physical_l:number|string;
  physical_a:number|string;
  physical_b:number|string;
  physical_hex:string|null;
  delta_e:number|string;
  illuminant:string;
  device:string;
  note:string;
  created_at:string;
};
type Summary={
  target:number;
  uniqueFabrics:number;
  remaining:number;
  evidenceGateComplete:boolean;
  averageDeltaE:number|null;
  medianDeltaE:number|null;
};

const panel:React.CSSProperties={background:"#fff",border:"1px solid #ddd7cc",borderRadius:18,padding:20};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #cbc3b7",borderRadius:9,fontSize:14,background:"#fff"};
const button:React.CSSProperties={border:0,borderRadius:10,padding:"11px 15px",background:"#1a1a1a",color:"#fff",fontWeight:700,cursor:"pointer"};

export default function FabricColorCalibrationClient(){
  const [fabrics,setFabrics]=useState<Fabric[]>([]);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [checks,setChecks]=useState<Check[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [fabricId,setFabricId]=useState("");
  const [digitalHex,setDigitalHex]=useState("");
  const [method,setMethod]=useState("colorimeter");
  const [physicalHex,setPhysicalHex]=useState("");
  const [l,setL]=useState("");
  const [a,setA]=useState("");
  const [b,setB]=useState("");
  const [illuminant,setIlluminant]=useState("D65");
  const [device,setDevice]=useState("");
  const [note,setNote]=useState("");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);

  async function load(){
    const [evidenceResponse,catalogResponse,profilesResponse]=await Promise.all([
      fetch("/api/operator/fabric-color-calibration",{cache:"no-store"}),
      fetch("/api/operator/designer-data",{cache:"no-store"}),
      fetch("/api/operator/fabric-analyzer/review?limit=200&scope=all",{cache:"no-store"}),
    ]);
    if([evidenceResponse,catalogResponse,profilesResponse].some((r)=>r.status===401)){
      window.location.href="/operator/login?next=/operator/fabric-color-calibration";
      return;
    }
    const evidence=await evidenceResponse.json();
    const catalog=await catalogResponse.json();
    const profileData=await profilesResponse.json();
    if(!evidenceResponse.ok) throw new Error(evidence.error||"Colour evidence could not be loaded.");
    setChecks(Array.isArray(evidence.checks)?evidence.checks:[]);
    setSummary(evidence.summary||null);
    setFabrics(Array.isArray(catalog.fabrics)?catalog.fabrics:[]);
    setProfiles(Array.isArray(profileData.profiles)?profileData.profiles:[]);
  }

  useEffect(()=>{void load().catch((error)=>setMessage(error instanceof Error?error.message:"Could not load calibration desk."));},[]);

  const selectedFabric=fabrics.find((item)=>item.id===fabricId)||null;
  const selectedProfile=useMemo(
    ()=>profiles.find((item)=>item.fabric_id===fabricId && ["approved","corrected"].includes(item.review_status))
      || profiles.find((item)=>item.fabric_id===fabricId)
      || null,
    [profiles,fabricId],
  );

  useEffect(()=>{
    const measured=selectedProfile?.profile?.measured?.colour?.hex;
    if(measured) setDigitalHex(measured.toUpperCase());
  },[selectedProfile?.id]);

  async function save(){
    if(!fabricId||!digitalHex||saving) return;
    setSaving(true);setMessage("");
    try{
      const physicalLab=l||a||b?{l:Number(l),a:Number(a),b:Number(b)}:undefined;
      const response=await fetch("/api/operator/fabric-color-calibration",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          fabricId,
          profileId:selectedProfile?.id||undefined,
          digitalHex,
          method,
          physicalLab,
          physicalHex:physicalHex||undefined,
          illuminant,
          device,
          note,
        }),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Physical colour check could not be saved.");
      setMessage(`Physical colour check saved · ΔE ${data.check?.deltaE ?? "—"}.`);
      setPhysicalHex("");setL("");setA("");setB("");setNote("");
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Physical colour check could not be saved.");
    }finally{setSaving(false);}
  }

  return <main style={{minHeight:"100vh",background:"#f8f6f0",color:"#1a1a1a",padding:"34px 18px"}}>
    <div style={{maxWidth:1050,margin:"0 auto",display:"grid",gap:18}}>
      <header style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"end",flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>LINEN EARTH / PRIVATE OPERATOR</p>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,5vw,56px)",margin:"0 0 10px",lineHeight:1}}>Physical Colour Calibration</h1>
          <p style={{maxWidth:720,opacity:.72,lineHeight:1.6}}>Compare the digital fabric colour against a controlled physical measurement. ΔE is recorded as descriptive evidence; no pass threshold is invented here.</p>
        </div>
        <nav style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/operator/fabric-ground-truth">Ground Truth</Link><Link href="/operator/fabric-analyzer">Analyzer</Link><Link href="/operator">Operator Desk</Link></nav>
      </header>

      <section style={{...panel,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        <article><small>UNIQUE CHECKED FABRICS</small><div style={{fontSize:34,fontWeight:800}}>{summary?.uniqueFabrics ?? 0}<span style={{fontSize:16,opacity:.45}}> / {summary?.target ?? 10}</span></div></article>
        <article><small>REMAINING</small><div style={{fontSize:34,fontWeight:800}}>{summary?.remaining ?? 10}</div></article>
        <article><small>MEDIAN ΔE</small><div style={{fontSize:34,fontWeight:800}}>{summary?.medianDeltaE ?? "—"}</div><span style={{fontSize:12,opacity:.6}}>descriptive only</span></article>
        <article><small>EVIDENCE GATE</small><div style={{fontSize:24,fontWeight:800}}>{summary?.evidenceGateComplete?"10 checks recorded":"COLLECTING"}</div></article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.15fr) minmax(320px,.85fr)",gap:18}}>
        <article style={panel}>
          <h2 style={{marginTop:0}}>Record controlled check</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
            <label style={{gridColumn:"1/-1"}}><span>Stock fabric</span><select style={input} value={fabricId} onChange={(e)=>setFabricId(e.target.value)}><option value="">Choose fabric</option>{fabrics.map((item)=><option key={item.id} value={item.id}>{item.colorName} · {item.line}</option>)}</select></label>
            <label><span>Digital measured hex</span><input style={input} value={digitalHex} onChange={(e)=>setDigitalHex(e.target.value)} placeholder="#AABBCC"/></label>
            <label><span>Method</span><select style={input} value={method} onChange={(e)=>setMethod(e.target.value)}><option value="spectrophotometer">Spectrophotometer</option><option value="colorimeter">Colorimeter</option><option value="calibrated_capture">Calibrated capture</option></select></label>
            <label><span>Physical calibrated hex</span><input style={input} value={physicalHex} onChange={(e)=>setPhysicalHex(e.target.value)} placeholder="#AABBCC"/></label>
            <label><span>Illuminant</span><input style={input} value={illuminant} onChange={(e)=>setIlluminant(e.target.value)} placeholder="D65"/></label>
            <label><span>Physical L*</span><input style={input} inputMode="decimal" value={l} onChange={(e)=>setL(e.target.value)} placeholder="or use physical hex"/></label>
            <label><span>Physical a*</span><input style={input} inputMode="decimal" value={a} onChange={(e)=>setA(e.target.value)} placeholder="LAB a"/></label>
            <label><span>Physical b*</span><input style={input} inputMode="decimal" value={b} onChange={(e)=>setB(e.target.value)} placeholder="LAB b"/></label>
            <label><span>Instrument / device</span><input style={input} value={device} onChange={(e)=>setDevice(e.target.value)} placeholder="Required for instrument checks"/></label>
            <label style={{gridColumn:"1/-1"}}><span>Evidence/setup note</span><textarea style={{...input,minHeight:84}} value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Lighting, grey card/reference, instrument setup or capture procedure."/></label>
          </div>
          <p style={{fontSize:12,opacity:.62,lineHeight:1.5}}>Supply either complete physical LAB values or a calibrated physical hex. Instrument checks require device identity; calibrated captures require a setup note.</p>
          <button style={button} disabled={saving||!fabricId||!digitalHex} onClick={()=>void save()}>{saving?"Saving…":"Save append-only colour evidence"}</button>
          {selectedFabric&&<div style={{display:"flex",alignItems:"center",gap:12,marginTop:16}}><img src={selectedFabric.swatchImageUrl} alt="" style={{width:54,height:54,objectFit:"cover",borderRadius:8}}/><div><strong>{selectedFabric.colorName}</strong><div style={{fontSize:12,opacity:.6}}>{selectedFabric.pattern} · Analyzer {selectedProfile?selectedProfile.review_status:"profile unavailable"}</div></div></div>}
        </article>

        <aside style={panel}>
          <h2 style={{marginTop:0}}>Recent evidence</h2>
          <div style={{display:"grid",gap:10,maxHeight:620,overflow:"auto"}}>
            {checks.length===0&&<p style={{opacity:.65}}>No physical colour checks recorded yet.</p>}
            {checks.slice(0,30).map((item)=><div key={item.check_id} style={{borderTop:"1px solid #ece6dc",paddingTop:10}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong>{item.fabric_id}</strong><b>ΔE {Number(item.delta_e).toFixed(2)}</b></div>
              <div style={{fontSize:12,opacity:.62,marginTop:4}}>{item.method.replaceAll("_"," ")} · {new Date(item.created_at).toLocaleDateString()}</div>
              <div style={{display:"flex",gap:6,marginTop:7}}><i title={item.digital_hex} style={{width:24,height:24,borderRadius:6,background:item.digital_hex,border:"1px solid #aaa"}}/>{item.physical_hex&&<i title={item.physical_hex} style={{width:24,height:24,borderRadius:6,background:item.physical_hex,border:"1px solid #aaa"}}/>}</div>
            </div>)}
          </div>
        </aside>
      </section>

      {message&&<div role="status" style={{...panel,background:"#ece8df"}}>{message}</div>}
    </div>
  </main>;
}
