create extension if not exists "uuid-ossp";

alter table if exists public.profiles
  add column if not exists platform_role text not null default 'user'
  check (platform_role in ('user', 'platform_admin'));

create table if not exists public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  billing_status text not null default 'billable_active'
    check (billing_status in ('billable_active', 'grace_period', 'suspended', 'free_exempt')),
  billing_plan text not null default 'monthly'
    check (billing_plan in ('monthly')),
  is_billing_exempt boolean not null default false,
  billing_exempt_reason text,
  paypal_subscription_id text,
  grace_period_ends_at timestamptz,
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.workspace_memberships (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner_admin', 'admin', 'viewer')),
  player_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (workspace_id, user_id)
);

create index if not exists idx_workspace_memberships_user_id
  on public.workspace_memberships(user_id);

create index if not exists idx_workspace_memberships_workspace_id
  on public.workspace_memberships(workspace_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.handle_updated_at();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and platform_role = 'platform_admin'
  );
$$;

create or replace function public.default_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.workspace_memberships
  where user_id = auth.uid()
  order by
    case role
      when 'owner_admin' then 1
      when 'admin' then 2
      else 3
    end,
    created_at asc
  limit 1;
$$;

create or replace function public.has_workspace_access(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.workspace_memberships
      where workspace_id = target_workspace_id
        and user_id = auth.uid()
    );
$$;

create or replace function public.has_workspace_admin_access(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.workspace_memberships
      where workspace_id = target_workspace_id
        and user_id = auth.uid()
        and role in ('owner_admin', 'admin')
    );
$$;

create or replace function public.can_manage_workspace_player(target_workspace_id uuid, target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_workspace_admin_access(target_workspace_id)
    or exists (
      select 1
      from public.workspace_memberships
      where workspace_id = target_workspace_id
        and user_id = auth.uid()
        and player_id = target_player_id
    );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

drop policy if exists "Members can read their workspaces" on public.workspaces;
create policy "Members can read their workspaces"
on public.workspaces
for select
using (public.has_workspace_access(id));

drop policy if exists "Platform admins can manage workspaces" on public.workspaces;
create policy "Platform admins can manage workspaces"
on public.workspaces
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Members can read workspace memberships" on public.workspace_memberships;
create policy "Members can read workspace memberships"
on public.workspace_memberships
for select
using (public.has_workspace_access(workspace_id));

drop policy if exists "Workspace admins can manage memberships" on public.workspace_memberships;
create policy "Workspace admins can manage memberships"
on public.workspace_memberships
for all
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));

do $$
declare
  default_workspace uuid;
  first_owner uuid;
begin
  insert into public.workspaces (
    name,
    slug,
    billing_status,
    billing_plan,
    is_billing_exempt,
    billing_exempt_reason
  )
  values (
    '7 Hills',
    '7-hills',
    'free_exempt',
    'monthly',
    true,
    'Permanent free club'
  )
  on conflict (slug) do update
    set name = excluded.name,
        billing_status = 'free_exempt',
        billing_plan = 'monthly',
        is_billing_exempt = true,
        billing_exempt_reason = 'Permanent free club'
  returning id into default_workspace;

  update public.profiles
  set platform_role = 'platform_admin'
  where role = 'admin'
    and platform_role = 'user';

  insert into public.workspace_memberships (workspace_id, user_id, role, player_id)
  select
    default_workspace,
    p.id,
    case when p.role = 'admin' then 'owner_admin' else 'viewer' end,
    p.player_id
  from public.profiles p
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        player_id = excluded.player_id;

  select wm.user_id
  into first_owner
  from public.workspace_memberships wm
  where wm.workspace_id = default_workspace
    and wm.role = 'owner_admin'
  order by wm.created_at asc
  limit 1;

  if first_owner is not null then
    update public.workspaces
    set owner_user_id = first_owner
    where id = default_workspace;
  end if;
end $$;

