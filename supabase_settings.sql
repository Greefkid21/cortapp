-- Create settings table
create table if not exists settings (
  id bigint primary key generated always as identity,
  league_name text not null default 'cørtapp',
  points_win int not null default 2,
  points_draw int not null default 1,
  points_loss int not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default settings if not exists
insert into settings (league_name, points_win, points_draw, points_loss)
select 'cørtapp', 2, 1, 0
where not exists (select 1 from settings);

-- Enable RLS
alter table settings enable row level security;

-- Policies
create policy "Settings are viewable by everyone" 
  on settings for select 
  using (true);

create policy "Settings can be updated by authenticated users" 
  on settings for update 
  using (auth.role() = 'authenticated');
