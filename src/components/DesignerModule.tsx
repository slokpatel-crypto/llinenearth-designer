"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DESIGNER_PANTS, DESIGNER_REVIEWED_PAIRING, DESIGNER_SHIRTS, DESIGNER_STYLE_CHOICES,
  designerStyleForOccasion, designerTasteAlternative,
  type DesignerClimate, type DesignerContext, type DesignerIntention, type DesignerRecommendation, type DesignerStyle, type OccasionTier,
} from "@/lib/designer/engine";
import { planDesignerDirections, suggestDesignerRepairs, type DesignerDirection } from "@/lib/designer/planner";
import { designerStyleInsights } from "@/lib/designer/style-insights";
import { DESIGNER_FASHION_FACTS, DESIGNER_RESEARCH } from "@/lib/designer/research";
import { constructionNotes } from "@/lib/designer/photo-preview";
import { createStyleSessionId, recordStyleMemoryEvent } from "@/lib/browser-style-memory";
import { PhotoOutfitPreview } from "@/components/PhotoOutfitPreview";

const OCCASIONS: OccasionTier[] = ["Casual", "Smart-Casual", "Semi-Formal", "Formal"];
const CLIMATES: DesignerClimate[] = ["Not specified", "Hot / humid", "Cool", "Air-conditioned"];
const INTENTIONS: DesignerIntention[] = ["Understated", "Balanced", "Expressive"];
const SESSION_KEY = "llinen-earth:designer-session:v1";
const DRAFT_KEY = "linen-earth:real-designer-draft:v2";
const FACT_INTERVAL_MS = 15_000;

const MAIN_DETAILS = [
  ["shirtWear", "Shirt finish"], ["collar", "Shirt collar"],
  ["collarFinish", "Collar cloth"], ["shirtFit", "Shirt fit"],
  ["trouser", "Trouser shape"], ["rise", "Trouser rise"],
] as const;
const MORE_DETAILS = [
  ["cuff", "Shirt cuff"], ["placket", "Shirt placket"],
  ["waistband", "Trouser waistband"], ["break", "Trouser break"],
  ["button", "Button material"],
] as const;

function designerSession() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = createStyleSessionId();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch { return createStyleSessionId(); }
}