alter table if exists public.players add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.seasons add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.matches add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.settings add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.user_invites add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.player_availability add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.player_holidays add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.messages add column if not exists workspace_id uuid references public.workspaces(id);
alter table if exists public.rules add column if not exists workspace_id uuid references public.workspaces(id);

update public.players
set workspace_id = (select id from public.workspaces where slug = '7-hills')
where workspace_id is null;

update public.seasons
set workspace_id = (select id from public.workspaces where slug = '7-hills')
where workspace_id is null;

update public.matches
set workspace_id = coalesce(
  matches.workspace_id,
  (select s.workspace_id from public.seasons s where s.id = matches.season_id),
  (select id from public.workspaces where slug = '7-hills')
)
where workspace_id is null;

update public.settings
set workspace_id = (select id from public.workspaces where slug = '7-hills')
where workspace_id is null;

update public.user_invites
set workspace_id = (select id from public.workspaces where slug = '7-hills')
where workspace_id is null;

update public.player_availability
set workspace_id = coalesce(
  player_availability.workspace_id,
  (select p.workspace_id from public.players p where p.id = player_availability.player_id),
  (select id from public.workspaces where slug = '7-hills')
)
where workspace_id is null;

update public.player_holidays
set workspace_id = coalesce(
  player_holidays.workspace_id,
  (select p.workspace_id from public.players p where p.id = player_holidays.player_id),
  (select id from public.workspaces where slug = '7-hills')
)
where workspace_id is null;

update public.messages
set workspace_id = coalesce(
  messages.workspace_id,
  (select m.workspace_id from public.matches m where m.id = messages.match_id),
  (select id from public.workspaces where slug = '7-hills')
)
where workspace_id is null;

update public.rules
set workspace_id = (select id from public.workspaces where slug = '7-hills')
where workspace_id is null;

alter table if exists public.players alter column workspace_id set default public.default_workspace_id();
alter table if exists public.seasons alter column workspace_id set default public.default_workspace_id();
alter table if exists public.matches alter column workspace_id set default public.default_workspace_id();
alter table if exists public.settings alter column workspace_id set default public.default_workspace_id();
alter table if exists public.user_invites alter column workspace_id set default public.default_workspace_id();
alter table if exists public.player_availability alter column workspace_id set default public.default_workspace_id();
alter table if exists public.player_holidays alter column workspace_id set default public.default_workspace_id();
alter table if exists public.messages alter column workspace_id set default public.default_workspace_id();
alter table if exists public.rules alter column workspace_id set default public.default_workspace_id();

alter table if exists public.players alter column workspace_id set not null;
alter table if exists public.seasons alter column workspace_id set not null;
alter table if exists public.matches alter column workspace_id set not null;
alter table if exists public.settings alter column workspace_id set not null;
alter table if exists public.user_invites alter column workspace_id set not null;
alter table if exists public.player_availability alter column workspace_id set not null;
alter table if exists public.player_holidays alter column workspace_id set not null;
alter table if exists public.messages alter column workspace_id set not null;
alter table if exists public.rules alter column workspace_id set not null;

create index if not exists idx_players_workspace_id on public.players(workspace_id);
create index if not exists idx_seasons_workspace_id on public.seasons(workspace_id);
create index if not exists idx_matches_workspace_id on public.matches(workspace_id);
create index if not exists idx_settings_workspace_id on public.settings(workspace_id);
create index if not exists idx_user_invites_workspace_id on public.user_invites(workspace_id);
create index if not exists idx_player_availability_workspace_id on public.player_availability(workspace_id);
create index if not exists idx_player_holidays_workspace_id on public.player_holidays(workspace_id);
create index if not exists idx_messages_workspace_id on public.messages(workspace_id);
create index if not exists idx_rules_workspace_id on public.rules(workspace_id);

drop policy if exists "Public read seasons" on public.seasons;
drop policy if exists "Auth insert seasons" on public.seasons;
drop policy if exists "Auth update seasons" on public.seasons;
create policy "Workspace read seasons"
on public.seasons
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert seasons"
on public.seasons
for insert
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace update seasons"
on public.seasons
for update
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));

