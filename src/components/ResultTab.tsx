'use client'

import { useState } from 'react'
import { VERDICT_LABEL, type Case } from '@/core'
import type { Analysis } from '@/lib/analyze'
import { CostChart } from './CostChart'
import { Panel, man, yenStr } from './ui'

function MonthlyDetail({ analysis }: { analysis: Analysis }) {
  const [scenarioId, setScenarioId] = useState<string>(analysis.desired.scenario.id)
  const all = [...analysis.renewals, ...analysis.moves.map((m) => m.view)]
  const view = all.find((v) => v.scenario.id === scenarioId) ?? analysis.desired
  // 費用が0でない月だけを出す。0の月は家賃だけなので明細としての情報がない。
  const rows = view.result.rows.filter((r) => r.month <= analysis.searchHorizon && r.items.length > 0)

  return (
    <div>
      <div className="row-actions" style={{ marginBottom: 10 }}>
        <span className="note">明細を表示するシナリオ:</span>
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} style={{ width: 'auto' }}>
          {all.map((v) => <option key={v.scenario.id} value={v.scenario.id}>{v.scenario.label}</option>)}
        </select>
      </div>
      <div className="scroll-x" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th className="num">月</th>
              <th>内訳</th>
              <th className="num">当月</th>
              <th className="num">累計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} style={r.month === analysis.horizon ? { background: '#f6ecd8' } : undefined}>
                <td className="num">{r.month}</td>
                <td>
                  {r.items.map((it, i) => (
                    <span key={i} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>
                      {it.label} {it.known ? yenStr(it.yen) : '（不明）'}
                    </span>
                  ))}
                </td>
                <td className="num">{yenStr(r.net)}</td>
                <td className="num">{yenStr(r.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ marginTop: 6 }}>
        網掛けは選択した比較期間（{analysis.horizon}ヶ月）の行です。費用の発生がない月は省略しています。
      </p>
    </div>
  )
}

