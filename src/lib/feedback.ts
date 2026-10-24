import { makeFeedbackId, mergeDistinctDesignFeedback, validStoredFeedback } from "./feedback-storage-integrity.ts";

export const FEEDBACK_KEY = "linen-earth-design-feedback-v1";

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
    const parsed:unknown = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    return validStoredFeedback<DesignFeedback>(parsed);
  } catch {
    return [];
  }
}

export function saveFeedback(input: Omit<DesignFeedback,"id"|"createdAt"|"reviewStatus">) {
  if (typeof window === "undefined") throw new Error("Feedback is available in the browser.");
  const item: DesignFeedback = {
    ...input,
    id:makeFeedbackId(input.specHash,window.crypto.getRandomValues(new Uint8Array(16))),
    createdAt:new Date().toISOString(),
    reviewStatus:"pending_review",
  };
  const existing = listFeedback();
  const next = mergeDistinctDesignFeedback(existing,item);
  localStorage.setItem(FEEDBACK_KEY,JSON.stringify(next));
  return item;
}

export function markFeedbackReviewed(id: string) {
  if (typeof window === "undefined") return;
  const next = listFeedback().map((item)=>item.id===id?{...item,reviewStatus:"reviewed" as const}:item);
  localStorage.setItem(FEEDBACK_KEY,JSON.stringify(next));
}
