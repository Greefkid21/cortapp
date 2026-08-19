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
drop policy if exists "Admins can update any profile" on public.profiles;

create or replace function public.is_admin_user()
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
      and role = 'admin'
  );
$$;

create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Admins can view all profiles"
on public.profiles
for select
using (public.is_admin_user());

create policy "Admins can update any profile"
on public.profiles
for update
using (public.is_admin_user());
