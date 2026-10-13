create or replace function public.handle_new_user()
returns trigger as $$
declare
  invite_record record;
  profile_role text;
  membership_role text;
begin
  select *
  into invite_record
  from public.user_invites
  where lower(email) = lower(new.email)
  order by created_at desc
  limit 1;

  profile_role := case
    when invite_record.role = 'admin' then 'admin'
    else 'viewer'
  end;

  insert into public.profiles (id, email, role, status, player_id)
  values (
    new.id,
    new.email,
    coalesce(profile_role, 'viewer'),
    'active',
    invite_record.player_id
  )
  on conflict (id) do nothing;

  if invite_record.workspace_id is not null then
    membership_role := case
      when invite_record.role = 'admin' then 'admin'
      else 'viewer'
    end;

    insert into public.workspace_memberships (workspace_id, user_id, role, player_id)
    values (invite_record.workspace_id, new.id, membership_role, invite_record.player_id)
    on conflict (workspace_id, user_id) do update
      set role = excluded.role,
          player_id = excluded.player_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;
