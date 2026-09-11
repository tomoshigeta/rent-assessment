'use client'

import { monthlyTotal, currentTotal, ratePerSqm, validateListing } from '@/core'
import { access, age, pct, today, yen, type ReportProps } from './shared'

/**
 * 借主向け「更新賃料のご提案」。
 *
 * 貸主の内部検討は一切載せない。r の幅、貸主下限、原状回復費用、空室期間、
 * 転居との費用比較、逆転月はすべて除く（docs/spec.md 第5章）。
 * 借主上限も載せない — その額まで粘れると教えることになるため。
 */
export function TenantReport({ subject, listings, assessed, result, offerRent }: ReportProps) {
  const offer = offerRent ?? result.A
  const shown = listings.filter((l) => validateListing(l).every((i) => !i.blocking)).slice(0, 5)
  const R0 = currentTotal(subject)

  return (
    <>
      <section className="panel">
        <h2 style={{ fontSize: 18 }}>更新賃料のご提案</h2>
        <p className="note">{subject.name}　作成日: {today()}</p>
      </section>

      <section className="panel">
        <h2>現在と提案後の条件</h2>
        <table className="data">
          <thead><tr><th></th><th className="num">家賃</th><th className="num">管理費</th><th className="num">月額総額</th></tr></thead>
          <tbody>
            <tr><td>現在</td><td className="num">{yen(subject.currentRent)}</td><td className="num">{yen(subject.currentManagementFee)}</td><td className="num">{yen(R0)}</td></tr>
            <tr><td>ご提案</td><td className="num">—</td><td className="num">—</td><td className="num"><strong>{yen(offer)}</strong></td></tr>
            <tr><td>増減</td><td className="num">—</td><td className="num">—</td><td className="num">{offer - R0 >= 0 ? '+' : ''}{yen(offer - R0)}（{pct(offer / R0 - 1)}）</td></tr>
          </tbody>
        </table>
        <p className="note">金額は税込の月額総額です。</p>
      </section>

      <section className="panel">
        <h2>ご提案の理由</h2>
        <p>
          周辺の募集条件{assessed.sampleCount}件を、面積あたりの単価に直して比較しました。
          その中央値は <strong>{Math.round(assessed.medianRatePerSqm ?? 0).toLocaleString()}円/㎡</strong> で、
          お部屋の面積 {subject.areaSqm}㎡ に当てはめると <strong>{yen(result.A)}</strong> となります。
          ご提案額はこれに対して {pct(offer / result.A - 1)} の水準です。
        </p>
        {assessed.source === 'override' && <p className="note">査定賃料は別途の査定によります。</p>}
      </section>

      <section className="panel">
        <h2>周辺募集との比較</h2>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>項目</th><th>お部屋</th>
                {shown.map((_, i) => <th key={i}>比較{String.fromCharCode(65 + i)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr><th>所在地</th><td>{subject.address || '—'}</td>{shown.map((l, i) => <td key={i}>{l.address || '—'}</td>)}</tr>
              <tr><th>交通</th><td>{access(subject)}</td>{shown.map((l, i) => <td key={i}>{access(l)}</td>)}</tr>
              <tr><th>面積</th><td>{subject.areaSqm}㎡</td>{shown.map((l, i) => <td key={i}>{l.areaSqm}㎡</td>)}</tr>
              <tr><th>築年月</th><td>{age(subject)}</td>{shown.map((l, i) => <td key={i}>{age(l)}</td>)}</tr>
              <tr><th>所在階</th><td>{subject.floor ?? '—'}</td>{shown.map((l, i) => <td key={i}>{l.floor ?? '—'}</td>)}</tr>
              <tr><th>月額総額</th><td><strong>{yen(offer)}</strong></td>{shown.map((l, i) => <td key={i}>{yen(monthlyTotal(l))}</td>)}</tr>
              <tr><th>㎡単価</th><td>{Math.round(offer / subject.areaSqm).toLocaleString()}円</td>{shown.map((l, i) => <td key={i}>{Math.round(ratePerSqm(l)).toLocaleString()}円</td>)}</tr>
            </tbody>
          </table>
        </div>
        {listings.length > shown.length && <p className="note">比較事例が多いため、{shown.length}件を掲載しています。</p>}
      </section>

      <section className="panel">
        <h2>前提</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>金額はすべて税込の月額総額（家賃＋管理費）です。</li>
          <li>比較は面積あたりの単価で行っています。築年・階・向きの差は補正していません。</li>
          <li>将来の賃料変動は見込んでいません。</li>
        </ul>
        <p className="note" style={{ marginTop: 10 }}>資料日: {today()}</p>
      </section>
    </>
  )
}
