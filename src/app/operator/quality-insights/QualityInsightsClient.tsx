"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  summarizeCustomerQualityInsights,
  type QualityDimension,
} from "@/lib/designer/customer-quality-insights";
import type {
  CustomerOutcomeEvidenceRow,
  CustomerOutcomePolicyRow,
  CustomerOutcomeReviewRow,
} from "@/lib/designer/customer-outcome-learning";

type Snapshot = {
  configured: boolean;
  outcomes: CustomerOutcomeEvidenceRow[];
  reviews: CustomerOutcomeReviewRow[];
  policies: CustomerOutcomePolicyRow[];
};

const EMPTY: Snapshot = { configured: false, outcomes: [], reviews: [], policies: [] };
const DIMENSIONS: QualityDimension[] = ["Shirt fit", "Trouser shape", "Occasion"];
const GATE_MESSAGES: Record<ReturnType<typeof summarizeCustomerQualityInsights>["gate"], string> = {
  incomplete_snapshot: "The evidence list reached its retrieval limit. These are partial descriptive counts, not representative production results.",
  no_human_policy: "No independently recorded human learning threshold is available. Keep collecting and reviewing evidence.",
  collecting: "The current set of approved, matched design cases remains below the human-defined threshold.",
  review_only: "The human quantity threshold is met in this snapshot. An independent tailor and owner review is still required before changing any styling rule.",
};

