import { describe, expect, it } from "vitest"
import { drawingFileErrorMessage, importDrawingFile, parseDrawingFile, serializeDrawingFile } from "./drawing-file"
import { serializeStore } from "../storage"
import type { Drawing } from "../types"

// change export-import-drawing-file: формат файла чертежа (spec drawing-file «Формат файла чертежа», «Повреждённое содержимое
// файла», «Отклонение нечитаемого файла», «Сохранение и загрузка без потерь»).

const VIEW = { zoom: 2, pan: { x: -10, y: 20 } }

// чертёж с содержимым нескольких планов: обмер, демонтаж, мебель, группы включения
const richDrawing: Drawing = {
  id: "d1",
  name: "Кухня",
  walls: [
    { id: "w1", a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thicknessCm: 20, type: "brick" },
    { id: "w2", a: { x: 400, y: 0 }, b: { x: 400, y: 300 }, thicknessCm: 20, type: "brick" },
  ],
  dimensions: [{
    from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
    to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
    offset: 30,
  }],
  doorways: [
    { id: "o1", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 },
    { kind: "window", id: "o2", wallId: "w1", anchor: "b", offsetCm: 60, widthCm: 120, heightCm: 150, sillCm: 85 },
    { kind: "door", id: "o3", wallId: "w2", anchor: "a", offsetCm: 40, widthCm: 80, heightCm: 200, hinge: "b", swing: "right" },
  ],
  demolition: [{ id: "m1", wallId: "w1", anchor: "a", fromCm: 10, toCm: 80 }],
  furniture: { items: [{ id: "f1", kind: "table", x: 100, y: 100, widthCm: 120, lengthCm: 80, angleDeg: 0 }], dimensions: [] },
  switching: { switches: [{ id: "s1", at: { x: 5, y: 6 }, angle: 90, keys: [{ lines: ["L1"] }] }] },
  callouts: [{ id: "c1", target: { x: 10, y: 10 }, at: { x: 50, y: 50 }, text: "Выступ" }],
  notes: ["Заметка"],
  activePlan: "furniture",
  view: VIEW,
}

const asFile = (drawing: unknown, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ format: "draw-repair-drawing", version: 1, drawing, ...extra })

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null

const parsed = (json: string): Record<string, unknown> => {
  const doc: unknown = JSON.parse(json)
  if (!isObject(doc)) throw new Error("не объект")
  return doc
}

describe("serializeDrawingFile", () => {
  const doc = parsed(serializeDrawingFile(richDrawing))

  it("конверт содержит признак формата и версию 1", () => {
    expect(doc.format).toBe("draw-repair-drawing")
    expect(doc.version).toBe(1)
  })

  it("в файле один чертёж со стенами и содержимым всех планов", () => {
    const drawing = doc.drawing
    expect(isObject(drawing)).toBe(true)
    if (!isObject(drawing)) return
    expect(drawing.name).toBe("Кухня")
    expect(drawing.walls).toHaveLength(2)
    expect(drawing.doorways).toHaveLength(3)
    expect(drawing.demolition).toHaveLength(1)
    expect(isObject(drawing.furniture) && drawing.furniture.items).toHaveLength(1)
    expect(isObject(drawing.switching) && drawing.switching.switches).toHaveLength(1)
  })

  it("масштаб печати, история и корзина в файл не входят", () => {
    expect(Object.keys(doc).sort()).toEqual(["drawing", "format", "version"])
    const drawing = doc.drawing
    expect(isObject(drawing) && "scale" in drawing).toBe(false)
    expect(serializeDrawingFile(richDrawing)).not.toMatch(/history|trash/)
  })
})

describe("parseDrawingFile: чтение корректного файла", () => {
  it("круговой обмен: содержимое всех планов, вид и активный план совпадают", () => {
    const result = parseDrawingFile(serializeDrawingFile(richDrawing))
    expect(result).toEqual({ ok: true, drawing: richDrawing })
  })

  it("записанный в файле масштаб печати игнорируется", () => {
    const result = parseDrawingFile(asFile({ ...richDrawing, scale: 50 }))
    expect(result.ok).toBe(true)
    expect(result.ok && "scale" in result.drawing).toBe(false)
  })
})

