import {demoTournament} from '../demo'
import type {Match,Tournament} from '../types'
import {hasSupabase,supabase} from './supabase'

type DbTeam={id:string;name:string;club_name:string;pool_name:string;color:string|null;category?:string;source?:string;changing_room?:string|null}
type DbMatch={id:string;kickoff:string;field_name:string;home_team_id:string;away_team_id:string;home_score:number|null;away_score:number|null;status:Match['status'];pool_name:string;referee_name:string|null}

export async function loadTournament(tournamentId?:string):Promise<Tournament>{
 if(!hasSupabase||!supabase)return demoTournament
 const client=supabase
 let query=client.from('tournaments').select('*')
 query=tournamentId?query.eq('id',tournamentId):query.eq('published',true).order('created_at',{ascending:false}).limit(1)
 const {data:t,error}=await query.maybeSingle()
 if(error||!t)return demoTournament
 const [{data:teams,error:teamsError},{data:matches,error:matchesError},{data:fields},{data:officials},{data:shifts},{data:sponsors}]=await Promise.all([
  client.from('teams').select('*').eq('tournament_id',t.id).order('name'),client.from('matches').select('*').eq('tournament_id',t.id).order('kickoff'),
  client.from('fields').select('*').eq('tournament_id',t.id).order('name'),client.from('officials').select('*').eq('tournament_id',t.id).order('name'),
  client.from('volunteer_shifts').select('*').eq('tournament_id',t.id).order('starts_at'),client.from('sponsor_prospects').select('*').eq('tournament_id',t.id).order('score',{ascending:false})])
 if(teamsError||matchesError)throw teamsError??matchesError
 return {id:t.id,name:t.name,date:new Intl.DateTimeFormat('nl-NL',{dateStyle:'long'}).format(new Date(`${t.event_date}T12:00:00`)),venue:t.venue,published:t.published,
  fields:(fields??demoTournament.fields??[]).map((x:any)=>({id:x.id,name:x.name,surface:x.surface,status:x.status})),
  officials:(officials??demoTournament.officials??[]).map((x:any)=>({id:x.id,name:x.name,role:x.role,availability:x.availability,matches:(matches??[]).filter((m:any)=>m.referee_name===x.name).length})),
  volunteers:(shifts??demoTournament.volunteers??[]).map((x:any)=>({id:x.id,name:x.volunteer_name??x.name,task:x.task,shift:x.starts_at?`${new Date(x.starts_at).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}–${new Date(x.ends_at).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}`:x.shift,status:x.status})),
  sponsors:(sponsors??demoTournament.sponsors??[]).map((x:any)=>({id:x.id,name:x.company_name??x.name,contact:x.contact_name??x.contact,stage:x.stage,score:x.score,value:Number(x.potential_value??x.value),package:x.package_name??x.package,nextAction:x.next_action??x.nextAction})),
  teams:(teams as DbTeam[]).map(x=>({id:x.id,name:x.name,club:x.club_name,pool:x.pool_name,color:x.color??undefined,category:x.category,changingRoom:x.changing_room??undefined})),
  matches:(matches as DbMatch[]).map(x=>({id:x.id,kickoff:x.kickoff.slice(0,5),field:x.field_name,homeTeamId:x.home_team_id,awayTeamId:x.away_team_id,homeScore:x.home_score,awayScore:x.away_score,status:x.status,pool:x.pool_name,referee:x.referee_name??undefined}))}
}

export async function updateScore(matchId:string,homeScore:number,awayScore:number,status:Match['status']){
 if(!supabase)throw new Error('Supabase is nog niet geconfigureerd.')
 const {error}=await supabase.from('matches').update({home_score:homeScore,away_score:awayScore,status}).eq('id',matchId)
 if(error)throw error
}

export async function createTournamentRecord(table:'teams'|'officials'|'volunteer_shifts'|'sponsor_prospects',values:Record<string,unknown>){
 if(!supabase)throw new Error('Supabase is nog niet geconfigureerd.')
 const {error}=await supabase.from(table).insert(values)
 if(error)throw error
}

export function subscribeToTournament(tournamentId:string,onChange:()=>void){
 if(!supabase)return()=>undefined
 const client=supabase
 const channel=client.channel(`tournament:${tournamentId}`).on('postgres_changes',{event:'*',schema:'public',table:'matches',filter:`tournament_id=eq.${tournamentId}`},onChange).on('postgres_changes',{event:'*',schema:'public',table:'teams',filter:`tournament_id=eq.${tournamentId}`},onChange).on('postgres_changes',{event:'*',schema:'public',table:'volunteer_shifts',filter:`tournament_id=eq.${tournamentId}`},onChange).subscribe()
 return()=>{void client.removeChannel(channel)}
}
