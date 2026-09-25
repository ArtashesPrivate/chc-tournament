import {useEffect, useState} from 'react'
import {errorText} from '../lib/errors'
import {supabase} from '../lib/supabase'
import type {Registration, Tournament} from '../types'

export function RegisterForm({tournament}: {tournament: Tournament}) {
  const [form, setForm] = useState({teamName: '', clubName: '', category: 'JO13', contactName: '', contactEmail: '', note: ''})
  const [message, setMessage] = useState('')
  async function submit() {
    if (!supabase) {setMessage('Inschrijven werkt alleen in de live app.'); return}
    const {error} = await supabase.from('registrations').insert({tournament_id: tournament.id, team_name: form.teamName, club_name: form.clubName, category: form.category, contact_name: form.contactName, contact_email: form.contactEmail, note: form.note, status: 'pending'})
    setMessage(error ? errorText(error) : 'Inschrijving ontvangen. De organisatie beoordeelt hem.')
    if (!error) setForm({teamName: '', clubName: '', category: 'JO13', contactName: '', contactEmail: '', note: ''})
  }
  return <section className="chc-panel"><header className="chc-heading"><div><p>Externe teams</p><h1>Inschrijven</h1></div></header><div className="chc-form">
    <label>Teamnaam<input value={form.teamName} onChange={event => setForm({...form, teamName: event.target.value})} /></label>
    <label>Club<input value={form.clubName} onChange={event => setForm({...form, clubName: event.target.value})} /></label>
    <label>Categorie<input value={form.category} onChange={event => setForm({...form, category: event.target.value})} /></label>
    <label>Contact<input value={form.contactName} onChange={event => setForm({...form, contactName: event.target.value})} /></label>
    <label>E-mail<input type="email" value={form.contactEmail} onChange={event => setForm({...form, contactEmail: event.target.value})} /></label>
    <label>Opmerking<input value={form.note} onChange={event => setForm({...form, note: event.target.value})} /></label>
    <button className="button primary" disabled={form.teamName.length < 2 || form.clubName.length < 2 || !form.contactEmail.includes('@')} onClick={() => void submit()}>Inschrijving versturen</button>
    {message && <p className="chc-note">{message}</p>}
  </div></section>
}

export function RegistrationQueue({tournament, onChanged}: {tournament: Tournament; onChanged: () => void}) {
  const [rows, setRows] = useState<Registration[]>([])
  const [message, setMessage] = useState('')
  async function load() {
    if (!supabase) return
    const {data, error} = await supabase.from('registrations').select('*').eq('tournament_id', tournament.id).order('created_at', {ascending: false})
    if (error) setMessage(errorText(error))
    else setRows((data ?? []).map(row => ({id: row.id, teamName: row.team_name, clubName: row.club_name, category: row.category, contactName: row.contact_name, contactEmail: row.contact_email, note: row.note, status: row.status})))
  }
  useEffect(() => {void load()}, [tournament.id])
  async function review(id: string, decision: 'approved' | 'rejected') {
    const {error} = await supabase!.rpc('review_registration', {registration_id: id, decision})
    setMessage(error ? errorText(error) : decision === 'approved' ? 'Team goedgekeurd en toegevoegd.' : 'Inschrijving afgewezen.')
    await load()
    onChanged()
  }
  return <section className="chc-panel"><h2>Inschrijvingen</h2>{message && <p className="chc-note">{message}</p>}{rows.length === 0 && <p>Nog geen externe inschrijvingen.</p>}<div className="chc-stack">{rows.map(row => <article key={row.id} className="chc-score-row"><div><strong>{row.teamName}</strong><span>{row.clubName} · {row.category} · {row.contactEmail}</span></div><div>{row.status === 'pending' ? <><button className="button primary" onClick={() => void review(row.id, 'approved')}>Goedkeuren</button><button className="button secondary" onClick={() => void review(row.id, 'rejected')}>Afwijzen</button></> : <span>{row.status === 'approved' ? 'Goedgekeurd' : 'Afgewezen'}</span>}</div></article>)}</div></section>
}
