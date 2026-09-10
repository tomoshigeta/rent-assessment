/**
 * 実際の募集図面6件から作った検証用データ（麻布十番エリア・2026年9月）。
 *
 * 仕様書 §9「実際の募集図面で読み取り項目と欠落を確認し、比較物件の採用基準を調整する」
 * のための実データ。図面に記載のない項目は 0 で埋めず「不明」として登録している。
 * 仲介会社の連絡先など物件条件以外の情報は取り込んでいない。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const now = new Date().toISOString()
const unknown = () => ({ kind: 'unknown' })
const yen = (v) => ({ kind: 'fixed', yen: v })
const times = (t, base = 'rent') => ({ kind: 'multiplier', times: t, base })

/** 募集図面から読み取った6件。source に図面のページを残す。 */
const listings = [
  {
    id: 'urban-park-0902', name: 'アーバンパーク麻布十番 0902号室', page: 1,
    address: '東京都港区麻布十番2-12-12', rent: 310_000, mgmt: 10_000, areaSqm: 42.14,
    built: '1999-11', floor: 9, totalFloors: 12,
    stations: [['東京メトロ南北線', '麻布十番', 3], ['東京メトロ日比谷線', '六本木', 14]],
    initial: [
      { label: '敷金', amount: times(1) },
      { label: '礼金', amount: yen(0) },
      { label: '鍵交換費用', amount: yen(38_500) },
      { label: '住宅保険（2年）', amount: yen(21_500) },
      { label: '保証料（初回）', amount: times(0.4) },
    ],
    note: '更新料 新賃料1ヶ月 / 退去時ハウスクリーニング60,500円 / 1年未満解約で賃料1ヶ月の違約金',
  },
  {
    id: 'castalia-705', name: 'カスタリア麻布十番 705号室', page: 2,
    address: '東京都港区麻布十番2-10-1', rent: 280_000, mgmt: 10_000, areaSqm: 42.84,
    built: '2005-09', floor: 7, totalFloors: 7,
    stations: [['東京メトロ南北線', '麻布十番', 3], ['都営大江戸線', '赤羽橋', 13]],
    initial: [
      { label: '敷金', amount: times(1) },
      { label: '礼金', amount: times(1) },
      { label: '鍵交換費', amount: yen(27_500) },
      { label: '損害保険（2年）', amount: yen(22_000) },
      { label: '保証料（初回）', amount: times(0.5) },
    ],
    note: '更新料 新賃料1ヶ月 / 退去時 室内清掃 1㎡あたり1,100円',
  },
  {
    id: 'castalia-603', name: 'カスタリア麻布十番 603号室', page: 5,
    address: '東京都港区麻布十番2-10-1', rent: 241_000, mgmt: 10_000, areaSqm: 36.95,
    built: '2005-09', floor: 6, totalFloors: 7,
    stations: [['東京メトロ南北線', '麻布十番', 3], ['都営大江戸線', '赤羽橋', 13]],
    initial: [
      { label: '敷金', amount: times(1) },
      { label: '礼金', amount: yen(0) },
      { label: '鍵交換費', amount: yen(27_500) },
      { label: '損害保険（2年）', amount: yen(22_000) },
      { label: '保証料（初回）', amount: times(0.5) },
    ],
    note: '更新料 新賃料1ヶ月 / カスタリア705と同一建物',
  },
  {
    id: 'minami-azabu-702', name: '南麻布1-5-8 702号室', page: 7,
    address: '東京都港区南麻布1-5-8', rent: 185_000, mgmt: 0, areaSqm: 39.0,
    built: '1970-01', floor: 7, totalFloors: 7,
    stations: [['東京メトロ南北線', '麻布十番', 4]],
    initial: [
      { label: '敷金', amount: times(2) },
      { label: '礼金', amount: times(1) },
      { label: '仲介手数料', amount: times(1) },
      { label: '鍵交換費', amount: unknown() },
      { label: '火災保険', amount: unknown() },
    ],
    note: '更新料 改定賃料1ヶ月 / 管理費なし / 面積は「契約面積」表記 / 竣工1970年',
  },
  {
    id: 'maison-higashi-azabu-401', name: 'メゾン東麻布 401号室', page: 8,
    address: '東京都港区東麻布2-22-10', rent: 178_000, mgmt: 12_000, areaSqm: 38.0,
    built: '1983-01', floor: 4, totalFloors: 4,
    stations: [['東京メトロ南北線', '麻布十番', 5], ['都営大江戸線', '赤羽橋', 3]],
    initial: [
      { label: '敷金', amount: times(2) },
      { label: '礼金', amount: times(1) },
      { label: '鍵交換費用', amount: yen(16_200) },
      { label: '契約事務手数料', amount: yen(16_500) },
      { label: '書類作成代', amount: yen(3_300) },
      { label: '衛生消毒', amount: yen(16_500) },
      { label: '火災保険', amount: yen(23_800) },
    ],
    note: '更新料1ヶ月 / 24時間保守サービス21,600円 / 築年は年のみ記載',
  },
  {
    id: 'iida-annex-501', name: 'イイダアネックス麻布十番 501号室', page: 9,
    address: '東京都港区東麻布3-7-8', rent: 170_000, mgmt: 5_000, areaSqm: 43.06,
    built: '1992-08', floor: 5, totalFloors: 5,
    stations: [['東京メトロ南北線', '麻布十番', 2], ['都営大江戸線', '赤羽橋', 6]],
    initial: [
      { label: '敷金', amount: times(2) },
      { label: '礼金', amount: times(2) },
      { label: '仲介手数料', amount: times(1) },
      { label: '家財保険（2年）', amount: yen(15_000) },
      { label: '鍵交換代', amount: unknown() },
    ],
    note: '更新料の記載なし（「-----」）/ 2DK / エレベーターなし / 1年未満解約で違約金',
  },
]

