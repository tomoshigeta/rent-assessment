import type { Scenario } from '../../types'
import { yen } from '../../money'

export const MAN = 10_000

/** テスト用の最小シナリオ。指定しない費目は空。 */
export function scenario(partial: Partial<Scenario> & Pick<Scenario, 'id' | 'label' | 'rent'>): Scenario {
  return {
    kind: 'renew_desired',
    managementFee: 0,
    monthly: [],
    oneTime: [],
    recurring: [],
    discounts: [],
    freeRent: [],
    deposits: [],
    prepaidRent: 0,
    ...partial,
  }
}

/** 開始時費用だけを持つ一時費用。 */
export function startupCost(label: string, amountYen: number) {
  return { id: label, label, month: 0, amount: yen(amountYen) }
}
