import { resolveAmount, toYen, type AmountContext, type Yen } from './money'
import type { RecurringSchedule, Scenario } from './types'

/**
 * 定期的な費用の発生月を列挙する。
 *
 * 'renewal' は仕様書 §4 の規則をそのまま表す:
 * 契約期間 C ヶ月なら、開始時（includeStart のとき 0ヶ月目）と、
 * 以後 1 + k*C ヶ月目（k=1,2,...）に発生する。C=24 なら 0, 25, 49, 73 …。
 * 24ヶ月の比較では 25ヶ月目の更新料が期間外に落ちる。
 */
export function occurrenceMonths(schedule: RecurringSchedule, upToMonth: number): number[] {
  if (schedule.kind === 'months') {
    return schedule.months.filter((m) => m >= 0 && m <= upToMonth).sort((a, b) => a - b)
  }
  const { contractMonths, includeStart } = schedule
  if (contractMonths <= 0) throw new RangeError('契約期間は1ヶ月以上である必要があります')
  const months: number[] = []
  if (includeStart) months.push(0)
  for (let k = 1; ; k++) {
    const m = 1 + k * contractMonths
    if (m > upToMonth) break
    months.push(m)
  }
  return months
}

/** 月別明細の1行。 */
export interface LineItem {
  label: string
  /** 費用は正、控除は負。 */
  yen: Yen
  category: 'rent' | 'management' | 'monthly' | 'oneTime' | 'recurring' | 'discount' | 'freeRent' | 'amortization'
  /** false のとき金額が不明（0として計算しているが確定ではない）。 */
  known: boolean
}

export interface MonthRow {
  month: number
  /** その月の費用純額。 */
  net: Yen
  /** 0ヶ月目からの累計費用 C(n)。 */
  cumulative: Yen
  items: LineItem[]
}

export interface ScenarioResult {
  scenarioId: string
  label: string
  rows: MonthRow[]
  /** C(n) を月で引く。n は 0..searchHorizon。 */
  cumulativeAt(month: number): Yen
  /**
   * 契約時（0ヶ月目）に必要な資金。仕様書 §3, §8-07, §8-08。
   * 費用総額とは別物で、返還される預け金と前家賃を含む。
   */
  initialCash: Yen
  /** 返還が予定されている預け金の総額（費用総額には含まれない）。 */
  refundableDeposits: Yen
  /** 返還予定（月が指定されたもののみ）。 */
  refundSchedule: { month: number; label: string; yen: Yen }[]
  /** 金額が不明な項目。空でなければ結果は参考値（仕様書 §8-12）。 */
  unknownItems: string[]
}

/**
 * ひとつのシナリオについて 0..horizon ヶ月の累計費用を計算する。
 *
 * 仕様書 §4 の時間軸:
 *   C(0) = F（開始時の一時費用）
 *   C(n) = C(n-1) + M(n) + E(n) - D(n)
 * 家賃は1ヶ月目から計上する。
 */
