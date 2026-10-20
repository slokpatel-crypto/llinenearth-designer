"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  MODEL_LAYER_SLOTS,
  type ModelLayerSlot,
  type OutfitComposition,
} from "@/lib/designer/model-layer-contract";
import {
  applyModelLayerEdits,
  type EditableModelLayerPlan,
} from "@/lib/designer/model-layer-edits";

import {
  TITAN_LAYER_PLANS_KEY, TITAN_LAYER_PLANS_LIMIT,
  addTitanLayerPlan, readTitanLayerPlanLibrary,
  removeTitanLayerPlan, serializeTitanLayerPlanLibrary,
} from "@/lib/titan/layer-plan-library";

import {
  readTitanLayerShare, titanLayerShareHref, TITAN_LAYER_SHARE_PARAMETER,
} from "@/lib/titan/layer-plan-share";

const STARTING_PLAN: EditableModelLayerPlan = {
  version: 1,
  composition: "separates",
  layers: ["shirt", "trouser"],
};

const LABELS: Record<ModelLayerSlot, string> = {
  shirt: "Shirt",
  trouser: "Trousers",
  belt: "Belt",
  tie: "Tie",
  waistcoat: "Waistcoat",
  blazer: "Blazer",
  "pocket-square": "Pocket square",
};
const COMPOSITIONS: ReadonlyArray<{ id: OutfitComposition; name: string }> = [
  { id: "separates", name: "Separates" },
  { id: "two-piece-suit", name: "Two-piece suit" },
  { id: "three-piece-suit", name: "Three-piece suit" },
];

/**
 * Unreleased planning-only UI. It never attaches GLBs, changes the reference
 * model, selects stock or writes a saved Designer draft. The atomic v1 editor
 * alone decides whether the complete proposed outfit can be committed.
 */
