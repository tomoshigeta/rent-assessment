/**
 * 借主へ送るメールを AI に書かせるための材料とプロンプトを組み立てる。
 *
 * 文章の判断はアプリの外へ出す。アプリは検証可能な事実だけを並べ、
 * 文面の質と法的な性格の判断は、人が確認したうえで AI に任せる。
 *
 * 貸主側の数字（貸主下限・掛け目 r・原状回復費用・空室期間・借主の転居負担）は
 * 一切含めない。渡した情報は「書かないで」と指示しても文面に滲み出るため、
 * 最初から入れない（docs/spec.md 第5章）。
 */
import { monthlyTotal, currentTotal, type Listing, type Subject } from './types'
import { ratePerSqm, validateListing, type AssessedRent } from './assess'

const yen = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}円`

/** 年月から現在までの経過期間を「1年9ヶ月」の形で返す。年に丸めると実態より短く見える。 */
export function elapsedSince(yearMonth?: string, now = new Date()): string | null {
  if (!yearMonth) return null
  const [y, m] = yearMonth.split('-').map(Number)
  if (!Number.isFinite(y)) return null
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - (Number.isFinite(m) ? m : 1))
  if (months < 0) return null
  const yy = Math.floor(months / 12), mm = months % 12
  if (yy === 0) return `${mm}ヶ月`
  return mm === 0 ? `${yy}年` : `${yy}年${mm}ヶ月`
}

/** 差出人の立場。文面の主語が変わる。 */
export type SenderRole = 'agency' | 'landlord'
/** 借主の敬称。法人なら御中、個人なら様。 */
export type Honorific = 'corporate' | 'individual'

export interface PromptInput {
  subject: Subject
  listings: Listing[]
  assessed: AssessedRent
  /** 貸主が決めた提示額（月額総額）。丸めた後の額を渡す。 */
  offerRent: number
  senderRole?: SenderRole
  honorific?: Honorific
  /** 分かっていればプロンプトに埋め込む。未指定なら【　】のまま残す。 */
  tenantName?: string
  effectiveFrom?: string
  replyBy?: string
  senderContact?: string
}

/** 借主に説明してよい事実だけを並べた材料。 */
export function buildMaterial({ subject, listings, assessed, offerRent }: PromptInput): string {
  const usable = listings.filter((l) => validateListing(l).every((i) => !i.blocking))
  const R0 = currentTotal(subject)
  const diff = offerRent - R0
  const held = elapsedSince(subject.previousRenewalOn)

  const L: string[] = []
  L.push('■ 対象住戸')
  L.push(`  名称        ${subject.name}`)
  if (subject.address) L.push(`  所在地      ${subject.address}`)
  if (subject.station) L.push('  交通        ' + `${subject.line ?? ''} ${subject.station}${subject.walkMinutes ? ` 徒歩${subject.walkMinutes}分` : ''}`.trim())
  L.push(`  面積        ${subject.areaSqm}㎡`)
  if (subject.layout) L.push(`  間取り      ${subject.layout}`)
  if (subject.builtYearMonth) L.push(`  築年月      ${subject.builtYearMonth}`)
  if (subject.floor) L.push(`  所在階      ${subject.floor}階`)
  if (subject.contractUse) L.push(`  契約用途    ${subject.contractUse}`)
  if (subject.renovatedOn || subject.renovationNote) {
    L.push(`  改装        ${[subject.renovatedOn, subject.renovationNote].filter(Boolean).join(' ')}`)
  }
  if (subject.furnished) L.push(`  家具        ${subject.furnished}`)

  L.push('', '■ 現在の条件と提示する条件')
  L.push(`  現在の賃料  月額 ${yen(R0)}（家賃 ${yen(subject.currentRent)}／管理費 ${yen(subject.currentManagementFee)}・税込）`)
  L.push(`  提示する賃料 月額 ${yen(offerRent)}（家賃 ${yen(offerRent - subject.currentManagementFee)}／管理費 ${yen(subject.currentManagementFee)}・税込）`)
  L.push(`  差額        ${diff >= 0 ? '+' : ''}${yen(diff)}（${diff >= 0 ? '+' : ''}${((diff / R0) * 100).toFixed(1)}%）`)
  // 現在も提示も0円なら「据え置き」に意味がなく、文面に不自然な一文を生む
  if (subject.currentManagementFee > 0) L.push('  管理費      据え置き（現在と同額）')
  if (subject.previousRenewalOn) {
    L.push(`  前回更新    ${subject.previousRenewalOn}${held !== null ? `（現在の賃料は${held}のあいだ据え置き）` : ''}`)
  }

  L.push('', '■ 提示額の導き方')
  if (assessed.source === 'override') {
    L.push('  査定は別途行ったものを用いている。周辺事例は下記のとおり。')
  } else {
    L.push(`  1. 周辺で現在募集中の${usable.length}件を、面積あたりの月額単価に換算した`)
    L.push(`  2. その中央値は 1㎡あたり ${Math.round(assessed.medianRatePerSqm ?? 0).toLocaleString()}円`)
    L.push(`  3. 対象住戸の${subject.areaSqm}㎡に当てはめた水準を目安とした`)
    L.push(`  4. その目安を踏まえ、貸主が ${yen(offerRent)} を提示額として決めた`)
  }

  L.push('', `■ 根拠とした周辺の募集条件（${usable.length}件）`)
  for (const l of usable) {
    L.push(`  ・${l.name}`)
    L.push(`      ${l.areaSqm}㎡ ／ 月額 ${yen(monthlyTotal(l))}（家賃 ${yen(l.rent)}＋管理費 ${yen(l.managementFee)}）／ ${Math.round(ratePerSqm(l)).toLocaleString()}円/㎡`)
    const spec = [
      l.station ? `${l.line ?? ''} ${l.station}${l.walkMinutes ? ` 徒歩${l.walkMinutes}分` : ''}`.trim() : null,
      l.builtYearMonth ? `${l.builtYearMonth}築` : null,
      l.floor ? `${l.floor}階` : null,
    ].filter(Boolean).join(' ／ ')
    if (spec) L.push(`      ${spec}`)
    L.push(`      募集元 ${l.sourceAgency}（${l.confirmedOn} 確認）${l.sourceRef ? ` ${l.sourceRef}` : ''}`)
    if (l.similarity) L.push(`      共通点: ${l.similarity}`)
    if (l.difference) L.push(`      賃料差の要因: ${l.difference}`)
  }

  // 根拠の限界。反論に先回りするために、書く側が把握しておくべきこと。
  const rates = usable.map(ratePerSqm)
  L.push('', '■ この根拠の限界（説明する側が把握しておくこと）')
  if (rates.length > 0) {
    L.push(`  ・${usable.length}件の㎡単価は ${Math.round(Math.min(...rates)).toLocaleString()}〜${Math.round(Math.max(...rates)).toLocaleString()}円と幅がある`)
  }
  L.push('  ・築年・階数・向き・設備の差は補正していない。面積差のみ揃えた')
  L.push('  ・募集条件であって、成約賃料ではない')
  L.push('  ・比較対象は貸主側が選定したものであり、網羅的な調査ではない')
  if (usable.length < listings.length) {
    L.push(`  ・記入内容に不備があった${listings.length - usable.length}件は集計から除いている`)
  }
  return L.join('\n')
}

const SLOT = (label: string, value?: string) => value?.trim() || `【${label}】`

/** そのまま貼れるプロンプト一式。 */
export function buildPrompt(input: PromptInput): string {
  const role = input.senderRole === 'landlord'
    ? '貸主本人が借主へ送るメール'
    : '管理会社の担当者が、貸主に代わって借主へ送るメール'
  const honor = input.honorific === 'individual'
    ? '借主は個人。宛名は「様」を付ける。'
    : '借主は法人。宛名は「御中」を付ける。'

  const slots = [
    `  借主名          ${SLOT('借主氏名', input.tenantName)}`,
    `  改定開始希望日  ${SLOT('改定開始希望日', input.effectiveFrom)}`,
    `  回答希望日      ${SLOT('回答希望日', input.replyBy)}`,
    `  差出人          ${SLOT('担当者名・会社名・連絡先', input.senderContact)}`,
  ].join('\n')

  return `${role}の文面を作成してください。賃貸借契約の更新実務に通じた立場で書きます。

