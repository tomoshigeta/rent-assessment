import { describe, expect, it } from 'vitest'
import { buildScenarios, emptyMoveCandidate, emptyRenewalPlan } from '../build'
import { computeScenario, occurrenceMonths } from '../scenario'
import { times, yen } from '../../money'
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS, RULES_VERSION, type Case } from '../../types'
import { MAN } from './helpers'

const baseCase = (over: Partial<Case> = {}): Case => ({
  id: 'c1',
  title: 'テスト案件',
  rulesVersion: RULES_VERSION,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
  subject: {
    id: 'subject', name: '対象物件', use: 'residential', address: '東京都渋谷区1-1-1',
    stations: [{ station: '渋谷', walkMinutes: 8 }], areaSqm: 40, provenance: 'entered',
  },
  currentRent: 20 * MAN,
  currentManagementFee: 0,
  desiredRent: 22 * MAN,
  desiredManagementFee: 0,
  comparables: [],
  renewal: { ...emptyRenewalPlan(times(1, 'rent')), contractMonths: 24 },
  moveCandidates: [],
  settings: DEFAULT_SETTINGS,
  relet: { reletMonthlyIncome: 21 * MAN, vacantMonths: 2 },
  thresholds: DEFAULT_THRESHOLDS,
  ...over,
})

describe('シナリオの組み立て', () => {
  it('据え置きと希望額で、賃料連動の更新料が別々に再計算される（仕様書 §4）', () => {
    const { current, desired } = buildScenarios(baseCase())
    // 更新料 = 各シナリオの家賃の1ヶ月分。0ヶ月目に計上される。
    expect(computeScenario(current, 0, 'round').cumulativeAt(0)).toBe(20 * MAN)
    expect(computeScenario(desired, 0, 'round').cumulativeAt(0)).toBe(22 * MAN)
  })

  it('代案の家賃を設定したときだけ代案シナリオが増える', () => {
    expect(buildScenarios(baseCase()).renewals).toHaveLength(2)
    const withAlt = buildScenarios(baseCase({ alternativeRent: 21 * MAN }))
    expect(withAlt.renewals).toHaveLength(3)
    expect(withAlt.alternative?.rent).toBe(21 * MAN)
  })

  it('更新側は今回の更新料を0ヶ月目に、次回を25ヶ月目に置く', () => {
    const { desired } = buildScenarios(baseCase())
    expect(occurrenceMonths(desired.recurring[0].schedule, 60)).toEqual([0, 25, 49])
  })

  it('転居側は新規契約なので開始時の更新料がなく、最初は25ヶ月目', () => {
    const c = baseCase({
      moveCandidates: [
        { ...emptyMoveCandidate('m1', 'cmp1', '転居候補A', 21 * MAN, 0), renewalFee: yen(21 * MAN) },
      ],
    })
    const { moves } = buildScenarios(c)
    expect(occurrenceMonths(moves[0].recurring[0].schedule, 60)).toEqual([25, 49])
  })

  it('§5の基本例を案件から組み立てても同じ数字になる', () => {
    const c = baseCase({
      desiredRent: 22 * MAN,
      renewal: {
        ...emptyRenewalPlan(yen(0)),
        otherOneTime: [{ id: 'f', label: '更新時開始費用', month: 0, amount: yen(20 * MAN) }],
      },
      moveCandidates: [
        {
          ...emptyMoveCandidate('m1', 'cmp1', '転居候補A', 21 * MAN, 0),
          renewalFee: yen(0),
          oneTime: [{ id: 'f', label: '転居時開始費用', month: 0, amount: yen(44 * MAN) }],
        },
      ],
    })
    const { desired, moves } = buildScenarios(c)
    expect(computeScenario(desired, 24, 'round').cumulativeAt(24)).toBe(548 * MAN)
    expect(computeScenario(moves[0], 24, 'round').cumulativeAt(24)).toBe(548 * MAN)
  })
})
