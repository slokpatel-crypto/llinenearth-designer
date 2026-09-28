"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DESIGNER_PANTS, DESIGNER_REVIEWED_PAIRING, DESIGNER_SHIRTS, DESIGNER_STYLE_CHOICES,
  designerStyleForOccasion, designerTasteAlternative,
  type DesignerClimate, type DesignerContext, type DesignerFabric, type DesignerIntention, type DesignerRecommendation, type DesignerStyle, type OccasionTier,
} from "@/lib/designer/engine";
import { planDesignerDirections, suggestDesignerRepairs, type DesignerDirection } from "@/lib/designer/planner";
import { designerStyleInsights } from "@/lib/designer/style-insights";
import { DESIGNER_FASHION_FACTS, DESIGNER_RESEARCH } from "@/lib/designer/research";
import { constructionNotes } from "@/lib/designer/photo-preview";
import { createStyleSessionId, recordStyleMemoryEvent } from "@/lib/browser-style-memory";
import { PhotoOutfitPreview } from "@/components/PhotoOutfitPreview";
import { MEASUREMENT_STORAGE_KEY, formatMeasure, measurementCoverage, measurementFitGuidance, type MeasurementProfile } from "@/lib/measurements";
import { assessFitConstruction, formatFinishedRange } from "@/lib/designer/fit-construction";
import { buildDesignerNegotiation } from "@/lib/designer/constraint-negotiation";

