import {demoTournament} from '../demo'
import type {Match,Tournament} from '../types'
import {hasSupabase,supabase} from './supabase'

type DbTeam={id:string;name:string;club_name:string;pool_name:string;color:string|null}
type DbMatch={id:string;kickoff:string;field_name:string;home_team_id:string;away_team_id:string;home_score:number|null;away_score:number|null;status:Match['status'];pool_name:string;referee_name:string|null}

export async function loadTournament():Promise<Tournament>{
 if(!hasSupabase||!supabase)return demoTournament
 const client=supabase
 const {data:t,error}=await client.from('tournaments').select('*').eq('published',true).order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(error||!t)return demoTournament
 const [{data:teams,error:teamsError},{data:matches,error:matchesError}]=await Promise.all([
  client.from('teams').select('*').eq('tournament_id',t.id).order('name'),client.from('matches').select('*').eq('tournament_id',t.id).order('kickoff')])
 if(teamsError||matchesError)throw teamsError??matchesError
 return {id:t.id,name:t.name,date:new Intl.DateTimeFormat('nl-NL',{dateStyle:'long'}).format(new Date(`${t.event_date}T12:00:00`)),venue:t.venue,published:t.published,fields:demoTournament.fields,officials:demoTournament.officials,volunteers:demoTournament.volunteers,sponsors:demoTournament.sponsors,
  teams:(teams as DbTeam[]).map(x=>({id:x.id,name:x.name,club:x.club_name,pool:x.pool_name,color:x.color??undefined})),
  matches:(matches as DbMatch[]).map(x=>({id:x.id,kickoff:x.kickoff.slice(0,5),field:x.field_name,homeTeamId:x.home_team_id,awayTeamId:x.away_team_id,homeScore:x.home_score,awayScore:x.away_score,status:x.status,pool:x.pool_name,referee:x.referee_name??undefined}))}
}

export async function updateScore(matchId:string,homeScore:number,awayScore:number,status:Match['status']){
 if(!supabase)throw new Error('Supabase is nog niet geconfigureerd.')
 const {error}=await supabase.from('matches').update({home_score:homeScore,away_score:awayScore,status}).eq('id',matchId)
 if(error)throw error
}

export function subscribeToTournament(tournamentId:string,onChange:()=>void){
 if(!supabase)return()=>undefined
 const client=supabase
 const channel=client.channel(`tournament:${tournamentId}`).on('postgres_changes',{event:'*',schema:'public',table:'matches',filter:`tournament_id=eq.${tournamentId}`},onChange).subscribe()
 return()=>{void client.removeChannel(channel)}
}
