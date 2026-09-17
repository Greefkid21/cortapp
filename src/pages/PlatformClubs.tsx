import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgePoundSterling, CheckCircle2, Copy, PauseCircle, Save, Shield, Sparkles, TerminalSquare, Webhook } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PlatformBillingConfig, Workspace, WorkspaceBillingStatus } from '../types';
import { useAuth } from '../context/AuthContext';

type WorkspaceRow = Workspace & {
  ownerEmail?: string;
};

const STATUS_OPTIONS: Array<{ value: WorkspaceBillingStatus; label: string }> = [
  { value: 'billing_pending', label: 'Billing Pending' },
  { value: 'billable_active', label: 'Billable Active' },
  { value: 'grace_period', label: 'Grace Period' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'free_exempt', label: 'Free / Exempt' },
];

const defaultBillingConfig: PlatformBillingConfig = {
  id: 1,
  provider: 'paypal',
  monthlyPrice: 0,
  currency: 'GBP',
  checkoutEnabled: false,
  isLive: false,
};

function mapWorkspace(row: any, ownerEmail?: string): WorkspaceRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    billingStatus: row.billing_status,
    billingPlan: row.billing_plan,
    isBillingExempt: row.is_billing_exempt,
    billingExemptReason: row.billing_exempt_reason || undefined,
    gracePeriodEndsAt: row.grace_period_ends_at || undefined,
    billingPendingStartedAt: row.billing_pending_started_at || undefined,
    ownerUserId: row.owner_user_id || undefined,
    paypalSubscriptionStatus: row.paypal_subscription_status || undefined,
    paypalSubscriptionId: row.paypal_subscription_id || undefined,
    paypalPlanId: row.paypal_plan_id || undefined,
    paypalPayerId: row.paypal_payer_id || undefined,
    paypalSubscriptionStartedAt: row.paypal_subscription_started_at || undefined,
    paypalSubscriptionEndsAt: row.paypal_subscription_ends_at || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
    ownerEmail,
  };
}

