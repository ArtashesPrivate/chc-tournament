import {useEffect, useState} from 'react'
import {CalendarDays, ClipboardCheck, LayoutDashboard, LogIn, Menu, Star, Table2, Users, X} from 'lucide-react'
import Admin from './Admin'
import {AccessPanel} from './components/AccessPanel'
import {PlannerPanel} from './components/PlannerPanel'
import {RegisterForm, RegistrationQueue} from './components/Registration'
import {ResultsBoard} from './components/ResultsBoard'
import {TvView} from './components/TvView'
import {downloadText, matchesToCsv, standingsToCsv, toExcelXml} from './lib/export'
import {errorText} from './lib/errors'
import {hasSupabase, supabase} from './lib/supabase'
import {loadTournament, subscribeToTournament} from './lib/tournament-api'
import {calculateStandings} from './standings'
import type {Match, Role, Tournament} from './types'

type View = 'overview' | 'general' | 'teams' | 'format' | 'planner' | 'results' | 'publish' | 'access' | 'register' | 'standings' | 'matches'
const manageNav: [View, string][] = [['overview', 'Dashboard'], ['general', 'Algemeen'], ['teams', 'Deelnemers'], ['format', 'Indeling'], ['planner', 'Schema'], ['results', 'Uitslagen'], ['publish', 'Presentatie'], ['access', 'Toegang']]
const publicNav: [View, string][] = [['overview', 'Home'], ['matches', 'Programma'], ['standings', 'Standen'], ['teams', 'Mijn team'], ['register', 'Inschrijven']]

function teamName(tournament: Tournament, id: string | null) {
  return tournament.teams.find(team => team.id === id)?.name ?? 'Nader te bepalen'
}

