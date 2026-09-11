import type { Yen } from '../money'
import type { ScenarioResult } from './scenario'

/** どちらが安いか。 */
export type Cheaper = 'renew' | 'move' | 'equal'

export interface Flip {
  /** その月の累計から優劣が変わる。 */
  month: number
  cheaper: Exclude<Cheaper, 'equal'>
}

export interface CrossoverResult {
  /** Δ(n) = 0 となる月すべて。 */
  equalMonths: number[]
  /**
   * 同額を挟んで優劣が変わった月。仕様書 §5「最初の逆転」「更新料等による再逆転」。
   * month はその優劣が成立する最初の月。
   */
  flips: Flip[]
  /**
   * 同額だが前後の優劣が変わらない月。仕様書 §5
   * 「同じ優劣に戻る場合は『同額時点あり』と表示する」。
   */
  equalWithoutFlip: number[]
  /** 開始時点（0ヶ月目）の優劣。 */
  initialCheaper: Cheaper
  /** 探索した月数。仕様書 §5「120ヶ月以内に逆転なし」など範囲を付けて表示する。 */
  searchHorizon: number
  /** 選択された比較期間。flips のうちこれを超えるものは「選択期間外」。 */
  horizon: number
  /** 各月の差額 Δ(n) = C_move(n) − C_renew(n)。正なら更新が安い。 */
  deltas: Yen[]
}

/**
 * 更新シナリオと転居候補の累計費用を月ごとに比較する。仕様書 §5。
 *
 * Δ(n) = C_move(n) − C_renew(n)
 * 正なら更新の方が安く、負なら転居の方が安い。ゼロは同額。
 * 判定は円単位の累計額で行い、月の途中への補間は行わない。
 */
export function findCrossovers(
  renew: ScenarioResult,
  move: ScenarioResult,
  horizon: number,
  searchHorizon: number,
): CrossoverResult {
  if (searchHorizon < horizon) throw new RangeError('探索範囲は比較期間以上である必要があります')

  const deltas: Yen[] = []
  for (let n = 0; n <= searchHorizon; n++) {
    deltas.push(move.cumulativeAt(n) - renew.cumulativeAt(n))
  }

  const signOf = (d: Yen): -1 | 0 | 1 => (d > 0 ? 1 : d < 0 ? -1 : 0)
  const cheaperOf = (s: -1 | 1): Exclude<Cheaper, 'equal'> => (s === 1 ? 'renew' : 'move')

  const equalMonths: number[] = []
  const flips: Flip[] = []
  const equalWithoutFlip: number[] = []

  let lastNonZeroSign: -1 | 1 | null = null
  for (let n = 0; n <= searchHorizon; n++) {
    const s = signOf(deltas[n])
    if (s === 0) {
      equalMonths.push(n)
      continue
    }
    if (lastNonZeroSign !== null && s !== lastNonZeroSign) {
      flips.push({ month: n, cheaper: cheaperOf(s) })
    }
    lastNonZeroSign = s
  }

  // 同額月のうち、前後の優劣が変わらなかったものを分類する。
  for (const m of equalMonths) {
    let before: -1 | 1 | null = null
    for (let n = m - 1; n >= 0; n--) {
      const s = signOf(deltas[n])
      if (s !== 0) { before = s; break }
    }
    let after: -1 | 1 | null = null
    for (let n = m + 1; n <= searchHorizon; n++) {
      const s = signOf(deltas[n])
      if (s !== 0) { after = s; break }
    }
    if (before !== null && after !== null && before === after) equalWithoutFlip.push(m)
  }

  const d0 = signOf(deltas[0])
  const initialCheaper: Cheaper = d0 === 0 ? 'equal' : cheaperOf(d0)

  return { equalMonths, flips, equalWithoutFlip, initialCheaper, searchHorizon, horizon, deltas }
}

/** 仕様書 §5 の表示文言を組み立てる。 */
export function describeCrossovers(r: CrossoverResult, unknownItems: string[] = []): string[] {
  const lines: string[] = []

  if (unknownItems.length > 0) {
    lines.push(`金額が不明な項目があります（${unknownItems.join('、')}）。以下は明示した仮定による参考計算です。`)
  }

  const withinEqual = r.equalMonths.filter((m) => m > 0 && m <= r.horizon)
  for (const m of withinEqual) {
    lines.push(
      r.equalWithoutFlip.includes(m)
        ? `${m}ヶ月で同額時点あり（前後の優劣は変わりません）。`
        : `${m}ヶ月で同額。`,
    )
  }

  if (r.flips.length === 0) {
    const initial =
      r.initialCheaper === 'equal'
        ? '全期間で同額です'
        : r.initialCheaper === 'renew'
          ? '当初から更新が安く、優劣は変わりません'
          : '当初から転居が安く、優劣は変わりません'
    lines.push(`${r.searchHorizon}ヶ月以内に逆転なし。${initial}。`)
    return lines
  }

  for (const f of r.flips) {
    const who = f.cheaper === 'renew' ? '更新' : '転居'
    const outside = f.month > r.horizon ? '（選択期間外）' : ''
    lines.push(`${f.month}ヶ月目の累計から${who}が割安${outside}。`)
  }

  // 優劣が割安な区間として読めるようにする（仕様書 §5「割安な月の区間を表示する」）。
  const segments: string[] = []
  let start = 0
  let current: Cheaper = r.initialCheaper
  for (const f of r.flips) {
    if (current !== 'equal') {
      segments.push(`${start}〜${f.month - 1}ヶ月: ${current === 'renew' ? '更新' : '転居'}が割安`)
    }
    start = f.month
    current = f.cheaper
  }
  if (current !== 'equal') {
    segments.push(`${start}〜${r.searchHorizon}ヶ月: ${current === 'renew' ? '更新' : '転居'}が割安`)
  }
  if (segments.length > 0) lines.push(segments.join(' / '))

  return lines
}
