create table if not exists public.tournament_invitations (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references public.tournaments(id) on delete cascade,
 email text not null,
 role public.tournament_role not null check(role <> 'owner'),
 invited_by uuid references auth.users(id) on delete set null default auth.uid(),
 accepted_at timestamptz,
 created_at timestamptz not null default now(),
 unique(tournament_id,email)
);
alter table public.tournament_invitations enable row level security;
do $$ begin create policy "owners manage invitations" on public.tournament_invitations for all to authenticated using(public.can_manage_tournament(tournament_id,array['owner']::public.tournament_role[])) with check(public.can_manage_tournament(tournament_id,array['owner']::public.tournament_role[])); exception when duplicate_object then null; end $$;

create or replace function public.accept_tournament_invitations()
returns integer language plpgsql security definer set search_path=public,auth as $$
declare accepted_count integer;
begin
 if auth.uid() is null then return 0; end if;
 insert into public.tournament_members(tournament_id,user_id,role)
 select i.tournament_id,auth.uid(),i.role from public.tournament_invitations i
 join auth.users u on u.id=auth.uid()
 where lower(i.email)=lower(u.email) and i.accepted_at is null
 on conflict(tournament_id,user_id) do update set role=excluded.role;
 get diagnostics accepted_count=row_count;
 update public.tournament_invitations i set accepted_at=now()
 from auth.users u where u.id=auth.uid() and lower(i.email)=lower(u.email) and i.accepted_at is null;
 return accepted_count;
end $$;
grant execute on function public.accept_tournament_invitations() to authenticated;
