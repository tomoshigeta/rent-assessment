'use client'

import { useMemo, useState, useTransition } from 'react'
import type { Case } from '@/core'
import { analyze } from '@/lib/analyze'
import { saveCase } from '@/lib/actions'
import { RegisterTab } from './RegisterTab'
import { CompareTab } from './CompareTab'
import { ResultTab } from './ResultTab'

type Tab = 'register' | 'compare' | 'result'

const TABS: { key: Tab; label: string }[] = [
  { key: 'register', label: '案件登録' },
  { key: 'compare', label: '比較設定' },
  { key: 'result', label: '結果確認' },
]

export function CaseWorkspace({ initial }: { initial: Case }) {
  const [tab, setTab] = useState<Tab>('register')
  const [draft, setDraft] = useState<Case>(initial)
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  // 結果は保存前の編集内容から即時に再計算する。計算は純粋なので副作用はない。
  const analysis = useMemo(() => {
    try {
      return { ok: true as const, value: analyze(draft) }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  }, [draft])

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await saveCase(JSON.stringify(draft))
      if (res.ok) setSaved({ ...draft, updatedAt: res.updatedAt })
      else setError(res.error)
    })
  }

  return (
    <div className="wrap">
      <div className="tabs no-print" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'register' && <RegisterTab value={draft} onChange={setDraft} />}
      {tab === 'compare' && <CompareTab value={draft} onChange={setDraft} />}
      {tab === 'result' && (
        analysis.ok
          ? (
            <>
              <ResultTab value={draft} analysis={analysis.value} />
              <section className="panel no-print">
                <h2>資料作成</h2>
                <p className="hint">
                  印刷用レイアウトを別タブで開きます。ブラウザの「印刷 → PDF として保存」で出力してください。
                  借主用には貸主の収支と下限を含めません。
                </p>
                {dirty && (
                  <div className="warnbox">
                    未保存の変更があります。資料は保存済みの内容から作成されるため、先に保存してください。
                  </div>
                )}
                <div className="row-actions">
                  <a className="btn" href={`/cases/${draft.id}/print/tenant`} target="_blank" rel="noreferrer">
                    借主向け「更新賃料のご提案」
                  </a>
                  <a className="btn" href={`/cases/${draft.id}/print/landlord`} target="_blank" rel="noreferrer">
                    貸主向け「更新賃料の検討結果」
                  </a>
                </div>
              </section>
            </>
          )
          : <div className="warnbox">計算できませんでした: {analysis.error}</div>
      )}

      <div className="savebar no-print">
        {error && <span style={{ color: 'var(--danger)' }}>保存できませんでした: {error}</span>}
        <span className="note">
          {dirty ? '未保存の変更があります' : `保存済み（${new Date(saved.updatedAt).toLocaleString('ja-JP')}）`}
        </span>
        <button className="btn" onClick={() => setDraft(saved)} disabled={!dirty || pending}>変更を破棄</button>
        <button className="btn primary" onClick={save} disabled={!dirty || pending}>
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
