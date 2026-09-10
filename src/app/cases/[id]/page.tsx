import { notFound } from 'next/navigation'
import { readCase } from '@/lib/storage'
import { removeCase } from '@/lib/actions'
import { CaseWorkspace } from '@/components/CaseWorkspace'

export const dynamic = 'force-dynamic'

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await readCase(id)
  if (!c) notFound()
  return (
    <>
      <CaseWorkspace initial={c} />
      <div className="wrap no-print" style={{ paddingTop: 0 }}>
        <form action={removeCase}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn small" type="submit">この案件を削除</button>
        </form>
      </div>
    </>
  )
}
