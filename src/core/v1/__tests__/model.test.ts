/**
 * Ver1 の受入確認。
 *
 * 数値は実際の募集図面6件（麻布十番エリア・2026年9月）と、そこから導いた
 * 対象物件の条件による。仮定値（転居費用5ヶ月・更新料1.25ヶ月・比較期間24ヶ月）は
 * src/core/v1/assumptions.ts に集約してあり、変えるとここの期待値も動く。
 */
import { describe, expect, it } from 'vitest'
import {
  HORIZON_MONTHS, MIN_SAMPLE_COUNT, MOVING_COST_MONTHS, RENEWAL_FEE_MONTHS, TENANT_CEILING_FACTOR,
} from '../assumptions'
import { breakEvenMonth, landlordFloor, rentRange, tenantCeiling } from '../model'
import { assessRent, ratePerSqm, validateListing, validateSubject } from '../assess'
import { elapsedSince } from '../prompt'
import type { Listing, Subject } from '../types'

/** 実図面6件。賃料・管理費・面積のみ（計算に効く3項目）。 */
const listings: Listing[] = [
  { name: 'アーバンパーク麻布十番 0902', rent: 310_000, managementFee: 10_000, areaSqm: 42.14 , sourceAgency: '三菱地所ハウスネット', confirmedOn: '2026-09-01' },
  { name: 'カスタリア麻布十番 705', rent: 280_000, managementFee: 10_000, areaSqm: 42.84 , sourceAgency: '株式会社モリモトクオリティ', confirmedOn: '2026-09-01' },
  { name: 'カスタリア麻布十番 603', rent: 241_000, managementFee: 10_000, areaSqm: 36.95 , sourceAgency: '株式会社モリモトクオリティ', confirmedOn: '2026-09-01' },
  { name: '南麻布1-5-8 702', rent: 185_000, managementFee: 0, areaSqm: 39.0 , sourceAgency: '三井のリハウス 赤坂支店', confirmedOn: '2026-09-01' },
  { name: 'メゾン東麻布 401', rent: 178_000, managementFee: 12_000, areaSqm: 38.0 , sourceAgency: '（募集図面に記載）', confirmedOn: '2026-09-01' },
  { name: 'イイダアネックス麻布十番 501', rent: 170_000, managementFee: 5_000, areaSqm: 43.06 , sourceAgency: '株式会社ワールドインベストメンツ', confirmedOn: '2026-09-01' },
]

/** 対象物件: 麻布十番ロイヤルプレイス。現在賃料は仮定値。 */
const subject: Subject = {
  name: '麻布十番ロイヤルプレイス',
  currentRent: 210_000,
  currentManagementFee: 0,
  areaSqm: 38.1,
}

describe('仮定値', () => {
  it('比較期間24ヶ月・更新料1.25ヶ月・転居費用5ヶ月', () => {
    expect(HORIZON_MONTHS).toBe(24)
    expect(RENEWAL_FEE_MONTHS).toBe(1.25)
    expect(MOVING_COST_MONTHS).toBe(5)
    expect(MIN_SAMPLE_COUNT).toBe(5)
  })

  it('借主上限の係数は (24+5)/(24+1.25) = 1.1485…', () => {
    expect(TENANT_CEILING_FACTOR).toBeCloseTo(29 / 25.25, 10)
    expect(TENANT_CEILING_FACTOR).toBeCloseTo(1.14851, 5)
  })
})

