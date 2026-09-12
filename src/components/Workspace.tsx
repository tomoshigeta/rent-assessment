'use client'

import { useMemo, useState } from 'react'
import {
  assessRent, breakEvenMonth, currentTotal, monthlyTotal, rentRange, ratePerSqm,
  validateListing, validateSubject,
  FAIR_BAND_PCT, HORIZON_MONTHS, MIN_SAMPLE_COUNT, MOVING_COST_MONTHS,
  RENEWAL_FEE_MONTHS, TENANT_CEILING_FACTOR, VACANCY_MONTH_CHOICES,
  type Listing, type Subject, type VacancyMonths,
} from '@/core'
import { EXCEL_SPEC } from '@/excel/columns'
import { importWorkbook, type ImportResult } from '@/excel/import'
import { roundedOffers } from '@/core'
import { RScale } from './RScale'
import { LandlordReport } from './reports/LandlordReport'
import { TenantReport } from './reports/TenantReport'
import { PromptPanel } from './PromptPanel'

const yen = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}円`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

type Report = 'none' | 'landlord' | 'tenant' | 'prompt'

export function Workspace() {
  const [imported, setImported] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [restorationCost, setRestorationCost] = useState<number | ''>('')
  const [vacancyMonths, setVacancyMonths] = useState<VacancyMonths>(2)
  const [override, setOverride] = useState<number | ''>('')
  const [offerRent, setOfferRent] = useState<number | ''>('')
  const [report, setReport] = useState<Report>('none')

  const onFile = async (f: File) => {
    setFileName(f.name)
    setReport('none')
    try {
      setImported(importWorkbook(await f.arrayBuffer()))
    } catch (err) {
      // 壊れたファイルや想定外の形式でも、何が起きたかを画面に出す
      setImported({
        subject: null, listings: [], skipped: [],
        errors: [`ファイルを読み込めませんでした: ${err instanceof Error ? err.message : String(err)}`],
      })
    }
  }

  const subject = imported?.subject ?? null
  const listings = imported?.listings ?? []

  const assessed = useMemo(
    () => (subject ? assessRent(subject, listings, override === '' ? undefined : override) : null),
    [subject, listings, override],
  )

  const result = useMemo(() => {
    if (!subject || !assessed?.yen || restorationCost === '') return null
    const R0 = currentTotal(subject)
    if (R0 <= 0) return null
    const range = rentRange(assessed.yen, R0, vacancyMonths, restorationCost)
    return {
      R0, A: assessed.yen, range,
      breakEven: offerRent === '' ? null : breakEvenMonth(offerRent, R0),
      markdown: R0 > assessed.yen,
    }
  }, [subject, assessed, restorationCost, vacancyMonths, offerRent])

  if (report === 'prompt' && result && subject && assessed?.yen && offerRent !== '') {
    return <PromptPanel subject={subject} listings={listings} assessed={assessed} offerRent={offerRent} onBack={() => setReport('none')} />
  }

  if (report !== 'none' && result && subject && assessed?.yen) {
    const common = { subject, listings, assessed, result, vacancyMonths, restorationCost: Number(restorationCost), offerRent: offerRent === '' ? undefined : offerRent }
    return (
      <div className="wrap">
        <div className="row-actions no-print" style={{ marginBottom: 16 }}>
          <button className="btn" onClick={() => setReport('none')}>← 入力に戻る</button>
          <button className="btn primary" onClick={() => window.print()}>印刷 / PDFとして保存</button>
          <span className="note">ブラウザの印刷画面から「PDFとして保存」を選んでください</span>
        </div>
        {report === 'landlord' ? <LandlordReport {...common} /> : <TenantReport {...common} />}
      </div>
    )
  }

  return (
    <div className="wrap">
      {/* ───── 1. 入力シート ───── */}
      <section className="panel">
        <h2>1. 入力シートを読み込む</h2>
        <p className="hint">
          募集図面から転記した Excel を選んでください。テンプレートは
          <a href={`/${EXCEL_SPEC.fileName}`} download> {EXCEL_SPEC.fileName}</a>、
          記入例は<a href="/更新賃料検討_入力シート_記入例_麻布十番.xlsx" download> こちら</a>です。
        </p>
        <input type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {fileName && <span className="note" style={{ marginLeft: 10 }}>{fileName}</span>}

        {imported?.errors.map((e, i) => <div key={i} className="warnbox" style={{ borderLeftColor: 'var(--danger)' }}>{e}</div>)}
        {imported?.skipped.map((s, i) => <div key={i} className="note" style={{ marginTop: 6 }}>{s}</div>)}
      </section>

      {subject && (
        <>
          {/* ───── 2. 読み込んだ内容 ───── */}
          <section className="panel">
            <h2>2. 読み込んだ内容</h2>
            <div className="stat" style={{ marginBottom: 14 }}>
              <div><div className="k">対象物件</div><div className="v" style={{ fontSize: 15 }}>{subject.name || '（名称なし）'}</div></div>
              <div><div className="k">現在賃料（家賃＋管理費）</div><div className="v">{yen(currentTotal(subject))}</div></div>
              <div><div className="k">面積</div><div className="v">{subject.areaSqm}㎡</div></div>
            </div>
            {validateSubject(subject).map((i, n) => (
              <div key={n} className="warnbox" style={{ borderLeftColor: 'var(--danger)' }}>対象物件の{i.field}: {i.message}</div>
            ))}

            <div className="scroll-x" style={{ marginTop: 10 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>行</th><th>物件名</th><th className="num">賃料</th><th className="num">管理費</th>
                    <th className="num">月額総額</th><th className="num">面積</th><th className="num">㎡単価</th><th>確認</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l, i) => {
                    const issues = validateListing(l)
                    const blocked = issues.some((x) => x.blocking)
                    return (
                      <tr key={i} style={blocked ? { background: '#f6dedc' } : issues.length ? { background: '#fdf8ee' } : undefined}>
                        <td className="num">{l.sourceRow}</td>
                        <td>{l.name || '—'}</td>
                        <td className="num">{yen(l.rent)}</td>
                        <td className="num">{yen(l.managementFee)}</td>
                        <td className="num">{yen(monthlyTotal(l))}</td>
                        <td className="num">{l.areaSqm}㎡</td>
                        <td className="num">{blocked ? '—' : `${Math.round(ratePerSqm(l)).toLocaleString()}円`}</td>
                        <td className="note">
                          {issues.length === 0 ? '' : issues.map((x) => `${x.field}: ${x.message}`).join(' / ')}
                          {blocked && <strong>（集計から除外）</strong>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="note" style={{ marginTop: 8 }}>
              シートに入れた行はすべて集計対象です。条件の合わない物件は、シートの段階で外してください。
            </p>
          </section>

          {/* ───── 3. 貸主の前提 ───── */}
          <section className="panel">
            <h2>3. 貸主の前提を入れる</h2>
            <p className="hint">結果を見ながら動かしてください。原状回復費用に既定値は置いていません。</p>
            <div className="grid c4">
              <label className="field">
                <span>原状回復費用（円・必須）</span>
                <input type="number" min={0} step={1000} value={restorationCost}
                  onChange={(e) => setRestorationCost(e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))))} />
              </label>
              <label className="field">
                <span>空室期間（ヶ月）</span>
                <select value={vacancyMonths} onChange={(e) => setVacancyMonths(Number(e.target.value) as VacancyMonths)}>
                  {VACANCY_MONTH_CHOICES.map((m) => <option key={m} value={m}>{m}ヶ月</option>)}
                </select>
              </label>
              <label className="field">
                <span>査定賃料の上書き（任意）</span>
                <input type="number" min={0} step={1000} placeholder={assessed?.yen ? String(assessed.yen) : ''} value={override}
                  onChange={(e) => setOverride(e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))))} />
              </label>
              <label className="field">
                <span>提示額（資料の出力に必要）</span>
                <input type="number" min={0} step={1000} value={offerRent}
                  onChange={(e) => setOfferRent(e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))))} />
              </label>
            </div>
            {assessed?.yen && (
              <div className="row-actions" style={{ marginTop: 10 }}>
                <span className="note">提示額の候補（1,000円単位）:</span>
                {roundedOffers(assessed.yen).map((v) => (
                  <button key={v} type="button" className="btn small" onClick={() => setOfferRent(v)}>
                    {v.toLocaleString()}円
                  </button>
                ))}
                <span className="note">
                  算定上の目安は {assessed.yen.toLocaleString()}円。1円単位のまま提示すると、
                  計算の精密さと根拠の確かさが釣り合いません。
                </span>
              </div>
            )}
          </section>

          {/* ───── 4. 結果 ───── */}
          <section className="panel">
            <h2>4. 結果</h2>

            {assessed && assessed.yen === null && <div className="warnbox">{assessed.reason}</div>}

            {assessed?.yen && (
              <div className="stat" style={{ marginBottom: 10 }}>
                <div>
                  <div className="k">査定賃料{assessed.source === 'override' ? '（手入力）' : `（採用${assessed.sampleCount}件の㎡単価中央値 × ${subject.areaSqm}㎡）`}</div>
                  <div className="v">{yen(assessed.yen)}</div>
                </div>
                {assessed.medianRatePerSqm && (
                  <div><div className="k">㎡単価の中央値</div><div className="v">{Math.round(assessed.medianRatePerSqm).toLocaleString()}円/㎡</div></div>
                )}
                <div>
                  <div className="k">現在賃料との差</div>
                  <div className="v">{pct(assessed.yen / currentTotal(subject) - 1)}</div>
                </div>
              </div>
            )}

            {restorationCost === '' && assessed?.yen && (
              <div className="warnbox">原状回復費用を入れると、双方が成立する範囲が出ます。</div>
            )}

            {result && (
              <>
                {result.markdown && (
                  <div className="warnbox">
                    <strong>値下げ局面です。</strong>現在賃料（{yen(result.R0)}）が査定賃料（{yen(result.A)}）を上回っています。
                    上限 r は借主の転居コストによる居座り余地であって、値上げの根拠ではありません。
                    Ver1 は値上げ局面を主な対象としています。
                  </div>
                )}

                {result.range.crossed ? (
                  <div className="warnbox" style={{ borderLeftColor: 'var(--danger)' }}>
                    <strong>この条件では双方が成立しません。</strong>
                    貸主下限（{yen(result.range.floor)}）が借主上限（{yen(result.range.ceiling)}）を上回っています。
                    交渉ではなく、退去を前提に考えるべき状態です。
                  </div>
                ) : (
                  <RScale range={result.range} assessedRent={result.A} offerRent={offerRent === '' ? undefined : offerRent} />
                )}

                <div className="scroll-x" style={{ marginTop: 18 }}>
                  <table className="data">
                    <tbody>
                      <tr>
                        <th>貸主側の下限</th>
                        <td className="num">{yen(result.range.floor)}</td>
                        <td className="num">r = {result.range.rFloor.toFixed(3)}</td>
                        <td className="note">これを下回ると、退去させて再募集したほうが得</td>
                      </tr>
                      <tr>
                        <th>借主側の上限</th>
                        <td className="num">{yen(result.range.ceiling)}</td>
                        <td className="num">r = {result.range.rCeiling.toFixed(3)}</td>
                        <td className="note">現在賃料 × {TENANT_CEILING_FACTOR.toFixed(4)}。これを上回ると、借主は転居したほうが得</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {offerRent !== '' && (
                  <p style={{ marginTop: 14 }}>
                    提示額 <strong>{yen(offerRent)}</strong>（r = {(offerRent / result.A).toFixed(3)}、現在賃料から {pct(offerRent / result.R0 - 1)}）。
                    {result.breakEven === null
                      ? '現在賃料以下のため、借主が転居して得になることはありません。'
                      : <>この額なら <strong>{result.breakEven}ヶ月目</strong>から転居のほうが安くなります
                          {result.breakEven > HORIZON_MONTHS ? `（比較期間${HORIZON_MONTHS}ヶ月の外）` : `（比較期間${HORIZON_MONTHS}ヶ月の内側）`}。</>}
                  </p>
                )}

                <div className="row-actions no-print" style={{ marginTop: 18 }}>
                  <button className="btn" onClick={() => setReport('landlord')} disabled={offerRent === ''}>貸主用の資料</button>
                  <button className="btn" onClick={() => setReport('tenant')} disabled={offerRent === ''}>借主用の資料</button>
                  <button className="btn primary" onClick={() => setReport('prompt')} disabled={offerRent === ''}>
                    借主へ送るメールの下書きを作る
                  </button>
                  {offerRent === '' && <span className="note">提示額を入れると資料を出せます。</span>}
                </div>
              </>
            )}
          </section>

          {/* ───── 置いている仮定 ───── */}
          <section className="panel">
            <h2>この計算が置いている仮定</h2>
            <table className="data">
              <tbody>
                <tr><th>比較期間</th><td>{HORIZON_MONTHS}ヶ月（固定）</td></tr>
                <tr><th>更新料</th><td>新賃料の{RENEWAL_FEE_MONTHS}ヶ月分</td></tr>
                <tr><th>転居費用</th><td>現在賃料の{MOVING_COST_MONTHS}ヶ月分（礼金・仲介料・保証料・鍵交換・保険・引越代の総額）</td></tr>
                <tr><th>転居先の月額</th><td>現在賃料と同額（今の負担で同等の住まいを探す前提）</td></tr>
                <tr><th>賃料</th><td>家賃＋管理費の税込総額</td></tr>
                <tr><th>条件差の補正</th><td>行わない。築年・階・向きの差は利用者がシートの段階で絞り込む</td></tr>
                <tr><th>含めていない費用</th><td>広告費・AD、新規礼金（貸主下限が2〜6%高く出る方向の誤差）</td></tr>
                <tr><th>最低事例数</th><td>{MIN_SAMPLE_COUNT}件（査定賃料を手入力した場合は不問）</td></tr>
                <tr><th>相場並みの帯</th><td>±{FAIR_BAND_PCT}%（表示のみ。計算には影響しない）</td></tr>
              </tbody>
            </table>
            <p className="note" style={{ marginTop: 8 }}>
              各仮定の根拠と、実際の募集図面との差は <code>docs/spec.md</code> 第2章にあります。
            </p>
          </section>
        </>
      )}
    </div>
  )
}
