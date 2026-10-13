create sequence if not exists public.workspace_league_number_seq as bigint;

alter table public.workspaces
  add column if not exists league_number bigint,
  add column if not exists self_join_enabled boolean not null default false;

update public.workspaces
set league_number = nextval('public.workspace_league_number_seq')
where league_number is null;

select setval(
  'public.workspace_league_number_seq',
  greatest(
    coalesce((select max(league_number) from public.workspaces), 0),
    1000
  ),
  true
);

alter table public.workspaces
  alter column league_number set default nextval('public.workspace_league_number_seq'),
  alter column league_number set not null;

create unique index if not exists idx_workspaces_league_number
  on public.workspaces(league_number);

create or replace function public.list_joinable_workspaces(search_term text default null)
returns table (
  id uuid,
  name text,
  slug text,
  league_number bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    w.name,
    w.slug,
    w.league_number
  from public.workspaces w
  where auth.uid() is not null
    and w.self_join_enabled = true
    and w.billing_status <> 'suspended'
    and (
      search_term is null
      or trim(search_term) = ''
      or lower(w.name) like '%' || lower(trim(search_term)) || '%'
      or lower(w.slug) like '%' || lower(trim(search_term)) || '%'
      or cast(w.league_number as text) like '%' || trim(search_term) || '%'
    )
  order by w.name asc;
$$;

create or replace function public.join_workspace(requested_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace record;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a league.';
  end if;

  select id, self_join_enabled, billing_status
  into target_workspace
  from public.workspaces
  where id = requested_workspace_id;

  if target_workspace.id is null then
    raise exception 'League not found.';
  end if;

  if target_workspace.self_join_enabled is not true then
    raise exception 'This league is not accepting self-serve sign-ups.';
  end if;

  if target_workspace.billing_status = 'suspended' then
    raise exception 'This league is currently unavailable.';
  end if;

  insert into public.workspace_memberships (workspace_id, user_id, role, player_id)
  values (target_workspace.id, auth.uid(), 'viewer', null)
  on conflict (workspace_id, user_id) do nothing;

  return target_workspace.id;
end;
$$;

create or replace function public.update_workspace_self_join(target_workspace_id uuid, enabled boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update league access.';
  end if;

  if not public.has_workspace_admin_access(target_workspace_id) then
    raise exception 'You do not have permission to update this league.';
  end if;

  update public.workspaces
  set self_join_enabled = enabled
  where id = target_workspace_id;

  return target_workspace_id;
end;
$$;
