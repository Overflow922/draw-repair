import type { PlanId } from "../plans"
import type { Drawing } from "../types"

// Примечания планов (change add-plan-notes, design D1, D2): единственное место, знающее, где какой план хранит свой список,
// и единственная нормализация текста примечаний — и для ввода из панели, и для загрузки из хранилища.

export const NOTES_MAX_ITEMS = 15
export const NOTES_MAX_LENGTH = 300

// пункты из текста поля: одна строка = один пункт; строки обрезаются по пробелам, пустые отбрасываются, длина и число ограничены
export function normalizeNotes(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim().slice(0, NOTES_MAX_LENGTH).trim())
    .filter((line) => line !== "")
    .slice(0, NOTES_MAX_ITEMS)
}

// список документа: не строки отбрасываются, остальное нормализуется как текст поля
export const normalizeNoteList = (raw: readonly unknown[]): string[] =>
  normalizeNotes(raw.filter((x): x is string => typeof x === "string").join("\n"))

export const isNoteList = (raw: unknown): raw is string[] => Array.isArray(raw) && raw.every((x) => typeof x === "string")

// поле документа: массив читается нормализованным, всё остальное — как отсутствующее поле
export const loadNoteList = (raw: unknown): string[] | undefined => (Array.isArray(raw) ? normalizeNoteList(raw) : undefined)

export const notesOf = (drawing: Drawing, plan: PlanId): string[] => {
  if (plan === "measure") return drawing.notes ?? []
  if (plan === "demolition") return drawing.demolitionNotes ?? []
  if (plan === "rough") return drawing.roughNotes ?? []
  if (plan === "reconstruction") return drawing.reconstruction?.notes ?? []
  return drawing.mounting?.notes ?? []
}

// новый чертёж с заменённым списком примечаний плана; остальные поля и списки других планов те же
export function withNotes(drawing: Drawing, plan: PlanId, list: string[]): Drawing {
  if (plan === "measure") return { ...drawing, notes: list }
  if (plan === "demolition") return { ...drawing, demolitionNotes: list }
  if (plan === "rough") return { ...drawing, roughNotes: list }
  if (plan === "reconstruction") return { ...drawing, reconstruction: { ...(drawing.reconstruction ?? { walls: [], dimensions: [] }), notes: list } }
  const mounting = drawing.mounting ?? { walls: [], dimensions: [] }
  return { ...drawing, mounting: { ...mounting, notes: list } }
}
