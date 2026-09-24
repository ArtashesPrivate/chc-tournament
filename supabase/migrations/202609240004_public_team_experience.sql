alter table public.teams add column if not exists changing_room text;
update public.teams set changing_room=case
 when name like 'CHC/Loomer JO13%' then 'Kleedkamer 1'
 when name like 'CHC/Loomer MO13%' then 'Kleedkamer 2'
 when pool_name='Poule A' then 'Kleedkamer 3'
 else 'Kleedkamer 4' end
where changing_room is null;
