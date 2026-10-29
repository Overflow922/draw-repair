import { describe, expect, it } from "vitest"
import { adoptDrawing, drawingFileName, uniqueDrawingName } from "./drawing-names"
import type { Drawing } from "../types"

// change export-import-drawing-file: имя файла и имя загруженной вкладки (spec drawing-file «Сохранение активной вкладки в
// файл», «Загрузка файла новой вкладкой»).

describe("drawingFileName", () => {
  it("имя чертежа с расширением .json", () => {
    expect(drawingFileName("Кухня")).toBe("Кухня.json")
  })

  it("недопустимые символы заменяются", () => {
    const name = drawingFileName('Кухня: 2/3 \\ * ? " < > |')
    expect(name).not.toMatch(/[\\/:*?"<>|]/)
    expect(name.endsWith(".json")).toBe(true)
    expect(name.startsWith("Кухня")).toBe(true)
  })

  it("управляющие символы заменяются", () => {
    expect(drawingFileName("a\nb\tc")).toBe("a_b_c.json")
  })

  it("пробелы и точки по краям не остаются в имени", () => {
    expect(drawingFileName("  Кухня. ")).toBe("Кухня.json")
  })

  it.each(["", "   ", "..."])("пустое имя %j заменяется именем по умолчанию", (name) => {
    expect(drawingFileName(name)).toBe("Чертёж.json")
  })

  it("допустимые знаки сохраняются", () => {
    expect(drawingFileName("Квартира (2) - кухня, №3")).toBe("Квартира (2) - кухня, №3.json")
  })
})

describe("uniqueDrawingName", () => {
  it("свободное имя не меняется", () => {
    expect(uniqueDrawingName("Кухня", new Set(["Спальня"]))).toBe("Кухня")
  })

  it("занятое имя дополняется номером", () => {
    expect(uniqueDrawingName("Кухня", new Set(["Кухня"]))).toBe("Кухня (2)")
  })

  it("занятые номера пропускаются", () => {
    expect(uniqueDrawingName("Кухня", new Set(["Кухня", "Кухня (2)", "Кухня (3)"]))).toBe("Кухня (4)")
  })

  it("свободный номер перед занятым используется", () => {
    expect(uniqueDrawingName("Кухня", new Set(["Кухня", "Кухня (3)"]))).toBe("Кухня (2)")
  })
})

describe("adoptDrawing", () => {
  const drawing: Drawing = {
    id: "old",
    name: "Кухня",
    walls: [{ id: "w1", a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thicknessCm: 20, type: "brick" }],
    dimensions: [],
    view: { zoom: 1, pan: { x: 0, y: 0 } },
  }

  it("получает новый идентификатор", () => {
    expect(adoptDrawing(drawing, new Set(), "new").id).toBe("new")
  })

  it("имя уникализируется среди занятых", () => {
    expect(adoptDrawing(drawing, new Set(["Кухня"]), "new").name).toBe("Кухня (2)")
  })

  it("повторная загрузка того же файла даёт разные имена", () => {
    const used = new Set(["Кухня"])
    const first = adoptDrawing(drawing, used, "n1")
    used.add(first.name)
    const second = adoptDrawing(drawing, used, "n2")
    expect(new Set([drawing.name, first.name, second.name]).size).toBe(3)
  })

  it("идентификаторы стен и остальное содержимое сохраняются", () => {
    const adopted = adoptDrawing(drawing, new Set(), "new")
    expect(adopted.walls).toEqual(drawing.walls)
    expect(adopted.view).toEqual(drawing.view)
  })

  it("исходный чертёж не изменяется", () => {
    adoptDrawing(drawing, new Set(["Кухня"]), "new")
    expect(drawing.id).toBe("old")
    expect(drawing.name).toBe("Кухня")
  })
})