describe("parseDrawingFile: повреждённое содержимое", () => {
  it("битые элементы отбрасываются, корректные восстанавливаются", () => {
    const wall = richDrawing.walls[0]
    const raw = {
      ...richDrawing,
      doorways: [
        { id: "x1", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 0, heightCm: 210 },
        { id: "x2", wallId: "gone", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 },
        { id: "x3", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 },
      ],
      dimensions: ["устаревший формат", ...richDrawing.dimensions],
    }
    const result = parseDrawingFile(asFile(raw))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.drawing.walls).toEqual([wall, richDrawing.walls[1]])
    expect(result.drawing.doorways?.map((d) => d.id)).toEqual(["x3"])
    expect(result.drawing.dimensions).toHaveLength(1)
  })
})

describe("parseDrawingFile: отклонение нечитаемого файла", () => {
  it("не JSON", () => {
    expect(parseDrawingFile("это просто текст")).toEqual({ ok: false, reason: "not-json" })
  })

  it.each([
    ["число", "5"],
    ["null", "null"],
    ["список", "[]"],
    ["JSON без признака формата", JSON.stringify({ walls: [] })],
    ["чужой признак формата", JSON.stringify({ format: "other", version: 1, drawing: richDrawing })],
  ])("не файл чертежа: %s", (_name, raw) => {
    expect(parseDrawingFile(raw)).toEqual({ ok: false, reason: "not-drawing-file" })
  })

  it("копия документа хранилища не принимается как файл чертежа", () => {
    const store = serializeStore({ version: 3, activeId: "d1", drawings: [richDrawing] })
    expect(parseDrawingFile(store)).toEqual({ ok: false, reason: "not-drawing-file" })
  })

  it.each([
    ["вместо чертежа число", asFile(5)],
    ["чертёж без стен", asFile({ id: "d1", name: "К", view: VIEW })],
    ["стены неверного типа", asFile({ ...richDrawing, walls: "нет" })],
    ["файл без чертежа", JSON.stringify({ format: "draw-repair-drawing", version: 1 })],
    ["версия не число", JSON.stringify({ format: "draw-repair-drawing", version: "1", drawing: richDrawing })],
    ["версия 0", asFile(richDrawing, { version: 0 })],
  ])("повреждён: %s", (_name, raw) => {
    expect(parseDrawingFile(raw)).toEqual({ ok: false, reason: "corrupted" })
  })

  it("версия формата новее поддерживаемой", () => {
    expect(parseDrawingFile(asFile(richDrawing, { version: 2 }))).toEqual({ ok: false, reason: "newer-version" })
  })

  it("новая версия отклоняется, даже если чертёж внутри не читается", () => {
    expect(parseDrawingFile(asFile("будущий формат", { version: 7 }))).toEqual({ ok: false, reason: "newer-version" })
  })
})

describe("importDrawingFile: загрузка новой вкладкой", () => {
  const file = serializeDrawingFile(richDrawing)

  it("чертёж получает новый идентификатор, содержимое сохраняется", () => {
    const result = importDrawingFile(file, new Set(), "new-id")
    expect(result).toEqual({ ok: true, drawing: { ...richDrawing, id: "new-id" } })
  })

  it("занятое имя уникализируется", () => {
    const result = importDrawingFile(file, new Set(["Кухня"]), "new-id")
    expect(result.ok && result.drawing.name).toBe("Кухня (2)")
  })

  it("повторная загрузка того же файла даёт отдельные чертежи с разными идентификаторами и именами", () => {
    const used = new Set(["Кухня"])
    const first = importDrawingFile(file, used, "id-1")
    if (!first.ok) throw new Error("первая загрузка отклонена")
    used.add(first.drawing.name)
    const second = importDrawingFile(file, used, "id-2")
    if (!second.ok) throw new Error("вторая загрузка отклонена")
    expect(second.drawing.id).not.toBe(first.drawing.id)
    expect(second.drawing.name).not.toBe(first.drawing.name)
  })

  it("отклонённый файл возвращает причину без чертежа", () => {
    expect(importDrawingFile("не json", new Set(), "new-id")).toEqual({ ok: false, reason: "not-json" })
  })
})

describe("drawingFileErrorMessage", () => {
  it.each(["not-json", "not-drawing-file"] as const)("%s: файл не является файлом чертежа", (reason) => {
    expect(drawingFileErrorMessage(reason)).toBe("Файл не является файлом чертежа.")
  })

  it("corrupted: файл повреждён", () => {
    expect(drawingFileErrorMessage("corrupted")).toBe("Файл чертежа повреждён.")
  })

  it("newer-version: файл создан более новой версией программы", () => {
    expect(drawingFileErrorMessage("newer-version")).toBe("Файл создан более новой версией программы.")
  })
})
