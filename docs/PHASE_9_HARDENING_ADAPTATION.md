# Phase 9 — Hardening & Public Launch Adaptation

Status: much of the engineering foundation already exists; remaining gates are predominantly real-device, real-user and operational evidence.

## Existing hardening foundation

- GitHub Actions quality pipeline.
- Locked dependency install and production dependency audit.
- Unit / regression tests for deterministic rules and physical-evidence boundaries.
- Designer benchmark / evaluation scripts.
- Preview-performance benchmark.
- Release-readiness checks.
- Production Next.js build gate.
- Recoverable global loading / error states.
- Operator device-QA workflow for mobile, tablet and desktop.
- Private Analyzer / construction / benchmark desks.
- Render rate limits and repair limits.
- Server-side secret boundaries.
- Global browser security headers for frame blocking, MIME sniff prevention, referrer policy, permission restrictions, COOP and HSTS.
- Evidence-aware customer copy instead of unsupported physical claims.

## Roadmap v2 adaptation

Public launch should be based on evidence, not simply whether `main` builds.

Required launch evidence:
1. Premium Shirt Proof physical scale + realism gate.
2. Fabric truth reviewed set.
3. Target-device acceptance.
4. Measurement / ease calibration evidence.
5. Five-customer Launch 1 flow without blocking bugs.
6. Render approval / cost evidence before Launch 2.
7. Production handoff / stock / quote evidence before Launch 3.

## Deployment note

Vercel preview failures caused solely by the free build-rate quota are infrastructure quota events, not application test failures. GitHub CI remains the code-health gate; production must still be separately verified READY before calling a release live.

## Completion gate

- [x] CI quality gate
- [x] deterministic regression tests
- [x] dependency audit
- [x] release-readiness script
- [x] device-QA evidence workflow
- [x] render cost protection
- [x] server secret boundary
- [x] baseline public security headers
- [ ] current Roadmap v2 branch CI green
- [ ] mobile accepted on target device
- [ ] tablet accepted on target device
- [ ] desktop accepted on target device
- [ ] private beta evidence collected
- [ ] security / privacy / legal launch checklist signed off
- [ ] production deployment verified READY
