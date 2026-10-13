insert into public.workspace_memberships (workspace_id, user_id, role, player_id)
select
  w.id,
  w.owner_user_id,
  'owner_admin',
  null
from public.workspaces w
where w.owner_user_id is not null
on conflict (workspace_id, user_id) do update
  set role = 'owner_admin';

create or replace function public.ensure_workspace_membership_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile record;
  invite_record record;
  owned_workspace record;
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

  for owned_workspace in
    select id
    from public.workspaces
    where owner_user_id = auth.uid()
  loop
    insert into public.workspace_memberships (workspace_id, user_id, role, player_id)
    values (owned_workspace.id, auth.uid(), 'owner_admin', current_profile.player_id)
    on conflict (workspace_id, user_id) do update
      set role = 'owner_admin',
          player_id = coalesce(public.workspace_memberships.player_id, excluded.player_id);
  end loop;

  if current_profile.email is not null then
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
  end if;

  select workspace_id
  into preferred_workspace_id
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

  return preferred_workspace_id;
end;
$$;
