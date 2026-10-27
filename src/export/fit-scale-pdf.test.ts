import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { parseStore } from "../storage"
import type { Drawing, Wall, WallElement, WallWindow } from "../types"
import { legendWidthMm } from "./legend"
import type { PageFormat, PlanPage } from "./pdf"
import { insideRect, parsePaths, pathsBBox } from "./pdf-ops.test-utils"
import type { Rect } from "./pdf-ops.test-utils"

// change auto-fit-scale: подобранный масштаб в готовом PDF (spec drawing-scale «Единый масштаб документа»,
// pdf-export «Размещение в масштабе чертежа», «Заполнение основной надписи»; test-plan T-10, T-13, T-14, T-16,
// T-20…T-23, T-26…T-29). Масштаб подбирает fitScale, а PDF собирается прежней buildPdfPages, как в main.ts.

interface TextCall {
  page: number
  text: string
  fontMm: number
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
            for (const line of lines) {
              texts.push({ page: this.getCurrentPageInfo().pageNumber, text: line, fontMm: this.getFontSize() / this.internal.scaleFactor })
            }
          }
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pagesOf } = await import("./pdf")
const { fitScale, formatScale } = await import("./fit-scale")
const { drawingArea, titleBlockTexts } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const CONTOUR_MM = 0.6

const must = (v: number | null): number => {
  if (v === null) throw new Error("масштаб не подобран")
  return v
}

function build(pages: PlanPage[], scale: number, format: PageFormat = "A4"): jsPDF {
  texts.length = 0
  return buildPdfPages(pages, "cm", scale, format, font, "Чертёж 1", SEP)
}

// габариты контуров стен на странице (линия 0,6 мм); рамка и надпись рисуются другими толщинами
function ink(doc: jsPDF, pageNumber: number, format: PageFormat, pages: PlanPage[]): Rect {
  const chartLeft = drawingArea(format, legendWidthMm(pages)).x
  const paths = parsePaths(doc, pageNumber).filter(
    (p) => p.paint === "stroke" && Math.abs(p.widthMm - CONTOUR_MM) < 0.005 && (pathsBBox([p])?.x ?? 0) >= chartLeft - 1e-6,
  )
  const box = pathsBBox(paths)
  if (!box) throw new Error(`на странице ${pageNumber} контуры стен не нарисованы`)
  return box
}

const scaleTexts = (): TextCall[] => texts.filter((t) => /^1:\d/.test(t.text))

const wall = (ax: number, ay: number, bx: number, by: number, id: string): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})
const page = (walls: Wall[], doorways: WallElement[] = []): PlanPage => ({ walls, dimensions: [], doorways })

// чертёж из трёх планов, собранный через хранилище: комната 12×8 м, пометка сноса на её стене, на плане «Монтаж»
// длинная собственная стена (24 м), делающая страницу «Монтаж» самой крупной
function threePlanDrawing(activePlan: string): Drawing {
  const walls = [
    { id: "w1", a: { x: 0, y: 0 }, b: { x: 1200, y: 0 }, thicknessCm: 20, type: "brick" },
    { id: "w2", a: { x: 1200, y: 0 }, b: { x: 1200, y: 800 }, thicknessCm: 20, type: "brick" },
    { id: "w3", a: { x: 1200, y: 800 }, b: { x: 0, y: 800 }, thicknessCm: 20, type: "brick" },
    { id: "w4", a: { x: 0, y: 800 }, b: { x: 0, y: 0 }, thicknessCm: 20, type: "brick" },
  ]
  const raw = {
    version: 3,
    activeId: "d1",
    drawings: [
      {
        id: "d1",
        name: "Чертёж 1",
        walls,
        dimensions: [],
        view: { zoom: 1, pan: { x: 0, y: 0 } },
        activePlan,
        demolition: [{ id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }],
        mounting: { walls: [{ a: { x: 0, y: -600 }, b: { x: 2400, y: -600 }, thicknessCm: 20, type: "brick" }], dimensions: [] },
      },
    ],
  }
  const loaded = parseStore(JSON.stringify(raw))
  const drawing = loaded?.store.drawings[0]
  if (!drawing) throw new Error("документ с тремя планами не загружен")
  return drawing
}

