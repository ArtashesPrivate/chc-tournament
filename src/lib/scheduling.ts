export type ScheduleGame = {homeId: string; awayId: string; pool: string}
export type OccupiedMatch = {
  id: string
  kickoff: string
  field: string
  homeId: string | null
  awayId: string | null
  referee?: string | null
  status: 'scheduled' | 'live' | 'finished'
}
export type PlacedGame = ScheduleGame & {kickoff: string; field: string; referee: string | null}
export type Conflict = {kind: 'team' | 'field' | 'referee' | 'rest'; message: string}

export function toMinutes(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(value: number) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function roundRobin(teams: {id: string; pool: string}[]): ScheduleGame[] {
  const pools = [...new Set(teams.map(team => team.pool))]
  const games: ScheduleGame[] = []
  for (const pool of pools) {
    const members = teams.filter(team => team.pool === pool)
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) games.push({homeId: members[i].id, awayId: members[j].id, pool})
    }
  }
  return games
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && otherStart < end
}

export function detectConflicts(matches: OccupiedMatch[], matchMinutes: number, restMinutes: number): Conflict[] {
  const conflicts: Conflict[] = []
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const a = matches[i]
      const b = matches[j]
      const aStart = toMinutes(a.kickoff)
      const bStart = toMinutes(b.kickoff)
      const aEnd = aStart + matchMinutes
      const bEnd = bStart + matchMinutes
      if (a.field && a.field === b.field && overlaps(aStart, aEnd + 1, bStart, bEnd + 1)) {
        conflicts.push({kind: 'field', message: `${a.field} heeft twee wedstrijden om ${a.kickoff.slice(0, 5)} en ${b.kickoff.slice(0, 5)}.`})
      }
      const teams = [a.homeId, a.awayId].filter(Boolean)
      const shared = teams.find(id => id === b.homeId || id === b.awayId)
      if (shared && overlaps(aStart, aEnd + restMinutes, bStart, bEnd + restMinutes)) {
        conflicts.push({kind: shared && overlaps(aStart, aEnd, bStart, bEnd) ? 'team' : 'rest', message: `Een team heeft te weinig rust tussen ${a.kickoff.slice(0, 5)} en ${b.kickoff.slice(0, 5)}.`})
      }
      if (a.referee && a.referee === b.referee && overlaps(aStart, aEnd, bStart, bEnd)) {
        conflicts.push({kind: 'referee', message: `${a.referee} staat op twee wedstrijden tegelijk (${a.kickoff.slice(0, 5)} en ${b.kickoff.slice(0, 5)}).`})
      }
    }
  }
  return conflicts
}

export function placeGames(options: {
  games: ScheduleGame[]
  fields: string[]
  start: string
  matchMinutes: number
  switchMinutes: number
  restMinutes: number
  referees: string[]
  occupied?: OccupiedMatch[]
  end?: string
}): {placed: PlacedGame[]; unplaced: ScheduleGame[]; conflicts: Conflict[]} {
  const fields = options.fields.filter(Boolean)
  const occupied = [...(options.occupied ?? [])]
  const placed: PlacedGame[] = []
  const unplaced: ScheduleGame[] = []
  const start = toMinutes(options.start || '09:00')
  const end = toMinutes(options.end || '18:00')
  const fieldGap = options.matchMinutes + options.switchMinutes
  if (!fields.length) return {placed, unplaced: options.games, conflicts: [{kind: 'field', message: 'Voeg eerst een open veld toe.'}]}

  for (const game of options.games) {
    let chosen: PlacedGame | null = null
    for (let minute = start; minute <= end && !chosen; minute += 5) {
      for (const field of fields) {
        const candidate: OccupiedMatch = {id: `new-${placed.length}`, kickoff: fromMinutes(minute), field, homeId: game.homeId, awayId: game.awayId, referee: null, status: 'scheduled'}
        const fieldTaken = occupied.some(match => match.field === field && overlaps(minute, minute + fieldGap, toMinutes(match.kickoff), toMinutes(match.kickoff) + fieldGap))
        if (fieldTaken) continue
        const trial = [...occupied, candidate]
        const teamConflicts = detectConflicts(trial, options.matchMinutes, options.restMinutes).filter(item => item.kind === 'team' || item.kind === 'rest')
        if (teamConflicts.length) continue
        const usedRefs = new Set(occupied.filter(match => overlaps(minute, minute + options.matchMinutes, toMinutes(match.kickoff), toMinutes(match.kickoff) + options.matchMinutes)).map(match => match.referee).filter(Boolean))
        const referee = options.referees.find(name => !usedRefs.has(name)) ?? null
        candidate.referee = referee
        if (referee) {
          const refConflicts = detectConflicts([...occupied, candidate], options.matchMinutes, options.restMinutes).filter(item => item.kind === 'referee')
          if (refConflicts.length) candidate.referee = null
        }
        chosen = {...game, kickoff: candidate.kickoff, field, referee: candidate.referee}
        occupied.push({...candidate, referee: chosen.referee})
        break
      }
    }
    if (chosen) placed.push(chosen)
    else unplaced.push(game)
  }
  return {placed, unplaced, conflicts: detectConflicts(occupied, options.matchMinutes, options.restMinutes)}
}
