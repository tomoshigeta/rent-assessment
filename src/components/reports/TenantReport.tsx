'use client'

import { monthlyTotal, currentTotal, ratePerSqm, validateListing } from '@/core'
import { access, age, today, yen, type ReportProps } from './shared'

/**
 * 借主向け「更新賃料のご提案」。
 *
 * 載せないもの（docs/spec.md 第5章）:
 *   貸主下限・掛け目 r・原状回復費用・空室期間・転居との費用比較・逆転月・借主上限
 *   査定賃料の円単位の金額（未確認事項の多い査定を1円単位で示さない）
 *   改定開始希望日・回答希望日・連絡先（メール本文が担う）
 *
 * 「査定賃料」という語は使わない。貸主側の内部用語であり、
 * 借主から見れば誰が査定したのかという疑問を招くため。
 */
export function TenantReport({ subject, listings, assessed, offerRent }: ReportProps) {
  // 提示額は必須。画面側で未入力なら資料を開けないようにしている。
  const offer = offerRent!
  const R0 = currentTotal(subject)
  const usable = listings.filter((l) => validateListing(l).length === 0)
  const diff = offer - R0
  const offerRentOnly = offer - subject.currentManagementFee

  return (
    <div className="doc tenant">
      <div className="band">
        <h1>更新賃料のご提案</h1>
        <p className="docmeta">{subject.name}　／　{today()} 作成</p>
      </div>

      <section>
        <h2>現在の賃料と、ご提案する賃料</h2>
        <table className="sheet">
          <thead>
            <tr><th></th><th className="num">家賃</th><th className="num">管理費</th><th className="num">月額合計</th></tr>
          </thead>
          <tbody>
            <tr>
              <th className="row">現在</th>
              <td className="num">{yen(subject.currentRent)}</td>
              <td className="num">{yen(subject.currentManagementFee)}</td>
              <td className="num">{yen(R0)}</td>
            </tr>
            <tr className="emph">
              <th className="row">ご提案</th>
              <td className="num">{yen(offerRentOnly)}</td>
              <td className="num">{yen(subject.currentManagementFee)}</td>
              <td className="num">{yen(offer)}</td>
            </tr>
            <tr>
              <th className="row">増減</th>
              <td className="num">{diff >= 0 ? '+' : ''}{yen(diff)}</td>
              <td className="num">据え置き</td>
              <td className="num">{diff >= 0 ? '+' : ''}{yen(diff)}（{diff >= 0 ? '+' : ''}{((diff / R0) * 100).toFixed(1)}%）</td>
            </tr>
          </tbody>
        </table>
        <p className="fine" style={{ marginTop: 8 }}>
          金額は税込です。管理費は現在と同額で据え置きます。
        </p>
      </section>

      <section>
        <h2>お部屋の条件</h2>
        <table className="sheet">
          <tbody>
            <tr><th className="row">所在地</th><td>{subject.address || '—'}</td><th className="row">交通</th><td>{access(subject)}</td></tr>
            <tr><th className="row">面積</th><td>{subject.areaSqm}㎡</td><th className="row">間取り</th><td>{subject.layout || '—'}</td></tr>
            <tr><th className="row">築年月</th><td>{age(subject)}</td><th className="row">所在階</th><td>{subject.floor ? `${subject.floor}階` : '—'}</td></tr>
            <tr><th className="row">契約用途</th><td>{subject.contractUse || '—'}</td><th className="row">家具</th><td>{subject.furnished || '—'}</td></tr>
            {(subject.renovatedOn || subject.renovationNote) && (
              <tr><th className="row">改装</th><td colSpan={3}>{[subject.renovatedOn, subject.renovationNote].filter(Boolean).join('　')}</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>比較した周辺の募集条件（{usable.length}件）</h2>
        <p className="fine" style={{ marginBottom: 10 }}>
          いずれも {usable[0]?.confirmedOn ?? ''} 時点で募集中の条件です。募集元を記載していますので、条件はご自身でもご確認いただけます。
        </p>
        {usable.map((l, i) => (
          <div className="case" key={i}>
            <div className="hd">
              <span className="nm">{l.name}</span>
              <span className="pr">月額 {yen(monthlyTotal(l))}　（{Math.round(ratePerSqm(l)).toLocaleString()}円/㎡）</span>
            </div>
            <dl>
              <dt>条件</dt>
              <dd>{[`${l.areaSqm}㎡`, access(l) !== '—' ? access(l) : null, l.builtYearMonth ? `${l.builtYearMonth}築` : null, l.floor ? `${l.floor}階` : null].filter(Boolean).join('　／　')}</dd>
              <dt>内訳</dt>
              <dd>家賃 {yen(l.rent)}　管理費 {yen(l.managementFee)}</dd>
              {l.similarity && <><dt>共通する点</dt><dd>{l.similarity}</dd></>}
              {l.difference && <><dt>賃料差の要因</dt><dd>{l.difference}</dd></>}
              <dt>出典</dt>
              <dd>{l.sourceAgency}　{l.confirmedOn} 確認{l.sourceRef ? `　${l.sourceRef}` : ''}</dd>
            </dl>
          </div>
        ))}
      </section>

      <section>
        <h2>比較にあたっての前提</h2>
        <ul className="fine">
          <li>金額はいずれも税込の月額合計（家賃＋管理費）です。</li>
          <li>面積あたりの単価に換算して比較しています。{usable.length}件の単価は
            1㎡あたり {Math.round(Math.min(...usable.map(ratePerSqm))).toLocaleString()}円 〜 {Math.round(Math.max(...usable.map(ratePerSqm))).toLocaleString()}円 と幅があり、
            その中央値は {Math.round(assessed.medianRatePerSqm ?? 0).toLocaleString()}円 でした。</li>
          <li>築年・階数・向き・設備の違いは金額として補正していません。面積の違いのみ揃えています。</li>
          <li>いずれも募集時点の条件であり、実際に契約された賃料ではありません。</li>
          <li>比較した{usable.length}件は貸主側で選定したものです。網羅的な調査ではありません。</li>
        </ul>
      </section>
    </div>
  )
}
