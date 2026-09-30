"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  DESIGNER_PANTS, DESIGNER_REVIEWED_PAIRING, DESIGNER_SHIRTS, DESIGNER_STYLE_CHOICES,
  designerStyleForOccasion, designerTasteAlternative,
  type DesignerClimate, type DesignerContext, type DesignerFabric, type DesignerIntention, type DesignerRecommendation, type DesignerStyle, type OccasionTier,
} from "@/lib/designer/engine";
import { DESIGNER_FASHION_FACTS, DESIGNER_RESEARCH } from "@/lib/designer/research";
import { createStyleSessionId, readLocalDesignerTasteProfile, recordStyleMemoryEvent } from "@/lib/browser-style-memory";
import { PhotoOutfitPreview, StyleDirectorRealModelPreview, type CreativeVisualCheck } from "@/components/PhotoOutfitPreview";
import { MEASUREMENT_STORAGE_KEY, formatMeasure, measurementCoverage, measurementFitGuidance, type MeasurementProfile } from "@/lib/measurements";
import { TAILOR_OBSERVATION_STORAGE_KEY, tailorObservationCoverage, tailorObservationSummary, type TailorObservationProfile } from "@/lib/designer/tailor-observations";
import { DESIGNER_FEEDBACK_REASONS } from "@/lib/designer/outcome-learning";
import { canonicalGarmentSpecSummary } from "@/lib/designer/garment-spec";
import type { DesignerAssessmentResponse } from "@/lib/designer/assessment-types";
import type { DesignerSearchScope, DesignerSearchTier } from "@/lib/designer/search";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import { creativeFamilyFromConceptId, type CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  fromLegacyStyle,
  mergeLegacyIntoStyleSpec,
  toLegacyStyle,
  validateStyleSpecV2,
  type StyleSpecV2,
} from "@/lib/designer/style-spec-v2";
import {
  bodyProfileFromMeasurements,
  DEFAULT_BODY_PREVIEW_PROFILE,
  validBodyPreviewProfile,
  type BodyPreviewProfile,
} from "@/lib/designer/body-profile";

const OCCASIONS: OccasionTier[] = ["Casual", "Smart-Casual", "Semi-Formal", "Formal"];
const CLIMATES: DesignerClimate[] = ["Not specified", "Hot / humid", "Cool", "Air-conditioned"];
const INTENTIONS: DesignerIntention[] = ["Understated", "Balanced", "Expressive"];
const SESSION_KEY = "linen-earth:designer-session:v1";
const DRAFT_KEY = "linen-earth:real-designer-draft:v2";
const FACT_INTERVAL_MS = 15_000;
const LiveConstructionPreview=dynamic(
  ()=>import("@/components/LiveConstructionPreview").then((module)=>module.LiveConstructionPreview),
  {ssr:false,loading:()=> <div className="newDesignerPreviewLoading">Loading construction preview…</div>},
);
type ShirtFabricFilter = "All" | "Plain" | "Print" | "Blend" | "Formal";
type PantFabricFilter = "All" | "Light" | "Medium" | "Dark";
type DesignerSearchOption = {
  id:string;
  tier:DesignerSearchTier;
  shirt:DesignerFabric;
  pant:DesignerFabric;
  style:DesignerStyle;
  recommendation:DesignerRecommendation;
  fitAdaptation?:string;
};

