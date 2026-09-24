create extension if not exists pgcrypto;

create type public.tournament_role as enum ('owner','admin','scorekeeper','viewer');
create type public.match_status as enum ('scheduled','live','finished');

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  event_date date not null,
  venue text not null default '',
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_members (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tournament_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (tournament_id,user_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  club_name text not null default '',
  pool_name text not null default 'Poule A',
  color text,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pool_name text not null default 'Poule A',
  kickoff time not null,
  field_name text not null,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  status public.match_status not null default 'scheduled',
  referee_name text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check ((home_score is null) = (away_score is null))
);

create index teams_tournament_idx on public.teams(tournament_id);
create index matches_tournament_kickoff_idx on public.matches(tournament_id,kickoff);
create index tournament_members_user_idx on public.tournament_members(user_id);

create or replace function public.can_manage_tournament(target uuid, allowed public.tournament_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.tournament_members m where m.tournament_id=target and m.user_id=auth.uid() and m.role=any(allowed));
$$;

alter table public.tournaments enable row level security;
alter table public.tournament_members enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;

create policy "published tournaments are public" on public.tournaments for select using (published or public.can_manage_tournament(id,array['owner','admin','scorekeeper','viewer']::public.tournament_role[]));
create policy "signed in users create tournaments" on public.tournaments for insert to authenticated with check (created_by=auth.uid());
create policy "owners and admins update tournaments" on public.tournaments for update to authenticated using (public.can_manage_tournament(id,array['owner','admin']::public.tournament_role[])) with check (public.can_manage_tournament(id,array['owner','admin']::public.tournament_role[]));

create policy "members see memberships" on public.tournament_members for select to authenticated using (user_id=auth.uid() or public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[]));
create policy "owners manage memberships" on public.tournament_members for all to authenticated using (public.can_manage_tournament(tournament_id,array['owner']::public.tournament_role[])) with check (public.can_manage_tournament(tournament_id,array['owner']::public.tournament_role[]));

create policy "published teams are public" on public.teams for select using (exists(select 1 from public.tournaments t where t.id=tournament_id and (t.published or public.can_manage_tournament(t.id,array['owner','admin','scorekeeper','viewer']::public.tournament_role[]))));
create policy "admins manage teams" on public.teams for all to authenticated using (public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[])) with check (public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[]));

create policy "published matches are public" on public.matches for select using (exists(select 1 from public.tournaments t where t.id=tournament_id and (t.published or public.can_manage_tournament(t.id,array['owner','admin','scorekeeper','viewer']::public.tournament_role[]))));
create policy "staff update scores" on public.matches for update to authenticated using (public.can_manage_tournament(tournament_id,array['owner','admin','scorekeeper']::public.tournament_role[])) with check (public.can_manage_tournament(tournament_id,array['owner','admin','scorekeeper']::public.tournament_role[]));
create policy "admins create matches" on public.matches for insert to authenticated with check (public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[]));
create policy "admins delete matches" on public.matches for delete to authenticated using (public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[]));

create or replace function public.add_creator_as_owner() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.created_by is not null then insert into public.tournament_members(tournament_id,user_id,role) values(new.id,new.created_by,'owner'); end if; return new; end $$;
create trigger tournament_owner_after_insert after insert on public.tournaments for each row execute function public.add_creator_as_owner();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); if tg_table_name='matches' then new.updated_by=auth.uid(); end if; return new; end $$;
create trigger tournaments_touch before update on public.tournaments for each row execute function public.touch_updated_at();
create trigger matches_touch before update on public.matches for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.matches;

-- Demo/public tournament. Replace or remove after creating the first real tournament.
insert into public.tournaments(id,name,event_date,venue,published,created_by) values('00000000-0000-0000-0000-000000000001','CHC Jeugdtoernooi 2026','2026-06-13','Sportpark De Schutskamp',true,null);
insert into public.teams(id,tournament_id,name,club_name,pool_name) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','CHC/Loomer JO13-1','sv CHC','Poule A'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','OJC Rosmalen JO13-1','OJC Rosmalen','Poule A'),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','FC Engelen JO13-1','FC Engelen','Poule A'),
('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Wilhelmina JO13-1','Wilhelmina','Poule A'),
('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','CHC/Loomer MO13-1','sv CHC','Poule B'),
('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','RKVV Nieuwkuijk MO13-1','Nieuwkuijk','Poule B');
insert into public.matches(tournament_id,pool_name,kickoff,field_name,home_team_id,away_team_id,home_score,away_score,status,referee_name) values
('00000000-0000-0000-0000-000000000001','Poule A','09:30','Veld 1','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',2,1,'finished','Sam de Wit'),
('00000000-0000-0000-0000-000000000001','Poule A','09:30','Veld 2','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004',0,0,'finished','Noah Jansen'),
('00000000-0000-0000-0000-000000000001','Poule B','10:00','Veld 1','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000006',1,0,'live','Lina Peters'),
('00000000-0000-0000-0000-000000000001','Poule A','10:00','Veld 2','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003',null,null,'scheduled','Sam de Wit');
