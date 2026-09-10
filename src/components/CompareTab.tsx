'use client'

import { useState } from 'react'
import { emptyMoveCandidate, missingRequiredFields, type Case, type Comparable, type ComparableStatus } from '@/core'
import { PropertyFields } from './RegisterTab'
import { DepositEditor, FreeRentEditor, MonthlyEditor, OneTimeEditor } from './CostEditor'
import { AmountInput, Field, NumberInput, Panel, TextInput, YenInput, man } from './ui'

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

const STATUS_LABEL: Record<ComparableStatus, string> = {
  adopted: '採用', reference: '参考', excluded: '除外',
}

function ComparableRow({ value, onChange, onRemove, onMakeCandidate, isCandidate }: {
  value: Comparable
  onChange: (c: Comparable) => void
  onRemove: () => void
  onMakeCandidate: () => void
  isCandidate: boolean
}) {
  const [open, setOpen] = useState(false)
  const missing = missingRequiredFields(value)
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 100px auto', gap: 8, alignItems: 'end' }}>
        <Field label="物件名">
          <TextInput value={value.property.name} onChange={(v) => onChange({ ...value, property: { ...value.property, name: v } })} />
        </Field>
        <Field label="家賃（円/月）"><YenInput value={value.rent} onChange={(v) => onChange({ ...value, rent: v })} /></Field>
        <Field label="管理費（円/月）"><YenInput value={value.managementFee} onChange={(v) => onChange({ ...value, managementFee: v })} /></Field>
        <Field label="採否">
          <select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as ComparableStatus })}>
            {(Object.keys(STATUS_LABEL) as ComparableStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </Field>
        <div className="row-actions">
          <button type="button" className="btn small" onClick={() => setOpen(!open)}>{open ? '閉じる' : '詳細'}</button>
          <button type="button" className="btn small" onClick={onRemove}>削除</button>
        </div>
      </div>

      <div className="row-actions" style={{ marginTop: 8 }}>
        <span className="note">月額総額 {man(value.rent + value.managementFee)}円</span>
        {missing.length > 0 && (
          <span className="note" style={{ color: 'var(--warn)' }}>
            必須項目の欠落: {missing.join('・')}（基準賃料の集計から外れます）
          </span>
        )}
        <button type="button" className="btn small" onClick={onMakeCandidate} disabled={isCandidate}>
          {isCandidate ? '転居候補に登録済み' : '転居候補にする'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
          <PropertyFields value={value.property} onChange={(p) => onChange({ ...value, property: p })} />
          <div style={{ marginTop: 12 }}>
            <Field label="採用・除外の理由">
              <TextInput value={value.reason ?? ''} onChange={(v) => onChange({ ...value, reason: v })} />
            </Field>
          </div>
          <OneTimeEditor
            title="主な初期費用（比較表に載せる）"
            items={value.initialCosts}
            onChange={(items) => onChange({ ...value, initialCosts: items })}
          />
        </div>
      )}
    </div>
  )
}

