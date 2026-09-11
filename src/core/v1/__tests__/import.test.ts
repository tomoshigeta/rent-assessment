/**
 * 記入例シート（実際の募集図面6件）が正しく読めることを確認する。
 * シートは scripts/make-template.py と scripts/make-sample.py が生成する。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { importWorkbook } from '@/excel/import'
import { assessRent, validateListing, validateSubject } from '../assess'

const file = path.join(process.cwd(), 'public/更新賃料検討_入力シート_記入例_麻布十番.xlsx')
const has = existsSync(file)
const load = () => {
  const b = readFileSync(file)
  return importWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
}

describe.skipIf(!has)('記入例シートの取り込み', () => {
  it('エラーなく読める', () => {
    const r = load()
    expect(r.errors).toEqual([])
    expect(r.subject).not.toBeNull()
    expect(r.listings).toHaveLength(6)
  })

  it('対象物件が読める', () => {
    const s = load().subject!
    expect(s.name).toContain('麻布十番ロイヤルプレイス')
    expect(s.currentRent).toBe(210_000)
    expect(s.currentManagementFee).toBe(0)
    expect(s.areaSqm).toBeCloseTo(38.1, 2)
    expect(validateSubject(s)).toEqual([])
  })

  it('比較事例6件がすべて検証を通る', () => {
    const r = load()
    expect(r.listings.every((l) => validateListing(l).length === 0)).toBe(true)
    expect(r.listings.map((l) => l.rent)).toEqual([310_000, 280_000, 241_000, 185_000, 178_000, 170_000])
    expect(r.listings.map((l) => l.managementFee)).toEqual([10_000, 10_000, 10_000, 0, 12_000, 5_000])
  })

  it('読み込んだ内容から査定賃料224,207円が出る', () => {
    const r = load()
    expect(assessRent(r.subject!, r.listings, undefined).yen).toBe(224_207)
  })

  it('元の行番号を保持する', () => {
    expect(load().listings.map((l) => l.sourceRow)).toEqual([3, 4, 5, 6, 7, 8])
  })
})

describe.skipIf(!has)('テンプレートの注記を行データと誤読しない', () => {
  it('対象物件シートは1行だけ読む（右余白の説明文を無視する）', () => {
    // テンプレートは列12以降に説明文を置いている。行全体で空判定すると
    // 説明文のある行がデータ行に見えてしまう。
    const r = load()
    expect(r.skipped.filter((s) => s.includes('対象物件'))).toEqual([])
  })
})
