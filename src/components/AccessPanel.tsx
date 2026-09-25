import {useEffect, useState} from 'react'
import {supabase} from '../lib/supabase'
import {errorText} from '../lib/errors'
import type {Invitation, Tournament} from '../types'

export function AccessPanel({tournament, onChanged}: {tournament: Tournament; onChanged: () => void}) {
  const [rows, setRows] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Invitation['role']>('scorekeeper')
  const [message, setMessage] = useState('')
  async function load() {
    if (!supabase) return
    const {data, error} = await supabase.from('tournament_invitations').select('*').eq('tournament_id', tournament.id).order('created_at', {ascending: false})
    if (error) setMessage(errorText(error))
    else setRows((data ?? []).map(row => ({id: row.id, email: row.email, role: row.role, acceptedAt: row.accepted_at})))
  }
  useEffect(() => {void load()}, [tournament.id])
  async function invite() {
    const address = email.trim().toLowerCase()
    const {error} = await supabase!.from('tournament_invitations').upsert({tournament_id: tournament.id, email: address, role, accepted_at: null}, {onConflict: 'tournament_id,email'})
    if (error) {setMessage(errorText(error)); return}
    const {error: mailError} = await supabase!.auth.signInWithOtp({email: address, options: {emailRedirectTo: `${location.origin}/?manage=1&login=1`}})
    setMessage(mailError ? errorText(mailError) : 'Uitnodiging en inloglink verstuurd.')
    setEmail('')
    await load()
  }
  async function revoke(address: string) {
    const {error} = await supabase!.rpc('revoke_tournament_access', {target_tournament: tournament.id, target_email: address})
    setMessage(error ? errorText(error) : 'Toegang ingetrokken.')
    await load()
    onChanged()
  }
  return <section className="chc-panel"><header className="chc-heading"><div><p>Rollen</p><h1>Toegang</h1></div></header>
    <div className="chc-form inline"><label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Rol<select value={role} onChange={event => setRole(event.target.value as Invitation['role'])}><option value="admin">Beheerder</option><option value="scorekeeper">Uitslagen</option><option value="viewer">Alleen bekijken</option></select></label><button className="button primary" disabled={!email.includes('@')} onClick={() => void invite()}>Uitnodigen</button></div>
    {message && <p className="chc-note">{message}</p>}
    <div className="chc-stack">{rows.map(row => <article key={row.id} className="chc-score-row"><div><strong>{row.email}</strong><span>{row.role} · {row.acceptedAt ? 'Actief' : 'Uitgenodigd'}</span></div>{tournament.role === 'owner' && <button className="button secondary" onClick={() => void revoke(row.email)}>Toegang intrekken</button>}</article>)}</div>
  </section>
}
