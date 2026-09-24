alter table public.tournaments add column if not exists archived_at timestamptz;

drop policy if exists "published tournaments are public" on public.tournaments;
create policy "published tournaments are public" on public.tournaments for select using (
  (published and archived_at is null)
  or public.can_manage_tournament(id,array['owner','admin','scorekeeper','viewer']::public.tournament_role[])
);

create or replace function public.delete_tournament(target_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare next_id uuid;
begin
  if not public.can_manage_tournament(target_id,array['owner']::public.tournament_role[]) then
    raise exception 'Alleen de eigenaar kan dit toernooi definitief verwijderen.';
  end if;
  delete from public.tournaments where id=target_id;
  select t.id into next_id from public.tournaments t
  join public.tournament_members m on m.tournament_id=t.id
  where m.user_id=auth.uid() and t.archived_at is null
  order by t.event_date desc limit 1;
  if next_id is null then
    next_id:=public.create_tournament_bundle('Nieuw toernooi',current_date,'Sportpark De Schutskamp');
  end if;
  return next_id;
end $$;

create or replace function public.duplicate_tournament(source_id uuid,new_name text,new_date date)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; source public.tournaments%rowtype;
begin
  if not public.can_manage_tournament(source_id,array['owner','admin']::public.tournament_role[]) then
    raise exception 'Je hebt geen rechten om dit toernooi te dupliceren.';
  end if;
  select * into source from public.tournaments where id=source_id;
  insert into public.tournaments(name,event_date,venue,published,created_by)
  values(new_name,new_date,source.venue,false,auth.uid()) returning id into new_id;
  insert into public.fields(tournament_id,name,surface,status)
    select new_id,name,surface,status from public.fields where tournament_id=source_id;
  insert into public.tournament_settings(tournament_id,match_duration_minutes,switch_minutes,minimum_rest_minutes,public_message,tv_mode_enabled)
    select new_id,match_duration_minutes,switch_minutes,minimum_rest_minutes,public_message,tv_mode_enabled from public.tournament_settings where tournament_id=source_id;
  insert into public.divisions(tournament_id,name,pool_count,max_teams_per_pool,knockout,third_place)
    select new_id,name,pool_count,max_teams_per_pool,knockout,third_place from public.divisions where tournament_id=source_id;
  insert into public.teams(tournament_id,name,club_name,pool_name,color,category,source,changing_room)
    select new_id,name,club_name,pool_name,color,category,source,null from public.teams where tournament_id=source_id;
  return new_id;
end $$;

grant execute on function public.delete_tournament(uuid) to authenticated;
grant execute on function public.duplicate_tournament(uuid,text,date) to authenticated;
