/**
 * 査定賃料の算出と、入力の検証。
 */
import { toYen, type RoundingMode, type Yen } from '../money'
import { median } from '../assess'
import { MIN_SAMPLE_COUNT } from './assumptions'
import { monthlyTotal, type Listing, type Subject } from './types'

/** 1件あたりの㎡単価（月額総額 ÷ 面積）。 */
export const ratePerSqm = (l: Listing): number => monthlyTotal(l) / l.areaSqm

export interface AssessedRent {
  /** 査定賃料（円・月額総額）。算出できないときは null。 */
  yen: Yen | null
  /** 自動算出か、手入力による上書きか。 */
  source: 'calculated' | 'override' | 'unavailable'
  /** 算出に使った㎡単価の中央値。上書き時も参考として出す。 */
  medianRatePerSqm: number | null
  /** 算出に使った件数。 */
  sampleCount: number
  /** 算出できない理由。 */
  reason?: string
}

/**
 * 査定賃料 = 比較事例の㎡単価の中央値 × 対象物件の面積。
 *
 * 総額の中央値をそのまま使わないのは、対象物件と事例で面積が違うから。
 * 面積差だけは正規化する。築年・階・向きの差は Ver1 では補正しない
 * （利用者が事例を絞り込んでから入力する前提。docs/spec.md 第2章）。
 */
export function assessRent(
  subject: Subject,
  listings: Listing[],
  override: Yen | undefined,
  rounding: RoundingMode = 'round',
): AssessedRent {
  const usable = listings.filter((l) => validateListing(l).length === 0)
  const rates = usable.map(ratePerSqm)
  const medianRate = rates.length > 0 ? median(rates.map((r) => r * 1000), rounding) / 1000 : null

  if (override !== undefined && override > 0) {
    return { yen: toYen(override, rounding), source: 'override', medianRatePerSqm: medianRate, sampleCount: usable.length }
  }
  if (usable.length < MIN_SAMPLE_COUNT) {
    return {
      yen: null, source: 'unavailable', medianRatePerSqm: medianRate, sampleCount: usable.length,
      reason: `査定賃料の自動算出には比較事例が${MIN_SAMPLE_COUNT}件必要です（現在${usable.length}件）。`
        + `事例を追加するか、査定賃料を直接入力してください。`,
    }
  }
  if (!Number.isFinite(subject.areaSqm) || subject.areaSqm <= 0) {
    return { yen: null, source: 'unavailable', medianRatePerSqm: medianRate, sampleCount: usable.length,
      reason: '対象物件の面積が入っていません。' }
  }
  return {
    yen: toYen(medianRate! * subject.areaSqm, rounding),
    source: 'calculated', medianRatePerSqm: medianRate, sampleCount: usable.length,
  }
}

export interface Issue {
  field: string
  message: string
  /** true なら計算に使えない。false は確認を促すだけ。 */
  blocking: boolean
}

/**
 * 比較事例1件の検証。
 * 抽出をアプリの外でやる以上、桁違いや単位違いは必ず混入する前提で見る。
 */
export function validateListing(l: Listing): Issue[] {
  const issues: Issue[] = []
  if (!l.name?.trim()) issues.push({ field: '物件名', message: '空欄です', blocking: true })
  if (!Number.isFinite(l.rent) || l.rent <= 0) issues.push({ field: '賃料', message: '空欄か0以下です', blocking: true })
  if (!Number.isFinite(l.managementFee) || l.managementFee < 0) issues.push({ field: '管理費', message: '空欄か負の値です', blocking: true })
  if (!Number.isFinite(l.areaSqm) || l.areaSqm <= 0) issues.push({ field: '面積', message: '空欄か0以下です', blocking: true })
  if (issues.length > 0) return issues

  // 桁違い・単位違いの検知。ここで弾かず、確認を促すに留める。
  if (l.rent < 10_000) issues.push({ field: '賃料', message: `${l.rent.toLocaleString()}円。万円単位で入っていませんか`, blocking: false })
  if (l.rent > 5_000_000) issues.push({ field: '賃料', message: `${l.rent.toLocaleString()}円。桁が多すぎませんか`, blocking: false })
  if (l.managementFee > l.rent) issues.push({ field: '管理費', message: '管理費が賃料を上回っています', blocking: false })
  // 36〜43㎡の住戸は坪だと10.9〜13.0。坪で入力された可能性を警告する。
  if (l.areaSqm < 15) issues.push({ field: '面積', message: `${l.areaSqm}㎡。坪で入っていませんか`, blocking: false })
  if (l.areaSqm > 500) issues.push({ field: '面積', message: `${l.areaSqm}㎡。広すぎませんか`, blocking: false })
  return issues
}

/** 対象物件の検証。 */
export function validateSubject(s: Subject): Issue[] {
  const issues: Issue[] = []
  if (!s.name?.trim()) issues.push({ field: '物件名', message: '空欄です', blocking: true })
  if (!Number.isFinite(s.currentRent) || s.currentRent <= 0) issues.push({ field: '現在家賃', message: '空欄か0以下です', blocking: true })
  if (!Number.isFinite(s.currentManagementFee) || s.currentManagementFee < 0) issues.push({ field: '現在管理費', message: '空欄か負の値です', blocking: true })
  if (!Number.isFinite(s.areaSqm) || s.areaSqm <= 0) issues.push({ field: '面積', message: '空欄か0以下です', blocking: true })
  return issues
}
