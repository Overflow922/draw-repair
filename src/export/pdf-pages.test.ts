import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Dimension, Doorway, Drawing, Wall, WallDoor, WallElement } from "../types"
import type { PageFormat, PlanPage } from "./pdf"
import { insideRect, parsePaths, pathsBBox, rectEdgesDrawn, strokeSegments } from "./pdf-ops.test-utils"
import type { Rect } from "./pdf-ops.test-utils"

// change drawing-plans: PDF — упорядоченный список страниц, по одной на план; форматы учитывают все страницы
// (spec pdf-export «Экспорт — упорядоченный список страниц», «Форматы учитывают все страницы»; design D5).
// Текст фиксируется на вызове doc.text вместе с номером страницы, векторные операторы разбираются из потока страницы.

interface TextCall {
  page: number
  text: string
  x: number
  y: number
  widthMm: number
  fontMm: number
  align: string
  baseline: string
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
          const [text, x, y, options] = args
          const lines = typeof text === "string" ? [text] : Array.isArray(text) ? text.filter((t): t is string => typeof t === "string") : []
          if (typeof x === "number" && typeof y === "number") {
            const opt = typeof options === "object" && options !== null ? options : {}
            const align = "align" in opt && typeof opt.align === "string" ? opt.align : "left"
            const baseline = "baseline" in opt && typeof opt.baseline === "string" ? opt.baseline : "alphabetic"
            for (const line of lines) {
              texts.push({
                page: this.getCurrentPageInfo().pageNumber,
                text: line,
                x,
                y,
                widthMm: this.getTextWidth(line),
                fontMm: this.getFontSize() / this.internal.scaleFactor,
                align,
                baseline,
              })
            }
          }
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { availableFormats, availableFormatsForPages, buildPdf, buildPdfPages, exportPages, pagesOf, pdfFileName } = await import("./pdf")
const { drawingArea, frameRect, titleBlockRect, FRAME_LINE_MM } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const ALL: PageFormat[] = ["A4", "A3", "A2", "A1", "A0"]

const wall = (ax: number, ay: number, bx: number, by: number, id: string): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const page = (walls: Wall[], doorways: WallElement[] = [], dimensions: Dimension[] = []): PlanPage => ({ walls, dimensions, doorways })

const dim = (wallId: string, offset: number): Dimension => ({
  from: { a: { wallId, edge: 2 }, b: { wallId, edge: 1 } },
  to: { a: { wallId, edge: 3 }, b: { wallId, edge: 1 } },
  offset,
})
const EMPTY: PlanPage = page([])

// страница A: горизонтальная стена 5 м у начала координат; страница B: вертикальная стена 3 м далеко от неё
const WA = wall(0, 0, 500, 0, "wa")
const WB = wall(5000, 5000, 5000, 5300, "wb")
const DOOR_A: Doorway = { id: "da", wallId: "wa", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210 }
const DOOR_B: Doorway = { id: "db", wallId: "wb", anchor: "a", offsetCm: 100, widthCm: 80, heightCm: 150 }
const PAGE_A = page([WA], [DOOR_A])
const PAGE_B = page([WB], [DOOR_B])

function build(pages: PlanPage[], scale = 100, format: PageFormat = "A4", name = "Чертёж 1"): jsPDF {
  texts.length = 0
  return buildPdfPages(pages, "cm", scale, format, font, name, SEP)
}

// габариты контуров стен на странице (линия 0,6 мм); рамка и надпись рисуются другими толщинами
const CONTOUR_MM = 0.6
const ink = (doc: jsPDF, pageNumber: number): Rect => {
  const paths = parsePaths(doc, pageNumber).filter((p) => p.paint === "stroke" && Math.abs(p.widthMm - CONTOUR_MM) < 0.005)
  const box = pathsBBox(paths)
  if (!box) throw new Error(`на странице ${pageNumber} контуры стен не нарисованы`)
  return box
}

const textsOn = (pageNumber: number): string[] => texts.filter((t) => t.page === pageNumber).map((t) => t.text)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("pagesOf", () => {
  const drawing = (extra: Partial<Drawing> = {}): Drawing => ({
    id: "a",
    name: "Чертёж 1",
    walls: [WA],
    dimensions: [],
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    scale: 100,
    ...extra,
  })

  // TCR-2 (change demolition-plan): pagesOf даёт страницу на каждый план каталога (две); обмерочный план — первая
  // страница с прежним содержимым, вторая — страница демонтажа (проверяется в demolition-pdf.test.ts)
  it("PG-01: первая страница — обмерочный план с его стенами, размерами и проёмами; страниц по числу планов каталога", () => {
    const dim = { from: { a: { wallId: "wa", edge: 2 }, b: { wallId: "wa", edge: 1 } }, to: { a: { wallId: "wa", edge: 3 }, b: { wallId: "wa", edge: 1 } }, offset: 30 }
    const d = drawing({ dimensions: [dim], doorways: [DOOR_A] })
    expect(pagesOf(d)).toHaveLength(2)
    expect(pagesOf(d)[0]).toEqual({ walls: [WA], dimensions: [dim], doorways: [DOOR_A] })
  })

  it("PG-01: отсутствующий список проёмов превращается в пустой", () => {
    expect(pagesOf(drawing())[0]).toEqual({ walls: [WA], dimensions: [], doorways: [] })
  })

  it("PG-01: чертёж без объектов даёт пустую первую страницу, а не пустой список", () => {
    expect(pagesOf(drawing({ walls: [] }))[0]).toEqual({ walls: [], dimensions: [], doorways: [] })
  })

  it("PG-07: результат не зависит от активного плана чертежа", () => {
    const base = drawing({ doorways: [DOOR_A] })
    expect(pagesOf({ ...base, activePlan: "measure" })).toEqual(pagesOf(base))
  })

  it("PG-13: pagesOf не меняет чертёж", () => {
    const d = drawing({ doorways: [DOOR_A] })
    const before = structuredClone(d)
    pagesOf(d)
    expect(d).toEqual(before)
  })

  it("PG-13: pagesOf не дописывает чертежу отсутствующий список проёмов", () => {
    const d = drawing()
    expect("doorways" in d).toBe(false)
    pagesOf(d)
    expect("doorways" in d).toBe(false)
  })
})

describe("buildPdfPages: число и порядок страниц", () => {
  it("PG-02: одна страница даёт ровно одну страницу PDF", () => {
    expect(build([PAGE_A]).getNumberOfPages()).toBe(1)
  })

  it("PG-03: две страницы дают две страницы PDF", () => {
    expect(build([PAGE_A, PAGE_B]).getNumberOfPages()).toBe(2)
  })

  it("PG-04: три страницы дают три страницы PDF", () => {
    expect(build([PAGE_A, PAGE_B, PAGE_A]).getNumberOfPages()).toBe(3)
  })

  it("PG-09: пустая страница между непустыми остаётся страницей PDF", () => {
    const doc = build([PAGE_A, EMPTY, PAGE_B])
    expect(doc.getNumberOfPages()).toBe(3)
    const segs = strokeSegments(parsePaths(doc, 2))
    expect(rectEdgesDrawn(segs, frameRect("A4"), FRAME_LINE_MM)).toBe(true)
    expect(rectEdgesDrawn(segs, titleBlockRect("A4"), FRAME_LINE_MM)).toBe(true)
  })

  it("PG-04: страница i содержит геометрию только pages[i]: горизонтальная A на первой, вертикальная B на второй", () => {
    const doc = build([PAGE_A, PAGE_B])
    const first = ink(doc, 1)
    const second = ink(doc, 2)
    expect(first.w).toBeGreaterThan(first.h * 5)
    expect(second.h).toBeGreaterThan(second.w * 5)
  })

  it("PG-04: при обратном порядке на входе страницы меняются местами", () => {
    const doc = build([PAGE_B, PAGE_A])
    expect(ink(doc, 1).h).toBeGreaterThan(ink(doc, 1).w * 5)
    expect(ink(doc, 2).w).toBeGreaterThan(ink(doc, 2).h * 5)
  })

  it("PG-04: подписи высоты проёмов принадлежат своей странице (H=210 только на первой, H=150 только на второй)", () => {
    build([PAGE_A, PAGE_B])
    expect(textsOn(1)).toContain("H=210")
    expect(textsOn(1)).not.toContain("H=150")
    expect(textsOn(2)).toContain("H=150")
    expect(textsOn(2)).not.toContain("H=210")
  })

  it("PG-04: пустая страница не содержит чужой геометрии", () => {
    const doc = build([PAGE_A, EMPTY])
    expect(parsePaths(doc, 2).filter((p) => p.paint === "stroke" && Math.abs(p.widthMm - CONTOUR_MM) < 0.005)).toEqual([])
    expect(textsOn(2)).not.toContain("H=210")
  })
})

describe("buildPdfPages: рамка, надпись и размещение на каждой странице", () => {
  const within = (call: TextCall, cell: Rect, tol = 0.05): boolean => {
    const left = call.align === "center" ? call.x - call.widthMm / 2 : call.align === "right" ? call.x - call.widthMm : call.x
    return left >= cell.x - tol && left + call.widthMm <= cell.x + cell.w + tol && call.y >= cell.y - 1 && call.y <= cell.y + cell.h + 1
  }
  const cell = (format: PageFormat, x: number, y: number, w: number, h: number): Rect => {
    const tb = titleBlockRect(format)
    return { x: tb.x + x, y: tb.y + y, w, h }
  }

  it("PG-06: на каждой странице нарисованы рамка листа и основная надпись", () => {
    const doc = build([PAGE_A, PAGE_B, EMPTY])
    for (const n of [1, 2, 3]) {
      const segs = strokeSegments(parsePaths(doc, n))
      expect(rectEdgesDrawn(segs, frameRect("A4"), FRAME_LINE_MM), `рамка, страница ${n}`).toBe(true)
      expect(rectEdgesDrawn(segs, titleBlockRect("A4"), FRAME_LINE_MM), `надпись, страница ${n}`).toBe(true)
    }
  })

  it("PG-06: у каждой страницы одно и то же имя, «Р», масштаб и дата в своих графах", () => {
    build([PAGE_A, PAGE_B], 100, "A4", "Чертёж 1")
    for (const n of [1, 2]) {
      const on = texts.filter((t) => t.page === n)
      const one = (text: string): TextCall => {
        const found = on.filter((t) => t.text === text)
        const [first] = found
        if (found.length !== 1 || !first) throw new Error(`страница ${n}, текст «${text}»: вызовов ${found.length}`)
        return first
      }
      expect(within(one("Чертёж 1"), cell("A4", 65, 0, 120, 15))).toBe(true)
      expect(within(one("Р"), cell("A4", 135, 20, 15, 15))).toBe(true)
      expect(within(one("1:100"), cell("A4", 165, 20, 20, 15))).toBe(true)
      expect(within(one("09.26"), cell("A4", 55, 20, 10, 5))).toBe(true)
    }
  })

  it("PG-06: графа 5 пуста на каждой странице", () => {
    build([PAGE_A, PAGE_B], 100, "A4", "Чертёж 1")
    const c5 = cell("A4", 65, 15, 70, 25)
    const inside = texts.filter((t) => t.x >= c5.x && t.x <= c5.x + c5.w && t.y >= c5.y && t.y <= c5.y + c5.h)
    expect(inside).toEqual([])
  })

  it("PG-06: все страницы одного формата и альбомные (A3 — 420×297 мм)", () => {
    const doc = build([PAGE_A, PAGE_B], 100, "A3")
    for (const n of [1, 2]) {
      doc.setPage(n)
      expect(doc.internal.pageSize.getWidth()).toBe(420)
      expect(doc.internal.pageSize.getHeight()).toBe(297)
    }
  })

  it("PG-05: масштаб точный на каждой странице: стена 5 м при 1:100 — 50 мм, вертикальная 3 м — 30 мм", () => {
    const doc = build([PAGE_A, PAGE_B], 100)
    expect(ink(doc, 1).w).toBeCloseTo(50, 0)
    expect(ink(doc, 2).h).toBeCloseTo(30, 0)
  })

  it("PG-05: масштаб общий для всех страниц: при 1:200 — 25 мм и 15 мм", () => {
    const doc = build([PAGE_A, PAGE_B], 200)
    expect(ink(doc, 1).w).toBeCloseTo(25, 0)
    expect(ink(doc, 2).h).toBeCloseTo(15, 0)
  })

  it("PG-05: каждая страница размещается по габаритам своего плана — центр чертежа в центре области чертежа", () => {
    // страницы без проёмов: подписи высоты входят в габариты размещения, а здесь измеряются только контуры стен
    const area = drawingArea("A4")
    const doc = build([page([WA]), page([WB])])
    for (const n of [1, 2]) {
      const box = ink(doc, n)
      expect(insideRect(box, area), `страница ${n} внутри области`).toBe(true)
      expect(box.x + box.w / 2, `страница ${n}, центр по x`).toBeCloseTo(area.x + area.w / 2, 0)
      expect(box.y + box.h / 2, `страница ${n}, центр по y`).toBeCloseTo(area.y + area.h / 2, 0)
    }
  })

  const sameBox = (a: Rect, b: Rect): void => {
    expect(a.x).toBeCloseTo(b.x, 1)
    expect(a.y).toBeCloseTo(b.y, 1)
    expect(a.w).toBeCloseTo(b.w, 1)
    expect(a.h).toBeCloseTo(b.h, 1)
  }

  it("PG-05: размещение страницы не зависит от соседних: страница с размером на второй месте стоит там же, где при сборке отдельно", () => {
    const p = page([WB], [], [dim("wb", 150)])
    const alone = ink(build([p]), 1)
    // размер сдвигает габариты, поэтому центр стен не совпадает с центром области: проверка не вырождена
    const area = drawingArea("A4")
    expect(Math.abs(alone.x + alone.w / 2 - (area.x + area.w / 2))).toBeGreaterThan(1)
    sameBox(ink(build([PAGE_A, p]), 2), alone)
  })

  it("PG-05: то же для размера на первой странице при другой второй", () => {
    const p = page([WB], [], [dim("wb", 150)])
    sameBox(ink(build([p, PAGE_A]), 1), ink(build([p]), 1))
  })

  it("PG-05: размещение страницы с проёмом на второй месте совпадает с размещением той же страницы отдельно", () => {
    const alone = ink(build([PAGE_B]), 1)
    const area = drawingArea("A4")
    expect(Math.abs(alone.x + alone.w / 2 - (area.x + area.w / 2)) + Math.abs(alone.y + alone.h / 2 - (area.y + area.h / 2))).toBeGreaterThan(1)
    sameBox(ink(build([PAGE_A, PAGE_B]), 2), alone)
  })

  it("PG-05: размещение страницы с проёмом на первом месте совпадает с размещением отдельно", () => {
    sameBox(ink(build([PAGE_A, PAGE_B]), 1), ink(build([PAGE_A]), 1))
  })

  it("PG-20: страницы рисуются одинаково: одинаковые планы на первой и второй странице дают одинаковые векторные операторы (без сетки, с той же палитрой и толщинами)", () => {
    const doc = build([PAGE_A, PAGE_A])
    const first = parsePaths(doc, 1)
    expect(first.length).toBeGreaterThan(0)
    expect(parsePaths(doc, 2)).toEqual(first)
  })

  it("PG-20: то же для трёх страниц: третья страница совпадает с первой", () => {
    const doc = build([PAGE_B, EMPTY, PAGE_B])
    expect(parsePaths(doc, 3)).toEqual(parsePaths(doc, 1))
  })

  it("PG-14: страницы после первой подписаны тем же масштабом, что выбран для чертежа (1:50)", () => {
    build([PAGE_A, PAGE_B], 50)
    expect(textsOn(1)).toContain("1:50")
    expect(textsOn(2)).toContain("1:50")
  })

  it("PG-16: размеры принадлежат своей странице: на первой один размер, на второй два — подписей на второй ровно вдвое больше", () => {
    // подписи размеров — тексты, начинающиеся с цифры, выше основной надписи
    const labels = (n: number): number => {
      const tb = titleBlockRect("A4").y
      return texts.filter((t) => t.page === n && t.y < tb - 1 && /^\d/.test(t.text)).length
    }
    build([page([WA]), page([WB])])
    const base1 = labels(1)
    const base2 = labels(2)
    build([page([WA], [], [dim("wa", 60)]), page([WB], [], [dim("wb", 60), dim("wb", 120)])])
    const one = labels(1) - base1
    expect(one).toBeGreaterThan(0)
    expect(labels(2) - base2).toBe(2 * one)
  })

  it("PG-16: страница без размеров не получает подписей размеров другой страницы", () => {
    const tb = titleBlockRect("A4").y
    const dimLabels = (n: number): number => texts.filter((t) => t.page === n && t.y < tb - 1 && /^\d/.test(t.text)).length
    build([page([WA]), page([WB])])
    const base1 = dimLabels(1)
    const base2 = dimLabels(2)
    build([page([WA], [], [dim("wa", 60)]), page([WB])])
    expect(dimLabels(2)).toBe(base2)
    expect(dimLabels(1)).toBeGreaterThan(base1)
  })

  it("PG-17: все стены плана рисуются на его странице: Г-образный план шириной около 42 и высотой около 32 мм", () => {
    const l = page([wall(5000, 5000, 5000, 5300, "l1"), wall(5000, 5300, 5400, 5300, "l2")])
    const doc = build([PAGE_A, l])
    const box = ink(doc, 2)
    expect(box.w).toBeGreaterThan(38)
    expect(box.w).toBeLessThan(46)
    expect(box.h).toBeGreaterThan(28)
    expect(box.h).toBeLessThan(36)
  })

  it("PG-17: стены каждой страницы рисуются целиком: первая страница из двух стен тоже", () => {
    const l = page([wall(0, 0, 0, 300, "l1"), wall(0, 300, 400, 300, "l2")])
    const box = ink(build([l, PAGE_B]), 1)
    expect(box.w).toBeGreaterThan(38)
    expect(box.h).toBeGreaterThan(28)
  })
})

describe("buildPdfPages: прочие свойства", () => {
  it("PG-08: одна страница — то же содержимое, что у прежней функции buildPdf (контуры, рамка, тексты)", () => {
    texts.length = 0
    const old = buildPdf([WA], [], "cm", 100, "A4", font, [DOOR_A], "Чертёж 1", SEP)
    const oldTexts = texts.map(({ page: _page, ...rest }) => rest)
    const oldPaths = parsePaths(old, 1)
    const next = build([PAGE_A])
    const nextTexts = texts.map(({ page: _page, ...rest }) => rest)
    expect(next.getNumberOfPages()).toBe(old.getNumberOfPages())
    expect(parsePaths(next, 1)).toEqual(oldPaths)
    expect(nextTexts).toEqual(oldTexts)
  })

  it("PG-13: сборка PDF не меняет входные страницы", () => {
    const pages = [PAGE_A, PAGE_B]
    const before = structuredClone(pages)
    build(pages)
    expect(pages).toEqual(before)
  })

  it("PG-15: exportPages скачивает один файл с именем чертежа и датой, имя и дата стоят на каждой странице", () => {
    vi.useFakeTimers()
    vi.setSystemTime(SEP)
    const anchor = { href: "", download: "", click: vi.fn() }
    vi.stubGlobal("document", { createElement: () => anchor })
    texts.length = 0
    exportPages([PAGE_A, PAGE_B], "cm", 100, "A4", "Чертёж 1")
    expect(anchor.download).toBe(pdfFileName("Чертёж 1", SEP))
    expect(anchor.click).toHaveBeenCalledTimes(1)
    for (const n of [1, 2]) {
      expect(textsOn(n)).toContain("Чертёж 1")
      expect(textsOn(n)).toContain("09.26")
      expect(textsOn(n)).toContain("1:100")
    }
  })
})

describe("availableFormatsForPages", () => {
  // Масштаб 1:10: 1 см = 1 мм листа; запас 0,5 масштаба на сторону прибавляет 10 мм, толщина стены 20 мм по осям,
  // поэтому горизонтальная стена длиной L занимает (L + 30)×30 мм, область A4 — 272×145, A3 — 395×232.
  const horizontal = (lengthCm: number): PlanPage => page([wall(0, 0, lengthCm, 0, "h")])
  const vertical = (lengthCm: number): PlanPage => page([wall(0, 0, 0, lengthCm, "v")])
  const far = (lengthCm: number): PlanPage => page([wall(9000, 9000, 9000 + lengthCm, 9000, "f")])
  const NOT_A4: PageFormat[] = ["A3", "A2", "A1", "A0"]

  it("PG-10: формат ограничен самой крупной страницей: малая + крупная (A3) — без A4", () => {
    expect(availableFormatsForPages([horizontal(100), horizontal(300)], 10)).toEqual(NOT_A4)
  })

  it("PG-10: порядок страниц не влияет на результат", () => {
    expect(availableFormatsForPages([horizontal(300), horizontal(100)], 10)).toEqual(NOT_A4)
  })

  it("PG-10: для одной страницы результат совпадает с availableFormats этой страницы", () => {
    const p = horizontal(300)
    expect(availableFormatsForPages([p], 10)).toEqual(availableFormats(p.walls, p.dimensions, 10, p.doorways))
    expect(availableFormatsForPages([p], 10)).toEqual(NOT_A4)
  })

  it("PG-10: страницы считаются каждая по своим габаритам, а не по общему габариту всех: далеко расположенные малые планы дают A4", () => {
    expect(availableFormatsForPages([horizontal(100), far(100)], 10)).toEqual(ALL)
  })

  it("PG-10: результат — пересечение: крупная по ширине и крупная по высоте страницы вместе исключают A4 и оставляют A3", () => {
    expect(availableFormatsForPages([horizontal(300), vertical(200)], 10)).toEqual(NOT_A4)
  })

  it("PG-10: страница, не помещающаяся на A3, исключает A3 и A4", () => {
    expect(availableFormatsForPages([horizontal(100), horizontal(400)], 10)).toEqual(["A2", "A1", "A0"])
  })

  it("PG-11: граница по ширине на второй странице: ровно 272 мм — A4 доступен, +0,1 мм — нет", () => {
    expect(availableFormatsForPages([horizontal(100), horizontal(242)], 10)).toEqual(ALL)
    expect(availableFormatsForPages([horizontal(100), horizontal(242.1)], 10)).toEqual(NOT_A4)
  })

  it("PG-11: граница по ширине на первой странице: результат тот же при обратном порядке", () => {
    expect(availableFormatsForPages([horizontal(242), horizontal(100)], 10)).toEqual(ALL)
    expect(availableFormatsForPages([horizontal(242.1), horizontal(100)], 10)).toEqual(NOT_A4)
  })

  it("PG-11: граница по высоте на второй странице: ровно 145 мм — A4 доступен, +0,1 мм — нет", () => {
    expect(availableFormatsForPages([horizontal(100), vertical(115)], 10)).toEqual(ALL)
    expect(availableFormatsForPages([horizontal(100), vertical(115.1)], 10)).toEqual(NOT_A4)
  })

  it("PG-12: страница без объектов не ограничивает форматы: [крупная, пустая] как [крупная]", () => {
    expect(availableFormatsForPages([horizontal(300), EMPTY], 10)).toEqual(NOT_A4)
    expect(availableFormatsForPages([EMPTY, horizontal(300)], 10)).toEqual(NOT_A4)
  })

  it("PG-12: [малая, пустая] даёт все форматы", () => {
    expect(availableFormatsForPages([horizontal(100), EMPTY], 10)).toEqual(ALL)
  })

  it("PG-12: только пустые страницы и пустой список дают все форматы", () => {
    expect(availableFormatsForPages([EMPTY, EMPTY], 10)).toEqual(ALL)
    expect(availableFormatsForPages([], 10)).toEqual(ALL)
  })

  it("PG-18: размер, вынесенный далеко от стены, ограничивает форматы страницы: сама стена влезает на A4, с размером — нет", () => {
    const wallOnly = page([wall(0, 0, 100, 0, "h")])
    const withDim = page([wall(0, 0, 100, 0, "h")], [], [dim("h", 200)])
    expect(availableFormatsForPages([wallOnly], 10)).toEqual(ALL)
    const formats = availableFormatsForPages([withDim], 10)
    expect(formats).not.toContain("A4")
    expect(formats).toContain("A0")
    expect(formats).toEqual(availableFormats(withDim.walls, withDim.dimensions, 10, withDim.doorways))
    expect(availableFormatsForPages([wallOnly, withDim], 10)).toEqual(formats)
    expect(availableFormatsForPages([withDim, wallOnly], 10)).toEqual(formats)
  })

  it("PG-18: размер на второй странице ограничивает форматы так же, как на единственной", () => {
    const withDim = page([wall(0, 0, 100, 0, "h")], [], [dim("h", 200)])
    expect(availableFormatsForPages([horizontal(100), withDim], 10)).toEqual(availableFormatsForPages([withDim], 10))
  })

  it("PG-19: открывающаяся дверь выходит за стену и ограничивает форматы страницы: стена влезает на A4, с дверью — нет", () => {
    const door: WallDoor = { kind: "door", id: "d", wallId: "h", anchor: "a", offsetCm: 5, widthCm: 140, heightCm: 210, hinge: "a", swing: "left" }
    const wallOnly = page([wall(0, 0, 150, 0, "h")])
    const withDoor = page([wall(0, 0, 150, 0, "h")], [door])
    expect(availableFormatsForPages([wallOnly], 10)).toEqual(ALL)
    const formats = availableFormatsForPages([withDoor], 10)
    expect(formats).not.toContain("A4")
    expect(formats).toEqual(availableFormats(withDoor.walls, withDoor.dimensions, 10, withDoor.doorways))
    expect(availableFormatsForPages([wallOnly, withDoor], 10)).toEqual(formats)
  })

  it("PG-10: учитывает масштаб чертежа: стена 3 м влезает на A4 при 1:100 и не влезает при 1:5", () => {
    const p = horizontal(300)
    expect(availableFormatsForPages([p], 100)).toEqual(ALL)
    expect(availableFormatsForPages([p], 5)).not.toContain("A4")
  })
})