describe("единый подобранный масштаб документа", () => {
  const drawing = threePlanDrawing("measure")
  const pages = pagesOf(drawing)
  const [measure, demolition, mounting] = pages

  it("T-11/T-29: на странице «Монтаж» с длинной собственной стеной масштаб мельче, чем у обмерочной страницы", () => {
    if (!measure || !mounting) throw new Error("нет страниц")
    // TCR (change add-rough-works-plan): страниц четыре — четвёртая «Черновые работы»; TCR (change reconstruction-plan): пять
    expect(pages).toHaveLength(9) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения»
    expect(must(fitScale([measure], "A4"))).toBeLessThan(must(fitScale([mounting], "A4")))
  })

  it("T-28/T-29: масштаб документа равен самому мелкому из масштабов отдельных страниц (включая демонтаж с размерами пометок)", () => {
    if (!measure || !demolition || !mounting) throw new Error("нет страниц")
    for (const format of ["A4", "A3", "A2"] as const) {
      const single = [measure, demolition, mounting].map((p) => must(fitScale([p], format)))
      expect(must(fitScale(pages, format)), format).toBe(Math.max(...single))
    }
  })

  it("T-13: подобранный масштаб не зависит от активного плана чертежа", () => {
    const expected = fitScale(pages, "A4")
    for (const plan of ["measure", "demolition", "mounting"]) {
      expect(fitScale(pagesOf(threePlanDrawing(plan)), "A4"), plan).toBe(expected)
    }
  })

  // TCR (change add-rough-works-plan): страниц четыре; TCR (change reconstruction-plan): пять
  it("T-14: в графе 25 каждой из пяти страниц выведен один и тот же подобранный масштаб", () => {
    const scale = must(fitScale(pages, "A4"))
    build(pages, scale)
    const shown = scaleTexts()
    expect(shown.map((t) => t.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]) // TCR (change furniture-plan-table): шесть страниц // TCR (change add-plumbing-plan): семь // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения»
    for (const t of shown) expect(t.text).toBe(formatScale(scale))
  })

  it("T-14/T-20: геометрия страницы «Монтаж» размещена в подобранном масштабе: стена 24 м — 2400·10/X мм", () => {
    if (!mounting) throw new Error("нет страницы «Монтаж»")
    const scale = must(fitScale(pages, "A4"))
    const doc = build(pages, scale)
    const box = ink(doc, 3, "A4", pages)
    // ширина контура включает полуширину линии (0,6 мм), поэтому допуск 1 мм
    expect(Math.abs(box.w - (2400 * 10) / scale)).toBeLessThan(1)
  })

  it("T-23: на страницах «Обмер» и «Монтаж» чертёж целиком внутри области чертежа", () => {
    const scale = must(fitScale(pages, "A4"))
    const doc = build(pages, scale)
    const area = drawingArea("A4", legendWidthMm(pages))
    expect(scale).not.toBe(1000)
    for (const n of [1, 3]) expect(insideRect(ink(doc, n, "A4", pages), area), `страница ${n}`).toBe(true)
  })
})

describe("размещение на листе в подобранном масштабе", () => {
  const single = [page([wall(0, 0, 500, 0, "w")])]

  it("T-20: стена 5 м на листе занимает 5000/X мм при подобранном X (контур стены — по её оси, без запаса)", () => {
    const scale = must(fitScale(single, "A4"))
    const doc = build(single, scale)
    expect(Math.abs(ink(doc, 1, "A4", single).w - (500 * 10) / scale)).toBeLessThan(1)
  })

  it("T-21: при масштабе 1:2,5 каждый сантиметр мира — 4 мм листа: стена 40 см — 160 мм", () => {
    const tiny = [page([wall(0, 0, 40, 0, "w")])]
    const doc = build(tiny, 2.5, "A3")
    expect(Math.abs(ink(doc, 1, "A3", tiny).w - 160)).toBeLessThan(1)
  })

  it("T-22: чертёж центрирован в области чертежа по обеим осям", () => {
    const scale = must(fitScale(single, "A4"))
    const doc = build(single, scale)
    const area = drawingArea("A4", legendWidthMm(single))
    const box = ink(doc, 1, "A4", single)
    expect(box.x + box.w / 2).toBeCloseTo(area.x + area.w / 2, 0)
    expect(box.y + box.h / 2).toBeCloseTo(area.y + area.h / 2, 0)
  })

  it("T-10/T-16: размер шрифта и значения подписей не зависят от масштаба (кроме самой графы масштаба)", () => {
    const labels = (scale: number): TextCall[] => {
      build(single, scale)
      return texts.filter((t) => !/^1:\d/.test(t.text)).map(({ text, fontMm }) => ({ page: 1, text, fontMm }))
    }
    const at50 = labels(50)
    const at100 = labels(100)
    expect(at50.length).toBeGreaterThan(0)
    expect(at100).toEqual(at50)
  })
})

