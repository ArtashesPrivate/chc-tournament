import {describe, expect, it} from 'vitest'
import {errorText} from './errors'
import {matchesToCsv, toExcelXml} from './export'
import {demoTournament} from '../demo'

describe('errors and export', () => {
  it('turns a permission error into a Dutch explanation', () => {
    expect(errorText({code: '42501', message: 'new row violates row-level security'})).toMatch(/geen rechten/i)
  })

  it('exports matches as semicolon csv and spreadsheet xml', () => {
    const csv = matchesToCsv(demoTournament)
    expect(csv).toContain('CHC/Loomer JO13-1')
    expect(toExcelXml('Programma', csv)).toContain('<Workbook')
  })
})
