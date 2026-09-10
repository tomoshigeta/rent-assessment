import { z } from 'zod'
import { RULES_VERSION } from '@/core'
import type { Case } from '@/core'

const yenSchema = z.number().finite()

const amountSchema = z.union([
  z.object({ kind: z.literal('fixed'), yen: yenSchema }),
  z.object({ kind: z.literal('multiplier'), times: z.number().finite(), base: z.enum(['rent', 'rentPlusManagement']) }),
  z.object({ kind: z.literal('unknown') }),
])

const monthlyItemSchema = z.object({ id: z.string(), label: z.string(), amount: amountSchema })
const oneTimeItemSchema = z.object({ id: z.string(), label: z.string(), month: z.number().int().min(0), amount: amountSchema })
const discountItemSchema = oneTimeItemSchema
const recurringItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  amount: amountSchema,
  schedule: z.union([
    z.object({ kind: z.literal('months'), months: z.array(z.number().int().min(0)) }),
    z.object({ kind: z.literal('renewal'), contractMonths: z.number().int().min(1), includeStart: z.boolean() }),
  ]),
})
const freeRentItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  months: z.array(z.number().int().min(0)),
  target: z.enum(['rent', 'rentAndManagement']),
})
const depositItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  paidMonth: z.number().int().min(0),
  total: amountSchema,
  amortized: amountSchema,
  refundMonth: z.number().int().min(0).optional(),
})

const propertySchema = z.object({
  id: z.string(),
  name: z.string(),
  use: z.literal('residential'),
  address: z.string(),
  buildingName: z.string().optional(),
  roomNumber: z.string().optional(),
  stations: z.array(z.object({
    line: z.string().optional(),
    station: z.string(),
    walkMinutes: z.number().finite().min(0),
  })),
  areaSqm: z.number().finite().min(0),
  areaRaw: z.string().optional(),
  builtYearMonth: z.string().optional(),
  buildingAgeYears: z.number().finite().min(0).optional(),
  floor: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  provenance: z.enum(['extracted', 'confirmed', 'entered', 'assumed', 'unknown']),
  source: z.object({
    file: z.string().optional(),
    page: z.number().int().optional(),
    rawText: z.string().optional(),
    documentDate: z.string().optional(),
  }).optional(),
  note: z.string().optional(),
})

const comparableSchema = z.object({
  property: propertySchema,
  status: z.enum(['adopted', 'reference', 'excluded']),
  reason: z.string().optional(),
  rent: yenSchema,
  managementFee: yenSchema,
  initialCosts: z.array(oneTimeItemSchema),
})

const renewalPlanSchema = z.object({
  contractMonths: z.number().int().min(1),
  renewalFee: amountSchema,
  monthly: z.array(monthlyItemSchema),
  otherOneTime: z.array(oneTimeItemSchema),
  discounts: z.array(discountItemSchema),
  freeRent: z.array(freeRentItemSchema),
  deposits: z.array(depositItemSchema),
  prepaidRent: yenSchema,
})

const moveCandidateSchema = z.object({
  id: z.string(),
  comparableId: z.string(),
  label: z.string(),
  rent: yenSchema,
  managementFee: yenSchema,
  contractMonths: z.number().int().min(1),
  renewalFee: amountSchema,
  monthly: z.array(monthlyItemSchema),
  oneTime: z.array(oneTimeItemSchema),
  discounts: z.array(discountItemSchema),
  freeRent: z.array(freeRentItemSchema),
  deposits: z.array(depositItemSchema),
  prepaidRent: yenSchema,
})

export const caseSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  rulesVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  comparisonStartDate: z.string().optional(),
  subject: propertySchema,
  currentRent: yenSchema,
  currentManagementFee: yenSchema,
  desiredRent: yenSchema,
  desiredManagementFee: yenSchema,
  alternativeRent: yenSchema.optional(),
  comparables: z.array(comparableSchema),
  renewal: renewalPlanSchema,
  moveCandidates: z.array(moveCandidateSchema),
  settings: z.object({
    // 仕様書 §3: 1〜120ヶ月
    horizonMonths: z.number().int().min(1).max(120),
    searchHorizonMonths: z.number().int().min(1).max(120),
    rounding: z.enum(['round', 'ceil', 'floor']),
  }),
  relet: z.object({
    reletMonthlyIncome: yenSchema,
    vacantMonths: z.number().int().min(0),
  }),
  thresholds: z.object({
    fairBandPct: z.number().finite().min(0),
    strongWarningPct: z.number().finite().min(0),
    minSampleCount: z.number().int().min(1),
  }),
  selectedOfferRent: yenSchema.optional(),
})
  .refine((c) => c.settings.searchHorizonMonths >= c.settings.horizonMonths, {
    message: '探索範囲は比較期間以上である必要があります',
    path: ['settings', 'searchHorizonMonths'],
  })
  .refine((c) => c.thresholds.strongWarningPct >= c.thresholds.fairBandPct, {
    message: '強い警告の閾値は妥当とする幅以上である必要があります',
    path: ['thresholds', 'strongWarningPct'],
  })

export type ParsedCase = z.infer<typeof caseSchema>

/** unknown を Case として検証する。壊れた保存ファイルを黙って読まないための境界。 */
export function parseCase(value: unknown): Case {
  return caseSchema.parse(value) as Case
}

export { RULES_VERSION }
