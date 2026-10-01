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

## Working style for GPT / coding agents
- one scoped task at a time
- plan before editing
- touch the smallest reasonable file set
- keep logic out of large UI components when it can be a pure library function
- add tests with new rules
- report files changed, tests run and manual verification steps
