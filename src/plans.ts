import type { Tool } from "./doorway/openings-group"
import type { Drawing } from "./types"

// Каталог планов чертежа (change drawing-plans, design D2): единственное место, где определено, какие планы есть.
// Порядок каталога — порядок кнопок переключателя и страниц PDF.
export const PLANS = [
  { id: "measure", label: "Обмерочный план" },
  { id: "demolition", label: "Демонтаж" },
  { id: "mounting", label: "Монтаж" },
  { id: "rough", label: "Черновые работы" },
  { id: "reconstruction", label: "Реконструкция" },
  { id: "furniture", label: "Мебель" },
  { id: "plumbing", label: "Сантехника" },
  { id: "ceiling", label: "Потолки и освещение" },
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
  // «Примечания» (change add-plan-notes, design D4) — на каждом плане, сразу после «Линейки»
  measure: ["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "notes", "eraser"],
  demolition: ["demolition", "callout", "ruler", "notes", "eraser"],
  // «Монтаж» (change mounting-plan, design D5): набор обмерочного плана
  mounting: ["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "notes", "eraser"],
  // «Черновые работы» (change add-rough-works-plan, design D8): штукатурка и стяжка поверх подложки «Монтажа»
  // «Прямой угол» (change plaster-right-angle, design D4) — сразу после «Штукатурки»
  rough: ["plaster", "rightAngle", "screed", "callout", "ruler", "notes", "eraser"],
  // «Реконструкция» (change reconstruction-plan, design D9): стены гипсокартона поверх подложки «Черновых работ»
  reconstruction: ["drywall", "dimension", "callout", "ruler", "notes", "eraser"],
  // «Мебель» (change furniture-plan-table, design D1): столы поверх подложки «Реконструкции»; «Стол» — в группе «Мебель»
  furniture: ["furniture", "dimension", "callout", "ruler", "notes", "eraser"],
  // «Сантехника» (change add-plumbing-plan, design D1): приборы «Мебели» — подложка, своих предметов нет; по умолчанию «Размер»
  plumbing: ["dimension", "callout", "ruler", "notes", "eraser"],
  // «Потолки и освещение» (change add-ceiling-plan, design D1): натяжные потолки поверх результата «Мебели»; размеров нет
  // группа «Освещение» (change add-ceiling-lighting, design D7) — один инструмент, вид объекта выбирается в панели группы
  // «Линия освещения» (change add-light-lines), «Выключатель» (change add-light-switch) и «Вытяжка» (change add-exhaust-fan) перешли на этот
  // план из плана «Группы включения», слитого с ним (change merge-lighting-plans, design D7)
  ceiling: ["stretchCeiling", "light", "lightLine", "lightSwitch", "exhaust", "callout", "ruler", "notes", "eraser"],
}

export const toolsOf = (plan: PlanId): readonly Tool[] => PLAN_TOOLS[plan]

export const defaultToolOf = (plan: PlanId): Tool => PLAN_TOOLS[plan][0]
