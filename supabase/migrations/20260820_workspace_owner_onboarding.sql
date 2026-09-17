create or replace function public.create_workspace_for_owner(workspace_name text, requested_slug text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
  base_slug text;
  final_slug text;
  created_workspace_id uuid;
  existing_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a workspace.';
  end if;

  normalized_name := nullif(trim(workspace_name), '');
  if normalized_name is null then
    raise exception 'Workspace name is required.';
  end if;

  select workspace_id
  into existing_workspace_id
  from public.workspace_memberships
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  if existing_workspace_id is not null then
    return existing_workspace_id;
  end if;

  base_slug := lower(coalesce(nullif(trim(requested_slug), ''), normalized_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '(^-+)|(-+$)', '', 'g');
  base_slug := left(base_slug, 48);

  if base_slug = '' then
    base_slug := 'league';
  end if;

  final_slug := base_slug;
  while exists (select 1 from public.workspaces where slug = final_slug) loop
    final_slug := left(base_slug, 40) || '-' || substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6);
  end loop;

  insert into public.workspaces (
    name,
    slug,
    billing_status,
    billing_plan,
    is_billing_exempt,
    billing_pending_started_at,
    paypal_subscription_status,
    owner_user_id
  )
  values (
    normalized_name,
    final_slug,
    'billing_pending',
    'monthly',
    false,
    timezone('utc'::text, now()),
    'not_started',
    auth.uid()
  )
  returning id into created_workspace_id;

  insert into public.workspace_memberships (
    workspace_id,
    user_id,
    role
  )
  values (
    created_workspace_id,
    auth.uid(),
    'owner_admin'
  )
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;

  insert into public.settings (
    workspace_id,
    league_name,
    points_win,
    points_draw,
    points_loss
  )
  values (
    created_workspace_id,
    normalized_name,
    2,
    1,
    0
  );

  insert into public.seasons (
    workspace_id,
    name,
    start_date,
    is_active,
    is_draft,
    final_standings
  )
  values (
    created_workspace_id,
    'Season 1',
    current_date,
    true,
    false,
    jsonb_build_object('meta', jsonb_build_object('divisionCount', 1))
  );

  return created_workspace_id;
end;
$$;

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
  where email = new.email
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
