// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createAdminClient,
  getPlatformBillingConfig,
  getUserProfile,
  getWorkspace,
  getWorkspaceAccess,
  fetchPayPalJson,
  requireAuthenticatedUser,
} from "../_shared/paypal.ts";

interface CreateSubscriptionRequest {
  workspaceId: string;
}

interface PayPalCreateSubscriptionResponse {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
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
    const { workspaceId }: CreateSubscriptionRequest = await req.json();

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

    if (workspace.is_billing_exempt || workspace.billing_status === "free_exempt") {
      throw new Error("This workspace is marked as free and does not require PayPal billing.");
    }

    if (!billingConfig.checkout_enabled) {
      throw new Error("PayPal checkout is not enabled yet.");
    }

    if (!billingConfig.paypal_plan_id) {
      throw new Error("PayPal plan ID is not configured yet.");
    }

    const environment = billingConfig.is_live ? "live" : "sandbox";
    const origin = req.headers.get("origin") || "https://cortapp.vercel.app";
    const returnUrl = `${origin}/settings?paypal=success&workspace=${workspaceId}`;
    const cancelUrl = `${origin}/settings?paypal=cancelled&workspace=${workspaceId}`;

    const paypalResponse = await fetchPayPalJson<PayPalCreateSubscriptionResponse>(environment, "/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: billingConfig.paypal_plan_id,
        custom_id: workspaceId,
        application_context: {
          brand_name: "Cortapp",
          user_action: "SUBSCRIBE_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
        subscriber: profile?.email ? { email_address: profile.email } : undefined,
      }),
    });

    const approvalUrl = paypalResponse.links?.find((link) => link.rel === "approve")?.href;
    if (!approvalUrl) {
      throw new Error("PayPal did not return an approval URL.");
    }

    const subscriptionId = paypalResponse.id;

    const { error: sessionError } = await adminClient
      .from("paypal_checkout_sessions")
      .insert({
        workspace_id: workspaceId,
        created_by_user_id: currentUser.id,
        paypal_subscription_id: subscriptionId,
        paypal_plan_id: billingConfig.paypal_plan_id,
        status: "created",
        approval_url: approvalUrl,
        return_url: returnUrl,
        cancel_url: cancelUrl,
      });

    if (sessionError) throw sessionError;

    const { error: workspaceUpdateError } = await adminClient
      .from("workspaces")
      .update({
        billing_status: "billing_pending",
        billing_pending_started_at: workspace.billing_pending_started_at || new Date().toISOString(),
        paypal_subscription_id: subscriptionId,
        paypal_plan_id: billingConfig.paypal_plan_id,
        paypal_subscription_status: paypalResponse.status?.toLowerCase() === "active" ? "active" : "pending_approval",
      })
      .eq("id", workspaceId);

    if (workspaceUpdateError) throw workspaceUpdateError;

    return new Response(JSON.stringify({
      approvalUrl,
      subscriptionId,
      status: paypalResponse.status,
      environment,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to create PayPal subscription." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
