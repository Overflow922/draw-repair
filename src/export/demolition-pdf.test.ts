import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import { demolitionColor } from "../demolition/demolition-render"
import { LIGHT_PALETTE } from "../theme"
import type { DemolitionMark, Dimension, Doorway, Drawing, Wall } from "../types"
import type { PageFormat, PlanPage } from "./pdf"
import { colorSegments, hexToRgb01, isGray, isRed, parseColoredStrokes, sameColor } from "./pdf-colors.test-utils"
import { insideRect, parsePaths, pathsBBox, rectEdgesDrawn, strokeSegments } from "./pdf-ops.test-utils"
import type { Rect } from "./pdf-ops.test-utils"

// change demolition-plan: страница плана «Демонтаж» в PDF (spec pdf-export «Страница плана «Демонтаж»»; design D9).
// Текст фиксируется на вызове doc.text вместе с номером страницы; цвет и толщина штрихов разбираются из потока.

interface TextCall {
  page: number
  text: string
  x: number
  y: number
}

const texts = vi.hoisted((): TextCall[] => [])

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>()
  class RecordingPdf extends mod.jsPDF {
    constructor(options?: jsPDFOptions) {
      super(options)
      const original: unknown = Reflect.get(this, "text")
      if (typeof original !== "function") throw new Error("jsPDF.text недоступен")
      Object.defineProperty(this, "text", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): unknown => {
          const [text, x, y] = args
          const lines = typeof text === "string" ? [text] : Array.isArray(text) ? text.filter((t): t is string => typeof t === "string") : []
          if (typeof x === "number" && typeof y === "number") {
            for (const line of lines) texts.push({ page: this.getCurrentPageInfo().pageNumber, text: line, x, y })
          }
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { availableFormats, availableFormatsForPages, buildPdf, buildPdfPages, pagesOf } = await import("./pdf")
const { drawingArea, frameRect, titleBlockRect, FRAME_LINE_MM } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const wall = (ax: number, ay: number, bx: number, by: number, id: string, type: Wall["type"] = "brick"): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm: 20, type })
const W1 = wall(0, 0, 500, 0, "w1")
const M1: DemolitionMark = { id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }
const DOOR: Doorway = { id: "d1", wallId: "w1", anchor: "a", offsetCm: 300, widthCm: 90, heightCm: 210 } // откосы 300–390
const dimension: Dimension = { from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 1 } }, to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 1 } }, offset: 60 }

const drawing = (extra: Partial<Drawing> = {}): Drawing => ({
  id: "a",
  name: "Чертёж 1",
  walls: [W1],
  dimensions: [],
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  scale: 100,
  demolition: [M1],
  ...extra,
})

function build(d: Drawing, scale = 100, format: PageFormat = "A4"): jsPDF {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", scale, format, font, d.name, SEP)
}

const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)
const redOn = (doc: jsPDF, n: number) => parseColoredStrokes(doc, n).filter((s) => isRed(s.color))
const CONTOUR_MM = 0.6

