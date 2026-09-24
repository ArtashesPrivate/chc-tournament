create table if not exists public.club_teams (
 id uuid primary key default gen_random_uuid(), name text not null unique, category text not null, active boolean not null default true
);
create table if not exists public.divisions (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade,
 name text not null, pool_count integer not null default 1 check(pool_count between 1 and 6),
 max_teams_per_pool integer not null default 6 check(max_teams_per_pool between 2 and 16),
 knockout boolean not null default true, third_place boolean not null default false,
 unique(tournament_id,name)
);
alter table public.teams add column if not exists category text not null default 'JO13';
alter table public.teams add column if not exists source text not null default 'external' check(source in ('chc','external'));
alter table public.teams add column if not exists division_id uuid references public.divisions(id) on delete set null;
create index if not exists divisions_tournament_idx on public.divisions(tournament_id);
alter table public.club_teams enable row level security;
alter table public.divisions enable row level security;
do $$ begin create policy "club teams public read" on public.club_teams for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy "divisions public read" on public.divisions for select using(exists(select 1 from public.tournaments t where t.id=tournament_id and (t.published or public.can_manage_tournament(t.id,array['owner','admin','scorekeeper','viewer']::public.tournament_role[])))); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins manage divisions" on public.divisions for all to authenticated using(public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[])) with check(public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[])); exception when duplicate_object then null; end $$;
insert into public.club_teams(name,category) values
 ('CHC JO7-1','JO7'),('CHC JO7-2','JO7'),('CHC JO8-1','JO8'),('CHC JO8-2','JO8'),('CHC JO9-1','JO9'),('CHC JO9-2','JO9'),
 ('CHC JO10-1','JO10'),('CHC JO10-2','JO10'),('CHC JO11-1','JO11'),('CHC JO11-2','JO11'),('CHC JO12-1','JO12'),
 ('CHC JO13-1','JO13'),('CHC JO13-2','JO13'),('CHC JO15-1','JO15'),('CHC JO17-1','JO17'),('CHC JO19-1','JO19'),
 ('CHC MO11-1','MO11'),('CHC MO13-1','MO13'),('CHC MO15-1','MO15'),('CHC MO17-1','MO17'),('CHC 1','Senioren'),('CHC 2','Senioren')
on conflict(name) do update set category=excluded.category,active=true;
insert into public.divisions(tournament_id,name,pool_count,max_teams_per_pool,knockout,third_place)
 values('00000000-0000-0000-0000-000000000001','JO13 / MO13',2,4,true,true) on conflict do nothing;
