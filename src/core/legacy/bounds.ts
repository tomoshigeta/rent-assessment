import { toYen, type RoundingMode, type Yen } from '../money'
import { computeScenario } from './scenario'
import type { Scenario } from '../types'

/**
 * 貸主側の下限目安 L。仕様書 §6（Q5/Q7 の決定により改訂）。
 *
 *   L = q · max(H − d, 0) / (H + 1)
 *
 * 更新継続時の収支と、退去後の再募集時の収支が等しくなる月額収入。
 * 入替に伴う追加負担の差額 K を K = L と置いた形で、K は入力を持たない。
 * max(H − d, 0) は、空室が比較期間全体に及ぶ場合に入居後月数が負にならないようにする
 * （仕様書 §6「対象期間内の入居後月数は0未満にせず」）。
 */
export function landlordFloor(
  reletMonthlyIncome: Yen,
  horizonMonths: number,
  vacantMonths: number,
  rounding: RoundingMode,
): Yen {
  if (horizonMonths <= 0) throw new RangeError('比較期間は1ヶ月以上である必要があります')
  if (vacantMonths < 0) throw new RangeError('空室月数は0以上である必要があります')
  const occupied = Math.max(horizonMonths - vacantMonths, 0)
  return toYen((reletMonthlyIncome * occupied) / (horizonMonths + 1), rounding)
}

/** 再募集を選んだ場合の、比較期間内の収入合計 q·max(H−d,0)。貸主資料に併記する。 */
export function reletGrossIncome(reletMonthlyIncome: Yen, horizonMonths: number, vacantMonths: number): Yen {
  return reletMonthlyIncome * Math.max(horizonMonths - vacantMonths, 0)
}

export interface TenantCeiling {
  /** 更新と転居の累計費用が等しくなる家賃本体の上限。 */
  rentCeiling: Yen
  /** 上限時の家賃＋管理費。仕様書 §6「管理費を含む月額から…家賃本体も併記する」。 */
  totalCeiling: Yen
  /** どの転居候補に対する上限か。 */
  againstScenarioId: string
  againstLabel: string
  /** 上限時の更新側累計と転居側累計。ぴったり一致しない場合の差を確認できる。 */
  renewCumulative: Yen
  moveCumulative: Yen
  exact: boolean
}

/**
 * 借主側の上限目安。仕様書 §6。
 *
 * 固定条件なら U = p + (F_j − F_s)/H だが、仕様書は
 * 「費用が賃料に連動する場合は、更新の累計費用と転居の累計費用が等しくなる金額を再計算する」
 * としている。更新料が「賃料の1ヶ月分」のように賃料へ連動すると閉じた式では解けないため、
 * 実際の月次計算に対する二分探索で求める。
 *
 * 前提: 累計費用は家賃について単調非減少である（家賃そのものと、家賃に連動する倍率費用のみが増える）。
 */
export function tenantCeiling(
  renewScenario: Scenario,
  moveScenario: Scenario,
  horizonMonths: number,
  rounding: RoundingMode,
  maxRent: Yen = 100_000_000,
): TenantCeiling {
  const target = computeScenario(moveScenario, horizonMonths, rounding).cumulativeAt(horizonMonths)
  const renewCumulativeFor = (rent: Yen): Yen =>
    computeScenario({ ...renewScenario, rent }, horizonMonths, rounding).cumulativeAt(horizonMonths)

  // target を超えない最大の家賃を探す。
  let lo = 0
  let hi = maxRent
  if (renewCumulativeFor(lo) > target) {
    // 家賃0でも更新の方が高い。転居が無条件に安く、上限は存在しない。
    return {
      rentCeiling: 0,
      totalCeiling: renewScenario.managementFee,
      againstScenarioId: moveScenario.id,
      againstLabel: moveScenario.label,
      renewCumulative: renewCumulativeFor(0),
      moveCumulative: target,
      exact: false,
    }
  }
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (renewCumulativeFor(mid) <= target) lo = mid
    else hi = mid - 1
  }
  const renewCumulative = renewCumulativeFor(lo)
  return {
    rentCeiling: lo,
    totalCeiling: lo + renewScenario.managementFee,
    againstScenarioId: moveScenario.id,
    againstLabel: moveScenario.label,
    renewCumulative,
    moveCumulative: target,
    exact: renewCumulative === target,
  }
}

/**
 * 複数の転居候補に対する上限のうち、最も低い額を採る。仕様書 §6
 * 「複数の現実的な転居候補があれば、各候補の上限のうち最も低い額を表示する」。
 */
export function bindingTenantCeiling(
  renewScenario: Scenario,
  moveScenarios: Scenario[],
  horizonMonths: number,
  rounding: RoundingMode,
): { binding: TenantCeiling | null; all: TenantCeiling[] } {
  const all = moveScenarios.map((m) => tenantCeiling(renewScenario, m, horizonMonths, rounding))
  const binding = all.reduce<TenantCeiling | null>(
    (min, c) => (min === null || c.rentCeiling < min.rentCeiling ? c : min),
    null,
  )
  return { binding, all }
}
