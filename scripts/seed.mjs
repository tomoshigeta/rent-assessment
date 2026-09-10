/**
 * 動作確認用の案件を1件作る。
 * 費用条件は仕様書 §5「基本の確認例」に合わせてあり、結果画面で
 * 24ヶ月同額・25ヶ月逆転が出ることを目で確かめられる。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const MAN = 10000
const now = new Date().toISOString()

const station = (s, w) => ({ station: s, walkMinutes: w })
const prop = (id, name, over = {}) => ({
  id, name, use: 'residential',
  address: '東京都杉並区高円寺南3-1-1',
  stations: [station('高円寺', 7)],
  areaSqm: 42.5,
  builtYearMonth: '2011-03',
  floor: 3, totalFloors: 8,
  provenance: 'entered',
  ...over,
})

// 家賃＋管理費の月額総額の中央値が 22万円ちょうどになる8件
const comparableRents = [
  [208_000, 8_000], [212_000, 8_000], [214_000, 6_000], [215_000, 5_000],
  [217_000, 8_000], [220_000, 10_000], [224_000, 9_000], [228_000, 7_000],
]

const c = {
  id: 'sample-koenji-302',
  title: '高円寺サンプルレジデンス 302号室 2026年11月更新',
  rulesVersion: '0.1.0',
  createdAt: now,
  updatedAt: now,
  comparisonStartDate: '2026-11-01',
  subject: prop('subject', '高円寺サンプルレジデンス', { roomNumber: '302' }),
  currentRent: 205_000,
  currentManagementFee: 8_000,
  desiredRent: 220_000,
  desiredManagementFee: 0,
  comparables: comparableRents.map(([rent, mgmt], i) => ({
    property: prop(`cmp-${i + 1}`, `比較物件${i + 1}`, {
      areaSqm: 40 + i * 0.5,
      stations: [station(i < 5 ? '高円寺' : '中野', 6 + (i % 4))],
      builtYearMonth: `20${10 + (i % 5)}-0${1 + (i % 6)}`,
      floor: 2 + (i % 6),
    }),
    status: 'adopted',
    reason: '同一駅・徒歩10分圏、面積差5%以内',
    rent, managementFee: mgmt,
    initialCosts: [
      { id: `key-${i}`, label: '礼金', month: 0, amount: { kind: 'multiplier', times: 1, base: 'rent' } },
    ],
  })),
  // §5 の確認例: 更新 月22万・開始費20万
  renewal: {
    contractMonths: 24,
    renewalFee: { kind: 'fixed', yen: 0 },
    monthly: [],
    otherOneTime: [{ id: 'start', label: '更新事務手数料等', month: 0, amount: { kind: 'fixed', yen: 20 * MAN } }],
    discounts: [], freeRent: [], deposits: [], prepaidRent: 0,
  },
  // §5 の確認例: 転居 月21万・開始費44万
  moveCandidates: [{
    id: 'move-1',
    comparableId: 'cmp-1',
    label: '転居候補A（比較物件1）',
    rent: 210_000,
    managementFee: 0,
    contractMonths: 24,
    renewalFee: { kind: 'fixed', yen: 0 },
    monthly: [],
    oneTime: [{ id: 'start', label: '礼金・仲介料・引越代', month: 0, amount: { kind: 'fixed', yen: 44 * MAN } }],
    discounts: [], freeRent: [],
    deposits: [{ id: 'dep', label: '敷金', paidMonth: 0, total: { kind: 'fixed', yen: 42 * MAN }, amortized: { kind: 'fixed', yen: 0 } }],
    prepaidRent: 0,
  }],
  settings: { horizonMonths: 24, searchHorizonMonths: 120, rounding: 'round' },
  relet: { reletMonthlyIncome: 210_000, vacantMonths: 2 },
  thresholds: { fairBandPct: 2.5, strongWarningPct: 20, minSampleCount: 5 },
}

const dir = path.join(process.cwd(), 'data', 'cases')
await fs.mkdir(dir, { recursive: true })
await fs.writeFile(path.join(dir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`)
console.log(`作成: data/cases/${c.id}.json`)