export default function TitanLayerPlanner() {
  const [appliedPlan, setAppliedPlan] = useState<EditableModelLayerPlan>(STARTING_PLAN);
  const [draftSlots, setDraftSlots] = useState<readonly ModelLayerSlot[]>(STARTING_PLAN.layers);
  const [draftComposition, setDraftComposition] = useState<OutfitComposition>("separates");
  const [message, setMessage] = useState("Choose garment layers, then apply a complete plan.");

  const [savedPlans, setSavedPlans] = useState<readonly EditableModelLayerPlan[]>([]);
  const [libraryState, setLibraryState] = useState<"loading" | "ready" | "invalid" | "blocked">("loading");
  const [libraryMessage, setLibraryMessage] = useState("");
  const [shareOrigin, setShareOrigin] = useState("");
  const [showSharedLink, setShowSharedLink] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const shareInput = useRef<HTMLInputElement>(null);

  // A shared URL stages a logical outfit only. It never loads an accessory
  // GLB, applies a plan, touches Designer drafts or updates saved bookmarks.
  useEffect(() => {
    setShareOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    if (!params.has(TITAN_LAYER_SHARE_PARAMETER)) return;
    const shared = readTitanLayerShare(window.location.search);
    if (!shared) {
      setMessage("This layer-plan link is invalid or unsupported. Your current outfit remains unchanged.");
      return;
    }
    setDraftSlots([...shared.layers]);
    setDraftComposition(shared.composition);
    setMessage("Shared plan opened as an unapplied draft. Review the layers, then choose Apply layer plan.");
  }, []);

  // Browser storage is an explicitly opted-in library, NOT saved Designer
  // state. Never apply restored plans or mutate a fabric/material/model.
  useEffect(() => {
    function load(raw: string | null) {
      const data = readTitanLayerPlanLibrary(raw);
      setSavedPlans(data.plans);
      setLibraryState(data.ok ? "ready" : "invalid");
      if (!data.ok) setLibraryMessage("Existing layer bookmarks are unreadable. They were not overwritten.");
    }
    try { load(window.localStorage.getItem(TITAN_LAYER_PLANS_KEY)); }
    catch {
      setLibraryState("blocked");
      setLibraryMessage("Browser storage is blocked; no saved plan was changed.");
    }
    function handleStorage(event: StorageEvent) {
      if (event.key !== TITAN_LAYER_PLANS_KEY && event.key !== null) return;
      try {
        load(window.localStorage.getItem(TITAN_LAYER_PLANS_KEY));
        if (event.key !== null) setLibraryMessage("Layer bookmarks updated in another tab.");
      } catch {
        setLibraryState("blocked");
        setLibraryMessage("Browser storage became unavailable.");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function writeLibrary(
    edit: (current: readonly EditableModelLayerPlan[]) => {
      changed: boolean; plans: readonly EditableModelLayerPlan[]; reason?: string
    },
    success: string,
  ) {
    if (libraryState !== "ready") return;
    try {
      // Read immediately before writing; do not overwrite another tab's new
      // bookmarks or clear an unknown/future version behind its back.
      const current = readTitanLayerPlanLibrary(window.localStorage.getItem(TITAN_LAYER_PLANS_KEY));
      if (!current.ok) {
        setSavedPlans([]);
        setLibraryState("invalid");
        setLibraryMessage("Stored bookmarks changed or became unreadable. Nothing was overwritten.");
        return;
      }
      const next = edit(current.plans);
      setSavedPlans(current.plans);
      if (!next.changed) {
        setLibraryMessage(next.reason ?? "No saved plan changed.");
        return;
      }
      window.localStorage.setItem(TITAN_LAYER_PLANS_KEY, serializeTitanLayerPlanLibrary(next.plans));
      setSavedPlans(next.plans);
      setLibraryMessage(success);
    } catch {
      setLibraryState("blocked");
      setLibraryMessage("Could not write local bookmarks. Existing plans were not changed.");
    }
  }

  function saveAppliedPlan() {
    writeLibrary(current => addTitanLayerPlan(current, appliedPlan), "Applied plan bookmarked on this device.");
  }

  function removeSavedPlan(plan: EditableModelLayerPlan) {
    writeLibrary(current => removeTitanLayerPlan(current, plan), "Bookmark removed from this device.");
  }

  function stageSavedPlan(plan: EditableModelLayerPlan) {
    setDraftSlots([...plan.layers]);
    setDraftComposition(plan.composition);
    setMessage("Saved plan loaded as an unapplied draft. Select Apply layer plan to use it locally.");
  }

  function clearUnreadableLibrary() {
    if (libraryState !== "invalid") return;
    try {
      // Explicit user action only. Corrupt/future data is never auto-deleted.
      window.localStorage.removeItem(TITAN_LAYER_PLANS_KEY);
      setSavedPlans([]);
      setLibraryState("ready");
      setLibraryMessage("Unreadable local bookmarks cleared at your request.");
    } catch {
      setLibraryState("blocked");
      setLibraryMessage("Browser could not clear these bookmarks.");
    }
  }

  async function copyLayerLink() {
    const href = titanLayerShareHref(appliedPlan);
    if (!shareOrigin || !href) {
      setShareMessage("This garment plan cannot be shared.");
      return;
    }
    const url = new URL(href, shareOrigin).href;
    setShowSharedLink(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setShareMessage("Share link copied. This is a garment plan only, not a 3D render or saved design.");
    } catch {
      setShareMessage("Automatic copying is blocked. Select and copy the complete link below.");
    }
  }

  function toggleSlot(slot: ModelLayerSlot, selected: boolean) {
    setDraftSlots(previous => selected
      ? previous.includes(slot) ? previous : [...previous, slot]
      : previous.filter(item => item !== slot));
  }

  function revertDraft() {
    setDraftSlots([...appliedPlan.layers]);
    setDraftComposition(appliedPlan.composition);
    setMessage("Unapplied choices discarded. Your last valid plan is unchanged.");
  }

  function resetPlan() {
    setAppliedPlan(STARTING_PLAN);
    setDraftSlots([...STARTING_PLAN.layers]);
    setDraftComposition(STARTING_PLAN.composition);
    setMessage("Reset to shirt and trousers. No saved design was changed.");
    setShowSharedLink(false);
    setShareMessage("");
  }

  function commitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only changed fields go into a single atomic transaction. Nothing can
    // silently insert a missing parent, drop an accessory or downgrade a suit.
    const actions: Array<
      | { type: "set-slot"; slot: ModelLayerSlot; selected: boolean }
      | { type: "set-composition"; composition: OutfitComposition }
    > = MODEL_LAYER_SLOTS.flatMap(({ slot }) => {
      const selected = draftSlots.includes(slot);
      return appliedPlan.layers.includes(slot) === selected
        ? []
        : [{ type: "set-slot" as const, slot, selected }];
    });
    if (draftComposition !== appliedPlan.composition) {
      actions.push({ type: "set-composition", composition: draftComposition });
    }
    if (!actions.length) {
      setMessage("No changes to apply.");
      return;
    }
    const result = applyModelLayerEdits(appliedPlan, { version: 1, actions });
    if (!result.applied || !result.plan) {
      setMessage("Plan not applied: " + result.reasons.join(" ") + " Resolve every requirement before applying.");
      return;
    }
    setAppliedPlan(result.plan);
    setDraftSlots([...result.plan.layers]);
    setDraftComposition(result.plan.composition);
    setMessage("Valid layer plan applied locally. No garment asset, fabric, model or saved design was changed.");
    setShowSharedLink(false);
    setShareMessage("");
  }

  const hasUnappliedChanges = draftComposition !== appliedPlan.composition
    || MODEL_LAYER_SLOTS.some(({ slot }) => draftSlots.includes(slot) !== appliedPlan.layers.includes(slot));

  return (
    <section id="titan-layer-planner" className="titanLayerPlanner" aria-labelledby="titan-layer-planner-title">
      <div className="titanLayerPlannerHeading">
        <div>
          <p className="titanOverline">FUTURE WARDROBE / ENGINEERING PREVIEW</p>
          <h2 id="titan-layer-planner-title">Plan the layers.<br/><em>Keep the same model.</em></h2>
        </div>
        <p>This is an interactive garment <strong>plan only</strong>, not a photo, 3D render, fit approval or order.
          Blazers, waistcoats and accessories require separately verified assets before they can appear on the model.</p>
      </div>
      <div className="titanLayerPlannerLayout">
        <form className="titanLayerPlannerForm" onSubmit={commitPlan}>
          <fieldset>
            <legend>Choose garment layers</legend>
            <div className="titanLayerPlannerChoices">
              {MODEL_LAYER_SLOTS.map(layer => (
                <label className="titanLayerPlannerChoice" key={layer.slot}>
                  <input
                    type="checkbox" checked={draftSlots.includes(layer.slot)}
                    onChange={event => toggleSlot(layer.slot, event.target.checked)}
                  />
                  <span>
                    <strong>{LABELS[layer.slot]}</strong>
                    <small>{layer.implementation === "existing-preview"
                      ? "Existing reference layer" : "Separate 3D asset required"}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Outfit composition</legend>
            <div className="titanLayerPlannerCompositions">
              {COMPOSITIONS.map(kind => (
                <label key={kind.id}>
                  <input type="radio" name="titan-layer-composition" value={kind.id}
                    checked={draftComposition === kind.id}
                    onChange={() => setDraftComposition(kind.id)} />
                  {kind.name}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="titanLayerPlannerHint">For a suit, select the blazer and its composition together.
            A three-piece suit also needs a waistcoat. Pocket squares require a blazer; ties require a shirt.</p>
          <div className="titanLayerPlannerActions">
            <button type="submit" disabled={!hasUnappliedChanges}>Apply layer plan</button>
            <button type="button" onClick={revertDraft} disabled={!hasUnappliedChanges}>Discard edits</button>
            <button type="button" onClick={resetPlan}>Reset plan</button>
          </div>
          <p className="titanLayerPlannerFeedback" role="status" aria-live="polite">{message}</p>
        </form>
        <div className="titanLayerPlannerSummary">
          <span className="titanOverline">LAST VALID LOCAL PLAN</span>
          <h3>Your garment sequence</h3>
          <p className="titanLayerPlannerComposition" data-titan-composition={appliedPlan.composition}>
            {COMPOSITIONS.find(item => item.id === appliedPlan.composition)?.name}
          </p>
          <ol className="titanLayerPlannerStack">
            {appliedPlan.layers.map(slot => (
              <li key={slot}>
                <span>{LABELS[slot]}</span>
                <small>{slot === "shirt" || slot === "trouser" ? "Existing reference" : "Not yet a renderable garment"}</small>
              </li>
            ))}
          </ol>
          <div className="titanLayerPlannerShare">
            <button type="button" className="titanLayerPlannerShareButton"
              onClick={copyLayerLink} disabled={!shareOrigin}>
              Copy applied plan link
            </button>
            <p>Share a garment-layer arrangement without measurements, cloth images or personal data.
              The recipient must explicitly apply the staged plan.</p>
            <p role="status" aria-live="polite" className="titanLayerPlannerShareFeedback">{shareMessage}</p>
            {showSharedLink && (
              <label>
                Layer-plan reference URL
                <input type="text" readOnly ref={shareInput}
                  aria-label="Layer plan share URL"
                  value={shareOrigin + (titanLayerShareHref(appliedPlan) ?? "")}
                  onFocus={() => shareInput.current?.select()} />
              </label>
            )}
          </div>
          <p className="titanLayerPlannerBoundary">Only explicitly bookmarked plans remain on this device.
            No layer can activate unapproved geometry, change the model identity, confirm stock or certify tailoring fit.</p>
          <div className="titanLayerPlannerLibrary" aria-labelledby="titan-layer-bookmarks-title">
            <h4 id="titan-layer-bookmarks-title">Your device-only layer bookmarks</h4>
            <p>Save up to {TITAN_LAYER_PLANS_LIMIT} valid outfit plans. Only garment slot IDs are stored here,
              never measurements, fabric choices or Designer drafts. Restoring a bookmark fills the draft only.</p>
            <button type="button" onClick={saveAppliedPlan} disabled={libraryState !== "ready"}
              className="titanLayerPlannerSave">Save applied plan</button>
            <p className="titanLayerPlannerLibraryFeedback" role="status" aria-live="polite">
              {libraryState === "loading" ? "Loading device bookmarks…" : libraryMessage ||
                (libraryState === "ready" ? `${savedPlans.length} of ${TITAN_LAYER_PLANS_LIMIT} plans saved.` :
                  "Local storage is unavailable.")}
            </p>
            {libraryState === "invalid" && (
              <button type="button" className="titanLayerPlannerClear" onClick={clearUnreadableLibrary}>
                Clear unreadable bookmarks
              </button>
            )}
            {libraryState === "ready" && savedPlans.length > 0 && (
              <ul className="titanLayerPlannerSavedList">
                {savedPlans.map((plan, index) => (
                  <li key={JSON.stringify([plan.composition, plan.layers])}>
                    <div>
                      <strong>{COMPOSITIONS.find(kind => kind.id === plan.composition)?.name}</strong>
                      <small>{plan.layers.map(slot => LABELS[slot]).join(" · ")}</small>
                    </div>
                    <div className="titanLayerPlannerSavedActions">
                      <button type="button" onClick={() => stageSavedPlan(plan)}
                        aria-label={`Load saved layer plan ${index + 1} as draft`}>Load draft</button>
                      <button type="button" onClick={() => removeSavedPlan(plan)}
                        aria-label={`Remove saved layer plan ${index + 1}`}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
