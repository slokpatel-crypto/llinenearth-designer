# LLinen Earth Local Memory Bridge

This bridge gives the LLinen Earth operator dashboard controlled access to a dedicated business data folder on the operator's computer. It does **not** expose the full hard drive.

## Recommended Windows folder

Use a dedicated folder such as:

```text
D:\LLinenEarthData\
  events\
  backups\
```

## Start the bridge

From the project folder:

```powershell
$env:LLINEN_EARTH_DATA_DIR="D:\LLinenEarthData"
$env:LLINEN_LOCAL_BRIDGE_TOKEN="choose-a-long-private-token"
$env:LLINEN_ALLOWED_ORIGINS="https://llinenearth-designer.vercel.app,http://localhost:3000"
npm run local-memory
```

If `LLINEN_LOCAL_BRIDGE_TOKEN` is not set, the bridge creates a temporary token and prints it in the terminal. A fixed token is better for daily use.

The bridge runs only on:

```text
http://127.0.0.1:4317
```

It is intentionally bound to the local machine, not the public internet.

## Pair the operator dashboard

1. Open `/operator`.
2. Keep the bridge terminal open.
3. Enter `http://127.0.0.1:4317`.
4. Paste the pairing token shown by the bridge.
5. Press **Pair / refresh**.

The token is kept in browser session storage, not permanently embedded in website code.

## What is written

The first version stores an append-only event record. Examples:

- style session started
- answer selected
- looks generated
- look selected
- visual requested / completed
- WhatsApp clicked
- store visit logged
- sale logged
- operator note

Event files are NDJSON, one JSON object per line:

```text
D:\LLinenEarthData\events\2026-09-20.ndjson
```

This format is intentionally simple: it is human-auditable, easy to back up, and can later be imported into SQLite, Postgres, analytics tools, or an AI knowledge index.

## Backups

The operator dashboard can request a local backup. Backups are written to:

```text
D:\LLinenEarthData\backups\
```

A backup contains the event history plus an aggregated business summary.

## Security model

- The bridge listens only on `127.0.0.1`.
- Every record/backup endpoint requires a bearer pairing token.
- Allowed browser origins are explicitly configured.
- The bridge accepts structured business events, not arbitrary file paths.
- There is no endpoint that lets the website browse, delete, rename, or execute arbitrary files.
- Do not place passwords, card information, Aadhaar/PAN scans, or other unnecessary sensitive information in the event payload.

## What this version covers

This local bridge captures sessions generated on the same operator/kiosk browser and gives the operator a durable hard-drive copy.

For customers using the public website on their own phones, a cloud intake/database is still required before those sessions can be mirrored down to the operator laptop. The website code is being structured so the cloud layer can be added without changing the operator record format.
