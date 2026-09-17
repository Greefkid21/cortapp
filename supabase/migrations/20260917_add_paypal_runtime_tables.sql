create table if not exists public.paypal_checkout_sessions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  paypal_subscription_id text,
  paypal_plan_id text,
  status text not null default 'created'
    check (status in ('created', 'approved', 'active', 'cancelled', 'failed')),
  approval_url text,
  return_url text,
  cancel_url text,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_paypal_checkout_sessions_workspace_id
  on public.paypal_checkout_sessions(workspace_id);

create index if not exists idx_paypal_checkout_sessions_subscription_id
  on public.paypal_checkout_sessions(paypal_subscription_id);

drop trigger if exists set_paypal_checkout_sessions_updated_at on public.paypal_checkout_sessions;
create trigger set_paypal_checkout_sessions_updated_at
before update on public.paypal_checkout_sessions
for each row
execute function public.handle_updated_at();

create table if not exists public.paypal_webhook_events (
  id uuid primary key default uuid_generate_v4(),
  paypal_event_id text not null unique,
  event_type text not null,
  resource_type text,
  workspace_id uuid references public.workspaces(id) on delete set null,
  paypal_subscription_id text,
  verification_status text not null default 'received'
    check (verification_status in ('received', 'verified', 'invalid')),
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_paypal_webhook_events_workspace_id
  on public.paypal_webhook_events(workspace_id);

create index if not exists idx_paypal_webhook_events_subscription_id
  on public.paypal_webhook_events(paypal_subscription_id);

alter table public.paypal_checkout_sessions enable row level security;
alter table public.paypal_webhook_events enable row level security;

drop policy if exists "Workspace admins can read paypal checkout sessions" on public.paypal_checkout_sessions;
create policy "Workspace admins can read paypal checkout sessions"
on public.paypal_checkout_sessions
for select
using (public.has_workspace_admin_access(workspace_id));

drop policy if exists "Platform admins can read paypal webhook events" on public.paypal_webhook_events;
create policy "Platform admins can read paypal webhook events"
on public.paypal_webhook_events
for select
using (public.is_platform_admin());
