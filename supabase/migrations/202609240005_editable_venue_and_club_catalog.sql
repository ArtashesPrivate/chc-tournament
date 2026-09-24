alter table public.club_teams add column if not exists club_name text not null default 'sv CHC';
alter table public.club_teams add column if not exists source text not null default 'manual';
alter table public.club_teams add column if not exists external_id text;
alter table public.club_teams drop constraint if exists club_teams_name_key;
create unique index if not exists club_teams_club_name_team_name_key on public.club_teams(club_name,name);
create index if not exists club_teams_search_idx on public.club_teams(club_name,name,active);
update public.club_teams set club_name='sv CHC',source='club' where club_name='sv CHC';

do $$ begin alter publication supabase_realtime add table public.teams; exception when duplicate_object then null; end $$;
