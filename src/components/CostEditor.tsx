'use client'

import type { DepositItem, FreeRentItem, MonthlyItem, OneTimeItem } from '@/core'
import { AmountInput, NumberInput, TextInput } from './ui'

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`

function Header({ title, onAdd, note }: { title: string; onAdd: () => void; note?: string }) {
  return (
    <div className="row-actions" style={{ marginBottom: 6, marginTop: 14 }}>
      <strong style={{ fontSize: 12 }}>{title}</strong>
      <button type="button" className="btn small" onClick={onAdd}>追加</button>
      {note ? <span className="note">{note}</span> : null}
    </div>
  )
}

/** 一時的な費用（礼金・仲介料・引越代など）。開始時費用は0ヶ月目。 */
export function OneTimeEditor({ items, onChange, title = '一時的な費用' }: {
  items: OneTimeItem[]; onChange: (v: OneTimeItem[]) => void; title?: string
}) {
  return (
    <div>
      <Header
        title={title}
        note="0ヶ月目が契約時。記載がない項目は「不明」を選んでください"
        onAdd={() => onChange([...items, { id: uid('ot'), label: '', month: 0, amount: { kind: 'unknown' } }])}
      />
      {items.length === 0 && <p className="note">項目がありません。</p>}
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 72px 2.2fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <TextInput value={it.label} placeholder="費目名" onChange={(v) => {
            const next = [...items]; next[i] = { ...it, label: v }; onChange(next)
          }} />
          <NumberInput value={it.month} min={0} onChange={(v) => {
            const next = [...items]; next[i] = { ...it, month: Math.max(0, Math.round(v)) }; onChange(next)
          }} />
          <AmountInput value={it.amount} onChange={(a) => {
            const next = [...items]; next[i] = { ...it, amount: a }; onChange(next)
          }} />
          <button type="button" className="btn small" onClick={() => onChange(items.filter((_, j) => j !== i))}>削除</button>
        </div>
      ))}
    </div>
  )
}

/** 毎月の費用（月額保証料など）。家賃・管理費はここに含めない。 */
export function MonthlyEditor({ items, onChange }: { items: MonthlyItem[]; onChange: (v: MonthlyItem[]) => void }) {
  return (
    <div>
      <Header
        title="毎月の費用（家賃・管理費を除く）"
        onAdd={() => onChange([...items, { id: uid('mo'), label: '', amount: { kind: 'unknown' } }])}
      />
      {items.length === 0 && <p className="note">項目がありません。</p>}
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.2fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <TextInput value={it.label} placeholder="費目名" onChange={(v) => {
            const next = [...items]; next[i] = { ...it, label: v }; onChange(next)
          }} />
          <AmountInput value={it.amount} onChange={(a) => {
            const next = [...items]; next[i] = { ...it, amount: a }; onChange(next)
          }} />
          <button type="button" className="btn small" onClick={() => onChange(items.filter((_, j) => j !== i))}>削除</button>
        </div>
      ))}
    </div>
  )
}

/** 預け金。返還予定分は費用総額に入れず、償却分だけ費用計上する。 */
export function DepositEditor({ items, onChange }: { items: DepositItem[]; onChange: (v: DepositItem[]) => void }) {
  return (
    <div>
      <Header
        title="預け金（敷金・保証金）"
        note="預入総額と、そのうち返還されない償却額を分けて入力します"
        onAdd={() => onChange([...items, {
          id: uid('dep'), label: '', paidMonth: 0,
          total: { kind: 'unknown' }, amortized: { kind: 'fixed', yen: 0 },
        }])}
      />
      {items.length === 0 && <p className="note">項目がありません。</p>}
      {items.map((it, i) => {
        const patch = (p: Partial<DepositItem>) => {
          const next = [...items]; next[i] = { ...it, ...p }; onChange(next)
        }
        return (
          <div key={it.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr auto', gap: 6, marginBottom: 6 }}>
              <TextInput value={it.label} placeholder="敷金 / 保証金" onChange={(v) => patch({ label: v })} />
              <button type="button" className="btn small" onClick={() => onChange(items.filter((_, j) => j !== i))}>削除</button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="field"><span>預入総額</span><AmountInput value={it.total} onChange={(a) => patch({ total: a })} /></label>
              <label className="field"><span>うち償却・敷引（返還されない＝費用）</span><AmountInput value={it.amortized} onChange={(a) => patch({ amortized: a })} /></label>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** フリーレント。家賃のみか管理費も含むかを保持する（仕様書 §4）。 */
export function FreeRentEditor({ items, onChange }: { items: FreeRentItem[]; onChange: (v: FreeRentItem[]) => void }) {
  return (
    <div>
      <Header
        title="フリーレント"
        note="対象月をカンマ区切りで指定します（1が初月）"
        onAdd={() => onChange([...items, { id: uid('fr'), label: 'フリーレント', months: [1], target: 'rent' }])}
      />
      {items.length === 0 && <p className="note">項目がありません。</p>}
      {items.map((it, i) => {
        const patch = (p: Partial<FreeRentItem>) => {
          const next = [...items]; next[i] = { ...it, ...p }; onChange(next)
        }
        return (
          <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <TextInput value={it.label} placeholder="名称" onChange={(v) => patch({ label: v })} />
            <input
              type="text"
              value={it.months.join(',')}
              placeholder="1,2"
              onChange={(e) => patch({
                months: e.target.value.split(',')
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isInteger(n) && n >= 0),
              })}
            />
            <select value={it.target} onChange={(e) => patch({ target: e.target.value as FreeRentItem['target'] })}>
              <option value="rent">家賃のみ免除</option>
              <option value="rentAndManagement">家賃＋管理費を免除</option>
            </select>
            <button type="button" className="btn small" onClick={() => onChange(items.filter((_, j) => j !== i))}>削除</button>
          </div>
        )
      })}
    </div>
  )
}
