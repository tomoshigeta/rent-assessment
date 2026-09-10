import { describe, expect, it } from 'vitest'
import { occurrenceMonths } from '../scenario'
import { landlordFloor, reletGrossIncome } from '../bounds'
import { assessDesiredRent, median, missingRequiredFields } from '../assess'
import { resolveAmount, toYen, times, unknown, yen } from '../money'
import { DEFAULT_THRESHOLDS, type Comparable, type Property } from '../types'
import { MAN } from './helpers'

describe('端数処理（仕様書 §4 / Q6）', () => {
  it('項目ごとに円単位へ確定する', () => {
    expect(toYen(219_199.6, 'round')).toBe(219_200)
    expect(toYen(219_199.6, 'floor')).toBe(219_199)
    expect(toYen(219_199.2, 'ceil')).toBe(219_200)
  })

  it('負値でも絶対値で丸めるので符号が偏らない', () => {
    expect(toYen(-0.5, 'round')).toBe(-1)
    expect(toYen(-1.2, 'floor')).toBe(-1)
    expect(toYen(-1.2, 'ceil')).toBe(-2)
  })

  it('倍率は基準額から解決し、円へ確定させる', () => {
    const ctx = { rent: 219_200, managementFee: 8_000, rounding: 'round' as const }
    expect(resolveAmount(times(1, 'rent'), ctx)).toEqual({ yen: 219_200, known: true })
    expect(resolveAmount(times(1, 'rentPlusManagement'), ctx)).toEqual({ yen: 227_200, known: true })
    expect(resolveAmount(times(0.5, 'rent'), ctx)).toEqual({ yen: 109_600, known: true })
  })

  it('不明は0を返すが known=false を立てる（仕様書 §8-12）', () => {
    const ctx = { rent: 100_000, managementFee: 0, rounding: 'round' as const }
    expect(resolveAmount(unknown(), ctx)).toEqual({ yen: 0, known: false })
    expect(resolveAmount(yen(0), ctx)).toEqual({ yen: 0, known: true })
  })
})

describe('更新料の発生月（仕様書 §4）', () => {
  it('契約期間24ヶ月・開始時ありなら 0, 25, 49, 73, 97', () => {
    expect(occurrenceMonths({ kind: 'renewal', contractMonths: 24, includeStart: true }, 120))
      .toEqual([0, 25, 49, 73, 97])
  })

  it('24ヶ月の比較では25ヶ月目の更新料が期間外に落ちる', () => {
    expect(occurrenceMonths({ kind: 'renewal', contractMonths: 24, includeStart: true }, 24)).toEqual([0])
  })

  it('転居のように開始時の更新料がない場合は25ヶ月目が最初になる', () => {
    expect(occurrenceMonths({ kind: 'renewal', contractMonths: 24, includeStart: false }, 60))
      .toEqual([25, 49])
  })

  it('契約期間12ヶ月なら 0, 13, 25, 37', () => {
    expect(occurrenceMonths({ kind: 'renewal', contractMonths: 12, includeStart: true }, 40))
      .toEqual([0, 13, 25, 37])
  })
})

describe('貸主側の下限目安（仕様書 §6 / Q5・Q7 改訂版）', () => {
  it('L = q·max(H−d,0)/(H+1)', () => {
    expect(landlordFloor(21 * MAN, 24, 2, 'round')).toBe(184_800)
    expect(landlordFloor(21 * MAN, 36, 2, 'round')).toBe(Math.round((21 * MAN * 34) / 37))
  })

  it('空室が比較期間全体に及んでも入居後月数を0未満にしない', () => {
    expect(landlordFloor(21 * MAN, 1, 2, 'round')).toBe(0)
    expect(landlordFloor(21 * MAN, 2, 2, 'round')).toBe(0)
    expect(reletGrossIncome(21 * MAN, 1, 2)).toBe(0)
  })

  it('比較期間が長いほど再募集賃料に漸近する', () => {
    const q = 21 * MAN
    expect(landlordFloor(q, 120, 2, 'round')).toBeLessThan(q)
    expect(landlordFloor(q, 120, 2, 'round')).toBeGreaterThan(landlordFloor(q, 24, 2, 'round'))
  })

  it('比較期間が0以下なら例外', () => {
    expect(() => landlordFloor(21 * MAN, 0, 2, 'round')).toThrow()
  })
})

describe('中央値（Round 3 で定義を追加）', () => {
  it('奇数件は中央の値', () => {
    expect(median([100, 300, 200])).toBe(200)
  })
  it('偶数件は中央2件の平均を円未満四捨五入', () => {
    expect(median([100, 200, 300, 401])).toBe(250)
    expect(median([100, 201])).toBe(151)
  })
  it('事例が0件なら例外', () => {
    expect(() => median([])).toThrow()
  })
})

