import {describe,expect,it} from 'vitest'
import {demoTournament} from './demo'
import {calculateStandings} from './standings'

describe('calculateStandings',()=>{it('ranks teams by points and goal difference',()=>{const rows=calculateStandings(demoTournament.teams,demoTournament.matches,'Poule A');expect(rows[0].team.id).toBe('t1');expect(rows[0].points).toBe(3);expect(rows[1].points).toBe(1)});it('ignores live matches',()=>{const rows=calculateStandings(demoTournament.teams,demoTournament.matches,'Poule B');expect(rows.every(r=>r.played===0)).toBe(true)})})
