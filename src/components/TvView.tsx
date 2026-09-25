import type {Tournament} from '../types'

const teamName = (tournament: Tournament, id: string | null) => tournament.teams.find(team => team.id === id)?.name ?? 'Nader te bepalen'

export function TvView({tournament, onClose}: {tournament: Tournament; onClose: () => void}) {
  const live = tournament.matches.filter(match => match.status === 'live')
  const next = tournament.matches.filter(match => match.status === 'scheduled').slice(0, 6)
  return <div className="tv-view">
    <header><img src="/chc-logo.png" alt="SV CHC" /><div><p>Live op {tournament.venue}</p><h1>{tournament.name}</h1></div><button onClick={onClose}>Sluiten</button></header>
    <section className="tv-live">{live.length ? live.map(match => <article key={match.id}><span>{match.field}</span><strong>{teamName(tournament, match.homeTeamId)}</strong><b>{match.homeScore ?? 0} – {match.awayScore ?? 0}</b><strong>{teamName(tournament, match.awayTeamId)}</strong></article>) : <article><span>Geen live wedstrijd</span><strong>Volgende aftrap</strong><b>{next[0]?.kickoff ?? '–'}</b></article>}</section>
    <section className="tv-next">{next.map(match => <article key={match.id}><span>{match.kickoff} · {match.field}</span><strong>{teamName(tournament, match.homeTeamId)} – {teamName(tournament, match.awayTeamId)}</strong></article>)}</section>
  </div>
}