describe("pagesOf: страница демонтажа", () => {
  it("PG-12: вторая страница — подложка (стены обмерочного плана), без размеров, действующие пометки", () => {
    const d = drawing({ dimensions: [dimension] })
    const pages = pagesOf(d)
    expect(pages).toHaveLength(2)
    expect(pages[1]?.walls).toEqual([W1])
    expect(pages[1]?.dimensions).toEqual([])
    expect(pages[1]?.demolition).toEqual(effectiveMarks([M1], [W1]))
  })

  it("PG-12: первая страница — прежняя, без поля demolition; размеры обмерочного плана сохранены", () => {
    const d = drawing({ dimensions: [dimension] })
    const first = pagesOf(d)[0] as PlanPage
    expect(first.dimensions).toEqual([dimension])
    expect("demolition" in first && first.demolition !== undefined).toBe(false)
  })

  it("PG-12: чертёж без пометок — вторая страница с подложкой и пустым списком пометок", () => {
    const second = pagesOf(drawing({ demolition: undefined }))[1]
    expect(second?.walls).toEqual([W1])
    expect(second?.demolition).toEqual([])
  })

  it("PG-10: пометка на железобетоне и пометка на отсутствующую стену на странице не действуют", () => {
    const d = drawing({ walls: [wall(0, 0, 500, 0, "w1", "reinforced")], demolition: [M1, { ...M1, id: "m2", wallId: "gone" }] })
    expect(pagesOf(d)[1]?.demolition).toEqual([])
  })

  it("PG-11: проём, пересекающийся с участком, на странице демонтажа не передаётся; на обмерочной странице остаётся", () => {
    const d = drawing({ doorways: [DOOR], demolition: [{ ...M1, fromCm: 350, toCm: 450 }] })
    expect(pagesOf(d)[1]?.doorways).toEqual([])
    expect(pagesOf(d)[0]?.doorways).toEqual([DOOR])
  })

  it("PG-11: проём вне участка остаётся на странице демонтажа", () => {
    expect(pagesOf(drawing({ doorways: [DOOR] }))[1]?.doorways).toEqual([DOOR])
  })

  it("PG-13: результат не зависит от активного плана и выделения", () => {
    const base = drawing()
    expect(pagesOf({ ...base, activePlan: "demolition" })).toEqual(pagesOf({ ...base, activePlan: "measure" }))
    expect(pagesOf({ ...base, activePlan: "demolition" })).toEqual(pagesOf(base))
  })

  it("PG-12: pagesOf не мутирует чертёж", () => {
    const d = drawing({ doorways: [DOOR] })
    const before = structuredClone(d)
    pagesOf(d)
    expect(d).toEqual(before)
  })
})

