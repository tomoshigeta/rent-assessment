import type { Yen } from '../money'
import type { VacancyMonths } from './assumptions'

/**
 * 比較事例1件。募集図面から抽出して Excel に記入したもの。
 * 賃料と管理費は分けて入れ、計算では合算した「月額総額」を使う。
 */
export interface Listing {
  /** 必須。資料の比較表に出る。 */
  name: string
  /** 必須。家賃本体（税込・月額）。 */
  rent: Yen
  /** 必須。管理費・共益費（税込・月額）。0 でもよいが空欄は不可。 */
  managementFee: Yen
  /** 必須。専有面積（㎡）。募集図面の面積基準の違いは区別しない。 */
  areaSqm: number
  address?: string
  line?: string
  station?: string
  walkMinutes?: number
  /** YYYY-MM または YYYY。 */
  builtYearMonth?: string
  floor?: number
  /** 何行目から読んだか。検証結果を元のセルへ戻すために持つ。 */
  sourceRow?: number
}

/** 対象物件。更新を検討している部屋。 */
export interface Subject {
  name: string
  /** 必須。現在の家賃本体（税込・月額）。 */
  currentRent: Yen
  /** 必須。現在の管理費（税込・月額）。 */
  currentManagementFee: Yen
  /** 必須。査定賃料を ㎡単価 × 面積 で出すため。 */
  areaSqm: number
  address?: string
  line?: string
  station?: string
  walkMinutes?: number
  builtYearMonth?: string
  floor?: number
}

/** 貸主が画面で入れる前提。結果を見ながら動かす値なので Excel には入れない。 */
export interface LandlordInput {
  /** 必須。既定値を置かない。貸主負担の原状回復費用。 */
  restorationCost: Yen
  /** 1〜3から選ぶ。 */
  vacancyMonths: VacancyMonths
  /** 査定賃料の手入力。指定すると自動算出を上書きし、件数チェックも外れる。 */
  assessedRentOverride?: Yen
}

export interface Case {
  id: string
  title: string
  rulesVersion: string
  createdAt: string
  updatedAt: string
  subject: Subject
  listings: Listing[]
  landlord: LandlordInput
  /** 貸主が選んだ提示額。逆転月の計算に使う。 */
  offerRent?: Yen
}

export const RULES_VERSION = '1.0.0'

/** 月額総額（家賃＋管理費）。計算はすべてこの値で行う。 */
export const monthlyTotal = (v: { rent: Yen; managementFee: Yen }): Yen => v.rent + v.managementFee
export const currentTotal = (s: Subject): Yen => s.currentRent + s.currentManagementFee