const property = (name: string, over: Partial<Property> = {}): Property => ({
  id: name,
  name,
  use: 'residential',
  address: '東京都渋谷区1-1-1',
  stations: [{ station: '渋谷', walkMinutes: 8 }],
  areaSqm: 40,
  provenance: 'entered',
  ...over,
})

const comparable = (name: string, rent: number, mgmt = 5_000, over: Partial<Comparable> = {}): Comparable => ({
  property: property(name),
  status: 'adopted',
  rent,
  managementFee: mgmt,
  initialCosts: [],
  ...over,
})

describe('希望額の判定（仕様書 §2 / Q17 の閾値）', () => {
  const eight = (base: number) =>
    Array.from({ length: 8 }, (_, i) => comparable(`比較${i + 1}`, base + (i - 4) * 1_000))

  it('採用事例が8件未満なら乖離率によらず資料不足', () => {
    const r = assessDesiredRent(205_000, eight(200_000).slice(0, 7), DEFAULT_THRESHOLDS)
    expect(r.verdict).toBe('insufficient')
    expect(r.sampleCount).toBe(7)
    // 基準賃料自体は参考値として出す
    expect(r.benchmarkTotal).not.toBeNull()
  })

  it('中央値から±2.5%以内なら妥当', () => {
    const comps = eight(200_000)
    const bench = median(comps.map((c) => c.rent + c.managementFee))
    const r = assessDesiredRent(bench, comps, DEFAULT_THRESHOLDS)
    expect(r.verdict).toBe('fair')
    expect(r.deviationPct).toBeCloseTo(0, 6)
  })

  it('±2.5%を超え±20%以内なら見直し推奨', () => {
    const comps = eight(200_000)
    const bench = median(comps.map((c) => c.rent + c.managementFee))!
    expect(assessDesiredRent(Math.round(bench * 1.1), comps, DEFAULT_THRESHOLDS).verdict).toBe('review')
    expect(assessDesiredRent(Math.round(bench * 0.9), comps, DEFAULT_THRESHOLDS).verdict).toBe('review')
  })

  it('±20%を超えたら強い警告', () => {
    const comps = eight(200_000)
    const bench = median(comps.map((c) => c.rent + c.managementFee))!
    expect(assessDesiredRent(Math.round(bench * 1.25), comps, DEFAULT_THRESHOLDS).verdict).toBe('review_strong')
    expect(assessDesiredRent(Math.round(bench * 0.75), comps, DEFAULT_THRESHOLDS).verdict).toBe('review_strong')
  })

  it('割高側と割安側で幅を変えない（Q17-4）', () => {
    const comps = eight(200_000)
    const bench = median(comps.map((c) => c.rent + c.managementFee))!
    const high = assessDesiredRent(Math.round(bench * 1.03), comps, DEFAULT_THRESHOLDS)
    const low = assessDesiredRent(Math.round(bench * 0.97), comps, DEFAULT_THRESHOLDS)
    expect(high.verdict).toBe(low.verdict)
  })

  it('参考・除外の事例は基準賃料に入れない（仕様書 §2）', () => {
    const comps = [
      ...eight(200_000),
      comparable('参考', 500_000, 0, { status: 'reference' }),
      comparable('除外', 10_000, 0, { status: 'excluded' }),
    ]
    const r = assessDesiredRent(205_000, comps, DEFAULT_THRESHOLDS)
    expect(r.sampleCount).toBe(8)
    expect(r.benchmarkTotal).toBe(median(eight(200_000).map((c) => c.rent + c.managementFee)))
  })

  it('必須項目が欠けた事例は集計から外し、理由に残す（仕様書 §2）', () => {
    const comps = [...eight(200_000), comparable('欠落', 0, 0)]
    const r = assessDesiredRent(205_000, comps, DEFAULT_THRESHOLDS)
    expect(r.sampleCount).toBe(8)
    expect(r.incompleteComparables.some((s) => s.startsWith('欠落'))).toBe(true)
    expect(r.reasons.join()).toContain('欠落')
  })

  it('必須項目の欠落を検知する', () => {
    expect(missingRequiredFields(comparable('ok', 200_000))).toEqual([])
    const broken: Comparable = {
      ...comparable('broken', 0),
      property: { ...property('broken'), address: '', areaSqm: 0 },
    }
    expect(missingRequiredFields(broken).sort()).toEqual(['賃料', '所在地', '面積'].sort())
  })

  it('採用事例が0件なら資料不足で基準賃料を出さない', () => {
    const r = assessDesiredRent(205_000, [], DEFAULT_THRESHOLDS)
    expect(r.verdict).toBe('insufficient')
    expect(r.benchmarkTotal).toBeNull()
    expect(r.deviationPct).toBeNull()
  })
})
