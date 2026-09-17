// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createAdminClient,
  extractSubscriptionId,
  extractWorkspaceId,
  fetchPayPalJson,
  getPlatformBillingConfig,
  nextGracePeriodEnd,
} from "../_shared/paypal.ts";

function updateFromEventType(eventType: string) {
  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
      return {
        billing_status: "billable_active",
        billing_pending_started_at: null,
        paypal_subscription_status: "active",
        grace_period_ends_at: null,
      };
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      return {
        billing_status: "suspended",
        paypal_subscription_status: "cancelled",
      };
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "PAYMENT.SALE.DENIED":
      return {
        billing_status: "grace_period",
        paypal_subscription_status: "past_due",
        grace_period_ends_at: nextGracePeriodEnd(),
      };
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      return {
        billing_status: "grace_period",
        paypal_subscription_status: "past_due",
        grace_period_ends_at: nextGracePeriodEnd(),
      };
    default:
      return null;
  }
}

async function verifyWebhook(body: string, eventBody: any, environment: "sandbox" | "live") {
  const webhookId = Deno.env.get(environment === "live" ? "PAYPAL_LIVE_WEBHOOK_ID" : "PAYPAL_SANDBOX_WEBHOOK_ID");
  if (!webhookId) {
    return { verification_status: "received" as const, verified: true };
  }

  const transmissionId = eventBody.headers["paypal-transmission-id"];
  const transmissionTime = eventBody.headers["paypal-transmission-time"];
  const certUrl = eventBody.headers["paypal-cert-url"];
  const authAlgo = eventBody.headers["paypal-auth-algo"];
  const transmissionSig = eventBody.headers["paypal-transmission-sig"];

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return { verification_status: "invalid" as const, verified: false };
  }

  const verificationPayload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: JSON.parse(body),
  };

  const verificationResponse = await fetchPayPalJson<{ verification_status: string }>(
    environment,
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify(verificationPayload),
    }
  );

  const verified = verificationResponse.verification_status === "SUCCESS";
  return {
    verification_status: verified ? "verified" as const : "invalid" as const,
    verified,
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

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const billingConfig = await getPlatformBillingConfig();
    const environment = billingConfig.is_live ? "live" : "sandbox";
    const verification = await verifyWebhook(rawBody, {
      headers: {
        "paypal-transmission-id": req.headers.get("paypal-transmission-id"),
        "paypal-transmission-time": req.headers.get("paypal-transmission-time"),
        "paypal-cert-url": req.headers.get("paypal-cert-url"),
        "paypal-auth-algo": req.headers.get("paypal-auth-algo"),
        "paypal-transmission-sig": req.headers.get("paypal-transmission-sig"),
      },
    }, environment);

    const adminClient = createAdminClient();
    const eventId = payload.id;
    const eventType = payload.event_type;
    const subscriptionId = extractSubscriptionId(payload);
    let workspaceId = extractWorkspaceId(payload);

    if (!workspaceId && subscriptionId) {
      const { data: workspaceBySubscription } = await adminClient
        .from("workspaces")
        .select("id")
        .eq("paypal_subscription_id", subscriptionId)
        .maybeSingle();
      workspaceId = workspaceBySubscription?.id || null;
    }

    const { error: eventInsertError } = await adminClient
      .from("paypal_webhook_events")
      .upsert({
        paypal_event_id: eventId,
        event_type: eventType,
        resource_type: payload.resource_type || null,
        workspace_id: workspaceId,
        paypal_subscription_id: subscriptionId,
        verification_status: verification.verification_status,
        payload,
      }, { onConflict: "paypal_event_id" });

    if (eventInsertError) throw eventInsertError;

    if (!verification.verified) {
      return new Response(JSON.stringify({ received: true, verified: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 202,
      });
    }

    const workspacePatch = updateFromEventType(eventType);
    if (workspaceId && workspacePatch) {
      const updatePayload: Record<string, unknown> = {
        ...workspacePatch,
      };

      if (subscriptionId) {
        updatePayload.paypal_subscription_id = subscriptionId;
      }

      const resource = payload.resource || {};
      if (resource.plan_id) updatePayload.paypal_plan_id = resource.plan_id;
      if (resource.subscriber?.payer_id) updatePayload.paypal_payer_id = resource.subscriber.payer_id;
      if (resource.start_time) updatePayload.paypal_subscription_started_at = resource.start_time;
      if (resource.billing_info?.next_billing_time) updatePayload.paypal_subscription_ends_at = resource.billing_info.next_billing_time;

      const { error: workspaceUpdateError } = await adminClient
        .from("workspaces")
        .update(updatePayload)
        .eq("id", workspaceId);

      if (workspaceUpdateError) throw workspaceUpdateError;

      if (subscriptionId) {
        const sessionStatus =
          eventType === "BILLING.SUBSCRIPTION.ACTIVATED"
            ? "active"
            : eventType === "BILLING.SUBSCRIPTION.CANCELLED" || eventType === "BILLING.SUBSCRIPTION.EXPIRED"
              ? "cancelled"
              : "approved";

        await adminClient
          .from("paypal_checkout_sessions")
          .update({ status: sessionStatus })
          .eq("workspace_id", workspaceId)
          .eq("paypal_subscription_id", subscriptionId);
      }
    }

    return new Response(JSON.stringify({ received: true, verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "PayPal webhook handling failed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