export function ResultTab({ value, analysis }: { value: Case; analysis: Analysis }) {
  const { assessment: a, horizon, searchHorizon } = analysis
  const chartSeries = [
    ...analysis.renewals.map((v) => ({ label: v.scenario.label, result: v.result })),
    ...analysis.moves.map((m) => ({ label: m.view.scenario.label, result: m.view.result })),
  ]

  return (
    <>
      {analysis.unknownItems.length > 0 && (
        <div className="warnbox">
          金額が不明な項目があります（{analysis.unknownItems.join('、')}）。
          これらは0として計算していますが確定値ではありません。以下は明示した仮定による参考計算です。
        </div>
      )}

      <Panel title="希望額の判定" hint="周辺募集との比較で判定します。転居費用による上限だけで「妥当」には変更しません。">
        <div className="row-actions" style={{ marginBottom: 12 }}>
          <span className={`verdict ${a.verdict}`}>{VERDICT_LABEL[a.verdict]}</span>
          <span className="note">採用事例 {a.sampleCount} 件 / 必要 {value.thresholds.minSampleCount} 件</span>
        </div>
        {a.reasons.map((r, i) => <p key={i} style={{ margin: '4px 0' }}>{r}</p>)}
        <div className="stat" style={{ marginTop: 14 }}>
          <div>
            <div className="k">基準賃料（採用事例の家賃＋管理費の中央値）</div>
            <div className="v">{a.benchmarkTotal === null ? '—' : `${man(a.benchmarkTotal)}円`}</div>
          </div>
          <div>
            <div className="k">うち家賃本体の中央値</div>
            <div className="v">{a.benchmarkRent === null ? '—' : `${man(a.benchmarkRent)}円`}</div>
          </div>
          <div>
            <div className="k">希望額の月額総額</div>
            <div className="v">{man(value.desiredRent + value.desiredManagementFee)}円</div>
          </div>
          <div>
            <div className="k">乖離率</div>
            <div className="v">
              {a.deviationPct === null ? '—' : `${a.deviationPct >= 0 ? '+' : ''}${a.deviationPct.toFixed(1)}%`}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="上下限の目安" hint="費用上の条件付きの損益分岐点です。上下限の中間を推奨賃料としては扱いません。">
        <div className="stat">
          <div>
            <div className="k">借主側の上限（{horizon}ヶ月・家賃本体）</div>
            <div className="v">
              {analysis.ceiling.binding === null ? '—' : yenStr(analysis.ceiling.binding.rentCeiling)}
            </div>
          </div>
          <div>
            <div className="k">同（家賃＋管理費）</div>
            <div className="v">
              {analysis.ceiling.binding === null ? '—' : yenStr(analysis.ceiling.binding.totalCeiling)}
            </div>
          </div>
          <div>
            <div className="k">貸主側の下限（{horizon}ヶ月）</div>
            <div className="v">{yenStr(analysis.landlord.floor)}</div>
          </div>
        </div>
        {analysis.ceiling.all.length > 1 && (
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="data">
              <thead><tr><th>転居候補</th><th className="num">上限（家賃本体）</th><th>備考</th></tr></thead>
              <tbody>
                {analysis.ceiling.all.map((c) => (
                  <tr key={c.againstScenarioId}>
                    <td>{c.againstLabel}</td>
                    <td className="num">{yenStr(c.rentCeiling)}</td>
                    <td className="note">
                      {c.againstScenarioId === analysis.ceiling.binding?.againstScenarioId ? '最も低い上限（採用）' : ''}
                      {c.exact ? '' : ' 端数のため厳密には一致しません'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {analysis.ceiling.binding !== null && analysis.landlord.floor > analysis.ceiling.binding.rentCeiling && (
          <div className="warnbox">
            貸主側の下限（{yenStr(analysis.landlord.floor)}）が借主側の上限（{yenStr(analysis.ceiling.binding.rentCeiling)}）を
            超えています。設定した条件では双方の採算が一致しません。
          </div>
        )}
        {analysis.ceiling.binding === null && (
          <p className="note" style={{ marginTop: 10 }}>転居候補が登録されていないため、借主側の上限は計算できません。</p>
        )}
      </Panel>

      <Panel title={`累計負担（${horizon}ヶ月）`}>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>選択肢</th>
                <th className="num">月額</th>
                <th className="num">契約時必要資金</th>
                <th className="num">{horizon}ヶ月の総負担</th>
                <th className="num">月額換算</th>
                <th className="num">返還予定の預け金</th>
              </tr>
            </thead>
            <tbody>
              {[...analysis.renewals, ...analysis.moves.map((m) => m.view)].map((v) => (
                <tr key={v.scenario.id}>
                  <td>{v.scenario.label}</td>
                  <td className="num">{yenStr(v.scenario.rent + v.scenario.managementFee)}</td>
                  <td className="num">{yenStr(v.result.initialCash)}</td>
                  <td className="num">{yenStr(v.total)}</td>
                  <td className="num">{yenStr(v.monthlyEquivalent)}</td>
                  <td className="num">{yenStr(v.result.refundableDeposits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          返還される預け金は総負担に含めていません（仕様書 §3）。契約時必要資金には預入総額と前家賃を反映しています。
        </p>
      </Panel>

      <Panel title="累計費用の推移">
        <CostChart series={chartSeries} horizon={horizon} searchHorizon={searchHorizon} />
      </Panel>

      <Panel title="総負担が逆転する時期" hint="「希望額で更新」を基準に、各転居候補と比較しています。">
        {analysis.moves.length === 0 && <p className="note">転居候補が登録されていません。</p>}
        {analysis.moves.map((m) => (
          <div key={m.view.scenario.id} style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 13 }}>希望額で更新 vs {m.view.scenario.label}</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              {m.messages.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            <p className="note" style={{ marginTop: 4 }}>
              探索範囲 0〜{searchHorizon}ヶ月。日数への補間は行わず「何ヶ月目に逆転」で表示します。
            </p>
          </div>
        ))}
      </Panel>

      <Panel title="貸主の収支" hint="再募集賃料は希望する更新賃料と別入力です。下限は譲歩余地の内部検討に使ってください。">
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr><th>選択肢</th><th className="num">月額収入</th><th className="num">{horizon}ヶ月の収入</th></tr>
            </thead>
            <tbody>
              {analysis.landlord.renewalIncomes.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num">{yenStr(r.monthly)}</td>
                  <td className="num">{yenStr(r.gross)}</td>
                </tr>
              ))}
              <tr>
                <td>退去後に再募集（空室{value.relet.vacantMonths}ヶ月）</td>
                <td className="num">{yenStr(value.relet.reletMonthlyIncome)}</td>
                <td className="num">{yenStr(analysis.landlord.reletGross)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          下限目安 L = q·max(H−d,0)/(H+1) = {yenStr(analysis.landlord.floor)}。
          入替に伴う追加負担の差額 K は K = L と置いており、広告費等の個別入力は持ちません。
          空室による収入減は式に含まれるため、費用として重ねて加算していません。
        </p>
      </Panel>

      <Panel title="月別明細">
        <MonthlyDetail analysis={analysis} />
      </Panel>
    </>
  )
}
