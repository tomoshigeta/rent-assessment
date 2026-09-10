import { notFound } from 'next/navigation'
import { readCase } from '@/lib/storage'
import { analyze } from '@/lib/analyze'
import { TenantReport } from '@/components/print/TenantReport'

export const dynamic = 'force-dynamic'

export default async function TenantPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await readCase(id)
  if (!c) notFound()
  return <TenantReport value={c} analysis={analyze(c)} />
}
