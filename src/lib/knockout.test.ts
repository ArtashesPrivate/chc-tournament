import {describe, expect, it} from 'vitest'
import {buildKnockout, knockoutPatches} from './knockout'
import type {Match, Team} from '../types'

const teams: Team[] = [
  {id: 'a1', name: 'A1', club: 'A', pool: 'Poule A'},
  {id: 'a2', name: 'A2', club: 'A', pool: 'Poule A'},
  {id: 'b1', name: 'B1', club: 'B', pool: 'Poule B'},
  {id: 'b2', name: 'B2', club: 'B', pool: 'Poule B'},
]

describe('knockout', () => {
  it('builds semis, a final and a third-place match from two pools', () => {
    const drafts = buildKnockout(['Poule A', 'Poule B'], 2, true)
    expect(drafts.map(draft => draft.stage)).toEqual(['semi', 'semi', 'final', 'third'])
    expect(drafts[0].homeSource).toBe('rank:Poule A:1')
    expect(drafts[2].homeSource.startsWith('W:')).toBe(true)
  })

  it('fills the final after both semis have a winner', () => {
    const [semiA, semiB, final] = buildKnockout(['Poule A', 'Poule B'], 2, false)
    const pool: Match[] = [
      {id: 'p1', kickoff: '09:00', field: 'Veld 1', homeTeamId: 'a1', awayTeamId: 'a2', homeScore: 2, awayScore: 0, status: 'finished', pool: 'Poule A', stage: 'pool'},
      {id: 'p2', kickoff: '09:00', field: 'Veld 2', homeTeamId: 'b1', awayTeamId: 'b2', homeScore: 1, awayScore: 0, status: 'finished', pool: 'Poule B', stage: 'pool'},
    ]
    const semis: Match[] = [semiA, semiB].map((draft, index) => ({
      id: draft.code,
      kickoff: '11:00',
      field: 'Veld 1',
      homeTeamId: index === 0 ? 'a1' : 'b1',
      awayTeamId: index === 0 ? 'b2' : 'a2',
      homeScore: 1,
      awayScore: 0,
      status: 'finished' as const,
      pool: 'Finales',
      stage: 'semi' as const,
      homeSource: draft.homeSource,
      awaySource: draft.awaySource,
      bracketCode: draft.code,
    }))
    const finalMatch: Match = {id: 'final', kickoff: '12:00', field: 'Veld 1', homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, status: 'scheduled', pool: 'Finales', stage: 'final', homeSource: final.homeSource, awaySource: final.awaySource, bracketCode: final.code}
    const patches = knockoutPatches(teams, [...pool, ...semis, finalMatch])
    const finalPatch = patches.find(patch => patch.id === 'final')
    expect(finalPatch).toEqual({id: 'final', homeTeamId: 'a1', awayTeamId: 'b1'})
  })
})
