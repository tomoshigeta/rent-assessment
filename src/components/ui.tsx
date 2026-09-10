'use client'

import type { Amount, MultiplierBase } from '@/core'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}{hint ? <em style={{ fontStyle: 'normal', opacity: .7 }}>　{hint}</em> : null}</span>
      {children}
    </label>
  )
}

export function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

/** 円単位の整数入力。空欄は 0 として扱わず、呼び出し側が既定値を決める。 */
export function YenInput({ value, onChange, placeholder }: {
  value: number; onChange: (v: number) => void; placeholder?: string
}) {
  return (
    <input
      type="number"
      step={1}
      min={0}
      value={Number.isFinite(value) ? value : ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Math.round(Number(e.target.value)))}
    />
  )
}

export function NumberInput({ value, onChange, min, max, step = 1 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  )
}

/**
 * 金額の入力。確定額・倍率・不明の3通り。
 * 「不明」を選べることが仕様書 §8-12（未記載をゼロと確定しない）の入口になる。
 */
export function AmountInput({ value, onChange }: { value: Amount; onChange: (a: Amount) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <select
        style={{ flex: '0 0 96px' }}
        value={value.kind}
        onChange={(e) => {
          const kind = e.target.value as Amount['kind']
          if (kind === 'fixed') onChange({ kind: 'fixed', yen: value.kind === 'fixed' ? value.yen : 0 })
          else if (kind === 'multiplier') onChange({ kind: 'multiplier', times: 1, base: 'rent' })
          else onChange({ kind: 'unknown' })
        }}
      >
        <option value="fixed">確定額</option>
        <option value="multiplier">倍率</option>
        <option value="unknown">不明</option>
      </select>
      {value.kind === 'fixed' && (
        <YenInput value={value.yen} onChange={(yen) => onChange({ kind: 'fixed', yen })} />
      )}
      {value.kind === 'multiplier' && (
        <>
          <input
            type="number" step={0.1} min={0} style={{ flex: '0 0 72px' }}
            value={value.times}
            onChange={(e) => onChange({ ...value, times: Number(e.target.value) })}
          />
          <select
            value={value.base}
            onChange={(e) => onChange({ ...value, base: e.target.value as MultiplierBase })}
          >
            <option value="rent">ヶ月分（家賃本体）</option>
            <option value="rentPlusManagement">ヶ月分（家賃＋管理費）</option>
          </select>
        </>
      )}
      {value.kind === 'unknown' && (
        <span className="note" style={{ alignSelf: 'center' }}>
          記載なし。0として計算せず参考値として扱う
        </span>
      )}
    </div>
  )
}

export function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {hint ? <p className="hint">{hint}</p> : null}
      {children}
    </section>
  )
}

export const man = (v: number, digits = 1) => `${(v / 10000).toFixed(digits)}万`
export const yenStr = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}円`
