import type {Match,Standing,Team} from './types'

export function calculateStandings(teams:Team[],matches:Match[],pool:string,points:{win:number;draw:number}={win:3,draw:1}):Standing[]{
 const rows=new Map(teams.filter(t=>t.pool===pool).map(team=>[team.id,{team,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,points:0}]))
 for(const match of matches){if(match.stage==='quarter'||match.stage==='semi'||match.stage==='final'||match.stage==='third'||match.pool!==pool||match.status!=='finished'||match.homeScore===null||match.awayScore===null||!match.homeTeamId||!match.awayTeamId)continue
  const home=rows.get(match.homeTeamId),away=rows.get(match.awayTeamId);if(!home||!away)continue
  home.played++;away.played++;home.goalsFor+=match.homeScore;home.goalsAgainst+=match.awayScore;away.goalsFor+=match.awayScore;away.goalsAgainst+=match.homeScore
  if(match.homeScore>match.awayScore){home.won++;away.lost++;home.points+=points.win}else if(match.homeScore<match.awayScore){away.won++;home.lost++;away.points+=points.win}else{home.drawn++;away.drawn++;home.points+=points.draw;away.points+=points.draw}
 }
 return [...rows.values()].sort((a,b)=>b.points-a.points||((b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst))||b.goalsFor-a.goalsFor||a.team.name.localeCompare(b.team.name))
}
