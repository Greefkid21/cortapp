create or replace function public.handle_new_user()
returns trigger as $$
declare
  invite_record record;
  selected_player_id uuid;
  profile_role text := 'viewer';
  membership_role text;
begin
  select player_id
  into selected_player_id
  from public.user_invites
  where lower(email) = lower(new.email)
    and player_id is not null
  order by created_at desc
  limit 1;

  if exists (
    select 1
    from public.user_invites
    where lower(email) = lower(new.email)
      and role = 'admin'
  ) then
    profile_role := 'admin';
  end if;

  insert into public.profiles (id, email, role, status, player_id)
  values (
    new.id,
    new.email,
    profile_role,
    'active',
    selected_player_id
  )
  on conflict (id) do nothing;

  for invite_record in
    select workspace_id, role, player_id
    from public.user_invites
    where lower(email) = lower(new.email)
      and workspace_id is not null
    order by created_at asc
  loop
    membership_role := case
      when invite_record.role = 'admin' then 'admin'
      else 'viewer'
    end;

    insert into public.workspace_memberships (workspace_id, user_id, role, player_id)
    values (invite_record.workspace_id, new.id, membership_role, invite_record.player_id)
    on conflict (workspace_id, user_id) do update
      set role = excluded.role,
          player_id = coalesce(excluded.player_id, public.workspace_memberships.player_id);
  end loop;

  return new;
end;
$$ language plpgsql security definer;

create or replace function public.ensure_workspace_membership_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile record;
  invite_record record;
  membership_role text;
  preferred_workspace_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select id, email, player_id
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.email is null then
    return null;
  end if;

  for invite_record in
    select workspace_id, role, player_id
    from public.user_invites
    where lower(email) = lower(current_profile.email)
      and workspace_id is not null
    order by created_at asc
  loop
    membership_role := case
      when invite_record.role = 'admin' then 'admin'
      else 'viewer'
    end;

    insert into public.workspace_memberships (workspace_id, user_id, role, player_id)
    values (
      invite_record.workspace_id,
      auth.uid(),
      membership_role,
      coalesce(invite_record.player_id, current_profile.player_id)
    )
    on conflict (workspace_id, user_id) do update
      set role = excluded.role,
          player_id = coalesce(excluded.player_id, public.workspace_memberships.player_id);
  end loop;

  select workspace_id
  into preferred_workspace_id
  from public.workspace_memberships
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  return preferred_workspace_id;
end;
$$;
