'use client'

import {
  monthlyTotal, currentTotal, ratePerSqm, validateListing,
  HORIZON_MONTHS, MOVING_COST_MONTHS, RENEWAL_FEE_MONTHS, TENANT_CEILING_FACTOR, FAIR_BAND_PCT,
} from '@/core'
import { access, age, pct, today, yen, type ReportProps } from './shared'

/** 貸主向け「更新賃料の検討結果」。r の幅・下限・前提・宿題まで載せる。 */
export function LandlordReport({ subject, listings, assessed, result, vacancyMonths, restorationCost, offerRent }: ReportProps) {
  const usable = listings.filter((l) => validateListing(l).every((i) => !i.blocking))
  const R0 = currentTotal(subject)

  return (
    <>
      <section className="panel">
        <h2 style={{ fontSize: 18 }}>更新賃料の検討結果</h2>
        <p className="note">{subject.name}　作成日: {today()}　比較期間: {HORIZON_MONTHS}ヶ月</p>
        <p className="note" style={{ color: 'var(--danger)' }}>
          本資料は貸主用です。譲歩の下限と前提を含むため、借主へは渡さないでください。
        </p>
      </section>

      <section className="panel">
        <h2>結論</h2>
        {result.range.crossed ? (
          <p><strong>この条件では双方が成立しません。</strong>貸主下限 {yen(result.range.floor)} が借主上限 {yen(result.range.ceiling)} を上回っています。交渉ではなく、退去を前提に考えるべき状態です。</p>
        ) : (
          <p>
            双方が成立する賃料は <strong>{yen(result.range.floor)} 〜 {yen(result.range.ceiling)}</strong>。
            査定賃料 {yen(result.A)} に対する掛け目 r で <strong>{result.range.rFloor.toFixed(3)} 〜 {result.range.rCeiling.toFixed(3)}</strong> です。
            この幅の中から提示額を選んでください。<strong>中間値に根拠はありません。</strong>
          </p>
        )}
        {result.markdown && (
          <p className="note" style={{ color: 'var(--warn)' }}>
            値下げ局面です。現在賃料が査定賃料を上回っています。上限 r は借主の転居コストによる居座り余地であって、値上げの根拠ではありません。
          </p>
        )}
      </section>

      <section className="panel">
        <h2>内訳</h2>
        <table className="data">
          <tbody>
            <tr><th>査定賃料</th><td className="num">{yen(result.A)}</td>
              <td className="note">{assessed.source === 'override' ? '手入力による上書き' : `採用${assessed.sampleCount}件の㎡単価中央値 ${Math.round(assessed.medianRatePerSqm ?? 0).toLocaleString()}円/㎡ × ${subject.areaSqm}㎡`}</td></tr>
            <tr><th>現在賃料</th><td className="num">{yen(R0)}</td><td className="note">査定賃料との差 {pct(R0 / result.A - 1)}</td></tr>
            <tr><th>貸主側の下限</th><td className="num">{yen(result.range.floor)}</td>
              <td className="note">(査定 × ({HORIZON_MONTHS}−{vacancyMonths}) − 原状回復 {yen(restorationCost)}) ÷ {HORIZON_MONTHS + RENEWAL_FEE_MONTHS}</td></tr>
            <tr><th>借主側の上限</th><td className="num">{yen(result.range.ceiling)}</td>
              <td className="note">現在賃料 × {TENANT_CEILING_FACTOR.toFixed(4)}（約{((TENANT_CEILING_FACTOR - 1) * 100).toFixed(1)}%増まで）</td></tr>
            {offerRent !== undefined && (
              <tr><th>提示額</th><td className="num"><strong>{yen(offerRent)}</strong></td>
                <td className="note">
                  r = {(offerRent / result.A).toFixed(3)}、現在賃料から {pct(offerRent / R0 - 1)}。
                  {result.breakEven === null ? '転居が安くなることはありません。'
                    : `${result.breakEven}ヶ月目から転居のほうが安くなります${result.breakEven > HORIZON_MONTHS ? `（比較期間の外）` : '（比較期間の内側）'}。`}
                </td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>採用した比較事例（{usable.length}件）</h2>
        <div className="scroll-x">
          <table className="data">
            <thead><tr><th>物件名</th><th>交通</th><th className="num">面積</th><th>築年月</th><th className="num">月額総額</th><th className="num">㎡単価</th></tr></thead>
            <tbody>
              {usable.map((l, i) => (
                <tr key={i}>
                  <td>{l.name}</td><td>{access(l)}</td><td className="num">{l.areaSqm}㎡</td><td>{age(l)}</td>
                  <td className="num">{yen(monthlyTotal(l))}</td><td className="num">{Math.round(ratePerSqm(l)).toLocaleString()}円</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {listings.length > usable.length && (
          <p className="note">必須項目が欠けていた {listings.length - usable.length} 件を集計から除きました。</p>
        )}
      </section>

      <section className="panel">
        <h2>この計算が置いている仮定</h2>
        <table className="data">
          <tbody>
            <tr><th>比較期間</th><td>{HORIZON_MONTHS}ヶ月（固定）</td></tr>
            <tr><th>更新料</th><td>新賃料の{RENEWAL_FEE_MONTHS}ヶ月分。実際の募集図面では1ヶ月が主流で、{RENEWAL_FEE_MONTHS - 1}ヶ月分高く見積もっている</td></tr>
            <tr><th>転居費用</th><td>現在賃料の{MOVING_COST_MONTHS}ヶ月分。実図面から積み上げると2.5〜3.7ヶ月相当で、多めに見積もっている（借主上限が高めに出る方向）</td></tr>
            <tr><th>転居先の月額</th><td>現在賃料と同額。市場価格で借り直す前提ではない</td></tr>
            <tr><th>条件差の補正</th><td>行っていない。築年・階・向きの差は事例の絞り込みで対応する前提</td></tr>
            <tr><th>含めていない費用</th><td><strong>広告費・AD、新規礼金。</strong>含めないぶん貸主下限が2〜6%高く出る（実際より強気に見える方向）</td></tr>
            <tr><th>空室期間</th><td>{vacancyMonths}ヶ月（利用者が選択）</td></tr>
            <tr><th>相場並みの帯</th><td>±{FAIR_BAND_PCT}%。表示のみで計算には影響しない</td></tr>
          </tbody>
        </table>
        <p className="note" style={{ marginTop: 8 }}>
          各仮定の根拠と実データとの差は、仕様書 docs/spec.md 第2章に記録してあります。
        </p>
      </section>
    </>
  )
}
