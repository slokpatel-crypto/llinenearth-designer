import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { verifyMemorySessionToken } from "@/lib/memory-session";
import { CREATIVE_FEEDBACK_REASONS } from "@/lib/designer/creative-learning";
import { legacyMemoryHeader } from "@/lib/runtime-compat";
import { normalizeFabricPhysicalEvidenceProvenance } from "@/lib/fabric-physical-provenance";

const PUBLIC_TYPES = new Set([
  "session_started",
  "answer_selected",
  "looks_generated",
  "look_selected",
  "render_requested",
  "render_completed",
  "designer_recommendation",
  "designer_preview_opened",
  "designer_feedback",
  "designer_override",
  "design_locked",
  "whatsapp_clicked",
]);

const OPERATOR_TYPES = new Set([
  "visit_logged",
  "sale_logged",
  "operator_note",
]);

type IncomingEvent = {
  id?: string;
  sessionId?: string;
  type?: string;
  at?: string;
  source?: string;
  payload?: Record<string,unknown>;
};

const registry = (globalThis as typeof globalThis & {
  __linenMemoryRate?: Map<string,{at:number;count:number}>
}).__linenMemoryRate ||= new Map<string,{at:number;count:number}>();

function rateLimit(request:Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = registry.get(ip);
  if (!current || now-current.at > 60_000) {
    registry.set(ip,{at:now,count:1});
    return false;
  }
  current.count += 1;
  return current.count > 90;
}

const ANSWER_STEPS = new Set(["occasion","mood","time","climate","garment","colorDirection"]);
const RENDER_MODES = new Set(["preview","photo"]);
const DESIGNER_FEEDBACK_REASONS = new Set(["color","too_bold","too_safe","fit_cut","trouser_shape","formality","fabric","construction","other"]);
const CREATIVE_FEEDBACK_REASON_IDS = new Set(CREATIVE_FEEDBACK_REASONS.map(([id])=>id));

function text(value:unknown,max=160) {
  return String(value ?? "").trim().slice(0,max);
}