function statusClasses(status: WorkspaceBillingStatus) {
  if (status === 'billing_pending') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (status === 'free_exempt') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'grace_period') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'suspended') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function PlatformClubs() {
  const { platformRole } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [billingConfig, setBillingConfig] = useState<PlatformBillingConfig>(defaultBillingConfig);
  const [billingConfigDraft, setBillingConfigDraft] = useState<PlatformBillingConfig>(defaultBillingConfig);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [draftReasons, setDraftReasons] = useState<Record<string, string>>({});
  const [draftGraceDates, setDraftGraceDates] = useState<Record<string, string>>({});

  const isPlatformAdmin = platformRole === 'platform_admin';

  const loadWorkspaces = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [{ data, error: workspaceError }, { data: configRow, error: configError }] = await Promise.all([
      supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase
        .from('platform_billing_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    if (workspaceError) {
      console.error('Error loading workspaces:', workspaceError);
      setError(workspaceError.message);
      setLoading(false);
      return;
    }

    if (configError) {
      console.error('Error loading billing config:', configError);
      setError((current) => current || configError.message);
    } else if (configRow) {
      const mappedConfig: PlatformBillingConfig = {
        id: configRow.id,
        provider: configRow.provider,
        monthlyPrice: Number(configRow.monthly_price || 0),
        currency: configRow.currency || 'GBP',
        supportEmail: configRow.support_email || undefined,
        checkoutEnabled: !!configRow.checkout_enabled,
        isLive: !!configRow.is_live,
        paypalProductId: configRow.paypal_product_id || undefined,
        paypalPlanId: configRow.paypal_plan_id || undefined,
        createdAt: configRow.created_at || undefined,
        updatedAt: configRow.updated_at || undefined,
      };
      setBillingConfig(mappedConfig);
      setBillingConfigDraft(mappedConfig);
    }

    const ownerIds = Array.from(new Set((data || []).map((workspace: any) => workspace.owner_user_id).filter(Boolean)));
    let ownerEmailMap = new Map<string, string>();

    if (ownerIds.length > 0) {
      const { data: owners, error: ownerError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', ownerIds);

      if (ownerError) {
        console.error('Error loading workspace owners:', ownerError);
      } else {
        ownerEmailMap = new Map((owners || []).map((owner: any) => [owner.id, owner.email]));
      }
    }

    const mapped = (data || []).map((workspace: any) => mapWorkspace(workspace, ownerEmailMap.get(workspace.owner_user_id)));
    setWorkspaces(mapped);
    setDraftReasons(Object.fromEntries(mapped.map((workspace) => [workspace.id, workspace.billingExemptReason || ''])));
    setDraftGraceDates(Object.fromEntries(mapped.map((workspace) => [workspace.id, workspace.gracePeriodEndsAt ? workspace.gracePeriodEndsAt.slice(0, 10) : ''])));
    setLoading(false);
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const stats = useMemo(() => {
    return {
      total: workspaces.length,
      pending: workspaces.filter((workspace) => workspace.billingStatus === 'billing_pending').length,
      free: workspaces.filter((workspace) => workspace.billingStatus === 'free_exempt').length,
      grace: workspaces.filter((workspace) => workspace.billingStatus === 'grace_period').length,
      suspended: workspaces.filter((workspace) => workspace.billingStatus === 'suspended').length,
    };
  }, [workspaces]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/paypal-webhook` : 'https://YOUR-PROJECT.supabase.co/functions/v1/paypal-webhook';
  const deployCommands = [
    'supabase functions deploy paypal-create-subscription',
    'supabase functions deploy paypal-sync-subscription',
    'supabase functions deploy paypal-cancel-subscription',
    'supabase functions deploy paypal-webhook',
  ].join('\n');
  const secretCommands = [
    'supabase secrets set PAYPAL_SANDBOX_CLIENT_ID=...',
    'supabase secrets set PAYPAL_SANDBOX_CLIENT_SECRET=...',
    'supabase secrets set PAYPAL_SANDBOX_WEBHOOK_ID=...',
    'supabase secrets set PAYPAL_LIVE_CLIENT_ID=...',
    'supabase secrets set PAYPAL_LIVE_CLIENT_SECRET=...',
    'supabase secrets set PAYPAL_LIVE_WEBHOOK_ID=...',
  ].join('\n');

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied`);
      window.setTimeout(() => setCopyMessage(''), 2000);
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error);
      setCopyMessage(`Could not copy ${label}`);
      window.setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  const saveBillingConfig = async () => {
    if (!supabase) return;
    setSavingConfig(true);
    setError('');

    const { error: configSaveError } = await supabase
      .from('platform_billing_config')
      .upsert({
        id: 1,
        provider: 'paypal',
        monthly_price: billingConfigDraft.monthlyPrice,
        currency: billingConfigDraft.currency,
        support_email: billingConfigDraft.supportEmail || null,
        checkout_enabled: billingConfigDraft.checkoutEnabled,
        is_live: billingConfigDraft.isLive,
        paypal_product_id: billingConfigDraft.paypalProductId || null,
        paypal_plan_id: billingConfigDraft.paypalPlanId || null,
      });

    setSavingConfig(false);

    if (configSaveError) {
      console.error('Error saving billing config:', configSaveError);
      setError(configSaveError.message);
      return;
    }

    await loadWorkspaces();
  };

  const updateWorkspace = async (workspaceId: string, updates: Record<string, any>) => {
    if (!supabase) return;
    setSavingId(workspaceId);
    setError('');

    const { error: updateError } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', workspaceId);

    setSavingId(null);

    if (updateError) {
      console.error('Error updating workspace billing:', updateError);
      setError(updateError.message);
      return;
    }

    await loadWorkspaces();
  };

  if (!isPlatformAdmin) {
    return (
      <div className="brand-panel p-6 sm:p-7">
        <div className="flex items-center gap-3 text-slate-800">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h2 className="brand-heading text-2xl">Platform Access Required</h2>
            <p className="brand-subtle mt-2">This page is only available to the platform admin account.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="brand-panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="brand-kicker mb-3">Platform Admin</div>
            <h2 className="brand-heading text-3xl sm:text-4xl">Club Billing Control</h2>
            <p className="brand-subtle mt-2 max-w-2xl">
              Manage billing pending clubs, free exemptions, grace periods, suspensions, and the PayPal rollout settings without changing the customer workspace data.
            </p>
          </div>
          <button
            onClick={loadWorkspaces}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-black font-black hover:bg-[#f4dc00] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Refresh Clubs
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Total Clubs</div>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Billing Pending</div>
          <div className="text-3xl font-black text-violet-700 mt-2">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Free / Exempt</div>
          <div className="text-3xl font-black text-emerald-700 mt-2">{stats.free}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Grace Period</div>
          <div className="text-3xl font-black text-amber-700 mt-2">{stats.grace}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Suspended</div>
          <div className="text-3xl font-black text-rose-700 mt-2">{stats.suspended}</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
        <div>
          <div className="brand-kicker mb-2">PayPal Foundation</div>
          <h3 className="text-2xl font-black text-slate-900">Platform Billing Settings</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Set the monthly price and store the PayPal plan identifiers now. Checkout stays disabled until the live PayPal flow and webhooks are ready.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Monthly Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={billingConfigDraft.monthlyPrice}
              onChange={(event) => setBillingConfigDraft((current) => ({ ...current, monthlyPrice: Number(event.target.value || 0) }))}
              className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Currency</label>
            <input
              type="text"
              value={billingConfigDraft.currency}
              onChange={(event) => setBillingConfigDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() || 'GBP' }))}
              className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Support Email</label>
            <input
              type="email"
              value={billingConfigDraft.supportEmail || ''}
              onChange={(event) => setBillingConfigDraft((current) => ({ ...current, supportEmail: event.target.value }))}
              placeholder="billing@yourclub.com"
              className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">PayPal Product ID</label>
            <input
              type="text"
              value={billingConfigDraft.paypalProductId || ''}
              onChange={(event) => setBillingConfigDraft((current) => ({ ...current, paypalProductId: event.target.value }))}
              placeholder="Optional for later"
              className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">PayPal Plan ID</label>
            <input
              type="text"
              value={billingConfigDraft.paypalPlanId || ''}
              onChange={(event) => setBillingConfigDraft((current) => ({ ...current, paypalPlanId: event.target.value }))}
              placeholder="Optional for later"
              className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="flex flex-col gap-3 justify-end">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={billingConfigDraft.checkoutEnabled}
                onChange={(event) => setBillingConfigDraft((current) => ({ ...current, checkoutEnabled: event.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-semibold text-slate-700">Enable customer checkout</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={billingConfigDraft.isLive}
                onChange={(event) => setBillingConfigDraft((current) => ({ ...current, isLive: event.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-semibold text-slate-700">Use live PayPal mode</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={saveBillingConfig}
            disabled={savingConfig}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-black hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingConfig ? 'Saving Billing Settings...' : 'Save Billing Settings'}
          </button>
          <div className="text-sm text-slate-500">
            Current display price: <span className="font-semibold text-slate-700">{billingConfig.currency} {billingConfig.monthlyPrice.toFixed(2)} / month</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
        <div>
          <div className="brand-kicker mb-2">Deployment Help</div>
          <h3 className="text-2xl font-black text-slate-900">Webhook And Deploy Details</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Use these exact values when wiring PayPal into Supabase and when handing setup notes to your developer or host.
          </p>
        </div>

        {copyMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {copyMessage}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-black">
              <Webhook className="w-4 h-4 text-primary" />
              PayPal Webhook URL
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-sm text-slate-700 break-all">
              {webhookUrl}
            </div>
            <button
              onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-black transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Webhook URL
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-black">
              <TerminalSquare className="w-4 h-4 text-primary" />
              PayPal Setup Checklist
            </div>
            <div className="text-sm text-slate-600 space-y-2">
              <div>1. Save the monthly price, currency, and PayPal plan ID here.</div>
              <div>2. Deploy the four billing Edge Functions.</div>
              <div>3. Add PayPal client and webhook secrets in Supabase.</div>
              <div>4. Register the webhook URL in PayPal for subscription events.</div>
              <div>5. Turn on checkout only after PayPal is fully configured.</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="text-sm font-black text-slate-900">Deploy Commands</div>
            <pre className="rounded-xl bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto whitespace-pre-wrap">{deployCommands}</pre>
            <button
              onClick={() => copyToClipboard(deployCommands, 'Deploy commands')}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-black hover:bg-teal-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Deploy Commands
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="text-sm font-black text-slate-900">Secret Commands</div>
            <pre className="rounded-xl bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto whitespace-pre-wrap">{secretCommands}</pre>
            <button
              onClick={() => copyToClipboard(secretCommands, 'Secret commands')}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-black hover:bg-teal-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Secret Commands
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-slate-500">Loading clubs...</div>
        ) : workspaces.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-slate-500">No club workspaces found yet.</div>
        ) : (
          workspaces.map((workspace) => {
            const reason = draftReasons[workspace.id] ?? '';
            const graceDate = draftGraceDates[workspace.id] ?? '';
            return (
              <div key={workspace.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">{workspace.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold ${statusClasses(workspace.billingStatus)}`}>
                        <BadgePoundSterling className="w-3.5 h-3.5" />
                        {STATUS_OPTIONS.find((option) => option.value === workspace.billingStatus)?.label || workspace.billingStatus}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 mt-2 space-y-1">
                      <div>Slug: <span className="font-semibold text-slate-700">{workspace.slug}</span></div>
                      <div>Owner: <span className="font-semibold text-slate-700">{workspace.ownerEmail || 'Not assigned yet'}</span></div>
                      <div>Plan: <span className="font-semibold text-slate-700">Monthly</span></div>
                      <div>PayPal status: <span className="font-semibold text-slate-700">{workspace.paypalSubscriptionStatus || 'not_started'}</span></div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {workspace.isBillingExempt ? (
                      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        Billing Exempt
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold">
                        <AlertCircle className="w-4 h-4" />
                        Billable Club
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Exemption Reason</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(event) => setDraftReasons((current) => ({ ...current, [workspace.id]: event.target.value }))}
                      placeholder="Optional reason, e.g. Permanent free club"
                      className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Billing Status</label>
                    <select
                      value={workspace.billingStatus}
                      onChange={(event) => {
                        const nextStatus = event.target.value as WorkspaceBillingStatus;
                        updateWorkspace(workspace.id, {
                          billing_status: nextStatus,
                          is_billing_exempt: nextStatus === 'free_exempt',
                          billing_exempt_reason: nextStatus === 'free_exempt' ? (reason || 'Manually exempted by platform admin') : null,
                        });
                      }}
                      className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
                      disabled={savingId === workspace.id}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Grace Period Ends</label>
                    <input
                      type="date"
                      value={graceDate}
                      onChange={(event) => setDraftGraceDates((current) => ({ ...current, [workspace.id]: event.target.value }))}
                      className="w-full p-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => updateWorkspace(workspace.id, {
                      billing_status: 'billing_pending',
                      is_billing_exempt: false,
                      billing_exempt_reason: null,
                      billing_pending_started_at: new Date().toISOString(),
                      paypal_subscription_status: workspace.paypalSubscriptionId ? 'pending_approval' : 'not_started',
                      grace_period_ends_at: null,
                    })}
                    disabled={savingId === workspace.id}
                    className="px-4 py-3 rounded-xl bg-violet-600 text-white font-black hover:bg-violet-700 transition-colors disabled:opacity-50"
                  >
                    Mark Pending
                  </button>
                  <button
                    onClick={() => updateWorkspace(workspace.id, {
                      billing_status: 'free_exempt',
                      is_billing_exempt: true,
                      billing_exempt_reason: reason || 'Manually exempted by platform admin',
                      billing_pending_started_at: null,
                      paypal_subscription_status: 'not_started',
                      grace_period_ends_at: null,
                    })}
                    disabled={savingId === workspace.id}
                    className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Make Free
                  </button>
                  <button
                    onClick={() => updateWorkspace(workspace.id, {
                      billing_status: 'billable_active',
                      is_billing_exempt: false,
                      billing_exempt_reason: null,
                      billing_pending_started_at: null,
                      paypal_subscription_status: workspace.paypalSubscriptionId ? 'active' : workspace.paypalSubscriptionStatus || 'not_started',
                      grace_period_ends_at: null,
                    })}
                    disabled={savingId === workspace.id}
                    className="px-4 py-3 rounded-xl bg-primary text-white font-black hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    Resume Billing
                  </button>
                  <button
                    onClick={() => updateWorkspace(workspace.id, {
                      billing_status: 'grace_period',
                      is_billing_exempt: false,
                      billing_pending_started_at: null,
                      grace_period_ends_at: graceDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    })}
                    disabled={savingId === workspace.id}
                    className="px-4 py-3 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    Set Grace Period
                  </button>
                  <button
                    onClick={() => updateWorkspace(workspace.id, {
                      billing_status: 'suspended',
                      is_billing_exempt: false,
                      billing_pending_started_at: null,
                    })}
                    disabled={savingId === workspace.id}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    <PauseCircle className="w-4 h-4" />
                    Suspend
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
