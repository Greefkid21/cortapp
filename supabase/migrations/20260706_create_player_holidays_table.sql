create table if not exists public.player_holidays (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid not null references public.players(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint player_holidays_date_check check (end_date >= start_date)
);

create index if not exists idx_player_holidays_player_id
  on public.player_holidays(player_id);

create index if not exists idx_player_holidays_start_date
  on public.player_holidays(start_date);

alter table public.player_holidays enable row level security;

drop policy if exists "Authenticated users can read holidays" on public.player_holidays;
create policy "Authenticated users can read holidays"
on public.player_holidays
for select
using (auth.role() = 'authenticated');

drop policy if exists "Players or admins can insert holidays" on public.player_holidays;
create policy "Players or admins can insert holidays"
on public.player_holidays
for insert
with check (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.player_id = player_holidays.player_id
        or profiles.role = 'admin'
      )
  )
);

drop policy if exists "Players or admins can delete holidays" on public.player_holidays;
create policy "Players or admins can delete holidays"
on public.player_holidays
for delete
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.player_id = player_holidays.player_id
        or profiles.role = 'admin'
      )
  )
);