export default function App() {
  const params = new URLSearchParams(location.search)
  const manageMode = params.get('manage') === '1'
  const selectedId = params.get('t') ?? undefined
  const [view, setView] = useState<View>(params.get('login') === '1' ? 'access' : 'overview')
  const [menu, setMenu] = useState(false)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loadError, setLoadError] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [favorites, setFavorites] = useState<string[]>(() => {
    const stored = localStorage.getItem('chc-favorite-teams')
    if (stored) return JSON.parse(stored) as string[]
    const legacy = localStorage.getItem('chc-favorite-team')
    return legacy ? [legacy] : []
  })
  const [tv, setTv] = useState(location.hash === '#tv')

  async function refresh() {
    try {
      const next = await loadTournament(selectedId)
      setTournament(next)
      setLoadError('')
      if (supabase) {
        const {data: userData} = await supabase.auth.getUser()
        if (userData.user) {
          const {data} = await supabase.from('tournament_members').select('role,revoked_at').eq('tournament_id', next.id).eq('user_id', userData.user.id).maybeSingle()
          setRole(data && !data.revoked_at ? data.role as Role : null)
        }
      }
    } catch (error) {
      setLoadError(errorText(error))
    }
  }

  useEffect(() => {
    void refresh()
    void supabase?.auth.getSession().then(async ({data}) => {
      setSignedIn(Boolean(data.session))
      if (data.session) await supabase?.rpc('accept_tournament_invitations')
    })
    const {data} = supabase?.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
      if (session) void supabase?.rpc('accept_tournament_invitations').then(() => refresh())
    }) ?? {data: null}
    return () => data?.subscription.unsubscribe()
  }, [])
  useEffect(() => tournament ? subscribeToTournament(tournament.id, () => void refresh()) : undefined, [tournament?.id])

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]
    setFavorites(next)
    localStorage.setItem('chc-favorite-teams', JSON.stringify(next))
  }

  if (loadError && !tournament) return <div className="loading">{loadError}</div>
  if (!tournament) return <div className="loading">Toernooi laden…</div>
  const active = {...tournament, role}
  const canScore = !hasSupabase || role === 'owner' || role === 'admin' || role === 'scorekeeper'
  const canManage = !hasSupabase || role === 'owner' || role === 'admin'
  if (tv && active.settings?.tvEnabled !== false) return <TvView tournament={active} onClose={() => {location.hash = ''; setTv(false)}} />

  const adminStep = view === 'general' ? 5 : view === 'teams' ? 2 : view === 'format' ? 3 : view === 'planner' ? 7 : view === 'overview' ? 1 : 6
  const nav = manageMode ? manageNav : publicNav
  const favoriteMatches = active.matches.filter(match => favorites.includes(match.homeTeamId ?? '') || favorites.includes(match.awayTeamId ?? ''))

  return <div className={`app ${manageMode ? 'manage-app' : 'public-app'}`}>
    <aside className={menu ? 'open' : ''}>
      <div className="brand"><span className="club-logo-wrap"><img className="club-logo" src="/chc-logo.png" alt="SV CHC" /></span><span className="brand-copy"><strong>SV CHC</strong><span>Toernooi</span></span><button className="icon-button mobile-only" onClick={() => setMenu(false)} aria-label="Menu sluiten"><X /></button></div>
      <nav>{nav.map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => {setView(id); setMenu(false)}}>{label}</button>)}</nav>
      {!manageMode && <button className="manager-login" onClick={() => {location.search = 'manage=1'}}><LogIn /> Beheer</button>}
    </aside>
    {menu && <button className="scrim" onClick={() => setMenu(false)} aria-label="Menu sluiten" />}
    <main>
      <div className="mobile-header"><button className="icon-button" onClick={() => setMenu(true)} aria-label="Menu openen"><Menu /></button><strong>{active.name}</strong>{manageMode && <span>{role ?? 'niet ingelogd'}</span>}</div>
      <div className="content">
        {manageMode && !signedIn && hasSupabase ? <Admin tournament={active} signedIn={signedIn} onLogin={email => void supabase?.auth.signInWithOtp({email, options: {emailRedirectTo: `${location.origin}/?manage=1&login=1`}}).then(({error}) => alert(error ? error.message : 'Inloglink verstuurd.'))} onRefresh={() => void refresh()} onSelect={id => {location.search = `manage=1&t=${id}`}} /> : null}
        {manageMode && (signedIn || !hasSupabase) && view === 'overview' && <section className="chc-panel"><header className="chc-heading"><div><p>Dashboard</p><h1>{active.name}</h1><span>{active.date} · {active.venue}</span></div><button className="button primary" onClick={() => setTv(true)}>TV-weergave openen</button></header><div className="metric-grid"><article><span>Teams</span><strong>{active.teams.length}</strong></article><article><span>Gepland</span><strong>{active.matches.filter(match => match.status === 'scheduled').length}</strong></article><article><span>Afgelopen</span><strong>{active.matches.filter(match => match.status === 'finished').length}</strong></article><article><span>Scheidsrechters</span><strong>{active.officials?.length ?? 0}</strong></article></div>{canManage && <Admin tournament={active} signedIn={signedIn || !hasSupabase} onLogin={() => undefined} onRefresh={() => void refresh()} onSelect={id => {location.search = `manage=1&t=${id}`}} initialStep={1} />}</section>}
        {manageMode && (signedIn || !hasSupabase) && (view === 'general' || view === 'teams' || view === 'format') && canManage && <Admin tournament={active} signedIn={signedIn || !hasSupabase} onLogin={() => undefined} onRefresh={() => void refresh()} onSelect={id => {location.search = `manage=1&t=${id}`}} initialStep={adminStep} />}
        {manageMode && view === 'teams' && canManage && <RegistrationQueue tournament={active} onChanged={() => void refresh()} />}
        {manageMode && view === 'planner' && <><PlannerPanel tournament={active} onChanged={() => void refresh()} />{canManage && <Admin tournament={active} signedIn={signedIn || !hasSupabase} onLogin={() => undefined} onRefresh={() => void refresh()} onSelect={id => {location.search = `manage=1&t=${id}`}} initialStep={7} />}</>}
        {manageMode && view === 'results' && <ResultsBoard tournament={active} canScore={canScore} onSaved={() => void refresh()} />}
        {manageMode && view === 'publish' && <section className="chc-panel"><header className="chc-heading"><div><p>Presentatie</p><h1>Delen, printen en exporteren</h1></div></header><p>{active.settings?.publicMessage}</p><div className="button-row"><button className="button primary" onClick={() => setTv(true)}>TV-weergave</button><button className="button secondary" onClick={() => window.print()}>Afdrukken / PDF</button><button className="button secondary" onClick={() => downloadText('programma.xls', toExcelXml('Programma', matchesToCsv(active)), 'application/vnd.ms-excel')}>Excel programma</button><button className="button secondary" onClick={() => downloadText('standen.xls', toExcelXml('Standen', standingsToCsv(active)), 'application/vnd.ms-excel')}>Excel standen</button></div></section>}
        {manageMode && view === 'access' && <AccessPanel tournament={active} onChanged={() => void refresh()} />}
        {manageMode && (signedIn || !hasSupabase) && !canManage && view !== 'results' && view !== 'publish' && view !== 'access' && <p className="chc-note">Je rol mag dit onderdeel niet wijzigen.</p>}
        {!manageMode && view === 'overview' && <section className="chc-panel"><header className="chc-heading"><div><p>CHC Toernooi</p><h1>{active.name}</h1><span>{active.date} · {active.venue}</span></div></header><p>{active.settings?.publicMessage}</p>{favoriteMatches.slice(0, 4).map(match => <MatchLine key={match.id} match={match} tournament={active} />)}</section>}
{(view === 'matches') && active.matches.map(match => <MatchLine key={match.id} match={match} tournament={active} />)}
        {!manageMode && view === 'standings' && [...new Set(active.teams.map(team => team.pool))].map(pool => <section key={pool} className="chc-panel"><h2>{pool}</h2><ol>{calculateStandings(active.teams, active.matches, pool, {win: active.settings?.pointsWin ?? 3, draw: active.settings?.pointsDraw ?? 1}).map(row => <li key={row.team.id}>{row.team.name} · {row.points} pt</li>)}</ol></section>)}
        {!manageMode && view === 'teams' && active.teams.map(team => <button className={`chc-score-row ${favorites.includes(team.id) ? 'is-favorite' : ''}`} key={team.id} onClick={() => toggleFavorite(team.id)}><Star /><span><strong>{team.name}</strong><small>{team.pool} · {team.changingRoom || 'Kleedkamer volgt'}</small></span></button>)}
        {!manageMode && view === 'register' && <RegisterForm tournament={active} />}
      </div>
      <nav className="bottom-nav">{(manageMode ? [['overview', 'Home', LayoutDashboard], ['matches', 'Programma', CalendarDays], ['results', 'Uitslagen', ClipboardCheck], ['teams', 'Teams', Users]] : [['overview', 'Home', LayoutDashboard], ['matches', 'Programma', CalendarDays], ['standings', 'Standen', Table2], ['teams', 'Mijn team', Star]]).map(item => {const [id, label, Icon] = item as [View, string, typeof LayoutDashboard]; return <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon /><span>{label}</span></button>})}</nav>
    </main>
  </div>
}

function MatchLine({match, tournament}: {match: Match; tournament: Tournament}) {
  return <article className="match-row"><div className="match-meta"><strong>{match.kickoff}</strong><span>{match.field}</span></div><div className="fixture"><span>{teamName(tournament, match.homeTeamId)}</span><span>{teamName(tournament, match.awayTeamId)}</span></div><div className="score"><strong>{match.homeScore ?? '–'}</strong><strong>{match.awayScore ?? '–'}</strong></div></article>
}
