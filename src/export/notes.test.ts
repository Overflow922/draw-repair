import { describe, expect, it } from "vitest"
import type { ExplicatedRoom } from "../room-explication"
import { bottomBandMm, explicationLayout } from "./explication"
import { explicationTable } from "../room-explication"
import { maxNotesHeightMm, notesLayout, notesLayoutFor, notesRect, pageNotes } from "./notes"
import type { PlanPage } from "./pdf"
import { drawingArea, frameRect, titleBlockRect } from "./sheet-layout"

// change add-plan-notes: раскладка блока примечаний и высота нижней полосы
// (spec plan-notes «Блок примечаний в PDF»; pdf-export «Область чертежа внутри рамки»).

const page = (notes?: readonly string[], rooms?: readonly ExplicatedRoom[]): PlanPage => ({
  walls: [],
  dimensions: [],
  doorways: [],
  ...(notes ? { notes } : null),
  ...(rooms ? { rooms } : null),
})

const W = 185
const LONG = "слово ".repeat(60).trim() // не помещается в одну строку шириной 170 мм

describe("высота и строки блока", () => {
  it("один короткий пункт: 3 + 5 + 4,5 + 2 = 14,5 мм, строка с номером на y = 8", () => {
    const l = notesLayout(["Все размеры указаны в мм."], W)
    expect(l.heightMm).toBeCloseTo(14.5, 9)
    expect(l.lines).toEqual([{ number: "1.", text: "Все размеры указаны в мм.", y: 8 }])
  })

  it("пункты нумеруются по порядку, шаг строк 4,5 мм", () => {
    const l = notesLayout(["а", "б", "в"], W)
    expect(l.lines.map((x) => x.number)).toEqual(["1.", "2.", "3."])
    expect(l.lines.map((x) => x.y)).toEqual([8, 12.5, 17])
    expect(l.heightMm).toBeCloseTo(3 + 5 + 3 * 4.5 + 2, 9)
  })

  it("длинный пункт переносится: номер только у первой строки, высота растёт на 4,5 мм за строку", () => {
    const l = notesLayout([LONG, "б"], W)
    const first = l.lines.filter((x) => x.number === "1.")
    expect(first).toHaveLength(1)
    const wrapped = l.lines.filter((x) => x.number === undefined)
    expect(wrapped.length).toBeGreaterThanOrEqual(1)
    expect(l.lines.at(-1)).toMatchObject({ number: "2.", text: "б" })
    expect(l.heightMm).toBeCloseTo(3 + 5 + l.lines.length * 4.5 + 2, 9)
  })

  it("текст пункта лежит в тексте строк целиком (перенос не теряет слов)", () => {
    const l = notesLayout([LONG], W)
    expect(l.lines.map((x) => x.text).join(" ")).toBe(LONG)
  })

  it("слишком длинное слово разбивается по символам, текст сохраняется", () => {
    const word = "я".repeat(200)
    const l = notesLayout([word], W)
    expect(l.lines.length).toBeGreaterThan(1)
    expect(l.lines.map((x) => x.text).join("")).toBe(word)
  })

  it("раскладка не зависит от формата листа", () => {
    expect(notesLayoutFor([LONG, "б"], "A4")).toEqual(notesLayoutFor([LONG, "б"], "A0"))
  })
})

describe("положение блока", () => {
  it("A4: x от 107 до 292, низ на y = 150 (верх основной надписи), высота 14,5", () => {
    const r = notesRect("A4", notesLayoutFor(["а"], "A4"))
    expect(r.x).toBeCloseTo(107, 9)
    expect(r.x + r.w).toBeCloseTo(292, 9)
    expect(r.y + r.h).toBeCloseTo(150, 9)
    expect(r.h).toBeCloseTo(14.5, 9)
  })

  it("блок не заходит левее основной надписи и стоит на ней на любом формате", () => {
    for (const f of ["A4", "A3", "A2", "A1", "A0"] as const) {
      const r = notesRect(f, notesLayoutFor(["а", LONG], f))
      const t = titleBlockRect(f)
      const frame = frameRect(f)
      expect(r.x).toBeCloseTo(t.x, 9)
      expect(r.w).toBeCloseTo(185, 9)
      expect(r.x + r.w).toBeCloseTo(frame.x + frame.w, 9)
      expect(r.y + r.h).toBeCloseTo(t.y, 9)
    }
  })
})

describe("страница с примечаниями", () => {
  it("пустой список и отсутствие поля — блока нет", () => {
    expect(pageNotes(page())).toBeNull()
    expect(pageNotes({ ...page(), notes: [] })).toBeNull()
    expect(pageNotes(page(["а"]))).toEqual(["а"])
  })
})

describe("высота нижней полосы", () => {
  const T = 55

  it("без примечаний полоса равна основной надписи", () => {
    expect(maxNotesHeightMm([page(), page()], "A4")).toBe(0)
    expect(bottomBandMm([page(), page(), page()], "A4")).toBe(T)
  })

  it("примечания поднимают полосу: 55 + N, область чертежа 135 − N на A4", () => {
    const n = notesLayoutFor(["а"], "A4").heightMm
    const band = bottomBandMm([page(), page(["а"]), page()], "A4")
    expect(band).toBeCloseTo(T + n, 9)
    expect(drawingArea("A4", 0, band).h).toBeCloseTo(135 - n, 9)
    expect(drawingArea("A4", 0, band).y).toBe(15)
  })

  it("берётся самый высокий блок среди страниц", () => {
    const low = notesLayoutFor(["а"], "A4").heightMm
    const high = notesLayoutFor(["а", "б", "в"], "A4").heightMm
    expect(high).toBeGreaterThan(low)
    expect(maxNotesHeightMm([page(["а"]), page(["а", "б", "в"]), page()], "A4")).toBeCloseTo(high, 9)
    expect(bottomBandMm([page(["а", "б", "в"]), page(["а"])], "A4")).toBeCloseTo(T + high, 9)
  })

  it("высокая экспликация перекрывает примечания, если выше надписи с блоком", () => {
    const room = { number: 1, name: "К", heightMm: 3000, anchor: { x: 0, y: 0 } }
    const rooms: ExplicatedRoom[] = Array.from({ length: 12 }, (_, i) => ({
      room: { outline: [], holes: [], areaCm2: 100000, labelAt: { x: 0, y: 0 } },
      record: { ...room, number: i + 1 },
    }))
    const table = explicationTable(rooms)
    const tableH = explicationLayout(table).heightMm
    const notesH = notesLayoutFor(["а"], "A4").heightMm
    expect(tableH).toBeGreaterThan(T + notesH)
    expect(bottomBandMm([page(["а"], rooms)], "A4")).toBeCloseTo(tableH, 9)
  })

  it("низкая экспликация не меняет полосу с примечаниями", () => {
    const rooms: ExplicatedRoom[] = [{
      room: { outline: [], holes: [], areaCm2: 100000, labelAt: { x: 0, y: 0 } },
      record: { number: 1, name: "К", heightMm: 3000, anchor: { x: 0, y: 0 } },
    }]
    const notesH = notesLayoutFor(["а"], "A4").heightMm
    expect(bottomBandMm([page(["а"], rooms)], "A4")).toBeCloseTo(T + notesH, 9)
  })
})
