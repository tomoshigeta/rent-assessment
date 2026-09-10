/**
 * 実際の募集図面6件（麻布十番エリア・2026年9月）による検証。
 * データは data/cases/azabu-real-listings.json、生成元は scripts/seed-azabu.mjs。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { assessDesiredRent, median, DEFAULT_THRESHOLDS, type Case } from '../index'

const c: Case = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/cases/azabu-real-listings.json'), 'utf8'),
)

describe('実図面6件による判定', () => {
  const bench = median(c.comparables.map((x) => x.rent + x.managementFee))

  it('6件は最低件数5件を満たすので判定に進む', () => {
    expect(c.comparables.length).toBe(6)
    expect(DEFAULT_THRESHOLDS.minSampleCount).toBe(5)
    expect(assessDesiredRent(bench, c.comparables, DEFAULT_THRESHOLDS).verdict).not.toBe('insufficient')
  })

  it('基準賃料は月額総額の中央値 220,500円', () => {
    expect(bench).toBe(220_500)
  })

  it('希望額に応じて4段階が出し分けられる', () => {
    const verdict = (d: number) => assessDesiredRent(d, c.comparables, DEFAULT_THRESHOLDS).verdict
    expect(verdict(220_000)).toBe('fair')            // −0.2%
    expect(verdict(225_000)).toBe('fair')            // +2.0%
    expect(verdict(240_000)).toBe('review')          // +8.8%
    expect(verdict(270_000)).toBe('review_strong')   // +22.4%
    expect(verdict(180_000)).toBe('review')          // −18.4%
    expect(verdict(170_000)).toBe('review_strong')   // −22.9%
  })

  it('図面に記載のない金額は不明のまま保持され、0円と確定していない', () => {
    const unknowns = c.comparables.flatMap((x) =>
      x.initialCosts.filter((i) => i.amount.kind === 'unknown').map((i) => `${x.property.name}: ${i.label}`),
    )
    expect(unknowns).toEqual([
      '南麻布1-5-8 702号室: 鍵交換費',
      '南麻布1-5-8 702号室: 火災保険',
      'イイダアネックス麻布十番 501号室: 鍵交換代',
    ])
  })
})
