import {calculateStandings} from '../standings'
import type {Match, Team} from '../types'

export type KnockoutDraft = {
  code: string
  stage: 'quarter' | 'semi' | 'final' | 'third'
  pool: string
  homeSource: string
  awaySource: string
}

export function seedLabel(pool: string, rank: number) {
  return `rank:${pool}:${rank}`
}

function roundStage(teamCount: number): KnockoutDraft['stage'] {
  if (teamCount <= 2) return 'final'
  if (teamCount <= 4) return 'semi'
  return 'quarter'
}

export function buildKnockout(pools: string[], advance: number, thirdPlace: boolean): KnockoutDraft[] {
  const seeds: string[] = []
  for (let rank = 1; rank <= Math.max(1, advance); rank++) {
    for (const pool of pools) seeds.push(seedLabel(pool, rank))
  }
  if (seeds.length < 2) return []
  const drafts: KnockoutDraft[] = []
  let current = [...seeds]
  let round = 0
  while (current.length > 1) {
    const next: string[] = []
    const queue = [...current]
    let index = 0
    const stage = roundStage(queue.length)
    while (queue.length > 1) {
      const homeSource = queue.shift()!
      const awaySource = queue.pop()!
      const code = `${stage}-${round}-${index}`
      drafts.push({code, stage, pool: 'Finales', homeSource, awaySource})
      next.push(`W:${code}`)
      index += 1
    }
    if (queue.length === 1) next.push(queue[0])
    current = next
    round += 1
  }
  if (thirdPlace) {
    const semis = drafts.filter(draft => draft.stage === 'semi')
    if (semis.length === 2) drafts.push({code: 'third-0', stage: 'third', pool: 'Finales', homeSource: `L:${semis[0].code}`, awaySource: `L:${semis[1].code}`})
  }
  return drafts
}

function winnerId(match: Match) {
  if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null || match.homeScore === match.awayScore) return null
  return match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId
}

function loserId(match: Match) {
  if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null || match.homeScore === match.awayScore) return null
  return match.homeScore < match.awayScore ? match.homeTeamId : match.awayTeamId
}

export function resolveSource(source: string, teams: Team[], matches: Match[], points?: {win: number; draw: number}) {
  if (source.startsWith('rank:')) {
    const [, pool, rankText] = source.split(':')
    return calculateStandings(teams, matches, pool, points)[Number(rankText) - 1]?.team.id ?? null
  }
  const [kind, code] = [source.slice(0, 1), source.slice(2)]
  const match = matches.find(item => item.bracketCode === code)
  if (!match) return null
  return kind === 'L' ? loserId(match) : winnerId(match)
}

export function knockoutPatches(teams: Team[], matches: Match[], points?: {win: number; draw: number}) {
  return matches.flatMap(match => {
    if (!match.homeSource || !match.awaySource || match.stage === 'pool') return []
    const homeTeamId = resolveSource(match.homeSource, teams, matches, points)
    const awayTeamId = resolveSource(match.awaySource, teams, matches, points)
    if (homeTeamId === (match.homeTeamId || null) && awayTeamId === (match.awayTeamId || null)) return []
    if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) return []
    return [{id: match.id, homeTeamId, awayTeamId}]
  })
}
