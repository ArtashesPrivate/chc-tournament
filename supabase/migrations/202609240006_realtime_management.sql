do $$ begin alter publication supabase_realtime add table public.fields; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.officials; exception when duplicate_object then null; end $$;

create table if not exists public.external_integrations (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references public.tournaments(id) on delete cascade,
 provider text not null check(provider in ('sportlink')),
 status text not null default 'not_configured' check(status in ('not_configured','ready','syncing','error')),
 club_identifier text,
 last_synced_at timestamptz,
 last_error text,
 public_configuration jsonb not null default '{}'::jsonb,
 unique(tournament_id,provider)
);
alter table public.external_integrations enable row level security;
do $$ begin create policy "admins read integrations" on public.external_integrations for select to authenticated using(public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[])); exception when duplicate_object then null; end $$;
do $$ begin create policy "admins manage integrations" on public.external_integrations for all to authenticated using(public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[])) with check(public.can_manage_tournament(tournament_id,array['owner','admin']::public.tournament_role[])); exception when duplicate_object then null; end $$;
