// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PayPalEnvironment = "sandbox" | "live";

export interface PlatformBillingConfigRow {
  id: number;
  provider: "paypal";
  monthly_price: number;
  currency: string;
  support_email?: string | null;
  checkout_enabled: boolean;
  is_live: boolean;
  paypal_product_id?: string | null;
  paypal_plan_id?: string | null;
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = authorization.replace("Bearer ", "");
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Unauthenticated request");
  }

  return data.user;
}

export function getPayPalBaseUrl(environment: PayPalEnvironment) {
  return environment === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPlatformBillingConfig() {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("platform_billing_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Platform billing config not found");
  return data as PlatformBillingConfigRow;
}

export async function getPayPalAccessToken(environment: PayPalEnvironment) {
  const clientId = Deno.env.get(environment === "live" ? "PAYPAL_LIVE_CLIENT_ID" : "PAYPAL_SANDBOX_CLIENT_ID");
  const clientSecret = Deno.env.get(environment === "live" ? "PAYPAL_LIVE_CLIENT_SECRET" : "PAYPAL_SANDBOX_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(`Missing PayPal ${environment} credentials`);
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${getPayPalBaseUrl(environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Failed to get PayPal access token");
  }

  return payload.access_token as string;
}

export async function fetchPayPalJson<T>(
  environment: PayPalEnvironment,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const accessToken = await getPayPalAccessToken(environment);
  const response = await fetch(`${getPayPalBaseUrl(environment)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error_description || payload.name || "PayPal request failed");
  }

  return payload as T;
}

export async function getWorkspaceAccess(adminClient: ReturnType<typeof createAdminClient>, userId: string, workspaceId: string) {
  const { data, error } = await adminClient
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getUserProfile(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, email, platform_role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getWorkspace(adminClient: ReturnType<typeof createAdminClient>, workspaceId: string) {
  const { data, error } = await adminClient
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Workspace not found");
  return data;
}

export function extractSubscriptionId(payload: any) {
  return payload?.resource?.id
    || payload?.resource?.subscription_id
    || payload?.id
    || null;
}

export function extractWorkspaceId(payload: any) {
  return payload?.resource?.custom_id
    || payload?.custom_id
    || null;
}

export function nextGracePeriodEnd(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
