'use client'

import { useMemo, useState } from 'react'
import { buildPrompt, type AssessedRent, type Listing, type Subject } from '@/core'

/**
 * 借主へ送るメールを AI に書かせるためのプロンプトを出す。
 * アプリは文章を書かない。検証可能な事実と指示だけを渡す。
 */
export function PromptPanel({ subject, listings, assessed, offerRent, onBack }: {
  subject: Subject; listings: Listing[]; assessed: AssessedRent; offerRent: number; onBack: () => void
}) {
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(
    () => buildPrompt({ subject, listings, assessed, offerRent }),
    [subject, listings, assessed, offerRent],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // クリップボードが使えない環境では、利用者が手で選択してコピーする
      setCopied(false)
    }
  }

  return (
    <>
      <div className="row-actions no-print" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={onBack}>← 入力に戻る</button>
        <button className="btn primary" onClick={copy}>{copied ? 'コピーしました' : '全文をコピー'}</button>
      </div>

      <section className="panel">
        <h2>借主へ送るメールの下書きを作る</h2>
        <p className="hint">
          下の文章をそのまま AI に貼ってください。メールの文面が返ってきます。
          このアプリは文章を書きません。検証できる事実と、守ってほしい条件だけを渡します。
        </p>
        <div className="warnbox">
          文面には <strong>【借主氏名】【改定開始希望日】【回答希望日】【担当者名・会社名・連絡先】</strong> が
          空欄のまま残ります。送信前に埋めてください。
          また、<strong>貸主側の数字（下限・掛け目・原状回復費用・空室期間）は渡していません。</strong>
          渡すと、書かないよう指示しても文面に滲み出るためです。
        </div>
        <textarea readOnly value={prompt} spellCheck={false}
          style={{ width: '100%', height: 460, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.6 }} />
      </section>
    </>
  )
}
