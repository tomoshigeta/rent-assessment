/**
 * 入力シートの列定義。columns.json を唯一の正とし、
 * テンプレート生成（scripts/make-template.py）と取り込み処理の両方が同じ定義を読む。
 */
import spec from './columns.json'

export type ColumnKind = 'text' | 'yen' | 'area' | 'minutes' | 'yearMonth' | 'date' | 'floor'

export interface ColumnSpec {
  key: string
  header: string
  required: boolean
  kind: ColumnKind
  example: string | number
  width: number
  note?: string
}

export interface SheetSpec {
  name: string
  kind: 'subject' | 'listings'
  firstDataRow: number
  maxRows?: number
  minRows?: number
  description: string
  columns: ColumnSpec[]
}

export const EXCEL_SPEC = spec as unknown as {
  version: string
  fileName: string
  note: string
  sheets: SheetSpec[]
}

export const subjectSheet = EXCEL_SPEC.sheets.find((s) => s.kind === 'subject')!
export const listingsSheet = EXCEL_SPEC.sheets.find((s) => s.kind === 'listings')!