const OCCASIONS: OccasionTier[] = ["Casual", "Smart-Casual", "Semi-Formal", "Formal"];
const CLIMATES: DesignerClimate[] = ["Not specified", "Hot / humid", "Cool", "Air-conditioned"];
const INTENTIONS: DesignerIntention[] = ["Understated", "Balanced", "Expressive"];
const SESSION_KEY = "llinen-earth:designer-session:v1";
const DRAFT_KEY = "linen-earth:real-designer-draft:v2";
const FACT_INTERVAL_MS = 15_000;
const DESIGNER_FEEDBACK_REASONS = [
  ["color","Colour / contrast"],
  ["too_bold","Too bold"],
  ["too_safe","Too safe"],
  ["fit_cut","Fit / cut"],
  ["trouser_shape","Trouser shape"],
  ["formality","Formality"],
  ["fabric","Fabric choice"],
  ["construction","Construction detail"],
  ["other","Something else"],
] as const;

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
  const [shirtOptions, setShirtOptions] = useState<DesignerFabric[]>(DESIGNER_SHIRTS);
  const [pantOptions, setPantOptions] = useState<DesignerFabric[]>(DESIGNER_PANTS);
  const [occasion, setOccasion] = useState<OccasionTier>(DESIGNER_REVIEWED_PAIRING.occasion);
  const [style, setStyle] = useState<DesignerStyle>(() => designerStyleForOccasion(DESIGNER_REVIEWED_PAIRING.occasion));
  const [climate, setClimate] = useState<DesignerClimate>("Not specified");
  const [intention, setIntention] = useState<DesignerIntention>("Balanced");
  const [recommendation, setRecommendation] = useState<DesignerRecommendation | null>(null);
  const [directions, setDirections] = useState<DesignerDirection[]>([]);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [response, setResponse] = useState<"up" | "down" | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<string | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const [factPlaying, setFactPlaying] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [directorHandoff, setDirectorHandoff] = useState(false);
  const [directorHandoffTitle, setDirectorHandoffTitle] = useState("");
  const [directorHandoffTier, setDirectorHandoffTier] = useState("");
  const [directorHandoffReason, setDirectorHandoffReason] = useState("");
  const [measurementProfile, setMeasurementProfile] = useState<MeasurementProfile | null>(null);
  const fact = DESIGNER_FASHION_FACTS[factIndex];
  const shirt = useMemo(() => shirtOptions.find((item) => item.id === shirtId), [shirtId, shirtOptions]);
  const pant = useMemo(() => pantOptions.find((item) => item.id === pantId), [pantId, pantOptions]);
  const insights = shirt && pant ? designerStyleInsights(shirt, pant, occasion, style) : [];
  const fitCoverage = useMemo(() => measurementCoverage(measurementProfile), [measurementProfile]);
  const fitGuidance = useMemo(() => measurementFitGuidance(measurementProfile), [measurementProfile]);
  const fitConstruction = useMemo(() => shirt && pant ? assessFitConstruction(measurementProfile, style, { climate, shirtFabric: shirt, trouserFabric: pant }) : null, [measurementProfile, style, climate, shirt, pant]);
  const negotiation = useMemo(() => recommendation ? buildDesignerNegotiation(recommendation, fitConstruction) : null, [recommendation, fitConstruction]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MEASUREMENT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MeasurementProfile;
      if (parsed?.version === 1) setMeasurementProfile(parsed);
    } catch { /* Saved measurements are optional; Designer remains usable without them. */ }
  },[]);

  useEffect(() => {
    let cancelled = false;
    async function loadCalibratedCatalogue() {
      try {
        const response = await fetch("/api/designer/catalog",{cache:"no-store"});
        if (!response.ok) return;
        const data = await response.json() as { shirts?: DesignerFabric[]; pants?: DesignerFabric[] };
        if (cancelled) return;
        const nextShirts = Array.isArray(data.shirts) && data.shirts.length ? data.shirts : DESIGNER_SHIRTS;
        const nextPants = Array.isArray(data.pants) && data.pants.length ? data.pants : DESIGNER_PANTS;
        setShirtOptions(nextShirts);
        setPantOptions(nextPants);
        setShirtId((current)=>nextShirts.some((item)=>item.id===current) ? current : (nextShirts[0]?.id || current));
        setPantId((current)=>nextPants.some((item)=>item.id===current) ? current : (nextPants[0]?.id || current));
      } catch { /* Static catalogue remains a safe fallback. */ }
    }
    void loadCalibratedCatalogue();
    return () => { cancelled = true; };
  },[]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as {
        shirtId?: string; pantId?: string; occasion?: OccasionTier; climate?: DesignerClimate;
        intention?: DesignerIntention; style?: Partial<DesignerStyle>;
      } | null;

      let nextShirtId = parsed?.shirtId && DESIGNER_SHIRTS.some((item) => item.id === parsed.shirtId) ? parsed.shirtId : shirtId;
      let nextPantId = parsed?.pantId && DESIGNER_PANTS.some((item) => item.id === parsed.pantId) ? parsed.pantId : pantId;
      let nextOccasion: OccasionTier = parsed?.occasion && OCCASIONS.includes(parsed.occasion) ? parsed.occasion : occasion;
      let nextClimate: DesignerClimate = parsed?.climate && CLIMATES.includes(parsed.climate) ? parsed.climate : climate;
      let nextIntention: DesignerIntention = parsed?.intention && INTENTIONS.includes(parsed.intention) ? parsed.intention : intention;
      let nextStyle = designerStyleForOccasion(nextOccasion);

      if (parsed?.style) {
        for (const key of Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>) {
          const value = parsed.style[key];
          if (typeof value === "string" && DESIGNER_STYLE_CHOICES[key].includes(value)) nextStyle[key] = value;
        }
      }

      // A Style Director handoff is authoritative for this opening state. It
      // carries the resolved shirt + trouser pair and the supported cut, so the
      // photographed model opens as the Director's actual result.
      const params = new URLSearchParams(window.location.search);
      const fromDirector = params.get("from") === "style-director";
      setDirectorHandoff(fromDirector);

      if (fromDirector) {
        const routedOccasion = params.get("occasion") as OccasionTier | null;
        const routedClimate = params.get("climate") as DesignerClimate | null;
        const routedIntention = params.get("intention") as DesignerIntention | null;
        const routedShirt = params.get("shirt");
        const routedPant = params.get("pant");

        if (routedOccasion && OCCASIONS.includes(routedOccasion)) {
          nextOccasion = routedOccasion;
          nextStyle = designerStyleForOccasion(routedOccasion);
        }
        if (routedClimate && CLIMATES.includes(routedClimate)) nextClimate = routedClimate;
        if (routedIntention && INTENTIONS.includes(routedIntention)) nextIntention = routedIntention;
        if (routedShirt && DESIGNER_SHIRTS.some((item) => item.id === routedShirt)) nextShirtId = routedShirt;
        if (routedPant && DESIGNER_PANTS.some((item) => item.id === routedPant)) nextPantId = routedPant;

        const routedStyle = params.get("style");
        if (routedStyle) {
          try {
            const parsedStyle = JSON.parse(routedStyle) as Partial<DesignerStyle>;
            for (const key of Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>) {
              const value = parsedStyle[key];
              if (typeof value === "string" && DESIGNER_STYLE_CHOICES[key].includes(value)) nextStyle[key] = value;
            }
          } catch { /* Invalid URL style data falls back to the occasion preset. */ }
        }

        setDirectorHandoffTitle(params.get("sourceTitle") || "Style Director result");
        setDirectorHandoffTier(params.get("sourceTier") || "");
        setDirectorHandoffReason(params.get("sourceReason") || "");
      }

      setShirtId(nextShirtId);
      setPantId(nextPantId);
      setOccasion(nextOccasion);
      setClimate(nextClimate);
      setIntention(nextIntention);
      setStyle(nextStyle);

      if (fromDirector) {
        const routedShirtFabric = DESIGNER_SHIRTS.find((item) => item.id === nextShirtId);
        const routedPantFabric = DESIGNER_PANTS.find((item) => item.id === nextPantId);
        if (routedShirtFabric && routedPantFabric) {
          const context: DesignerContext = { climate: nextClimate, intention: nextIntention };
          const savedMeasurements = (() => { try { const raw = localStorage.getItem(MEASUREMENT_STORAGE_KEY); return raw ? JSON.parse(raw) as MeasurementProfile : null; } catch { return null; } })();
          const proposals = planDesignerDirections(routedShirtFabric, routedPantFabric, nextOccasion, nextStyle, context, savedMeasurements);
          const result = proposals[0].recommendation;
          setDirections(proposals);
          setRecommendation(result);
          setResponse(null);
    setFeedbackReason(null);
          try {
            const event = recordStyleMemoryEvent(designerSession(), "designer_recommendation", {
              shirtId:nextShirtId, pantId:nextPantId, occasion:nextOccasion, style:nextStyle,
              input:{ shirtId:nextShirtId, pantId:nextPantId, occasion:nextOccasion, style:nextStyle, context, source:"style-director" },
              rules:result.rules, confidenceScore:result.confidenceScore, designFitScore:result.designFitScore,
              materialEvidence:result.materialEvidence, formality:result.formality, output:result.style,
              reasoningText:result.internalReason, status:result.status, ruleSetVersion:result.ruleSetVersion,
            });
            setRecommendationId(event.id);
          } catch { /* The visual handoff still works if memory storage is unavailable. */ }
        }
      }
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
    setFeedbackReason(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  function assess(nextStyle: DesignerStyle = style) {
    if (!shirt || !pant) return;
    const context: DesignerContext = { climate, intention };
    const proposals = planDesignerDirections(shirt, pant, occasion, nextStyle, context, measurementProfile);
    const result = proposals[0].recommendation;
    setStyle({ ...nextStyle });
    setDirections(proposals);
    setRecommendation(result);
    setRecommendationId(null);
    setResponse(null);
    setFeedbackReason(null);
    try {
      const event = recordStyleMemoryEvent(designerSession(), "designer_recommendation", {
        shirtId, pantId, occasion, style: nextStyle, input: { shirtId, pantId, occasion, style: nextStyle, context, measurementCoverage: fitCoverage, fitGuidance }, rules: result.rules,
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
    setResponse(rating);
    setFeedbackReason(null);
    if (rating === "down") return;
    try {
      recordStyleMemoryEvent(designerSession(), "designer_feedback", {
        recommendationId, rating,
        shirtId:recommendation.shirt.id, pantId:recommendation.pant.id,
        occasion:recommendation.occasion, style:recommendation.style,
      });
    } catch { return; }
  }

  function giveFeedbackReason(reason:string) {
    if (!recommendation || !recommendationId || response !== "down") return;
    try {
      recordStyleMemoryEvent(designerSession(), "designer_feedback", {
        recommendationId, rating:"down", reason,
        shirtId:recommendation.shirt.id, pantId:recommendation.pant.id,
        occasion:recommendation.occasion, style:recommendation.style,
      });
    } catch { return; }
    setFeedbackReason(reason);
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

  function matchPhotographedOfficeModel() {
    const next: DesignerStyle = {
      ...designerStyleForOccasion("Semi-Formal"),
      collar: "Point (Standard) Collar",
      collarFinish: "Self-fabric",
      cuff: "Barrel Cuff (1-button)",
      placket: "Standard (visible stitch)",
      shirtFit: "Regular / Classic Fit",
      shirtWear: "Tucked",
      trouser: "Pleated Trouser",
      rise: "Mid Rise",
      waistband: "Belt Loops",
      break: "Slight Break",
    };
    setOccasion("Semi-Formal");
    setStyle(next);
    setRecommendation(null);
    setDirections([]);
    setRecommendationId(null);
    setResponse(null);
    setFeedbackReason(null);
  }

  return <div className="newDesigner">
    <header className="newDesignerHero">
      <div className="newDesignerHeroCopy">
        <span className="newDesignerKicker">LINEN EARTH / THE DESIGN STUDIO</span>
        <h1>Designer<span className="newDesignerHeroDot">.</span></h1>
        <p className="newDesignerHeroLead">A designer begins with the cloth, then considers the person and the moment.</p>
        <p>Choose real catalogue swatches, shape the shirt and trousers, and see why the pairing works or needs a second look.</p>
        <div className="newDesignerHeroIndex"><span>01 / Observe</span><span>02 / Compose</span><span>03 / Verify</span></div>
        <span className="newDesignerCount">{shirtOptions.length} shirting references · {pantOptions.length} trouser references</span>
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
        {directorHandoff && <div className="newDesignerHandoff"><span>STYLE DIRECTOR HANDOFF</span><strong>{directorHandoffTitle || "Your complete outfit direction is loaded."}</strong><p>{shirt?.name} shirt + {pant?.name} trousers · {style.shirtWear} · {style.trouser}. You can refine any detail below without rebuilding the look.</p></div>}
        <div className="newDesignerSectionHead"><span>01 / THE MATERIALS</span><h2 id="designerChoose">Start with the cloth.</h2></div>
        <div className="newDesignerFabricGrid">
          <article className="newDesignerFabric">
            <div className="newDesignerSwatch" style={{ backgroundColor: shirt?.hex || "#172339" }}>
              {shirt && <img src={shirt.image} alt={`${shirt.name} shirting fabric swatch`} loading="lazy" />}
            </div>
            <label htmlFor="designer-shirt">Shirt fabric</label>
            <select id="designer-shirt" value={shirtId} onChange={(event) => { setShirtId(event.target.value); setRecommendation(null); setRecommendationId(null); }}>
              {shirtOptions.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.line} · {fabric.name}</option>)}
            </select>
            <small>{shirt?.patternType} · {shirt?.source}</small>
          </article>
          <article className="newDesignerFabric">
            <div className="newDesignerSwatch" style={{ backgroundColor: pant?.hex || "#172339" }}>
              {pant && <img src={pant.image} alt={`${pant.name} trouser fabric swatch`} loading="lazy" />}
            </div>
            <label htmlFor="designer-pant">Trouser fabric</label>
            <select id="designer-pant" value={pantId} onChange={(event) => { setPantId(event.target.value); setRecommendation(null); setRecommendationId(null); }}>
              {pantOptions.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.line} · {fabric.name}</option>)}
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

        <section className="newDesignerFitProfile" aria-label="Saved tailoring measurements">
          <div className="newDesignerFitHead">
            <div><span>FIT PROFILE / MEASUREMENTS</span><strong>{fitCoverage.total > 0 ? `${fitCoverage.total}/16 measurements loaded` : "No measurements loaded yet"}</strong></div>
            <Link href="/measurements">{fitCoverage.total > 0 ? "Update measurements" : "Add measurements"} ↗</Link>
          </div>
          {measurementProfile && fitCoverage.total > 0 ? <>
            <div className="newDesignerMeasureChips">
              {measurementProfile.shirt.neck && <span>Neck <b>{formatMeasure(measurementProfile.shirt.neck, measurementProfile.unit)}</b></span>}
              {measurementProfile.shirt.chest && <span>Chest <b>{formatMeasure(measurementProfile.shirt.chest, measurementProfile.unit)}</b></span>}
              {measurementProfile.shirt.waist && <span>Shirt waist <b>{formatMeasure(measurementProfile.shirt.waist, measurementProfile.unit)}</b></span>}
              {measurementProfile.pants.waist && <span>Trouser waist <b>{formatMeasure(measurementProfile.pants.waist, measurementProfile.unit)}</b></span>}
              {measurementProfile.pants.seat && <span>Seat <b>{formatMeasure(measurementProfile.pants.seat, measurementProfile.unit)}</b></span>}
              {measurementProfile.pants.inseam && <span>Inseam <b>{formatMeasure(measurementProfile.pants.inseam, measurementProfile.unit)}</b></span>}
            </div>
            {fitGuidance.length > 0 && <div className="newDesignerFitNotes"><span>TAILORING GUIDANCE</span><ul>{fitGuidance.map((note) => <li key={note}>{note}</li>)}</ul></div>}
            {fitConstruction && <div className="newDesignerGarmentSpec">
              <div className="newDesignerGarmentSpecHead"><span>FIT + CONSTRUCTION V2</span><strong>{fitConstruction.fitScore}/100 provisional compatibility</strong></div>
              <div className="newDesignerGarmentTargets">
                <article><span>SHIRT / FINISHED TARGETS</span>{fitConstruction.shirtTargets.slice(0,4).map((target) => <p key={target.label}><b>{target.label}</b><em>{formatFinishedRange(target,"in")}</em></p>)}</article>
                <article><span>TROUSER / FINISHED TARGETS</span>{fitConstruction.trouserTargets.slice(0,4).map((target) => <p key={target.label}><b>{target.label}</b><em>{formatFinishedRange(target,"in")}</em></p>)}</article>
              </div>
              {fitConstruction.checks.some((item) => item.severity !== "info") && <div className="newDesignerConstructionChecks"><span>CONSTRUCTION CHECKS</span>{fitConstruction.checks.filter((item) => item.severity !== "info").slice(0,4).map((item) => <p key={item.id} data-severity={item.severity}>{item.message}</p>)}</div>}
            </div>}
            <p className="newDesignerFitTruth">These measurements guide the proposed cut and tailoring conversation. Finished ranges are provisional house targets, not final cutting dimensions. The photographic mannequin is a fixed visual reference and is not resized to represent your body.</p>
          </> : <p className="newDesignerFitTruth">Add measurements in the blueprint studio to carry proportion-aware tailoring notes into Designer. The visual mannequin remains a fixed reference.</p>}
        </section>
        <div className="newDesignerStyleBlock">
          <div className="newDesignerSectionHead"><span>03 / THE CUT</span><h2>Shape the two garments.</h2></div>
          <div className="newDesignerModelPreset">
            <div><span>PHOTO TEMPLATE / OFFICE</span><strong>Use the exact cut shown on the tucked studio model.</strong><p>Point collar · 1-button barrel cuff · tucked shirt · pleated straight trouser · mid rise · belt loops · slight break.</p></div>
            <button type="button" onClick={matchPhotographedOfficeModel}>Match photographed office model</button>
          </div>
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
      {directorHandoff && <div className="newDesignerModelHandoff"><span>STYLE DIRECTOR RESULT {directorHandoffTier ? `· ${directorHandoffTier.toUpperCase()}` : ""}</span><strong>{directorHandoffTitle || "Selected direction"}</strong><p>{directorHandoffReason || "The selected fabrics and cut have been carried into the photographic model."}</p></div>}
      {shirt && pant && <PhotoOutfitPreview shirt={shirt} pant={pant} style={style} />}
      {fitCoverage.total > 0 && <div className="newDesignerFitModelNote"><span>FIT PROFILE LOADED · {fitCoverage.total}/16</span><p>Measurements inform tailoring guidance; this studio model remains a fixed visual reference.</p></div>}
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
          {negotiation && <section className={`newDesignerNegotiation ${negotiation.verdict}`} aria-label="Designer constraint negotiation">
            <div className="newDesignerNegotiationHead"><span>DESIGNER NEGOTIATION</span><strong>{negotiation.headline}</strong></div>
            <div className="newDesignerPreserve"><span>KEEP</span>{negotiation.preserve.slice(0,5).map((item)=><b key={item}>{item}</b>)}</div>
            {negotiation.blockers.length>0 && <div className="newDesignerIssueGroup"><span>BLOCKING</span>{negotiation.blockers.slice(0,3).map((item)=><p key={item.id}>{item.message}</p>)}</div>}
            {negotiation.tradeoffs.length>0 && <div className="newDesignerIssueGroup"><span>FIT / CONSTRUCTION</span>{negotiation.tradeoffs.slice(0,3).map((item)=><p key={item.id}>{item.message}</p>)}</div>}
            {negotiation.missingFacts.length>0 && <div className="newDesignerIssueGroup"><span>NEEDS VERIFICATION</span>{negotiation.missingFacts.slice(0,3).map((item)=><p key={item.id}>{item.message}</p>)}</div>}
            {negotiation.actions.length>0 && <div className="newDesignerNegotiationActions"><span>SMALLEST FIXES</span>{negotiation.actions.map((action)=><div key={action.id}>
              <p>{action.label}</p>
              {action.patch && <button type="button" onClick={()=>assess({...recommendation.style,...action.patch})}>Try this change</button>}
              {action.route && <Link href={action.route}>Open measurements ↗</Link>}
            </div>)}</div>}
          </section>}
          {directions.length > 1 && <div className="newDesignerDirections"><h3>Different cuts for the same cloth</h3><p>These are design sketches, subject to the same fabric and stock checks.</p>
            {directions.slice(1).map((direction) => <article key={direction.id}>
              <strong>{direction.name}</strong><p>{direction.proposition}</p>
              <small>{direction.changes.join(" · ")}</small>
              {direction.fitConstruction && <span className="newDesignerDirectionFit">FIT + CONSTRUCTION {direction.fitConstruction.fitScore}/100</span>}
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
          </div>
          {response === "down" && <div className="newDesignerFeedbackReasons"><span>WHAT NEEDS WORK?</span>{DESIGNER_FEEDBACK_REASONS.map(([value,label])=><button key={value} type="button" aria-pressed={feedbackReason===value} onClick={()=>giveFeedbackReason(value)}>{label}</button>)}</div>}
          {response === "up" && <small>Thanks. This positive signal is recorded for Designer review.</small>}
          {response === "down" && feedbackReason && <small>Thanks. The reason is recorded with this exact outfit and cut.</small>}</div>}
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
