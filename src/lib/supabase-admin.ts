import "server-only";

export type SupabaseAdminConfig = {
  url: string;
  key: string;
};

export function getSupabaseAdminConfig(): SupabaseAdminConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function supabaseAdminHeaders(config: SupabaseAdminConfig) {
  return {
    apikey: config.key,
    authorization: `Bearer ${config.key}`,
  };
}
