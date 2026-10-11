import { describe, expect, it } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import type { Wall } from "../types"
import { availableFormatsForPages, fitsFormat, placeOnPage } from "./pdf"
import type { BBox, PageFormat, PlanPage } from "./pdf"
import { legendWidthMm } from "./legend"
import { drawingArea, frameRect, legendArea, titleBlockRect } from "./sheet-layout"

// change pdf-legend: область чертежа без столбца легенды, вместимость форматов и размещение с учётом легенды
// (spec pdf-export «Область чертежа внутри рамки», «Формат страницы выбирает пользователь»; design D3;
// test-plan AR-1…AR-6, FM-1…FM-4). Масштаб 1:10 даёт 1 см мира = 1 мм листа.

const FORMATS: PageFormat[] = ["A4", "A3", "A2", "A1", "A0"]
const box = (w: number, h: number): BBox => ({ minX: 0, minY: 0, maxX: w, maxY: h })

const wall = (len: number, id = "w", y = 0): Wall => ({ id, a: { x: 0, y }, b: { x: len, y }, thicknessCm: 20, type: "brick" })
const pageOf = (...walls: Wall[]): PlanPage => ({ walls, dimensions: [], doorways: [] })
const EMPTY: PlanPage = { walls: [], dimensions: [], doorways: [] }

// ширина столбца документа, в котором есть стены
const W = legendWidthMm([pageOf(wall(500))])

describe("область чертежа без легенды", () => {
  it("AR-1: A4 без легенды — 272×145 мм с началом (20; 5)", () => {
    expect(drawingArea("A4")).toEqual({ x: 20, y: 5, w: 272, h: 145 })
    expect(drawingArea("A4", 0)).toEqual({ x: 20, y: 5, w: 272, h: 145 })
  })

  it("AR-3: в документе без стен область полная на всех форматах", () => {
    const none = legendWidthMm([EMPTY, EMPTY])
    for (const f of FORMATS) expect(drawingArea(f, none)).toEqual(drawingArea(f))
  })
})

describe("область чертежа с легендой", () => {
  it("AR-2: A4 с колонкой W — (272 − W)×145 от x = 20 + W, y = 5", () => {
    const a = drawingArea("A4", W)
    expect(a.x).toBeCloseTo(20 + W, 9)
    expect(a.y).toBe(5)
    expect(a.w).toBeCloseTo(272 - W, 9)
    expect(a.h).toBe(145)
  })

  it("AR-2: на каждом формате сужается только ширина, высота и правый край прежние", () => {
    for (const f of FORMATS) {
      const full = drawingArea(f)
      const a = drawingArea(f, W)
      expect(a.x + a.w, f).toBeCloseTo(full.x + full.w, 9)
      expect(a.y, f).toBe(full.y)
      expect(a.h, f).toBe(full.h)
      expect(a.w, f).toBeCloseTo(full.w - W, 9)
    }
  })

  it("AR-2: столбец легенды — от левого края области шириной W на всю высоту области", () => {
    for (const f of FORMATS) {
      const full = drawingArea(f)
      const col = legendArea(f, W)
      expect(col, f).toEqual({ x: full.x, y: full.y, w: W, h: full.h })
    }
  })

  it("AR-4: столбец легенды и область чертежа не пересекаются и вместе дают полную область", () => {
    for (const f of FORMATS) {
      const col = legendArea(f, W)
      const a = drawingArea(f, W)
      expect(col.x + col.w, f).toBeCloseTo(a.x, 9)
    }
  })

  it("AR-4: область с легендой не заходит на рамку и основную надпись", () => {
    for (const f of FORMATS) {
      const a = drawingArea(f, W)
      const frame = frameRect(f)
      const block = titleBlockRect(f)
      expect(a.x, f).toBeGreaterThanOrEqual(frame.x)
      expect(a.x + a.w, f).toBeLessThanOrEqual(frame.x + frame.w + 1e-9)
      expect(a.y, f).toBeGreaterThanOrEqual(frame.y)
      expect(a.y + a.h, f).toBeLessThanOrEqual(block.y + 1e-9)
    }
  })

  it("AR-4: чертёж, равный области формата с легендой, помещается и не заходит на легенду", () => {
    for (const f of FORMATS) {
      const a = drawingArea(f, W)
      const b = box(a.w, a.h)
      expect(fitsFormat(b, 10, f, W), f).toBe(true)
      const p = placeOnPage(b, 10, f, W)
      expect(p.offsetX, f).toBeCloseTo(a.x, 9)
      expect(p.offsetY, f).toBeCloseTo(a.y, 9)
      expect(p.offsetX, f).toBeGreaterThanOrEqual(legendArea(f, W).x + W - 1e-9)
    }
  })
})

