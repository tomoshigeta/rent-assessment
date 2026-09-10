import { VERDICT_LABEL, type Case } from '@/core'
import type { Analysis } from '@/lib/analyze'

const yen = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}円`
const man = (v: number) => `${(v / 10000).toFixed(1)}万円`

/**
 * 貸主向け検討資料「更新賃料の検討結果」。仕様書 §7。
 * 借主用と違い、収支・下限・保留項目を載せる。
 */
export function LandlordReport({ value, analysis }: { value: Case; analysis: Analysis }) {
  const a = analysis.assessment
  const ceiling = analysis.ceiling.binding
  const floor = analysis.landlord.floor
  const conflict = ceiling !== null && floor > ceiling.rentCeiling

  return (
    <div className="wrap">
      <section className="panel">
        <h2 style={{ fontSize: 18 }}>更新賃料の検討結果</h2>
        <p className="note">
          {value.subject.name || '対象物件'}
          {value.subject.roomNumber ? ` ${value.subject.roomNumber}` : ''}
          　作成日: {new Date().toLocaleDateString('ja-JP')}
          　比較期間: {analysis.horizon}ヶ月　算定ルール版: {value.rulesVersion}
        </p>
        <p className="note" style={{ color: 'var(--danger)' }}>
          本資料は貸主用です。譲歩の下限と収支を含むため、借主へは渡さないでください。
        </p>
      </section>

      <section className="panel">
        <h2>希望額への判定</h2>
        <p><span className={`verdict ${a.verdict}`}>{VERDICT_LABEL[a.verdict]}</span></p>
        {a.reasons.map((r, i) => <p key={i} style={{ margin: '4px 0' }}>{r}</p>)}
        <table className="data" style={{ marginTop: 10 }}>
          <tbody>
            <tr><th>希望額（月額総額）</th><td className="num">{yen(value.desiredRent + value.desiredManagementFee)}</td></tr>
            <tr><th>基準賃料（採用事例の月額総額の中央値）</th><td className="num">{a.benchmarkTotal === null ? '—' : yen(a.benchmarkTotal)}</td></tr>
            <tr><th>うち家賃本体の中央値</th><td className="num">{a.benchmarkRent === null ? '—' : yen(a.benchmarkRent)}</td></tr>
            <tr><th>乖離率</th><td className="num">{a.deviationPct === null ? '—' : `${a.deviationPct >= 0 ? '+' : ''}${a.deviationPct.toFixed(1)}%`}</td></tr>
            <tr><th>採用事例数</th><td className="num">{a.sampleCount}件（判定に必要 {value.thresholds.minSampleCount}件）</td></tr>
          </tbody>
        </table>
        <p className="note" style={{ marginTop: 8 }}>
          判定の閾値は ±{value.thresholds.fairBandPct}% を妥当、±{value.thresholds.strongWarningPct}% 超を要確認としています。
          いずれも実務感覚による仮値で、実データで確定する予定です。
        </p>
      </section>

      <section className="panel">
        <h2>上限と下限</h2>
        <table className="data">
          <tbody>
            <tr>
              <th>借主側の上限（家賃本体・{analysis.horizon}ヶ月）</th>
              <td className="num">{ceiling === null ? '—' : yen(ceiling.rentCeiling)}</td>
              <td className="note">{ceiling === null ? '転居候補が未登録' : `${ceiling.againstLabel} に対する上限（複数候補のうち最低額）`}</td>
            </tr>
            <tr>
              <th>貸主側の下限（{analysis.horizon}ヶ月）</th>
              <td className="num">{yen(floor)}</td>
              <td className="note">L = q·max(H−d,0)/(H+1)、q={yen(value.relet.reletMonthlyIncome)}、d={value.relet.vacantMonths}ヶ月</td>
            </tr>
          </tbody>
        </table>
        {conflict ? (
          <div className="warnbox">
            下限が上限を超えています。設定した条件では双方の採算が一致しません。
            再募集賃料・空室月数の仮定か、転居候補の設定を見直してください。
          </div>
        ) : (
          <p className="note" style={{ marginTop: 8 }}>
            上下限は費用上の条件付きの損益分岐点です。下限は譲歩余地の内部検討に使い、
            上下限の中間を自動的な推奨賃料とはしません。
          </p>
        )}
      </section>

      <section className="panel">
        <h2>収支の比較（{analysis.horizon}ヶ月）</h2>
        <table className="data">
          <thead><tr><th>選択肢</th><th className="num">月額収入</th><th className="num">期間内の収入</th></tr></thead>
          <tbody>
            {analysis.landlord.renewalIncomes.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{yen(r.monthly)}</td>
                <td className="num">{yen(r.gross)}</td>
              </tr>
            ))}
            <tr>
              <td>退去後に再募集</td>
              <td className="num">{yen(value.relet.reletMonthlyIncome)}</td>
              <td className="num">{yen(analysis.landlord.reletGross)}</td>
            </tr>
          </tbody>
        </table>
        <p className="note" style={{ marginTop: 8 }}>
          再募集は空室{value.relet.vacantMonths}ヶ月を無収入として計算しています。
          空室による収入減は式に含まれるため、費用として重ねて加算していません。
          入替に伴う追加負担の差額 K は K = L と置いており、広告費等の個別入力は持ちません。
        </p>
      </section>

      <section className="panel">
        <h2>借主から見た総負担</h2>
        <table className="data">
          <thead>
            <tr>
              <th>選択肢</th><th className="num">月額</th><th className="num">契約時必要資金</th>
              <th className="num">{analysis.horizon}ヶ月の総負担</th><th className="num">月額換算</th>
            </tr>
          </thead>
          <tbody>
            {[...analysis.renewals, ...analysis.moves.map((m) => m.view)].map((v) => (
              <tr key={v.scenario.id}>
                <td>{v.scenario.label}</td>
                <td className="num">{yen(v.scenario.rent + v.scenario.managementFee)}</td>
                <td className="num">{yen(v.result.initialCash)}</td>
                <td className="num">{yen(v.total)}</td>
                <td className="num">{yen(v.monthlyEquivalent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>逆転時期</h2>
        {analysis.moves.length === 0 ? (
          <p className="note">転居候補が登録されていません。</p>
        ) : analysis.moves.map((m) => (
          <div key={m.view.scenario.id} style={{ marginBottom: 10 }}>
            <strong>希望額で更新 vs {m.view.scenario.label}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {m.messages.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>反対材料と保留項目</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {a.verdict !== 'fair' && <li>周辺比較の判定は「{VERDICT_LABEL[a.verdict]}」です。{a.reasons[0]}</li>}
          {a.incompleteComparables.length > 0 && (
            <li>必須項目が欠けている採用事例を集計から外しました: {a.incompleteComparables.join('、')}</li>
          )}
          {analysis.unknownItems.length > 0 && (
            <li>金額が不明な項目があります: {analysis.unknownItems.join('、')}。0として計算しており確定値ではありません。</li>
          )}
          {ceiling !== null && !ceiling.exact && (
            <li>借主側の上限は端数処理の都合で累計費用が厳密には一致しません（差 {yen(ceiling.moveCumulative - ceiling.renewCumulative)}）。</li>
          )}
          {analysis.moves.some((m) => m.crossover.flips.some((f) => f.month > analysis.horizon)) && (
            <li>選択した比較期間より後にも優劣が変わる時点があります。期間の設定を確認してください。</li>
          )}
          <li>
            比較物件の採用基準（徒歩・面積・築年数等の許容差）と判定閾値は未確定です。
            現在の閾値 ±{value.thresholds.fairBandPct}% / ±{value.thresholds.strongWarningPct}% / 最低{value.thresholds.minSampleCount}件 は仮値です。
          </li>
          <li>将来の賃料変動・成約確率・募集期間の予測は本計算の対象外です。</li>
        </ul>
      </section>

      <section className="panel">
        <h2>採用した比較事例</h2>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr><th>物件名</th><th>採否</th><th className="num">家賃</th><th className="num">管理費</th><th className="num">月額総額</th><th>理由</th></tr>
            </thead>
            <tbody>
              {value.comparables.length === 0 && <tr><td colSpan={6} className="note">比較事例が登録されていません。</td></tr>}
              {value.comparables.map((c) => (
                <tr key={c.property.id}>
                  <td>{c.property.name || '—'}</td>
                  <td>{c.status === 'adopted' ? '採用' : c.status === 'reference' ? '参考' : '除外'}</td>
                  <td className="num">{yen(c.rent)}</td>
                  <td className="num">{yen(c.managementFee)}</td>
                  <td className="num">{man(c.rent + c.managementFee)}</td>
                  <td className="note">{c.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
