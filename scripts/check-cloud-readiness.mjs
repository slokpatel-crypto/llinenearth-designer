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
const readBrandEnv = (name) => process.env[name]?.trim() || process.env[`L${name}`]?.trim() || "";
const legacyBrandIdentifier = (name) => `l${name}`;
const syncToken = readBrandEnv("LINEN_OPERATOR_SYNC_TOKEN");
const sessionSecret = readBrandEnv("LINEN_OPERATOR_SESSION_SECRET");
const memorySessionSecret = readBrandEnv("LINEN_MEMORY_SESSION_SECRET");
const passwordHash = readBrandEnv("LINEN_OPERATOR_PASSWORD_HASH");

console.log("Linen Earth cloud readiness\n");

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

if (!syncToken || syncToken.length < 24) fail("LINEN_OPERATOR_SYNC_TOKEN is missing or too short.");
else ok("Desktop sync token is configured.");

if (!sessionSecret || sessionSecret.length < 32) fail("LINEN_OPERATOR_SESSION_SECRET is missing or too short.");
else ok("Operator session signing secret is configured.");

if (!memorySessionSecret || memorySessionSecret.length < 32) fail("LINEN_MEMORY_SESSION_SECRET is missing or too short.");
else ok("Public memory session signing secret is configured.");

if (!passwordHash?.startsWith("scrypt-v1$")) fail("LINEN_OPERATOR_PASSWORD_HASH is missing or not a supported scrypt hash.");
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

      const callHealth = (rpcName) => fetch(
        `${url.replace(/\/$/, "")}/rest/v1/rpc/${rpcName}`,
        { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: "{}" },
      );
      let healthResponse = await callHealth("linen_cloud_health");
      if (!healthResponse.ok && healthResponse.status === 404) {
        healthResponse = await callHealth(legacyBrandIdentifier("linen_cloud_health"));
      }
      if (!healthResponse.ok) {
        fail("Cloud health RPC is missing. Apply the latest Supabase migration.");
      } else {
        const health = await healthResponse.json();
        if (Number(health?.schemaVersion) !== 5) {
          fail(`Unsupported cloud schema version: ${String(health?.schemaVersion)}`);
        } else {
          ok("Hardened Linen cloud schema v5 is installed.");
        }

        if (!health?.tableExists) fail("style_events table is missing.");
        else ok("style_events table exists.");

        if (!health?.rlsEnabled) fail("RLS is not enabled on style_events.");
        else ok("RLS is enabled.");

        if (health?.anonSelect || health?.anonInsert) fail("anon still has direct style_events access.");
        else ok("anon has no direct style_events access.");

        if (health?.authenticatedSelect || health?.authenticatedInsert) fail("authenticated role still has direct style_events access.");
        else ok("authenticated role has no direct style_events access.");

        if (!health?.serviceSelect || !health?.serviceInsert) fail("Server role is missing SELECT/INSERT on style_events.");
        else ok("Server role has required SELECT/INSERT.");

        if (health?.serviceUpdate || health?.serviceDelete) fail("Server role can mutate/delete historical events.");
        else ok("Server role cannot UPDATE/DELETE the append-only ledger.");

        const rpcChecks = [
          ["fabric_stock_snapshot",{p_fabric_ids:null},"Fabric stock ledger RPCs are installed."],
          ["production_quote_list",{p_limit:1},"Production quote ledger RPCs are installed."],
          ["production_order_list",{p_limit:1},"Production order ledger RPCs are installed."],
          ["designer_locked_revision_vault_get",{p_vault_id:"00000000-0000-4000-8000-000000000000",p_access_hash:"0".repeat(64)},"Locked design recovery vault RPCs are installed."],
          ["measurement_profile_vault_get",{p_vault_id:"00000000-0000-4000-8000-000000000000",p_access_hash:"0".repeat(64)},"Measurement recovery vault RPCs are installed."],
        ];
        for (const [rpcName,payload,label] of rpcChecks) {
          const rpcResponse = await fetch(
            `${url.replace(/\/$/, "")}/rest/v1/rpc/${rpcName}`,
            {
              method:"POST",
              headers:{...headers,"content-type":"application/json"},
              body:JSON.stringify(payload),
            },
          );
          if (!rpcResponse.ok) {
            const detail=(await rpcResponse.text()).replace(/\s+/g," ").slice(0,160);
            fail(`${rpcName} is unavailable. Apply Roadmap v2 Supabase migrations. HTTP ${rpcResponse.status}: ${detail}`);
          } else {
            ok(label);
          }
        }
      }
    }
  } catch (error) {
    fail(`Supabase request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!process.exitCode) {
  console.log("\nCloud foundation is ready for website ↔ Linen Earth OS sync.");
} else {
  console.log("\nCloud foundation is not production-ready yet.");
}
