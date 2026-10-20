"use client";

import { useState, type FormEvent } from "react";
import {
  MODEL_LAYER_SLOTS,
  type ModelLayerSlot,
  type OutfitComposition,
} from "@/lib/designer/model-layer-contract";
import {
  applyModelLayerEdits,
  type EditableModelLayerPlan,
} from "@/lib/designer/model-layer-edits";

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
          <p className="titanLayerPlannerBoundary">Nothing is saved or shared. This plan cannot activate
            unapproved geometry, change the existing model identity, confirm stock or certify tailoring fit.</p>
        </div>
      </div>
    </section>
  );
}
