import type { Amount, Yen } from '../money'
import type { Case, MoveCandidate, RenewalPlan, Scenario, ScenarioKind } from '../types'

/**
 * 更新シナリオを組み立てる。
 *
 * 更新料は「今回の更新料」を0ヶ月目に、次回以降を 1 + k·C ヶ月目に置く（仕様書 §4）。
 * 倍率で指定された更新料は、そのシナリオの家賃を基準に解決されるため、
 * 据え置き・希望額・代案で自動的に別の金額になる。
 */
export function buildRenewalScenario(
  plan: RenewalPlan,
  kind: Extract<ScenarioKind, 'renew_current' | 'renew_desired' | 'renew_alternative'>,
  label: string,
  rent: Yen,
  managementFee: Yen,
): Scenario {
  return {
    id: kind,
    kind,
    label,
    rent,
    managementFee,
    monthly: plan.monthly,
    oneTime: plan.otherOneTime,
    recurring: [
      {
        id: 'renewalFee',
        label: '更新料',
        amount: plan.renewalFee,
        schedule: { kind: 'renewal', contractMonths: plan.contractMonths, includeStart: true },
      },
    ],
    discounts: plan.discounts,
    freeRent: plan.freeRent,
    deposits: plan.deposits,
    prepaidRent: plan.prepaidRent,
  }
}

/**
 * 転居シナリオを組み立てる。
 *
 * 新規契約なので開始時の更新料は発生せず、最初の更新料は 1 + C ヶ月目になる
 * （契約期間24ヶ月なら25ヶ月目。仕様書 §4, §8-04）。
 */
export function buildMoveScenario(candidate: MoveCandidate): Scenario {
  return {
    id: candidate.id,
    kind: 'move',
    label: candidate.label,
    propertyId: candidate.comparableId,
    rent: candidate.rent,
    managementFee: candidate.managementFee,
    monthly: candidate.monthly,
    oneTime: candidate.oneTime,
    recurring: [
      {
        id: `${candidate.id}-renewalFee`,
        label: '更新料',
        amount: candidate.renewalFee,
        schedule: { kind: 'renewal', contractMonths: candidate.contractMonths, includeStart: false },
      },
    ],
    discounts: candidate.discounts,
    freeRent: candidate.freeRent,
    deposits: candidate.deposits,
    prepaidRent: candidate.prepaidRent,
  }
}

export interface BuiltScenarios {
  /** 据え置きで更新。 */
  current: Scenario
  /** 希望額で更新。 */
  desired: Scenario
  /** 貸主が選んだ代案で更新。設定がなければ null。 */
  alternative: Scenario | null
  /** 候補物件への転居。 */
  moves: Scenario[]
  /** 更新側の3案（代案があれば3件）。 */
  renewals: Scenario[]
}

/** 案件から比較する選択肢をすべて組み立てる（仕様書 §3「比較する選択肢」）。 */
export function buildScenarios(c: Case): BuiltScenarios {
  const current = buildRenewalScenario(
    c.renewal, 'renew_current', '据え置きで更新', c.currentRent, c.currentManagementFee,
  )
  const desired = buildRenewalScenario(
    c.renewal, 'renew_desired', '希望額で更新', c.desiredRent, c.desiredManagementFee,
  )
  const alternative =
    c.alternativeRent === undefined
      ? null
      : buildRenewalScenario(
          c.renewal, 'renew_alternative', '代案で更新', c.alternativeRent, c.desiredManagementFee,
        )
  const moves = c.moveCandidates.map(buildMoveScenario)
  const renewals = alternative ? [current, desired, alternative] : [current, desired]
  return { current, desired, alternative, moves, renewals }
}

/** 空の更新費用設定。 */
export function emptyRenewalPlan(renewalFee: Amount = { kind: 'unknown' }): RenewalPlan {
  return {
    contractMonths: 24,
    renewalFee,
    monthly: [],
    otherOneTime: [],
    discounts: [],
    freeRent: [],
    deposits: [],
    prepaidRent: 0,
  }
}

/** 空の転居候補。 */
export function emptyMoveCandidate(id: string, comparableId: string, label: string, rent: Yen, managementFee: Yen): MoveCandidate {
  return {
    id,
    comparableId,
    label,
    rent,
    managementFee,
    contractMonths: 24,
    renewalFee: { kind: 'unknown' },
    monthly: [],
    oneTime: [],
    discounts: [],
    freeRent: [],
    deposits: [],
    prepaidRent: 0,
  }
}