# 何より大事なこと：短く書く

**本文は15行程度に収める。** 読み手は借主で、長い説明は途中で読まれない。

比較の方法、面積あたりの単価、根拠の限界は**すべて添付資料に書いてある。**
本文で繰り返さない。「比較した物件と算出の考え方は添付の資料にまとめております」の
一文で添付へ渡す。

本文に入れるのはこれだけ。

  1. 何の件か（物件名と、いつからの賃料の話か）
  2. 現在いくらで、いくらにしたいか（金額を並べる。差額も書く）
  3. なぜか（1〜2文。据え置き期間と、周辺と比較したことに触れる程度）
  4. 詳細は添付にある、という一文
  5. 金額には相談の余地があること
  6. いつまでに返事がほしいか
  7. 署名

# 守ること

- **協議の申し入れとして書く。** 一方的な決定の通知と読める表現にしない。
- **相手が反論する余地を残す。**
- **法令の解釈には立ち入らない。** 条文の引用や、法的効果の断定をしない。
- **下記の材料にない数字を書かない。** 推測で補わない。
- 比較事例の一覧は本文に入れない。添付に委ねる。
- ${honor}

# 差し込む値

${slots}

【　】が残っている項目は、そのまま【　】で出力してください。送信前に担当者が埋めます。

# 出力

件名と本文。装飾記号や見出し記号は使わず、そのままメールに貼れる形で。

---

${buildMaterial(input)}

---

なお、この文面は送信前に貸主または管理会社が内容を確認する前提です。
増額の可否や文面の法的な性格についての判断は、確認する側が行います。`
}

/** 提示額の候補。1,000円単位に丸める（docs/spec.md 第2章）。 */
export function roundedOffers(assessedRent: number): number[] {
  const down = Math.floor(assessedRent / 1000) * 1000
  const up = Math.ceil(assessedRent / 1000) * 1000
  return [...new Set([down, up])].filter((v) => v > 0)
}
