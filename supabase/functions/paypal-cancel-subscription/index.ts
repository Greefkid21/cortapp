// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createAdminClient,
  fetchPayPalJson,
  getPlatformBillingConfig,
  getUserProfile,
  getWorkspace,
  getWorkspaceAccess,
  nextGracePeriodEnd,
  requireAuthenticatedUser,
} from "../_shared/paypal.ts";

interface CancelSubscriptionRequest {
  workspaceId: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    const currentUser = await requireAuthenticatedUser(req);
    const { workspaceId, reason }: CancelSubscriptionRequest = await req.json();

    if (!workspaceId) {
      throw new Error("workspaceId is required");
    }

    const adminClient = createAdminClient();
    const [billingConfig, workspace, membership, profile] = await Promise.all([
      getPlatformBillingConfig(),
      getWorkspace(adminClient, workspaceId),
      getWorkspaceAccess(adminClient, currentUser.id, workspaceId),
      getUserProfile(adminClient, currentUser.id),
    ]);

    const hasWorkspaceAdminAccess =
      profile?.platform_role === "platform_admin" ||
      membership?.role === "owner_admin" ||
      membership?.role === "admin";

    if (!hasWorkspaceAdminAccess) {
      return new Response(JSON.stringify({ error: "You do not have billing access for this workspace." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    if (!workspace.paypal_subscription_id) {
      throw new Error("No PayPal subscription is stored for this workspace.");
    }

    const environment = billingConfig.is_live ? "live" : "sandbox";
    await fetchPayPalJson(
      environment,
      `/v1/billing/subscriptions/${workspace.paypal_subscription_id}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: reason || "Cancelled by workspace admin",
        }),
      }
    );

    const { error: workspaceUpdateError } = await adminClient
      .from("workspaces")
      .update({
        billing_status: "grace_period",
        paypal_subscription_status: "cancelled",
        grace_period_ends_at: nextGracePeriodEnd(),
      })
      .eq("id", workspaceId);

    if (workspaceUpdateError) throw workspaceUpdateError;

    await adminClient
      .from("paypal_checkout_sessions")
      .update({
        status: "cancelled",
      })
      .eq("workspace_id", workspaceId)
      .eq("paypal_subscription_id", workspace.paypal_subscription_id);

    return new Response(JSON.stringify({
      workspaceId,
      subscriptionId: workspace.paypal_subscription_id,
      status: "cancelled",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to cancel PayPal subscription." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