describe("графа 25 основной надписи", () => {
  it("T-26: масштаб 1:2,5 выводится в графе 25 с запятой на каждой странице PDF", () => {
    const pages = pagesOf(threePlanDrawing("measure"))
    build(pages, 2.5, "A0")
    const shown = scaleTexts()
    // TCR (change add-rough-works-plan): страниц четыре; TCR (change reconstruction-plan): пять
    expect(shown.map((t) => t.text)).toEqual(["1:2,5", "1:2,5", "1:2,5", "1:2,5", "1:2,5", "1:2,5", "1:2,5", "1:2,5", "1:2,5"]) // TCR (change furniture-plan-table): шесть страниц // TCR (change add-plumbing-plan): семь // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения»
  })

  it("T-26: текст графы 25 берётся из подобранного масштаба: целый — «1:100», нецелый — «1:2,5»", () => {
    const date = new Date(2026, 8, 5)
    expect(titleBlockTexts({ name: "Чертёж 1", scale: 100, date }).find((t) => t.cellId === "25")?.text).toBe("1:100")
    expect(titleBlockTexts({ name: "Чертёж 1", scale: 2.5, date }).find((t) => t.cellId === "25")?.text).toBe("1:2,5")
  })
})

describe("габариты страницы демонтажа учитывают цепочки размеров пометок", () => {
  // Г-образная планировка: вертикальная стена высотой H подобрана так, чтобы при 1:100 высота чертежа была 99,9 % области;
  // на горизонтальной стене в её верхнем конце стоит пометка сноса, и цепочка размеров над стеной выступает вверх
  // за габариты стен, то есть увеличивает именно высоту
  function lShape(withMark: boolean): Drawing {
    // высота области чертежа от легенды не зависит; запас вокруг при 1:100 — по 50 см с каждой стороны, толщина стены 20 см
    const heightCm = (0.999 * drawingArea("A4", 0).h * 100) / 10 - 100 - 20
    const raw = {
      version: 3,
      activeId: "d1",
      drawings: [
        {
          id: "d1",
          name: "Чертёж 1",
          walls: [
            { id: "v", a: { x: 0, y: 0 }, b: { x: 0, y: heightCm }, thicknessCm: 20, type: "brick" },
            { id: "h", a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" },
          ],
          dimensions: [],
          view: { zoom: 1, pan: { x: 0, y: 0 } },
          ...(withMark ? { demolition: [{ id: "m1", wallId: "h", anchor: "a", fromCm: 100, toCm: 190 }] } : {}),
        },
      ],
    }
    const drawing = parseStore(JSON.stringify(raw))?.store.drawings[0]
    if (!drawing) throw new Error("документ не загружен")
    return drawing
  }

  it("T-28: страница демонтажа с цепочкой размеров пометки получает более мелкий масштаб, чем её же подложка без пометки", () => {
    const withoutMark = pagesOf(lShape(false))[1]
    const withMark = pagesOf(lShape(true))[1]
    if (!withoutMark || !withMark) throw new Error("нет страницы демонтажа")
    expect(withMark.demolition?.length).toBe(1)
    const base = must(fitScale([withoutMark], "A4"))
    expect(base).toBe(100)
    expect(must(fitScale([withMark], "A4"))).toBeGreaterThan(base)
  })
})

describe("габариты для подбора масштаба учитывают подписи элементов стен", () => {
  // горизонтальная стена, подобранная так, чтобы при 1:100 она занимала 99,9 % ширины области чертежа A4:
  // любая подпись, выступающая за торец стены, переводит чертёж на следующий, более мелкий масштаб
  function tightWall(): Wall {
    const probe = [page([wall(0, 0, 100, 0, "w")])]
    const avail = drawingArea("A4", legendWidthMm(probe)).w - 10
    return wall(0, 0, (0.999 * avail * 100) / 10 - 20, 0, "w")
  }

  const window60: WallWindow = { kind: "window", id: "e1", wallId: "w", anchor: "a", offsetCm: 0, widthCm: 60, heightCm: 150, sillCm: 85 }

  it("T-27: без элементов стена получает 1:100", () => {
    expect(fitScale([page([tightWall()])], "A4")).toBe(100)
  })

  it("T-27: подпись окна, выступающая за торец стены, переводит чертёж на более мелкий масштаб", () => {
    // подпись шире 6 мм окна выступает за торец, но меньше чем вдвое: следующий член ряда после 1:100 — 1:200
    expect(fitScale([page([tightWall()], [window60])], "A4")).toBe(200)
  })
})