export function computeScenario(scenario: Scenario, horizon: number, ctxRounding: AmountContext['rounding']): ScenarioResult {
  if (!Number.isInteger(horizon) || horizon < 0) throw new RangeError('比較月数は0以上の整数である必要があります')

  const ctx: AmountContext = {
    rent: scenario.rent,
    managementFee: scenario.managementFee,
    rounding: ctxRounding,
  }
  const unknownItems: string[] = []
  const noteUnknown = (label: string) => {
    if (!unknownItems.includes(label)) unknownItems.push(label)
  }

  // 月ごとの明細を組み立てる。
  const rows: MonthRow[] = []
  for (let m = 0; m <= horizon; m++) rows.push({ month: m, net: 0, cumulative: 0, items: [] })
  const push = (month: number, item: LineItem) => {
    if (month < 0 || month > horizon) return
    rows[month].items.push(item)
    if (!item.known) noteUnknown(item.label)
  }

  // --- 毎月の費用（1ヶ月目から） ---
  for (let m = 1; m <= horizon; m++) {
    push(m, { label: '家賃', yen: toYen(scenario.rent, ctxRounding), category: 'rent', known: true })
    push(m, { label: '管理費', yen: toYen(scenario.managementFee, ctxRounding), category: 'management', known: true })
    for (const item of scenario.monthly) {
      const r = resolveAmount(item.amount, ctx)
      push(m, { label: item.label, yen: r.yen, category: 'monthly', known: r.known })
    }
  }

  // --- フリーレント（対象月・対象項目だけを控除）---
  for (const fr of scenario.freeRent) {
    for (const m of fr.months) {
      const base = fr.target === 'rent' ? scenario.rent : scenario.rent + scenario.managementFee
      push(m, { label: fr.label, yen: -toYen(base, ctxRounding), category: 'freeRent', known: true })
    }
  }

  // --- 一時的な費用 ---
  for (const item of scenario.oneTime) {
    const r = resolveAmount(item.amount, ctx)
    push(item.month, { label: item.label, yen: r.yen, category: 'oneTime', known: r.known })
  }

  // --- 定期的な費用 ---
  for (const item of scenario.recurring) {
    const r = resolveAmount(item.amount, ctx)
    for (const m of occurrenceMonths(item.schedule, horizon)) {
      push(m, { label: item.label, yen: r.yen, category: 'recurring', known: r.known })
    }
  }

  // --- 割引・返戻 ---
  for (const item of scenario.discounts) {
    const r = resolveAmount(item.amount, ctx)
    push(item.month, { label: item.label, yen: -r.yen, category: 'discount', known: r.known })
  }

  // --- 預け金: 償却部分だけを費用計上する（仕様書 §3, §8-07）---
  let refundableDeposits = 0
  /** 0ヶ月目に預け入れる総額。必要資金に含めるが費用ではない。 */
  let depositCashOutAtZero = 0
  const refundSchedule: ScenarioResult['refundSchedule'] = []
  for (const dep of scenario.deposits) {
    const total = resolveAmount(dep.total, ctx)
    const amortized = resolveAmount(dep.amortized, ctx)
    if (!total.known) noteUnknown(`${dep.label}（預入額）`)
    if (!amortized.known) noteUnknown(`${dep.label}（償却額）`)
    if (dep.paidMonth === 0) depositCashOutAtZero += total.yen
    const refundable = total.yen - amortized.yen
    refundableDeposits += refundable
    if (amortized.yen !== 0 || !amortized.known) {
      push(dep.paidMonth, {
        label: `${dep.label}（償却）`,
        yen: amortized.yen,
        category: 'amortization',
        known: amortized.known && total.known,
      })
    }
    if (dep.refundMonth !== undefined && refundable !== 0) {
      refundSchedule.push({ month: dep.refundMonth, label: dep.label, yen: refundable })
    }
  }

  // --- 累計 ---
  let cumulative = 0
  for (const row of rows) {
    row.net = row.items.reduce((sum, i) => sum + i.yen, 0)
    cumulative += row.net
    row.cumulative = cumulative
  }

  // --- 契約時必要資金（仕様書 §3, §8-07, §8-08）---
  // 0ヶ月目に実際に出ていく現金。費用総額とは別物である。
  //  - 0ヶ月目の費用明細のうち、償却行を除いたもの（償却は預入総額の内数なので二重計上を避ける）
  //  - 預け金の預入総額（返還される分も現金としては出ていく）
  //  - 前家賃（費用は対応する月に計上済みで、ここは支払時点の現金）
  const monthZeroCostsExcludingAmortization = rows[0].items
    .filter((i) => i.category !== 'amortization')
    .reduce((sum, i) => sum + i.yen, 0)
  const initialCash = monthZeroCostsExcludingAmortization + depositCashOutAtZero + scenario.prepaidRent

  const cumulativeByMonth = rows.map((r) => r.cumulative)
  return {
    scenarioId: scenario.id,
    label: scenario.label,
    rows,
    cumulativeAt(month: number) {
      if (month < 0) throw new RangeError('月数は0以上である必要があります')
      if (month >= cumulativeByMonth.length) return cumulativeByMonth[cumulativeByMonth.length - 1]
      return cumulativeByMonth[month]
    },
    initialCash,
    refundableDeposits,
    refundSchedule: refundSchedule.sort((a, b) => a.month - b.month),
    unknownItems,
  }
}

/**
 * 月額換算した負担額 A(H) = C(H) / H。仕様書 §4。
 * H=0 のときは 0 を返す（除算を避ける）。
 */
export function monthlyEquivalent(result: ScenarioResult, horizon: number, rounding: AmountContext['rounding']): Yen {
  if (horizon <= 0) return 0
  return toYen(result.cumulativeAt(horizon) / horizon, rounding)
}
