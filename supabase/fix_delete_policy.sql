-- Enable deletion for authenticated users (Admins)

-- 1. PLAYERS
-- Drop existing policy if it exists (to be safe, though 'create policy' might fail if exists)
drop policy if exists "Auth delete players" on players;
create policy "Auth delete players" on players for delete using (auth.role() = 'authenticated');

-- 2. MATCHES
drop policy if exists "Auth delete matches" on matches;
create policy "Auth delete matches" on matches for delete using (auth.role() = 'authenticated');

-- 3. USER INVITES
drop policy if exists "Auth delete invites" on user_invites;
create policy "Auth delete invites" on user_invites for delete using (auth.role() = 'authenticated');

-- 4. MESSAGES (Chat) - Good to allow deleting messages if match is deleted (cascade usually handles, but RLS needed)
drop policy if exists "Auth delete messages" on messages;
create policy "Auth delete messages" on messages for delete using (auth.role() = 'authenticated');