describe("граница области чертежа с легендой", () => {
  it("AR-5: габариты (272 − W)×145 на A4 помещаются, +0,1 мм по ширине или по высоте — нет", () => {
    const a = drawingArea("A4", W)
    expect(fitsFormat(box(a.w, 145), 10, "A4", W)).toBe(true)
    expect(fitsFormat(box(a.w + 0.1, 145), 10, "A4", W)).toBe(false)
    expect(fitsFormat(box(a.w, 145.1), 10, "A4", W)).toBe(false)
  })

  it.each(["A3", "A2", "A1", "A0"] as const)("AR-5: %s — граница области с легендой включительно", (f) => {
    const a = drawingArea(f, W)
    expect(fitsFormat(box(a.w, a.h), 10, f, W)).toBe(true)
    expect(fitsFormat(box(a.w + 0.1, a.h), 10, f, W)).toBe(false)
    expect(fitsFormat(box(a.w, a.h + 0.1), 10, f, W)).toBe(false)
  })

  it("AR-5: прежняя граница 272 мм при легенде уже не годится, при нулевой колонке — годится", () => {
    expect(fitsFormat(box(272, 145), 10, "A4", W)).toBe(false)
    expect(fitsFormat(box(272, 145), 10, "A4", 0)).toBe(true)
    expect(fitsFormat(box(272, 145), 10, "A4")).toBe(true)
  })
})

describe("размещение с легендой", () => {
  it("AR-6: чертёж центрирован в области за вычетом колонки, левый край правее колонки", () => {
    const p = placeOnPage(box(500, 250), 100, "A4", W)
    expect(p.mmPerCm).toBe(0.1)
    expect(p.offsetX).toBeCloseTo(20 + W + (272 - W - 50) / 2, 9)
    expect(p.offsetY).toBeCloseTo(5 + (145 - 25) / 2, 9)
    expect(p.offsetX).toBeGreaterThan(20 + W)
  })

  it("AR-6: без колонки размещение прежнее", () => {
    const p = placeOnPage(box(500, 250), 100, "A4")
    expect(p.offsetX).toBeCloseTo(20 + (272 - 50) / 2, 9)
    expect(placeOnPage(box(500, 250), 100, "A4", 0)).toEqual(p)
  })

  it("AR-6: чертёж равно удалён от левой и правой границ области с легендой", () => {
    const a = drawingArea("A4", W)
    const p = placeOnPage(box(100, 100), 10, "A4", W)
    expect(p.offsetX - a.x).toBeCloseTo(a.x + a.w - (p.offsetX + 100), 9)
  })

  it("AR-6: масштаб чертежа не зависит от ширины легенды", () => {
    expect(placeOnPage(box(500, 250), 100, "A4", W).mmPerCm).toBe(placeOnPage(box(500, 250), 100, "A4", 0).mmPerCm)
  })
})

