/**
 * 仕様書 §8「計算結果の受入確認」の12件をそのまま実行する。
 *
 * 番号は仕様書の表と対応する。金額は特記がなければ支払額で、
 * 記載した以外の費用は発生しない条件で確認する。
 */
import { describe, expect, it } from 'vitest'
import { computeScenario } from '../scenario'
import { findCrossovers } from '../compare'
import { landlordFloor, reletGrossIncome, tenantCeiling } from '../bounds'
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS } from '../types'
import { times, yen } from '../money'
import { MAN, scenario, startupCost } from './helpers'

const R = DEFAULT_SETTINGS.rounding
const SEARCH = 120

/** §5「基本の確認例」: 更新 月22万＋開始費20万 / 転居 月21万＋開始費44万。 */
const renewBase = scenario({
  id: 'renew',
  label: '更新',
  kind: 'renew_desired',
  rent: 22 * MAN,
  oneTime: [startupCost('更新時開始費用', 20 * MAN)],
})
const moveBase = scenario({
  id: 'move',
  label: '転居',
  kind: 'move',
  rent: 21 * MAN,
  oneTime: [startupCost('転居時開始費用', 44 * MAN)],
})

const cum = (s: typeof renewBase, months: number) => computeScenario(s, months, R).cumulativeAt(months)