function cleanPayload(type:string, input:unknown) {
  const payload = input && typeof input === "object" ? input as Record<string,unknown> : {};

  if (type === "designer_recommendation") {
    const shirtId = text(payload.shirtId,120);
    const pantId = text(payload.pantId,120);
    const occasion = text(payload.occasion,40);
    const style = payload.style && typeof payload.style === "object" && !Array.isArray(payload.style) ? payload.style : {};
    if (!shirtId || !pantId || !["Casual","Smart-Casual","Semi-Formal","Formal"].includes(occasion)) return null;
    const garmentSpecInput = payload.garmentSpec && typeof payload.garmentSpec === "object" && !Array.isArray(payload.garmentSpec)
      ? payload.garmentSpec as Record<string,unknown> : {};
    const readinessInput = garmentSpecInput.readiness && typeof garmentSpecInput.readiness === "object" && !Array.isArray(garmentSpecInput.readiness)
      ? garmentSpecInput.readiness as Record<string,unknown> : {};
    const garmentSpec = {
      version:text(garmentSpecInput.version,80),
      status:text(garmentSpecInput.status,40),
      fitConstructionScore:Number(garmentSpecInput.fitConstructionScore || 0),
      brandLanguageScore:Number(garmentSpecInput.brandLanguageScore || 0),
      creativeConceptId:text(garmentSpecInput.creativeConceptId,180),
      creativeTreatmentCount:Math.max(0,Math.min(12,Math.round(Number(garmentSpecInput.creativeTreatmentCount)||0))),
      creativePatternId:text(garmentSpecInput.creativePatternId,140),
      readiness:{
        visualization:text(readinessInput.visualization,60),
        tailoring:text(readinessInput.tailoring,60),
        materialVerification:text(readinessInput.materialVerification,60),
      },
    };
    return {
      shirtId, pantId, occasion, style,
      confidenceScore: Number(payload.confidenceScore || 0),
      designFitScore: Number(payload.designFitScore || 0),
      status: text(payload.status,40),
      ruleSetVersion: text(payload.ruleSetVersion,100),
      reasoningText: text(payload.reasoningText,1200),
      ...(garmentSpec.version ? { garmentSpec } : {}),
    };
  }

  if (type === "designer_preview_opened") {
    const recommendationId = text(payload.recommendationId,160);
    const shirtId = text(payload.shirtId,120);
    const pantId = text(payload.pantId,120);
    const occasion = text(payload.occasion,40);
    if (!recommendationId || !shirtId || !pantId || !occasion) return null;
    return { recommendationId, shirtId, pantId, occasion, kind:"photographic_model_preview" };
  }

  if (type === "designer_feedback") {
    const recommendationId = text(payload.recommendationId,160);
    const rating = text(payload.rating,20);
    const reason = text(payload.reason,40);
    const styleInput = payload.style && typeof payload.style === "object" && !Array.isArray(payload.style)
      ? payload.style as Record<string,unknown> : {};
    const style = Object.fromEntries(Object.entries(styleInput).slice(0,16).map(([key,value])=>[text(key,40),text(value,100)]));
    const creativeConceptId=text(payload.creativeConceptId,180);
    const creativeFamilyId=text(payload.creativeFamilyId,120);
    const creativeConceptName=text(payload.creativeConceptName,140);
    const creativePatternId=text(payload.creativePatternId,140);
    const creativeReason=text(payload.creativeReason,40);
    const creativeMoveIds=Array.isArray(payload.creativeMoveIds)
      ? payload.creativeMoveIds.map((item)=>text(item,120)).filter(Boolean).slice(0,8)
      : [];
    if (!recommendationId || !["up","down","saved"].includes(rating)) return null;
    if (reason && !DESIGNER_FEEDBACK_REASONS.has(reason)) return null;
    if (creativeReason && !CREATIVE_FEEDBACK_REASON_IDS.has(creativeReason as never)) return null;
    return {
      recommendationId, rating,
      ...(reason ? { reason } : {}),
      shirtId:text(payload.shirtId,120),
      pantId:text(payload.pantId,120),
      occasion:text(payload.occasion,40),
      style,
      ...(creativeConceptId ? {
        creativeConceptId,
        creativeFamilyId,
        creativeConceptName,
        creativePatternId,
        creativeMoveIds,
        creativeReason,
        creativeRendered:Boolean(payload.creativeRendered),
        ...(payload.creativeVisualCheck && typeof payload.creativeVisualCheck==="object" && !Array.isArray(payload.creativeVisualCheck) ? {
          creativeVisualCheck:{
            status:text((payload.creativeVisualCheck as Record<string,unknown>).status,20)==="pass"?"pass":"review",
            heroVisibility:Math.max(0,Math.min(100,Math.round(Number((payload.creativeVisualCheck as Record<string,unknown>).heroVisibility)||0))),
            boundaryIntegrity:Math.max(0,Math.min(100,Math.round(Number((payload.creativeVisualCheck as Record<string,unknown>).boundaryIntegrity)||0))),
            protectedChange:Math.max(0,Math.min(100,Math.round(Number((payload.creativeVisualCheck as Record<string,unknown>).protectedChange)||0))),
            evidenceAvailable:Boolean((payload.creativeVisualCheck as Record<string,unknown>).evidenceAvailable),
            semanticAvailable:Boolean((payload.creativeVisualCheck as Record<string,unknown>).semanticAvailable),
            semanticStatus:text((payload.creativeVisualCheck as Record<string,unknown>).semanticStatus,20),
            semanticIssue:text((payload.creativeVisualCheck as Record<string,unknown>).semanticIssue,160),
            redesignReason:text((payload.creativeVisualCheck as Record<string,unknown>).redesignReason,40),
            improvement:["improved","same","worse","not_applicable"].includes(text((payload.creativeVisualCheck as Record<string,unknown>).improvement,20))
              ? text((payload.creativeVisualCheck as Record<string,unknown>).improvement,20)
              : "not_applicable",
          }
        } : {}),
      } : {}),
      note:text(payload.note,300),
    };
  }

  if (type === "designer_override") {
    const recommendationId = text(payload.recommendationId,160);
    const reason = text(payload.reason,1000);
    if (!recommendationId || reason.length < 4) return null;
    return { recommendationId, reason };
  }

  if (type === "sale_logged") {
    const amount = Number(payload.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null;
    return { amount, currency: "INR" };
  }

  if (type === "visit_logged") {
    return { status: "visited" };
  }

  if (type === "operator_note") {
    const subtype = text(payload.subtype,80);
    if (subtype === "designer_fit_outcome") {
      const recommendationId = text(payload.recommendationId,160);
      const verdict = text(payload.verdict,40);
      const occasion = text(payload.occasion,40);
      const shirtFit = text(payload.shirtFit,120);
      const trouser = text(payload.trouser,120);
      const torso = text(payload.torso,30);
      const seat = text(payload.seat,30);
      const allowedAreas = new Set(["shirt_chest","shirt_waist","shirt_shoulder","shirt_sleeve","shirt_collar","trouser_waist","trouser_seat","trouser_thigh","trouser_rise","trouser_length"]);
      const areas = Array.isArray(payload.areas)
        ? payload.areas.map((item)=>text(item,40)).filter((item)=>allowedAreas.has(item)).slice(0,10)
        : [];
      if (!recommendationId || !shirtFit || !trouser) return null;
      if (!["clean_first_fit","minor_alteration","major_alteration"].includes(verdict)) return null;
      if (!["Casual","Smart-Casual","Semi-Formal","Formal"].includes(occasion)) return null;
      if (!["tapered","balanced","straight","unknown"].includes(torso)) return null;
      if (!["pronounced","balanced","unknown"].includes(seat)) return null;
      return {
        subtype,recommendationId,verdict,occasion,shirtFit,trouser,torso,seat,areas,
        note:text(payload.note,500),
      };
    }

    if (subtype === "designer_case_review") {
      const recommendationId = text(payload.recommendationId,160);
      const verdict = text(payload.verdict,20);
      const shirtId = text(payload.shirtId,140);
      const pantId = text(payload.pantId,140);
      const occasion = text(payload.occasion,40);
      const reason = text(payload.reason,80);
      const styleInput = payload.style && typeof payload.style === "object" && !Array.isArray(payload.style)
        ? payload.style as Record<string,unknown> : {};
      const allowedStyleKeys = ["shirtFit","shirtWear","collar","trouser","rise","waistband","break"];
      const style = Object.fromEntries(allowedStyleKeys
        .map((key)=>[key,text(styleInput[key],120)] as const)
        .filter(([,value])=>Boolean(value)));
      if (!recommendationId || !shirtId || !pantId) return null;
      if (!["approved","rejected"].includes(verdict)) return null;
      if (!["Casual","Smart-Casual","Semi-Formal","Formal"].includes(occasion)) return null;
      return {
        subtype,recommendationId,verdict,shirtId,pantId,occasion,style,
        reason:["color","too_bold","too_safe","fit_cut","trouser_shape","formality","fabric","construction","material_unknown","other"].includes(reason) ? reason : "other",
        note:text(payload.note,500),
      };
    }

    if (subtype === "fabric_ground_truth_label") {
      const version=text(payload.version,80);
      const fabricId=text(payload.fabricId,160);
      const profileId=text(payload.profileId,160);
      const analyzerVersion=text(payload.analyzerVersion,80);
      const originalInput=payload.original && typeof payload.original==="object" && !Array.isArray(payload.original) ? payload.original as Record<string,unknown> : null;
      const finalInput=payload.final && typeof payload.final==="object" && !Array.isArray(payload.final) ? payload.final as Record<string,unknown> : null;
      if(version!=="fabric-ground-truth-v1" || !fabricId || !profileId || !originalInput || !finalInput) return null;
      const fields=["colorFamily","patternFamily","patternScale","patternDensity","orientation","sheen","visualWeight","formality","statementLevel"];
      const original=Object.fromEntries(fields.map((field)=>[field,text(originalInput[field],80)]));
      const final=Object.fromEntries(fields.map((field)=>[field,text(finalInput[field],80)]));
      return {subtype,version,fabricId,profileId,analyzerVersion,original,final,note:text(payload.note,600)};
    }
    if (subtype === "measurement_calibration_case") {
      const version=text(payload.version,80);
      const caseId=text(payload.caseId,80);
      const selfChest=Number(payload.selfChestCm);
      const tailorChest=Number(payload.tailorChestCm);
      const selfSleeve=Number(payload.selfSleeveCm);
      const tailorSleeve=Number(payload.tailorSleeveCm);
      if(version!=="measurement-calibration-v1" || !caseId) return null;
      if(![selfChest,tailorChest].every((value)=>Number.isFinite(value)&&value>=50&&value<=200)) return null;
      if(![selfSleeve,tailorSleeve].every((value)=>Number.isFinite(value)&&value>=30&&value<=100)) return null;
      return {
        subtype,
        version,
        caseId,
        selfChestCm:Math.round(selfChest*10)/10,
        tailorChestCm:Math.round(tailorChest*10)/10,
        selfSleeveCm:Math.round(selfSleeve*10)/10,
        tailorSleeveCm:Math.round(tailorSleeve*10)/10,
        note:text(payload.note,500),
      };
    }

    if (subtype === "production_usage_case") {
      const version=text(payload.version,80);
      const caseId=text(payload.caseId,80);
      const revisionId=text(payload.revisionId,180);
      const garment=text(payload.garment,20);
      const fabricId=text(payload.fabricId,160);
      const fabricWidthCm=Number(payload.fabricWidthCm);
      const actualMetres=Number(payload.actualMetres);
      const patternRepeatMm=Number(payload.patternRepeatMm);
      const patternMatching=payload.patternMatching===true;
      const checkedBy=text(payload.checkedBy,120);
      const evidenceReference=text(payload.evidenceReference,240);
      if(!["production-usage-v1","production-usage-v2"].includes(version) || !caseId || !revisionId || !fabricId || !["shirt","trouser"].includes(garment)) return null;
      if(!Number.isFinite(fabricWidthCm)||fabricWidthCm<60||fabricWidthCm>220) return null;
      if(!Number.isFinite(actualMetres)||actualMetres<=0||actualMetres>12) return null;
      if(version==="production-usage-v2"&&(checkedBy.length<2||evidenceReference.length<3)) return null;
      return {
        subtype,version,caseId,revisionId,garment,fabricId,
        fabricWidthCm:Math.round(fabricWidthCm*10)/10,
        actualMetres:Math.round(actualMetres*100)/100,
        patternRepeatMm:Number.isFinite(patternRepeatMm)&&patternRepeatMm>0&&patternRepeatMm<=1000?Math.round(patternRepeatMm*10)/10:null,
        patternMatching,
        cutContext:text(payload.cutContext,160),
        ...(version==="production-usage-v2"?{checkedBy,evidenceReference}:{}),
        note:text(payload.note,600),
      };
    }

    if (subtype === "roadmap_phase1_proof") {
      const version=text(payload.version,80);
      const status=text(payload.status,20);
      const fabricId=text(payload.fabricId,160);
      const fabricName=text(payload.fabricName,160);
      const pattern=text(payload.pattern,120);
      const repeatMmRaw=Number(payload.repeatMm);
      const measuredPreviewRepeatPxRaw=Number(payload.measuredPreviewRepeatPx);
      const scaleErrorRaw=Number(payload.scaleErrorPct);
      const realP95Raw=Number(payload.realModelP95Ms);
      const ratings=Array.isArray(payload.realismRatings)
        ? payload.realismRatings.map((item)=>Math.round(Number(item))).filter((item)=>item>=1&&item<=5).slice(0,30)
        : [];
      if(!["linen-earth-phase1-proof-v1","linen-earth-phase1-proof-v2","linen-earth-phase1-proof-v3","linen-earth-phase1-proof-v4"].includes(version) || !fabricId || !["accepted","review"].includes(status)) return null;

      const base={
        subtype,
        version,
        status,
        fabricId,
        fabricName,
        pattern,
        repeatMm:Number.isFinite(repeatMmRaw)&&repeatMmRaw>0&&repeatMmRaw<=1000?Math.round(repeatMmRaw*100)/100:null,
        measuredPreviewRepeatPx:Number.isFinite(measuredPreviewRepeatPxRaw)&&measuredPreviewRepeatPxRaw>0?Math.round(measuredPreviewRepeatPxRaw*100)/100:null,
        scaleErrorPct:Number.isFinite(scaleErrorRaw)&&scaleErrorRaw>=0?Math.round(scaleErrorRaw*100)/100:null,
        scaleGatePass:payload.scaleGatePass===true,
        realModelSamples:Math.max(0,Math.min(500,Math.floor(Number(payload.realModelSamples)||0))),
        realModelP95Ms:Number.isFinite(realP95Raw)&&realP95Raw>=0?Math.round(realP95Raw*10)/10:null,
        realismRatings:ratings,
        strongRatings:Math.max(0,Math.min(30,Math.floor(Number(payload.strongRatings)||0))),
        realismPass:payload.realismPass===true,
        note:text(payload.note,700),
      };
      if(version==="linen-earth-phase1-proof-v1") return base;

      const photoReferenceMm=Number(payload.photoReferenceMm);
      const photoReferencePx=Number(payload.photoReferencePx);
      const photoPxPerMm=Number(payload.photoPxPerMm);
      const scaleCoordinateSystem=text(payload.scaleCoordinateSystem,80);
      const assessments=Array.isArray(payload.realismAssessments)
        ? payload.realismAssessments.slice(0,50).flatMap((item)=>{
          if(!item||typeof item!=="object"||Array.isArray(item)) return [];
          const row=item as Record<string,unknown>;
          const viewerId=text(row.viewerId,80);
          const rating=Math.round(Number(row.rating));
          const recordedAt=text(row.recordedAt,80);
          if(viewerId.length<2 || rating<1 || rating>5) return [];
          return [{viewerId,rating,recordedAt}];
        })
        : [];
      const boundarySource=payload.boundaryChecks&&typeof payload.boundaryChecks==="object"&&!Array.isArray(payload.boundaryChecks)
        ? payload.boundaryChecks as Record<string,unknown>
        : {};
      const boundaryChecks={
        neck:boundarySource.neck===true,
        cuffs:boundarySource.cuffs===true,
        waist:boundarySource.waist===true,
        trouserGap:boundarySource.trouserGap===true,
      };
      const realModelSampleDurationsMs=version==="linen-earth-phase1-proof-v4"&&Array.isArray(payload.realModelSampleDurationsMs)
        ? payload.realModelSampleDurationsMs.map(Number).filter((value)=>Number.isFinite(value)&&value>=0&&value<=10000).slice(-120).map((value)=>Math.round(value*10)/10)
        : [];
      return {
        ...base,
        photoReferenceMm:Number.isFinite(photoReferenceMm)&&photoReferenceMm>0&&photoReferenceMm<=3000?Math.round(photoReferenceMm*100)/100:null,
        photoReferencePx:Number.isFinite(photoReferencePx)&&photoReferencePx>0&&photoReferencePx<=10000?Math.round(photoReferencePx*100)/100:null,
        photoPxPerMm:Number.isFinite(photoPxPerMm)&&photoPxPerMm>0&&photoPxPerMm<=100?Math.round(photoPxPerMm*10000)/10000:null,
        scaleCoordinateSystem:scaleCoordinateSystem==="photo-1024x1536-fixture"?scaleCoordinateSystem:"",
        physicalEvidenceNote:text(payload.physicalEvidenceNote,700),
        realismAssessments:assessments,
        uniqueRealismViewers:Math.max(0,Math.min(50,Math.floor(Number(payload.uniqueRealismViewers)||0))),
        ...(["linen-earth-phase1-proof-v3","linen-earth-phase1-proof-v4"].includes(version)?{
          boundaryChecks,
          boundaryReady:boundaryChecks.neck&&boundaryChecks.cuffs&&boundaryChecks.waist&&boundaryChecks.trouserGap,
        }:{}),
        ...(version==="linen-earth-phase1-proof-v4"?{realModelSampleDurationsMs}:{}),
      };
    }

    if (subtype === "garment_viewer_readiness") {
      const version=text(payload.version,80);
      const status=text(payload.status,20);
      const modelId=text(payload.modelId,100);
      const modelSha256=text(payload.modelSha256,64).toLowerCase();
      const manifestSha256=text(payload.manifestSha256,64).toLowerCase();
      if(version!=="linen-earth-garment-viewer-readiness-v1" || !["accepted","review"].includes(status)) return null;
      if(!/^LE-[A-Z0-9-]{2,90}$/.test(modelId) || !/^[a-f0-9]{64}$/.test(modelSha256) || !/^[a-f0-9]{64}$/.test(manifestSha256)) return null;
      const patternScaleSamples=Array.isArray(payload.patternScaleSamples)
        ? payload.patternScaleSamples.slice(-20).flatMap((item)=>{
          if(!item||typeof item!=="object"||Array.isArray(item)) return [];
          const row=item as Record<string,unknown>;
          const fabricId=text(row.fabricId,160);
          const pattern=text(row.pattern,20);
          const errorPct=Number(row.errorPct);
          if(!fabricId || !["stripe","check","other"].includes(pattern) || !Number.isFinite(errorPct) || errorPct<0 || errorPct>100) return [];
          return [{fabricId,pattern,errorPct:Math.round(errorPct*100)/100,verified:row.verified===true}];
        })
        : [];
      const interactionLatencyMs=Array.isArray(payload.interactionLatencyMs)
        ? payload.interactionLatencyMs.map(Number).filter((value)=>Number.isFinite(value)&&value>=0&&value<=10000).slice(-120).map((value)=>Math.round(value*10)/10)
        : [];
      const realismAssessments=Array.isArray(payload.realismAssessments)
        ? payload.realismAssessments.slice(-50).flatMap((item)=>{
          if(!item||typeof item!=="object"||Array.isArray(item)) return [];
          const row=item as Record<string,unknown>;
          const viewerId=text(row.viewerId,80).toLowerCase();
          const rating=Math.round(Number(row.rating));
          if(viewerId.length<2 || rating<1 || rating>5) return [];
          return [{viewerId,rating,recordedAt:text(row.recordedAt,80)}];
        })
        : [];
      const boundarySource=payload.boundaryChecks&&typeof payload.boundaryChecks==="object"&&!Array.isArray(payload.boundaryChecks)
        ? payload.boundaryChecks as Record<string,unknown>
        : {};
      const boundaryChecks={
        neck:boundarySource.neck===true,
        cuffs:boundarySource.cuffs===true,
        waist:boundarySource.waist===true,
        trouserGap:boundarySource.trouserGap===true,
      };
      return {
        subtype,version,status,modelId,modelSha256,manifestSha256,patternScaleSamples,interactionLatencyMs,realismAssessments,boundaryChecks,
        note:text(payload.note,700),
      };
    }

    if (subtype === "designer_device_qa") {
      const deviceClass=text(payload.deviceClass,20);
      const status=text(payload.status,20);
      const viewport=text(payload.viewport,40);
      const requestedVersion=text(payload.version,80);
      const version=requestedVersion==="designer-device-qa-v2" ? requestedVersion : "designer-device-qa-v1";
      const checks=payload.checks && typeof payload.checks==="object" && !Array.isArray(payload.checks)
        ? Object.fromEntries(Object.entries(payload.checks as Record<string,unknown>)
          .slice(0,12)
          .map(([key,value])=>[text(key,80),value===true]))
        : {};
      if(!["mobile","tablet","desktop"].includes(deviceClass) || !["accepted","review"].includes(status) || !viewport) return null;
      const sampleDurationsMs=version==="designer-device-qa-v2" && Array.isArray(payload.sampleDurationsMs)
        ? payload.sampleDurationsMs.map(Number).filter((value)=>Number.isFinite(value)&&value>=0&&value<=10000).slice(-120).map((value)=>Math.round(value*10)/10)
        : [];
      return {
        subtype,
        version,
        deviceClass,
        status,
        viewport,
        dpr:Math.max(.5,Math.min(8,Number(payload.dpr)||1)),
        samples:Math.max(0,Math.min(500,Math.floor(Number(payload.samples)||0))),
        ...(version==="designer-device-qa-v2"?{sampleDurationsMs}:{}),
        medianMs:Number.isFinite(Number(payload.medianMs))?Math.max(0,Math.min(10000,Number(payload.medianMs))):null,
        p95Ms:Number.isFinite(Number(payload.p95Ms))?Math.max(0,Math.min(10000,Number(payload.p95Ms))):null,
        maxMs:Number.isFinite(Number(payload.maxMs))?Math.max(0,Math.min(10000,Number(payload.maxMs))):null,
        withinTarget:payload.withinTarget===true,
        hardwareConcurrency:Math.max(0,Math.min(256,Math.floor(Number(payload.hardwareConcurrency)||0))),
        userAgent:text(payload.userAgent,400),
        checks,
        note:text(payload.note,600),
      };
    }

    if (subtype === "designer_option_review") {
      const optionId=text(payload.optionId,140);
      const status=text(payload.status,20);
      if(!optionId || !["approved","rejected"].includes(status)) return null;
      return {
        subtype,
        version:"designer-option-review-v1",
        optionId,
        status,
        note:text(payload.note,600),
      };
    }

    if (subtype === "designer_benchmark_label") {
      const version=text(payload.version,80);
      const caseId=text(payload.caseId,80);
      const choice=text(payload.choice,20);
      const reason=text(payload.reason,80);
      const occasion=text(payload.occasion,40);
      const climate=text(payload.climate,40);
      const intention=text(payload.intention,40);
      const anchorShirtId=text(payload.anchorShirtId,140);
      const anchorPantId=text(payload.anchorPantId,140);
      const candidates=Array.isArray(payload.candidates)
        ? payload.candidates.slice(0,3).map((raw)=>{
          const item=raw && typeof raw==="object" ? raw as Record<string,unknown> : {};
          return {
            id:text(item.id,180),
            tier:text(item.tier,30),
            shirtId:text(item.shirtId,140),
            pantId:text(item.pantId,140),
          };
        }).filter((item)=>item.id&&item.shirtId&&item.pantId)
        : [];
      if(version!=="designer-benchmark-v1" || !caseId || !["0","1","2","none"].includes(choice)) return null;
      if(!["Casual","Smart-Casual","Semi-Formal","Formal"].includes(occasion)) return null;
      if(!["Not specified","Hot / humid","Cool","Air-conditioned"].includes(climate)) return null;
      if(!["Understated","Balanced","Expressive"].includes(intention)) return null;
      if(!anchorShirtId || !anchorPantId || candidates.length<1) return null;
      return {
        subtype,version,caseId,choice,
        reason:["best_balance","color","pattern","formality","fit_cut","originality","too_safe","too_bold","none_work","other"].includes(reason)?reason:"other",
        occasion,climate,intention,anchorShirtId,anchorPantId,candidates,
        engineRuleSetVersion:text(payload.engineRuleSetVersion,100),
        note:text(payload.note,600),
      };
    }

    if (subtype === "designer_creative_research") {
      const researchId=text(payload.researchId,140);
      const title=text(payload.title,180);
      const sourceUrl=text(payload.sourceUrl,500);
      const sourceType=text(payload.sourceType,30);
      const principle=text(payload.principle,700);
      const transformedIdea=text(payload.transformedIdea,700);
      const zone=text(payload.zone,40);
      const secondaryZone=text(payload.secondaryZone,40);
      const treatmentLabel=text(payload.treatmentLabel,140);
      const treatmentInstruction=text(payload.treatmentInstruction,700);
      const visualPurpose=text(payload.visualPurpose,500);
      const intensityRaw=Number(payload.intensity);
      const buildability=text(payload.buildability,30);
      const patternFamily=text(payload.patternFamily,30);
      const patternName=text(payload.patternName,140);
      const patternLayout=text(payload.patternLayout,700);
      const patternPlacement=text(payload.patternPlacement,400);
      const patternScale=text(payload.patternScale,30);
      const patternCoverageRaw=Number(payload.patternCoverage);
      const note=text(payload.note,600);
      const zones=new Set(["collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"]);
      if(!researchId || !title || !principle || !transformedIdea || !zones.has(zone) || !treatmentLabel || !treatmentInstruction || !visualPurpose) return null;
      if(secondaryZone && !zones.has(secondaryZone)) return null;
      if(!["museum","designer","runway","tailoring","archive","operator"].includes(sourceType)) return null;
      if(!["supported","atelier","experimental"].includes(buildability)) return null;
      if(!["none","stripe","geometric","border","tonal","placement"].includes(patternFamily)) return null;
      if(patternScale && !["micro","fine","medium"].includes(patternScale)) return null;
      return {
        subtype,researchId,title,sourceUrl,sourceType,principle,transformedIdea,zone,secondaryZone,
        ...(payload.provenance&&typeof payload.provenance==="object"&&!Array.isArray(payload.provenance)&&/^[a-f0-9]{64}$/.test(String((payload.provenance as Record<string,unknown>).contentHash))?{provenance:{contentHash:String((payload.provenance as Record<string,unknown>).contentHash),fetchedAt:text((payload.provenance as Record<string,unknown>).fetchedAt,80),method:"keyword_hypothesis",reviewRequired:!Boolean(payload.active)}}:{}),
        treatmentLabel,treatmentInstruction,visualPurpose,
        intensity:Number.isFinite(intensityRaw)?Math.max(1,Math.min(100,Math.round(intensityRaw))):50,
        buildability,patternFamily,patternName,patternLayout,patternPlacement,patternScale,
        patternCoverage:Number.isFinite(patternCoverageRaw)?Math.max(0,Math.min(60,Math.round(patternCoverageRaw))):24,
        active:Boolean(payload.active),
        note,
        createdAt:text(payload.createdAt,80),
      };
    }

    if (subtype === "designer_fabric_metadata") {
      const fabricId = text(payload.fabricId,140);
      const availability = text(payload.availability,20);
      const weightClass = text(payload.weightClass,20);
      const drape = text(payload.drape,20);
      const weightGsmRaw = Number(payload.weightGsm);
      const formalityRaw = Number(payload.formalityScore);
      const physicalEvidence = normalizeFabricPhysicalEvidenceProvenance(payload.physicalEvidence);
      const seasonTags = Array.isArray(payload.seasonTags)
        ? payload.seasonTags.map((item)=>text(item,30)).filter((item)=>["Spring","Summer","Autumn","Winter","All-season"].includes(item)).slice(0,5)
        : [];
      const roleTags = Array.isArray(payload.roleTags)
        ? payload.roleTags.map((item)=>text(item,30)).filter((item)=>["base_safe","accent_safe"].includes(item)).slice(0,2)
        : [];
      if (!fabricId) return null;
      return {
        subtype, fabricId,
        availability:["available","unavailable"].includes(availability) ? availability : "unknown",
        weightGsm:Number.isFinite(weightGsmRaw) && weightGsmRaw >= 40 && weightGsmRaw <= 1000 ? Math.round(weightGsmRaw) : undefined,
        weightClass:["Light","Medium","Heavy"].includes(weightClass) ? weightClass : undefined,
        weave:text(payload.weave,100),
        texture:text(payload.texture,100),
        drape:["fluid","soft","medium","structured"].includes(drape) ? drape : undefined,
        seasonTags,
        formalityScore:Number.isFinite(formalityRaw) && formalityRaw >= 1 && formalityRaw <= 5 ? Math.round(formalityRaw*10)/10 : undefined,
        roleTags,
        ...(physicalEvidence?{physicalEvidence}:{}),
        note:text(payload.note,500),
      };
    }
    return { note: text(payload.note,1000) };
  }

  if (type === "session_started") {
    return { experience: text(payload.experience,80) || "style-director" };
  }

  if (type === "answer_selected") {
    const step = text(payload.step,40);
    const value = text(payload.value,120);
    if (!ANSWER_STEPS.has(step) || !value) return null;
    return { step, value };
  }

  if (type === "looks_generated") {
    const rawLooks = Array.isArray(payload.looks) ? payload.looks.slice(0,3) : [];
    const looks = rawLooks.map((raw)=>{
      const look = raw && typeof raw === "object" ? raw as Record<string,unknown> : {};
      return {
        id: text(look.id,120),
        title: text(look.title,120),
        fabricId: text(look.fabricId,120),
        fabric: text(look.fabric,120),
        tier: text(look.tier,40),
      };
    }).filter((look)=>look.id && look.fabricId);
    return { looks };
  }

  if (type === "look_selected") {
    const lookId = text(payload.lookId,120);
    const fabricId = text(payload.fabricId,120);
    if (!lookId || !fabricId) return null;
    return {
      lookId,
      title: text(payload.title,120),
      fabricId,
      fabric: text(payload.fabric,120),
      automatic: Boolean(payload.automatic),
    };
  }

  if (type === "render_requested") {
    const mode = text(payload.mode,20);
    if (!RENDER_MODES.has(mode)) return null;
    return {
      mode,
      lookId: text(payload.lookId,120),
      fabricId: text(payload.fabricId,120),
    };
  }

  if (type === "render_completed") {
    const mode = text(payload.mode,20);
    if (!RENDER_MODES.has(mode)) return null;
    const rawImage = text(payload.imageUrl,600);
    const imageUrl = /^https:\/\/(cdn|media)\.fashn\.ai\//i.test(rawImage) ? rawImage : undefined;
    const generated = new Date(text(payload.generatedAt,80));
    return {
      mode,
      lookId: text(payload.lookId,120),
      fabricId: text(payload.fabricId,120),
      fabric: text(payload.fabric,120),
      line: text(payload.line,160),
      provider: text(payload.provider,80),
      ...(imageUrl ? { imageUrl } : {}),
      label: text(payload.label,120),
      generatedAt: Number.isNaN(generated.getTime()) ? undefined : generated.toISOString(),
    };
  }

  if (type === "design_locked") {
    const revisionId=text(payload.revisionId,180);
    const recipeHash=text(payload.recipeHash,128);
    const shirtId=text(payload.shirtId,140);
    const pantId=text(payload.pantId,140);
    const occasion=text(payload.occasion,40);
    const status=text(payload.status,40);
    if(!revisionId || !/^[a-f0-9]{64}$/i.test(recipeHash) || !shirtId || !pantId) return null;
    if(occasion && !["Casual","Smart-Casual","Semi-Formal","Formal"].includes(occasion)) return null;
    return {
      revisionId,
      recipeHash:recipeHash.toLowerCase(),
      shirtId,
      pantId,
      occasion,
      status:["draft","review_required","ready_for_tailor_review"].includes(status)?status:"draft",
      parentRevisionId:text(payload.parentRevisionId,180),
    };
  }

  if (type === "whatsapp_clicked") {
    return {
      lookId: text(payload.lookId,120),
      fabricId: text(payload.fabricId,120),
      fabric: text(payload.fabric,120),
    };
  }

  return null;
}

function clean(body:IncomingEvent, operatorAuthorized:boolean) {
  const type = String(body.type || "");
  const sessionId = String(body.sessionId || "").slice(0,140);
  const operatorType = OPERATOR_TYPES.has(type);

  if (!sessionId) return null;
  if (!PUBLIC_TYPES.has(type) && !(operatorAuthorized && operatorType)) return null;

  const parsedAt = new Date(body.at || Date.now());
  if (Number.isNaN(parsedAt.getTime())) return null;

  if (PUBLIC_TYPES.has(type)) {
    const drift = parsedAt.getTime() - Date.now();
    if (drift > 10 * 60_000 || drift < -30 * 86_400_000) return null;
  }

  const payload = cleanPayload(type,body.payload);
  if (!payload) return null;

  return {
    id:String(body.id || `EV-${Date.now()}`).slice(0,160),
    session_id:sessionId,
    type,
    at:parsedAt.toISOString(),
    source:operatorType ? "operator" : "style-director",
    payload,
  };
}

export async function POST(request:Request) {
  if (rateLimit(request)) {
    return NextResponse.json({error:"Too many memory events."},{status:429});
  }

  try {
    const body = await request.json() as IncomingEvent;
    let operatorAuthorized = false;

    if (OPERATOR_TYPES.has(String(body.type || ""))) {
      const jar = await cookies();
      operatorAuthorized = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
    }

    const event = clean(body,operatorAuthorized);
    if (!event) {
      return NextResponse.json({error:"Invalid or unauthorized memory event."},{status:operatorAuthorized?400:403});
    }

    if (PUBLIC_TYPES.has(event.type)) {
      const headerName = "x-linen-memory-token";
      const token = request.headers.get(headerName) || request.headers.get(legacyMemoryHeader(headerName));
      if (!verifyMemorySessionToken(event.session_id,token)) {
        return NextResponse.json({error:"Invalid memory session."},{status:403});
      }
    }

    const cloud = getSupabaseAdminConfig();
    if (!cloud) {
      return NextResponse.json({stored:false,provider:"not_configured"},{status:202});
    }

    const response = await fetch(`${cloud.url}/rest/v1/style_events`,{
      method:"POST",
      headers:{
        ...supabaseAdminHeaders(cloud),
        "content-type":"application/json",
        prefer:"return=minimal,resolution=ignore-duplicates",
      },
      body:JSON.stringify(event),
      cache:"no-store",
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0,300);
      console.error("[memory/event] Supabase write failed",response.status,detail);
      return NextResponse.json({error:"Cloud memory is temporarily unavailable."},{status:502});
    }

    return NextResponse.json({stored:true,provider:"supabase"});
  } catch (error) {
    console.error("[memory/event]",error);
    return NextResponse.json({error:"Unable to record memory event."},{status:500});
  }
}
