# LLinen Earth OS

Private Windows operator software for LLinen Earth.

## What this is

The public website and the operator software are intentionally separate:

- **Website**: customer-facing discovery, Style Director, visual generation and enquiry.
- **LLinen Earth OS**: private customer intent, follow-up, outcomes, analytics and local memory.

The desktop app is built with **Tauri 2 + React + Motion**. Tauri owns the native Windows window and local data commands; React renders the operator interface; Motion handles restrained transitions between modules and data states.

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

The app does not expose an arbitrary file-browser command. Native commands currently support:

- dashboard summary
- append store-visit outcome
- append sale outcome
- create business-memory backup

## Run in development

Requirements: Node.js, Rust, Tauri's Windows prerequisites.

```powershell
cd desktop
npm install
npm run desktop:dev
```

## Build Windows installer

```powershell
cd desktop
npm install
npm run desktop:build
```

The repository also contains a GitHub Actions workflow that builds NSIS and MSI Windows installers and uploads them as a workflow artifact.

## Motion policy

Animation should improve comprehension rather than decorate every element.

Use motion for:

- module transitions
- selected-customer transitions
- expanding/updating business metrics
- Style Director step changes
- visual-result replacement

Avoid continuous decorative motion in operator screens. Respect `prefers-reduced-motion`.

## Next production layers

The native local-memory foundation is complete enough for local operation. Before customer data from the public website is treated as production CRM data, add:

- authenticated operator identity
- cloud database / session intake
- secure cloud-to-desktop sync
- conflict rules and sync cursor
- encrypted handling for data that requires it
- explicit retention/deletion policy
