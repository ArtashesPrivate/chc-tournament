import {buildKnockout, knockoutPatches} from './knockout'
import {detectConflicts, placeGames, roundRobin, type OccupiedMatch} from './scheduling'
import {errorText} from './errors'
import {supabase} from './supabase'
import type {Match, Tournament} from '../types'

export async function writeAudit(tournamentId: string, action: string, entity: string, entityId: string | null, detail: string) {
  if (!supabase) return
  const {error} = await supabase.from('audit_log').insert({tournament_id: tournamentId, action, entity, entity_id: entityId, detail})
  if (error && !/audit_log|schema cache|does not exist/i.test(error.message)) throw new Error(errorText(error))
}

export async function saveScore(match: Match, homeScore: number, awayScore: number, status: Match['status']) {
  if (!supabase) throw new Error('Supabase is nog niet geconfigureerd.')
  const {error} = await supabase.from('matches').update({home_score: homeScore, away_score: awayScore, status}).eq('id', match.id)
  if (error) throw new Error(errorText(error))
}

export async function progressKnockout(tournament: Tournament) {
  if (!supabase) return []
  const points = {win: tournament.settings?.pointsWin ?? 3, draw: tournament.settings?.pointsDraw ?? 1}
  const patches = knockoutPatches(tournament.teams, tournament.matches, points)
  for (const patch of patches) {
    const {error} = await supabase.from('matches').update({home_team_id: patch.homeTeamId, away_team_id: patch.awayTeamId}).eq('id', patch.id)
    if (error) throw new Error(errorText(error))
  }
  return patches
}

export async function generateSchedule(tournament: Tournament) {
  if (!supabase) throw new Error('Supabase is nog niet geconfigureerd.')
  const settings = tournament.settings
  const fields = (tournament.fields ?? []).filter(field => field.status === 'open').map(field => field.name)
  const kept = tournament.matches.filter(match => match.stage !== 'pool' ? false : match.status !== 'scheduled')
  const occupied: OccupiedMatch[] = kept.filter(match => match.homeTeamId && match.awayTeamId).map(match => ({id: match.id, kickoff: match.kickoff, field: match.field, homeId: match.homeTeamId, awayId: match.awayTeamId, referee: match.referee ?? null, status: match.status}))
  const playedKey = new Set(kept.map(match => [match.pool, match.homeTeamId, match.awayTeamId].sort().join('|')))
  const games = roundRobin(tournament.teams.map(team => ({id: team.id, pool: team.pool}))).filter(game => !playedKey.has([game.pool, game.homeId, game.awayId].sort().join('|')))
  const plan = placeGames({
    games,
    fields,
    start: settings?.startTime ?? '09:00',
    matchMinutes: settings?.matchMinutes ?? 20,
    switchMinutes: settings?.switchMinutes ?? 5,
    restMinutes: settings?.restMinutes ?? 20,
    referees: (tournament.officials ?? []).map(official => official.name),
    occupied,
  })
  if (!fields.length) throw new Error('Voeg eerst een open veld toe.')
  const {error: deleteError} = await supabase.from('matches').delete().eq('tournament_id', tournament.id).eq('status', 'scheduled')
  if (deleteError) throw new Error(errorText(deleteError))
  const poolRows = plan.placed.map(game => ({
    tournament_id: tournament.id,
    pool_name: game.pool,
    kickoff: game.kickoff,
    field_name: game.field,
    home_team_id: game.homeId,
    away_team_id: game.awayId,
    status: 'scheduled',
    stage: 'pool',
    referee_name: game.referee,
  }))
  const pools = [...new Set(tournament.teams.map(team => team.pool))]
  const knockout = (tournament.divisions ?? []).some(division => division.knockout)
  const drafts = knockout ? buildKnockout(pools, settings?.advancePerPool ?? 2, (tournament.divisions ?? []).some(division => division.thirdPlace)) : []
  const knockoutRows = drafts.map((draft, index) => ({
    tournament_id: tournament.id,
    pool_name: 'Finales',
    kickoff: plan.placed.at(-1)?.kickoff ?? settings?.startTime ?? '12:00',
    field_name: fields[index % fields.length],
    home_team_id: null,
    away_team_id: null,
    status: 'scheduled',
    stage: draft.stage,
    home_source: draft.homeSource,
    away_source: draft.awaySource,
    bracket_code: draft.code,
  }))
  const rows = [...poolRows, ...knockoutRows]
  if (rows.length) {
    const {error} = await supabase.from('matches').insert(rows)
    if (error) throw new Error(errorText(error))
  }
  await writeAudit(tournament.id, 'generate-schedule', 'matches', null, `${plan.placed.length} poulewedstrijden, ${drafts.length} finalewedstrijden, ${plan.unplaced.length} niet ingepland.`)
  return plan
}

export function describeConflicts(tournament: Tournament) {
  return detectConflicts(tournament.matches.filter(match => match.homeTeamId && match.awayTeamId).map(match => ({
    id: match.id,
    kickoff: match.kickoff,
    field: match.field,
    homeId: match.homeTeamId,
    awayId: match.awayTeamId,
    referee: match.referee ?? null,
    status: match.status,
  })), tournament.settings?.matchMinutes ?? 20, tournament.settings?.restMinutes ?? 20)
}
