/**
 * 入力シート(.xlsx)の取り込み。
 *
 * 列の対応は columns.json の header で決める。列の順序は問わず、
 * 見出し行に無い列は無視する。利用者が列を足しても壊れないようにするため。
 */
import * as XLSX from 'xlsx'
import type { ColumnKind, ColumnSpec, SheetSpec } from './columns'
import { EXCEL_SPEC, listingsSheet, subjectSheet } from './columns'
import type { Listing, Subject } from '@/core'

export interface ImportResult {
  subject: Subject | null
  listings: Listing[]
  /** 取り込みそのものの問題（シートが無い、見出しが違う等）。 */
  errors: string[]
  /** 読み飛ばした行の説明。 */
  skipped: string[]
}

const norm = (v: unknown): string =>
  String(v ?? '').normalize('NFKC').replace(/\s+/g, '').replace(/[●*]/g, '')

/** セルの値を列の種類に応じて変換する。空欄は undefined。 */
function coerce(value: unknown, kind: ColumnKind): string | number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (kind === 'text') return String(value).trim() || undefined
  if (kind === 'yearMonth') {
    if (value instanceof Date) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
    }
    return String(value).trim() || undefined
  }
  // 数値列。全角数字や「280,000円」のような表記も受ける。
  const n = typeof value === 'number'
    ? value
    : Number(String(value).normalize('NFKC').replace(/[,，\s円㎡分階年月]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/** 見出し行を読んで、列の key → 列番号 の対応を作る。 */
function headerMap(rows: unknown[][], columns: ColumnSpec[]): Map<string, number> {
  const header = (rows[0] ?? []).map(norm)
  const map = new Map<string, number>()
  for (const col of columns) {
    const i = header.indexOf(norm(col.header))
    if (i >= 0) map.set(col.key, i)
  }
  return map
}

function readRow(row: unknown[], map: Map<string, number>, columns: ColumnSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const col of columns) {
    const i = map.get(col.key)
    if (i === undefined) continue
    const v = coerce(row[i], col.kind)
    if (v !== undefined) out[col.key] = v
  }
  return out
}

/**
 * 定義された列だけを見て空行か判定する。
 * テンプレートは右側の余白に説明文を置いているため、行全体を見ると
 * その説明文が「データのある行」に見えてしまう。
 */
const isBlank = (row: unknown[], map: Map<string, number>) =>
  [...map.values()].every((i) => {
    const c = row[i]
    return c === null || c === undefined || c === ''
  })

function sheetRows(wb: XLSX.WorkBook, spec: SheetSpec): unknown[][] | null {
  const ws = wb.Sheets[spec.name]
  if (!ws) return null
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true })
}

/**
 * ワークブックを読み取る。
 * 数値の妥当性（桁違い・単位違い）は検証しない。それは core の validateListing が行う。
 */
export function importWorkbook(data: ArrayBuffer): ImportResult {
  const errors: string[] = []
  const skipped: string[] = []
  const wb = XLSX.read(data, { type: 'array', cellDates: true })

  for (const spec of EXCEL_SPEC.sheets) {
    if (!wb.Sheets[spec.name]) errors.push(`シート「${spec.name}」が見つかりません。`)
  }
  if (errors.length > 0) return { subject: null, listings: [], errors, skipped }

  // --- 対象物件（1行） ---
  const sRows = sheetRows(wb, subjectSheet)!
  const sMap = headerMap(sRows, subjectSheet.columns)
  const missingHeaders = subjectSheet.columns.filter((c) => c.required && !sMap.has(c.key))
  if (missingHeaders.length > 0) {
    errors.push(`シート「${subjectSheet.name}」に必須の見出しがありません: ${missingHeaders.map((c) => c.header).join('、')}`)
  }
  const sBody = sRows.slice(subjectSheet.firstDataRow - 1).filter((r) => !isBlank(r, sMap))
  let subject: Subject | null = null
  if (sBody.length === 0) {
    errors.push(`シート「${subjectSheet.name}」にデータがありません（${subjectSheet.firstDataRow}行目から記入してください）。`)
  } else {
    if (sBody.length > 1) skipped.push(`シート「${subjectSheet.name}」は1行目だけを読み、残り${sBody.length - 1}行は無視しました。`)
    const r = readRow(sBody[0], sMap, subjectSheet.columns)
    subject = {
      name: String(r.name ?? ''),
      currentRent: Number(r.currentRent ?? 0),
      currentManagementFee: Number(r.currentManagementFee ?? 0),
      areaSqm: Number(r.areaSqm ?? 0),
      address: r.address as string | undefined,
      line: r.line as string | undefined,
      station: r.station as string | undefined,
      walkMinutes: r.walkMinutes as number | undefined,
      builtYearMonth: r.builtYearMonth as string | undefined,
      floor: r.floor as number | undefined,
    }
  }

  // --- 比較事例（複数行） ---
  const lRows = sheetRows(wb, listingsSheet)!
  const lMap = headerMap(lRows, listingsSheet.columns)
  const lMissing = listingsSheet.columns.filter((c) => c.required && !lMap.has(c.key))
  if (lMissing.length > 0) {
    errors.push(`シート「${listingsSheet.name}」に必須の見出しがありません: ${lMissing.map((c) => c.header).join('、')}`)
  }
  const listings: Listing[] = []
  lRows.slice(listingsSheet.firstDataRow - 1).forEach((row, i) => {
    const sheetRow = listingsSheet.firstDataRow + i
    if (isBlank(row, lMap)) return
    const r = readRow(row, lMap, listingsSheet.columns)
    if (!r.name && r.rent === undefined && r.areaSqm === undefined) {
      skipped.push(`${sheetRow}行目: 主要な列が空のため読み飛ばしました。`)
      return
    }
    listings.push({
      name: String(r.name ?? ''),
      rent: Number(r.rent ?? 0),
      managementFee: Number(r.managementFee ?? 0),
      areaSqm: Number(r.areaSqm ?? 0),
      address: r.address as string | undefined,
      line: r.line as string | undefined,
      station: r.station as string | undefined,
      walkMinutes: r.walkMinutes as number | undefined,
      builtYearMonth: r.builtYearMonth as string | undefined,
      floor: r.floor as number | undefined,
      sourceRow: sheetRow,
    })
  })

  return { subject, listings, errors, skipped }
}
