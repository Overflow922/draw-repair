import type { Drawing } from "./types"

// Каталог планов чертежа (change drawing-plans, design D2): единственное место, где определено, какие планы есть.
// Порядок каталога — порядок кнопок переключателя и страниц PDF.
export const PLANS = [{ id: "measure", label: "Обмерочный план" }] as const

export type PlanId = (typeof PLANS)[number]["id"]

export const DEFAULT_PLAN: PlanId = "measure"

export const isPlanId = (value: unknown): value is PlanId => PLANS.some((p) => p.id === value)

// активный план чертежа: нет поля или значение вне каталога — план по умолчанию
export const activePlanOf = (drawing: Drawing): PlanId => (isPlanId(drawing.activePlan) ? drawing.activePlan : DEFAULT_PLAN)

// ключ истории плана: у обмерочного плана прежний ключ — идентификатор чертежа (история читается без миграции)
export const historyKey = (drawingId: string, plan: PlanId): string => (plan === DEFAULT_PLAN ? drawingId : `${drawingId}:${plan}`)
