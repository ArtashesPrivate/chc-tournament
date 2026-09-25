-- Roles revocation, knockout sources, external registration, audit and notifications.
-- Existing rows are kept. New columns have defaults.

alter table public.tournament_members add column if not exists revoked_at timestamptz;

create or replace function public.can_manage_tournament(target uuid, allowed public.tournament_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.tournament_members m
    where m.tournament_id=target
      and m.user_id=auth.uid()
      and m.revoked_at is null
      and m.role=any(allowed)
  );
$$;

alter table public.tournament_invitations add column if not exists user_id uuid references auth.users(id) on delete set null;

create or replace function public.accept_tournament_invitations()
returns integer language plpgsql security definer set search_path=public,auth as $$
declare accepted_count integer;
begin
  if auth.uid() is null then return 0; end if;
  insert into public.tournament_members(tournament_id,user_id,role,revoked_at)
  select i.tournament_id,auth.uid(),i.role,null
  from public.tournament_invitations i
  join auth.users u on u.id=auth.uid()
  where lower(i.email)=lower(u.email) and i.accepted_at is null
  on conflict(tournament_id,user_id) do update set role=excluded.role, revoked_at=null;
  get diagnostics accepted_count=row_count;
  update public.tournament_invitations i
  set accepted_at=now(), user_id=auth.uid()
  from auth.users u
  where u.id=auth.uid() and lower(i.email)=lower(u.email) and i.accepted_at is null;
  return accepted_count;
end $$;

create or replace function public.revoke_tournament_access(target_tournament uuid, target_email text)
returns text language plpgsql security definer set search_path=public,auth as $$
declare uid uuid;
begin
  if auth.uid() is null then raise exception 'Log opnieuw in.'; end if;
  if not public.can_manage_tournament(target_tournament, array['owner']::public.tournament_role[]) then
    raise exception 'Alleen de eigenaar kan toegang intrekken.';
  end if;
  if lower(target_email)=lower(coalesce((select email from auth.users where id=auth.uid()), '')) then
    raise exception 'Je kunt je eigen eigenaarstoegang niet intrekken.';
  end if;
  select id into uid from auth.users where lower(email)=lower(trim(target_email));
  if uid is null then
    delete from public.tournament_invitations
    where tournament_id=target_tournament and lower(email)=lower(trim(target_email)) and accepted_at is null;
    if not found then raise exception 'Geen openstaande uitnodiging voor dit adres.'; end if;
    return 'invitation-withdrawn';
  end if;
  update public.tournament_members
  set revoked_at=now()
  where tournament_id=target_tournament and user_id=uid and revoked_at is null;
  if not found then raise exception 'Deze persoon heeft geen actieve toegang.'; end if;
  return 'access-revoked';
end $$;

grant execute on function public.revoke_tournament_access(uuid,text) to authenticated;

alter table public.matches add column if not exists stage text not null default 'pool';
alter table public.matches drop constraint if exists matches_stage_check;
alter table public.matches add constraint matches_stage_check check (stage in ('pool','quarter','semi','final','third'));
alter table public.matches add column if not exists home_source text;
alter table public.matches add column if not exists away_source text;
alter table public.matches add column if not exists bracket_code text;

alter table public.matches alter column home_team_id drop not null;
alter table public.matches alter column away_team_id drop not null;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid='public.matches'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%home_team_id%'
      and pg_get_constraintdef(oid) ilike '%<>%'
      and pg_get_constraintdef(oid) not ilike '%home_score%'
  loop
    execute format('alter table public.matches drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.matches drop constraint if exists matches_distinct_teams;
alter table public.matches add constraint matches_distinct_teams
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id);

create or replace function public.guard_scorekeeper_match_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.can_manage_tournament(old.tournament_id, array['owner','admin']::public.tournament_role[]) then
    return new;
  end if;
  if public.can_manage_tournament(old.tournament_id, array['scorekeeper']::public.tournament_role[]) then
    if new.home_team_id is distinct from old.home_team_id
      or new.away_team_id is distinct from old.away_team_id
      or new.kickoff is distinct from old.kickoff
      or new.field_name is distinct from old.field_name
      or new.pool_name is distinct from old.pool_name
      or new.tournament_id is distinct from old.tournament_id
      or new.stage is distinct from old.stage
      or new.referee_name is distinct from old.referee_name
      or new.home_source is distinct from old.home_source
      or new.away_source is distinct from old.away_source
      or new.bracket_code is distinct from old.bracket_code
    then
      raise exception 'Deze rol mag alleen de uitslag en status wijzigen.';
    end if;
    return new;
  end if;
  raise exception 'Geen rechten om deze wedstrijd te wijzigen.';
end $$;

drop trigger if exists matches_guard_scorekeeper on public.matches;
create trigger matches_guard_scorekeeper before update on public.matches
for each row execute function public.guard_scorekeeper_match_update();

alter table public.tournament_settings add column if not exists points_win integer not null default 3;
alter table public.tournament_settings add column if not exists points_draw integer not null default 1;
alter table public.tournament_settings add column if not exists points_loss integer not null default 0;
alter table public.tournament_settings add column if not exists start_time time not null default '09:00';
alter table public.tournament_settings add column if not exists address text not null default '';
alter table public.tournament_settings add column if not exists club_name text not null default 'sv CHC';
alter table public.tournament_settings add column if not exists show_sponsors boolean not null default true;
alter table public.tournament_settings add column if not exists show_favorites boolean not null default true;
alter table public.tournament_settings add column if not exists advance_per_pool integer not null default 2;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name text not null check (char_length(team_name) between 2 and 100),
  club_name text not null check (char_length(club_name) between 2 and 120),
  category text not null default 'JO13',
  contact_name text not null default '',
  contact_email text not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.registrations enable row level security;
