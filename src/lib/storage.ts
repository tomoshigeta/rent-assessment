import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Case } from '@/core'
import { parseCase } from './schema'

/**
 * 案件1件＝1JSONファイル。仕様書 §9「案件単位で保存する」。
 * v0.1 は担当者1人がローカルで動かす前提のため、DBを持たない。
 */
const DATA_DIR = path.join(process.cwd(), 'data', 'cases')

const filePath = (id: string) => {
  // ディレクトリ外への書き込みを防ぐ
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`案件IDに使えない文字が含まれています: ${id}`)
  return path.join(DATA_DIR, `${id}.json`)
}

export async function listCases(): Promise<Case[]> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith('.json'))
  const cases: Case[] = []
  for (const f of files) {
    try {
      cases.push(parseCase(JSON.parse(await fs.readFile(path.join(DATA_DIR, f), 'utf8'))))
    } catch {
      // 読めないファイルは一覧から外す。握りつぶさず、サーバーログには残す。
      console.warn(`案件ファイルを読み込めませんでした: ${f}`)
    }
  }
  return cases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function readCase(id: string): Promise<Case | null> {
  try {
    return parseCase(JSON.parse(await fs.readFile(filePath(id), 'utf8')))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function writeCase(c: Case): Promise<Case> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const validated = parseCase({ ...c, updatedAt: new Date().toISOString() })
  await fs.writeFile(filePath(validated.id), `${JSON.stringify(validated, null, 2)}\n`, 'utf8')
  return validated
}

export async function deleteCase(id: string): Promise<void> {
  await fs.rm(filePath(id), { force: true })
}
