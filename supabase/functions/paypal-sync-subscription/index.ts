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

interface SyncSubscriptionRequest {
  workspaceId: string;
  subscriptionId?: string;
}

interface PayPalSubscriptionDetails {
  id: string;
  status: string;
  plan_id?: string;
  custom_id?: string;
  subscriber?: {
    payer_id?: string;
  };
  start_time?: string;
  billing_info?: {
    next_billing_time?: string;
  };
}

function mapSubscriptionState(details: PayPalSubscriptionDetails) {
  const status = details.status?.toUpperCase() || "UNKNOWN";

  if (status === "ACTIVE") {
    return {
      billing_status: "billable_active",
      billing_pending_started_at: null,
      paypal_subscription_status: "active",
      grace_period_ends_at: null,
    };
  }

  if (status === "APPROVAL_PENDING" || status === "APPROVED") {
    return {
      billing_status: "billing_pending",
      paypal_subscription_status: "pending_approval",
    };
  }

  if (status === "SUSPENDED") {
    return {
      billing_status: "grace_period",
      paypal_subscription_status: "past_due",
      grace_period_ends_at: nextGracePeriodEnd(),
    };
  }

  if (status === "CANCELLED" || status === "EXPIRED") {
    return {
      billing_status: "suspended",
      paypal_subscription_status: "cancelled",
    };
  }

  return {
    billing_status: "billing_pending",
    paypal_subscription_status: "pending_approval",
  };
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
    const { workspaceId, subscriptionId }: SyncSubscriptionRequest = await req.json();

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

    const effectiveSubscriptionId = subscriptionId || workspace.paypal_subscription_id;
    if (!effectiveSubscriptionId) {
      throw new Error("No PayPal subscription ID is stored for this workspace yet.");
    }

    const environment = billingConfig.is_live ? "live" : "sandbox";
    const details = await fetchPayPalJson<PayPalSubscriptionDetails>(
      environment,
      `/v1/billing/subscriptions/${effectiveSubscriptionId}`
    );

    const stateUpdate = mapSubscriptionState(details);
    const { error: workspaceUpdateError } = await adminClient
      .from("workspaces")
      .update({
        ...stateUpdate,
        paypal_subscription_id: details.id,
        paypal_plan_id: details.plan_id || workspace.paypal_plan_id,
        paypal_payer_id: details.subscriber?.payer_id || workspace.paypal_payer_id,
        paypal_subscription_started_at: details.start_time || workspace.paypal_subscription_started_at,
        paypal_subscription_ends_at: details.billing_info?.next_billing_time || workspace.paypal_subscription_ends_at,
      })
      .eq("id", workspaceId);

    if (workspaceUpdateError) throw workspaceUpdateError;

    const sessionStatus =
      details.status?.toUpperCase() === "ACTIVE"
        ? "active"
        : details.status?.toUpperCase() === "CANCELLED"
          ? "cancelled"
          : "approved";

    await adminClient
      .from("paypal_checkout_sessions")
      .update({
        status: sessionStatus,
      })
      .eq("workspace_id", workspaceId)
      .eq("paypal_subscription_id", details.id);

    return new Response(JSON.stringify({
      subscriptionId: details.id,
      status: details.status,
      workspaceId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to sync PayPal subscription." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
