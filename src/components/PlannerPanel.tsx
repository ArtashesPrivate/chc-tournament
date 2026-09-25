import {useState} from 'react'
import {describeConflicts, generateSchedule} from '../lib/matchday'
import {errorText} from '../lib/errors'
import type {Tournament} from '../types'

export function PlannerPanel({tournament, onChanged}: {tournament: Tournament; onChanged: () => void}) {
  const [message, setMessage] = useState('')
  const conflicts = describeConflicts(tournament)
  async function generate() {
    try {
      const plan = await generateSchedule(tournament)
      setMessage(plan.unplaced.length ? `${plan.placed.length} wedstrijden gepland. ${plan.unplaced.length} past niet meer voor 18:00 zonder conflict.` : `${plan.placed.length} wedstrijden conflictvrij gepland. Finales stromen door zodra de poules gespeeld zijn.`)
      onChanged()
    } catch (error) {
      setMessage(errorText(error))
    }
  }
  return <section className="chc-panel"><header className="chc-heading"><div><p>Schema</p><h1>Conflictcontrole</h1></div><button className="button primary" onClick={() => void generate()}>Schema genereren</button></header>
    {message && <p className="chc-note">{message}</p>}
    {conflicts.length === 0 ? <p>Geen team-, veld- of scheidsrechterconflicten in het huidige schema.</p> : <ul>{conflicts.map((conflict, index) => <li key={index}>{conflict.message}</li>)}</ul>}
  </section>
}
