# TITAN main intake 8 — real signed built-Next operator HTTP rejection evidence

Date: 2026-11-01. Stack strictly after isolated #664 → #663 → #662 → #661 → #660 and verified/merged #659/#658. Do not bring unrelated thousands of development commits into main.

The preceding source/unit checks are insufficient on their own to prove that the actual protected Next.js production route enforces authentication, same-origin browser requests, JSON shape and decoded byte limits after production build. Add a **CI-only signed real-HTTP acceptance script** that starts in the existing built Next server step, before the expensive 3D viewer tests.

The script uses a synthetic signed operator cookie generated from the CI-only session secret. It sends **unsupported actions only**, so it does not call production RPCs or change an order, quote, delivery, customer or supplier stock. With the signed cookie, the 400 unsupported-action reply establishes authentication works; foreign Origin, loopback hostname mismatch, and Sec-Fetch-Site cross-site must 403; text/plain must 415; a 70 KiB decoded JSON body must 413; invalid JSON/non-object must 400; missing cookie must 401. Every refusal must be private/no-store, generic, and free from upstream/PostgREST secrets.

A static contract test ensures the source, the workflow ordering and no legitimate mutation action are present. Passing synthetic CI evidence does not establish a real signed operator's customer/production workflow or any live Supabase integration. Before main merge, require final exact-head CI including the real HTTP gate, independent Non-3D QA, sequential parent merges, and current `vercel.json git.deploymentEnabled=false`. No Vercel deployment, production writes, physical fit/stock, Blender four-view or owner launch approval.
