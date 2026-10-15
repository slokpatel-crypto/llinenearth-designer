"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Pack = { id: string; objective: string };
type HarvestResult = {
  schemaVersion: number;
  id: string;
  objective: string;
  source: "ai-generated-suggestions";
  reviewStatus: "unreviewed";
  physicalEvidenceVerified: false;
  model: string;
  createdAt: string;
  entries: Array<Record<string,string>>;
  usage: { inputTokens: number | null; outputTokens: number | null };
};

export default function HarvestClient({ packs }: { packs: Pack[] }) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState<HarvestResult[]>([]);
  const [current, setCurrent] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function runAll() {
    if (busy.current) return;
    busy.current = true;
    setRunning(true); setError(""); setCompleted([]); setCurrent("");
    const results: HarvestResult[] = [];
    try {
      for (const pack of packs) {
        setCurrent(pack.id);
        const response = await fetch("/api/operator/anthropic-harvest", {
          method: "POST", cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ packId: pack.id }),
        });
        const data = await response.json() as HarvestResult & { error?: string };
        if (!response.ok || !Array.isArray(data.entries) || data.id !== pack.id) {
          throw new Error("Stopped at " + pack.id + ": " + (data.error || "Invalid provider response"));
        }
        results.push(data);
        setCompleted([...results]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Harvest interrupted; earlier packs remain available.");
    } finally {
      busy.current = false;
      setCurrent("");
      setRunning(false);
    }
  }

  function download() {
    if (!completed.length) return;
    const file = {
      version: 1,
      source: "ai-generated-suggestions",
      reviewStatus: "unreviewed",
      physicallyVerified: false,
      generatedAt: new Date().toISOString(),
      planned: packs.length,
      completed: completed.length,
      packs: completed,
    };
    const blob = new Blob([JSON.stringify(file,null,2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "linen-earth-anthropic-unreviewed-knowledge.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <main style={{ maxWidth: 780, margin: "50px auto", padding: "16px 20px", fontFamily: "sans-serif", lineHeight: 1.6 }}>
    <Link href="/operator">← Operator desk</Link>
    <h1>Claude research harvest</h1>
    <p>Eight bounded requests, only with a configured protected server key. Every result is <strong>unreviewed</strong>. AI cannot certify cloth or approve tailoring.</p>
    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
      <button type="button" onClick={runAll} disabled={running} style={{ padding:"10px 20px", cursor:running?"wait":"pointer" }}>
        {running ? "Generating research…" : "Generate all eight packs"}
      </button>
      <button type="button" onClick={download} disabled={completed.length===0} style={{ padding:"10px 20px" }}>Download JSON ({completed.length})</button>
    </div>
    <p aria-live="polite">{running ? "Current pack: " + current : completed.length + " of " + packs.length + " packs captured."}</p>
    {error && <p role="alert">{error}</p>}
    <ol>{packs.map((pack) => <li key={pack.id} style={{ marginBottom: 15 }}>
      <strong>{pack.id.replaceAll("-", " ")}</strong> — {pack.objective}
      {completed.some((item)=>item.id===pack.id) && <span> · Unreviewed JSON captured</span>}
    </li>)}</ol>
    <p><strong>Important:</strong> Downloaded records require supplier measurements, stock verification, engineering QA and owner/tailor review before entering production.</p>
  </main>;
}
