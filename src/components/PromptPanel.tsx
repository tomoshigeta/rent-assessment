'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildPrompt, checkSchedule,
  type AssessedRent, type Honorific, type Listing, type SenderRole, type Subject,
} from '@/core'

/**
 * 借主へ送るメールを AI に書かせるためのプロンプトを出す。
 * アプリは文章を書かない。検証可能な事実と指示だけを渡す。
 */
/** メール文面に差し込む値。計算には一切使わないので、ブラウザに覚えさせる。 */
const STORE_KEY = 'rent-renewal.sender'

export function PromptPanel({ subject, listings, assessed, offerRent, onBack }: {
  subject: Subject; listings: Listing[]; assessed: AssessedRent; offerRent: number; onBack: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [senderRole, setSenderRole] = useState<SenderRole>('agency')
  const [honorific, setHonorific] = useState<Honorific>('corporate')
  const [tenantName, setTenantName] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [replyBy, setReplyBy] = useState('')
  const [senderContact, setSenderContact] = useState('')

  // 差出人は毎回同じなので覚えておく。案件ごとの値は覚えない。
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
      if (typeof v.senderContact === 'string') setSenderContact(v.senderContact)
      if (v.senderRole === 'agency' || v.senderRole === 'landlord') setSenderRole(v.senderRole)
    } catch { /* 保存が読めなくても動く */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ senderContact, senderRole })) } catch { /* 無視 */ }
  }, [senderContact, senderRole])

  const scheduleIssues = useMemo(
    () => checkSchedule({ effectiveFrom, replyBy, previousRenewalOn: subject.previousRenewalOn }),
    [effectiveFrom, replyBy, subject.previousRenewalOn],
  )
  const prompt = useMemo(
    () => buildPrompt({ subject, listings, assessed, offerRent, senderRole, honorific, tenantName, effectiveFrom, replyBy, senderContact }),
    [subject, listings, assessed, offerRent, senderRole, honorific, tenantName, effectiveFrom, replyBy, senderContact],
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
        <div className="grid c3" style={{ marginBottom: 12 }}>
          <label className="field">
            <span>差出人の立場</span>
            <select value={senderRole} onChange={(e) => setSenderRole(e.target.value as SenderRole)}>
              <option value="agency">管理会社（貸主に代わって送る）</option>
              <option value="landlord">貸主本人</option>
            </select>
          </label>
          <label className="field">
            <span>借主</span>
            <select value={honorific} onChange={(e) => setHonorific(e.target.value as Honorific)}>
              <option value="corporate">法人（御中）</option>
              <option value="individual">個人（様）</option>
            </select>
          </label>
          <label className="field">
            <span>借主名</span>
            <input type="text" value={tenantName} placeholder="空欄なら【借主氏名】のまま"
              onChange={(e) => setTenantName(e.target.value)} />
          </label>
          <label className="field">
            <span>改定開始希望日</span>
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>回答希望日</span>
            <input type="date" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} />
          </label>
          <label className="field">
            <span>差出人（会社名・担当者・連絡先）</span>
            <input type="text" value={senderContact} placeholder="ライフデザインルーム 重田智洋 090-0000-0000"
              onChange={(e) => setSenderContact(e.target.value)} />
          </label>
        </div>

        {scheduleIssues.map((i, n) => (
          <div key={n} className="warnbox">{i.field}: {i.message}</div>
        ))}

        <div className="warnbox">
          空欄にした項目は <strong>【　】</strong> のまま残ります。送信前に埋めてください。
          <strong>貸主側の数字（下限・掛け目・原状回復費用・空室期間）は渡していません。</strong>
          渡すと、書かないよう指示しても文面に滲み出るためです。
        </div>
        <textarea readOnly value={prompt} spellCheck={false}
          style={{ width: '100%', height: 460, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.6 }} />
      </section>
    </>
  )
}
