'use client'

import type { Case, Property } from '@/core'
import { AmountInput, Field, NumberInput, Panel, TextInput, YenInput, man } from './ui'

export function PropertyFields({ value, onChange }: { value: Property; onChange: (p: Property) => void }) {
  const set = <K extends keyof Property>(k: K, v: Property[K]) => onChange({ ...value, [k]: v })
  return (
    <>
      <div className="grid c3">
        <Field label="物件名"><TextInput value={value.name} onChange={(v) => set('name', v)} /></Field>
        <Field label="建物名"><TextInput value={value.buildingName ?? ''} onChange={(v) => set('buildingName', v)} /></Field>
        <Field label="部屋番号"><TextInput value={value.roomNumber ?? ''} onChange={(v) => set('roomNumber', v)} /></Field>
      </div>
      <div className="grid c2" style={{ marginTop: 12 }}>
        <Field label="所在地"><TextInput value={value.address} onChange={(v) => set('address', v)} /></Field>
        <Field label="専有面積（㎡）"><NumberInput value={value.areaSqm} step={0.01} min={0} onChange={(v) => set('areaSqm', v)} /></Field>
      </div>
      <div className="grid c4" style={{ marginTop: 12 }}>
        <Field label="竣工年月" hint="YYYY-MM">
          <TextInput value={value.builtYearMonth ?? ''} onChange={(v) => set('builtYearMonth', v)} />
        </Field>
        <Field label="築年数" hint="直接入力">
          <NumberInput value={value.buildingAgeYears ?? 0} min={0} onChange={(v) => set('buildingAgeYears', v)} />
        </Field>
        <Field label="対象階"><NumberInput value={value.floor ?? 0} onChange={(v) => set('floor', v)} /></Field>
        <Field label="総階数"><NumberInput value={value.totalFloors ?? 0} onChange={(v) => set('totalFloors', v)} /></Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="row-actions" style={{ marginBottom: 6 }}>
          <strong style={{ fontSize: 12 }}>駅・徒歩分数</strong>
          <button
            type="button" className="btn small"
            onClick={() => set('stations', [...value.stations, { station: '', walkMinutes: 0 }])}
          >駅を追加</button>
        </div>
        {value.stations.length === 0 && <p className="note">駅が登録されていません。</p>}
        {value.stations.map((s, i) => (
          <div key={i} className="grid c4" style={{ marginBottom: 6, alignItems: 'end' }}>
            <Field label="路線">
              <TextInput value={s.line ?? ''} onChange={(v) => {
                const next = [...value.stations]; next[i] = { ...s, line: v }; set('stations', next)
              }} />
            </Field>
            <Field label="駅名">
              <TextInput value={s.station} onChange={(v) => {
                const next = [...value.stations]; next[i] = { ...s, station: v }; set('stations', next)
              }} />
            </Field>
            <Field label="徒歩（分）">
              <NumberInput value={s.walkMinutes} min={0} onChange={(v) => {
                const next = [...value.stations]; next[i] = { ...s, walkMinutes: v }; set('stations', next)
              }} />
            </Field>
            <div>
              <button type="button" className="btn small" onClick={() => set('stations', value.stations.filter((_, j) => j !== i))}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export function RegisterTab({ value, onChange }: { value: Case; onChange: (c: Case) => void }) {
  const set = <K extends keyof Case>(k: K, v: Case[K]) => onChange({ ...value, [k]: v })
  const currentTotal = value.currentRent + value.currentManagementFee
  const desiredTotal = value.desiredRent + value.desiredManagementFee
  const diff = desiredTotal - currentTotal
  const diffPct = currentTotal > 0 ? (diff / currentTotal) * 100 : null

  return (
    <>
      <Panel title="案件">
        <div className="grid c2">
          <Field label="案件名"><TextInput value={value.title} onChange={(v) => set('title', v)} /></Field>
          <Field label="比較開始日" hint="更新後の賃料が適用される日">
            <input type="date" value={value.comparisonStartDate ?? ''} onChange={(e) => set('comparisonStartDate', e.target.value)} />
          </Field>
        </div>
      </Panel>

      <Panel title="対象物件" hint="用途は居住用に固定しています（v0.1）。金額はすべて税込の実支払額で入力してください。">
        <PropertyFields value={value.subject} onChange={(p) => set('subject', p)} />
      </Panel>

      <Panel title="現在の条件と希望額">
        <div className="grid c4">
          <Field label="現在の家賃（円/月）"><YenInput value={value.currentRent} onChange={(v) => set('currentRent', v)} /></Field>
          <Field label="現在の管理費（円/月）"><YenInput value={value.currentManagementFee} onChange={(v) => set('currentManagementFee', v)} /></Field>
          <Field label="希望する家賃（円/月）"><YenInput value={value.desiredRent} onChange={(v) => set('desiredRent', v)} /></Field>
          <Field label="希望する管理費（円/月）"><YenInput value={value.desiredManagementFee} onChange={(v) => set('desiredManagementFee', v)} /></Field>
        </div>
        <div className="stat" style={{ marginTop: 16 }}>
          <div><div className="k">現在の月額総額</div><div className="v">{man(currentTotal)}円</div></div>
          <div><div className="k">希望額の月額総額</div><div className="v">{man(desiredTotal)}円</div></div>
          <div>
            <div className="k">増減</div>
            <div className="v">
              {diff >= 0 ? '+' : ''}{man(diff)}円
              {diffPct !== null ? `（${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%）` : ''}
            </div>
          </div>
        </div>
        <div className="grid c2" style={{ marginTop: 16 }}>
          <Field label="代案の家賃（円/月）" hint="貸主が選ぶ第3案。0なら作成しない">
            <YenInput value={value.alternativeRent ?? 0} onChange={(v) => set('alternativeRent', v > 0 ? v : undefined)} />
          </Field>
        </div>
      </Panel>

      <Panel
        title="更新側の費用"
        hint="据え置き・希望額・代案の3案で共通の設定です。倍率で指定した更新料は各案の家賃から再計算されます。"
      >
        <div className="grid c3">
          <Field label="契約期間（月）" hint="次回更新料は 1+期間 ヶ月目">
            <NumberInput value={value.renewal.contractMonths} min={1} onChange={(v) => set('renewal', { ...value.renewal, contractMonths: Math.max(1, Math.round(v)) })} />
          </Field>
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="更新料">
              <AmountInput value={value.renewal.renewalFee} onChange={(a) => set('renewal', { ...value.renewal, renewalFee: a })} />
            </Field>
          </div>
        </div>
        <div className="grid c2" style={{ marginTop: 12 }}>
          <Field label="契約時に支払う前家賃（円）" hint="費用には重複計上せず、必要資金にのみ反映">
            <YenInput value={value.renewal.prepaidRent} onChange={(v) => set('renewal', { ...value.renewal, prepaidRent: v })} />
          </Field>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          今回の更新料は0ヶ月目、次回は {1 + value.renewal.contractMonths} ヶ月目に計上されます（仕様書 §4）。
          比較期間が {value.renewal.contractMonths} ヶ月なら次回分は期間外です。
        </p>
      </Panel>
    </>
  )
}
