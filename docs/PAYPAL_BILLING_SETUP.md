# PayPal Billing Setup

Use this guide to finish the paid multi-club billing setup for Cortapp.

This project already includes:

- workspace billing states in the database
- PayPal billing Edge Functions
- platform billing controls in the app
- owner-facing billing actions in Settings

This guide covers the remaining operational steps needed in Supabase and PayPal.

## 1. Apply The Database Changes

Make sure these migrations are present in the target Supabase project:

- `supabase/migrations/20260820_add_workspaces_foundation.sql`
- `supabase/migrations/20260820_workspace_owner_onboarding.sql`
- `supabase/migrations/20260917_add_paypal_billing_foundation.sql`
- `supabase/migrations/20260917_add_paypal_runtime_tables.sql`

If you are applying them manually, run them in date order.

## 2. Required Edge Functions

Deploy these Supabase Edge Functions:

```bash
supabase functions deploy send-email
supabase functions deploy paypal-create-subscription
supabase functions deploy paypal-sync-subscription
supabase functions deploy paypal-cancel-subscription
supabase functions deploy paypal-webhook
```

Function folders:

- `supabase/functions/send-email`
- `supabase/functions/paypal-create-subscription`
- `supabase/functions/paypal-sync-subscription`
- `supabase/functions/paypal-cancel-subscription`
- `supabase/functions/paypal-webhook`

## 3. Required Supabase Secrets

Set these secrets in Supabase before turning on PayPal checkout:

```bash
supabase secrets set PAYPAL_SANDBOX_CLIENT_ID=...
supabase secrets set PAYPAL_SANDBOX_CLIENT_SECRET=...
supabase secrets set PAYPAL_SANDBOX_WEBHOOK_ID=...
supabase secrets set PAYPAL_LIVE_CLIENT_ID=...
supabase secrets set PAYPAL_LIVE_CLIENT_SECRET=...
supabase secrets set PAYPAL_LIVE_WEBHOOK_ID=...
supabase secrets set RESEND_API_KEY=...
```

The PayPal functions also rely on the normal Supabase runtime values supplied by the Edge Functions platform:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not place any PayPal secret or Supabase service role key in the frontend `.env`.

## 4. Webhook URL

Your PayPal webhook URL should be:

```text
https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/paypal-webhook
```

If the app is already connected to Supabase, the Platform billing page shows the exact URL and lets you copy it.

## 5. PayPal Dashboard Setup

Create or confirm these items in PayPal:

1. A product for the Cortapp subscription service.
2. A monthly billing plan linked to that product.
3. A webhook pointing to the Supabase `paypal-webhook` endpoint.

After that, save the following values in the Platform billing page:

- monthly price
- currency
- support email
- PayPal product ID
- PayPal plan ID
- sandbox vs live mode
- whether checkout is enabled

Do not enable customer checkout until:

- all functions are deployed
- all secrets are set
- the webhook is registered
- the plan ID is saved in the Platform billing page

## 6. PayPal Webhook Events To Register

Register these events in PayPal because they match the events handled by the webhook code:

- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.DENIED`

These events drive workspace billing changes such as:

- `billing_pending`
- `billable_active`
- `grace_period`
- `suspended`

## 7. Billing Flow In This App

Current intended flow:

1. Club owner signs up.
2. Club owner creates a workspace.
3. Workspace starts in `billing_pending`.
4. Platform admin configures the PayPal plan and enables checkout.
5. Workspace owner opens `Settings` and starts PayPal billing.
6. Owner approves the subscription in PayPal.
7. The app syncs the subscription state on return.
8. PayPal webhooks keep the workspace billing state updated afterwards.

## 8. Owner Actions Available In The App

From the workspace owner's `Settings` page:

- start PayPal billing
- refresh PayPal status
- cancel PayPal billing

From the platform admin `Platform` page:

- control billing states manually
- mark clubs free or exempt
- configure PayPal rollout settings
- copy the webhook URL
- copy deploy commands
- copy secret setup commands

## 9. Recommended Go-Live Order

Use this order for the safest rollout:

1. Apply SQL migrations.
2. Deploy all PayPal Edge Functions.
3. Add Supabase secrets.
4. Create PayPal product and monthly plan.
5. Register the webhook URL and required events in PayPal sandbox.
6. Save sandbox PayPal IDs in the Platform billing page.
7. Enable checkout in sandbox mode.
8. Test a full owner signup, workspace creation, approval, sync, and cancellation flow.
9. Switch to live PayPal credentials and live plan IDs only after sandbox testing is successful.

## 10. Testing Checklist

Before going live, confirm all of the following:

- a new workspace starts as `billing_pending`
- the owner can open PayPal checkout from `Settings`
- returning from PayPal updates the workspace billing status
- webhook events are recorded in `paypal_webhook_events`
- checkout sessions are recorded in `paypal_checkout_sessions`
- cancelling a subscription moves the workspace into `grace_period`
- a free or exempt workspace does not allow PayPal billing to start

## 11. Related Files

- `src/pages/PlatformClubs.tsx`
- `src/pages/Settings.tsx`
- `supabase/functions/_shared/paypal.ts`
- `supabase/functions/paypal-create-subscription/index.ts`
- `supabase/functions/paypal-sync-subscription/index.ts`
- `supabase/functions/paypal-cancel-subscription/index.ts`
- `supabase/functions/paypal-webhook/index.ts`
