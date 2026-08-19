-- Urgent privacy fix:
-- 1. Stop public/anonymous access to player records.
-- 2. Stop public/anonymous access to profile emails.
-- 3. Allow users to read only their own profile, while admins can still manage all profiles.

drop policy if exists "Public read players" on public.players;
drop policy if exists "Authenticated users can read players" on public.players;

create policy "Authenticated users can read players"
on public.players
for select
using (auth.role() = 'authenticated');

drop policy if exists "Public read profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;

create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Admins can view all profiles"
on public.profiles
for select
using (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
  )
);
