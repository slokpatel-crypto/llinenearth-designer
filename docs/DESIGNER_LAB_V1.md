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
