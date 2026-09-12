/**
 * 日付の整合をみる。
 *
 * 改定開始希望日と回答希望日はメール文面の値であって、計算には一切使わない。
 * それでも検知するのは、送る前に気づける唯一の場所がここだから。
 */
import { HORIZON_MONTHS } from './assumptions'
import type { Issue } from './assess'

const parse = (s?: string): Date | null => {
  if (!s?.trim()) return null
  const d = new Date(s.trim().replace(/\//g, '-'))
  return Number.isNaN(d.getTime()) ? null : d
}
const days = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000)
const fmt = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`

export interface ScheduleInput {
  /** 改定開始希望日 (YYYY-MM-DD)。 */
  effectiveFrom?: string
  /** 回答希望日 (YYYY-MM-DD)。 */
  replyBy?: string
  /** 前回更新日 (YYYY-MM)。入力シートから。 */
  previousRenewalOn?: string
}

/**
 * 日付まわりの確認事項。すべて非ブロック（送るのを止めない）。
 * 意図的にそうしている場合もあるため、判断は利用者に残す。
 */
export function checkSchedule(input: ScheduleInput, now = new Date()): Issue[] {
  const issues: Issue[] = []
  const eff = parse(input.effectiveFrom)
  const reply = parse(input.replyBy)

  if (reply) {
    const lead = days(reply, now)
    if (lead < 0) {
      issues.push({ field: '回答希望日', message: `${fmt(reply)}は過去の日付です`, blocking: false })
    } else if (lead < 14) {
      issues.push({
        field: '回答希望日',
        message: `${fmt(reply)}まで${lead}日しかありません。借主が周辺を調べて判断するには短く、`
          + `即答を迫る印象を与えます`,
        blocking: false,
      })
    }
  }

  if (eff && reply && days(eff, reply) < 0) {
    issues.push({ field: '回答希望日', message: '改定開始希望日より後になっています', blocking: false })
  }

  if (eff && reply) {
    const total = days(eff, now)
    const lead = days(reply, now)
    // 改定まで十分あるのに回答期限だけ短い、という配分の偏りを見る
    if (total >= 42 && lead >= 0 && lead < total / 3) {
      issues.push({
        field: '回答希望日',
        message: `改定開始まで${total}日あるのに、回答期限は${lead}日後です。`
          + `期限を延ばしたほうが話が進みやすいはずです`,
        blocking: false,
      })
    }
  }

  // 前回更新日 ＋ 契約期間 と、改定開始希望日のずれ
  const prev = parse(input.previousRenewalOn ? `${input.previousRenewalOn}-01` : undefined)
  if (eff && prev) {
    const expected = new Date(prev)
    expected.setMonth(expected.getMonth() + HORIZON_MONTHS)
    const gap = Math.round(days(eff, expected) / 30)
    if (Math.abs(gap) >= 1) {
      issues.push({
        field: '改定開始希望日',
        message: `前回更新（${input.previousRenewalOn}）に契約期間${HORIZON_MONTHS}ヶ月を足すと`
          + `${expected.getFullYear()}年${expected.getMonth() + 1}月ですが、改定開始希望日は${fmt(eff)}です`
          + `（約${Math.abs(gap)}ヶ月のずれ）。どちらかの日付を確認してください`,
        blocking: false,
      })
    }
  }
  return issues
}
