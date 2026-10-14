import type { Callout, Point } from "../types"
import { normalizeCalloutText } from "./callout-text"

// Операции над списком выносок плана (change add-callout, spec callout): чистые, входной список не меняют;
// changed — изменилось ли что-то, то есть нужен ли шаг истории

export type CalloutEdit = { kind: "new"; id: string; target: Point; at: Point } | { kind: "edit"; id: string }

export interface CalloutResult {
  list: Callout[]
  changed: boolean
}

// Фиксация текста при снятии редактирования: создание (пустой текст выноску не создаёт), правка текста,
// стирание всего текста удаляет выноску
export function commitCallout(list: Callout[], edit: CalloutEdit, rawText: string): CalloutResult {
  const text = normalizeCalloutText(rawText)
  if (edit.kind === "new") {
    if (text === "") return { list, changed: false }
    return { list: [...list, { id: edit.id, target: { ...edit.target }, at: { ...edit.at }, text }], changed: true }
  }
  const found = list.find((c) => c.id === edit.id)
  if (!found) return { list, changed: false }
  if (text === "") return { list: list.filter((c) => c.id !== edit.id), changed: true }
  if (text === found.text) return { list, changed: false }
  return { list: list.map((c) => (c.id === edit.id ? { ...c, text } : c)), changed: true }
}

// Перенос одной точки: привязок и округления нет, точка ровно та, что передана
export function moveCalloutPoint(list: Callout[], id: string, which: "target" | "at", p: Point): CalloutResult {
  const found = list.find((c) => c.id === id)
  if (!found || (found[which].x === p.x && found[which].y === p.y)) return { list, changed: false }
  return { list: list.map((c) => (c.id === id ? { ...c, [which]: { x: p.x, y: p.y } } : c)), changed: true }
}

export function removeCallout(list: Callout[], id: string): CalloutResult {
  if (!list.some((c) => c.id === id)) return { list, changed: false }
  return { list: list.filter((c) => c.id !== id), changed: true }
}
