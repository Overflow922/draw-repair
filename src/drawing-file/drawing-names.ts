import type { Drawing } from "../types"

// Имена файла чертежа и загруженной вкладки (change export-import-drawing-file, design D3, D9)

const DEFAULT_NAME = "Чертёж"

// недопустимые в именах файлов символы и управляющие символы заменяются на «_»; пробелы и точки по краям отбрасываются
// (имя с точкой на конце недопустимо в Windows); пустое имя — имя по умолчанию
export function drawingFileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^[\s.]+|[\s.]+$/g, "")
  return `${safe === "" ? DEFAULT_NAME : safe}.json`
}

// «Кухня» → «Кухня (2)», «Кухня (3)»…: первое имя, не совпадающее с занятыми
export function uniqueDrawingName(name: string, used: ReadonlySet<string>): string {
  if (!used.has(name)) return name
  for (let n = 2; ; n++) if (!used.has(`${name} (${n})`)) return `${name} (${n})`
}

// чертёж из файла становится новой вкладкой: новый идентификатор и имя, уникальное среди открытых чертежей;
// идентификатор задаётся снаружи, чтобы функция оставалась чистой
export function adoptDrawing(drawing: Drawing, used: ReadonlySet<string>, id: string): Drawing {
  return { ...drawing, id, name: uniqueDrawingName(drawing.name, used) }
}