type DesignerBriefOption = DesignerSearchOption & {
  rank:number;
  title:string;
  reasons:string[];
  tradeoffs:string[];
};
type DesignerBriefInterpretation = {
  brief:string;
  occasion:OccasionTier;
  context:DesignerContext;
  notes:string[];
};

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
  const [styleSpec,setStyleSpec]=useState<StyleSpecV2>(()=>fromLegacyStyle(designerStyleForOccasion(DESIGNER_REVIEWED_PAIRING.occasion)));
  const [previewMode,setPreviewMode]=useState<"photo"|"construction">("photo");
  const [bodyProfile,setBodyProfile]=useState<BodyPreviewProfile>(DEFAULT_BODY_PREVIEW_PROFILE);
  const [climate, setClimate] = useState<DesignerClimate>("Not specified");
  const [intention, setIntention] = useState<DesignerIntention>("Balanced");
  const [recommendation, setRecommendation] = useState<DesignerRecommendation | null>(null);
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
  const [searchResults, setSearchResults] = useState<DesignerSearchOption[]>([]);
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchError,setSearchError]=useState("");
  const [briefText,setBriefText]=useState("");
  const [briefResults,setBriefResults]=useState<DesignerBriefOption[]>([]);
  const [briefInterpretation,setBriefInterpretation]=useState<DesignerBriefInterpretation|null>(null);
  const [briefLoading,setBriefLoading]=useState(false);
  const [briefError,setBriefError]=useState("");
  const [assessment,setAssessment]=useState<DesignerAssessmentResponse|null>(null);
  const [assessmentLoading,setAssessmentLoading]=useState(false);
  const [assessmentError,setAssessmentError]=useState("");
  const [creativeDirections, setCreativeDirections] = useState<CreativeDirection[]>([]);
  const [activeCreative, setActiveCreative] = useState<CreativeDirection | null>(null);
  const [creativeAutoNote,setCreativeAutoNote]=useState("");
  const [creativeAutoRetryCount,setCreativeAutoRetryCount]=useState(0);
  const [creativeAutoRenderNonce,setCreativeAutoRenderNonce]=useState(0);
  const [creativeVisualReview,setCreativeVisualReview]=useState<CreativeVisualCheck|null>(null);
  const [creativeRenderRepair,setCreativeRenderRepair]=useState("");
  const [creativeGenerating,setCreativeGenerating]=useState(false);
  const [shirtFilter,setShirtFilter]=useState<ShirtFabricFilter>("All");
  const [pantFilter,setPantFilter]=useState<PantFabricFilter>("All");
  const fact = DESIGNER_FASHION_FACTS[factIndex];
  const shirt = useMemo(() => shirtOptions.find((item) => item.id === shirtId), [shirtId, shirtOptions]);
  const pant = useMemo(() => pantOptions.find((item) => item.id === pantId), [pantId, pantOptions]);
  const visibleShirts=useMemo(()=>shirtFilter==="All" ? shirtOptions : shirtOptions.filter((item)=>shirtFilterFor(item)===shirtFilter),[shirtFilter,shirtOptions]);
  const visiblePants=useMemo(()=>pantFilter==="All" ? pantOptions : pantOptions.filter((item)=>pantFilterFor(item)===pantFilter),[pantFilter,pantOptions]);
  const designerWhatsAppHref=useMemo(()=>{
    if(!shirt || !pant) return "#";
    const creative=activeCreative ? [
      `Creative direction: ${activeCreative.name}`,
      `Creative details: ${activeCreative.treatments.slice(0,3).map((move)=>move.label).join(" · ")}`,
      ...(activeCreative.pattern ? [`Pattern concept: ${activeCreative.pattern.name} · ${activeCreative.pattern.placement}`] : []),
    ] : [];
    const details=[
      `Shirt: ${customerFabricLine(shirt.line)} — ${shirt.name}`,
      `Trouser: ${customerFabricLine(pant.line)} — ${pant.name}`,
      `Occasion: ${occasion}`,
      `Style: ${style.collar}; ${style.cuff}; ${style.shirtFit}; ${style.shirtWear}; ${style.trouser}`,
      ...creative,
    ].filter(Boolean).join("\n");
    return buildWhatsAppUrl({topic:"Designer Studio look",garment:"Shirt + trouser",details});
  },[shirt,pant,occasion,style,activeCreative]);
  const fitCoverage = useMemo(() => measurementCoverage(measurementProfile), [measurementProfile]);
  const fitGuidance = useMemo(() => measurementFitGuidance(measurementProfile), [measurementProfile]);
  const observationCoverage = useMemo(() => tailorObservationCoverage(tailorObservations), [tailorObservations]);
  const observationSummary = useMemo(() => tailorObservationSummary(tailorObservations), [tailorObservations]);
  const fitConstruction=assessment?.fitConstruction || null;
  const blockStrategy=assessment?.blockStrategy || null;
  const negotiation=assessment?.negotiation || null;
  const brandLanguage=assessment?.brandLanguage || null;
  const garmentSpec=assessment?.garmentSpec || null;

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
        intention?: DesignerIntention; style?: Partial<DesignerStyle>; styleSpec?: unknown; bodyProfile?: unknown; creative?: CreativeDirection | null;
        creativeVisualReview?: CreativeVisualCheck | null;
      } | null;

      let nextShirtId = parsed?.shirtId && DESIGNER_SHIRTS.some((item) => item.id === parsed.shirtId) ? parsed.shirtId : shirtId;
      let nextPantId = parsed?.pantId && DESIGNER_PANTS.some((item) => item.id === parsed.pantId) ? parsed.pantId : pantId;
      let nextOccasion: OccasionTier = parsed?.occasion && OCCASIONS.includes(parsed.occasion) ? parsed.occasion : occasion;
      let nextClimate: DesignerClimate = parsed?.climate && CLIMATES.includes(parsed.climate) ? parsed.climate : climate;
      let nextIntention: DesignerIntention = parsed?.intention && INTENTIONS.includes(parsed.intention) ? parsed.intention : intention;
      let nextStyle = designerStyleForOccasion(nextOccasion);
      let nextStyleSpec:StyleSpecV2|undefined;
      let nextBodyProfile:BodyPreviewProfile|undefined;

      if (parsed?.style) {
        for (const key of Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>) {
          const value = parsed.style[key];
          if (typeof value === "string" && DESIGNER_STYLE_CHOICES[key].includes(value)) nextStyle[key] = value;
        }
      }
      if(parsed?.styleSpec && validateStyleSpecV2(parsed.styleSpec)) nextStyleSpec=parsed.styleSpec;
      if(parsed?.bodyProfile && validBodyPreviewProfile(parsed.bodyProfile)) nextBodyProfile=parsed.bodyProfile;

      // A Style Director handoff is authoritative for this opening state. It
      // carries the resolved shirt + trouser pair and the supported cut, so the
      // photographed model opens as the Director's actual result.
      const params = new URLSearchParams(window.location.search);
      const fromDirector = params.get("from") === "style-director";
      setDirectorHandoff(fromDirector);
      if(fromDirector) nextStyleSpec=undefined;

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
      setStyleSpec(nextStyleSpec || fromLegacyStyle(nextStyle));
      setBodyProfile(nextBodyProfile || DEFAULT_BODY_PREVIEW_PROFILE);

      if(!fromDirector && parsed?.creative &&
        parsed.creative.recommendation?.shirt?.id===nextShirtId &&
        parsed.creative.recommendation?.pant?.id===nextPantId &&
        parsed.creative.recommendation?.occasion===nextOccasion &&
        Array.isArray(parsed.creative.treatments)) {
        setActiveCreative(parsed.creative);
        setCreativeDirections([parsed.creative]);
        setRecommendation(parsed.creative.recommendation);
        if(parsed.creativeVisualReview?.evidenceAvailable) setCreativeVisualReview(parsed.creativeVisualReview);
      }

      if (fromDirector) {
        const routedShirtFabric = DESIGNER_SHIRTS.find((item) => item.id === nextShirtId);
        const routedPantFabric = DESIGNER_PANTS.find((item) => item.id === nextPantId);
        if (routedShirtFabric && routedPantFabric) {
          const context: DesignerContext = { climate: nextClimate, intention: nextIntention };
          void requestLookAssessment({
            shirtId:nextShirtId,pantId:nextPantId,occasion:nextOccasion,style:nextStyle,context,
          }).then((next)=>{
            applyServerAssessment(next);
            setResponse(null);
            setFeedbackReason(null);
            try {
              const event = recordStyleMemoryEvent(designerSession(), "designer_recommendation", {
                shirtId:nextShirtId,pantId:nextPantId,occasion:nextOccasion,style:nextStyle,
                input:{shirtId:nextShirtId,pantId:nextPantId,occasion:nextOccasion,style:nextStyle,context,source:"style-director"},
                rules:next.recommendation.rules,confidenceScore:next.recommendation.confidenceScore,designFitScore:next.recommendation.designFitScore,
                materialEvidence:next.recommendation.materialEvidence,formality:next.recommendation.formality,output:next.recommendation.style,
                reasoningText:next.recommendation.internalReason,status:next.recommendation.status,ruleSetVersion:next.recommendation.ruleSetVersion,
                garmentSpec:{version:next.garmentSpec.version,status:next.garmentSpec.status,readiness:next.garmentSpec.readiness},
              });
              setRecommendationId(event.id);
            } catch { /* The visual handoff still works if memory storage is unavailable. */ }
          }).catch(()=>{ /* The handoff remains visually usable if assessment is unavailable. */ });
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
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ shirtId, pantId, occasion, climate, intention, style, styleSpec, bodyProfile, creative:activeCreative, creativeVisualReview }));
    } catch { /* Designer remains usable if browser storage is unavailable. */ }
  }, [draftReady, shirtId, pantId, occasion, climate, intention, style, styleSpec, bodyProfile, activeCreative, creativeVisualReview]);

  useEffect(()=>{
    if(!draftReady) return;
    setStyleSpec((current)=>mergeLegacyIntoStyleSpec(current,style));
  },[draftReady,style]);

  useEffect(()=>{
    if(!measurementProfile) return;
    setBodyProfile((current)=>current.source==="manual" ? current : bodyProfileFromMeasurements(measurementProfile,current));
  },[measurementProfile]);

  useEffect(() => {
    if(!draftReady) return;
    const creativeStillMatches=activeCreative &&
      activeCreative.recommendation.shirt.id===shirtId &&
      activeCreative.recommendation.pant.id===pantId &&
      activeCreative.recommendation.occasion===occasion;
    if(creativeStillMatches) return;
    setSearchResults([]);
    setBriefText("");
    setBriefResults([]);
    setBriefInterpretation(null);
    setBriefError("");
    setCreativeDirections([]);
    setActiveCreative(null);
    setCreativeVisualReview(null);
    setCreativeRenderRepair("");
    setCreativeAutoNote("");
  },[draftReady,shirtId,pantId,occasion,climate,intention]);

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

  async function requestLookAssessment(input:{
    shirtId:string;
    pantId:string;
    occasion:OccasionTier;
    style:DesignerStyle;
    context:DesignerContext;
    creative?:CreativeDirection|null;
    visualReview?:CreativeVisualCheck|null;
    measurements?:MeasurementProfile|null;
    observations?:TailorObservationProfile|null;
    styleSpec?:StyleSpecV2|null;
    bodyProfile?:BodyPreviewProfile|null;
  }) {
    const response=await fetch("/api/designer/assess",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        shirtId:input.shirtId,
        pantId:input.pantId,
        occasion:input.occasion,
        style:input.style,
        styleSpec:input.styleSpec===undefined?styleSpec:input.styleSpec,
        bodyProfile:input.bodyProfile===undefined?bodyProfile:input.bodyProfile,
        context:input.context,
        measurements:input.measurements===undefined?measurementProfile:input.measurements,
        observations:input.observations===undefined?tailorObservations:input.observations,
        creative:input.creative || undefined,
        creativeVisualReview:input.visualReview || undefined,
      }),
    });
    const data=await response.json() as {assessment?:DesignerAssessmentResponse;error?:string};
    if(!response.ok || !data.assessment) throw new Error(data.error || "Designer could not assess this look.");
    return data.assessment;
  }

  function applyServerAssessment(next:DesignerAssessmentResponse) {
    setAssessment(next);
    setRecommendation(next.recommendation);
    setAssessmentError("");
  }

  function resetDraft() {
    const nextOccasion = DESIGNER_REVIEWED_PAIRING.occasion;
    setShirtId(DESIGNER_REVIEWED_PAIRING.shirtId);
    setPantId(DESIGNER_REVIEWED_PAIRING.pantId);
    setOccasion(nextOccasion);
    setClimate("Not specified");
    setIntention("Balanced");
    const resetStyle=designerStyleForOccasion(nextOccasion);
    setStyle(resetStyle);
    setStyleSpec(fromLegacyStyle(resetStyle));
    setPreviewMode("photo");
    setBodyProfile(DEFAULT_BODY_PREVIEW_PROFILE);
    setRecommendation(null);
    setAssessment(null);
    setRecommendationId(null);
    setResponse(null);
    setFeedbackReason(null);
    setSearchResults([]);
    setBriefText("");
    setBriefResults([]);
    setBriefInterpretation(null);
    setBriefError("");
    setCreativeDirections([]);
    setActiveCreative(null);
    setCreativeAutoNote("");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  async function runDesignerBrief() {
    if(briefLoading || briefText.trim().length<5) return;
    setBriefLoading(true);
    setBriefError("");
    try {
      const response=await fetch("/api/designer/brief",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          brief:briefText,
          currentShirtId:shirt?.id,
          currentPantId:pant?.id,
          measurements:measurementProfile,
          observations:tailorObservations,
          tasteProfile:readLocalDesignerTasteProfile(),
        }),
      });
      const data=await response.json() as {interpretation?:DesignerBriefInterpretation;results?:DesignerBriefOption[];error?:string};
      if(!response.ok || !data.interpretation) throw new Error(data.error || "Designer could not build directions from that brief.");
      setBriefInterpretation(data.interpretation);
      setBriefResults(Array.isArray(data.results)?data.results:[]);
      try {
        recordStyleMemoryEvent(designerSession(),"designer_override",{
          briefLength:briefText.trim().length,
          occasion:data.interpretation.occasion,
          context:data.interpretation.context,
          interpretation:data.interpretation.notes,
          resultIds:(data.results || []).map((item)=>item.id),
        });
      } catch { /* Brief remains usable if memory storage is unavailable. */ }
    } catch(error) {
      setBriefResults([]);
      setBriefInterpretation(null);
      setBriefError(error instanceof Error ? error.message : "Designer could not build directions from that brief.");
    } finally {
      setBriefLoading(false);
    }
  }

    async function runAdvancedSearch() {
    if (!shirt || !pant || searchLoading) return;
    setSearchLoading(true);
    setSearchError("");
    try {
      const response=await fetch("/api/designer/search",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          shirtId:shirt.id,
          pantId:pant.id,
          occasion,
          style,
          context:{climate,intention},
          scope:searchScope,
          measurements:measurementProfile,
          observations:tailorObservations,
        }),
      });
      const data=await response.json() as {results?:DesignerSearchOption[];error?:string};
      if(!response.ok) throw new Error(data.error || "Designer could not prepare alternatives.");
      setSearchResults(Array.isArray(data.results)?data.results:[]);
    } catch(error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Designer could not prepare alternatives.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function requestCreativeDirections(limit:number,current?:CreativeDirection,reason?:CreativeFeedbackReason) {
    if(!shirt || !pant) return {concepts:[] as CreativeDirection[],redesign:null as CreativeDirection|null};
    const response=await fetch("/api/designer/creative-generate",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        mode:current && reason ? "redesign" : "generate",
        shirtId:shirt.id,
        pantId:pant.id,
        occasion,
        style,
        context:{climate,intention},
        limit,
        ...(current?{current}:{}),
        ...(reason?{reason}:{}),
      }),
    });
    const data=await response.json() as {concepts?:CreativeDirection[];redesign?:CreativeDirection|null;error?:string};
    if(!response.ok) throw new Error(data.error || "Creative Designer could not generate directions.");
    return {concepts:Array.isArray(data.concepts)?data.concepts:[],redesign:data.redesign || null};
  }

  async function runCreativeLab() {
    if (!shirt || !pant || creativeGenerating) return;
    setCreativeAutoRetryCount(0);
    setCreativeVisualReview(null);
    setCreativeAutoNote("");
    setCreativeGenerating(true);
    try {
      const {concepts}=await requestCreativeDirections(5);
      setCreativeDirections(concepts);
      setActiveCreative(null);
      if(!concepts.length) setCreativeAutoNote("No creative direction cleared the current fabric and occasion checks.");
    } catch(error) {
      setCreativeAutoNote(error instanceof Error ? error.message : "Creative Designer could not generate directions.");
    } finally {
      setCreativeGenerating(false);
    }
  }

  async function giveCreativeRenderFeedback(rating:"up"|"down"|"saved",creativeReason?:CreativeFeedbackReason,visualCheck?:CreativeVisualCheck) {
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
        ...(visualCheck?{creativeVisualCheck:visualCheck}:{}),
        note:"Visual review of the photoreal V5 concept render.",
      });
    } catch { /* Creative review remains optional if memory storage is unavailable. */ }

    if(rating==="down" && creativeReason) {
      const repair=[visualCheck?.semanticIssue,...(visualCheck?.notes || [])]
        .filter(Boolean)
        .filter((value,index,all)=>all.indexOf(value)===index)
        .slice(0,2)
        .join(" ")
        .slice(0,420);

      const executionFailure=Boolean(visualCheck && (
        creativeReason==="render_mismatch" ||
        visualCheck.boundaryIntegrity<68 ||
        visualCheck.protectedChange>38 ||
        /artifact|boundary|fabric|bleed|spill|mismatch|not visually distinct|under-express/i.test(repair)
      ));

      // First fix a rendering failure without throwing away a strong design.
      // Only change the concept when the failure is actually aesthetic/design-led
      // or when one targeted render repair already failed.
      if(visualCheck && executionFailure && creativeAutoRetryCount===0) {
        setCreativeRenderRepair(repair || "Render the selected hero detail more literally while preserving fabric fidelity, garment boundaries and the locked studio model.");
        setCreativeAutoNote("V5 found a rendering problem. It is repairing the same design once before changing the concept.");
        setCreativeAutoRetryCount(1);
        setCreativeAutoRenderNonce((nonce)=>nonce+1);
        return;
      }

      if(visualCheck && creativeAutoRetryCount>=2) {
        setCreativeAutoNote("The render still needs review. Automatic retries stopped to protect render credits.");
        return;
      }

      let candidates:CreativeDirection[]=[];
      let redesign:CreativeDirection|null=null;
      try {
        const generated=await requestCreativeDirections(12,activeCreative,creativeReason);
        candidates=generated.concepts;
        redesign=generated.redesign;
      } catch(error) {
        setCreativeAutoNote(error instanceof Error ? error.message : "V5 could not prepare a redesign.");
        return;
      }
      if(redesign) {
        setCreativeDirections([redesign,...candidates.filter((item)=>item.id!==redesign.id)].slice(0,5));
        setCreativeAutoNote(visualCheck
          ? "V5 changed the design direction after the visual critique and is checking one revised render."
          : "V5 revised the concept using your visual feedback.");
        setCreativeRenderRepair(visualCheck ? repair : "");
        useCreativeDirection(redesign,visualCheck?"automatic":"manual");
        if(visualCheck) {
          setCreativeAutoRetryCount((count)=>Math.min(2,count+1));
          setCreativeAutoRenderNonce((nonce)=>nonce+1);
        }
      }
    }
  }

  function useCreativeDirection(direction:CreativeDirection,origin:"manual"|"automatic"="manual") {
    setCreativeVisualReview(null);
    if(origin==="manual") {
      setCreativeAutoRetryCount(0);
      setCreativeRenderRepair("");
      setCreativeAutoNote("");
    }
    setStyle({...direction.baseStyle});
    setStyleSpec(fromLegacyStyle(direction.baseStyle));
    setRecommendation(direction.recommendation);
    setAssessment(null);
    setSearchResults([]);
    setActiveCreative(direction);
    setResponse(null);
    setFeedbackReason(null);
    setRecommendationId(null);

    void requestLookAssessment({
      shirtId:direction.recommendation.shirt.id,
      pantId:direction.recommendation.pant.id,
      occasion:direction.recommendation.occasion,
      style:direction.baseStyle,
      context:{climate,intention},
      creative:direction,
      visualReview:null,
    }).then((next)=>{
      applyServerAssessment(next);
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
            context:{climate,intention},
          },
          rules:next.recommendation.rules,
          confidenceScore:next.recommendation.confidenceScore,
          designFitScore:next.recommendation.designFitScore,
          materialEvidence:next.recommendation.materialEvidence,
          formality:next.recommendation.formality,
          output:direction.baseStyle,
          reasoningText:`${direction.thesis} Creative Lab V5 selected after server-side critique and refinement.`,
          status:next.recommendation.status,
          ruleSetVersion:next.recommendation.ruleSetVersion,
          garmentSpec:{
            version:next.garmentSpec.version,
            status:next.garmentSpec.status,
            creativeConceptId:next.garmentSpec.creative?.conceptId || "",
            creativeTreatmentCount:next.garmentSpec.creative?.treatments.length || 0,
            creativePatternId:next.garmentSpec.creative?.pattern?.id || "",
            readiness:next.garmentSpec.readiness,
          },
        });
        setRecommendationId(event.id);
      } catch { /* Creative concept remains usable if memory storage is unavailable. */ }
    }).catch((error)=>setAssessmentError(error instanceof Error?error.message:"Designer assessment is unavailable."));
  }

  function useSearchResult(result:DesignerSearchOption,source?:{occasion?:OccasionTier;context?:DesignerContext;name?:string}) {
    const nextOccasion=source?.occasion || result.recommendation.occasion;
    const nextContext=source?.context || {climate,intention};
    setActiveCreative(null);
    setCreativeVisualReview(null);
    setShirtId(result.shirt.id);
    setPantId(result.pant.id);
    setOccasion(nextOccasion);
    setClimate(nextContext.climate);
    setIntention(nextContext.intention);
    setStyle({...result.style});
    setStyleSpec(fromLegacyStyle(result.style));
    setRecommendation(result.recommendation);
    setAssessment(null);
    setSearchResults([]);
    setBriefResults([]);
    setResponse(null);
    setFeedbackReason(null);
    setRecommendationId(null);

    void requestLookAssessment({
      shirtId:result.shirt.id,pantId:result.pant.id,occasion:nextOccasion,
      style:result.style,context:nextContext,
    }).then((next)=>{
      applyServerAssessment(next);
      try {
        const event=recordStyleMemoryEvent(designerSession(),"designer_recommendation",{
          shirtId:result.shirt.id,pantId:result.pant.id,occasion:nextOccasion,style:result.style,
          input:{source:source?.name || "advanced_catalogue_search",tier:result.tier,scope:source?.name?"open":searchScope,context:nextContext,briefInterpreted:Boolean(source?.name)},
          rules:next.recommendation.rules,
          confidenceScore:next.recommendation.confidenceScore,
          designFitScore:next.recommendation.designFitScore,
          materialEvidence:next.recommendation.materialEvidence,
          formality:next.recommendation.formality,
          output:result.style,
          reasoningText:next.recommendation.internalReason,
          status:next.recommendation.status,
          ruleSetVersion:next.recommendation.ruleSetVersion,
          garmentSpec:{version:next.garmentSpec.version,status:next.garmentSpec.status,readiness:next.garmentSpec.readiness},
        });
        setRecommendationId(event.id);
      } catch { /* Search result remains usable when event storage is unavailable. */ }
    }).catch((error)=>setAssessmentError(error instanceof Error?error.message:"Designer assessment is unavailable."));
  }

  async function assess(nextStyle: DesignerStyle = style) {
    if (!shirt || !pant || assessmentLoading) return;
    setActiveCreative(null);
    setCreativeVisualReview(null);
    setStyle({ ...nextStyle });
    setAssessmentLoading(true);
    setAssessmentError("");
    setRecommendationId(null);
    setResponse(null);
    setFeedbackReason(null);
    const context:DesignerContext={climate,intention};
    try {
      const next=await requestLookAssessment({
        shirtId:shirt.id,pantId:pant.id,occasion,style:nextStyle,context,
      });
      applyServerAssessment(next);
      try {
        const event=recordStyleMemoryEvent(designerSession(),"designer_recommendation",{
          shirtId:shirt.id,pantId:pant.id,occasion,style:nextStyle,
          input:{shirtId:shirt.id,pantId:pant.id,occasion,style:nextStyle,context,measurementCoverage:fitCoverage,fitGuidance},
          rules:next.recommendation.rules,
          confidenceScore:next.recommendation.confidenceScore,
          designFitScore:next.recommendation.designFitScore,
          materialEvidence:next.recommendation.materialEvidence,
          formality:next.recommendation.formality,
          output:next.recommendation.style,
          reasoningText:next.recommendation.internalReason,
          status:next.recommendation.status,
          ruleSetVersion:next.recommendation.ruleSetVersion,
          garmentSpec:{
            version:next.garmentSpec.version,status:next.garmentSpec.status,
            fitConstructionScore:next.garmentSpec.decision.fitConstructionScore,
            brandLanguageScore:next.garmentSpec.decision.brandLanguageScore,
            blockStrategyScore:next.garmentSpec.decision.blockStrategyScore,
            readiness:next.garmentSpec.readiness,
          },
        });
        setRecommendationId(event.id);
      } catch { /* The direction still works when event storage is unavailable. */ }
    } catch(error) {
      setAssessment(null);
      setRecommendation(null);
      setAssessmentError(error instanceof Error?error.message:"Designer assessment is unavailable.");
    } finally {
      setAssessmentLoading(false);
    }
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
    setAssessment(null);
    setRecommendationId(null);
  }

  function applyStyleSpec(next:StyleSpecV2) {
    setActiveCreative(null);
    setStyleSpec(next);
    setStyle(toLegacyStyle(next));
    setRecommendation(null);
    setAssessment(null);
    setRecommendationId(null);
    setResponse(null);
    setFeedbackReason(null);
  }

  function applyStylePatch(patch: Partial<DesignerStyle>) {
    setActiveCreative(null);
    setStyle((current) => ({ ...current, ...patch }));
    setRecommendation(null);
    setAssessment(null);
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
    setStyleSpec(fromLegacyStyle(next));
    setRecommendation(null);
    setAssessment(null);
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
        <p className="newDesignerHeroLead">Describe the moment. Designer builds the outfit. Refine only what you want.</p>
        <div className="newDesignerHeroIndex"><span>1 · TELL DESIGNER</span><span>2 · REFINE</span><span>3 · PREVIEW</span></div>
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
        <section className="newDesignerBrief" aria-label="One-line Designer brief">
          <div className="newDesignerBriefHead">
            <div><span>00 / ASK DESIGNER</span><strong>Describe the look in one line.</strong><small>Designer will choose the cloth, cut and level of expression.</small></div>
            <button type="button" onClick={()=>void runDesignerBrief()} disabled={briefLoading || briefText.trim().length<5}>{briefLoading?"Designing…":"Create 3 directions ✦"}</button>
          </div>
          <textarea value={briefText} onChange={(event)=>{setBriefText(event.target.value.slice(0,500));setBriefError("");}} placeholder="e.g. Business meeting in Mumbai, premium but not boring, tucked shirt" rows={2} />
          {briefInterpretation && <div className="newDesignerBriefRead"><span>DESIGNER READ</span>{briefInterpretation.notes.map((note)=><b key={note}>{note}</b>)}</div>}
          {briefError && <span className="newDesignerSearchError">{briefError}</span>}
          {briefResults.length>0 && <div className="newDesignerBriefResults">
            {briefResults.map((result)=><article key={result.id}>
              <div className="newDesignerBriefModel">
                <StyleDirectorRealModelPreview shirt={result.shirt} pant={result.pant} style={result.style} />
                <span>SAME LINEN EARTH MODEL</span>
              </div>
              <div className="newDesignerBriefPair" aria-label="Selected fabric references">
                <img src={result.shirt.image} alt={`${result.shirt.name} shirt fabric`} loading="lazy" decoding="async" />
                <img src={result.pant.image} alt={`${result.pant.name} trouser fabric`} loading="lazy" decoding="async" />
              </div>
              <div className="newDesignerBriefCopy">
                <span>0{result.rank} · {result.tier.toUpperCase()}</span>
                <strong>{result.title}</strong>
                <p>{result.shirt.name} + {result.pant.name}</p>
                <div className="newDesignerBriefCut">
                  <b>{result.style.shirtWear}</b><b>{result.style.collar}</b><b>{result.style.trouser}</b>
                </div>
                {result.fitAdaptation && <em className="newDesignerBriefFit">FIT-AWARE · {result.fitAdaptation.replace(/^Fit-aware adjustment:\s*/,"")}</em>}
                <small>{result.reasons.find((reason)=>reason.startsWith("Occasion match:")) || result.reasons.find((reason)=>reason.startsWith("Brief match:")) || result.reasons[0] || "Built from current Linen Earth stock."}</small>
              </div>
              <button type="button" onClick={()=>{
                if(!briefInterpretation) return;
                useSearchResult(result,{occasion:briefInterpretation.occasion,context:briefInterpretation.context,name:"one_line_designer_brief"});
                setBriefResults([]);
              }}>Use direction</button>
            </article>)}
          </div>}
        </section>

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
            <div className="newDesignerFabricChoices" aria-label="Browse shirt fabrics">
              {visibleShirts.map((fabric)=><button key={fabric.id} type="button" className={fabric.id===shirtId?"selected":""} aria-pressed={fabric.id===shirtId} onClick={()=>{setShirtId(fabric.id);setRecommendation(null);setRecommendationId(null);}}>
                <img src={fabric.image} alt={`${fabric.name} shirt fabric`} loading="lazy" decoding="async" />
                <span>{fabric.name}</span>
              </button>)}
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
            <div className="newDesignerFabricChoices" aria-label="Browse trouser fabrics">
              {visiblePants.map((fabric)=><button key={fabric.id} type="button" className={fabric.id===pantId?"selected":""} aria-pressed={fabric.id===pantId} onClick={()=>{setPantId(fabric.id);setRecommendation(null);setRecommendationId(null);}}>
                <img src={fabric.image} alt={`${fabric.name} trouser fabric`} loading="lazy" decoding="async" />
                <span>{fabric.name}</span>
              </button>)}
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
            {fitConstruction && <p><b>Fit read:</b> Tailoring checks are active for this cut.</p>}
            {blockStrategy && <p><b>Starting block:</b> {blockStrategy.shirtBlock.replaceAll("-"," ")} + {blockStrategy.trouserBlock.replaceAll("-"," ")}</p>}
          </details>}
        </section>

        <details className="newDesignerSearch newDesignerSimplePanel newDesignerOptionalSearch" aria-label="Designer catalogue search">
          <summary><span>OPTIONAL</span><strong>Try a different fabric pairing</strong><b>+</b></summary>
          <div className="newDesignerOptionalSearchBody">
            <div className="newDesignerSearchScopes" role="group" aria-label="Designer search scope">
              <button type="button" aria-pressed={searchScope==="keep_shirt"} onClick={()=>{setSearchScope("keep_shirt");setSearchResults([]);}}>Keep shirt</button>
              <button type="button" aria-pressed={searchScope==="keep_trouser"} onClick={()=>{setSearchScope("keep_trouser");setSearchResults([]);}}>Keep trouser</button>
              <button type="button" aria-pressed={searchScope==="open"} onClick={()=>{setSearchScope("open");setSearchResults([]);}}>Change both</button>
            </div>
            <button className="newDesignerOptionalSearchRun" type="button" onClick={()=>void runAdvancedSearch()} disabled={!shirt || !pant || searchLoading}>{searchLoading?"Finding…":"Show 3 options"}</button>
            {searchError && <span className="newDesignerSearchError">{searchError}</span>}
            {searchResults.length>0 && <div className="newDesignerQuickResults">
              {searchResults.slice(0,3).map((result)=><article key={result.id}>
                <div className="newDesignerQuickFabricPair">
                  <img src={result.shirt.image} alt="" loading="lazy" decoding="async" />
                  <img src={result.pant.image} alt="" loading="lazy" decoding="async" />
                </div>
                <div className="newDesignerQuickResultCopy">
                  <span>{result.tier}</span>
                  <strong>{result.shirt.name} + {result.pant.name}</strong>
                </div>
                <button type="button" onClick={()=>useSearchResult(result)}>Use look</button>
              </article>)}
            </div>}
          </div>
        </details>

        <section id="designerCreativeLab" className="newDesignerCreative newDesignerVisualLab" aria-label="Creative Designer Lab V5">
          <div className="newDesignerSimpleHead">
            <div>
              <span>03 / CREATE</span>
              <strong>Imagine new designs.</strong>
              <small>Fashion research runs quietly in the background.</small>
            </div>
            <button type="button" onClick={()=>void runCreativeLab()} disabled={!shirt || !pant || creativeGenerating}>{creativeGenerating?"Creating…":"Create ideas ✦"}</button>
          </div>
          {creativeAutoNote && <div className="newDesignerAutoRevision"><span>V5 REDESIGN</span><strong>{creativeAutoNote}</strong></div>}
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
              <button className="newDesignerCreativeUse" type="button" onClick={()=>{setCreativeAutoNote("");useCreativeDirection(direction);}}>{activeCreative?.id===direction.id?"Selected":"Try this"}</button>
              <details className="newDesignerTechnicalDrawer">
                <summary>Design reasoning</summary>
                <p>{direction.thesis}</p>
                <div className="newDesignerMiniScores">
                  <span>Visual balance checked</span><span>Originality checked</span><span>Construction checked</span>
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
      {shirt && pant && <div className="newDesignerRenderMode" role="group" aria-label="Preview mode">
        <button type="button" aria-pressed={previewMode==="photo"} onClick={()=>setPreviewMode("photo")}>Studio preview</button>
        <button type="button" aria-pressed={previewMode==="construction"} onClick={()=>setPreviewMode("construction")}>Live cut study</button>
      </div>}
      {shirt && pant && previewMode==="photo" && <PhotoOutfitPreview
        shirt={shirt}
        pant={pant}
        style={style}
        styleSpec={styleSpec}
        bodyProfile={bodyProfile}
        creativeDirection={activeCreative}
        onCreativeFeedback={giveCreativeRenderFeedback}
        autoRenderNonce={creativeAutoRenderNonce}
        renderRepairInstruction={creativeRenderRepair}
        onCreativeRenderStart={()=>{setCreativeAutoRetryCount(0);setCreativeRenderRepair("");setCreativeAutoNote("");}}
        onCreativeInspection={(check)=>{
          setCreativeVisualReview(check);
          if(!check.evidenceAvailable || !activeCreative) return;
          const severeHeuristicFailure=
            check.heroVisibility<24 ||
            check.boundaryIntegrity<55 ||
            check.protectedChange>50;
          const reliableReview=
            check.status==="review" &&
            (check.semanticAvailable ? check.semanticStatus==="review" : severeHeuristicFailure);
          if(reliableReview) {
            giveCreativeRenderFeedback("down",check.redesignReason || "render_mismatch",check);
          } else {
            giveCreativeRenderFeedback("saved",undefined,check);
            if(check.status==="review" && !check.semanticAvailable) {
              setCreativeAutoNote("Render QA found a possible issue, but evidence was not strong enough to spend another render automatically.");
            }
          }
        }}
      />}
      {shirt && pant && previewMode==="construction" && <LiveConstructionPreview
        shirt={shirt}
        pant={pant}
        style={style}
        spec={styleSpec}
        onSpecChange={applyStyleSpec}
        bodyProfile={bodyProfile}
        onBodyProfileChange={setBodyProfile}
        occasion={occasion}
        climate={climate}
      />}
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
            <p><b>Material:</b> {recommendation.materialEvidence.verified>0?"Verified fabric information is included.":"Physical fabric verification is still needed."}</p>
            {fitConstruction && <p><b>Fit/construction:</b> Tailoring checks are active.</p>}
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
