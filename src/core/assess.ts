import { toYen, type RoundingMode, type Yen } from './money'
import type { AssessmentThresholds, Comparable } from './types'

/**
 * 中央値。事例数が偶数のときは中央2件の平均を円未満四捨五入する
 * （仕様書 §2 の中央値採用に対し、Round 3 で定義を追加）。
 */
export function median(values: Yen[], rounding: RoundingMode = 'round'): Yen {
  if (values.length === 0) throw new RangeError('事例が1件もありません')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return toYen((sorted[mid - 1] + sorted[mid]) / 2, rounding)
}

export type Verdict =
  /** 妥当 */
  | 'fair'
  /** 見直し推奨 */
  | 'review'
  /** 見直し推奨（強い警告） */
  | 'review_strong'
  /** 資料不足 */
  | 'insufficient'

export interface AssessmentResult {
  verdict: Verdict
  /**
   * 基準賃料。採用事例の「家賃＋管理費」の中央値。
   * 管理費の切り分けは募集主によって幅があるため、月額総額を比較基準にする。
   */
  benchmarkTotal: Yen | null
  /** 採用事例の家賃本体の中央値。併記用。 */
  benchmarkRent: Yen | null
  /** 希望額（家賃＋管理費）の基準賃料からの乖離率(%)。正なら割高。 */
  deviationPct: number | null
  sampleCount: number
  /** 判定の根拠となった文言。 */
  reasons: string[]
  /** 必須項目が欠けている事例（仕様書 §2「必須項目の欠落」）。 */
  incompleteComparables: string[]
}

/** 仕様書 §2「必須項目の欠落」: 用途・賃料・管理費条件・所在地・面積。 */
export function missingRequiredFields(c: Comparable): string[] {
  const missing: string[] = []
  if (!c.property.use) missing.push('用途')
  if (!Number.isFinite(c.rent) || c.rent <= 0) missing.push('賃料')
  if (!Number.isFinite(c.managementFee)) missing.push('管理費条件')
  if (!c.property.address?.trim()) missing.push('所在地')
  if (!Number.isFinite(c.property.areaSqm) || c.property.areaSqm <= 0) missing.push('面積')
  return missing
}

/**
 * 希望額の妥当性を周辺募集との比較で判定する。仕様書 §2。
 *
 * 閾値は Q17 で決めた仮値であり、実データで確定するまでの暫定値である
 * （fairBandPct=2.5, strongWarningPct=20, minSampleCount=8）。
 * 判定は周辺比較のみで行い、転居費用による上限では「妥当」に変更しない（仕様書 §2）。
 */
export function assessDesiredRent(
  desiredTotal: Yen,
  comparables: Comparable[],
  thresholds: AssessmentThresholds,
  rounding: RoundingMode = 'round',
): AssessmentResult {
  const adopted = comparables.filter((c) => c.status === 'adopted')
  const incompleteComparables = adopted
    .map((c) => {
      const missing = missingRequiredFields(c)
      return missing.length > 0 ? `${c.property.name}（${missing.join('・')}）` : null
    })
    .filter((v): v is string => v !== null)

  const usable = adopted.filter((c) => missingRequiredFields(c).length === 0)
  const sampleCount = usable.length
  const reasons: string[] = []

  if (sampleCount === 0) {
    reasons.push('採用した比較事例がありません。')
    return {
      verdict: 'insufficient',
      benchmarkTotal: null,
      benchmarkRent: null,
      deviationPct: null,
      sampleCount,
      reasons,
      incompleteComparables,
    }
  }

  const benchmarkTotal = median(usable.map((c) => c.rent + c.managementFee), rounding)
  const benchmarkRent = median(usable.map((c) => c.rent), rounding)
  const deviationPct = ((desiredTotal - benchmarkTotal) / benchmarkTotal) * 100

  if (sampleCount < thresholds.minSampleCount) {
    reasons.push(
      `採用事例が${sampleCount}件で、判定に必要な${thresholds.minSampleCount}件に達していません。` +
        `基準賃料は参考値として表示します。`,
    )
    return {
      verdict: 'insufficient',
      benchmarkTotal,
      benchmarkRent,
      deviationPct,
      sampleCount,
      reasons,
      incompleteComparables,
    }
  }

  const abs = Math.abs(deviationPct)
  const direction = deviationPct > 0 ? '割高' : '割安'
  let verdict: Verdict
  if (abs <= thresholds.fairBandPct) {
    verdict = 'fair'
    reasons.push(
      `希望額は採用事例${sampleCount}件の中央値から${abs.toFixed(1)}%の差で、` +
        `妥当とする幅（±${thresholds.fairBandPct}%）の中にあります。`,
    )
  } else if (abs <= thresholds.strongWarningPct) {
    verdict = 'review'
    reasons.push(
      `希望額は採用事例${sampleCount}件の中央値より${abs.toFixed(1)}%${direction}で、` +
        `妥当とする幅（±${thresholds.fairBandPct}%）を超えています。`,
    )
  } else {
    verdict = 'review_strong'
    reasons.push(
      `希望額は採用事例${sampleCount}件の中央値より${abs.toFixed(1)}%${direction}で、` +
        `±${thresholds.strongWarningPct}%を超えています。根拠を確認してください。`,
    )
  }

  if (incompleteComparables.length > 0) {
    reasons.push(`必須項目が欠けている採用事例を集計から除きました: ${incompleteComparables.join('、')}`)
  }

  return { verdict, benchmarkTotal, benchmarkRent, deviationPct, sampleCount, reasons, incompleteComparables }
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  fair: '妥当',
  review: '見直し推奨',
  review_strong: '見直し推奨（要確認）',
  insufficient: '資料不足',
}
