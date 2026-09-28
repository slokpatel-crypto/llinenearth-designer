export const DESIGNER_FEEDBACK_REASONS = [
  ["color","Colour / contrast"],
  ["too_bold","Too bold"],
  ["too_safe","Too safe"],
  ["fit_cut","Fit / cut"],
  ["trouser_shape","Trouser shape"],
  ["formality","Formality"],
  ["fabric","Fabric choice"],
  ["construction","Construction detail"],
  ["other","Other"],
] as const;

export type DesignerFeedbackReason = typeof DESIGNER_FEEDBACK_REASONS[number][0];

export type DesignerOutcomeEvent = {
  type: string;
  payload?: Record<string,unknown>;
};

export type DesignerOutcomeSummary = {
  total: number;
  positive: number;
  negative: number;
  saved: number;
  reasonCounts: Record<DesignerFeedbackReason,number>;
  topReason: DesignerFeedbackReason | null;
  sufficientForLearning: boolean;
};

export function isDesignerFeedbackReason(value:string): value is DesignerFeedbackReason {
  return DESIGNER_FEEDBACK_REASONS.some(([key])=>key===value);
}

export function summarizeDesignerOutcomes(events:DesignerOutcomeEvent[]):DesignerOutcomeSummary {
  const reasonCounts = Object.fromEntries(DESIGNER_FEEDBACK_REASONS.map(([key])=>[key,0])) as Record<DesignerFeedbackReason,number>;
  let positive=0; let negative=0; let saved=0;

  // Keep the newest structured response for each recommendation so repeated
  // button presses do not distort the learning signal.
  const latest = new Map<string,Record<string,unknown>>();
  for(const event of events) {
    if(event.type!=="designer_feedback") continue;
    const payload=event.payload || {};
    const recommendationId=String(payload.recommendationId || "");
    if(!recommendationId) continue;
    latest.set(recommendationId,payload);
  }

  for(const payload of latest.values()) {
    const rating=String(payload.rating || "");
    if(rating==="up") positive += 1;
    else if(rating==="saved") saved += 1;
    else if(rating==="down") {
      negative += 1;
      const reason=String(payload.reason || "");
      if(isDesignerFeedbackReason(reason)) reasonCounts[reason] += 1;
    }
  }

  const topReason = (Object.entries(reasonCounts) as Array<[DesignerFeedbackReason,number]>)
    .sort((a,b)=>b[1]-a[1])[0];
  const total=positive+negative+saved;

  return {
    total,positive,negative,saved,reasonCounts,
    topReason:topReason && topReason[1]>0 ? topReason[0] : null,
    // Deliberately conservative: do not treat a couple of clicks as a stable preference.
    sufficientForLearning:total>=8 && negative>=3,
  };
}

export function designerLearningNotes(summary:DesignerOutcomeSummary) {
  if(!summary.sufficientForLearning || !summary.topReason) return [];
  const label = DESIGNER_FEEDBACK_REASONS.find(([key])=>key===summary.topReason)?.[1] || summary.topReason;
  return [
    `Repeated Designer feedback is clustering around: ${label}.`,
    "Treat this as a review signal only until an operator confirms whether it reflects customer taste, garment construction, or catalogue-data quality.",
  ];
}
