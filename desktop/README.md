# LLinen Earth OS

Private Windows operator software for LLinen Earth.

## What this is

The public website and the operator software are intentionally separate:

- **Website**: customer-facing discovery, Style Director, real LLinen Earth fabric selection, FASHN visualization and enquiry.
- **LLinen Earth OS**: private customers, leads, tailoring orders, measurements, payments, appointments, inventory, visuals, analytics, AI-assisted priorities and business memory.

The desktop app is built with **Tauri 2 + React + Motion**. Tauri owns the native Windows window and local data commands; React renders the operator interface; Motion is reserved for transitions that improve comprehension.

## Current operator modules

LLinen Earth OS currently includes:

- Today dashboard and staff priority board
- customer search and walk-in customer creation
- lead stages and follow-up tracking
- tailoring order pipeline from quote to collection
- Measurement Passport with in/cm support and fit/posture notes
- order value, deposits/payments and outstanding balance
- consultation, fitting, trial, pickup and delivery appointments
- overdue-order and upcoming-appointment attention
- printable tailoring job cards
- fabric inventory, metre counts, notes and stock status
- 157 seeded inventory entries from structured catalogs and the legacy site
- trusted FASHN visual library
- marketing intelligence and exportable creative briefs
- analytics and data-quality warnings
- AI Brain actions with Watch / Done / Dismissed state
- local-first event memory and cloud pairing
- automatic and manual backups with verification
- crash-recovery state
- Windows Credential Manager storage for private credentials
- desktop lock with idle re-lock

## Local data vault

By default the native app uses:

```text
%USERPROFILE%\Documents\LLinenEarthData\
  events\
  backups\
  visuals\
  imports\
```

Set `LLINEN_EARTH_DATA_DIR` before launching if the vault should live on another drive, for example:

```powershell
$env:LLINEN_EARTH_DATA_DIR="D:\LLinenEarthData"
```

The operator app stays local-first. Cloud sync adds a second event ledger; it does not expose the PC to inbound public access.

## Run in development

Requirements: Node.js 20+, Rust, and Tauri's Windows prerequisites.

```powershell
cd desktop
npm install
npm run desktop:dev
```

## Build the Windows installer

```powershell
cd desktop
npm install
npm run desktop:build
```

The repository's **Build LLinen Earth OS** GitHub Actions workflow validates the desktop frontend, builds the Windows **NSIS .exe installer**, creates a SHA-256 checksum file and uploads both as the `LLinen-Earth-OS-Windows` workflow artifact.

The installer is currently unsigned, so Windows SmartScreen can warn until code signing is added.

## Cloud pairing

Cloud sync code is already implemented. Production activation still requires a dedicated Supabase project and server secrets.

After those are configured:

1. Open **Memory → Cloud ↔ PC**.
2. Enter `https://<production-domain>/api/operator/sync`.
3. Paste the production `LLINEN_OPERATOR_SYNC_TOKEN`.
4. Pair the PC and run the first manual sync.

The sync token is stored in Windows Credential Manager. Only the non-secret endpoint and sync state remain in the local data vault.

See:

- `docs/cloud-production-runbook.md`
- `docs/production-connection.md`
- `supabase/migrations/20260920_style_events_hardening.sql`

## Data and security boundaries

- No payment-card numbers or payment credentials.
- No Aadhaar, PAN, passwords or unrelated personal files.
- Public browser code never receives operator sync, Supabase secret or operator-session secrets.
- Cloud event writes are server-mediated.
- Operator corrections are new append-only events rather than destructive history edits.
- Local backups remain available even when cloud sync is offline.

## Motion policy

Animation should improve comprehension rather than decorate every element.

Use motion for module changes, selected-customer transitions, changing business metrics, Style Director steps and visual-result replacement. Avoid continuous decorative animation in operator screens and respect `prefers-reduced-motion`.

## Production dependencies still outstanding

The application code is substantially in place. Remaining external deployment work is:

- create/connect the production Supabase project;
- apply and verify schema v5;
- configure production Vercel server secrets;
- run the end-to-end website → cloud → PC → Operator Desk verification;
- add Windows code signing before broad installer distribution.
