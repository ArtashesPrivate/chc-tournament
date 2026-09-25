export function errorText(error: unknown): string {
  const record = typeof error === 'object' && error ? error as {message?: string; code?: string; details?: string} : null
  const message = record?.message || (error instanceof Error ? error.message : String(error || ''))
  const code = record?.code || ''
  if (code === '42501' || /row-level security|permission denied/i.test(message)) return 'Je hebt geen rechten voor deze actie. Vraag de eigenaar om toegang, of log opnieuw in.'
  if (code === '23505' || /duplicate key/i.test(message)) return 'Dit item bestaat al. Kies een andere naam of pas het bestaande item aan.'
  if (code === '23503' || /foreign key/i.test(message)) return 'Dit item wordt nog ergens gebruikt. Verwijder of verplaats de gekoppelde gegevens eerst.'
  if (code === '23514' || /check constraint/i.test(message)) return 'De ingevulde gegevens voldoen niet aan de regels. Controleer de velden en probeer opnieuw.'
  if (/JWT|session|not authenticated|Log opnieuw in/i.test(message)) return 'Je sessie is verlopen. Log opnieuw in en probeer het nog eens.'
  if (/Alleen de eigenaar|geen rechten|Deze rol mag/i.test(message)) return message
  if (!message) return 'Actie mislukt. Probeer het opnieuw.'
  return message
}
