import { listCases } from '@/lib/storage'
import { createCase } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cases = await listCases()
  return (
    <div className="wrap">
      <section className="panel">
        <h2>新しい案件</h2>
        <p className="hint">対象物件の更新賃料を検討します。案件ごとに入力・設定・計算結果を保存します。</p>
        <form action={createCase} style={{ display: 'flex', gap: 10 }}>
          <input type="text" name="title" placeholder="案件名（例: ○○マンション 302号室 2026年11月更新）" />
          <button className="btn primary" type="submit" style={{ whiteSpace: 'nowrap' }}>作成</button>
        </form>
      </section>

      <section className="panel">
        <h2>案件一覧（{cases.length}件）</h2>
        {cases.length === 0 ? (
          <p className="note">まだ案件がありません。</p>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>案件名</th>
                  <th>対象物件</th>
                  <th className="num">希望額（月額総額）</th>
                  <th className="num">比較期間</th>
                  <th>更新日時</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td><a href={`/cases/${c.id}`}>{c.title}</a></td>
                    <td>{c.subject.name || '—'}</td>
                    <td className="num">{(c.desiredRent + c.desiredManagementFee).toLocaleString('ja-JP')}円</td>
                    <td className="num">{c.settings.horizonMonths}ヶ月</td>
                    <td>{new Date(c.updatedAt).toLocaleString('ja-JP')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
