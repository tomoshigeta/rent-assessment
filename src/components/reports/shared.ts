import type { AssessedRent, Listing, RentRange, Subject, VacancyMonths } from '@/core'

export interface ReportProps {
  subject: Subject
  listings: Listing[]
  assessed: AssessedRent
  result: { R0: number; A: number; range: RentRange; breakEven: number | null; markdown: boolean }
  vacancyMonths: VacancyMonths
  restorationCost: number
  offerRent?: number
}

export const yen = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}円`
export const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
export const today = () => new Date().toLocaleDateString('ja-JP')

export const access = (p: { line?: string; station?: string; walkMinutes?: number }) =>
  p.station ? `${p.line ? p.line + ' ' : ''}${p.station}${p.walkMinutes ? ` 徒歩${p.walkMinutes}分` : ''}` : '—'

export const age = (p: { builtYearMonth?: string }) => {
  if (!p.builtYearMonth) return '—'
  const y = Number(p.builtYearMonth.slice(0, 4))
  return Number.isFinite(y) ? `${p.builtYearMonth}（築${new Date().getFullYear() - y}年）` : p.builtYearMonth
}
