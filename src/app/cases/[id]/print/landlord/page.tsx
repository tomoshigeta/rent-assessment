import { notFound } from 'next/navigation'
import { readCase } from '@/lib/storage'
import { analyze } from '@/lib/analyze'
import { LandlordReport } from '@/components/print/LandlordReport'

export const dynamic = 'force-dynamic'

export default async function LandlordPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await readCase(id)
  if (!c) notFound()
  return <LandlordReport value={c} analysis={analyze(c)} />
}
