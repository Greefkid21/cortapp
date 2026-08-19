alter table public.seasons
add column if not exists is_draft boolean default false;

update public.seasons
set is_draft = false
where is_draft is null;
