-- 1. Update the trigger to make the first user an admin automatically
create or replace function public.handle_new_user() 
returns trigger as $$
declare
  invite_record record;
  admin_count int;
begin
  -- Check if there are any existing admins
  select count(*) into admin_count from public.profiles where role = 'admin';

  -- Check if there is an invite for this email
  select * into invite_record from public.user_invites where email = new.email order by created_at desc limit 1;
  
  if admin_count = 0 then
    -- First user is always admin
    insert into public.profiles (id, email, role, status)
    values (new.id, new.email, 'admin', 'active');
  elsif invite_record.email is not null then
    -- Found invite, use its role and player_id
    insert into public.profiles (id, email, role, status, player_id)
    values (new.id, new.email, invite_record.role, 'active', invite_record.player_id);
  else
    -- No invite, default to viewer
    insert into public.profiles (id, email, role, status)
    values (new.id, new.email, 'viewer', 'active');
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- 2. Make all existing users admins (Run this if you already signed up)
update public.profiles set role = 'admin';
