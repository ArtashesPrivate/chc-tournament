export type Team={id:string;name:string;club:string;pool:string;color?:string}
export type MatchStatus='scheduled'|'live'|'finished'
export type Match={id:string;kickoff:string;field:string;homeTeamId:string;awayTeamId:string;homeScore:number|null;awayScore:number|null;status:MatchStatus;pool:string;referee?:string}
export type Standing={team:Team;played:number;won:number;drawn:number;lost:number;goalsFor:number;goalsAgainst:number;points:number}
export type Tournament={id:string;name:string;date:string;venue:string;published:boolean;teams:Team[];matches:Match[]}