describe('§8 受入確認', () => {
  it('01 新規案件を開くと比較期間が24ヶ月で表示される', () => {
    expect(DEFAULT_SETTINGS.horizonMonths).toBe(24)
    expect(DEFAULT_SETTINGS.searchHorizonMonths).toBe(120)
  })

  it('02 24ヶ月で双方548万円。25ヶ月で更新570万・転居569万。24ヶ月同額と25ヶ月の逆転を区別する', () => {
    expect(cum(renewBase, 12)).toBe(284 * MAN)
    expect(cum(moveBase, 12)).toBe(296 * MAN)
    expect(cum(renewBase, 24)).toBe(548 * MAN)
    expect(cum(moveBase, 24)).toBe(548 * MAN)
    expect(cum(renewBase, 25)).toBe(570 * MAN)
    expect(cum(moveBase, 25)).toBe(569 * MAN)

    const r = findCrossovers(
      computeScenario(renewBase, SEARCH, R),
      computeScenario(moveBase, SEARCH, R),
      24,
      SEARCH,
    )
    // 24ヶ月は同額、かつ優劣が変わる点でもある
    expect(r.equalMonths).toContain(24)
    expect(r.equalWithoutFlip).not.toContain(24)
    expect(r.flips).toEqual([{ month: 25, cheaper: 'move' }])
  })

  it('03 比較期間を36ヶ月へ変更すると更新812万・転居800万で転居が12万円安い', () => {
    expect(cum(renewBase, 36)).toBe(812 * MAN)
    expect(cum(moveBase, 36)).toBe(800 * MAN)
    expect(cum(renewBase, 36) - cum(moveBase, 36)).toBe(12 * MAN)
  })

  it('04 転居側だけ25ヶ月目に更新料21万円。25ヶ月で転居590万、45ヶ月で同額、46ヶ月から転居が安い', () => {
    const move = scenario({
      ...moveBase,
      recurring: [
        { id: 'renewal', label: '更新料', amount: yen(21 * MAN), schedule: { kind: 'months', months: [25] } },
      ],
    })
    expect(cum(move, 25)).toBe(590 * MAN)
    expect(cum(move, 25) - cum(renewBase, 25)).toBe(20 * MAN)

    const r = findCrossovers(
      computeScenario(renewBase, SEARCH, R),
      computeScenario(move, SEARCH, R),
      24,
      SEARCH,
    )
    expect(r.equalMonths).toEqual([24, 45])
    // 24ヶ月は同額だが前後とも更新が安いままで、優劣は変わらない
    expect(r.equalWithoutFlip).toEqual([24])
    expect(r.flips).toEqual([{ month: 46, cheaper: 'move' }])
  })

  it('05 転居側だけ30ヶ月目に20万円。25ヶ月で転居が安く、30ヶ月で更新が安く、45ヶ月で再び転居が安い', () => {
    const move = scenario({
      ...moveBase,
      oneTime: [startupCost('転居時開始費用', 44 * MAN), { id: 'extra', label: '追加費用', month: 30, amount: yen(20 * MAN) }],
    })
    const r = findCrossovers(
      computeScenario(renewBase, SEARCH, R),
      computeScenario(move, SEARCH, R),
      24,
      SEARCH,
    )
    expect(r.flips).toEqual([
      { month: 25, cheaper: 'move' },
      { month: 30, cheaper: 'renew' },
      { month: 45, cheaper: 'move' },
    ])
    expect(r.equalMonths).toEqual([24, 44])
  })

  it('06 月額と将来費用が同じで転居側の開始費だけ24万円高いと、探索期間内に逆転なし', () => {
    const move = scenario({
      id: 'move',
      label: '転居',
      kind: 'move',
      rent: renewBase.rent,
      oneTime: [startupCost('転居時開始費用', 20 * MAN + 24 * MAN)],
    })
    const r = findCrossovers(
      computeScenario(renewBase, SEARCH, R),
      computeScenario(move, SEARCH, R),
      24,
      SEARCH,
    )
    expect(r.flips).toEqual([])
    expect(r.equalMonths).toEqual([])
    expect(r.initialCheaper).toBe('renew')
    expect(r.searchHorizon).toBe(120)
  })

  it('07 返還予定の保証金を0円から100万円へ変更しても費用総額と逆転時期は不変、必要資金が100万円増える', () => {
    const withDeposit = scenario({
      ...moveBase,
      deposits: [
        { id: 'guarantee', label: '保証金', paidMonth: 0, total: yen(100 * MAN), amortized: yen(0) },
      ],
    })
    const before = computeScenario(moveBase, SEARCH, R)
    const after = computeScenario(withDeposit, SEARCH, R)

    expect(after.cumulativeAt(24)).toBe(before.cumulativeAt(24))
    expect(after.initialCash - before.initialCash).toBe(100 * MAN)
    expect(after.refundableDeposits).toBe(100 * MAN)

    const rBefore = findCrossovers(computeScenario(renewBase, SEARCH, R), before, 24, SEARCH)
    const rAfter = findCrossovers(computeScenario(renewBase, SEARCH, R), after, 24, SEARCH)
    expect(rAfter.flips).toEqual(rBefore.flips)

    // 償却部分があればその分だけ費用に加算する
    const withAmortization = scenario({
      ...moveBase,
      deposits: [
        { id: 'guarantee', label: '保証金', paidMonth: 0, total: yen(100 * MAN), amortized: yen(30 * MAN) },
      ],
    })
    const amortized = computeScenario(withAmortization, SEARCH, R)
    expect(amortized.cumulativeAt(24)).toBe(before.cumulativeAt(24) + 30 * MAN)
    expect(amortized.initialCash - before.initialCash).toBe(100 * MAN)
    expect(amortized.refundableDeposits).toBe(70 * MAN)
  })

  it('08 前家賃22万円が契約時支払額に含まれても、初月家賃と重複して44万円にしない', () => {
    const withPrepaid = scenario({ ...renewBase, prepaidRent: 22 * MAN })
    const plain = computeScenario(renewBase, 24, R)
    const prepaid = computeScenario(withPrepaid, 24, R)

    // 1ヶ月目の家賃は22万円のまま
    expect(prepaid.rows[1].net).toBe(22 * MAN)
    expect(prepaid.cumulativeAt(24)).toBe(plain.cumulativeAt(24))
    // 必要資金の表示には契約時支払いを反映する
    expect(prepaid.initialCash - plain.initialCash).toBe(22 * MAN)
  })

  it('09 家賃20万・管理費1万で初月の家賃だけ無料なら、初月費用1万・24ヶ月合計484万', () => {
    const s = scenario({
      id: 'free',
      label: 'フリーレント',
      rent: 20 * MAN,
      managementFee: 1 * MAN,
      freeRent: [{ id: 'fr', label: 'フリーレント（初月家賃）', months: [1], target: 'rent' }],
    })
    const result = computeScenario(s, 24, R)
    expect(result.rows[1].net).toBe(1 * MAN)
    expect(result.cumulativeAt(24)).toBe(484 * MAN)
  })

  it('10 更新月額22万・更新料が変更後賃料の1ヶ月分なら24ヶ月で550万。転居548万との同額条件は月額219,200円', () => {
    const renew = scenario({
      id: 'renew',
      label: '更新',
      rent: 22 * MAN,
      recurring: [
        {
          id: 'renewal',
          label: '更新料',
          amount: times(1, 'rent'),
          schedule: { kind: 'renewal', contractMonths: 24, includeStart: true },
        },
      ],
    })
    expect(computeScenario(renew, 24, R).cumulativeAt(24)).toBe(550 * MAN)

    // 更新料が賃料に連動するため、閉じた式ではなく月次計算への探索で求める
    const ceiling = tenantCeiling(renew, moveBase, 24, R)
    expect(ceiling.rentCeiling).toBe(219_200)
    expect(ceiling.exact).toBe(true)
    expect(ceiling.moveCumulative).toBe(548 * MAN)

    // 次回更新料は25ヶ月目に計上され、24ヶ月終了時点の比較には含まれない（仕様書 §4）
    expect(computeScenario(renew, 25, R).cumulativeAt(25)).toBe(550 * MAN + 22 * MAN + 22 * MAN)
  })

  it('11 貸主計算 H=24・再募集21万・空室2ヶ月なら、再募集収入462万・下限月額184,800円', () => {
    const q = 21 * MAN
    expect(reletGrossIncome(q, 24, 2)).toBe(462 * MAN)
    expect(landlordFloor(q, 24, 2, R)).toBe(184_800)
    // 空室損失は式に含まれるため、費用として重ねて加算しない
    expect(landlordFloor(q, 24, 0, R)).toBe(Math.round((q * 24) / 25))
  })

  it('12 礼金や保証料の欄が未記載のとき、ゼロと確定しない', () => {
    const s = scenario({
      ...renewBase,
      oneTime: [
        startupCost('更新時開始費用', 20 * MAN),
        { id: 'key', label: '礼金', month: 0, amount: { kind: 'unknown' } },
      ],
      monthly: [{ id: 'guarantee', label: '月額保証料', amount: { kind: 'unknown' } }],
    })
    const result = computeScenario(s, 24, R)
    expect([...result.unknownItems].sort()).toEqual(['月額保証料', '礼金'].sort())
    // 不明項目は 0 として計算されるが、参考値であることが結果に残る
    expect(result.cumulativeAt(24)).toBe(548 * MAN)
    expect(result.unknownItems.length).toBeGreaterThan(0)
  })
})

describe('§6 借主側の上限目安', () => {
  it('固定条件なら U = p + (Fj − Fs)/H に一致する（24ヶ月で22万円）', () => {
    const ceiling = tenantCeiling(renewBase, moveBase, 24, R)
    const closedForm = moveBase.rent + (44 * MAN - 20 * MAN) / 24
    expect(ceiling.rentCeiling).toBe(closedForm)
    expect(ceiling.rentCeiling).toBe(22 * MAN)
  })
})

describe('既定の閾値（Q17 で決めた仮値）', () => {
  it('±2.5% / ±20% / 5件', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ fairBandPct: 2.5, strongWarningPct: 20, minSampleCount: 5 })
  })
})
