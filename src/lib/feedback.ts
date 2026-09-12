export const FEEDBACK_KEY = "llinen-earth-design-feedback-v1";

export type FeedbackRating = "love" | "good" | "needs_work";
export type DesignFeedback = {
  id: string;
  designId: string;
  specHash: string;
  rating: FeedbackRating;
  reasons: string[];
  note: string;
  createdAt: string;
  reviewStatus: "pending_review" | "reviewed";
};

export function listFeedback(): DesignFeedback[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFeedback(input: Omit<DesignFeedback,"id"|"createdAt"|"reviewStatus">) {
  if (typeof window === "undefined") throw new Error("Feedback is available in the browser.");
  const item: DesignFeedback = {
    ...input,
    id:`FB-${input.specHash}-${Date.now().toString(36).toUpperCase()}`,
    createdAt:new Date().toISOString(),
    reviewStatus:"pending_review",
  };
  const existing = listFeedback();
  const next = [item, ...existing.filter((x)=>x.specHash !== input.specHash)].slice(0,100);
  localStorage.setItem(FEEDBACK_KEY,JSON.stringify(next));
  return item;
}

export function markFeedbackReviewed(id: string) {
  if (typeof window === "undefined") return;
  const next = listFeedback().map((item)=>item.id===id?{...item,reviewStatus:"reviewed" as const}:item);
  localStorage.setItem(FEEDBACK_KEY,JSON.stringify(next));
}
