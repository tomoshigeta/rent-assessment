import { describe, expect, it } from 'vitest'
import { checkSchedule } from '../schedule'

const now = new Date(2026, 8, 12) // 2026-09-12
const fields = (i: ReturnType<typeof checkSchedule>) => i.map((x) => x.field)

describe('日付の整合', () => {
  it('回答希望日が14日未満なら知らせる', () => {
    const i = checkSchedule({ replyBy: '2026-09-20' }, now)
    expect(fields(i)).toContain('回答希望日')
    expect(i[0].message).toContain('8日')
  })

  it('改定まで余裕があるのに回答期限だけ短い配分を知らせる', () => {
    // 改定まで50日、回答まで8日
    const i = checkSchedule({ effectiveFrom: '2026-11-01', replyBy: '2026-09-20' }, now)
    expect(i.some((x) => x.message.includes('期限を延ばした'))).toBe(true)
  })

  it('前回更新日＋24ヶ月と改定開始希望日のずれを知らせる', () => {
    // 2024-12 + 24ヶ月 = 2026-12。希望日 2026-11-01 は約1ヶ月早い
    const i = checkSchedule({ effectiveFrom: '2026-11-01', previousRenewalOn: '2024-12' }, now)
    expect(fields(i)).toContain('改定開始希望日')
    expect(i.find((x) => x.field === '改定開始希望日')!.message).toContain('2026年12月')
  })

  it('整合していれば何も出ない', () => {
    expect(checkSchedule({ effectiveFrom: '2026-12-01', replyBy: '2026-10-31', previousRenewalOn: '2024-12' }, now)).toEqual([])
  })

  it('すべて非ブロック。送るのを止めない', () => {
    const i = checkSchedule({ effectiveFrom: '2026-11-01', replyBy: '2026-09-13', previousRenewalOn: '2024-12' }, now)
    expect(i.every((x) => !x.blocking)).toBe(true)
    expect(i.length).toBeGreaterThan(0)
  })

  it('未入力なら何も見ない', () => {
    expect(checkSchedule({}, now)).toEqual([])
  })
})
