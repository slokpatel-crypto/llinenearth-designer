"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContextProfile } from "@/lib/designer-types";

const DRAFT_KEY = "llinen-earth-context-draft-v1";

type Key = keyof ContextProfile;
type Question = { key: Key; kicker: string; title: string; note: string; options: string[] };

const questions: Question[] = [
  { key: "occasion", kicker: "01 / OCCASION", title: "What are we dressing for?", note: "The moment sets the first formality and garment boundaries.", options: ["Wedding", "Business", "Resort / holiday", "Dinner / evening", "Smart casual", "Festive / cultural"] },
  { key: "venue", kicker: "02 / SETTING", title: "Where will it happen?", note: "Venue changes breathability, polish and how expressive the look can be.", options: ["Luxury hotel", "Beach / coast", "Garden / lawn", "Office / boardroom", "Restaurant / club", "Outdoor city", "Home / private event"] },
  { key: "time", kicker: "03 / TIME", title: "When will you wear it?", note: "Light and colour behave differently through the day.", options: ["Morning", "Daytime", "Late afternoon", "Sunset", "Evening", "Late night"] },
  { key: "environment", kicker: "04 / ENVIRONMENT", title: "Mostly indoors or outdoors?", note: "This controls layering, structure and comfort.", options: ["Indoor / air-conditioned", "Mostly indoor", "Mixed indoor + outdoor", "Mostly outdoor", "Hot / humid outdoor"] },
  { key: "formality", kicker: "05 / FORMALITY", title: "How formal should it feel?", note: "Choose the impression rather than a rigid dress-code label.", options: ["Relaxed", "Smart relaxed", "Refined", "Formal", "Ceremonial / evening formal"] },
  { key: "impression", kicker: "06 / IMPRESSION", title: "What should the outfit communicate?", note: "The Designer uses this as an emotional styling signal.", options: ["Quiet confidence", "Sharp and powerful", "Relaxed sophistication", "Youthful and modern", "Creative individuality", "Traditional refinement"] },
  { key: "fit", kicker: "07 / SILHOUETTE", title: "How should it sit on the body?", note: "This proportion is preserved across the outfit recommendation.", options: ["Clean slim", "Tailored", "Straight", "Relaxed", "Soft / fluid"] },
  { key: "aesthetic", kicker: "08 / AESTHETIC", title: "Which design language feels closest?", note: "A direction, not a costume. The fabric still has the final say.", options: ["Quiet Luxury", "Modern Classic", "Italian-Inspired", "British-Inspired", "Resort Luxury", "Contemporary Indian", "Minimal"] },
];

export function OccasionDesignerPreview() {
  const [answers, setAnswers] = useState<Partial<ContextProfile>>({});
  const [index, setIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const question = questions[index];
  const answeredCount = Object.keys(answers).length;
  const progress = complete ? 100 : Math.round((answeredCount / questions.length) * 100);

  const liveRead = useMemo(() => {
    const occasion = answers.occasion || "the occasion";
    const formality = answers.formality || "the right level of formality";
    const impression = answers.impression || "the intended impression";
    const aesthetic = answers.aesthetic || "a coherent design language";
    return `Building around ${occasion.toLowerCase()}, ${formality.toLowerCase()}, ${impression.toLowerCase()} and ${aesthetic.toLowerCase()}.`;
  }, [answers]);

  function choose(value: string) {
    const next = { ...answers, [question.key]: value };
    setAnswers(next);
    if (typeof window !== "undefined") sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    if (index < questions.length - 1) setIndex((v) => v + 1);
    else setComplete(true);
  }

  function reset() {
    setAnswers({});
    setIndex(0);
    setComplete(false);
    if (typeof window !== "undefined") sessionStorage.removeItem(DRAFT_KEY);
  }

  return (
    <section className="occasionDesigner" id="occasion-designer" data-reveal>
      <div className="occasionHeader">
        <div>
          <p className="eyebrow">SECOND DESIGN PATH · OCCASION FIRST</p>
          <h2>Tell us the moment.<br /><em>Let the wardrobe narrow itself.</em></h2>
        </div>
        <p>Use this when you do not yet know what shirt, trouser, suit or blazer you need. The brief is saved and handed to the full Designer Engine after your fabric is added.</p>
      </div>

      <div className="occasionWorkbench">
        <div className="occasionQuestionPanel">
          <div className="occasionProgressMeta"><span>{complete ? "BRIEF READY" : question.kicker}</span><b>{progress}%</b></div>
          <div className="occasionProgressBar"><i style={{ width: `${progress}%` }} /></div>

          {!complete ? (
            <div className="occasionQuestionStage" key={question.key}>
              <span className="occasionStep">QUESTION {String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</span>
              <h3>{question.title}</h3>
              <p>{question.note}</p>
              <div className="occasionChoices">
                {question.options.map((option) => (
                  <button key={option} className={answers[question.key] === option ? "selected" : ""} onClick={() => choose(option)}>
                    <span>{option}</span><b>↗</b>
                  </button>
                ))}
              </div>
              <div className="occasionControls">
                <button disabled={index === 0} onClick={() => setIndex((v) => Math.max(0, v - 1))}>← Previous</button>
                <span>{answeredCount} signals captured</span>
              </div>
            </div>
          ) : (
            <div className="occasionComplete">
              <span className="occasionStep">DESIGN CONTEXT COMPLETE</span>
              <h3>Your brief is ready for the cloth.</h3>
              <p>The Designer Engine will now combine these requirements with the fabric you upload, judge suitability and produce Safe, Elevated and Statement directions.</p>
              <div className="occasionCompleteActions">
                <Link href="/designer">Continue to fabric upload <b>↗</b></Link>
                <button onClick={reset}>Start again</button>
              </div>
            </div>
          )}
        </div>

        <aside className="occasionIntelligence">
          <div className="occasionOrbit" aria-hidden="true"><i /><i /><span>AI</span></div>
          <span className="micro">LIVE BRIEF INTELLIGENCE</span>
          <h3>{answers.occasion || "Waiting for the occasion"}</h3>
          <p>{liveRead}</p>
          <div className="occasionSignals">
            {questions.map((q) => <div key={q.key} className={answers[q.key] ? "filled" : ""}>
              <span>{q.kicker.split(" / ").pop()}</span>
              <strong>{answers[q.key] || "—"}</strong>
            </div>)}
          </div>
          <div className="occasionIntelligenceFoot"><i /> Each answer removes unsuitable options before image generation begins.</div>
        </aside>
      </div>
    </section>
  );
}