describe('査定賃料', () => {
  it('㎡単価の中央値 × 対象物件の面積で求める', () => {
    const a = assessRent(subject, listings, undefined)
    expect(a.source).toBe('calculated')
    expect(a.sampleCount).toBe(6)
    expect(a.medianRatePerSqm).toBeCloseTo(5884.5, 0)
    expect(a.yen).toBe(224_207)
  })

  it('総額の中央値をそのまま使うのとは違う値になる', () => {
    // 総額の中央値は 220,500円。面積差を正規化すると 224,207円。
    expect(assessRent(subject, listings, undefined).yen).not.toBe(220_500)
  })

  it('比較事例が5件未満なら算出できない', () => {
    const a = assessRent(subject, listings.slice(0, 4), undefined)
    expect(a.source).toBe('unavailable')
    expect(a.yen).toBeNull()
    expect(a.reason).toContain('5件必要')
  })

  it('手入力で上書きすると件数チェックを外れる', () => {
    const a = assessRent(subject, listings.slice(0, 2), 230_000)
    expect(a.source).toBe('override')
    expect(a.yen).toBe(230_000)
    // 参考値としての㎡単価は出す
    expect(a.medianRatePerSqm).not.toBeNull()
  })

  it('㎡単価は月額総額を面積で割る', () => {
    expect(ratePerSqm(listings[0])).toBeCloseTo(320_000 / 42.14, 6)
  })
})

describe('借主側の上限', () => {
  it('現在賃料の1.1485倍。査定賃料には依存しない', () => {
    expect(tenantCeiling(210_000)).toBe(241_188)
    expect(tenantCeiling(210_000)).toBe(Math.round(210_000 * 29 / 25.25))
  })

  it('値上げ幅が約14.9%を超えると借主は転居が有利になる', () => {
    const R0 = 200_000
    expect(tenantCeiling(R0)).toBe(Math.round(R0 * 1.1485148514851485))
    // 14.8%増は上限内、15.0%増は上限外
    expect(Math.round(R0 * 1.148)).toBeLessThan(tenantCeiling(R0))
    expect(Math.round(R0 * 1.150)).toBeGreaterThan(tenantCeiling(R0))
  })

  it('現在賃料が0以下なら例外', () => {
    expect(() => tenantCeiling(0)).toThrow()
  })
})

describe('貸主側の下限', () => {
  it('(査定×(24−空室) − 原状回復) / 25.25', () => {
    expect(landlordFloor(224_207, 2, 300_000)).toBe(183_467)
    expect(landlordFloor(224_207, 2, 300_000)).toBe(Math.round((224_207 * 22 - 300_000) / 25.25))
  })

  it('原状回復費用が増えると下限は下がる', () => {
    expect(landlordFloor(224_207, 2, 500_000)).toBeLessThan(landlordFloor(224_207, 2, 300_000))
  })

  it('空室期間が延びると下限は下がる', () => {
    expect(landlordFloor(224_207, 3, 300_000)).toBeLessThan(landlordFloor(224_207, 1, 300_000))
  })

  it('原状回復費用が負なら例外', () => {
    expect(() => landlordFloor(224_207, 2, -1)).toThrow()
  })
})

describe('双方が成立する幅', () => {
  it('実データでは r = 0.818 〜 1.076、交差しない', () => {
    const r = rentRange(224_207, 210_000, 2, 300_000)
    expect(r.floor).toBe(183_467)
    expect(r.ceiling).toBe(241_188)
    expect(r.rFloor).toBeCloseTo(0.818, 3)
    expect(r.rCeiling).toBeCloseTo(1.076, 3)
    expect(r.crossed).toBe(false)
  })

  it('査定どおり（r=1.0）は範囲内に入る', () => {
    const r = rentRange(224_207, 210_000, 2, 300_000)
    expect(224_207).toBeGreaterThanOrEqual(r.floor)
    expect(224_207).toBeLessThanOrEqual(r.ceiling)
  })

  it('現在賃料が査定より大きく低いと交差する', () => {
    // 現在賃料が査定の6割しかない場合、借主上限が貸主下限を下回る
    const r = rentRange(300_000, 150_000, 1, 0)
    expect(r.crossed).toBe(true)
  })
})

