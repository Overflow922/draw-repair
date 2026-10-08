import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Dimension, Doorway, Wall } from "../types"
import type { PageFormat } from "./pdf"
import { covers, insideRect, parsePaths, pathsBBox, rectEdgesDrawn, strokeSegments } from "./pdf-ops.test-utils"
import type { Rect, Seg } from "./pdf-ops.test-utils"

// change pdf-frame-title-block: рамка, основная надпись и размещение в готовом PDF.
// Векторные операторы разбираются из несжатого потока страницы jsPDF (pdf-ops.test-utils),
// текст фиксируется на вызове doc.text (подмена конструктора jsPDF оставляет реальную отрисовку).

interface TextCall {
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

const { buildPdf, exportDrawing, pdfFileName } = await import("./pdf")
const { drawingArea, frameRect, titleBlockCells, titleBlockRect, FRAME_LINE_MM, GRID_LINE_MM } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")

const wall = (ax: number, ay: number, bx: number, by: number, id = "w"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const W5 = wall(0, 0, 500, 0)
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const dim = (wallId: string, offset: number): Dimension => ({
  from: { a: { wallId, edge: 2 }, b: { wallId, edge: 1 } },
  to: { a: { wallId, edge: 3 }, b: { wallId, edge: 1 } },
  offset,
})

function build(
  walls: Wall[],
  scale: number,
  format: PageFormat,
  name = "Чертёж 1",
  doorways: Doorway[] = [],
  dimensions: Dimension[] = [],
): jsPDF {
  texts.length = 0
  return buildPdf(walls, dimensions, "cm", scale, format, font, doorways, name, SEP)
}

const local = (format: PageFormat, x: number, y: number): { x: number; y: number } => {
  const tb = titleBlockRect(format)
  return { x: tb.x + x, y: tb.y + y }
}

const cellRect = (format: PageFormat, x: number, y: number, w: number, h: number): Rect => {
  const o = local(format, x, y)
  return { x: o.x, y: o.y, w, h }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("страницы PDF", () => {
  it("PG-1: экспорт даёт ровно одну страницу", () => {
    expect(build([W5], 100, "A4").getNumberOfPages()).toBe(1)
  })

  it("PG-1: одна страница и на большом формате", () => {
    expect(build([W5], 100, "A1").getNumberOfPages()).toBe(1)
  })
})

describe("ориентация страницы", () => {
  it("OR-1: формат A3 — страница 420×297 мм", () => {
    const doc = build([W5], 100, "A3")
    expect(doc.internal.pageSize.getWidth()).toBe(420)
    expect(doc.internal.pageSize.getHeight()).toBe(297)
  })

  it("OR-2: широкий чертёж на A4 — 297×210 мм", () => {
    const doc = build([wall(0, 0, 1500, 0)], 100, "A4")
    expect(doc.internal.pageSize.getWidth()).toBe(297)
    expect(doc.internal.pageSize.getHeight()).toBe(210)
  })

  it("OR-3: высокий чертёж на A2 — страница 594×420 мм, не портретная", () => {
    const doc = build([wall(0, 0, 0, 2000)], 100, "A2")
    expect(doc.internal.pageSize.getWidth()).toBe(594)
    expect(doc.internal.pageSize.getHeight()).toBe(420)
  })
})

describe("рамка листа в PDF", () => {
  it.each(["A4", "A3", "A1"] as const)("FR-4/FR-5: %s — прямоугольник рамки нарисован линией 0,8 мм", (f) => {
    const doc = build([W5], 100, f)
    const segs = strokeSegments(parsePaths(doc))
    expect(rectEdgesDrawn(segs, frameRect(f), FRAME_LINE_MM)).toBe(true)
  })

  it("FR-5: толщина линии рамки равна 0,8 мм", () => {
    expect(FRAME_LINE_MM).toBe(0.8)
  })

  it("FR-4: A4 — стороны рамки лежат на x=20, x=292, y=5, y=205 мм", () => {
    const segs = strokeSegments(parsePaths(build([W5], 100, "A4")))
    expect(covers(segs, { x: 20, y: 5 }, { x: 20, y: 205 }, 0.8)).toBe(true)
    expect(covers(segs, { x: 292, y: 5 }, { x: 292, y: 205 }, 0.8)).toBe(true)
    expect(covers(segs, { x: 20, y: 5 }, { x: 292, y: 5 }, 0.8)).toBe(true)
    expect(covers(segs, { x: 20, y: 205 }, { x: 292, y: 205 }, 0.8)).toBe(true)
  })

  it("FR-3: рамка на A4 одинакова при масштабах 1:50 и 1:200", () => {
    for (const scale of [50, 200]) {
      const segs = strokeSegments(parsePaths(build([W5], scale, "A4")))
      expect(rectEdgesDrawn(segs, frameRect("A4"), FRAME_LINE_MM), `1:${scale}`).toBe(true)
    }
  })

})

describe("основная надпись в PDF", () => {
  // Полный набор внутренних линий основной надписи в координатах надписи (мм), коллинеарные части слиты.
  // Источник — геометрия граф из спецификации «Основная надпись»: строки подписной части по 5 мм, границы
  // столбцов x = 10/20/30/40/55 (10 и 30 только в таблице изменений, y 0–20), левая граница правой части x = 65,
  // графа 5 и блок стадии (x 135–185), строка «Лист/Листов» y 35–40.
  const INNER: [string, [number, number], [number, number]][] = [
    ["h y=5", [0, 5], [65, 5]],
    ["h y=10", [0, 10], [65, 10]],
    ["h y=15 (вся ширина)", [0, 15], [185, 15]],
    ["h y=20 (подписная часть)", [0, 20], [65, 20]],
    ["h y=20 (блок стадии)", [135, 20], [185, 20]],
    ["h y=25", [0, 25], [65, 25]],
    ["h y=30", [0, 30], [65, 30]],
    ["h y=35 (подписная часть)", [0, 35], [65, 35]],
    ["h y=35 (блок стадии)", [135, 35], [185, 35]],
    ["h y=40 (вся ширина)", [0, 40], [185, 40]],
    ["h y=45", [0, 45], [65, 45]],
    ["h y=50", [0, 50], [65, 50]],
    ["v x=10 (таблица изменений)", [10, 0], [10, 20]],
    ["v x=20", [20, 0], [20, 55]],
    ["v x=30 (таблица изменений)", [30, 0], [30, 20]],
    ["v x=40", [40, 0], [40, 55]],
    ["v x=55", [55, 0], [55, 55]],
    ["v x=65", [65, 0], [65, 55]],
    ["v x=135", [135, 15], [135, 55]],
    ["v x=150", [150, 15], [150, 35]],
    ["v x=155 (лист/листов)", [155, 35], [155, 40]],
    ["v x=165", [165, 15], [165, 35]],
  ]

  const round2 = (n: number): number => Math.round(n * 100) / 100
  const horizontal = (s: Seg): boolean => Math.abs(s.a.y - s.b.y) < 0.01
  const axisAligned = (s: Seg): boolean => horizontal(s) || Math.abs(s.a.x - s.b.x) < 0.01
  const thin = (segs: readonly Seg[]): Seg[] => segs.filter((s) => Math.abs(s.widthMm - GRID_LINE_MM) < 0.005 && axisAligned(s))
  const thick = (segs: readonly Seg[]): Seg[] => segs.filter((s) => Math.abs(s.widthMm - FRAME_LINE_MM) < 0.005)
  const inRect = (p: { x: number; y: number }, r: Rect, margin: number): boolean =>
    p.x >= r.x - margin && p.x <= r.x + r.w + margin && p.y >= r.y - margin && p.y <= r.y + r.h + margin

  // слитые внутренние линии надписи: "h <y> <x1>-<x2>" / "v <x> <y1>-<y2>" в координатах надписи
  const mergedGrid = (segs: readonly Seg[], f: PageFormat): string[] => {
    const tb = titleBlockRect(f)
    const groups = new Map<string, [number, number][]>()
    for (const s of thin(segs)) {
      if (!inRect(s.a, tb, 0.01) || !inRect(s.b, tb, 0.01)) continue
      const h = horizontal(s)
      const coord = h ? s.a.y - tb.y : s.a.x - tb.x
      const from = (h ? s.a.x : s.a.y) - (h ? tb.x : tb.y)
      const to = (h ? s.b.x : s.b.y) - (h ? tb.x : tb.y)
      const key = `${h ? "h" : "v"} ${round2(coord)}`
      groups.set(key, [...(groups.get(key) ?? []), [Math.min(from, to), Math.max(from, to)]])
    }
    const out: string[] = []
    for (const [key, intervals] of groups) {
      const sorted = [...intervals].sort((p, q) => p[0] - q[0])
      let [lo, hi] = sorted[0] ?? [0, 0]
      for (const [from, to] of sorted.slice(1)) {
        if (from <= hi + 0.02) hi = Math.max(hi, to)
        else {
          out.push(`${key} ${round2(lo)}-${round2(hi)}`)
          lo = from
          hi = to
        }
      }
      out.push(`${key} ${round2(lo)}-${round2(hi)}`)
    }
    return out.sort()
  }
  const expectedGrid = INNER.map(([, [x1, y1], [x2, y2]]) => (y1 === y2 ? `h ${y1} ${x1}-${x2}` : `v ${x1} ${y1}-${y2}`)).sort()

  it.each(["A4", "A1"] as const)("TB-9: %s — контур 185×55 нарисован линией 0,8 мм", (f) => {
    const segs = strokeSegments(parsePaths(build([W5], 100, f)))
    expect(rectEdgesDrawn(segs, titleBlockRect(f), FRAME_LINE_MM)).toBe(true)
  })

  it.each(["A4", "A1"] as const)("TB-9/FR-4: %s — толстые линии 0,8 мм лежат только на рамке и контуре надписи, габарит — ровно рамка", (f) => {
    const segs = thick(strokeSegments(parsePaths(build([W5], 100, f))))
    const tb = titleBlockRect(f)
    const fr = frameRect(f)
    const edges: { fixed: "x" | "y"; at: number; from: number; to: number }[] = [
      { fixed: "x", at: fr.x, from: fr.y, to: fr.y + fr.h },
      { fixed: "x", at: fr.x + fr.w, from: fr.y, to: fr.y + fr.h },
      { fixed: "y", at: fr.y, from: fr.x, to: fr.x + fr.w },
      { fixed: "y", at: fr.y + fr.h, from: fr.x, to: fr.x + fr.w },
      { fixed: "x", at: tb.x, from: tb.y, to: tb.y + tb.h },
      { fixed: "y", at: tb.y, from: tb.x, to: tb.x + tb.w },
    ]
    const onAnEdge = (s: Seg): boolean =>
      edges.some((e) => {
        const ca = e.fixed === "x" ? s.a.x : s.a.y
        const cb = e.fixed === "x" ? s.b.x : s.b.y
        const la = e.fixed === "x" ? s.a.y : s.a.x
        const lb = e.fixed === "x" ? s.b.y : s.b.x
        return Math.abs(ca - e.at) < 0.01 && Math.abs(cb - e.at) < 0.01 && Math.min(la, lb) >= e.from - 0.01 && Math.max(la, lb) <= e.to + 0.01
      })
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.filter((s) => !onAnEdge(s))).toEqual([])
    const bbox = pathsBBox([{ points: segs.flatMap((s) => [s.a, s.b]), closed: false, paint: "stroke", widthMm: FRAME_LINE_MM }])
    expect(bbox?.x).toBeCloseTo(fr.x, 2)
    expect(bbox?.y).toBeCloseTo(fr.y, 2)
    expect(bbox?.w).toBeCloseTo(fr.w, 2)
    expect(bbox?.h).toBeCloseTo(fr.h, 2)
  })

  it("TB-10: толщина внутренних линий — 0,25 мм", () => {
    expect(GRID_LINE_MM).toBe(0.25)
  })

  it.each(INNER)("TB-10: A4 — внутренняя линия %s нарисована тонкой линией 0,25 мм", (_name, [x1, y1], [x2, y2]) => {
    const segs = strokeSegments(parsePaths(build([W5], 100, "A4")))
    expect(covers(segs, local("A4", x1, y1), local("A4", x2, y2), GRID_LINE_MM)).toBe(true)
  })

  it.each(["A4", "A1"] as const)("TB-10: %s — внутренняя сетка состоит ровно из ожидаемых линий, лишних и недостающих нет", (f) => {
    const segs = strokeSegments(parsePaths(build([W5], 100, f)))
    expect(mergedGrid(segs, f)).toEqual(expectedGrid)
  })

  it.each(["A4", "A1"] as const)("TB-10: %s — тонкие горизонтальные и вертикальные линии у надписи не выходят за её границы", (f) => {
    const segs = strokeSegments(parsePaths(build([W5], 100, f)))
    const tb = titleBlockRect(f)
    // диагональная штриховка стен в потоке не клипуется и не учитывается (thin берёт только оси)
    const touching = thin(segs).filter((s) => inRect(s.a, tb, 1) || inRect(s.b, tb, 1))
    expect(touching.length).toBeGreaterThan(0)
    expect(touching.filter((s) => !inRect(s.a, tb, 0.01) || !inRect(s.b, tb, 0.01))).toEqual([])
  })

  it("TB-10: внутри основной надписи нет толстых линий 0,8 мм", () => {
    const segs = strokeSegments(parsePaths(build([W5], 100, "A4")))
    const tb = titleBlockRect("A4")
    const inner = segs.filter(
      (s) =>
        Math.abs(s.widthMm - FRAME_LINE_MM) < 0.005 &&
        [s.a, s.b].every((p) => p.x > tb.x + 0.1 && p.x < tb.x + tb.w - 0.1 && p.y > tb.y + 0.1 && p.y < tb.y + tb.h - 0.1),
    )
    expect(inner).toEqual([])
  })

  it("TB-3: размеры 185×55 мм одинаковы на A4 при 1:100 и на A1 при 1:20, примыкают к рамке", () => {
    const small = strokeSegments(parsePaths(build([W5], 100, "A4")))
    const big = strokeSegments(parsePaths(build([W5], 20, "A1")))
    for (const [segs, f] of [[small, "A4"], [big, "A1"]] as const) {
      const tb = titleBlockRect(f)
      const fr = frameRect(f)
      expect(tb.w).toBe(185)
      expect(tb.h).toBe(55)
      expect(tb.x + tb.w).toBe(fr.x + fr.w)
      expect(tb.y + tb.h).toBe(fr.y + fr.h)
      expect(rectEdgesDrawn(segs, tb, FRAME_LINE_MM), f).toBe(true)
    }
  })

  it("TB-4: внутренняя сетка (в координатах надписи) на A4 при 1:100 и на A1 при 1:20 одна и та же", () => {
    const small = strokeSegments(parsePaths(build([W5], 100, "A4")))
    const big = strokeSegments(parsePaths(build([W5], 20, "A1")))
    expect(mergedGrid(small, "A4")).toEqual(expectedGrid)
    expect(mergedGrid(big, "A1")).toEqual(expectedGrid)
    expect(mergedGrid(big, "A1")).toEqual(mergedGrid(small, "A4"))
  })
})

describe("заполнение основной надписи в PDF", () => {
  const within = (call: TextCall, cell: Rect, tol = 0.05): boolean => {
    const left = call.align === "center" ? call.x - call.widthMm / 2 : call.align === "right" ? call.x - call.widthMm : call.x
    const f = call.fontMm
    const [top, bottom] =
      call.baseline === "top" || call.baseline === "hanging"
        ? [call.y, call.y + f]
        : call.baseline === "middle"
          ? [call.y - f / 2, call.y + f / 2]
          : call.baseline === "bottom" || call.baseline === "ideographic"
            ? [call.y - f, call.y]
            : [call.y - 0.75 * f, call.y + 0.25 * f]
    return left >= cell.x - tol && left + call.widthMm <= cell.x + cell.w + tol && top >= cell.y - tol && bottom <= cell.y + cell.h + tol
  }
  const only = (text: string): TextCall => {
    const found = texts.filter((t) => t.text === text)
    const [first] = found
    if (found.length !== 1 || !first) throw new Error(`текст «${text}»: вызовов ${found.length}`)
    return first
  }

  it("FL-6: имя, «Р», масштаб и месяц-год стоят каждый в своей графе (1, 6, 25, 13)", () => {
    build([W5], 100, "A4", "Чертёж 1")
    expect(within(only("Чертёж 1"), cellRect("A4", 65, 0, 120, 15))).toBe(true)
    expect(within(only("Р"), cellRect("A4", 135, 20, 15, 15))).toBe(true)
    expect(within(only("1:100"), cellRect("A4", 165, 20, 20, 15))).toBe(true)
    expect(within(only("09.26"), cellRect("A4", 55, 20, 10, 5))).toBe(true)
  })

  it("FL-6: на A1 при 1:20 надпись заполнена теми же текстами в тех же графах", () => {
    build([W5], 20, "A1", "Чертёж 1")
    expect(within(only("Чертёж 1"), cellRect("A1", 65, 0, 120, 15))).toBe(true)
    expect(within(only("1:20"), cellRect("A1", 165, 20, 20, 15))).toBe(true)
    expect(within(only("Р"), cellRect("A1", 135, 20, 15, 15))).toBe(true)
    expect(within(only("09.26"), cellRect("A1", 55, 20, 10, 5))).toBe(true)
  })

  it.each([
    ["A4", 100],
    ["A1", 20],
  ] as const)("TB-5: %s — все 11 заголовков граф нарисованы внутри своих граф, и в надписи нет другого текста", (f, scale) => {
    build([W5], scale, f, "Чертёж 1")
    const captions = titleBlockCells().filter((c) => c.label !== undefined)
    expect(captions).toHaveLength(11)
    for (const c of captions) {
      const rect = cellRect(f, c.x, c.y, c.w, c.h)
      const drawn = texts.filter((t) => t.text === c.label && within(t, rect))
      expect(drawn.length, `«${c.label}» в ${JSON.stringify(rect)}`).toBeGreaterThanOrEqual(1)
    }
    const tb = titleBlockRect(f)
    const inBlock = texts
      .filter((t) => t.x >= tb.x - 0.01 && t.x <= tb.x + tb.w + 0.01 && t.y >= tb.y - 0.01 && t.y <= tb.y + tb.h + 1)
      .map((t) => t.text)
      .sort()
    const expected = [...captions.map((c) => c.label ?? ""), "Чертёж 1", "Р", `1:${scale}`, "09.26"].sort()
    expect(inBlock).toEqual(expected)
  })

  it("FL-3: в графе 5 нет текста", () => {
    build([W5], 100, "A4", "Чертёж 1")
    const cell5 = cellRect("A4", 65, 15, 70, 25)
    const inside = texts.filter((t) => t.x >= cell5.x && t.x <= cell5.x + cell5.w && t.y >= cell5.y && t.y <= cell5.y + cell5.h)
    expect(inside).toEqual([])
  })

  // имя из одних «Д» (возможно с многоточием при сокращении); заголовок «Дата» сюда не попадает
  const LONG = "Д".repeat(300)
  const longNameCalls = (): TextCall[] => texts.filter((t) => /^Д{5,}[….]*$/.test(t.text))

  it("FL-4: очень длинное имя целиком остаётся в пределах графы 1", () => {
    build([W5], 100, "A4", LONG)
    const calls = longNameCalls()
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(within(c, cellRect("A4", 65, 0, 120, 15))).toBe(true)
  })

  it("FL-4: длинное имя на A1 тоже в пределах графы 1", () => {
    build([W5], 100, "A1", LONG)
    const calls = longNameCalls()
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(within(c, cellRect("A1", 65, 0, 120, 15))).toBe(true)
  })

  it("FL-5: имя средней длины в пределах графы 1", () => {
    build([W5], 100, "A4", "Реконструкция квартиры, этаж 3, корпус 2, секция Б")
    const calls = texts.filter((t) => t.text.startsWith("Реконструкция"))
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(within(c, cellRect("A4", 65, 0, 120, 15))).toBe(true)
  })

  it("FL-5: короткое имя не уменьшается — кегль как у обычного имени «Чертёж 1», длинное не крупнее", () => {
    build([W5], 100, "A4", "Чертёж 1")
    const standard = only("Чертёж 1").fontMm
    build([W5], 100, "A4", "Ч")
    expect(only("Ч").fontMm).toBe(standard)
    build([W5], 100, "A4", LONG)
    const longCalls = longNameCalls()
    expect(longCalls.length).toBeGreaterThan(0)
    for (const c of longCalls) expect(c.fontMm).toBeLessThanOrEqual(standard)
  })

  it("FL-3: имя чертежа не попадает в графу 5 даже при совпадении с её названием", () => {
    build([W5], 100, "A4", "Наименование страницы")
    const cell5 = cellRect("A4", 65, 15, 70, 25)
    const inside = texts.filter((t) => t.x >= cell5.x && t.x <= cell5.x + cell5.w && t.y >= cell5.y && t.y <= cell5.y + cell5.h)
    expect(inside).toEqual([])
  })
})

describe("размещение чертежа в PDF", () => {
  // Габариты чертежа — по контурам стен (линия PDF_METRICS.contourPx = 0,6 мм): штриховка в потоке идёт без
  // учёта клипа и выходит за стену, рамка и надпись рисуются линиями 0,8 и 0,25 мм.
  const CONTOUR_MM = 0.6
  const ink = (doc: jsPDF): Rect => {
    const paths = parsePaths(doc).filter((p) => p.paint === "stroke" && Math.abs(p.widthMm - CONTOUR_MM) < 0.005)
    const box = pathsBBox(paths)
    if (!box) throw new Error("контуры стен не нарисованы")
    return box
  }

  it("PL-5: стена 5 м при 1:100 имеет на листе длину 50 мм и лежит внутри области чертежа", () => {
    const area = drawingArea("A4")
    const box = ink(build([W5], 100, "A4"))
    expect(box.w).toBeCloseTo(50, 0)
    expect(insideRect(box, area)).toBe(true)
  })

  it("PL-2: чертёж центрирован в области чертежа, а не на странице", () => {
    const area = drawingArea("A4")
    const box = ink(build([W5], 100, "A4"))
    expect(box.x + box.w / 2).toBeCloseTo(area.x + area.w / 2, 0)
    expect(box.y + box.h / 2).toBeCloseTo(area.y + area.h / 2, 0)
  })

  it("PL-5: чертёж на A3 лежит внутри области A3 и не заходит на основную надпись", () => {
    const f: PageFormat = "A3"
    const box = ink(build([wall(0, 0, 2500, 0), wall(2500, 0, 2500, 1500)], 100, f))
    expect(insideRect(box, drawingArea(f))).toBe(true)
    expect(box.y + box.h).toBeLessThanOrEqual(titleBlockRect(f).y + 0.01)
  })

  it("PL-5: крупный чертёж 25×12 м при 1:100 на A4 (около 262×132 мм с запасом) остаётся внутри области", () => {
    const area = drawingArea("A4")
    const box = ink(build([wall(0, 0, 2500, 0), wall(2500, 0, 2500, 1200)], 100, "A4"))
    expect(insideRect(box, area)).toBe(true)
  })

  it("PL-4: подписи длины — одинаковые строки и кегль при 1:100 и 1:50", () => {
    // подписи с числами в сцене — только у размеров: ставим один размер на стену
    const labels = (scale: number): { text: string; fontMm: number }[] => {
      build([W5], scale, "A4", "Чертёж 1", [], [dim("w", 60)])
      const tb = titleBlockRect("A4")
      return texts.filter((t) => t.y < tb.y - 1 && /^\d/.test(t.text)).map((t) => ({ text: t.text, fontMm: t.fontMm }))
    }
    const a = labels(100)
    const b = labels(50)
    expect(a.length).toBeGreaterThan(0)
    expect(b).toEqual(a)
  })
})

describe("интеграция", () => {
  const D: Doorway = { id: "d0", wallId: "w", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210 }

  it("IN-1: чертёж с проёмом — рамка и надпись на месте, подпись «H=210» вне основной надписи", () => {
    const doc = build([W5], 100, "A4", "Чертёж 1", [D])
    expect(doc.getNumberOfPages()).toBe(1)
    const segs = strokeSegments(parsePaths(doc))
    expect(rectEdgesDrawn(segs, frameRect("A4"), FRAME_LINE_MM)).toBe(true)
    expect(rectEdgesDrawn(segs, titleBlockRect("A4"), FRAME_LINE_MM)).toBe(true)
    const label = texts.find((t) => t.text === "H=210")
    expect(label).toBeDefined()
    expect(label ? label.y < titleBlockRect("A4").y : false).toBe(true)
  })

  it("IN-3: exportDrawing передаёт имя чертежа и один момент времени и в надпись, и в имя файла", () => {
    vi.useFakeTimers()
    vi.setSystemTime(SEP)
    const anchor = { href: "", download: "", click: vi.fn() }
    vi.stubGlobal("document", { createElement: () => anchor })
    texts.length = 0
    exportDrawing([W5], [], "cm", 100, "A4", "Чертёж 1")
    expect(anchor.download).toBe(pdfFileName("Чертёж 1", SEP))
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(texts.some((t) => t.text === "Чертёж 1")).toBe(true)
    expect(texts.some((t) => t.text === "09.26")).toBe(true)
    expect(texts.some((t) => t.text === "1:100")).toBe(true)
  })
})