export function DesignerModule() {
  const [shirtId, setShirtId] = useState(DESIGNER_SHIRTS.find((item) => item.id === DESIGNER_REVIEWED_PAIRING.shirtId)?.id ?? DESIGNER_SHIRTS[0]?.id ?? "");
  const [pantId, setPantId] = useState(DESIGNER_PANTS.find((item) => item.id === DESIGNER_REVIEWED_PAIRING.pantId)?.id ?? DESIGNER_PANTS[0]?.id ?? "");
  const [occasion, setOccasion] = useState<OccasionTier>(DESIGNER_REVIEWED_PAIRING.occasion);
  const [style, setStyle] = useState<DesignerStyle>(() => designerStyleForOccasion(DESIGNER_REVIEWED_PAIRING.occasion));
  const [climate, setClimate] = useState<DesignerClimate>("Not specified");
  const [intention, setIntention] = useState<DesignerIntention>("Balanced");
  const [recommendation, setRecommendation] = useState<DesignerRecommendation | null>(null);
  const [directions, setDirections] = useState<DesignerDirection[]>([]);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [response, setResponse] = useState<"up" | "down" | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const [factPlaying, setFactPlaying] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [directorHandoff, setDirectorHandoff] = useState(false);
  const fact = DESIGNER_FASHION_FACTS[factIndex];
  const shirt = useMemo(() => DESIGNER_SHIRTS.find((item) => item.id === shirtId), [shirtId]);
  const pant = useMemo(() => DESIGNER_PANTS.find((item) => item.id === pantId), [pantId]);
  const insights = shirt && pant ? designerStyleInsights(shirt, pant, occasion, style) : [];

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as {
        shirtId?: string; pantId?: string; occasion?: OccasionTier; climate?: DesignerClimate;
        intention?: DesignerIntention; style?: Partial<DesignerStyle>;
      } | null;

      let nextOccasion: OccasionTier = parsed?.occasion && OCCASIONS.includes(parsed.occasion) ? parsed.occasion : occasion;
      let nextClimate: DesignerClimate = parsed?.climate && CLIMATES.includes(parsed.climate) ? parsed.climate : climate;
      let nextIntention: DesignerIntention = parsed?.intention && INTENTIONS.includes(parsed.intention) ? parsed.intention : intention;

      if (parsed?.shirtId && DESIGNER_SHIRTS.some((item) => item.id === parsed.shirtId)) setShirtId(parsed.shirtId);
      if (parsed?.pantId && DESIGNER_PANTS.some((item) => item.id === parsed.pantId)) setPantId(parsed.pantId);

      let nextStyle = designerStyleForOccasion(nextOccasion);
      if (parsed?.style) {
        for (const key of Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>) {
          const value = parsed.style[key];
          if (typeof value === "string" && DESIGNER_STYLE_CHOICES[key].includes(value)) nextStyle[key] = value;
        }
      }

      // A Style Director handoff intentionally overrides a saved draft so the
      // user sees the context and anchor fabric they just chose.
      const params = new URLSearchParams(window.location.search);
      const routedOccasion = params.get("occasion") as OccasionTier | null;
      const routedClimate = params.get("climate") as DesignerClimate | null;
      const routedIntention = params.get("intention") as DesignerIntention | null;
      const routedAnchor = params.get("anchor");
      const routedGarment = params.get("garment");
      setDirectorHandoff(params.get("from") === "style-director");

      if (routedOccasion && OCCASIONS.includes(routedOccasion)) {
        nextOccasion = routedOccasion;
        nextStyle = designerStyleForOccasion(routedOccasion);
      }
      if (routedClimate && CLIMATES.includes(routedClimate)) nextClimate = routedClimate;
      if (routedIntention && INTENTIONS.includes(routedIntention)) nextIntention = routedIntention;

      if (routedAnchor && routedGarment === "shirt" && DESIGNER_SHIRTS.some((item) => item.id === routedAnchor)) setShirtId(routedAnchor);
      if (routedAnchor && routedGarment === "trouser" && DESIGNER_PANTS.some((item) => item.id === routedAnchor)) setPantId(routedAnchor);

      setOccasion(nextOccasion);
      setClimate(nextClimate);
      setIntention(nextIntention);
      setStyle(nextStyle);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  // Restore once; subsequent changes are persisted by the effect below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ shirtId, pantId, occasion, climate, intention, style }));
    } catch { /* Designer remains usable if browser storage is unavailable. */ }
  }, [draftReady, shirtId, pantId, occasion, climate, intention, style]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) setFactPlaying(false);
    const handleMotionPreference = (event: MediaQueryListEvent) => setFactPlaying(!event.matches);
    reducedMotion.addEventListener("change", handleMotionPreference);
    return () => reducedMotion.removeEventListener("change", handleMotionPreference);
  }, []);

  useEffect(() => {
    if (!factPlaying) return;
    const timer = window.setTimeout(() => setFactIndex((index) => (index + 1) % DESIGNER_FASHION_FACTS.length), FACT_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [factIndex, factPlaying]);

  function resetDraft() {
    const nextOccasion = DESIGNER_REVIEWED_PAIRING.occasion;
    setShirtId(DESIGNER_REVIEWED_PAIRING.shirtId);
    setPantId(DESIGNER_REVIEWED_PAIRING.pantId);
    setOccasion(nextOccasion);
    setClimate("Not specified");
    setIntention("Balanced");
    setStyle(designerStyleForOccasion(nextOccasion));
    setRecommendation(null);
    setDirections([]);
    setRecommendationId(null);
    setResponse(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  function assess(nextStyle: DesignerStyle = style) {
    if (!shirt || !pant) return;
    const context: DesignerContext = { climate, intention };
    const proposals = planDesignerDirections(shirt, pant, occasion, nextStyle, context);
    const result = proposals[0].recommendation;
    setStyle({ ...nextStyle });
    setDirections(proposals);
    setRecommendation(result);
    setRecommendationId(null);
    setResponse(null);
    try {
      const event = recordStyleMemoryEvent(designerSession(), "designer_recommendation", {
        shirtId, pantId, occasion, style: nextStyle, input: { shirtId, pantId, occasion, style: nextStyle, context }, rules: result.rules,
        confidenceScore: result.confidenceScore, designFitScore: result.designFitScore,
        materialEvidence: result.materialEvidence, formality: result.formality,
        output: result.style, reasoningText: result.internalReason,
        status: result.status, ruleSetVersion: result.ruleSetVersion,
      });
      setRecommendationId(event.id);
    } catch { /* The direction still works when event storage is unavailable. */ }
  }

  function giveFeedback(rating: "up" | "down") {
    if (!recommendation || !recommendationId) return;
    try { recordStyleMemoryEvent(designerSession(), "designer_feedback", { recommendationId, rating }); }
    catch { return; }
    setResponse(rating);
  }

  function changeStyle(key: keyof DesignerStyle, value: string) {
    setStyle((current) => ({ ...current, [key]: value }));
    setRecommendation(null);
    setRecommendationId(null);
  }

  function applyStylePatch(patch: Partial<DesignerStyle>) {
    setStyle((current) => ({ ...current, ...patch }));
    setRecommendation(null);
    setRecommendationId(null);
  }

  return <div className="newDesigner">
    <header className="newDesignerHero">
      <div className="newDesignerHeroCopy">
        <span className="newDesignerKicker">LINEN EARTH / THE DESIGN STUDIO</span>
        <h1>Designer<span className="newDesignerHeroDot">.</span></h1>
        <p className="newDesignerHeroLead">A designer begins with the cloth, then considers the person and the moment.</p>
        <p>Choose real catalogue swatches, shape the shirt and trousers, and see why the pairing works or needs a second look.</p>
        <div className="newDesignerHeroIndex"><span>01 / Observe</span><span>02 / Compose</span><span>03 / Verify</span></div>
        <span className="newDesignerCount">{DESIGNER_SHIRTS.length} shirting references · {DESIGNER_PANTS.length} trouser references</span>
      </div>
      <figure className="newDesignerHeroArt">
        <div className="newDesignerArchiveFrame"><img src="/designer/studio-pleated.webp" alt="Faceless studio mannequin in a shirt and tailored trousers" /></div>
        <div className="newDesignerHeroFabric"><img src={shirt?.image} alt="Linen Earth selected shirting fabric" /><span>THE CLOTH / SHIRT</span></div>
        <div className="newDesignerHeroFabric second"><img src={pant?.image} alt="Linen Earth selected trouser fabric" /><span>THE CLOTH / TROUSER</span></div>
        <figcaption>Studio model prepared once for Designer. Choose two fabrics below to see the live composition.</figcaption>
      </figure>
    </header>

    <div className="newDesignerBody">
      <section className="newDesignerSelections" aria-labelledby="designerChoose">
        {directorHandoff && <div className="newDesignerHandoff"><span>STYLE DIRECTOR HANDOFF</span><strong>Your context and anchor cloth are loaded.</strong><p>You can now refine the second fabric and tailoring details on the real photographic model.</p></div>}
        <div className="newDesignerSectionHead"><span>01 / THE MATERIALS</span><h2 id="designerChoose">Start with the cloth.</h2></div>
        <div className="newDesignerFabricGrid">
          <article className="newDesignerFabric">
            <div className="newDesignerSwatch" style={{ backgroundColor: shirt?.hex || "#172339" }}>
              {shirt && <img src={shirt.image} alt={`${shirt.name} shirting fabric swatch`} loading="lazy" />}
            </div>
            <label htmlFor="designer-shirt">Shirt fabric</label>
            <select id="designer-shirt" value={shirtId} onChange={(event) => { setShirtId(event.target.value); setRecommendation(null); setRecommendationId(null); }}>
              {DESIGNER_SHIRTS.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.line} · {fabric.name}</option>)}
            </select>
            <small>{shirt?.patternType} · {shirt?.source}</small>
          </article>
          <article className="newDesignerFabric">
            <div className="newDesignerSwatch" style={{ backgroundColor: pant?.hex || "#172339" }}>
              {pant && <img src={pant.image} alt={`${pant.name} trouser fabric swatch`} loading="lazy" />}
            </div>
            <label htmlFor="designer-pant">Trouser fabric</label>
            <select id="designer-pant" value={pantId} onChange={(event) => { setPantId(event.target.value); setRecommendation(null); setRecommendationId(null); }}>
              {DESIGNER_PANTS.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.line} · {fabric.name}</option>)}
            </select>
            <small>{pant?.patternType} · {pant?.source}</small>
          </article>
        </div>
        <a className="newDesignerJump" href="#designerPhotoTitle">See these fabrics on the live model ↘</a>

        <fieldset className="newDesignerOccasions">
          <legend>02 / WHERE WILL YOU WEAR IT?</legend>
          <div>{OCCASIONS.map((option) => <label key={option} className={option === occasion ? "selected" : ""}>
            <input type="radio" name="designerOccasion" value={option} checked={option === occasion}
              onChange={() => { setOccasion(option); setStyle(designerStyleForOccasion(option)); setRecommendation(null); setRecommendationId(null); }} />{option}
          </label>)}</div>
        </fieldset>
        <div className="newDesignerContext">
          <label>Climate at the event
            <select value={climate} onChange={(event) => { setClimate(event.target.value as DesignerClimate); setRecommendation(null); }}>
              {CLIMATES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>How should it feel visually?
            <select value={intention} onChange={(event) => { setIntention(event.target.value as DesignerIntention); setRecommendation(null); }}>
              {INTENTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <small>Expression changes the order of cut ideas. Climate is checked only against verified physical cloth.</small>
        </div>
        <div className="newDesignerStyleBlock">
          <div className="newDesignerSectionHead"><span>03 / THE CUT</span><h2>Shape the two garments.</h2></div>
          <div className="newDesignerStyleGrid">{MAIN_DETAILS.map(([key, label]) => <label key={key}>{label}
            <select value={style[key]} onChange={(event) => changeStyle(key, event.target.value)}>
              {DESIGNER_STYLE_CHOICES[key].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>)}</div>
          {insights.length > 0 && <div className="newDesignerInsights" aria-label="Fabric-aware design notes">
            <span className="newDesignerInsightsKicker">DESIGNER THINKING / FOR THIS CLOTH</span>
            {insights.map((insight) => {
              const action = insight.action;
              return <article key={insight.title}>
              <div><strong>{insight.title}</strong><p>{insight.explanation}</p><a href={insight.sourceUrl} target="_blank" rel="noopener noreferrer">{insight.source} ↗</a></div>
              {action && <button type="button" onClick={() => applyStylePatch(action.patch)}>{action.label} ↗</button>}
              </article>;
            })}
          </div>}
          <details className="newDesignerMore"><summary>More tailoring details</summary><div className="newDesignerStyleGrid">{MORE_DETAILS.map(([key, label]) => <label key={key}>{label}
            <select value={style[key]} onChange={(event) => changeStyle(key, event.target.value)}>
              {DESIGNER_STYLE_CHOICES[key].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>)}</div></details>
          <div className="newDesignerConstruction" aria-label="Selected garment construction">
            {constructionNotes(style).map((detail) => <article key={detail.title}>
              <span>{detail.title.toUpperCase()} / CUT REFERENCE</span>
              <strong>{detail.name}</strong>
              <p>{detail.description}</p>
              <a href={detail.source} target="_blank" rel="noopener noreferrer">{detail.sourceLabel} ↗</a>
            </article>)}
          </div>
        </div>
        <div className="newDesignerDraftActions">
          <button className="newDesignerAction" type="button" disabled={!shirt || !pant} onClick={() => assess()}>Assess this pairing <span aria-hidden="true">↗</span></button>
          <button className="newDesignerReset" type="button" onClick={resetDraft}>Reset design</button>
        </div>
        <p className="newDesignerFootnote">Catalogue images guide colour and pattern. Fabric weight, drape, opacity and current metres need confirmation in store.</p>
      </section>

      <div className="newDesignerRight">
      {shirt && pant && <PhotoOutfitPreview shirt={shirt} pant={pant} style={style} />}
      <section className="newDesignerOutcome" aria-live="polite" aria-label="Designer recommendation">
        {!recommendation ? <div className="newDesignerEmpty"><span>04 / DESIGN DIRECTION</span><h2>Give the fabrics a purpose.</h2><p>Choose cloth, occasion and cut, then ask Designer to assess the outfit.</p></div> : <>
          <div className="newDesignerSectionHead"><span>04 / DESIGN DIRECTION</span><h2>{recommendation.status === "needs_review" ? "This pairing needs a closer look." : "A direction worth exploring."}</h2></div>
          <p className="newDesignerReason">{recommendation.shortReason}</p>
          <div className="newDesignerSignals" aria-label="Design reasoning and fabric evidence">
            <div><span>DESIGN READ</span><strong>{recommendation.status === "preliminary" ? "Promising" : "Review"}</strong><small>{recommendation.rules.filter((item) => item.status === "flag").length} pairing and cut checks flagged; every direction remains provisional.</small></div>
            <div><span>PHYSICAL CLOTH CHECK</span><strong>{recommendation.materialEvidence.verified}/{recommendation.materialEvidence.total}</strong><small>Material facts confirmed across both cloths. We check the rolls before making a garment.</small></div>
          </div>
          <div className="newDesignerDetails">
            <div><span>SHIRT</span><strong>{recommendation.style.collar}</strong><small>{recommendation.style.shirtWear} · {recommendation.style.collarFinish} · {recommendation.style.shirtFit} · {recommendation.style.cuff} · {recommendation.style.placket}</small></div>
            <div><span>TROUSERS</span><strong>{recommendation.style.trouser}</strong><small>{recommendation.style.rise} · {recommendation.style.waistband} · {recommendation.style.break}</small></div>
          </div>
          <p className="newDesignerProvisional">{recommendation.status === "preliminary" ? "A preliminary direction. We would check the actual fabric before confirming the cut." : "This is your proposed cut, pending a Linen Earth stylist's review."}</p>
          {directions.length > 1 && <div className="newDesignerDirections"><h3>Different cuts for the same cloth</h3><p>These are design sketches, subject to the same fabric and stock checks.</p>
            {directions.slice(1).map((direction) => <article key={direction.id}>
              <strong>{direction.name}</strong><p>{direction.proposition}</p>
              <small>{direction.changes.join(" · ")}</small>
              <button type="button" onClick={() => assess(direction.recommendation.style)}>Assess this cut</button>
            </article>)}
          </div>}
          {suggestDesignerRepairs(recommendation).length > 0 && <div className="newDesignerRepairs"><h3>What would improve this look?</h3><ul>
            {suggestDesignerRepairs(recommendation).map((repair) => <li key={repair.label}>{repair.label}{repair.patch && <button type="button" onClick={() => assess({ ...recommendation.style, ...repair.patch })}>Try this change</button>}</li>)}
          </ul></div>}
          {designerTasteAlternative(recommendation) && <div className="newDesignerTasteAlternative">
            <strong>Another colour direction to explore</strong>
            <p>Sky Blue shirting with Beige linen suiting was approved as a semi-formal colour idea. Its physical stock and tailoring details still need checking.</p>
            <button type="button" onClick={() => {
              setShirtId(DESIGNER_REVIEWED_PAIRING.shirtId); setPantId(DESIGNER_REVIEWED_PAIRING.pantId);
              setStyle(designerStyleForOccasion("Semi-Formal")); setRecommendation(null); setRecommendationId(null);
            }}>Try this colour direction</button>
          </div>}
          <details className="newDesignerChecks"><summary>What needs checking in store</summary><ul>{recommendation.confirmationsNeeded.map((item) => <li key={item}>{item}</li>)}</ul></details>
          <details className="newDesignerChecks"><summary>Which material facts are still missing?</summary><ul>{recommendation.materialEvidence.missing.map((item) => <li key={item}>{item}</li>)}</ul></details>
          {recommendationId && <div className="newDesignerFeedback"><span>Does this direction feel right?</span><div>
            <button type="button" onClick={() => giveFeedback("up")} aria-pressed={response === "up"}>Helpful</button>
            <button type="button" onClick={() => giveFeedback("down")} aria-pressed={response === "down"}>Needs work</button>
          </div>{response && <small>Thanks. Your feedback is recorded on this device.</small>}</div>}
        </>}
      </section>
      </div>
    </div>
    <section className="newDesignerNotebook" aria-labelledby="designerNotebook">
      <div className="newDesignerNotebookHead"><span>FROM THE DESIGN DESK / SOURCES</span><h2 id="designerNotebook">An eye informed by history. <em>A judgment grounded in cloth.</em></h2><p>A new fashion thought every 15 seconds. Explore how colour, movement and fabric shape a look, then return to your own cloth and occasion.</p></div>
      <div className="newDesignerNotebookBody">
        <section className="newDesignerFactCard" aria-label="Rotating fashion facts" aria-live="off">
          <div className="newDesignerFactTop"><span>FASHION NOTE / 15 SEC</span><span>{String(factIndex + 1).padStart(2, "0")} / {String(DESIGNER_FASHION_FACTS.length).padStart(2, "0")}</span></div>
          <div className="newDesignerFactCopy" key={factIndex}>
            <span className="newDesignerFactCategory">{fact.category}</span>
            <h3>{fact.title}</h3>
            <p>{fact.detail}</p>
            <a href={fact.url} target="_blank" rel="noopener noreferrer">Read the source · {fact.source} ↗</a>
          </div>
          <nav className="newDesignerFactControls" aria-label="Fashion fact controls">
            <div className="newDesignerFactDots">{DESIGNER_FASHION_FACTS.map((item, index) => <button key={item.title} type="button" aria-label={`Show fact ${index + 1}: ${item.title}`} aria-pressed={index === factIndex} onClick={() => setFactIndex(index)} />)}</div>
            <div className="newDesignerFactButtons">
              <button type="button" aria-label="Previous fashion fact" onClick={() => setFactIndex((index) => (index - 1 + DESIGNER_FASHION_FACTS.length) % DESIGNER_FASHION_FACTS.length)}>←</button>
              <button type="button" aria-label="Next fashion fact" onClick={() => setFactIndex((index) => (index + 1) % DESIGNER_FASHION_FACTS.length)}>→</button>
              <button type="button" aria-label={factPlaying ? "Pause automatic fashion facts" : "Resume automatic fashion facts"} aria-pressed={!factPlaying} onClick={() => setFactPlaying((playing) => !playing)}>{factPlaying ? "Pause" : "Resume"}</button>
            </div>
          </nav>
        </section>
        <div className="newDesignerResearchList">{DESIGNER_RESEARCH.map((item, index) => <article key={item.url}><span>0{index + 1} / {item.kind}</span><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3><p>{item.lesson}</p><small>{item.publisher}</small></article>)}</div>
      </div>
    </section>
  </div>;
}
