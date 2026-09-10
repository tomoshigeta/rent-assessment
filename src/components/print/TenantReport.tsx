import { VERDICT_LABEL, type Case, type Comparable } from '@/core'
import type { Analysis } from '@/lib/analyze'

const yen = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}円`
const man = (v: number) => `${(v / 10000).toFixed(1)}万円`

function age(p: Comparable['property']): string {
  if (p.builtYearMonth) {
    const [y, m] = p.builtYearMonth.split('-').map(Number)
    if (Number.isFinite(y)) {
      const now = new Date()
      const years = now.getFullYear() - y - (Number.isFinite(m) && now.getMonth() + 1 < m ? 1 : 0)
      return `築${years}年（${p.builtYearMonth}）`
    }
  }
  return p.buildingAgeYears ? `築${p.buildingAgeYears}年` : '—'
}

const stations = (p: Comparable['property']) =>
  p.stations.length === 0 ? '—' : p.stations.map((s) => `${s.station} 徒歩${s.walkMinutes}分`).join(' / ')

const initialCosts = (c: Comparable) =>
  c.initialCosts.length === 0
    ? '—'
    : c.initialCosts.map((i) => `${i.label} ${i.amount.kind === 'fixed' ? yen(i.amount.yen) : i.amount.kind === 'multiplier' ? `${i.amount.times}ヶ月分` : '不明'}`).join(' / ')

/**
 * 借主向け説明資料「更新賃料のご提案」。仕様書 §7。
 * 貸主の収支と譲歩の下限は載せない。
 */
export function TenantReport({ value, analysis }: { value: Case; analysis: Analysis }) {
  const shown = value.comparables.filter((c) => c.status !== 'excluded').slice(0, 4)
  const offer = value.selectedOfferRent ?? value.desiredRent
  const offerTotal = offer + value.desiredManagementFee
  const currentTotal = value.currentRent + value.currentManagementFee
  const a = analysis.assessment

  return (
    <div className="wrap">
      <section className="panel">
        <h2 style={{ fontSize: 18 }}>更新賃料のご提案</h2>
        <p className="note">
          {value.subject.name || '対象物件'}
          {value.subject.roomNumber ? ` ${value.subject.roomNumber}` : ''}
          　作成日: {new Date().toLocaleDateString('ja-JP')}
          {value.comparisonStartDate ? `　適用予定日: ${value.comparisonStartDate}` : ''}
        </p>
      </section>

      <section className="panel">
        <h2>現在と提案後の条件</h2>
        <table className="data">
          <thead>
            <tr><th></th><th className="num">家賃</th><th className="num">管理費</th><th className="num">月額総額</th></tr>
          </thead>
          <tbody>
            <tr><td>現在</td><td className="num">{yen(value.currentRent)}</td><td className="num">{yen(value.currentManagementFee)}</td><td className="num">{yen(currentTotal)}</td></tr>
            <tr><td>ご提案</td><td className="num">{yen(offer)}</td><td className="num">{yen(value.desiredManagementFee)}</td><td className="num">{yen(offerTotal)}</td></tr>
            <tr>
              <td>増減</td>
              <td className="num">{offer - value.currentRent >= 0 ? '+' : ''}{yen(offer - value.currentRent)}</td>
              <td className="num">—</td>
              <td className="num">
                {offerTotal - currentTotal >= 0 ? '+' : ''}{yen(offerTotal - currentTotal)}
                {currentTotal > 0 ? `（${((offerTotal - currentTotal) / currentTotal * 100).toFixed(1)}%）` : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>ご提案の理由</h2>
        {a.benchmarkTotal !== null ? (
          <p>
            周辺の募集条件{a.sampleCount}件と比較しました。同じ用途・近い条件の募集の月額総額の中央値は
            {man(a.benchmarkTotal)}で、ご提案額はこれに対して
            {a.deviationPct !== null ? `${a.deviationPct >= 0 ? '+' : ''}${a.deviationPct.toFixed(1)}%` : '—'}
            の水準です（判定: {VERDICT_LABEL[a.verdict]}）。
          </p>
        ) : (
          <p>比較可能な募集事例が不足しているため、周辺相場の中央値は算出していません。</p>
        )}
        {a.verdict === 'insufficient' && (
          <p className="note">事例数が判定に必要な件数に達していないため、以下は参考としてご覧ください。</p>
        )}
      </section>

      <section className="panel">
        <h2>周辺募集との比較</h2>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>項目</th>
                <th>対象物件</th>
                {shown.map((c, i) => <th key={c.property.id}>比較{String.fromCharCode(65 + i)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr><th>用途</th><td>居住用</td>{shown.map((c) => <td key={c.property.id}>居住用</td>)}</tr>
              <tr><th>所在地</th><td>{value.subject.address || '—'}</td>{shown.map((c) => <td key={c.property.id}>{c.property.address || '—'}</td>)}</tr>
              <tr><th>駅・徒歩</th><td>{stations(value.subject)}</td>{shown.map((c) => <td key={c.property.id}>{stations(c.property)}</td>)}</tr>
              <tr><th>面積</th><td>{value.subject.areaSqm || '—'}㎡</td>{shown.map((c) => <td key={c.property.id}>{c.property.areaSqm || '—'}㎡</td>)}</tr>
              <tr><th>築年数</th><td>{age(value.subject)}</td>{shown.map((c) => <td key={c.property.id}>{age(c.property)}</td>)}</tr>
              <tr><th>階数</th><td>{value.subject.floor ?? '—'}</td>{shown.map((c) => <td key={c.property.id}>{c.property.floor ?? '—'}</td>)}</tr>
              <tr>
                <th>家賃・管理費</th>
                <td>{yen(offer)} / {yen(value.desiredManagementFee)}</td>
                {shown.map((c) => <td key={c.property.id}>{yen(c.rent)} / {yen(c.managementFee)}</td>)}
              </tr>
              <tr><th>主な初期費用</th><td>—</td>{shown.map((c) => <td key={c.property.id}>{initialCosts(c)}</td>)}</tr>
              <tr><th>採否</th><td>—</td>{shown.map((c) => <td key={c.property.id}>{c.status === 'adopted' ? '採用' : '参考'}</td>)}</tr>
            </tbody>
          </table>
        </div>
        {value.comparables.filter((c) => c.status !== 'excluded').length > shown.length && (
          <p className="note">比較事例が多いため、上位4件を掲載しています。</p>
        )}
      </section>

      <div className="page-break" />

      <section className="panel">
        <h2>更新と転居の費用比較（{analysis.horizon}ヶ月）</h2>
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
        <h2>総負担が同額・逆転する時期</h2>
        {analysis.moves.length === 0 ? (
          <p className="note">転居候補が登録されていないため、比較は行っていません。</p>
        ) : analysis.moves.map((m) => (
          <div key={m.view.scenario.id} style={{ marginBottom: 10 }}>
            <strong>更新 vs {m.view.scenario.label}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {m.messages.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>返還される預け金</h2>
        <table className="data">
          <thead><tr><th>選択肢</th><th className="num">契約時必要資金</th><th className="num">うち返還予定の預け金</th></tr></thead>
          <tbody>
            {[...analysis.renewals, ...analysis.moves.map((m) => m.view)].map((v) => (
              <tr key={v.scenario.id}>
                <td>{v.scenario.label}</td>
                <td className="num">{yen(v.result.initialCash)}</td>
                <td className="num">{yen(v.result.refundableDeposits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">返還が予定されている預け金は、上表の総負担には含めていません。</p>
      </section>

      <section className="panel">
        <h2>費用の前提</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>金額はすべて税込の実支払額です。</li>
          <li>比較期間は{analysis.horizon}ヶ月、逆転の探索範囲は{analysis.searchHorizon}ヶ月です。</li>
          <li>開始時の一時費用を0ヶ月目、家賃を1ヶ月目から計上しています。</li>
          <li>将来の賃料変動は見込んでいません。登録された条件が続く場合の計算です。</li>
          {analysis.unknownItems.length > 0 && (
            <li>金額が不明な項目（{analysis.unknownItems.join('、')}）は0として計算しており、確定値ではありません。</li>
          )}
        </ul>
        <p className="note" style={{ marginTop: 10 }}>
          資料日: {new Date().toLocaleDateString('ja-JP')}　算定ルール版: {value.rulesVersion}
        </p>
      </section>
    </div>
  )
}
