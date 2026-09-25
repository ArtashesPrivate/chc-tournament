import {calculateStandings} from '../standings'
import type {Match, Team, Tournament} from '../types'

const teamName = (teams: Team[], id: string | null) => teams.find(team => team.id === id)?.name ?? 'Nader te bepalen'

export function matchesToCsv(tournament: Tournament) {
  const lines = [['Tijd', 'Veld', 'Poule', 'Fase', 'Thuis', 'Uit', 'Stand', 'Status', 'Scheidsrechter']]
  for (const match of tournament.matches) {
    lines.push([
      match.kickoff,
      match.field,
      match.pool,
      match.stage ?? 'pool',
      teamName(tournament.teams, match.homeTeamId),
      teamName(tournament.teams, match.awayTeamId),
      match.homeScore === null ? '' : `${match.homeScore}-${match.awayScore}`,
      match.status,
      match.referee ?? '',
    ])
  }
  return lines.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')
}

export function standingsToCsv(tournament: Tournament) {
  const lines = [['Poule', 'Positie', 'Team', 'Gespeeld', 'W', 'G', 'V', 'Voor', 'Tegen', 'Saldo', 'Punten']]
  for (const pool of [...new Set(tournament.teams.map(team => team.pool))]) {
    calculateStandings(tournament.teams, tournament.matches, pool).forEach((row, index) => {
      lines.push([pool, String(index + 1), row.team.name, String(row.played), String(row.won), String(row.drawn), String(row.lost), String(row.goalsFor), String(row.goalsAgainst), String(row.goalsFor - row.goalsAgainst), String(row.points)])
    })
  }
  return lines.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\r\n')
}

export function toExcelXml(sheetName: string, csv: string) {
  const rows = csv.split(/\r?\n/).filter(Boolean).map(line => [...line.matchAll(/"([^"]|"")*"/g)].map(match => match[0].slice(1, -1).replaceAll('""', '"')))
  const body = rows.map(row => `<Row>${row.map(cell => `<Cell><Data ss:Type="String">${cell.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</Data></Cell>`).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${sheetName}"><Table>${body}</Table></Worksheet></Workbook>`
}

export function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], {type})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