export function CompareTab({ value, onChange }: { value: Case; onChange: (c: Case) => void }) {
  const set = <K extends keyof Case>(k: K, v: Case[K]) => onChange({ ...value, [k]: v })
  const adoptedCount = value.comparables.filter(
    (c) => c.status === 'adopted' && missingRequiredFields(c).length === 0,
  ).length

  const addComparable = () => set('comparables', [...value.comparables, {
    property: {
      id: uid('cmp'), name: '', use: 'residential', address: '',
      stations: [], areaSqm: 0, provenance: 'entered',
    },
    status: 'adopted', rent: 0, managementFee: 0, initialCosts: [],
  }])

  return (
    <>
      <Panel
        title={`比較物件（採用 ${adoptedCount} 件 / 登録 ${value.comparables.length} 件）`}
        hint="希望賃料を抽出条件に使わず、駅・徒歩・面積・築年数・階数で絞り込みます。採用事例のみが基準賃料に入ります。"
      >
        <button type="button" className="btn" onClick={addComparable}>比較物件を追加</button>
        <div style={{ marginTop: 12 }}>
          {value.comparables.length === 0 && <p className="note">比較物件がまだありません。</p>}
          {value.comparables.map((c, i) => (
            <ComparableRow
              key={c.property.id}
              value={c}
              isCandidate={value.moveCandidates.some((m) => m.comparableId === c.property.id)}
              onChange={(next) => {
                const arr = [...value.comparables]; arr[i] = next; set('comparables', arr)
              }}
              onRemove={() => onChange({
                ...value,
                comparables: value.comparables.filter((_, j) => j !== i),
                moveCandidates: value.moveCandidates.filter((m) => m.comparableId !== c.property.id),
              })}
              onMakeCandidate={() => set('moveCandidates', [...value.moveCandidates, emptyMoveCandidate(
                uid('move'), c.property.id, c.property.name || `転居候補${value.moveCandidates.length + 1}`,
                c.rent, c.managementFee,
              )])}
            />
          ))}
        </div>
        {adoptedCount > 0 && adoptedCount < value.thresholds.minSampleCount && (
          <div className="warnbox">
            採用事例が {adoptedCount} 件で、判定に必要な {value.thresholds.minSampleCount} 件に達していません。
            このままでは「資料不足」となり、基準賃料は参考値として表示されます。
          </div>
        )}
      </Panel>

      <Panel
        title={`転居候補（${value.moveCandidates.length} 件）`}
        hint="各候補は開始時点からその物件を利用する独立したシナリオとして計算します。新規契約なので開始時の更新料は発生しません。"
      >
        {value.moveCandidates.length === 0 && (
          <p className="note">転居候補がありません。比較物件の「転居候補にする」から追加してください。</p>
        )}
        {value.moveCandidates.map((m, i) => {
          const patch = (p: Partial<typeof m>) => {
            const arr = [...value.moveCandidates]; arr[i] = { ...m, ...p }; set('moveCandidates', arr)
          }
          return (
            <div key={m.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <Field label="候補名"><TextInput value={m.label} onChange={(v) => patch({ label: v })} /></Field>
                <Field label="家賃（円/月）"><YenInput value={m.rent} onChange={(v) => patch({ rent: v })} /></Field>
                <Field label="管理費（円/月）"><YenInput value={m.managementFee} onChange={(v) => patch({ managementFee: v })} /></Field>
                <button
                  type="button" className="btn small"
                  onClick={() => set('moveCandidates', value.moveCandidates.filter((_, j) => j !== i))}
                >削除</button>
              </div>
              <div className="grid c3" style={{ marginTop: 12 }}>
                <Field label="契約期間（月）">
                  <NumberInput value={m.contractMonths} min={1} onChange={(v) => patch({ contractMonths: Math.max(1, Math.round(v)) })} />
                </Field>
                <div style={{ gridColumn: 'span 2' }}>
                  <Field label={`更新料（最初の計上は ${1 + m.contractMonths} ヶ月目）`}>
                    <AmountInput value={m.renewalFee} onChange={(a) => patch({ renewalFee: a })} />
                  </Field>
                </div>
              </div>
              <div className="grid c2" style={{ marginTop: 12 }}>
                <Field label="契約時に支払う前家賃（円）" hint="費用に重複計上しない">
                  <YenInput value={m.prepaidRent} onChange={(v) => patch({ prepaidRent: v })} />
                </Field>
              </div>
              <OneTimeEditor items={m.oneTime} onChange={(items) => patch({ oneTime: items })} />
              <MonthlyEditor items={m.monthly} onChange={(items) => patch({ monthly: items })} />
              <DepositEditor items={m.deposits} onChange={(items) => patch({ deposits: items })} />
              <FreeRentEditor items={m.freeRent} onChange={(items) => patch({ freeRent: items })} />
            </div>
          )
        })}
      </Panel>

      <Panel title="更新側のその他の費用">
        <OneTimeEditor
          items={value.renewal.otherOneTime}
          onChange={(items) => set('renewal', { ...value.renewal, otherOneTime: items })}
        />
        <MonthlyEditor
          items={value.renewal.monthly}
          onChange={(items) => set('renewal', { ...value.renewal, monthly: items })}
        />
        <DepositEditor
          items={value.renewal.deposits}
          onChange={(items) => set('renewal', { ...value.renewal, deposits: items })}
        />
        <FreeRentEditor
          items={value.renewal.freeRent}
          onChange={(items) => set('renewal', { ...value.renewal, freeRent: items })}
        />
      </Panel>

      <Panel title="比較の設定">
        <div className="grid c3">
          <Field label="比較期間（月）" hint="1〜120">
            <NumberInput
              value={value.settings.horizonMonths} min={1} max={120}
              onChange={(v) => {
                const h = Math.min(120, Math.max(1, Math.round(v)))
                set('settings', {
                  ...value.settings,
                  horizonMonths: h,
                  searchHorizonMonths: Math.max(h, value.settings.searchHorizonMonths),
                })
              }}
            />
          </Field>
          <Field label="逆転の探索範囲（月）" hint="比較期間以上">
            <NumberInput
              value={value.settings.searchHorizonMonths} min={value.settings.horizonMonths} max={120}
              onChange={(v) => set('settings', {
                ...value.settings,
                searchHorizonMonths: Math.min(120, Math.max(value.settings.horizonMonths, Math.round(v))),
              })}
            />
          </Field>
          <Field label="端数処理" hint="項目ごとに円へ確定">
            <select
              value={value.settings.rounding}
              onChange={(e) => set('settings', { ...value.settings, rounding: e.target.value as typeof value.settings.rounding })}
            >
              <option value="round">四捨五入</option>
              <option value="ceil">切り上げ</option>
              <option value="floor">切り捨て</option>
            </select>
          </Field>
        </div>
        <div className="row-actions" style={{ marginTop: 10 }}>
          <span className="note">よく使う期間:</span>
          {[24, 36, 48].map((h) => (
            <button
              key={h} type="button" className="btn small"
              onClick={() => set('settings', {
                ...value.settings, horizonMonths: h,
                searchHorizonMonths: Math.max(h, value.settings.searchHorizonMonths),
              })}
            >{h}ヶ月</button>
          ))}
        </div>
      </Panel>

      <Panel
        title="貸主の再募集の仮定"
        hint="再募集賃料は希望する更新賃料と別入力です。下限目安は L = q·max(H−d,0)/(H+1) で求めます。"
      >
        <div className="grid c2">
          <Field label="再募集月額 q（円/月）">
            <YenInput value={value.relet.reletMonthlyIncome} onChange={(v) => set('relet', { ...value.relet, reletMonthlyIncome: v })} />
          </Field>
          <Field label="無収入の空室月数 d">
            <NumberInput value={value.relet.vacantMonths} min={0} onChange={(v) => set('relet', { ...value.relet, vacantMonths: Math.max(0, Math.round(v)) })} />
          </Field>
        </div>
      </Panel>

      <Panel
        title="判定の閾値"
        hint="いずれも実務感覚による仮値です。実データが揃った段階で確定します。"
      >
        <div className="grid c3">
          <Field label="妥当とする幅（±%）">
            <NumberInput value={value.thresholds.fairBandPct} min={0} step={0.1} onChange={(v) => set('thresholds', { ...value.thresholds, fairBandPct: v })} />
          </Field>
          <Field label="強い警告の閾値（±%）">
            <NumberInput value={value.thresholds.strongWarningPct} min={0} step={0.1} onChange={(v) => set('thresholds', { ...value.thresholds, strongWarningPct: v })} />
          </Field>
          <Field label="最低事例数（件）">
            <NumberInput value={value.thresholds.minSampleCount} min={1} onChange={(v) => set('thresholds', { ...value.thresholds, minSampleCount: Math.max(1, Math.round(v)) })} />
          </Field>
        </div>
      </Panel>
    </>
  )
}
