import {
  assessDesiredRent, bindingTenantCeiling, buildScenarios, computeScenario, describeCrossovers,
  findCrossovers, landlordFloor, monthlyEquivalent, reletGrossIncome,
  type AssessmentResult, type Case, type CrossoverResult, type Scenario, type ScenarioResult, type TenantCeiling,
} from '@/core'

export interface ScenarioView {
  scenario: Scenario
  result: ScenarioResult
  /** 比較期間終了時点の累計費用。 */
  total: number
  /** 月額換算した負担額 A(H)。 */
  monthlyEquivalent: number
}

export interface MoveComparison {
  view: ScenarioView
  crossover: CrossoverResult
  messages: string[]
}

export interface LandlordView {
  /** 下限目安 L。 */
  floor: number
  /** 再募集を選んだ場合の比較期間内の収入合計。 */
  reletGross: number
  /** 各更新案の比較期間内の収入（家賃＋管理費ベース）。 */
  renewalIncomes: { label: string; monthly: number; gross: number }[]
}

export interface Analysis {
  assessment: AssessmentResult
  renewals: ScenarioView[]
  /** 判定と資料の基準になる「希望額で更新」。 */
  desired: ScenarioView
  moves: MoveComparison[]
  ceiling: { binding: TenantCeiling | null; all: TenantCeiling[] }
  landlord: LandlordView
  /** 全シナリオを通じて金額が不明な項目。 */
  unknownItems: string[]
  horizon: number
  searchHorizon: number
}

/**
 * 案件から結果画面・資料に必要な数字をすべて導く。
 *
 * 計算そのものは @/core の純粋な処理に委ね、ここは組み立てだけを行う。
 * 同じ案件と同じルール版なら常に同じ結果になる（仕様書 §9）。
 */
export function analyze(c: Case): Analysis {
  const { horizonMonths: horizon, searchHorizonMonths: searchHorizon, rounding } = c.settings
  const built = buildScenarios(c)

  const toView = (scenario: Scenario): ScenarioView => {
    const result = computeScenario(scenario, searchHorizon, rounding)
    return {
      scenario,
      result,
      total: result.cumulativeAt(horizon),
      monthlyEquivalent: monthlyEquivalent(result, horizon, rounding),
    }
  }

  const renewals = built.renewals.map(toView)
  const desired = renewals.find((v) => v.scenario.kind === 'renew_desired') ?? renewals[0]

  const moves: MoveComparison[] = built.moves.map((m) => {
    const view = toView(m)
    const crossover = findCrossovers(desired.result, view.result, horizon, searchHorizon)
    const unknown = [...new Set([...desired.result.unknownItems, ...view.result.unknownItems])]
    return { view, crossover, messages: describeCrossovers(crossover, unknown) }
  })

  const ceiling = bindingTenantCeiling(desired.scenario, built.moves, horizon, rounding)

  const landlord: LandlordView = {
    floor: landlordFloor(c.relet.reletMonthlyIncome, horizon, c.relet.vacantMonths, rounding),
    reletGross: reletGrossIncome(c.relet.reletMonthlyIncome, horizon, c.relet.vacantMonths),
    renewalIncomes: renewals.map((v) => ({
      label: v.scenario.label,
      monthly: v.scenario.rent + v.scenario.managementFee,
      gross: (v.scenario.rent + v.scenario.managementFee) * horizon,
    })),
  }

  const unknownItems = [
    ...new Set([...renewals, ...moves.map((m) => m.view)].flatMap((v) => v.result.unknownItems)),
  ]

  return {
    assessment: assessDesiredRent(
      c.desiredRent + c.desiredManagementFee, c.comparables, c.thresholds, rounding,
    ),
    renewals,
    desired,
    moves,
    ceiling,
    landlord,
    unknownItems,
    horizon,
    searchHorizon,
  }
}