drop policy if exists "public submits registration" on public.registrations;
create policy "public submits registration" on public.registrations for insert to anon, authenticated
with check (
  status='pending' and reviewed_at is null and reviewed_by is null
  and exists(select 1 from public.tournaments t where t.id=tournament_id and t.published and t.archived_at is null)
);
drop policy if exists "staff read registrations" on public.registrations;
create policy "staff read registrations" on public.registrations for select to authenticated
using (public.can_manage_tournament(tournament_id, array['owner','admin','scorekeeper','viewer']::public.tournament_role[]));
drop policy if exists "admins review registrations" on public.registrations;
create policy "admins review registrations" on public.registrations for update to authenticated
using (public.can_manage_tournament(tournament_id, array['owner','admin']::public.tournament_role[]))
with check (public.can_manage_tournament(tournament_id, array['owner','admin']::public.tournament_role[]));

create or replace function public.review_registration(registration_id uuid, decision text)
returns uuid language plpgsql security definer set search_path=public as $$
declare reg public.registrations%rowtype; team_id uuid;
begin
  if decision not in ('approved','rejected') then raise exception 'Kies goedkeuren of afwijzen.'; end if;
  select * into reg from public.registrations where id=registration_id;
  if reg.id is null then raise exception 'Inschrijving niet gevonden.'; end if;
  if reg.status<>'pending' then raise exception 'Deze inschrijving is al beoordeeld.'; end if;
  if not public.can_manage_tournament(reg.tournament_id, array['owner','admin']::public.tournament_role[]) then
    raise exception 'Je hebt geen rechten om inschrijvingen te beoordelen.';
  end if;
  if decision='approved' then
    insert into public.teams(tournament_id,name,club_name,pool_name,category,source)
    values(reg.tournament_id,reg.team_name,reg.club_name,'Poule A',reg.category,'external')
    returning id into team_id;
    insert into public.notifications(tournament_id,title,body)
    values(reg.tournament_id,'Team goedgekeurd',reg.team_name||' ('||reg.club_name||') doet mee.');
  else
    team_id:=null;
    insert into public.notifications(tournament_id,title,body)
    values(reg.tournament_id,'Inschrijving afgewezen',reg.team_name||' ('||reg.club_name||') is afgewezen.');
  end if;
  update public.registrations
  set status=decision, reviewed_at=now(), reviewed_by=auth.uid()
  where id=reg.id;
  insert into public.audit_log(tournament_id,actor_id,action,entity,entity_id,detail)
  values(reg.tournament_id,auth.uid(),decision,'registration',reg.id::text,reg.team_name||' · '||reg.club_name);
  return team_id;
end $$;
grant execute on function public.review_registration(uuid,text) to authenticated;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  action text not null,
  entity text not null,
  entity_id text,
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "staff read audit" on public.audit_log;
create policy "staff read audit" on public.audit_log for select to authenticated
using (public.can_manage_tournament(tournament_id, array['owner','admin']::public.tournament_role[]));
drop policy if exists "staff write audit" on public.audit_log;
create policy "staff write audit" on public.audit_log for insert to authenticated
with check (
  actor_id=auth.uid()
  and public.can_manage_tournament(tournament_id, array['owner','admin','scorekeeper']::public.tournament_role[])
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "read notifications" on public.notifications;
create policy "read notifications" on public.notifications for select
using (exists(select 1 from public.tournaments t where t.id=tournament_id and ((t.published and t.archived_at is null) or public.can_manage_tournament(t.id, array['owner','admin','scorekeeper','viewer']::public.tournament_role[]))));
drop policy if exists "staff write notifications" on public.notifications;
create policy "staff write notifications" on public.notifications for insert to authenticated
with check (public.can_manage_tournament(tournament_id, array['owner','admin','scorekeeper']::public.tournament_role[]));

drop policy if exists "admins insert club teams" on public.club_teams;
create policy "admins insert club teams" on public.club_teams for insert to authenticated
with check (exists(
  select 1 from public.tournament_members m
  where m.user_id=auth.uid() and m.revoked_at is null and m.role in ('owner','admin')
));

insert into public.club_teams(name, club_name, category, source, active)
select v.name, v.club, v.category, 'nearby', true
from (values
  ('OJC Rosmalen JO13-1','OJC Rosmalen','JO13'),
  ('FC Engelen JO13-1','FC Engelen','JO13'),
  ('Wilhelmina JO13-1','RKVV Wilhelmina','JO13'),
  ('Maliskamp JO13-1','Maliskamp','JO13'),
  ('Nulandia JO13-1','Nulandia','JO13'),
  ('The White Boys JO13-1','The White Boys','JO13'),
  ('RKVV Sint-Michielsgestel JO13-1','RKVV Sint-Michielsgestel','JO13'),
  ('BLC JO13-1','BLC','JO13'),
  ('CHC/Loomer MO13-1','sv CHC','MO13')
) as v(name, club, category)
where not exists (
  select 1 from public.club_teams c where c.name=v.name and c.club_name=v.club
);

do $$ begin
  alter publication supabase_realtime add table public.registrations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;
