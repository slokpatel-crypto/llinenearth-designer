# Phase 4 — Measurements and Fit Adaptation

Status: advanced foundation already exists; calibration and durable persistence remain.

## Existing code we keep
The current repository already has:
- guided shirt and trouser measurement capture.
- blueprint-style highlighted measurement lines.
- plausibility ranges.
- body-profile integration with the Designer.
- manual tailoring observations for shoulder balance, posture, seat balance and mobility.
- provisional finished-garment targets.
- provisional starting-block strategy.
- explicit tailor-review warnings before cutting.

The roadmap therefore does **not** require a new measurement system.

## House ease calibration
The provisional ease ranges live in a versioned house table:
- `src/lib/designer/house-ease.ts`
- version: `linen-earth-house-ease-provisional-v1`

Any owner-approved calibration change must:
1. be based on measured finished garments / tailor data,
2. change the table version,
3. preserve the prior version in locked design history where required,
4. pass regression tests before release.

## Remaining physical calibration work
Roadmap v2 calls for replacing generic starting ease with Linen Earth evidence.

Target calibration set:
- at least 20 real finished garments
- record body measurement
- record finished garment measurement
- record selected fit
- record wearer / tailor outcome
- compare resulting actual ease against provisional bands

First metrics:
- median chest target error
- median sleeve target error
- alteration / correction frequency by fit
- recurring shoulder / posture / seat corrections

## Persistence gap
Current measurement capture still uses browser storage for convenience.

Before Launch 1 operational reliance:
- [ ] keep local autosave for speed
- [ ] create durable authenticated measurement-profile persistence
- [ ] version profile revisions instead of overwriting silently
- [ ] keep explicit customer consent / deletion path
- [ ] ensure locked designs reference the measurement revision used at lock time

## Acceptance gate
- [x] guided measurement capture
- [x] plausibility ranges
- [x] finished-garment target engine
- [x] starting-block strategy
- [x] manual tailoring observations
- [x] versioned provisional house ease table
- [ ] 20-garment calibration dataset
- [ ] owner-approved calibrated ease version
- [ ] 10 real people compared with tailor measurements
- [ ] target median chest error < 1.5 cm
- [ ] target median sleeve error < 1.0 cm
- [ ] durable measurement revision persistence