describe("доступные форматы с легендой", () => {
  const FIT_272 = 2600 // стена: габариты со стеной толщиной 20 см и запасом 0,5·масштаб с каждой стороны = 272 мм при 1:100

  it("FM-1: габариты по ширине 272 мм при наличии стен — A4 отсутствует, A3 первым", () => {
    const list = availableFormatsForPages([pageOf(wall(FIT_272))], 100)
    expect(list).toEqual(["A3", "A2", "A1", "A0"])
  })

  it("FM-1: пустая страница рядом со страницей без вместимости ничего не меняет", () => {
    expect(availableFormatsForPages([pageOf(wall(FIT_272)), EMPTY], 100)).toEqual(["A3", "A2", "A1", "A0"])
  })

  it("FM-1: чуть короче стена (запас на колонку) — A4 снова доступен", () => {
    const len = Math.floor((272 - W) * 10 - 120) - 1
    expect(availableFormatsForPages([pageOf(wall(len))], 100)[0]).toBe("A4")
  })

  it("FM-1: пустой документ — все форматы", () => {
    expect(availableFormatsForPages([EMPTY], 100)).toEqual(FORMATS)
    expect(availableFormatsForPages([], 100)).toEqual(FORMATS)
  })

  it("FM-2: высота 172 мм — A4 нет (по высоте), A3 есть: ширины A3 после вычета колонки хватает", () => {
    const tall: Wall = { id: "t", a: { x: 0, y: 0 }, b: { x: 0, y: 1600 }, thicknessCm: 20, type: "brick" }
    const list = availableFormatsForPages([{ walls: [tall], dimensions: [], doorways: [] }], 100)
    expect(list).not.toContain("A4")
    expect(list[0]).toBe("A3")
  })

  it("FM-3: габариты 180×170 мм — A4 нет, выбирается A3", () => {
    const a3 = drawingArea("A3", W)
    expect(a3.w).toBeGreaterThan(180)
    expect(fitsFormat(box(180, 170), 10, "A4", W)).toBe(false)
    expect(fitsFormat(box(180, 170), 10, "A3", W)).toBe(true)
  })

  it("FM-4: формат ограничен самой крупной страницей, колонка общая", () => {
    const small = pageOf(wall(500))
    const large = pageOf(wall(FIT_272))
    expect(availableFormatsForPages([small, large], 100)).toEqual(["A3", "A2", "A1", "A0"])
    expect(availableFormatsForPages([large, small], 100)).toEqual(["A3", "A2", "A1", "A0"])
  })

  it("FM-4: колонка по самой длинной подписи любой страницы сужает область и для страницы с короткими подписями", () => {
    const w = wall(500)
    const marked: PlanPage = { walls: [w], dimensions: [], doorways: [], demolition: effectiveMarks([{ id: "m1", wallId: "w", anchor: "a", fromCm: 100, toCm: 190 }], [w], []) }
    expect(marked.demolition?.length).toBe(1)
    const withSnos = legendWidthMm([pageOf(wall(500)), marked])
    const without = legendWidthMm([pageOf(wall(500))])
    expect(withSnos).toBeGreaterThan(without)
    // стена, которая помещалась в узкую колонку впритык, перестаёт помещаться из-за широкой колонки другой страницы
    // стена короче границы на 1 см: решение не зависит от погрешности плавающей точки на самой границе
    const len = Math.floor((272 - without) * 10 - 120) - 1
    expect(availableFormatsForPages([pageOf(wall(len))], 100)[0]).toBe("A4")
    expect(availableFormatsForPages([pageOf(wall(len)), marked], 100)).not.toContain("A4")
  })

  it("FM-1: список по-прежнему только сужается по мере роста стены", () => {
    const lists = [1000, 2000, 2600, 3500, 6000, 9000, 12000].map((len) => availableFormatsForPages([pageOf(wall(len))], 100))
    for (let i = 1; i < lists.length; i++) expect(lists[i]?.length ?? 0).toBeLessThanOrEqual(lists[i - 1]?.length ?? Infinity)
    expect(lists[lists.length - 1]).toEqual([])
  })
})
