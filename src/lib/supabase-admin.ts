import "server-only";

export type SupabaseAdminConfig = {
  url: string;
  key: string;
  keyKind: "secret" | "legacy-service-role";
};

export function getSupabaseAdminConfig(): SupabaseAdminConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const preferred = process.env.SUPABASE_SECRET_KEY?.trim();
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = preferred || legacy;
  if (!url || !key) return null;

  return {
    url: url.replace(/\/$/, ""),
    key,
    keyKind: key.startsWith("sb_secret_") ? "secret" : "legacy-service-role",
  };
}

export function supabaseAdminHeaders(config: SupabaseAdminConfig): Record<string,string> {
  if (config.keyKind === "secret") {
    return {
      apikey: config.key,
    };
  }

  return {
    apikey: config.key,
    authorization: `Bearer ${config.key}`,
  };
}
