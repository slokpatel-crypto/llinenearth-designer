"use client";

import Link from "next/link";
import { useState } from "react";
import type { LockedDesignRevision } from "@/lib/designer/design-lock";
import { buildProductionHandoff } from "@/lib/designer/production-handoff";
import { buildTailorTechPackHtml, techPackFilename } from "@/lib/designer/tech-pack";
import "./recover.css";

export default function RecoverDesignPage(){
  const [token,setToken]=useState("");
  const [revision,setRevision]=useState<LockedDesignRevision|null>(null);
  const [expiresAt,setExpiresAt]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function vault(action:"load"|"delete"){
    if(!token.trim()||busy) return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/designer/vault",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action,recoveryToken:token.trim()}),
      });
      const data=await response.json() as {revision?:LockedDesignRevision;expiresAt?:string;deleted?:boolean;error?:string};
      if(!response.ok) throw new Error(data.error||"Design recovery failed.");
      if(action==="load"){
        if(!data.revision) throw new Error("No locked design was returned.");
        setRevision(data.revision);
        setExpiresAt(data.expiresAt||"");
        setMessage("Locked design recovered and integrity-checked.");
      } else {
        setRevision(null);setExpiresAt("");setToken("");
        setMessage(data.deleted?"Secure cloud copy deleted.":"No matching secure copy was found.");
      }
    }catch(error){
      setRevision(null);
      setMessage(error instanceof Error?error.message:"Design recovery failed.");
    }finally{
      setBusy(false);
    }
  }

  function download(name:string,type:string,content:string){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  function downloadRevision(){
    if(!revision) return;
    download(`linen-earth-${revision.revisionId.toLowerCase()}.json`,"application/json",JSON.stringify(revision,null,2));
  }

  function downloadHandoff(){
    if(!revision) return;
    const handoff=buildProductionHandoff(revision);
    download(`linen-earth-production-handoff-${revision.revisionId.toLowerCase()}.json`,"application/json",JSON.stringify(handoff,null,2));
  }

  function downloadTechPack(){
    if(!revision) return;
    const handoff=buildProductionHandoff(revision);
    download(techPackFilename(handoff),"text/html;charset=utf-8",buildTailorTechPackHtml(handoff));
  }

  return <main className="recoverDesign">
    <header>
      <Link href="/" className="recoverBrand">LINEN EARTH</Link>
      <span>LOCKED DESIGN RECOVERY</span>
    </header>

    <section className="recoverHero">
      <div>
        <span>PRIVATE RECOVERY</span>
        <h1>Recover a locked design.</h1>
        <p>Paste the recovery token created when you saved a secure cloud copy. The token is the key to this private design, so do not share it publicly.</p>
      </div>
      <div className="recoverForm">
        <label>Recovery token
          <textarea value={token} onChange={(event)=>setToken(event.target.value)} rows={4} placeholder="lev1.…" autoComplete="off" spellCheck={false}/>
        </label>
        <button type="button" onClick={()=>void vault("load")} disabled={busy||!token.trim()}>{busy?"Checking…":"Recover design"}</button>
        {message&&<p>{message}</p>}
      </div>
    </section>

    {revision&&<section className="recoverResult">
      <div className="recoverSummary">
        <span>INTEGRITY VERIFIED</span>
        <h2>{revision.garmentSpec.fabrics.shirt.name}<br/><em>with {revision.garmentSpec.fabrics.trouser.name}</em></h2>
        <div>
          <p><small>REVISION</small><b>{revision.revisionId}</b></p>
          <p><small>RECIPE</small><b>{revision.recipeHash.slice(0,16).toUpperCase()}</b></p>
          <p><small>STATUS</small><b>{revision.garmentSpec.status.replaceAll("_"," ")}</b></p>
          <p><small>EXPIRES</small><b>{expiresAt?new Date(expiresAt).toLocaleDateString():"—"}</b></p>
        </div>
      </div>
      <div className="recoverDetails">
        <article><span>SHIRT</span><b>{revision.garmentSpec.shirt.fit}</b><p>{revision.garmentSpec.shirt.collar} · {revision.garmentSpec.shirt.cuff} · {revision.garmentSpec.shirt.wear}</p></article>
        <article><span>TROUSER</span><b>{revision.garmentSpec.trouser.shape}</b><p>{revision.garmentSpec.trouser.rise} · {revision.garmentSpec.trouser.waistband} · {revision.garmentSpec.trouser.break}</p></article>
        <article><span>REVIEW ITEMS</span><b>{revision.garmentSpec.unresolved.length}</b><p>{revision.garmentSpec.unresolved.slice(0,3).join(" · ")||"No unresolved items recorded."}</p></article>
        <div className="recoverActions">
          <button type="button" onClick={downloadRevision}>Download locked revision</button>
          <button type="button" onClick={downloadHandoff}>Download tailor handoff</button>
          <button type="button" onClick={downloadTechPack}>Download printable tech pack</button>
          <button type="button" className="danger" onClick={()=>void vault("delete")} disabled={busy}>Delete secure cloud copy</button>
        </div>
      </div>
    </section>}

    <footer><Link href="/designer-studio">Back to Designer →</Link><span>No recovery token is placed in the page URL.</span></footer>
  </main>;
}
