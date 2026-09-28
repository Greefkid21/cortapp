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

  if exists (
    select 1
    from public.workspace_memberships
    where user_id = auth.uid()
  ) then
    return (
      select workspace_id
      from public.workspace_memberships
      where user_id = auth.uid()
      order by created_at asc
      limit 1
    );
  end if;

  select *
  into invite_record
  from public.user_invites
  where lower(email) = lower(current_profile.email)
    and workspace_id is not null
  order by created_at desc
  limit 1;

  if invite_record.workspace_id is null then
    return null;
  end if;

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

  return invite_record.workspace_id;
end;
$$;
