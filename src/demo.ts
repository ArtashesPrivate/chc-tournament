import type {Tournament} from './types'

export const demoTournament:Tournament={id:'00000000-0000-0000-0000-000000000001',name:'CHC Jeugdtoernooi 2026',date:'13 juni 2026',venue:'Sportpark De Schutskamp',published:true,teams:[
 {id:'t1',name:'CHC/Loomer JO13-1',club:'sv CHC',pool:'Poule A'},{id:'t2',name:'OJC Rosmalen JO13-1',club:'OJC Rosmalen',pool:'Poule A'},{id:'t3',name:'FC Engelen JO13-1',club:'FC Engelen',pool:'Poule A'},{id:'t4',name:'Wilhelmina JO13-1',club:'Wilhelmina',pool:'Poule A'},{id:'t5',name:'CHC/Loomer MO13-1',club:'sv CHC',pool:'Poule B'},{id:'t6',name:'RKVV Nieuwkuijk MO13-1',club:'Nieuwkuijk',pool:'Poule B'}
],matches:[
 {id:'m1',kickoff:'09:30',field:'Veld 1',homeTeamId:'t1',awayTeamId:'t2',homeScore:2,awayScore:1,status:'finished',pool:'Poule A',referee:'Sam de Wit'},
 {id:'m2',kickoff:'09:30',field:'Veld 2',homeTeamId:'t3',awayTeamId:'t4',homeScore:0,awayScore:0,status:'finished',pool:'Poule A',referee:'Noah Jansen'},
 {id:'m3',kickoff:'10:00',field:'Veld 1',homeTeamId:'t5',awayTeamId:'t6',homeScore:1,awayScore:0,status:'live',pool:'Poule B',referee:'Lina Peters'},
 {id:'m4',kickoff:'10:00',field:'Veld 2',homeTeamId:'t1',awayTeamId:'t3',homeScore:null,awayScore:null,status:'scheduled',pool:'Poule A',referee:'Sam de Wit'},
 {id:'m5',kickoff:'10:30',field:'Veld 1',homeTeamId:'t2',awayTeamId:'t4',homeScore:null,awayScore:null,status:'scheduled',pool:'Poule A',referee:'Noah Jansen'}
]}