export default function QualityInsightsClient() {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [message, setMessage] = useState("");
  const [dimension, setDimension] = useState<QualityDimension>("Shirt fit");
  async function refresh(signal?: AbortSignal) {
    setState("loading");
    try {
      const response = await fetch("/api/operator/customer-outcomes", { cache: "no-store", signal });
      if (response.status === 401) {
        window.location.assign("/operator/login?next=/operator/quality-insights");
        return;
      }
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== "object" || Array.isArray(body)) throw Error("Private outcome evidence is unavailable.");
      const data = body as Partial<Snapshot>;
      if (data.configured !== false && (!Array.isArray(data.outcomes) ||
        !Array.isArray(data.reviews) || !Array.isArray(data.policies))) throw Error("The outcome evidence response was incomplete.");
      if (signal?.aborted) return;
      setSnapshot({
        configured: data.configured !== false,
        outcomes: data.configured === false ? [] : data.outcomes!,
        reviews: data.configured === false ? [] : data.reviews!,
        policies: data.configured === false ? [] : data.policies!,
      });
      setMessage("");
      setState("loaded");
    } catch {
      if (signal?.aborted) return;
      setSnapshot(EMPTY); // Never display stale results as if current.
      setMessage("Unable to load reviewed production outcomes. No estimate was substituted.");
      setState("error");
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);

  const insight = useMemo(() =>
    summarizeCustomerQualityInsights(snapshot.outcomes, snapshot.reviews, snapshot.policies),
    [snapshot.outcomes, snapshot.reviews, snapshot.policies],
  );
  const rows = useMemo(() => insight.cohorts.filter(x => x.dimension === dimension),
    [insight.cohorts, dimension]);
  const ready = state === "loaded" && snapshot.configured;

  return <main className="qualityInsights">
    <header className="qiHeader">
      <div>
        <small>LINEN EARTH / ROADMAP V2 / OPERATOR-ONLY</small>
        <h1>Production Quality Insights</h1>
        <p>Review which garment constructions appear in real post-delivery feedback, before any design or tailoring rule is changed.</p>
      </div>
      <nav aria-label="Operator quality insight navigation">
        <Link href="/operator/customer-outcomes">Review customer outcomes</Link>
        <Link href="/operator/production">Production Desk</Link>
        <button type="button" disabled={state === "loading"} onClick={() => void refresh()}>Refresh evidence</button>
      </nav>
    </header>

    {state === "loading" && <p className="qiMessage" role="status">Loading private outcome evidence…</p>}
    {state === "error" && <p className="qiMessage qiWarning" role="alert">{message}</p>}
    {state === "loaded" && !snapshot.configured && <p className="qiMessage qiWarning" role="status">The production outcome backend is not configured. There is no evidence to analyze.</p>}

    {ready && <>
      <section className="qiTotals" aria-label="Verified outcome totals">
        <article><small>REPORTED OUTCOMES</small><strong>{insight.reportedOutcomes}</strong><span>Retrieved records, not unique customers</span></article>
        <article><small>REVIEWED ORDERS</small><strong>{insight.reviewedUniqueOrders}</strong><span>Latest unambiguous outcome per order</span></article>
        <article><small>APPROVED + TRACEABLE</small><strong>{insight.approvedWithLineage}</strong><span>Human-approved and tied to a versioned recipe</span></article>
        <article><small>CONFIRMED WORN FIT</small><strong>{insight.verifiedWornFit}</strong><span>Actual customer-reported fit after wear</span></article>
      </section>

      <section className="qiGate" aria-label="Learning readiness boundary">
        <div>
          <small>EVIDENCE GATE · {insight.gate.replaceAll("_", " ").toUpperCase()}</small>
          <h2>{insight.humanMinimum === null ? "No signed threshold" : `${insight.approvedWithLineage} of ${insight.humanMinimum} human-approved cases`}</h2>
        </div>
        <p>{GATE_MESSAGES[insight.gate]}</p>
        <p className="qiSubtle">Descriptive evidence only. No automated change to Designer rankings, fit allowances, garment construction or launch approval.</p>
      </section>

      <section className="qiPanels">
        <article>
          <h2>Customer ratings</h2>
          <dl>
            <div><dt>Loved the garment</dt><dd>{insight.ratings.love}</dd></div>
            <div><dt>Good</dt><dd>{insight.ratings.good}</dd></div>
            <div><dt>Needs work</dt><dd>{insight.ratings.needs_work}</dd></div>
          </dl>
        </article>
        <article>
          <h2>Fit after confirmed wear</h2>
          <dl>
            <div><dt>Clean first fit</dt><dd>{insight.fits.clean_first_fit}</dd></div>
            <div><dt>Minor alteration</dt><dd>{insight.fits.minor_alteration}</dd></div>
            <div><dt>Major alteration</dt><dd>{insight.fits.major_alteration}</dd></div>
          </dl>
        </article>
        <article>
          <h2>Evidence excluded</h2>
          <dl>
            <div><dt>Not reviewed</dt><dd>{insight.excluded.unreviewed}</dd></div>
            <div><dt>Reviewer rejected</dt><dd>{insight.excluded.rejected}</dd></div>
            <div><dt>Missing/mismatched recipe</dt><dd>{insight.excluded.invalidLineage}</dd></div>
            <div><dt>Invalid/ambiguous records</dt><dd>{insight.excluded.invalidData + insight.excluded.ambiguous}</dd></div>
          </dl>
        </article>
      </section>

      <section className="qiCohorts" aria-labelledby="qiCohortTitle">
        <div className="qiCohortHeader">
          <div><small>NO AUTO-RECOMMENDATIONS</small><h2 id="qiCohortTitle">Construction-level evidence</h2></div>
          <label>Compare by
            <select value={dimension} onChange={e => setDimension(e.target.value as QualityDimension)}>
              {DIMENSIONS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        </div>
        <p>Each order is counted at most once. Categories show descriptive counts, not defect rates or statistically significant performance rankings.</p>
        {rows.length ? <div className="qiScroll">
          <table>
            <thead><tr><th scope="col">{dimension}</th><th scope="col">Approved orders</th>
              <th scope="col">Fit checked</th><th scope="col">Clean fit</th>
              <th scope="col">Minor alteration</th><th scope="col">Major alteration</th>
              <th scope="col">Needs work</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.dimension + ":" + row.value}>
              <th scope="row">{row.value}</th><td>{row.orders}</td><td>{row.worn}</td>
              <td>{row.cleanFirstFit}</td><td>{row.minorAlterations}</td>
              <td>{row.majorAlterations}</td><td>{row.needsWork}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="qiEmpty">No matching reviewed outcomes with verified construction context yet.</p>}
      </section>
      <p className="qiFoot">Privacy: only aggregated categories appear here. Customer names, contact details, notes, body measurements and individual order identifiers are not included. The source endpoint is restricted to authenticated operators.</p>
    </>}
  </main>;
}
