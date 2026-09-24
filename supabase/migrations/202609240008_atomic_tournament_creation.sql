create or replace function public.create_tournament_bundle(
 tournament_name text,event_date date,venue_name text
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Log opnieuw in om een toernooi aan te maken.'; end if;
 if length(trim(tournament_name))<2 then raise exception 'Vul een geldige toernooinaam in.'; end if;
 insert into public.tournaments(name,event_date,venue,published,created_by)
 values(trim(tournament_name),event_date,trim(venue_name),false,auth.uid()) returning id into new_id;
 insert into public.fields(tournament_id,name,surface) values
 (new_id,'Veld 1','Natuurgras'),(new_id,'Veld 2','Kunstgras'),(new_id,'Veld 3','Kunstgras');
 insert into public.tournament_settings(tournament_id,match_duration_minutes,switch_minutes,minimum_rest_minutes)
 values(new_id,20,5,20);
 insert into public.divisions(tournament_id,name,pool_count,max_teams_per_pool,knockout,third_place)
 values(new_id,'JO13',2,6,true,true);
 return new_id;
end $$;
grant execute on function public.create_tournament_bundle(text,date,text) to authenticated;
