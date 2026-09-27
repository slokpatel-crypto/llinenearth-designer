"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type QA = {
  generatedAt:string;
  scenarios:Array<{id:string;label:string}>;
  coverage:{total:number;physicallyVerified:number;weight:number;season:number;formality:number;drape:number};
  summary:{
    anchors:number;scenarios:number;totalCases:number;heldCases:number;noResultCases:number;
    averageConfidence:number;averageDirections:number;modeCounts:Record<string,number>;warningCounts:Record<string,number>;
  };
  weakCases:Array<{
    scenarioId:string;scenarioLabel:string;anchorId:string;anchorName:string;anchorLine:string;anchorKind:string;
    directions:number;confidence:number;held:boolean;pairing:string;warnings:string[];unknowns:string[];
  }>;
};

function pct(value:number,total:number) {
  return total ? Math.round((value/total)*100) : 0;
}

export default function DesignerQaClient() {
  const [data,setData] = useState<QA|null>(null);
  const [loading,setLoading] = useState(true);
  const [scenario,setScenario] = useState("all");
  const [kind,setKind] = useState("all");
  const [onlyHeld,setOnlyHeld] = useState(false);
  const [error,setError] = useState("");

  async function run() {
    setLoading(true);setError("");
    try {
      const response = await fetch("/api/operator/designer-qa",{cache:"no-store"});
      if (response.status===401) {
        window.location.href="/operator/login?next=/operator/designer-qa";
        return;
      }
      const next=await response.json() as QA & {error?:string};
      if (!response.ok) throw new Error(next.error || "Designer QA could not run.");
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error?cause.message:"Designer QA could not run.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{void run();},[]);

  const cases=useMemo(()=>{
    if(!data)return[];
    return data.weakCases.filter((item)=>
      (scenario==="all"||item.scenarioId===scenario)
      &&(kind==="all"||item.anchorKind===kind)
      &&(!onlyHeld||item.held)
    );
  },[data,scenario,kind,onlyHeld]);

  if(!data && loading)return <main className="designerQa"><div className="qaLoading">Running Designer QA matrix…</div></main>;

  return <main className="designerQa">
    <header className="qaHeader">
      <div><span>LLINEN EARTH / OPERATOR</span><h1>Designer QA Desk</h1><p>Stress-test the current rule + taste system across the structured catalogue before customer use.</p></div>
      <div><button onClick={()=>void run()} disabled={loading}>{loading?"Running…":"Run QA again"}</button><Link href="/operator">Operator Desk</Link><Link href="/operator/designer-data">Designer Data</Link></div>
    </header>

    {error && <div className="qaError">{error}</div>}

    {data && <>
      <section className="qaScoreboard">
        <article><span>TOTAL TEST CASES</span><strong>{data.summary.totalCases}</strong><small>{data.summary.anchors} anchors × {data.summary.scenarios} contexts</small></article>
        <article><span>AVG CONFIDENCE</span><strong>{data.summary.averageConfidence}</strong><small>/100 across returned primaries</small></article>
        <article className={data.summary.heldCases?"attention":""}><span>HELD / REVIEW</span><strong>{data.summary.heldCases}</strong><small>{pct(data.summary.heldCases,data.summary.totalCases)}% of cases</small></article>
        <article className={data.summary.noResultCases?"attention":""}><span>NO RESULT</span><strong>{data.summary.noResultCases}</strong><small>no opposite-category valid pair</small></article>
        <article><span>AVG DIRECTIONS</span><strong>{data.summary.averageDirections}</strong><small>target is up to 3</small></article>
      </section>

      <section className="qaCoverage">
        <div className="qaSectionTitle"><span>DATA COVERAGE</span><h2>Where the Designer still relies on uncertainty.</h2></div>
        <div className="coverageGrid">
          {[
            ["Physical stock",data.coverage.physicallyVerified],
            ["Weight / GSM",data.coverage.weight],
            ["Season",data.coverage.season],
            ["Formality",data.coverage.formality],
            ["Drape",data.coverage.drape],
          ].map(([label,value])=><article key={String(label)}><div><span>{label}</span><b>{pct(Number(value),data.coverage.total)}%</b></div><i><em style={{width:`${pct(Number(value),data.coverage.total)}%`}} /></i><small>{String(value)} / {data.coverage.total} fabrics verified</small></article>)}
        </div>
      </section>

      <section className="qaWarnings">
        <div className="qaSectionTitle"><span>RULE PRESSURE</span><h2>Warnings triggered in the test matrix.</h2></div>
        <div className="warningGrid">
          {["CR-1","CR-2","CR-3","CR-4","CR-5","CR-6","CR-7"].map((id)=><article key={id}><span>{id}</span><strong>{data.summary.warningCounts[id]||0}</strong><small>warning cases</small></article>)}
        </div>
      </section>

      <section className="qaCases">
        <div className="qaCasesHead">
          <div className="qaSectionTitle"><span>WEAK CASES</span><h2>Review these first.</h2></div>
          <div className="qaFilters">
            <select value={scenario} onChange={(e)=>setScenario(e.target.value)}><option value="all">All scenarios</option>{data.scenarios.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
            <select value={kind} onChange={(e)=>setKind(e.target.value)}><option value="all">All anchor types</option><option value="shirt">Shirt anchors</option><option value="trouser">Trouser anchors</option></select>
            <label><input type="checkbox" checked={onlyHeld} onChange={(e)=>setOnlyHeld(e.target.checked)} /> Held only</label>
          </div>
        </div>

        <div className="qaTableWrap"><table>
          <thead><tr><th>Context</th><th>Anchor</th><th>Designer pair</th><th>Directions</th><th>Confidence</th><th>Warnings</th><th>Unknowns</th></tr></thead>
          <tbody>{cases.map((item)=><tr key={`${item.scenarioId}-${item.anchorId}`} className={item.held?"held":""}>
            <td><b>{item.scenarioLabel}</b><small>{item.anchorKind} anchor</small></td>
            <td><b>{item.anchorName}</b><small>{item.anchorLine}</small></td>
            <td>{item.pairing}</td>
            <td>{item.directions}</td>
            <td><strong>{item.confidence}</strong>{item.held&&<em>HELD</em>}</td>
            <td>{item.warnings.length?item.warnings.join(", "):"—"}</td>
            <td>{item.unknowns.length?item.unknowns.join(", "):"—"}</td>
          </tr>)}</tbody>
        </table></div>
        {!cases.length && <div className="qaEmpty">No cases match these filters.</div>}
      </section>

      <footer className="qaFoot">Generated {new Date(data.generatedAt).toLocaleString("en-IN")} · Deterministic QA only; human taste review remains the final authority.</footer>
    </>}
  </main>;
}
