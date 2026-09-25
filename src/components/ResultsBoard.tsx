import {useState} from 'react'
import type {Match, Tournament} from '../types'
import {errorText} from '../lib/errors'
import {progressKnockout, saveScore} from '../lib/matchday'

const name = (tournament: Tournament, id: string | null) => tournament.teams.find(team => team.id === id)?.name ?? 'Nader te bepalen'

export function ResultsBoard({tournament, canScore, onSaved}: {tournament: Tournament; canScore: boolean; onSaved: () => void}) {
  const [message, setMessage] = useState('')
  async function setStatus(match: Match, status: Match['status'], deltaHome = 0, deltaAway = 0) {
    const home = Math.max(0, (match.homeScore ?? 0) + deltaHome)
    const away = Math.max(0, (match.awayScore ?? 0) + deltaAway)
    try {
      await saveScore(match, status === 'scheduled' ? match.homeScore ?? 0 : home, status === 'scheduled' ? match.awayScore ?? 0 : away, status)
      if (status === 'finished') await progressKnockout({...tournament, matches: tournament.matches.map(item => item.id === match.id ? {...item, homeScore: home, awayScore: away, status} : item)})
      setMessage('Uitslag opgeslagen.')
      onSaved()
    } catch (error) {
      setMessage(errorText(error))
    }
  }
  return <section className="chc-panel">
    <header className="chc-heading"><div><p>Uitslagen</p><h1>Snel invoeren</h1></div></header>
    {message && <p className="chc-note">{message}</p>}
    <div className="chc-stack">{tournament.matches.map(match => <article className="chc-score-row" key={match.id}>
      <div><strong>{match.kickoff}</strong><span>{match.field} · {match.stage === 'pool' || !match.stage ? match.pool : match.stage}</span></div>
      <div className="chc-score-teams"><span>{name(tournament, match.homeTeamId)}</span><b>{match.homeScore ?? '–'} – {match.awayScore ?? '–'}</b><span>{name(tournament, match.awayTeamId)}</span></div>
      {canScore && match.homeTeamId && match.awayTeamId ? <div className="chc-steppers">
        <button onClick={() => void setStatus(match, match.status === 'scheduled' ? 'live' : match.status, 1, 0)}>+ thuis</button>
        <button onClick={() => void setStatus(match, match.status === 'scheduled' ? 'live' : match.status, 0, 1)}>+ uit</button>
        <button onClick={() => void setStatus(match, 'live')}>Live</button>
        <button onClick={() => void setStatus(match, 'finished')}>Klaar</button>
      </div> : <span>{match.homeTeamId ? '' : 'Wacht op doorstroming'}</span>}
    </article>)}</div>
  </section>
}