const comparables = listings.map((l) => ({
  property: {
    id: l.id,
    name: l.name,
    use: 'residential',
    address: l.address,
    stations: l.stations.map(([line, station, walkMinutes]) => ({ line, station, walkMinutes })),
    areaSqm: l.areaSqm,
    builtYearMonth: l.built,
    floor: l.floor,
    totalFloors: l.totalFloors,
    provenance: 'extracted',
    source: { file: '募集図面.pdf', page: l.page, documentDate: '2026-09-01' },
    note: l.note,
  },
  status: 'adopted',
  reason: '麻布十番駅徒歩5分圏・居住用・面積36〜43㎡',
  rent: l.rent,
  managementFee: l.mgmt,
  initialCosts: l.initial.map((c, i) => ({ id: `${l.id}-${i}`, label: c.label, month: 0, amount: c.amount })),
}))

const c = {
  id: 'azabu-real-listings',
  title: '麻布十番エリア 実図面6件による検証',
  rulesVersion: '0.1.0',
  createdAt: now,
  updatedAt: now,
  // 対象物件は未入力。アプリの「案件登録」タブで入力する。
  subject: {
    id: 'subject', name: '（対象物件を入力してください）', use: 'residential',
    address: '', stations: [], areaSqm: 0, provenance: 'entered',
  },
  currentRent: 0,
  currentManagementFee: 0,
  desiredRent: 0,
  desiredManagementFee: 0,
  comparables,
  renewal: {
    contractMonths: 24,
    renewalFee: times(1, 'rent'),
    monthly: [], otherOneTime: [], discounts: [], freeRent: [], deposits: [],
    prepaidRent: 0,
  },
  moveCandidates: [],
  settings: { horizonMonths: 24, searchHorizonMonths: 120, rounding: 'round' },
  relet: { reletMonthlyIncome: 0, vacantMonths: 2 },
  thresholds: { fairBandPct: 2.5, strongWarningPct: 20, minSampleCount: 5 },
}

const dir = path.join(process.cwd(), 'data', 'cases')
await fs.mkdir(dir, { recursive: true })
await fs.writeFile(path.join(dir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`)
console.log(`作成: data/cases/${c.id}.json（比較物件 ${comparables.length} 件）`)