describe("страница демонтажа в документе PDF", () => {
  it("PG-02: PDF содержит две страницы; красное и красная штриховка только на второй", () => {
    const doc = build(drawing())
    expect(doc.getNumberOfPages()).toBe(2)
    expect(redOn(doc, 1)).toEqual([])
    expect(redOn(doc, 2).length).toBeGreaterThan(0)
  })

  it("PG-03: красная штриховка на второй странице идёт под 135° (dx·dy > 0, |dx| = |dy|)", () => {
    const doc = build(drawing())
    const slanted = colorSegments(redOn(doc, 2)).filter((s) => Math.abs(s.b.x - s.a.x) > 1e-6 && Math.abs(s.b.y - s.a.y) > 1e-6)
    // участок 9×2 мм при шаге штриховки 3 мм: линий в области немного, но больше одной
    expect(slanted.length).toBeGreaterThan(1)
    for (const s of slanted) {
      const dx = s.b.x - s.a.x
      const dy = s.b.y - s.a.y
      expect(dx * dy).toBeGreaterThan(0)
      expect(Math.abs(Math.abs(dx) - Math.abs(dy))).toBeLessThan(1e-4)
    }
  })

  it("PG-03: красный контур участка 0,6 мм: участок 90 см при 1:100 — ширина 9 мм на листе, высота 2 мм", () => {
    const doc = build(drawing())
    const contour = redOn(doc, 2).filter((s) => Math.abs(s.widthMm - CONTOUR_MM) < 0.005)
    const box = pathsBBox(contour.map((s) => ({ points: s.subpaths.flat(), closed: false, paint: "stroke" as const, widthMm: s.widthMm })))
    expect(box?.w).toBeCloseTo(9, 1)
    expect(box?.h).toBeCloseTo(2, 1)
  })

  it("PG-03: красный цвет страницы — светлый красный демонтажа (не зависит от экранной темы)", () => {
    const doc = build(drawing())
    const want = hexToRgb01(demolitionColor("light"))
    for (const s of redOn(doc, 2)) expect(sameColor(s.color, want)).toBe(true)
  })

  it("PG-03: подложка на второй странице серая (muted светлой палитры), не цвет ink", () => {
    const doc = build(drawing())
    const gray = hexToRgb01(LIGHT_PALETTE.muted)
    const ink = hexToRgb01(LIGHT_PALETTE.ink)
    const contour = parseColoredStrokes(doc, 2).filter((s) => Math.abs(s.widthMm - CONTOUR_MM) < 0.005 && isGray(s.color))
    expect(contour.some((s) => sameColor(s.color, gray))).toBe(true)
    expect(contour.some((s) => sameColor(s.color, ink))).toBe(false)
  })

  it("PG-04: на странице демонтажа нет размеров: на первой подпись размера есть, на второй её нет", () => {
    build(drawing({ dimensions: [dimension] }))
    const digitsAbove = (n: number): string[] => texts.filter((t) => t.page === n && t.y < titleBlockRect("A4").y - 1 && /^\d/.test(t.text)).map((t) => t.text)
    expect(digitsAbove(1).length).toBeGreaterThan(0)
    expect(digitsAbove(2)).toEqual(["90"])
  })

  it("PG-04: на странице демонтажа нет подписей площади и подписей элементов (H=…)", () => {
    const room = [wall(0, 0, 500, 0, "w1"), wall(500, 0, 500, 400, "r"), wall(500, 400, 0, 400, "b"), wall(0, 400, 0, 0, "l")]
    build(drawing({ walls: room, doorways: [DOOR] }))
    expect(textsOn(1).some((t) => / м²$/.test(t))).toBe(true)
    expect(textsOn(2).some((t) => / м²$/.test(t))).toBe(false)
    expect(textsOn(1).some((t) => t.startsWith("H="))).toBe(true)
    expect(textsOn(2).some((t) => t.startsWith("H="))).toBe(false)
  })

  it("PG-05: ширина участка числом: «90» при единице «см» на второй странице, на первой этого числа нет", () => {
    build(drawing())
    expect(textsOn(2)).toContain("90")
    expect(textsOn(1)).not.toContain("90")
  })

  it("PG-05: ширина в единице экспорта: «0,9» для метров", () => {
    texts.length = 0
    buildPdfPages(pagesOf(drawing()), "m", 100, "A4", font, "x", SEP)
    expect(textsOn(2)).toContain("0,9")
  })

  it("PG-05: несколько участков — число у каждого", () => {
    build(drawing({ demolition: [M1, { id: "m2", wallId: "w1", anchor: "a", fromCm: 300, toCm: 420 }] }))
    expect(textsOn(2).filter((t) => t === "90" || t === "120").sort()).toEqual(["120", "90"])
  })

  it("PG-06: первая страница содержит обмерочный план так же, как до введения плана «Демонтаж»: те же операторы, что у buildPdf, и ни одной красной линии", () => {
    const d = drawing({ doorways: [DOOR], dimensions: [dimension] })
    const doc = build(d)
    const old = buildPdf(d.walls, d.dimensions, "cm", 100, "A4", font, d.doorways ?? [], d.name, SEP)
    expect(parsePaths(doc, 1)).toEqual(parsePaths(old, 1))
    expect(redOn(doc, 1)).toEqual([])
  })

  it("PG-14: без пометок вторая страница — только серая подложка, красного нет", () => {
    const doc = build(drawing({ demolition: [] }))
    expect(doc.getNumberOfPages()).toBe(2)
    expect(redOn(doc, 2)).toEqual([])
  })

  it("PG-14: без пометок контур стены на второй странице серый (muted), а не цвета ink, как на обмерочной странице; размеров нет", () => {
    const d = drawing({ demolition: [], dimensions: [dimension] })
    const doc = build(d)
    const gray = hexToRgb01(LIGHT_PALETTE.muted)
    const ink = hexToRgb01(LIGHT_PALETTE.ink)
    const contour = (n: number) => parseColoredStrokes(doc, n).filter((s) => Math.abs(s.widthMm - CONTOUR_MM) < 0.005)
    expect(contour(2).length).toBeGreaterThan(0)
    expect(contour(2).every((s) => sameColor(s.color, gray))).toBe(true)
    expect(contour(1).some((s) => sameColor(s.color, ink))).toBe(true)
    expect(contour(2).some((s) => sameColor(s.color, ink))).toBe(false)
    expect(texts.filter((t) => t.page === 2 && /^\d/.test(t.text) && t.y < titleBlockRect("A4").y - 1)).toEqual([])
  })

  it("PG-15: на странице демонтажа нет сетки (цвета сетки #e0e0e0)", () => {
    const grid = hexToRgb01(LIGHT_PALETTE.grid)
    const strokes = parseColoredStrokes(build(drawing()), 2)
    expect(strokes.some((s) => sameColor(s.color, grid, 0.005))).toBe(false)
  })

  it("PG-16: рамка листа, основная надпись и подпись (имя, масштаб, дата) есть и на странице демонтажа", () => {
    const doc = build(drawing())
    const segs = strokeSegments(parsePaths(doc, 2))
    expect(rectEdgesDrawn(segs, frameRect("A4"), FRAME_LINE_MM)).toBe(true)
    expect(rectEdgesDrawn(segs, titleBlockRect("A4"), FRAME_LINE_MM)).toBe(true)
    for (const t of ["Чертёж 1", "1:100", "Р", "09.26"]) expect(textsOn(2)).toContain(t)
  })

  it("PG-17: страница демонтажа лежит в области чертежа и центрирована по габаритам подложки в масштабе чертежа (стена 5 м — 50 мм)", () => {
    const area: Rect = drawingArea("A4")
    const doc = build(drawing({ demolition: [] }))
    const wallStrokes = parseColoredStrokes(doc, 2).filter((s) => Math.abs(s.widthMm - CONTOUR_MM) < 0.005)
    const box = pathsBBox(wallStrokes.map((s) => ({ points: s.subpaths.flat(), closed: false, paint: "stroke" as const, widthMm: s.widthMm })))
    expect(box).not.toBeNull()
    expect(box!.w).toBeCloseTo(50, 0)
    expect(insideRect(box!, area)).toBe(true)
    expect(box!.x + box!.w / 2).toBeCloseTo(area.x + area.w / 2, 0)
  })

  it("PG-17: страница демонтажа размещается так же, как обмерочная страница без размеров: те же габариты подложки", () => {
    const d = drawing({ demolition: [] })
    const doc = build(d)
    const boxOf = (n: number) => {
      const s = parseColoredStrokes(doc, n).filter((x) => Math.abs(x.widthMm - CONTOUR_MM) < 0.005)
      return pathsBBox(s.map((x) => ({ points: x.subpaths.flat(), closed: false, paint: "stroke" as const, widthMm: x.widthMm })))
    }
    const a = boxOf(1)
    const b = boxOf(2)
    expect(b?.x).toBeCloseTo(a!.x, 1)
    expect(b?.y).toBeCloseTo(a!.y, 1)
    expect(b?.w).toBeCloseTo(a!.w, 1)
    expect(b?.h).toBeCloseTo(a!.h, 1)
  })
})

