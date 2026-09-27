# LLinen Earth Designer Lab — V1

Status: **code-complete for the requested simple fabric → brief → Designer output workflow**.

Route: `/designer-lab`

## Purpose

Designer Lab is intentionally separate from the customer-facing LLinen Earth website experience. It is a clean working surface for testing the shared Designer intelligence without homepage branding, marketing sections, opening animations or unrelated navigation.

It does **not** duplicate the recommendation engine. The Lab reuses the same:
- structured LLinen Earth fabric catalogue;
- CR-1–CR-7 compatibility rules;
- LLinen Earth taste/ranking layer;
- Safe / Elevated / Statement ranking;
- human-approved safe fallback logic;
- recommendation telemetry.

## V1 flow

1. Browse catalogue fabrics.
2. Filter All / Shirts / Trousers.
3. Search by colour, pattern or collection.
4. Pick one fabric as the anchor.
5. Set occasion, formality, time, setting, style and fit.
6. Ask the Designer.
7. Compare up to three ranked real-catalogue shirt/trouser combinations.
8. Select one direction and inspect confidence, relationship, occasion band and reasoning.
9. Mark the exact chosen pairing **Looks right** or **Wrong**. When cloud memory is connected, that feedback is recorded against the exact pair and rules version.

Low-confidence output is explicitly labelled **Held for review** and is not presented as approved.

## Inventory wording

The current structured catalogue is the confirmed product-data set used by the engine. It is not a live physical-shelf inventory system. The Lab therefore avoids claiming that every catalogue fabric is physically available at the shop at the exact moment of recommendation.

Legacy website swatches remain unverified and are not automatically used by the Designer.

## Separation

The current main LLinen Earth website is not replaced or redesigned by this branch. Designer Lab has:
- its own route;
- its own CSS;
- no `AppShell`;
- its own focused API endpoint at `/api/designer-lab/generate`.

A dedicated Vercel project/domain can point to this surface later without changing the shared Designer intelligence.

## Validation

The Lab files and API are included in `npm run quality`, and the branch is validated by the normal production dependency audit, release-readiness check and Next.js production build.


## Verified Designer data

A protected operator route at `/operator/designer-data` provides the calibration layer that was previously missing.

For each structured catalogue fabric, an operator can record only verified facts:
- physical availability: unknown / available / unavailable;
- GSM;
- weight class;
- weave;
- texture;
- drape;
- season tags;
- 1–5 formality score;
- base/accent role tags;
- verification/source note.

These values are stored as append-only `designer_fabric_metadata` operator events. The original catalogue object is never overwritten. The newest verified record is applied server-side before the main Designer or Designer Lab ranks stock.

An `unavailable` physical status removes that fabric from future server-side recommendations. Verified formality/weight/season data replaces the corresponding provisional/unknown rule inputs. If metadata is absent, the engine continues to report uncertainty rather than inventing a value.

The Data Desk deliberately requires live cloud memory before saving because server-side recommendations cannot reuse browser-only calibration data.


## Designer QA Desk

A second protected operator route at `/operator/designer-qa` stress-tests the deterministic Designer before production use.

The QA matrix runs every active shirt/trouser anchor through six representative contexts:
- Business · daytime
- Smart casual · city
- Dinner · evening
- Wedding · hotel
- Resort · hot weather
- Festive · evening

It reports:
- total test cases;
- average confidence;
- held/review cases;
- no-result cases;
- average number of ranked directions;
- CR-1 through CR-7 warning pressure;
- physical-stock / weight / season / formality / drape data coverage;
- a filterable weak-case table ordered to put held and lowest-confidence cases first.

The QA Desk uses the same calibrated catalogue overlay as the customer-facing recommendation path, so an operator can move directly between `/operator/designer-qa` and `/operator/designer-data` to fix missing facts and rerun the matrix.
