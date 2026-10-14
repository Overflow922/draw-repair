import type { Tool } from "./doorway/openings-group"
import type { Drawing } from "./types"

// Каталог планов чертежа (change drawing-plans, design D2): единственное место, где определено, какие планы есть.
// Порядок каталога — порядок кнопок переключателя и страниц PDF.
export const PLANS = [
  { id: "measure", label: "Обмерочный план" },
  { id: "demolition", label: "Демонтаж" },
  { id: "mounting", label: "Монтаж" },
] as const

export type PlanId = (typeof PLANS)[number]["id"]

export const DEFAULT_PLAN: PlanId = "measure"

export const isPlanId = (value: unknown): value is PlanId => PLANS.some((p) => p.id === value)

// активный план чертежа: нет поля или значение вне каталога — план по умолчанию
export const activePlanOf = (drawing: Drawing): PlanId => (isPlanId(drawing.activePlan) ? drawing.activePlan : DEFAULT_PLAN)

// ключ истории плана: у обмерочного плана прежний ключ — идентификатор чертежа (история читается без миграции)
export const historyKey = (drawingId: string, plan: PlanId): string => (plan === DEFAULT_PLAN ? drawingId : `${drawingId}:${plan}`)

// Инструменты плана (change demolition-plan, design D1): первый в наборе — инструмент по умолчанию
const PLAN_TOOLS: Record<PlanId, readonly [Tool, ...Tool[]]> = {
  // группа «Коммуникации» (change add-communications, design D9) — только на обмерочном плане
  measure: ["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "eraser"],
  demolition: ["demolition", "callout", "ruler", "eraser"],
  // «Монтаж» (change mounting-plan, design D5): набор обмерочного плана
  mounting: ["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "eraser"],
}

export const toolsOf = (plan: PlanId): readonly Tool[] => PLAN_TOOLS[plan]

export const defaultToolOf = (plan: PlanId): Tool => PLAN_TOOLS[plan][0]
