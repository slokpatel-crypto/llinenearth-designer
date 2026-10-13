#!/usr/bin/env node
/**
 * One-time, explicit, bounded Claude research harvest.
 *
 * Run ONCE from a trusted server-side environment while a valid key exists:
 *   node scripts/harvest-anthropic-knowledge.mjs --execute
 *
 * Without --execute, this produces a plan and makes ZERO network requests.
 * Outputs are suggestions requiring human review, NOT verified fabric facts,
 * measurements, SKU stock, physical drape evidence or tailor approval.
 *
 * No key or user data is stored in the output. Do not commit private images.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const KNOWLEDGE_PACKS = [
  {
    id: "fabric-material-judgement",
    objective: "Safe material-family language and observable vs measurable evidence for plain linen, printed linen, blends and formal shirting. Explicitly separate what a photograph shows from what only a lab or supplier specification proves.",
    focus: "Fibre blends, linen/viscose/polyester, material weight and handle; appearance limitations; humid-climate fabric judgement.",
  },
  {
    id: "physical-pattern-calibration",
    objective: "Practical repeat-in-millimetres, stripe width, plaid alignment, warp/weft orientation and lighting/color calibration protocols for an exact-scale preview. Include measurement tools and uncertainty.",
    focus: "Calibration workflow; swatch macro and flat captures; uncertainty, px_per_mm, repeat_mm, color chart and Delta E. Do not invent fabric measurements.",
  },
  {
    id: "shirt-tailoring-construction",
    objective: "Actionable construction-reference patterns for spread/British, button-down, mandarin and camp collars, soft/barrel/French cuffs, plackets, tucks, yokes, sleeves and contrasting white cuffs.",
    focus: "Buildability, dress code, interfacing decisions as hypotheses, physical fit caveats, button selection, and tailor handoff inspection.",
  },
  {
    id: "trouser-and-cross-garment-rules",
    objective: "Context-based high/mid rise, flat/pleated, tapered/straight/Korean-wide and waistband/drape/trouser-break pairing rules with tucked and untucked shirt proportions.",
    focus: "Compatible shirt length, trousers, occasion, climate, negative combinations, needs measurement, and styling explanation.",
  },
  {
    id: "style-director-capsules",
    objective: "Smart capsule styling recipes for work, weddings, travel, everyday, celebrations and dates, including quiet/sharp/relaxed/statement moods for premium linen clothing.",
    focus: "At most two hero materials in a recipe; avoid assumptions about live stock, price, GSM, stretch, colour accuracy and exact fibre purity.",
  },
  {
    id: "three-d-model-qa",
    objective: "Independent four-view tests for garment realism on the SAME fixed photographic model identity, collar neck closure, shoulder fit, underarm collisions, cuff and trouser fall, UV and physically measured fabric repeats.",
    focus: "Front, three-quarter, side, back; 1.5 mm body-contact goal; tri counts; mobile 20s viewer readiness; geometry failures must stay release-blocking.",
  },
  {
    id: "operator-evidence-and-tailor-handoff",
    objective: "Supplier evidence worksheet, source-of-truth field provenance and checks for stock, measured fabric repeat, fabric batch, actual client measurements, ease, approval workflow and production-safe handoff.",
    focus: "Human approval and audit trail; never elevate model inferences to supplier-verified facts.",
  },
  {
    id: "ai-safety-and-regression-evaluation",
    objective: "Failure cases and adversarial tests for an AI assistant: unsupported textile claims, SKU hallucinations, visual identity swaps, contradictory tailoring, unmeasured scale, key expiry, prompt injection and misleading confidence.",
    focus: "Reproducible input, expected fail-closed behavior, data provenance, acceptance checklist and non-AI deterministic fallback.",
  },
];

const SYSTEM = [
  "You advise Linen Earth engineers about fabric and men's tailored clothing.",
  "Produce only structured knowledge hypotheses and testable guidance.",
  "Never infer exact GSM, fibre ratio, pattern repeat, stock, price, colour accuracy, drape coefficient or owner/tailor approval from trade labels.",
  "Do not imply you inspected a real cloth sample or executed testing.",
  "Do not fabricate external citations, brand sources, precise measurements or published studies.",
  "Every fact-like claim must explain whether it is a general heuristic or requires supplier/tailor measurement.",
  "Use practical Indian warm-weather context but do not overgeneralize.",
  "Return ONLY a JSON object with key 'entries' and 8 to 12 entries.",
  "Each entry must contain ONLY: id, guideline, reason, applicableWhen, verifyWith, riskIfWrong, evidenceLevel.",
  "All fields are strings. evidenceLevel must be either 'heuristic' or 'requires_measurement'.",
  "Keep each field under 240 characters and use human-readable, specific details.",
].join(" ");

export function validatePack(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.entries)) throw Error("Missing entries");
  if (value.entries.length < 8 || value.entries.length > 12) throw Error("Entry count must be 8-12");
  const ids = new Set();
  return value.entries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw Error("Malformed entry");
    const fields = ["id","guideline","reason","applicableWhen","verifyWith","riskIfWrong","evidenceLevel"];
    const obj = {};
    for (const key of fields) {
      if (typeof entry[key] !== "string") throw Error("Missing string field: " + key);
      const str = entry[key].trim();
      if (str.length < 2 || str.length > 240) throw Error("Invalid field length: " + key);
      obj[key] = str;
    }
    if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(obj.id) || ids.has(obj.id)) throw Error("Duplicate/unsafe entry id");
    if (!["heuristic","requires_measurement"].includes(obj.evidenceLevel)) throw Error("Unsafe evidence level");
    ids.add(obj.id);
    return obj;
  });
}

function parseMessage(payload) {
  const blocks = payload && Array.isArray(payload.content) ? payload.content : [];
  const value = blocks.filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text).join("\n").trim();
  if (value.length > 65_000 || !value.startsWith("{") || !value.endsWith("}")) {
    throw Error("Claude did not return a JSON object");
  }
  return JSON.parse(value);
}

export async function harvestOnePack(pack, key, model) {
  if (!pack || !KNOWLEDGE_PACKS.some((item) => item.id === pack.id)) throw Error("Unknown research pack");
  if (typeof key !== "string" || !key) throw Error("Missing Anthropic key");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: controller.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 2800, temperature: 0.2, system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify({
          project: "Linen Earth Deep Engine",
          status: "research suggestions, not physically reviewed",
          task: pack.objective,
          focus: pack.focus,
        }) }],
      }),
    });
    if (!response.ok) throw Error("Anthropic returned HTTP " + response.status + " for " + pack.id);
    const body = await response.json();
    return { entries: validatePack(parseMessage(body)), usage: body.usage || null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHarvest({ execute = false, out = "artifacts/anthropic-knowledge" } = {}) {
  if (!execute) {
    return { dryRun: true, packCount: KNOWLEDGE_PACKS.length, packs: KNOWLEDGE_PACKS.map((pack) => pack.id) };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Error("ANTHROPIC_API_KEY missing; no outbound calls were made.");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  const target = path.resolve(out);
  await mkdir(target, { recursive: true });
  const manifest = { version: 1, generator: "Anthropic Messages API", model, reviewStatus: "unreviewed", source: "ai-generated-suggestions", createdAt: new Date().toISOString(), packs: [] };
  for (const pack of KNOWLEDGE_PACKS) {
    // Explicit eight-request maximum, without retries or fabricated completions.
    const { entries, usage } = await harvestOnePack(pack, key, model);
    const file = pack.id + ".json";
    const document = {
      schemaVersion: 1,
      id: pack.id,
      source: "ai-generated-suggestions",
      reviewStatus: "unreviewed",
      physicalEvidenceVerified: false,
      createdAt: manifest.createdAt,
      model,
      objective: pack.objective,
      entries,
    };
    await writeFile(path.join(target, file), JSON.stringify(document, null, 2) + "\n", { flag: "w", mode: 0o600 });
    manifest.packs.push({ id: pack.id, file, count: entries.length, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null });
    process.stdout.write("Saved " + pack.id + " (" + entries.length + " unreviewed entries)\n");
  }
  await writeFile(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "w", mode: 0o600 });
  return { dryRun: false, output: target, packs: manifest.packs.length, entries: manifest.packs.reduce((total, pack) => total + pack.count, 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const execute = process.argv.includes("--execute");
  const i = process.argv.indexOf("--out");
  const out = i >= 0 ? process.argv[i + 1] : undefined;
  runHarvest({ execute, ...(out ? { out } : {}) })
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2) + "\n"))
    .catch((error) => {
      process.stderr.write("Harvest stopped safely: " + String(error instanceof Error ? error.message : error) + "\n");
      process.exitCode = 1;
    });
}
