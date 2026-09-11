/**
 * Ver1 の計算。3本の閉じた式だけで完結する。
 *
 * 月ごとの積み上げを行わないのは、転居費用・更新料・比較期間をすべて固定値に
 * したため、累計費用が一次式になったから。費目別の積み上げが要るようになったら
 * src/core/legacy/ の月次エンジンを戻す。
 *
 * 用語:
 *   賃料  — 家賃と管理費を合算した税込の月額総額（docs/spec.md 第2章）
 *   査定賃料 A — この物件を今募集したら付くはずの賃料
 *   現在賃料 R0 — 入居者がいま払っている賃料
 *   掛け目 r — 提示額 ÷ 査定賃料。r=1.0 が査定どおり
 */
import { toYen, type RoundingMode, type Yen } from '../money'
import {
  HORIZON_MONTHS, MOVING_COST_MONTHS, RENEWAL_FEE_MONTHS,
  TENANT_CEILING_FACTOR, type VacancyMonths,
} from './assumptions'

/** 更新側の累計係数。x·H + x·更新料月数 = x·(H + 更新料月数)。 */
const RENEWAL_DIVISOR = HORIZON_MONTHS + RENEWAL_FEE_MONTHS

/**
 * 借主側の上限。
 *
 * 借主は「更新する」か「今の賃料で同等の住まいへ移る」かを選ぶ。
 * 両者の H ヶ月の負担が等しくなる更新後賃料が上限。
 *
 *   更新: x·H + x·1.25
 *   転居: R0·H + R0·5
 *   → x = R0 · (H + 5) / (H + 1.25) = R0 × 1.1485
 *
 * 転居先を「現在賃料と同じ物件」と置いたので、上限は査定賃料に依存しない。
 * この置き方の含意は docs/spec.md 第2章「転居先をどう置いたか」を読むこと。
 */
export function tenantCeiling(currentRent: Yen, rounding: RoundingMode = 'round'): Yen {
  if (currentRent <= 0) throw new RangeError('現在賃料は1円以上である必要があります')
  return toYen(currentRent * TENANT_CEILING_FACTOR, rounding)
}

/**
 * 貸主側の下限。
 *
 * 貸主は「更新する」か「退去させて再募集する」かを選ぶ。
 * 両者の H ヶ月の収支が等しくなる更新後賃料が下限。
 *
 *   更新:   x·H + x·1.25（更新料を収入に含める）
 *   再募集: A·(H − 空室月数) − 原状回復費用
 *   → x = (A·(H − d) − C) / (H + 1.25)
 *
 * 広告費（AD）と新規礼金は Ver1 では扱わない。実際の募集図面には
 * AD 0.5〜1.5ヶ月の記載があり、含めないと下限が2〜6%高く出る
 * （貸主が実際より強気に見える方向の誤差）。Ver2 の宿題。
 */
export function landlordFloor(
  assessedRent: Yen,
  vacancyMonths: VacancyMonths,
  restorationCost: Yen,
  rounding: RoundingMode = 'round',
): Yen {
  if (assessedRent <= 0) throw new RangeError('査定賃料は1円以上である必要があります')
  if (restorationCost < 0) throw new RangeError('原状回復費用は0円以上である必要があります')
  const occupied = Math.max(HORIZON_MONTHS - vacancyMonths, 0)
  return toYen((assessedRent * occupied - restorationCost) / RENEWAL_DIVISOR, rounding)
}

/**
 * 提示額を出したとき、何ヶ月目から転居のほうが安くなるか。
 *
 *   更新累計(n) = x·1.25 + x·n
 *   転居累計(n) = R0·5  + R0·n
 *   等しくなる n = (5·R0 − 1.25·x) / (x − R0)
 *
 * 提示額が現在賃料以下なら転居が安くなることはない（null を返す）。
 * 日数への補間は行わず、転居が安くなる最初の「月」を返す。
 */
export function breakEvenMonth(offerRent: Yen, currentRent: Yen): number | null {
  if (offerRent <= currentRent) return null
  const n = (MOVING_COST_MONTHS * currentRent - RENEWAL_FEE_MONTHS * offerRent) / (offerRent - currentRent)
  if (!Number.isFinite(n)) return null
  // n ちょうどで同額。その次の月から転居が安い。
  const month = Math.floor(n) + 1
  return month >= 0 ? month : 0
}

export interface RentRange {
  /** 貸主側の下限（円）。これを下回ると、貸主は再募集したほうが得。 */
  floor: Yen
  /** 借主側の上限（円）。これを上回ると、借主は転居したほうが得。 */
  ceiling: Yen
  /** 査定賃料に対する下限の掛け目。 */
  rFloor: number
  /** 査定賃料に対する上限の掛け目。 */
  rCeiling: number
  /**
   * 下限が上限を超えている。
   * 異常ではなく「この条件では双方が成立しない」という有効な答え。
   * 交渉ではなく退去を前提に考えるべき、と読む。
   */
  crossed: boolean
}

/** 双方が成立する賃料の幅を求める。 */
export function rentRange(
  assessedRent: Yen,
  currentRent: Yen,
  vacancyMonths: VacancyMonths,
  restorationCost: Yen,
  rounding: RoundingMode = 'round',
): RentRange {
  const floor = landlordFloor(assessedRent, vacancyMonths, restorationCost, rounding)
  const ceiling = tenantCeiling(currentRent, rounding)
  return {
    floor,
    ceiling,
    rFloor: floor / assessedRent,
    rCeiling: ceiling / assessedRent,
    crossed: floor > ceiling,
  }
}
