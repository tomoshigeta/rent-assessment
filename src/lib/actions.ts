'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { emptyRenewalPlan, DEFAULT_SETTINGS, DEFAULT_THRESHOLDS, RULES_VERSION, type Case } from '@/core'
import { parseCase } from './schema'
import { deleteCase, writeCase } from './storage'

function newId() {
  return `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function createCase(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim() || '無題の案件'
  const now = new Date().toISOString()
  const c: Case = {
    id: newId(),
    title,
    rulesVersion: RULES_VERSION,
    createdAt: now,
    updatedAt: now,
    subject: {
      id: 'subject',
      name: '',
      use: 'residential',
      address: '',
      stations: [],
      areaSqm: 0,
      provenance: 'entered',
    },
    currentRent: 0,
    currentManagementFee: 0,
    desiredRent: 0,
    desiredManagementFee: 0,
    comparables: [],
    renewal: emptyRenewalPlan(),
    moveCandidates: [],
    settings: DEFAULT_SETTINGS,
    relet: { reletMonthlyIncome: 0, vacantMonths: 0 },
    thresholds: DEFAULT_THRESHOLDS,
  }
  await writeCase(c)
  revalidatePath('/')
  redirect(`/cases/${c.id}`)
}

export async function saveCase(json: string): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  try {
    const parsed = parseCase(JSON.parse(json))
    const saved = await writeCase(parsed)
    revalidatePath('/')
    revalidatePath(`/cases/${saved.id}`)
    return { ok: true, updatedAt: saved.updatedAt }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function removeCase(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (id) await deleteCase(id)
  revalidatePath('/')
  redirect('/')
}
