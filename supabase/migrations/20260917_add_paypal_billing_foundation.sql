alter table public.workspaces
  drop constraint if exists workspaces_billing_status_check;

alter table public.workspaces
  add column if not exists billing_pending_started_at timestamptz,
  add column if not exists paypal_subscription_status text not null default 'not_started',
  add column if not exists paypal_plan_id text,
  add column if not exists paypal_payer_id text,
  add column if not exists paypal_subscription_started_at timestamptz,
  add column if not exists paypal_subscription_ends_at timestamptz;

alter table public.workspaces
  alter column billing_status set default 'billing_pending';

alter table public.workspaces
  add constraint workspaces_billing_status_check
  check (billing_status in ('billing_pending', 'billable_active', 'grace_period', 'suspended', 'free_exempt'));

alter table public.workspaces
  drop constraint if exists workspaces_paypal_subscription_status_check;

alter table public.workspaces
  add constraint workspaces_paypal_subscription_status_check
  check (paypal_subscription_status in ('not_started', 'pending_approval', 'active', 'past_due', 'cancelled'));

update public.workspaces
set
  billing_status = case
    when is_billing_exempt then 'free_exempt'
    when paypal_subscription_id is null then 'billing_pending'
    else billing_status
  end,
  billing_pending_started_at = case
    when is_billing_exempt then billing_pending_started_at
    when paypal_subscription_id is null then coalesce(billing_pending_started_at, created_at, timezone('utc'::text, now()))
    else billing_pending_started_at
  end,
  paypal_subscription_status = case
    when is_billing_exempt then 'not_started'
    when paypal_subscription_id is null then coalesce(paypal_subscription_status, 'not_started')
    else coalesce(paypal_subscription_status, 'active')
  end
where billing_status <> 'free_exempt' or is_billing_exempt = true;

create table if not exists public.platform_billing_config (
  id integer primary key default 1 check (id = 1),
  provider text not null default 'paypal' check (provider in ('paypal')),
  monthly_price numeric(10,2) not null default 0,
  currency text not null default 'GBP',
  support_email text,
  checkout_enabled boolean not null default false,
  is_live boolean not null default false,
  paypal_product_id text,
  paypal_plan_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.platform_billing_config (
  id,
  provider,
  monthly_price,
  currency,
  checkout_enabled,
  is_live
)
values (
  1,
  'paypal',
  0,
  'GBP',
  false,
  false
)
on conflict (id) do nothing;

drop trigger if exists set_platform_billing_config_updated_at on public.platform_billing_config;
create trigger set_platform_billing_config_updated_at
before update on public.platform_billing_config
for each row
execute function public.handle_updated_at();

alter table public.platform_billing_config enable row level security;

drop policy if exists "Authenticated users can read platform billing config" on public.platform_billing_config;
create policy "Authenticated users can read platform billing config"
on public.platform_billing_config
for select
using (auth.role() = 'authenticated');

drop policy if exists "Platform admins can manage platform billing config" on public.platform_billing_config;
create policy "Platform admins can manage platform billing config"
on public.platform_billing_config
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());
