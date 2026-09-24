-- CHC Club Hub expansion: tournament operations, volunteers and sponsor CRM.
create table if not exists public.fields (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade,
 name text not null, surface text not null default 'Gras', status text not null default 'open' check(status in ('open','paused','closed')),
 unique(tournament_id,name)
);
create table if not exists public.officials (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade,
 name text not null, email text, role text not null default 'Scheidsrechter', availability text not null default '', active boolean not null default true
);
create table if not exists public.volunteer_shifts (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade,
 volunteer_name text not null default 'Nog invullen', email text, task text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'needed' check(status in ('confirmed','invited','needed')), check(ends_at>starts_at)
);
create table if not exists public.sponsor_prospects (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade,
 company_name text not null, contact_name text, contact_email text, stage text not null default 'Nieuw' check(stage in ('Nieuw','Benaderen','Gesprek','Voorstel','Gewonnen')),
 score integer not null default 0 check(score between 0 and 100), potential_value numeric(10,2) not null default 0,
 package_name text not null default 'In overleg', next_action text not null default '', next_action_at date, created_at timestamptz not null default now()
);
create table if not exists public.tournament_settings (
 tournament_id uuid primary key references public.tournaments(id) on delete cascade,
 match_duration_minutes integer not null default 20 check(match_duration_minutes between 5 and 180),
 switch_minutes integer not null default 5 check(switch_minutes between 0 and 60), minimum_rest_minutes integer not null default 20,
 public_message text not null default '', tv_mode_enabled boolean not null default true, sponsor_email text not null default 'sponsoring@svchc.nl'
);
create index if not exists fields_tournament_idx on public.fields(tournament_id);
create index if not exists officials_tournament_idx on public.officials(tournament_id);
create index if not exists shifts_tournament_idx on public.volunteer_shifts(tournament_id,starts_at);
create index if not exists sponsors_tournament_stage_idx on public.sponsor_prospects(tournament_id,stage);

alter table public.fields enable row level security;
alter table public.officials enable row level security;
alter table public.volunteer_shifts enable row level security;
alter table public.sponsor_prospects enable row level security;
alter table public.tournament_settings enable row level security;
do $$ declare tbl text; begin foreach tbl in array array['fields','officials','volunteer_shifts','sponsor_prospects','tournament_settings'] loop
 execute format('create policy "public read %1$s" on public.%1$I for select using (exists(select 1 from public.tournaments t where t.id=tournament_id and (t.published or public.can_manage_tournament(t.id,array[''owner'',''admin'',''scorekeeper'',''viewer'']::public.tournament_role[]))))',tbl);
 execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using (public.can_manage_tournament(tournament_id,array[''owner'',''admin'']::public.tournament_role[])) with check (public.can_manage_tournament(tournament_id,array[''owner'',''admin'']::public.tournament_role[]))',tbl);
 end loop; exception when duplicate_object then null; end $$;

insert into public.fields(tournament_id,name,surface) values
 ('00000000-0000-0000-0000-000000000001','Veld 1','Natuurgras'),('00000000-0000-0000-0000-000000000001','Veld 2','Kunstgras'),('00000000-0000-0000-0000-000000000001','Veld 3','Kunstgras') on conflict do nothing;
insert into public.officials(tournament_id,name,availability) values
 ('00000000-0000-0000-0000-000000000001','Sam de Wit','09:00–14:00'),('00000000-0000-0000-0000-000000000001','Noah Jansen','09:00–13:00'),('00000000-0000-0000-0000-000000000001','Lina Peters','Hele dag');
insert into public.volunteer_shifts(tournament_id,volunteer_name,task,starts_at,ends_at,status) values
 ('00000000-0000-0000-0000-000000000001','Sanne Vermeer','Wedstrijdsecretariaat','2026-06-13 08:30+02','2026-06-13 13:00+02','confirmed'),
 ('00000000-0000-0000-0000-000000000001','Mike de Jong','Teamontvangst','2026-06-13 08:30+02','2026-06-13 11:30+02','confirmed'),
 ('00000000-0000-0000-0000-000000000001','Nog invullen','Kantine','2026-06-13 12:00+02','2026-06-13 16:00+02','needed');
insert into public.sponsor_prospects(tournament_id,company_name,contact_name,stage,score,potential_value,package_name,next_action) values
 ('00000000-0000-0000-0000-000000000001','Jumbo Boschveld','Lokale ondernemer','Gesprek',82,350,'Reclamebord','Belafspraak inplannen'),
 ('00000000-0000-0000-0000-000000000001','Van Mossel','Marketing','Voorstel',76,1250,'Toernooipartner','Voorstel opvolgen'),
 ('00000000-0000-0000-0000-000000000001','Lokale fysiopraktijk','Eigenaar','Benaderen',68,500,'Team / materiaal','Persoonlijke mail sturen');
insert into public.tournament_settings(tournament_id,match_duration_minutes,switch_minutes,minimum_rest_minutes,public_message)
 values('00000000-0000-0000-0000-000000000001',20,5,20,'Welkom op het CHC Jeugdtoernooi!') on conflict(tournament_id) do nothing;

alter publication supabase_realtime add table public.volunteer_shifts;
