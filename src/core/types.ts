import type { Amount, RoundingMode, Yen } from './money'

/**
 * 値の来歴。仕様書 §1「原資料と修正履歴」。
 * v0.1 は図面抽出を行わないため実際に付くのは 'entered' / 'assumed' / 'unknown' だが、
 * 抽出機能を後から足したときにデータを作り直さずに済むよう最初から持つ。
 */
export type Provenance = 'extracted' | 'confirmed' | 'entered' | 'assumed' | 'unknown'

/** 出典。v0.1 では手入力なので任意。 */
export interface SourceRef {
  file?: string
  page?: number
  rawText?: string
  /** 資料日または取得日 (YYYY-MM-DD) */
  documentDate?: string
}

/** 駅と徒歩分数の組。複数駅を保持する（仕様書 §1）。 */
export interface StationAccess {
  line?: string
  station: string
  walkMinutes: number
}

/**
 * 物件。仕様書 §1 の抽出項目のうち、間取り・税区分を除いたもの（Q14/Q18 の決定）。
 * v0.1 は全件居住用のため用途は 'residential' 固定だが、フィールドは保持する。
 */
export interface Property {
  id: string
  /** 建物名・部屋番号など。表示上の識別子。 */
  name: string
  use: 'residential'
  address: string
  buildingName?: string
  roomNumber?: string
  stations: StationAccess[]
  /** 専有面積（㎡）。 */
  areaSqm: number
  /** 原表記の面積（「20.5帖」など）。 */
  areaRaw?: string
  /** 竣工年月 (YYYY-MM)。築年数は評価時点から導出する。 */
  builtYearMonth?: string
  /** 築年数の直接入力。builtYearMonth があればそちらを優先。 */
  buildingAgeYears?: number
  /** 対象階。 */
  floor?: number
  /** 総階数。 */
  totalFloors?: number
  provenance: Provenance
  source?: SourceRef
  note?: string
}

/** 毎月の費用（仕様書 §3）。家賃・管理費は Scenario 直下に持ち、ここはそれ以外。 */
export interface MonthlyItem {
  id: string
  label: string
  amount: Amount
}

/** 一時的な費用（仕様書 §3）。既定は 0ヶ月目。 */
export interface OneTimeItem {
  id: string
  label: string
  /** 発生月。開始時費用は 0（仕様書 §4）。 */
  month: number
  amount: Amount
}

/**
 * 定期的な費用（仕様書 §3）。更新料・保証更新料・保険料。
 *
 * schedule:
 * - months: 発生月を直接指定する
 * - renewal: 契約更新に合わせる。契約期間 contractMonths として
 *   includeStart なら 0ヶ月目に加え、以後 1 + k*contractMonths ヶ月目に発生する。
 *   契約期間24ヶ月なら 0, 25, 49, ... となり、仕様書 §4 の
 *   「24ヶ月を経過した時点で次の期間に入るための更新料は25ヶ月目に計上し、
 *   24ヶ月終了時点の比較には含めない」と一致する。
 */
export type RecurringSchedule =
  | { kind: 'months'; months: number[] }
  | { kind: 'renewal'; contractMonths: number; includeStart: boolean }

export interface RecurringItem {
  id: string
  label: string
  amount: Amount
  schedule: RecurringSchedule
}

/** 割引・返戻のうち、金額で指定するもの（返戻金など）。 */
export interface DiscountItem {
  id: string
  label: string
  month: number
  amount: Amount
}

/**
 * フリーレント（仕様書 §4）。
 * 「家賃のみ免除か管理費も免除かを保持し、対象月・対象項目だけを控除する」。
 */
export interface FreeRentItem {
  id: string
  label: string
  /** 対象月（1始まり）。 */
  months: number[]
  target: 'rent' | 'rentAndManagement'
}

/**
 * 預け金（仕様書 §3「返還される預け金」）。
 * total が預入総額、amortized が償却・敷引（返還されない＝費用計上する部分）。
 * total − amortized は費用総額に含めず、必要資金と返還予定として別表示する。
 */
export interface DepositItem {
  id: string
  label: string
  /** 預入月。通常 0。 */
  paidMonth: number
  total: Amount
  amortized: Amount
  /**
   * 返還予定月。仕様書 §4「期間末に全シナリオが退去するとは自動で仮定しない」ため
   * 未指定を既定とする。指定した場合のみ返還予定表に月が入る。
   */
  refundMonth?: number
}

