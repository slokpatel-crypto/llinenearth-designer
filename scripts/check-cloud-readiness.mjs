import process from "node:process";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`! ${message}`);
}

const url = process.env.SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const key = secret || legacy;
const syncToken = process.env.LLINEN_OPERATOR_SYNC_TOKEN?.trim();
const sessionSecret = process.env.LLINEN_OPERATOR_SESSION_SECRET?.trim();
const memorySessionSecret = process.env.LLINEN_MEMORY_SESSION_SECRET?.trim();
const passwordHash = process.env.LLINEN_OPERATOR_PASSWORD_HASH?.trim();

console.log("LLinen Earth cloud readiness\n");

if (!url) {
  fail("SUPABASE_URL is missing.");
} else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") fail("SUPABASE_URL must use HTTPS.");
    else ok(`Supabase endpoint configured for ${parsed.hostname}.`);
  } catch {
    fail("SUPABASE_URL is invalid.");
  }
}

if (!key) {
  fail("No Supabase elevated server key is configured.");
} else if (secret) {
  if (!secret.startsWith("sb_secret_")) warn("SUPABASE_SECRET_KEY does not use the expected sb_secret_ prefix.");
  else ok("Modern Supabase secret key is configured.");
} else {
  ok("Legacy service_role key is configured (supported fallback).");
  warn("Plan to migrate to SUPABASE_SECRET_KEY before legacy service_role keys are retired.");
}

if (!syncToken || syncToken.length < 24) fail("LLINEN_OPERATOR_SYNC_TOKEN is missing or too short.");
else ok("Desktop sync token is configured.");

if (!sessionSecret || sessionSecret.length < 32) fail("LLINEN_OPERATOR_SESSION_SECRET is missing or too short.");
else ok("Operator session signing secret is configured.");

if (!memorySessionSecret || memorySessionSecret.length < 32) fail("LLINEN_MEMORY_SESSION_SECRET is missing or too short.");
else ok("Public memory session signing secret is configured.");

if (!passwordHash?.startsWith("scrypt-v1$")) fail("LLINEN_OPERATOR_PASSWORD_HASH is missing or not a supported scrypt hash.");
else ok("Operator password hash is configured.");

if (url && key) {
  try {
    const headers = { apikey: key, accept: "application/json" };
    if (!secret) headers.authorization = `Bearer ${key}`;

    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/style_events?select=id,received_at&order=received_at.desc&limit=1`,
      { headers },
    );

    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 180);
      fail(`style_events check failed with HTTP ${response.status}: ${detail}`);
    } else {
      const rows = await response.json();
      ok(`style_events is reachable (${rows.length ? "existing data found" : "table is empty"}).`);
    }
  } catch (error) {
    fail(`Supabase request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!process.exitCode) {
  console.log("\nCloud foundation is ready for website ↔ LLinen Earth OS sync.");
} else {
  console.log("\nCloud foundation is not production-ready yet.");
}
