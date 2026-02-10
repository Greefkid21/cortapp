
-- 7. PLAYER AVAILABILITY Table
-- Create the table for storing player availability
create table if not exists player_availability (
  id uuid default uuid_generate_v4() primary key,
  player_id uuid references players(id) not null,
  week_start_date date not null,
  is_available boolean not null default true,
  days_available text[], -- array of 'Mon', 'Tue', etc.
  note text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Ensure one entry per player per week
  unique(player_id, week_start_date)
);

-- Enable RLS
alter table player_availability enable row level security;

-- Policies

-- 1. Everyone can read availability (needed for the widget to show status)
create policy "Public read availability" on player_availability for select using (true);

-- 2. Users can insert their own availability (or admins)
create policy "Auth insert availability" on player_availability for insert 
with check (
  auth.role() = 'authenticated' and (
    -- Is Admin
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or
    -- Is the player linked to this user
    exists (select 1 from profiles where id = auth.uid() and player_id = player_availability.player_id)
  )
);

-- 3. Users can update their own availability (or admins)
create policy "Auth update availability" on player_availability for update
using (
  auth.role() = 'authenticated' and (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or
    exists (select 1 from profiles where id = auth.uid() and player_id = player_availability.player_id)
  )
);
