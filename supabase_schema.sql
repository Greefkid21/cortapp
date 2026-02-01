-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. SEASONS Table
create table seasons (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  start_date date not null default current_date,
  end_date date,
  is_active boolean default true,
  final_standings jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial season
insert into seasons (name, start_date, is_active)
values ('Season 1', current_date, true);

-- 2. PLAYERS Table
create table players (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  avatar text,
  played int default 0,
  wins int default 0,
  losses int default 0,
  draws int default 0,
  points int default 0,
  sets_won int default 0,
  sets_lost int default 0,
  games_won int default 0,
  games_lost int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. MATCHES Table
create table matches (
  id uuid default uuid_generate_v4() primary key,
  season_id uuid references seasons(id),
  date date not null,
  team1_player1_id uuid references players(id),
  team1_player2_id uuid references players(id),
  team2_player1_id uuid references players(id),
  team2_player2_id uuid references players(id),
  set1_score text,
  set2_score text,
  set3_score text,
  winner text, -- 'team1', 'team2', 'draw'
  status text default 'scheduled', -- 'scheduled', 'completed', 'postponed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. PROFILES Table (links to auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text default 'viewer', -- 'admin', 'viewer'
  status text default 'active', -- 'active', 'suspended'
  player_id uuid references players(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. USER INVITES Table
create table user_invites (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  role text default 'viewer',
  player_id uuid references players(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. MESSAGES Table (Chat)
create table messages (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references matches(id) on delete cascade,
  sender_user_id uuid references auth.users(id),
  sender_name text,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS
alter table seasons enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table profiles enable row level security;
alter table user_invites enable row level security;
alter table messages enable row level security;

-- Policies

-- SEASONS
create policy "Public read seasons" on seasons for select using (true);
create policy "Auth insert seasons" on seasons for insert with check (auth.role() = 'authenticated');
create policy "Auth update seasons" on seasons for update using (auth.role() = 'authenticated');

-- PLAYERS
create policy "Public read players" on players for select using (true);
create policy "Auth insert players" on players for insert with check (auth.role() = 'authenticated');
create policy "Auth update players" on players for update using (auth.role() = 'authenticated');

-- MATCHES
create policy "Public read matches" on matches for select using (true);
create policy "Auth insert matches" on matches for insert with check (auth.role() = 'authenticated');
create policy "Auth update matches" on matches for update using (auth.role() = 'authenticated');

-- PROFILES
create policy "Public read profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- USER INVITES
create policy "Auth read invites" on user_invites for select using (auth.role() = 'authenticated');
create policy "Auth insert invites" on user_invites for insert with check (auth.role() = 'authenticated');

-- MESSAGES
create policy "Auth read messages" on messages for select using (auth.role() = 'authenticated');
create policy "Auth insert messages" on messages for insert with check (auth.role() = 'authenticated');

-- TRIGGER for creating profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
declare
  invite_record record;
begin
  -- Check if there is an invite for this email
  select * into invite_record from public.user_invites where email = new.email order by created_at desc limit 1;
  
  if invite_record.email is not null then
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