drop policy if exists "Authenticated users can read players" on public.players;
drop policy if exists "Auth insert players" on public.players;
drop policy if exists "Auth update players" on public.players;
drop policy if exists "Auth delete players" on public.players;
create policy "Workspace read players"
on public.players
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert players"
on public.players
for insert
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace update players"
on public.players
for update
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace delete players"
on public.players
for delete
using (public.has_workspace_admin_access(workspace_id));

drop policy if exists "Public read matches" on public.matches;
drop policy if exists "Auth insert matches" on public.matches;
drop policy if exists "Auth update matches" on public.matches;
drop policy if exists "Auth delete matches" on public.matches;
create policy "Workspace read matches"
on public.matches
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert matches"
on public.matches
for insert
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace update matches"
on public.matches
for update
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace delete matches"
on public.matches
for delete
using (public.has_workspace_admin_access(workspace_id));

drop policy if exists "Settings are viewable by everyone" on public.settings;
drop policy if exists "Settings can be updated by authenticated users" on public.settings;
create policy "Workspace read settings"
on public.settings
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert settings"
on public.settings
for insert
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace update settings"
on public.settings
for update
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));

drop policy if exists "Auth read invites" on public.user_invites;
drop policy if exists "Auth insert invites" on public.user_invites;
drop policy if exists "Auth delete invites" on public.user_invites;
create policy "Workspace read invites"
on public.user_invites
for select
using (public.has_workspace_admin_access(workspace_id));
create policy "Workspace insert invites"
on public.user_invites
for insert
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace delete invites"
on public.user_invites
for delete
using (public.has_workspace_admin_access(workspace_id));

drop policy if exists "Public read availability" on public.player_availability;
drop policy if exists "Auth insert availability" on public.player_availability;
drop policy if exists "Auth update availability" on public.player_availability;
create policy "Workspace read availability"
on public.player_availability
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert availability"
on public.player_availability
for insert
with check (public.can_manage_workspace_player(workspace_id, player_id));
create policy "Workspace update availability"
on public.player_availability
for update
using (public.can_manage_workspace_player(workspace_id, player_id))
with check (public.can_manage_workspace_player(workspace_id, player_id));

drop policy if exists "Authenticated users can read holidays" on public.player_holidays;
drop policy if exists "Players or admins can insert holidays" on public.player_holidays;
drop policy if exists "Players or admins can delete holidays" on public.player_holidays;
create policy "Workspace read holidays"
on public.player_holidays
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert holidays"
on public.player_holidays
for insert
with check (public.can_manage_workspace_player(workspace_id, player_id));
create policy "Workspace delete holidays"
on public.player_holidays
for delete
using (public.can_manage_workspace_player(workspace_id, player_id));

drop policy if exists "Auth read messages" on public.messages;
drop policy if exists "Auth insert messages" on public.messages;
drop policy if exists "Auth delete messages" on public.messages;
create policy "Workspace read messages"
on public.messages
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert messages"
on public.messages
for insert
with check (
  auth.uid() = sender_user_id
  and public.has_workspace_access(workspace_id)
);
create policy "Workspace delete messages"
on public.messages
for delete
using (public.has_workspace_admin_access(workspace_id));

drop policy if exists "Rules are viewable by everyone" on public.rules;
drop policy if exists "Admins can insert rules" on public.rules;
drop policy if exists "Admins can update rules" on public.rules;
drop policy if exists "Admins can delete rules" on public.rules;
create policy "Workspace read rules"
on public.rules
for select
using (public.has_workspace_access(workspace_id));
create policy "Workspace insert rules"
on public.rules
for insert
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace update rules"
on public.rules
for update
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));
create policy "Workspace delete rules"
on public.rules
for delete
using (public.has_workspace_admin_access(workspace_id));
