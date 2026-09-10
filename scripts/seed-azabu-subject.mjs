/**
 * 麻布十番の実データによる通し確認用の案件。
 *
 * 対象物件と比較6件は実際の募集図面から取っている。
 * 現在賃料・更新予定日・引越代は図面に無いため仮定値で、provenance と費目名に明示する。
 * 判定・資料はこの仮定の上に成り立つので、実際の提案には使えない。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'data', 'cases')
const base = JSON.parse(await fs.readFile(path.join(dir, 'azabu-real-listings.json'), 'utf8'))
const yen = (v) => ({ kind: 'fixed', yen: v })
const times = (t, b = 'rent') => ({ kind: 'multiplier', times: t, base: b })

// 転居候補に使う比較物件（面積38.00㎡で対象物件38.10㎡に最も近い）
const target = base.comparables.find((c) => c.property.id === 'maison-higashi-azabu-401')

const c = {
  ...base,
  id: 'azabu-royal-palace',
  title: '麻布十番ロイヤルプレイス 604号室 更新検討（通し確認）',
  comparisonStartDate: '2026-12-01',
  subject: {
    id: 'subject',
    name: '麻布十番ロイヤルプレイス',
    use: 'residential',
    address: '東京都港区麻布十番',
    stations: [{ line: '東京メトロ南北線・都営大江戸線', station: '麻布十番', walkMinutes: 2 }],
    areaSqm: 38.1,
    floor: 6,
    totalFloors: 7,
    provenance: 'entered',
    note: '居住用。事務所使用可のため賃料は課税。金額はすべて税込で入力している。',
  },
  // 図面に無いため仮定値
  currentRent: 210_000,
  currentManagementFee: 0,
  // 実データ: 税込228,800円
  desiredRent: 228_800,
  desiredManagementFee: 0,
  renewal: {
    contractMonths: 24,
    // 比較6件すべてが「更新料 新賃料1ヶ月」だったため同条件とする
    renewalFee: times(1, 'rent'),
    monthly: [], otherOneTime: [], discounts: [], freeRent: [], deposits: [],
    prepaidRent: 0,
  },
  moveCandidates: [{
    id: 'move-maison',
    comparableId: target.property.id,
    label: '転居候補: メゾン東麻布 401号室',
    rent: target.rent,
    managementFee: target.managementFee,
    contractMonths: 24,
    renewalFee: times(1, 'rent'),
    monthly: [],
    oneTime: [
      { id: 'key', label: '鍵交換費用', month: 0, amount: yen(16_200) },
      { id: 'admin', label: '契約事務手数料', month: 0, amount: yen(16_500) },
      { id: 'doc', label: '書類作成代', month: 0, amount: yen(3_300) },
      { id: 'clean', label: '衛生消毒', month: 0, amount: yen(16_500) },
      { id: 'ins', label: '火災保険', month: 0, amount: yen(23_800) },
      { id: 'key2', label: '礼金', month: 0, amount: times(1) },
      { id: 'moving', label: '引越代（仮定値）', month: 0, amount: yen(200_000) },
    ],
    discounts: [], freeRent: [],
    // 敷金2ヶ月。全額返還予定として費用には計上しない
    deposits: [{ id: 'dep', label: '敷金', paidMonth: 0, total: times(2), amortized: yen(0) }],
    prepaidRent: 0,
  }],
  // 貸主の再募集は、対象物件の募集水準と同額・空室2ヶ月を仮定
  relet: { reletMonthlyIncome: 228_800, vacantMonths: 2 },
  updatedAt: new Date().toISOString(),
}

await fs.writeFile(path.join(dir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`)
console.log(`作成: data/cases/${c.id}.json`)