describe('逆転月', () => {
  it('提示額224,207円なら55ヶ月目から転居が安い（24ヶ月の外）', () => {
    const n = breakEvenMonth(224_207, 210_000)
    expect(n).toBe(55)
    expect(n).toBeGreaterThan(HORIZON_MONTHS)
  })

  it('提示額が現在賃料以下なら転居が安くなることはない', () => {
    expect(breakEvenMonth(210_000, 210_000)).toBeNull()
    expect(breakEvenMonth(200_000, 210_000)).toBeNull()
  })

  it('値上げ幅が大きいほど逆転が早く来る', () => {
    expect(breakEvenMonth(260_000, 210_000)!).toBeLessThan(breakEvenMonth(230_000, 210_000)!)
  })
})

describe('入力の検証', () => {
  it('必須項目が欠けていれば計算に使えない', () => {
    expect(validateListing({ name: '', rent: 0, managementFee: -1, areaSqm: 0, sourceAgency: '', confirmedOn: '' })
      .filter((i) => i.blocking).map((i) => i.field))
      .toEqual(['物件名', '賃料', '管理費', '面積', '募集元', '確認日'])
  })

  it('管理費0円は正当な値として通す', () => {
    // 実図面の南麻布1-5-8は管理費なし
    expect(validateListing({ name: '管理費なし', rent: 185_000, managementFee: 0, areaSqm: 39, sourceAgency: 'A社', confirmedOn: '2026-09-01' })).toEqual([])
  })

  it('実図面6件はすべて検証を通る', () => {
    expect(listings.every((l) => validateListing(l).length === 0)).toBe(true)
    expect(validateSubject(subject)).toEqual([])
  })

  it('万円単位・坪単位の取り違えを警告する（弾きはしない）', () => {
    const w = validateListing({ name: 'テスト', rent: 28, managementFee: 1, areaSqm: 12.9, sourceAgency: 'A社', confirmedOn: '2026-09-01' })
    expect(w.every((i) => !i.blocking)).toBe(true)
    expect(w.map((i) => i.field)).toEqual(['賃料', '面積'])
  })

  it('管理費が賃料を上回れば警告する', () => {
    const w = validateListing({ name: 'テスト', rent: 100_000, managementFee: 200_000, areaSqm: 40, sourceAgency: 'A社', confirmedOn: '2026-09-01' })
    expect(w.map((i) => i.field)).toContain('管理費')
  })
})

describe('出典の必須化', () => {
  const base = { name: '比較', rent: 200_000, managementFee: 0, areaSqm: 40 }
  it('募集元が空なら集計に使えない', () => {
    const i = validateListing({ ...base, sourceAgency: '', confirmedOn: '2026-09-01' })
    expect(i.some((x) => x.field === '募集元' && x.blocking)).toBe(true)
  })
  it('確認日が空なら集計に使えない', () => {
    const i = validateListing({ ...base, sourceAgency: 'A社', confirmedOn: '' })
    expect(i.some((x) => x.field === '確認日' && x.blocking)).toBe(true)
  })
  it('共通点と賃料差の要因は任意', () => {
    expect(validateListing({ ...base, sourceAgency: 'A社', confirmedOn: '2026-09-01' })).toEqual([])
  })
})

describe('警告は集計から除外しない', () => {
  it('坪の疑いがある事例も、必須項目が揃っていれば中央値に入る', () => {
    // 面積14㎡は「坪で入っていませんか」の警告が出るが、除外はしない
    const odd = { name: '狭小', rent: 90_000, managementFee: 0, areaSqm: 14, sourceAgency: 'A社', confirmedOn: '2026-09-01' }
    expect(validateListing(odd).some((i) => i.blocking)).toBe(false)
    expect(validateListing(odd).length).toBeGreaterThan(0)
    const a = assessRent(subject, [...listings, odd], undefined)
    expect(a.sampleCount).toBe(7)
  })
})

describe('据え置き期間', () => {
  it('年だけに丸めず、年と月で出す', () => {
    const now = new Date(2026, 8, 12) // 2026-09
    expect(elapsedSince('2024-12', now)).toBe('1年9ヶ月')
    expect(elapsedSince('2024-09', now)).toBe('2年')
    expect(elapsedSince('2026-06', now)).toBe('3ヶ月')
    expect(elapsedSince(undefined, now)).toBeNull()
  })
})
