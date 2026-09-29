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
import { TAILOR_OBSERVATION_STORAGE_KEY, tailorObservationCoverage, tailorObservationSummary, type TailorObservationProfile } from "@/lib/designer/tailor-observations";
import { assessFitConstruction, formatFinishedRange } from "@/lib/designer/fit-construction";
import { assessBlockStrategy } from "@/lib/designer/block-strategy";
import { buildDesignerNegotiation } from "@/lib/designer/constraint-negotiation";
import { DESIGNER_FEEDBACK_REASONS } from "@/lib/designer/outcome-learning";
import { evaluateLinenEarthBrandLanguage } from "@/lib/designer/brand-language";
import { buildCanonicalGarmentSpec, canonicalGarmentSpecSummary } from "@/lib/designer/garment-spec";
import { searchDesignerCatalogue, type DesignerSearchResult, type DesignerSearchScope } from "@/lib/designer/search";
import { generateCreativeDirections, type CreativeDirection } from "@/lib/designer/creative-engine";
import type { DesignerCasebook } from "@/lib/designer/casebook";
import type { FitOutcomeBook } from "@/lib/designer/fit-outcomes";
import { creativeFamilyFromConceptId, type CreativeLearningBook, type CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import type { CreativeResearchLibrary } from "@/lib/designer/creative-research";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const OCCASIONS: OccasionTier[] = ["Casual", "Smart-Casual", "Semi-Formal", "Formal"];
const CLIMATES: DesignerClimate[] = ["Not specified", "Hot / humid", "Cool", "Air-conditioned"];
const INTENTIONS: DesignerIntention[] = ["Understated", "Balanced", "Expressive"];
const SESSION_KEY = "llinen-earth:designer-session:v1";
const DRAFT_KEY = "linen-earth:real-designer-draft:v2";
const FACT_INTERVAL_MS = 15_000;
type ShirtFabricFilter = "All" | "Plain" | "Print" | "Blend" | "Formal";
type PantFabricFilter = "All" | "Light" | "Medium" | "Dark";

const SHIRT_FILTERS:ShirtFabricFilter[]=["All","Plain","Print","Blend","Formal"];
const PANT_FILTERS:PantFabricFilter[]=["All","Light","Medium","Dark"];

function customerFabricLine(line:string) {
  return line
    .replace(/\b\d+\s*lea\b/gi,"")
    .replace(/\s{2,}/g," ")
    .replace(/\s*[-·|]\s*$/,"")
    .trim() || "Fabric collection";
}

function shirtFilterFor(fabric:DesignerFabric):Exclude<ShirtFabricFilter,"All"> {
  const text=`${fabric.line} ${fabric.patternType}`.toLowerCase();
  if(text.includes("formal")) return "Formal";
  if(text.includes("blend")) return "Blend";
  if(text.includes("print")) return "Print";
  return "Plain";
}

function pantFilterFor(fabric:DesignerFabric):Exclude<PantFabricFilter,"All"> {
  return fabric.tone || "Medium";
}


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
  const [tailorObservations, setTailorObservations] = useState<TailorObservationProfile | null>(null);
  const [searchScope, setSearchScope] = useState<DesignerSearchScope>("keep_shirt");
  const [searchResults, setSearchResults] = useState<DesignerSearchResult[]>([]);
  const [creativeDirections, setCreativeDirections] = useState<CreativeDirection[]>([]);
  const [activeCreative, setActiveCreative] = useState<CreativeDirection | null>(null);
  const [casebook, setCasebook] = useState<DesignerCasebook | null>(null);
  const [fitOutcomes, setFitOutcomes] = useState<FitOutcomeBook | null>(null);
  const [creativeLearning, setCreativeLearning] = useState<CreativeLearningBook | null>(null);
  const [creativeResearch, setCreativeResearch] = useState<CreativeResearchLibrary | null>(null);
  const [researchPool, setResearchPool] = useState<{websites:number;topics:number;targets:number;highAuthorityWebsites:number}|null>(null);
  const [shirtFilter,setShirtFilter]=useState<ShirtFabricFilter>("All");
  const [pantFilter,setPantFilter]=useState<PantFabricFilter>("All");
  const fact = DESIGNER_FASHION_FACTS[factIndex];
  const shirt = useMemo(() => shirtOptions.find((item) => item.id === shirtId), [shirtId, shirtOptions]);
  const pant = useMemo(() => pantOptions.find((item) => item.id === pantId), [pantId, pantOptions]);
  const visibleShirts=useMemo(()=>shirtFilter==="All" ? shirtOptions : shirtOptions.filter((item)=>shirtFilterFor(item)===shirtFilter),[shirtFilter,shirtOptions]);
  const visiblePants=useMemo(()=>pantFilter==="All" ? pantOptions : pantOptions.filter((item)=>pantFilterFor(item)===pantFilter),[pantFilter,pantOptions]);
  const designerWhatsAppHref=useMemo(()=>{
    if(!shirt || !pant) return "#";
    const creative=activeCreative ? `Creative direction: ${activeCreative.name}` : "";
    const details=[
      `Shirt: ${customerFabricLine(shirt.line)} — ${shirt.name}`,
      `Trouser: ${customerFabricLine(pant.line)} — ${pant.name}`,
      `Occasion: ${occasion}`,
      `Style: ${style.collar}; ${style.cuff}; ${style.shirtFit}; ${style.shirtWear}; ${style.trouser}`,
      creative,
    ].filter(Boolean).join("\n");
    return buildWhatsAppUrl({topic:"Designer Studio look",garment:"Shirt + trouser",details});
  },[shirt,pant,occasion,style,activeCreative]);
  const insights = shirt && pant ? designerStyleInsights(shirt, pant, occasion, style) : [];
  const fitCoverage = useMemo(() => measurementCoverage(measurementProfile), [measurementProfile]);
  const fitGuidance = useMemo(() => measurementFitGuidance(measurementProfile), [measurementProfile]);
  const observationCoverage = useMemo(() => tailorObservationCoverage(tailorObservations), [tailorObservations]);
  const observationSummary = useMemo(() => tailorObservationSummary(tailorObservations), [tailorObservations]);
  const fitConstruction = useMemo(() => shirt && pant ? assessFitConstruction(measurementProfile, style, { climate, shirtFabric: shirt, trouserFabric: pant, observations: tailorObservations }) : null, [measurementProfile, style, climate, shirt, pant, tailorObservations]);
  const blockStrategy = useMemo(() => shirt && pant ? assessBlockStrategy(measurementProfile, style, tailorObservations) : null, [measurementProfile, style, shirt, pant, tailorObservations]);
  const negotiation = useMemo(() => recommendation ? buildDesignerNegotiation(recommendation, fitConstruction) : null, [recommendation, fitConstruction]);
  const brandLanguage = useMemo(() => shirt && pant ? evaluateLinenEarthBrandLanguage(shirt,pant,style,occasion,{climate,intention}) : null, [shirt,pant,style,occasion,climate,intention]);
  const garmentSpec = useMemo(() => recommendation ? buildCanonicalGarmentSpec(recommendation, fitConstruction, measurementProfile, brandLanguage, blockStrategy) : null, [recommendation, fitConstruction, measurementProfile, brandLanguage, blockStrategy]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MEASUREMENT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MeasurementProfile;
      if (parsed?.version === 1) setMeasurementProfile(parsed);
    } catch { /* Saved measurements are optional; Designer remains usable without them. */ }
  },[]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TAILOR_OBSERVATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TailorObservationProfile;
      if (parsed?.version === 1) setTailorObservations(parsed);
    } catch { /* Tailor observations are optional; Designer remains usable without them. */ }
  },[]);

  useEffect(() => {
    let cancelled=false;
    async function loadCasebook() {
      try {
        const response=await fetch("/api/designer/casebook",{cache:"no-store"});
        if(!response.ok) return;
        const data=await response.json() as {casebook?:DesignerCasebook;fitOutcomes?:FitOutcomeBook;creativeLearning?:CreativeLearningBook;creativeResearch?:CreativeResearchLibrary;researchPool?:{websites:number;topics:number;targets:number;highAuthorityWebsites:number}};
        if(cancelled) return;
        if(data.casebook?.version==="designer-casebook-v1") setCasebook(data.casebook);
        if(data.fitOutcomes?.version==="designer-fit-outcomes-v1") setFitOutcomes(data.fitOutcomes);
        if(data.creativeLearning?.version==="designer-creative-learning-v1") setCreativeLearning(data.creativeLearning);
        if(data.creativeResearch?.version==="designer-creative-research-v1") setCreativeResearch(data.creativeResearch);
        if(data.researchPool?.targets) setResearchPool(data.researchPool);
      } catch { /* Casebook is optional; hard Designer rules continue without it. */ }
    }
    void loadCasebook();
    return ()=>{cancelled=true;};
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
          const proposals = planDesignerDirections(routedShirtFabric, routedPantFabric, nextOccasion, nextStyle, context, savedMeasurements, (() => { try { const raw = localStorage.getItem(TAILOR_OBSERVATION_STORAGE_KEY); return raw ? JSON.parse(raw) as TailorObservationProfile : null; } catch { return null; } })());
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
    setSearchResults([]);
    setCreativeDirections([]);
    setActiveCreative(null);
  },[shirtId,pantId,occasion,climate,intention]);

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
    setSearchResults([]);
    setCreativeDirections([]);
    setActiveCreative(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  function runAdvancedSearch() {
    if (!shirt || !pant) return;
    const results=searchDesignerCatalogue({
      shirts:shirtOptions,
      pants:pantOptions,
      currentShirt:shirt,
      currentPant:pant,
      occasion,
      chosenStyle:style,
      context:{climate,intention},
      measurements:measurementProfile,
      observations:tailorObservations,
      scope:searchScope,
      casebook,
      fitOutcomes,
    });
    setSearchResults(results);
  }

  function runCreativeLab() {
    if (!shirt || !pant) return;
    const concepts=generateCreativeDirections({
      shirt,pant,occasion,style,context:{climate,intention},
      measurements:measurementProfile,observations:tailorObservations,creativeLearning,creativeResearch,researchFreedom:"maximum",limit:5,
    });
    setCreativeDirections(concepts);
    setActiveCreative(null);
  }

  function giveCreativeRenderFeedback(rating:"up"|"down",creativeReason?:CreativeFeedbackReason) {
    if(!activeCreative || !shirt || !pant) return;
    try {
      recordStyleMemoryEvent(designerSession(),"designer_feedback",{
        recommendationId:recommendationId || activeCreative.id,
        rating,
        shirtId:shirt.id,
        pantId:pant.id,
        occasion,
        style,
        creativeConceptId:activeCreative.id,
        creativeFamilyId:creativeFamilyFromConceptId(activeCreative.id),
        creativeConceptName:activeCreative.name,
        creativePatternId:activeCreative.pattern?.id || "",
        creativeMoveIds:activeCreative.treatments.map((move)=>move.id),
        creativeReason:creativeReason || "",
        creativeRendered:true,
        note:"Visual review of the photoreal V5 concept render.",
      });
    } catch { /* Creative review remains optional if memory storage is unavailable. */ }
  }

  function useCreativeDirection(direction:CreativeDirection) {
    setStyle({...direction.baseStyle});
    setRecommendation(direction.recommendation);
    setDirections([]);
    setSearchResults([]);
    setActiveCreative(direction);
    setResponse(null);
    setFeedbackReason(null);
    setRecommendationId(null);
    try {
      const event=recordStyleMemoryEvent(designerSession(),"designer_recommendation",{
        shirtId:direction.recommendation.shirt.id,
        pantId:direction.recommendation.pant.id,
        occasion:direction.recommendation.occasion,
        style:direction.baseStyle,
        input:{
          source:"creative_lab_v5",
          conceptId:direction.id,
          conceptName:direction.name,
          thesis:direction.thesis,
          treatments:direction.treatments,
          pattern:direction.pattern || null,
          critics:direction.critics,
          overall:direction.overall,
          certainty:direction.certainty,
          context:{climate,intention},
        },
        rules:direction.recommendation.rules,
        confidenceScore:direction.recommendation.confidenceScore,
        designFitScore:direction.recommendation.designFitScore,
        materialEvidence:direction.recommendation.materialEvidence,
        formality:direction.recommendation.formality,
        output:direction.baseStyle,
        reasoningText:`${direction.thesis} Creative Lab V5 selected after multi-critic refinement.`,
        status:direction.recommendation.status,
        ruleSetVersion:direction.recommendation.ruleSetVersion,
      });
      setRecommendationId(event.id);
    } catch { /* Creative concept remains usable if memory storage is unavailable. */ }
  }

  function useSearchResult(result:DesignerSearchResult) {
    setActiveCreative(null);
    setShirtId(result.shirt.id);
    setPantId(result.pant.id);
    setStyle({...result.style});
    setRecommendation(result.recommendation);
    setDirections([]);
    setSearchResults([]);
    setResponse(null);
    setFeedbackReason(null);
    setRecommendationId(null);
    try {
      const spec=buildCanonicalGarmentSpec(result.recommendation,result.fitConstruction,measurementProfile,result.brandLanguage,result.blockStrategy);
      const event=recordStyleMemoryEvent(designerSession(),"designer_recommendation",{
        shirtId:result.shirt.id,pantId:result.pant.id,occasion:result.recommendation.occasion,style:result.style,
        input:{source:"advanced_catalogue_search",tier:result.tier,scope:searchScope,context:{climate,intention}},
        rules:result.recommendation.rules,
        confidenceScore:result.recommendation.confidenceScore,
        designFitScore:result.recommendation.designFitScore,
        materialEvidence:result.recommendation.materialEvidence,
        formality:result.recommendation.formality,
        output:result.style,
        reasoningText:result.recommendation.internalReason,
        status:result.recommendation.status,
        ruleSetVersion:result.recommendation.ruleSetVersion,
        garmentSpec:{version:spec.version,status:spec.status,fitConstructionScore:spec.decision.fitConstructionScore,brandLanguageScore:spec.decision.brandLanguageScore,blockStrategyScore:spec.decision.blockStrategyScore,readiness:spec.readiness},
      });
      setRecommendationId(event.id);
    } catch { /* Search result remains usable when event storage is unavailable. */ }
  }

  function assess(nextStyle: DesignerStyle = style) {
    if (!shirt || !pant) return;
    setActiveCreative(null);
    const context: DesignerContext = { climate, intention };
    const proposals = planDesignerDirections(shirt, pant, occasion, nextStyle, context, measurementProfile, tailorObservations);
    const result = proposals[0].recommendation;
    setStyle({ ...nextStyle });
    setDirections(proposals);
    setRecommendation(result);
    setRecommendationId(null);
    setResponse(null);
    setFeedbackReason(null);
    try {
      const spec = buildCanonicalGarmentSpec(result, proposals[0].fitConstruction, measurementProfile, proposals[0].brandLanguage, proposals[0].blockStrategy);
      const event = recordStyleMemoryEvent(designerSession(), "designer_recommendation", {
        shirtId, pantId, occasion, style: nextStyle, input: { shirtId, pantId, occasion, style: nextStyle, context, measurementCoverage: fitCoverage, fitGuidance }, rules: result.rules,
        confidenceScore: result.confidenceScore, designFitScore: result.designFitScore,
        materialEvidence: result.materialEvidence, formality: result.formality,
        output: result.style, reasoningText: result.internalReason,
        status: result.status, ruleSetVersion: result.ruleSetVersion,
        garmentSpec: {
          version: spec.version, status: spec.status, fitConstructionScore: spec.decision.fitConstructionScore,
          brandLanguageScore: spec.decision.brandLanguageScore, blockStrategyScore: spec.decision.blockStrategyScore, readiness: spec.readiness,
        },
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
    setActiveCreative(null);
    setStyle((current) => ({ ...current, [key]: value }));
    setRecommendation(null);
    setRecommendationId(null);
  }

  function applyStylePatch(patch: Partial<DesignerStyle>) {
    setActiveCreative(null);
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

  function creativeStatus(direction:CreativeDirection) {
    const aesthetic=direction.critics.find((item)=>item.id==="aesthetic")?.score || 0;
    const originality=direction.critics.find((item)=>item.id==="originality")?.score || 0;
    if(direction.explorationClass==="frontier") return "Frontier";
    if(aesthetic>=82 && originality>=78) return "Strong";
    if(originality>=84) return "Fresh";
    return "Explore";
  }

  function creativeQuickTags(direction:CreativeDirection) {
    const tags:string[]=[];
    if(direction.pattern) tags.push(direction.pattern.name);
    for(const move of direction.treatments.slice(0,2)) tags.push(move.label);
    return tags.slice(0,3);
  }

  function downloadGarmentSpec() {
    if (!garmentSpec) return;
    const summary = canonicalGarmentSpecSummary(garmentSpec);
    const blob = new Blob([JSON.stringify({ ...garmentSpec, summary }, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `linen-earth-garment-spec-${garmentSpec.fabrics.shirt.id}-${garmentSpec.fabrics.trouser.id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return <div className="newDesigner">
    <header className="newDesignerHero">
      <div className="newDesignerHeroCopy">
        <span className="newDesignerKicker">LINEN EARTH / THE DESIGN STUDIO</span>
        <h1>Designer<span className="newDesignerHeroDot">.</span></h1>
        <p className="newDesignerHeroLead">Choose cloth. Create a look. See it instantly.</p>
        <div className="newDesignerHeroIndex"><span>1 · CLOTH</span><span>2 · DESIGN</span><span>3 · PREVIEW</span></div>
      </div>
      <figure className="newDesignerHeroArt">
        <div className="newDesignerArchiveFrame"><img src="/designer/studio-pleated.webp" alt="Faceless studio mannequin in a shirt and tailored trousers" /></div>
        <div className="newDesignerHeroFabric"><img src={shirt?.image} alt="Linen Earth selected shirting fabric" /><span>THE CLOTH / SHIRT</span></div>
        <div className="newDesignerHeroFabric second"><img src={pant?.image} alt="Linen Earth selected trouser fabric" /><span>THE CLOTH / TROUSER</span></div>
        <figcaption>Live outfit preview</figcaption>
      </figure>
    </header>

    <div className="newDesignerBody">
      <section className="newDesignerSelections" aria-labelledby="designerChoose">
        {directorHandoff && <div className="newDesignerHandoff"><span>STYLE DIRECTOR HANDOFF</span><strong>{directorHandoffTitle || "Your complete outfit direction is loaded."}</strong><p>{shirt?.name} shirt + {pant?.name} trousers · {style.shirtWear} · {style.trouser}. You can refine any detail below without rebuilding the look.</p></div>}
        <div className="newDesignerSectionHead"><span>01 / CLOTH</span><h2 id="designerChoose">Choose your fabrics.</h2></div>
        <div className="newDesignerFabricGrid">
          <article className="newDesignerFabric">
            <div className="newDesignerFabricFilters" aria-label="Filter shirt fabrics">
              {SHIRT_FILTERS.map((filter)=><button key={filter} type="button" className={shirtFilter===filter?"selected":""} aria-pressed={shirtFilter===filter} onClick={()=>{
                setShirtFilter(filter);
                const next=filter==="All"?shirtOptions:shirtOptions.filter((item)=>shirtFilterFor(item)===filter);
                if(next.length && !next.some((item)=>item.id===shirtId)) setShirtId(next[0].id);
                setRecommendation(null); setRecommendationId(null);
              }}>{filter}</button>)}
            </div>
            <div className="newDesignerSwatch" style={{ backgroundColor: shirt?.hex || "#172339" }}>
              {shirt && <img src={shirt.image} alt={`${shirt.name} shirting fabric swatch`} loading="lazy" decoding="async" />}
            </div>
            <label htmlFor="designer-shirt">Shirt fabric <span>{visibleShirts.length} choices</span></label>
            <select id="designer-shirt" value={shirtId} onChange={(event) => { setShirtId(event.target.value); setRecommendation(null); setRecommendationId(null); }}>
              {visibleShirts.map((fabric) => <option key={fabric.id} value={fabric.id}>{customerFabricLine(fabric.line)} · {fabric.name}</option>)}
            </select>
            <small>{shirt?.patternType} · {customerFabricLine(shirt?.line || "")}</small>
            {shirt && /lea/i.test(shirt.line) && <details className="newDesignerFabricSpecs"><summary>ⓘ Fabric specs</summary><p><b>{shirt.line}</b> · “Lea” is a yarn-count term used in the textile trade; it stays here as a technical fabric reference.</p></details>}
          </article>
          <article className="newDesignerFabric">
            <div className="newDesignerFabricFilters" aria-label="Filter trouser fabrics">
              {PANT_FILTERS.map((filter)=><button key={filter} type="button" className={pantFilter===filter?"selected":""} aria-pressed={pantFilter===filter} onClick={()=>{
                setPantFilter(filter);
                const next=filter==="All"?pantOptions:pantOptions.filter((item)=>pantFilterFor(item)===filter);
                if(next.length && !next.some((item)=>item.id===pantId)) setPantId(next[0].id);
                setRecommendation(null); setRecommendationId(null);
              }}>{filter}</button>)}
            </div>
            <div className="newDesignerSwatch" style={{ backgroundColor: pant?.hex || "#172339" }}>
              {pant && <img src={pant.image} alt={`${pant.name} trouser fabric swatch`} loading="lazy" decoding="async" />}
            </div>
            <label htmlFor="designer-pant">Trouser fabric <span>{visiblePants.length} choices</span></label>
            <select id="designer-pant" value={pantId} onChange={(event) => { setPantId(event.target.value); setRecommendation(null); setRecommendationId(null); }}>
              {visiblePants.map((fabric) => <option key={fabric.id} value={fabric.id}>{customerFabricLine(fabric.line)} · {fabric.name}</option>)}
            </select>
            <small>{pant?.patternType} · {pant?.tone || "Tone not classified"}</small>
            {pant && /lea/i.test(pant.line) && <details className="newDesignerFabricSpecs"><summary>ⓘ Fabric specs</summary><p><b>{pant.line}</b> · “Lea” is a yarn-count term used in the textile trade; it stays here as a technical fabric reference.</p></details>}
          </article>
        </div>
        <a className="newDesignerCreativeTeaser" href="#designerCreativeLab"><span>✦ CREATIVE LAB</span><strong>Your cloth can become 5 original design directions.</strong><b>Explore after occasion →</b></a>
        <a className="newDesignerJump" href="#designerPhotoTitle">Preview on model ↘</a>

        <fieldset className="newDesignerOccasions">
          <legend>02 / WHERE WILL YOU WEAR IT?</legend>
          <div>{OCCASIONS.map((option) => <label key={option} className={option === occasion ? "selected" : ""}>
            <input type="radio" name="designerOccasion" value={option} checked={option === occasion}
              onChange={() => { setOccasion(option); setStyle(designerStyleForOccasion(option)); setRecommendation(null); setRecommendationId(null); }} />{option}
          </label>)}</div>
        </fieldset>
        <div className="newDesignerContext newDesignerContextSimple">
          <label>Style mood
            <select value={intention} onChange={(event) => { setIntention(event.target.value as DesignerIntention); setRecommendation(null); }}>
              {INTENTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <details className="newDesignerTechnicalDrawer newDesignerPreferenceDrawer">
            <summary>More preferences</summary>
            <label>Climate
              <select value={climate} onChange={(event) => { setClimate(event.target.value as DesignerClimate); setRecommendation(null); }}>
                {CLIMATES.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </details>
        </div>

        <section className="newDesignerFitCompact" aria-label="Saved tailoring measurements">
          <div>
            <span>MEASUREMENTS</span>
            <strong>{fitCoverage.total > 0 ? `${fitCoverage.total}/16 loaded` : "Optional"}</strong>
          </div>
          <Link href="/measurements">{fitCoverage.total > 0 ? "Edit" : "Add"} ↗</Link>
          {(fitCoverage.total > 0 || observationCoverage > 0) && <details className="newDesignerTechnicalDrawer">
            <summary>Fit details</summary>
            {fitGuidance.slice(0,3).map((note)=><p key={note}>{note}</p>)}
            {fitConstruction && <p><b>Fit read:</b> {fitConstruction.fitScore}/100 · {fitConstruction.checks.filter((item)=>item.severity!=="info").length} checks</p>}
            {blockStrategy && <p><b>Starting block:</b> {blockStrategy.shirtBlock.replaceAll("-"," ")} + {blockStrategy.trouserBlock.replaceAll("-"," ")}</p>}
          </details>}
        </section>

        <section className="newDesignerSearch newDesignerSimplePanel" aria-label="Designer catalogue search">
          <div className="newDesignerSimpleHead">
            <div><span>OPTIONAL</span><strong>Try different fabrics.</strong></div>
            <button type="button" onClick={runAdvancedSearch} disabled={!shirt || !pant}>Show options</button>
          </div>
          <div className="newDesignerSearchScopes" role="group" aria-label="Designer search scope">
            <button type="button" aria-pressed={searchScope==="keep_shirt"} onClick={()=>{setSearchScope("keep_shirt");setSearchResults([]);}}>Keep shirt</button>
            <button type="button" aria-pressed={searchScope==="keep_trouser"} onClick={()=>{setSearchScope("keep_trouser");setSearchResults([]);}}>Keep trouser</button>
            <button type="button" aria-pressed={searchScope==="open"} onClick={()=>{setSearchScope("open");setSearchResults([]);}}>Change both</button>
          </div>
          {searchResults.length>0 && <div className="newDesignerQuickResults">
            {searchResults.slice(0,3).map((result)=><article key={result.id}>
              <div className="newDesignerQuickFabricPair">
                <img src={result.shirt.image} alt="" loading="lazy" decoding="async" />
                <img src={result.pant.image} alt="" loading="lazy" decoding="async" />
              </div>
              <div className="newDesignerQuickResultCopy">
                <span>{result.tier}</span>
                <strong>{result.shirt.name} + {result.pant.name}</strong>
                <div>{result.decision.dominantStrengths.slice(0,3).map((item)=><b key={item}>{item}</b>)}</div>
              </div>
              <button type="button" onClick={()=>useSearchResult(result)}>Use look</button>
              <details className="newDesignerTechnicalDrawer">
                <summary>Why this works</summary>
                {result.reasons.slice(0,3).map((reason)=><p key={reason}>{reason}</p>)}
                <p><b>Internal read:</b> {result.decision.overall}/100 · certainty {result.decision.certainty}/100 · {result.decision.risk} risk</p>
              </details>
            </article>)}
          </div>}
        </section>

        <section id="designerCreativeLab" className="newDesignerCreative newDesignerVisualLab" aria-label="Creative Designer Lab V5">
          <div className="newDesignerSimpleHead">
            <div>
              <span>03 / CREATE</span>
              <strong>Imagine new designs.</strong>
              {researchPool && <small>{researchPool.targets.toLocaleString("en-IN")} research paths working in the background</small>}
            </div>
            <button type="button" onClick={runCreativeLab} disabled={!shirt || !pant}>Create ideas ✦</button>
          </div>
          {creativeDirections.length===0 && <div className="newDesignerCreativeEmpty">
            <div className="newDesignerSpark">✦</div>
            <strong>Ready to explore</strong>
            <span>V5 searches widely, then shows only its strongest ideas.</span>
          </div>}
          {creativeDirections.length>0 && <div className="newDesignerCreativeResults newDesignerVisualResults">
            {creativeDirections.slice(0,5).map((direction)=><article key={direction.id} data-active={activeCreative?.id===direction.id}>
              <button className="newDesignerCreativeVisual" type="button" onClick={()=>useCreativeDirection(direction)} data-pattern={direction.pattern?.family || "detail"} aria-label={`Preview ${direction.name}`}>
                <img src={shirt?.image} alt="" loading="lazy" decoding="async" />
                <span className="newDesignerCreativeVisualOverlay" />
                <b>{creativeStatus(direction)}</b>
              </button>
              <div className="newDesignerCreativeCardCopy">
                <span>{direction.explorationClass==="frontier" ? "FRONTIER IDEA" : direction.pattern ? "PATTERN + DETAIL" : "DETAIL + PROPORTION"}</span>
                <h3>{direction.name}</h3>
                <div className="newDesignerCreativeTagRow">{creativeQuickTags(direction).map((tag)=><b key={tag}>{tag}</b>)}</div>
              </div>
              <button className="newDesignerCreativeUse" type="button" onClick={()=>useCreativeDirection(direction)}>{activeCreative?.id===direction.id?"Selected":"Try this"}</button>
              <details className="newDesignerTechnicalDrawer">
                <summary>Design reasoning</summary>
                <p>{direction.thesis}</p>
                <div className="newDesignerMiniScores">
                  {direction.critics.map((critic)=><span key={critic.id}>{critic.label.replace(" critic","")} <b>{Math.round(critic.score)}</b></span>)}
                </div>
                {direction.research.slice(0,2).map((item)=><p key={item.id}><b>{item.sourceTitle}:</b> {item.transformedInto}</p>)}
              </details>
            </article>)}
          </div>}
        </section>

        <div className="newDesignerStyleBlock newDesignerSimplePanel">
          <div className="newDesignerSimpleHead">
            <div><span>04 / SHAPE</span><strong>Adjust only what matters.</strong></div>
            <button type="button" onClick={matchPhotographedOfficeModel}>Office preset</button>
          </div>
          <div className="newDesignerStyleGrid newDesignerStyleGridCompact">{MAIN_DETAILS.slice(0,4).map(([key,label])=><label key={key}>{label}
            <select value={style[key]} onChange={(event)=>changeStyle(key,event.target.value)}>
              {DESIGNER_STYLE_CHOICES[key].map((option)=><option key={option} value={option}>{option}</option>)}
            </select>
          </label>)}</div>
          <details className="newDesignerTechnicalDrawer">
            <summary>More cut options</summary>
            <div className="newDesignerStyleGrid">{[...MAIN_DETAILS.slice(4),...MORE_DETAILS].map(([key,label])=><label key={key}>{label}
              <select value={style[key]} onChange={(event)=>changeStyle(key,event.target.value)}>
                {DESIGNER_STYLE_CHOICES[key].map((option)=><option key={option} value={option}>{option}</option>)}
              </select>
            </label>)}</div>
          </details>
        </div>
        <div className="newDesignerDraftActions">
          <button className="newDesignerAction" type="button" disabled={!shirt || !pant} onClick={() => assess()}>Check this look ↗</button>
          <button className="newDesignerReset" type="button" onClick={resetDraft}>Reset</button>
        </div>
        <div className="newDesignerTruthNearCta"><span>PREVIEW NOTE</span><p>Final colour, drape and fit still need physical fabric and sample verification in store.</p></div>
      </section>

      <div className="newDesignerRight">
      {directorHandoff && <div className="newDesignerModelHandoff newDesignerModelHandoffCompact"><span>STYLE DIRECTOR</span><strong>{directorHandoffTitle || "Selected direction"}</strong></div>}
      {activeCreative && <div className="newDesignerCreativeHandoff newDesignerCreativeHandoffCompact">
        <span>SELECTED IDEA</span>
        <strong>{activeCreative.name}</strong>
        <div>{creativeQuickTags(activeCreative).map((tag)=><b key={tag}>{tag}</b>)}</div>
      </div>}
      {shirt && pant && <PhotoOutfitPreview shirt={shirt} pant={pant} style={style} creativeDirection={activeCreative} onCreativeFeedback={giveCreativeRenderFeedback} />}
      {fitCoverage.total > 0 && <div className="newDesignerFitModelNote newDesignerFitModelNoteCompact"><span>FIT PROFILE · {fitCoverage.total}/16</span></div>}
      <section className="newDesignerOutcome newDesignerOutcomeCompact" aria-live="polite" aria-label="Designer recommendation">
        {!recommendation ? <div className="newDesignerEmpty newDesignerEmptyCompact"><span>LOOK CHECK</span><strong>Preview first.</strong><p>When you like the direction, check the look.</p></div> : <>
          <div className="newDesignerResultTop">
            <span>{recommendation.status==="preliminary" ? "LOOKS PROMISING" : "REVIEW NEEDED"}</span>
            <strong>{recommendation.shirt.name} + {recommendation.pant.name}</strong>
          </div>
          <div className="newDesignerResultChips">
            <b>{recommendation.style.shirtFit}</b>
            <b>{recommendation.style.shirtWear}</b>
            <b>{recommendation.style.trouser}</b>
            {brandLanguage && <b>{brandLanguage.mode}</b>}
          </div>
          <div className="newDesignerResultReasons">
            {[recommendation.shortReason,...(brandLanguage?.strengths || [])].filter(Boolean).slice(0,3).map((item)=><span key={item}>✓ {item}</span>)}
          </div>
          <a className="newDesignerWhatsAppLook" href={designerWhatsAppHref} target="_blank" rel="noreferrer">WhatsApp this exact look <b>↗</b></a>
          {recommendationId && <div className="newDesignerFeedback newDesignerFeedbackCompact">
            <span>Like this direction?</span><div>
              <button type="button" onClick={()=>giveFeedback("up")} aria-pressed={response==="up"}>Yes</button>
              <button type="button" onClick={()=>giveFeedback("down")} aria-pressed={response==="down"}>Change it</button>
            </div>
          </div>}
          <details className="newDesignerTechnicalDrawer newDesignerAdvancedResult">
            <summary>Technical details</summary>
            <p><b>Design:</b> {recommendation.style.collar} · {recommendation.style.cuff} · {recommendation.style.placket}</p>
            <p><b>Material check:</b> {recommendation.materialEvidence.verified}/{recommendation.materialEvidence.total} verified</p>
            {fitConstruction && <p><b>Fit/construction:</b> {fitConstruction.fitScore}/100</p>}
            {blockStrategy && <p><b>Starting block:</b> {blockStrategy.shirtBlock.replaceAll("-"," ")} + {blockStrategy.trouserBlock.replaceAll("-"," ")}</p>}
            {negotiation?.blockers.slice(0,2).map((item)=><p key={item.id}>{item.message}</p>)}
            {garmentSpec && <button type="button" onClick={downloadGarmentSpec}>Export garment spec ↗</button>}
          </details>
        </>}
      </section>
      </div>
    </div>
    <details className="newDesignerResearchDrawer" aria-labelledby="designerNotebook">
      <summary>Research & technical sources</summary>
      <div className="newDesignerNotebookHead"><span>BACKEND RESEARCH</span><h2 id="designerNotebook">Research powering Designer</h2></div>
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
    </details>
  </div>;
}
