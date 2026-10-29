import { isDrawing, readDrawing } from "../storage"
import { adoptDrawing } from "./drawing-names"
import type { Drawing } from "../types"

// Файл чертежа (change export-import-drawing-file, design D1): конверт с признаком формата и версией формата файла,
// отдельной от версии документа хранилища; чертёж внутри — того же вида, что в документе хранилища версии 3.

const FORMAT = "draw-repair-drawing"
const VERSION = 1

export type DrawingFileError = "not-json" | "not-drawing-file" | "corrupted" | "newer-version"

export type DrawingFileResult =
  | { ok: true; drawing: Drawing }
  | { ok: false; reason: DrawingFileError }

const ERROR_MESSAGES: Record<DrawingFileError, string> = {
  "not-json": "Файл не является файлом чертежа.",
  "not-drawing-file": "Файл не является файлом чертежа.",
  corrupted: "Файл чертежа повреждён.",
  "newer-version": "Файл создан более новой версией программы.",
}

export const drawingFileErrorMessage = (reason: DrawingFileError): string => ERROR_MESSAGES[reason]

export function serializeDrawingFile(drawing: Drawing): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, drawing }, null, 2)
}

// загрузка файла новой вкладкой: прочитанный чертёж получает новый идентификатор и имя, уникальное среди открытых
export function importDrawingFile(raw: string, usedNames: ReadonlySet<string>, id: string): DrawingFileResult {
  const result = parseDrawingFile(raw)
  return result.ok ? { ok: true, drawing: adoptDrawing(result.drawing, usedNames, id) } : result
}

export function parseDrawingFile(raw: string): DrawingFileResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, reason: "not-json" }
  }
  if (typeof data !== "object" || data === null || !("format" in data) || data.format !== FORMAT) {
    return { ok: false, reason: "not-drawing-file" }
  }
  const version = "version" in data ? data.version : undefined
  if (typeof version === "number" && version > VERSION) return { ok: false, reason: "newer-version" }
  const drawing = "drawing" in data ? data.drawing : undefined
  if (version !== VERSION || !isDrawing(drawing)) return { ok: false, reason: "corrupted" }
  return { ok: true, drawing: readDrawing(drawing) }
}
