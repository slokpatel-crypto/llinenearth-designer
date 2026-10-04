# Designer engine — execution and acceptance

Date: 2026-10-04. Scope: the first public Linen Earth shirt/trouser design workspace.

## Goal

Turn a fabric-led brief into useful, buildable design directions, let the customer judge and revise the actual proposed outfit, and carry the chosen version into the existing lock and tailor-handoff workflow. The same studio model and real stock references stay authoritative. The engine must explain concrete choices rather than attach a generic answer to an unrelated outfit.

## Software delivered

| Workflow | Behaviour |
| --- | --- |
| Outfit brief | Current stock, occasion, climate, measurements and supported construction feed up to three directions. |
| Garment-specific task | Shirt-only tasks preserve the complete trouser; trouser-only tasks preserve the complete shirt. |
| Role-specific cloth | Required/avoided colour, pattern and catalogue material apply to the named garment before ranking. |
| Numeric material request | Recorded GSM and catalogue Lea must match; missing data cannot satisfy a numerical request. Lea never supplies GSM or mechanical drape. |
| Creative goals | Relaxed summer, clean tailoring, modern volume, quiet texture and one contrast system resolve existing option IDs. Explicit choices remain primary; incompatible soft treatments may be relaxed with an explanation. |
| Capsule | A bounded wardrobe for up to three occasions, each carrying its own occasion through judgement, Apply and canonical assessment. Cloth may be reused across looks; unavailable occasions stay explicitly incomplete. |
| Critique and comparison | Evaluate the actual selected pair and named supported alternatives, with concrete reasons, tradeoffs and blocked Apply for conflicts. |
| Human revision | Revise the judged proposal, preserve unaffected construction on cloth-only changes, and keep six previous revisions for review within the current brief. Going back does not apply or endorse a look. |
| Personal learning | Distinct latest human judgements can support individual construction preferences; targeted rejections affect their actual detail. Four relevant reviews, supporting evidence and a clear winner are required. Ties, duplicate recipes, saves and automated image QA do not create preferences. |
| User control | Show learned choices with supporting review counts; allow preference use to be disabled. Current instructions, exclusions, garment locks and compatibility checks take priority. |
| Preview truth | Each proposal discloses which construction details the photographic model approximates. It does not claim the studio silhouette was physically re-cut. |
| Tailor preparation | Existing measurements, provisional finished targets, immutable lock and handoff remain the route to production; an advice response is not approval to cut. |

## Compatibility

Existing StyleSpec v2, option IDs, saved designs and `linen-designer-brief-v2` callers remain readable. Advisor v1 receives additive plan, preview-support and per-option occasion/context fields. Browser taste profile v1 gains optional construction preferences and evidence summaries, recalculated from the existing bounded feedback event stream. The existing cloud event queue still records its supported feedback fields. Revision history is transient, bounded browser state, not durable account storage. No database migration, application dependency, paid image call or model-training claim is introduced.

## Verification story

Designer UI → brief API → current stock/evidence/ease metadata → pure intent/search/fit checks → proposal → human judgement/revision → explicit Apply → exact canonical assessment → existing lock/handoff.

Unit cases cover role constraints, companion locks, creative goals, bounded capsule planning, numerical evidence, compatibility, reference clarification, preview disclosures, personal-learning thresholds and revision preservation. Engine evaluation covers deterministic task latency only. CI runs actual HTTP contracts against an isolated production build and real Chromium at 390/768/1440px. UI fixtures use the real rules while delaying responses to test ownership; they do not spend provider credits or count as physical/device acceptance.

## Remaining gates

There is no audited overall completion percentage. Software checks do not establish universal fashion-designer intelligence. Open-ended visual-reference understanding, unsupported garments/details and arbitrary creative instructions still require broader supported blocks and interpretation work. Real fabric colour, composition, GSM, scale and drape need reviewed supplier/physical evidence. Photographic coverage needs matching source assets for additional cuts. Novice-user, device and tailor trials remain open in Roadmap Readiness. Production deployment remains paused.

These are not marked 100% complete by this software delivery.