describe("подложка из нескольких стен: габариты и размещение по всем стенам, а не по помеченным", () => {
  const w2 = wall(0, 200, 300, 200, "w2")
  const short = wall(0, 0, 100, 0, "w1")
  const two = (): Drawing => drawing({ walls: [short, w2], demolition: [{ id: "m1", wallId: "w1", anchor: "a", fromCm: 20, toCm: 60 }] })
  const inkBox = (doc: jsPDF, n: number) => {
    const s = parseColoredStrokes(doc, n).filter((x) => Math.abs(x.widthMm - CONTOUR_MM) < 0.005 && isGray(x.color))
    return pathsBBox(s.map((x) => ({ points: x.subpaths.flat(), closed: false, paint: "stroke" as const, widthMm: x.widthMm })))
  }

  it("PG-18: страница демонтажа несёт все стены обмерочного плана", () => {
    expect(pagesOf(two())[1]?.walls).toEqual([short, w2])
  })

  it("PG-18: формат ограничен стеной, на которой пометок нет: при 1:10 стена 300 см (330 мм с запасом) не помещается на A4, хотя помеченная стена 100 см помещается", () => {
    const d = two()
    expect(availableFormatsForPages(pagesOf(d), 10)).not.toContain("A4")
    expect(availableFormatsForPages([{ walls: [short], dimensions: [], doorways: [] }], 10)).toContain("A4")
  })

  it("PG-18: габариты и центрирование страницы — по всем стенам: серый контур охватывает обе стены (ширина 30 мм по осям с торцами вровень, высота 22 мм с толщиной стены при 1:100) и центрирован", () => {
    const area: Rect = drawingArea("A4")
    const box = inkBox(build(two()), 2)
    expect(box).not.toBeNull()
    expect(box!.w).toBeCloseTo(30, 0)
    expect(box!.h).toBeCloseTo(22, 0)
    expect(box!.x + box!.w / 2).toBeCloseTo(area.x + area.w / 2, 0)
    expect(box!.y + box!.h / 2).toBeCloseTo(area.y + area.h / 2, 0)
  })

  it("PG-18: страница демонтажа размещена так же, как обмерочная страница тех же стен", () => {
    const doc = build(two())
    const a = inkBox(doc, 1)
    const b = inkBox(doc, 2)
    expect(b?.x).toBeCloseTo(a!.x, 1)
    expect(b?.y).toBeCloseTo(a!.y, 1)
    expect(b?.w).toBeCloseTo(a!.w, 1)
    expect(b?.h).toBeCloseTo(a!.h, 1)
  })
})

