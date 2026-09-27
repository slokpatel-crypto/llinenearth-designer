# LLinen Earth Designer — Phase 1 checkpoint

Status: **Basic tier complete; deterministic ranked-direction layer implemented; pending live calibration and production data completion**

Scope remains deliberately limited to **shirt + trouser** recommendations from existing LLinen Earth stock. Suit/blazer expansion and feedback-driven adaptive weight learning remain out of scope until this foundation is observed in real use.

## Implemented

- Real LLinen Earth stock anchor selection through `fabric-stock.ts` / `FabricStudio.tsx`.
- Deterministic shirt–trouser engine in `src/lib/shirt-pant-designer.ts`.
- CR-1 to CR-7 rule evaluation.
- Missing GSM/weight/button facts produce `unknown`, never invented certainty.
- Numeric confidence and explicit low-confidence no-force path.
- Exact stock shirt/trouser swatches in Designer results.
- One-line customer-facing rationale; internal rule trace remains server/admin-side.
- Rule-set version: `shirt-pant-ranked-v2`.
- Server-side append-only recommendation logging into the existing `style_events` ledger when cloud memory is configured.
- Customer Yes/No pairing feedback.
- Protected Operator Desk review:
  - Approve pairing
  - Flag wrong (reason required)
  - Set safe fallback
- Designer Review Queue prioritizes unreviewed and low-confidence results.
- Safe fallbacks are version-scoped + occasion-band-scoped, read server-side only when cloud memory is live, and are re-evaluated against the current hard rules before reuse.
- A newer operator review supersedes an older fallback approval for the same pairing.
- LLinen Earth-owned color/material/context guidance is implemented in a separate taste layer; it ranks rule-valid combinations and never overrides CR hard rules.
- Up to three real-stock directions are returned: **Elevated**, **Safe**, and **Statement**. If there are not enough safely valid pairs, the engine returns fewer rather than padding with weak choices.
- The selected stock pair is carried into the refinement version, included in the immutable spec hash, preserved in saved versions and compiled into the visualization specification.
- Fast preview colors use the exact selected shirt + trouser stock hex values.
- FASHN receives a two-panel stock context image: top = exact shirt swatch, bottom = exact trouser swatch, with explicit mapping instructions.
- `fabric-stock.ts` now has production-ready optional fields for verified `weightGsm`, `weightClass`, `weave`, `texture`, `drape`, `seasonTags`, `formalityScore`, and role tags. Existing catalogue Lea counts are recorded separately and never misused as GSM.
- Phase-1 contracts are included in `npm run quality`.

## Current taste/data boundary

The exact `Shirt_Pant_Designer_Module_Datasheet.xlsx` / `LLinen_Earth_Styling_Reference.xlsx` workbook is not currently available to the build agent through the project file index. Therefore:

- formality defaults remain provisional;
- exact GSM / weight class remains unknown for catalogue swatches unless supplied elsewhere;
- button/trim formality remains unknown;
- human-approved safe fallback combinations begin empty and are created through the Operator Desk;
- seed color directions come from the existing LLinen Earth Color, Pattern & Material Pairing specification and are treated as suggestions, not fixed laws.

Do not silently convert any of these unknowns into guessed facts.

## Operator review loop

1. A customer selects a real stock fabric and completes the Designer brief.
2. The engine evaluates the best opposite-garment stock candidates.
3. The recommendation and internal rule trace are logged when cloud memory is live.
4. The Operator Desk surfaces the pairing in **Designer Review Queue**.
5. Operator chooses:
   - **Approve pairing** — records a positive human judgement.
   - **Flag wrong** — requires a reason and records a rejection.
   - **Set safe fallback** — requires live cloud memory; marks that exact shirt/trouser pair as reusable for the same occasion band and current rules version.
6. If a future request falls below the confidence threshold, the server may use an approved safe fallback only if the current rule engine re-evaluates it without a high-severity violation.

## Before adaptive learning

The deterministic ranked-direction layer is now present. Do not start feedback-driven adaptive weight learning until:

1. real fabric metadata is improved (especially weight/GSM where known);
2. LLinen Earth formality/taste defaults are reviewed;
3. a useful number of pairings have operator/customer feedback;
4. safe fallbacks exist for the relevant occasion bands;
5. recommendation logs can be queried reliably from the production cloud.

The 2–3 ranked alternatives are already deterministic and context-aware. Only after the conditions above should the system begin changing ranking weights from real customer/operator outcomes.
