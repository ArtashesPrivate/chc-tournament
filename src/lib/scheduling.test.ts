import {describe, expect, it} from 'vitest'
import {detectConflicts, placeGames, roundRobin} from './scheduling'

const teams = [
  {id: 'a1', pool: 'Poule A'},
  {id: 'a2', pool: 'Poule A'},
  {id: 'a3', pool: 'Poule A'},
  {id: 'a4', pool: 'Poule A'},
]

describe('scheduling', () => {
  it('creates every unique pairing once', () => {
    expect(roundRobin(teams)).toHaveLength(6)
  })

  it('keeps a team off two pitches at the same time and respects rest', () => {
    const {placed, unplaced} = placeGames({
      games: roundRobin(teams),
      fields: ['Veld 1', 'Veld 2'],
      start: '09:00',
      matchMinutes: 20,
      switchMinutes: 5,
      restMinutes: 20,
      referees: ['Sam', 'Noah'],
    })
    expect(unplaced).toHaveLength(0)
    expect(detectConflicts(placed.map((game, index) => ({id: String(index), kickoff: game.kickoff, field: game.field, homeId: game.homeId, awayId: game.awayId, referee: game.referee, status: 'scheduled' as const})), 20, 20)).toHaveLength(0)
  })

  it('reports a field double booking', () => {
    const conflicts = detectConflicts([
      {id: '1', kickoff: '09:00', field: 'Veld 1', homeId: 'a', awayId: 'b', status: 'scheduled'},
      {id: '2', kickoff: '09:10', field: 'Veld 1', homeId: 'c', awayId: 'd', status: 'scheduled'},
    ], 20, 10)
    expect(conflicts.some(conflict => conflict.kind === 'field')).toBe(true)
  })
})
