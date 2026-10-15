import { normalizeNotes } from "./notes-store"

// Применение правки примечаний из панели (change add-plan-notes, design D4): чистая функция, входной список не меняет;
// changed — изменился ли список, то есть нужен ли шаг истории

export interface NotesResult {
  list: string[]
  changed: boolean
}

export function applyNotesText(current: readonly string[], rawText: string): NotesResult {
  const next = normalizeNotes(rawText)
  const same = next.length === current.length && next.every((item, i) => item === current[i])
  return same ? { list: [...current], changed: false } : { list: next, changed: true }
}

// текст поля панели для списка плана: один пункт — одна строка
export const notesText = (list: readonly string[]): string => list.join("\n")