describe("форматы и доступность экспорта", () => {
  // масштаб 1:10: 1 см = 1 мм листа; запас 5 см на сторону → стена длины L занимает (L + 30) мм по ширине
  const tight = (len: number): Drawing => drawing({ walls: [wall(0, 0, len, 0, "w1")], demolition: [] })

  it("PG-07: габариты страницы демонтажа — по стенам подложки: стена 242 см при 1:10 помещается на A4, 243 — нет", () => {
    expect(availableFormatsForPages(pagesOf(tight(242)), 10)).toContain("A4")
    expect(availableFormatsForPages(pagesOf(tight(243)), 10)).not.toContain("A4")
  })

  it("PG-07: список форматов по двум страницам равен списку по стенам (размеров нет)", () => {
    const d = tight(300)
    expect(availableFormatsForPages(pagesOf(d), 10)).toEqual(availableFormats(d.walls, [], 10, []))
  })

  it("PG-08: размер на обмерочной странице ограничивает форматы, страница демонтажа его не добавляет", () => {
    const d = drawing({ walls: [wall(0, 0, 100, 0, "w1")], dimensions: [{ ...dimension, offset: 200 }], demolition: [] })
    const pages = pagesOf(d)
    expect(availableFormatsForPages([pages[1] as PlanPage], 10)).toContain("A4")
    expect(availableFormatsForPages(pages, 10)).not.toContain("A4")
  })

  it("PG-08: пометки не влияют на габариты: чертёж с пометкой и без неё допускает те же форматы", () => {
    const withMark = drawing({ walls: [wall(0, 0, 242, 0, "w1")], demolition: [{ ...M1, toCm: 240 }] })
    const without = drawing({ walls: [wall(0, 0, 242, 0, "w1")], demolition: [] })
    expect(availableFormatsForPages(pagesOf(withMark), 10)).toEqual(availableFormatsForPages(pagesOf(without), 10))
  })

  it("PG-09: нет стен — обе страницы пусты, но остаются в документе", () => {
    const d = drawing({ walls: [], demolition: [] })
    const pages = pagesOf(d)
    expect(pages.every((p) => p.walls.length === 0)).toBe(true)
    const doc = build(d)
    expect(doc.getNumberOfPages()).toBe(2)
    expect(rectEdgesDrawn(strokeSegments(parsePaths(doc, 2)), frameRect("A4"), FRAME_LINE_MM)).toBe(true)
  })
})
