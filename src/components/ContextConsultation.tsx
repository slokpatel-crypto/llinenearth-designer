"use client";

import { useMemo, useState } from "react";
import type { ContextProfile, FabricSelection } from "@/lib/designer-types";

type Key = keyof ContextProfile;
type Question = { key: Key; kicker: string; title: string; note: string; options: string[] };

const baseQuestions: Question[] = [
  { key: "occasion", kicker: "OCCASION", title: "What are we dressing for?", note: "This sets the first formality and garment boundaries.", options: ["Wedding", "Business", "Resort / holiday", "Dinner / evening", "Smart casual", "Festive / cultural"] },
  { key: "venue", kicker: "SETTING", title: "Where will it happen?", note: "Venue changes how polished, breathable and expressive the look can be.", options: ["Luxury hotel", "Beach / coast", "Garden / lawn", "Office / boardroom", "Restaurant / club", "Outdoor city", "Home / private event"] },
  { key: "time", kicker: "TIME", title: "When will you wear it?", note: "Light and color behave differently through the day.", options: ["Morning", "Daytime", "Late afternoon", "Sunset", "Evening", "Late night"] },
  { key: "environment", kicker: "ENVIRONMENT", title: "Mostly indoors or outdoors?", note: "This helps balance structure, breathability and layering.", options: ["Indoor / air-conditioned", "Mostly indoor", "Mixed indoor + outdoor", "Mostly outdoor", "Hot / humid outdoor"] },
  { key: "formality", kicker: "FORMALITY", title: "How formal should it feel?", note: "Choose the impression, not a dress-code label.", options: ["Relaxed", "Smart relaxed", "Refined", "Formal", "Ceremonial / evening formal"] },
  { key: "impression", kicker: "IMPRESSION", title: "What should the outfit communicate?", note: "This is more useful than asking for a trend.", options: ["Quiet confidence", "Sharp and powerful", "Relaxed sophistication", "Youthful and modern", "Creative individuality", "Traditional refinement"] },
  { key: "fit", kicker: "SILHOUETTE", title: "How should it sit on the body?", note: "We will preserve this proportion across the recommendation.", options: ["Clean slim", "Tailored", "Straight", "Relaxed", "Soft / fluid"] },
  { key: "aesthetic", kicker: "AESTHETIC", title: "Which design language feels closest?", note: "This becomes the primary aesthetic signal, not a rigid costume.", options: ["Quiet Luxury", "Modern Classic", "Italian-Inspired", "British-Inspired", "Resort Luxury", "Contemporary Indian", "Minimal"] },
];

export function ContextConsultation({ fabric, onComplete, onBack }: { fabric: FabricSelection; onComplete: (profile: ContextProfile) => void; onBack: () => void }) {
  const [answers, setAnswers] = useState<Partial<ContextProfile>>({});
  const [index, setIndex] = useState(0);
  const question = baseQuestions[index];
  const progress = Math.round(((index + 1) / baseQuestions.length) * 100);

  const fabricName = useMemo(() => fabric.materialOverride || fabric.profile.observations.find((x) => x.label === "Likely material family")?.value || "Your fabric", [fabric]);

  function choose(value: string) {
    const next = { ...answers, [question.key]: value };
    setAnswers(next);
    if (index < baseQuestions.length - 1) setIndex((v) => v + 1);
    else onComplete(next as ContextProfile);
  }

  function edit(key: Key) {
    const nextIndex = baseQuestions.findIndex((q) => q.key === key);
    if (nextIndex >= 0) setIndex(nextIndex);
  }

  return (
    <section className="contextStudio">
      <div className="contextTop">
        <button className="textButton" onClick={onBack}>← Fabric profile</button>
        <div className="contextProgress"><span style={{ width: `${progress}%` }} /></div>
        <span className="micro">{index + 1} / {baseQuestions.length}</span>
      </div>

      <div className="contextGrid">
        <div className="questionPanel">
          <p className="eyebrow">PHASE 3 · DESIGN CONTEXT</p>
          <span className="micro">{question.kicker}</span>
          <h1>{question.title}</h1>
          <p className="questionNote">{question.note}</p>
          <div className="choiceGrid">
            {question.options.map((option) => (
              <button key={option} className={answers[question.key] === option ? "choice active" : "choice"} onClick={() => choose(option)}>
                <span>{option}</span><i>→</i>
              </button>
            ))}
          </div>
          {index > 0 && <button className="textButton backQuestion" onClick={() => setIndex((v) => Math.max(0, v - 1))}>← Previous question</button>}
        </div>

        <aside className="briefPanel">
          <span className="micro">LIVE DESIGN BRIEF</span>
          <h2>We are narrowing the possibilities.</h2>
          <div className="briefFabric">
            <span>FABRIC</span><strong>{fabricName}</strong><p>{fabric.profile.summary}</p>
          </div>
          <div className="briefAnswers">
            {baseQuestions.map((q) => (
              <button key={q.key} disabled={!answers[q.key]} onClick={() => edit(q.key)}>
                <span>{q.kicker}</span><strong>{answers[q.key] || "Not answered yet"}</strong>{answers[q.key] && <em>Edit</em>}
              </button>
            ))}
          </div>
          <p className="briefFoot">Only high-information questions are asked. Every answer remains editable before the Designer Engine uses the brief.</p>
        </aside>
      </div>
    </section>
  );
}