/** 比較する選択肢（仕様書 §3）。 */
export type ScenarioKind =
  /** 据え置きで更新 */
  | 'renew_current'
  /** 希望額で更新 */
  | 'renew_desired'
  /** 貸主が選んだ代案で更新 */
  | 'renew_alternative'
  /** 候補物件への転居 */
  | 'move'

/**
 * ひとつの選択肢の費用構造。
 * 金額はすべて税込の実支払額（Q8 の決定。v0.1 は全件居住用のため税計算を持たない）。
 */
export interface Scenario {
  id: string
  kind: ScenarioKind
  label: string
  /** 転居シナリオのみ。比較物件への参照。 */
  propertyId?: string
  /** 家賃本体（月額・税込）。 */
  rent: Yen
  /** 管理費（月額・税込）。 */
  managementFee: Yen
  monthly: MonthlyItem[]
  oneTime: OneTimeItem[]
  recurring: RecurringItem[]
  discounts: DiscountItem[]
  freeRent: FreeRentItem[]
  deposits: DepositItem[]
  /**
   * 契約時に支払う前家賃（仕様書 §4, §8-08）。
   * 必要資金には含めるが、費用としては対応する月に一度だけ計上するため
   * 累計費用には加算しない。
   */
  prepaidRent: Yen
}

/** 判定の閾値（Q17 の決定）。設定から変更できる仮値。 */
export interface AssessmentThresholds {
  /** 「妥当」とする乖離率の幅（%）。 */
  fairBandPct: number
  /** これを超えたら強い警告（%）。 */
  strongWarningPct: number
  /** 採用事例がこれ未満なら乖離率によらず「資料不足」。 */
  minSampleCount: number
}

export const DEFAULT_THRESHOLDS: AssessmentThresholds = {
  fairBandPct: 2.5,
  strongWarningPct: 20,
  minSampleCount: 8,
}

/** 比較物件の採否（仕様書 §2）。 */
export type ComparableStatus = 'adopted' | 'reference' | 'excluded'

export interface Comparable {
  property: Property
  status: ComparableStatus
  /** 採用・除外の理由（仕様書 §2「採用・除外の理由を残す」）。 */
  reason?: string
  rent: Yen
  managementFee: Yen
  /** 主な初期費用の内訳。比較表に載せる。 */
  initialCosts: OneTimeItem[]
}

/** 費用比較の設定（仕様書 §3）。 */
export interface ComparisonSettings {
  /** 比較期間（月）。初期値 24、1〜120（仕様書 §3）。 */
  horizonMonths: number
  /** 逆転探索の上限（月）。既定 120（仕様書 §5）。 */
  searchHorizonMonths: number
  rounding: RoundingMode
}

export const DEFAULT_SETTINGS: ComparisonSettings = {
  horizonMonths: 24,
  searchHorizonMonths: 120,
  rounding: 'round',
}

/** 貸主側の再募集の仮定（仕様書 §6）。 */
export interface ReletAssumption {
  /** 再募集月額 q。希望する更新賃料とは別入力（仕様書 §6）。 */
  reletMonthlyIncome: Yen
  /** 無収入の空室月数 d。 */
  vacantMonths: number
}

/** 案件。仕様書 §9「案件単位で保存する」。 */
export interface Case {
  id: string
  title: string
  /** 算定ルールの版（仕様書 §9「同じ入力とルール版では同じ数値になる」）。 */
  rulesVersion: string
  createdAt: string
  updatedAt: string
  /** 比較開始日＝更新後の賃料が適用される日（仕様書 §4）。 */
  comparisonStartDate?: string
  subject: Property
  currentRent: Yen
  currentManagementFee: Yen
  desiredRent: Yen
  desiredManagementFee: Yen
  comparables: Comparable[]
  scenarios: Scenario[]
  settings: ComparisonSettings
  relet: ReletAssumption
  thresholds: AssessmentThresholds
  /** 貸主が選んだ提示額（仕様書 §7）。 */
  selectedOfferRent?: Yen
}

export const RULES_VERSION = '0.1.0'
