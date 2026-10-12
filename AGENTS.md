# AGENTS.md — Linen Earth platform

## Product
Fabric-first menswear design platform. Customers pick a real Linen Earth fabric, explore buildable garment options with an instant deterministic preview, save measurements, lock a design, request a final photoreal render, and hand the same design data into enquiry / production flows.

## Current stack
- Next.js 15 + React 19 + TypeScript
- Vercel deployment
- Supabase migrations / production persistence adapters
- FASHN for final photoreal rendering
- Deterministic Designer / Analyzer logic in `src/lib`
- Browser-only state still exists in some customer flows and must not be treated as durable production storage

## Non-negotiable rules
1. Physical truth lives in structured data: fabric scale, measured repeat, colour evidence, measurements, stock and production facts.
2. Live option changes must stay deterministic. Do not call a paid AI image API on each edit.
3. AI is allowed at the edges: intent parsing, critique, final render, QA assistance and bounded analysis.
4. Never invent fabric physical facts. If a fact is measured, supplier-provided or estimated, preserve that provenance.
5. Option IDs and closed vocabularies must come from the existing shared contracts. Do not create new ad-hoc labels in UI code.
6. A saved / locked design must be reconstructable from versioned IDs and data, not from display text.
7. Business and compatibility rules belong in pure testable functions, not scattered JSX conditions.
8. Secrets stay server-side and in environment variables only.
9. Feature work must preserve backwards compatibility with existing saved designs unless a migration is explicitly included.
10. Never delete or weaken tests merely to make CI pass.

## Roadmap-v2 execution rule
Do not rebuild working modules just because the roadmap describes a fresh architecture. Adapt the roadmap to the existing repository. Replace only the part that fails the roadmap gate.

Priority order:
1. Stabilise / audit the current repo.
2. Prove the premium true-scale shirt preview.
3. Extend fabric truth and provenance.
4. Connect designer rules and measurements to durable, versioned state.
5. Add lock/share/enquiry hardening.
6. Continue Style Director, final render QA and production bridge.

## Definition of done
For code changes:
- `npm run quality`
- `npm test`
- `npm run eval:engine`
- `npm run eval:preview-performance`
- `npm run release:check`
- `npm run build`

For UI changes:
- verify at 390px, 768px and 1440px widths
- no new console errors
- mobile Designer remains usable
- preview changes do not silently alter physical-scale claims

For architecture changes:
- update `DECISIONS.md`
- include migration / compatibility notes
- do not introduce a new dependency or schema shape silently

## Locked existing-model development directive (2026-10-12)
- **Continue means implement repository changes, not generate standalone AI images.** The user specifically rejected new people, substitute mannequins and new static turnaround renders as development progress.
- The fixed reference is `/designer/studio-tucked.webp`, identity `linen-earth-studio-model-v1`. Preserve the existing photographic Designer Studio UI and its intended faceless studio model, proportions and clothing silhouette. Do not infer a replacement person's face or hairstyle from speculative images.
- Work on the real source path in order: existing identity and Blender scene/mesh → body/garment alignment → neckline, shoulder, cuff/hand, waistband, seat, thigh and hems → UV orientation and measured physical textile scale → plausible fabric physics/drape and tailored construction → four-angle browser QA → operator physical/tailor evidence → production release.
- Keep prototype/demo geometry and approved realistic 3D sharply separated in labels, model selection, contracts and rollout. A configured GLB path or six material names are **not** proof of a finished realistic model. An asset must pass independent preflight before being presented as approved.
- Any actual model change must use the existing model identity contract, test regressions and preserve the canonical photo. Do not claim improved likeness without visual comparison to the source in all four angles, and never claim measured drape, stock truth, fit signoff or deployment without corresponding evidence.
- For a request to 'continue work', prioritize committed code, tests and a concise verified result over narration. Deploy only after a major clean milestone as previously directed; do not trigger per-phase production deploys.

## Working style for GPT / coding agents
- one scoped task at a time
- plan before editing
- touch the smallest reasonable file set
- keep logic out of large UI components when it can be a pure library function
- add tests with new rules
- report files changed, tests run and manual verification steps
