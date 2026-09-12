# Phase 8 — Fashion Intelligence V2 + Store / Human Designer Handoff

## Goal
Strengthen the product before the final QA phase so the Designer can reason about **what a fabric should become**, not merely how it looks, and carry the final customer-approved specification into the physical LLinen Earth workflow.

## Wear intelligence expansion
The V2 taxonomy covers representative premium menswear across:
- dress, smart-casual, resort and contemporary shirts
- flat-front, pleated, high-rise, wide, drawstring, Gurkha and chino trouser systems
- soft and structured single-breasted jackets, double-breasted tailoring and utility/overshirt layers
- classic, double-breasted, dinner/tuxedo and warm-weather suits
- tailored kurta, Nehru/Bandi, Bandhgala/Jodhpuri, Achkan and Sherwani families

Each record includes formality, structure, climate, occasions, preferred fabrics and visible construction cues. The library is designed to expand without changing the Designer contract.

## Visual reference policy
The `/knowledge` wear library uses LLinen Earth-controlled SVG type diagrams to communicate silhouettes and details. Public web references may be studied to improve taxonomy and terminology, but external fashion photography is not copied into the commercial type library unless licensing is explicitly recorded.

## Fabric intelligence expansion
Core families include Linen, Linen-Cotton, Cotton Poplin, Oxford Cotton, Cotton Twill, TR/PV, TR-Wool, Tropical Wool, Hopsack Wool, Wool Flannel, Seersucker, Denim, Corduroy, Velvet and Silk Blend.

Each fabric record has numeric signals for breathability, drape, structure, wrinkle resistance and formality plus preferred garment roles, climates, occasions, strengths and cautions.

### TR terminology
LLinen Earth treats TR/PV as a polyester-viscose/rayon suiting family and TR-Wool/TRW as polyester-viscose-wool. Exact blend percentages, weave, GSM and finish must be confirmed in production because trade names alone do not guarantee performance.

## Designer upgrade
Every generated direction now contains a `fabricJudgement` object with:
- resolved fabric family when known
- preferred garment role
- garment-role fit
- climate fit
- occasion fit
- overall score and verdict
- best outfit type
- reasons and cautions

This feeds the Fabric score instead of using image-analysis confidence as a proxy for suitability.

## Store / human designer handoff
Saved designs can create an atelier request carrying:
- locked `specHash`
- exact shirt / trouser / layer / footwear specification
- palette and customer context
- uploaded-fabric judgement
- suggested alternative store fabric families
- customer note

The `/atelier` queue lets staff move the packet through `requested`, `in_review`, `fabric_check`, and `ready_for_consultation`, while preserving staff notes.

## MVP boundary
The handoff queue and saved designs are browser-persisted development workflows. Real production requires authenticated customers/staff, server persistence, role permissions, inventory/SKU mapping, appointment scheduling and audit logs.
