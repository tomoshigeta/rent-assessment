/**
 * 金額の扱い。
 *
 * 仕様書 §3「金額の扱い」: 円単位で保存する。
 * 仕様書 §4: 円未満の計算が生じる項目は、指定した端数処理で **項目ごとに** 円単位へ
 * 確定してから集計する。表示用の万円換算・丸め値を次の計算に使わない。
 *
 * このモジュールは円（整数）だけを外に出す。小数が外へ漏れないことが不変条件。
 */

/** 円単位の整数。 */
export type Yen = number

/** 端数処理。案件単位で選ぶ（既定は四捨五入）。 */
export type RoundingMode = 'round' | 'ceil' | 'floor'

export const DEFAULT_ROUNDING: RoundingMode = 'round'

/** 1項目を円単位へ確定させる。負値でも対称に働く（-0.5 は -1 ではなく -1 側へ寄せない）。 */
export function toYen(value: number, mode: RoundingMode = DEFAULT_ROUNDING): Yen {
  if (!Number.isFinite(value)) throw new RangeError(`金額が数値になっていません: ${value}`)
  switch (mode) {
    // 負値で Math.round が -0.5 → -0 と偏るのを避け、絶対値で丸めてから符号を戻す
    case 'round': return Math.sign(value) * Math.round(Math.abs(value))
    case 'ceil': return Math.sign(value) * Math.ceil(Math.abs(value))
    case 'floor': return Math.sign(value) * Math.floor(Math.abs(value))
  }
}

/** 倍率の基準額。仕様書 §4「基準額と倍率を保存し、提示額の変更時に再計算する」。 */
export type MultiplierBase = 'rent' | 'rentPlusManagement'

/**
 * 金額の指定。
 * - fixed: 円で確定している
 * - multiplier: 「賃料の1ヶ月分」のように基準額へ連動する
 * - unknown: 図面に記載がない。仕様書 §8-12 によりゼロと確定してはならない
 */
export type Amount =
  | { kind: 'fixed'; yen: Yen }
  | { kind: 'multiplier'; times: number; base: MultiplierBase }
  | { kind: 'unknown' }

export const yen = (v: Yen): Amount => ({ kind: 'fixed', yen: v })
export const times = (t: number, base: MultiplierBase = 'rent'): Amount => ({ kind: 'multiplier', times: t, base })
export const unknown = (): Amount => ({ kind: 'unknown' })

/** 倍率を解決するための基準額。 */
export interface AmountContext {
  rent: Yen
  managementFee: Yen
  rounding: RoundingMode
}

export interface ResolvedAmount {
  /** 計算に用いる円額。unknown のときは 0（ただし known=false）。 */
  yen: Yen
  /** false のとき、この金額は「不明」であり結果は参考値になる。 */
  known: boolean
}

/**
 * Amount を円へ解決する。
 *
 * unknown は 0 を返すが known=false を立てる。呼び出し側は必ず known を伝播し、
 * 「ゼロと確定した」結果として表示してはならない（仕様書 §8-12）。
 */
export function resolveAmount(amount: Amount, ctx: AmountContext): ResolvedAmount {
  switch (amount.kind) {
    case 'fixed':
      return { yen: toYen(amount.yen, ctx.rounding), known: true }
    case 'multiplier': {
      const base = amount.base === 'rent' ? ctx.rent : ctx.rent + ctx.managementFee
      return { yen: toYen(base * amount.times, ctx.rounding), known: true }
    }
    case 'unknown':
      return { yen: 0, known: false }
  }
}

/** 表示用。計算へ戻さないこと（仕様書 §4）。 */
export function formatYen(v: Yen): string {
  return `${Math.round(v).toLocaleString('ja-JP')}円`
}

/** 表示用の万円換算。計算へ戻さないこと（仕様書 §4）。 */
export function formatMan(v: Yen, fractionDigits = 1): string {
  return `${(v / 10000).toFixed(fractionDigits)}万円`
}
