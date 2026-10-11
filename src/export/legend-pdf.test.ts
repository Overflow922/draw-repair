import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import { LIGHT_PALETTE } from "../theme"
import type { DemolitionMark, Doorway, Wall, WallDoor, WallWindow } from "../types"
import type { PageFormat, PlanPage } from "./pdf"
import { hexToRgb01, isRed, sameColor } from "./pdf-colors.test-utils"
import { insideRect, parsePaths, pathsBBox } from "./pdf-ops.test-utils"
import type { Rect } from "./pdf-ops.test-utils"
import { parseStyledStrokes, visibleBBox } from "./pdf-style.test-utils"
import type { StyledPoint, StyledStroke } from "./pdf-style.test-utils"

// change pdf-legend (ревизия 2): легенда на страницах PDF (spec pdf-export «Легенда на странице PDF», «Область чертежа
// внутри рамки»; design D4–D7; test-plan LG-1…LG-15, AR-6). В легенде только материалы стен и «Демонтируемая стена»;
// образцы 2:1 с отступом от левой границы области, подпись справа, длинная подпись переносится по пробелу.
// Подписи фиксируются на вызове doc.text вместе с номером страницы, кеглем и выравниванием; пути, цвет, толщина и рисунок
// штрихов разбираются из потока операторов страницы. Штриховка в потоке длиннее образца (обрезается клиппингом), поэтому
// границы образца берутся по сплошному контуру (штрихи толще штриховки), а не по сырой геометрии штриховки.

interface TextCall {
  page: number
  text: string
  x: number
  y: number
  fontMm: number
  align: "left" | "center" | "right"
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
          const [text, x, y, opts] = args
          const lines = typeof text === "string" ? [text] : Array.isArray(text) ? text.filter((t): t is string => typeof t === "string") : []
          const requested: unknown = typeof opts === "object" && opts !== null ? Reflect.get(opts, "align") : undefined
          const align = requested === "center" || requested === "right" ? requested : "left"
          if (typeof x === "number" && typeof y === "number") {
            for (const line of lines)
              texts.push({ page: this.getCurrentPageInfo().pageNumber, text: line, x, y, fontMm: this.getFontSize() / this.internal.scaleFactor, align })
          }
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages } = await import("./pdf")
const { legendWidthMm } = await import("./legend")
const { drawingArea, frameRect, legendArea } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const TOL = 0.01
const HATCH_MM = 0.25
const LABEL_LIMIT_MM = 28 // предельная ширина подписи (design D6)
const INK = hexToRgb01(LIGHT_PALETTE.ink)
const MUTED = hexToRgb01(LIGHT_PALETTE.muted)

const wall = (id: string, type: Wall["type"], y: number): Wall => ({ id, a: { x: 0, y }, b: { x: 500, y }, thicknessCm: 20, type })
const BRICK = wall("w1", "brick", 0)
const CONCRETE = wall("w2", "concrete", 300)
const DOOR: WallDoor = { kind: "door", id: "dr", wallId: "w1", anchor: "a", offsetCm: 200, widthCm: 90, heightCm: 210, hinge: "a", swing: "left" }
const MARK: DemolitionMark = { id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }

const doorwayOn = (wallId: string): Doorway => ({ id: "dw", wallId, anchor: "a", offsetCm: 20, widthCm: 90, heightCm: 210 })
const doorOn = (wallId: string): WallDoor => ({ ...DOOR, wallId, offsetCm: 150 })
const windowOn = (wallId: string): WallWindow => ({ kind: "window", id: "wn", wallId, anchor: "a", offsetCm: 300, widthCm: 90, heightCm: 150, sillCm: 85 })

const page = (walls: Wall[], doorways: PlanPage["doorways"] = [], demolition?: PlanPage["demolition"], title?: string): PlanPage => {
  const base: PlanPage = { walls, dimensions: [], doorways }
  return { ...base, ...(demolition === undefined ? {} : { demolition }), ...(title === undefined ? {} : { title }) }
}
const EMPTY = page([])

// обмерочная страница с дверью, страница «Демонтаж» с пометкой, «Монтаж» только с бетоном
const MEASURE = page([BRICK, CONCRETE], [DOOR], undefined, "Обмерочный план")
const DEMOLITION = page([BRICK, CONCRETE], [DOOR], effectiveMarks([MARK], [BRICK, CONCRETE], [DOOR]), "Демонтаж")
const MOUNTING = page([CONCRETE], [], undefined, "Монтаж")

// ширина столбца документа последней сборки: линии легенды тех же толщин и цветов, что и линии чертежа
let columnMm = 0

function build(pages: PlanPage[], scale = 100, format: PageFormat = "A4"): jsPDF {
  texts.length = 0
  columnMm = legendWidthMm(pages)
  return buildPdfPages(pages, "cm", scale, format, font, "Чертёж 1", SEP)
}

const colOf = (format: PageFormat = "A4"): Rect => legendArea(format, columnMm)
const areaOf = (format: PageFormat = "A4"): Rect => drawingArea(format, columnMm)

const textsOn = (n: number): TextCall[] => texts.filter((t) => t.page === n)
const labelsOn = (n: number): string[] => textsOn(n).map((t) => t.text)
// подписи легенды: тексты столбца над основной надписью, по порядку вывода
const legendTextsOn = (n: number, format: PageFormat = "A4"): TextCall[] => {
  const col = colOf(format)
  const area = areaOf(format)
  return textsOn(n).filter((t) => t.x >= col.x - TOL && t.x < area.x && t.y <= col.y + col.h)
}
const legendLinesOn = (n: number, format: PageFormat = "A4"): string[] => legendTextsOn(n, format).map((t) => t.text)

// горизонтальные границы подписи на листе по её выравниванию и реальной ширине текста PTSans при записанном кегле
function extentOf(doc: jsPDF, t: TextCall): { left: number; right: number } {
  doc.setFont("PTSans", "normal")
  doc.setFontSize(t.fontMm * doc.internal.scaleFactor)
  const w = doc.getTextWidth(t.text)
  if (t.align === "center") return { left: t.x - w / 2, right: t.x + w / 2 }
  if (t.align === "right") return { left: t.x - w, right: t.x }
  return { left: t.x, right: t.x + w }
}

const isHatchWidth = (s: StyledStroke): boolean => Math.abs(s.widthMm - HATCH_MM) < TOL
const isSolid = (s: StyledStroke): boolean => s.widthMm > HATCH_MM + 0.05
const segmentsOf = (s: StyledStroke): { a: StyledPoint; b: StyledPoint }[] =>
  s.subpaths.flatMap((sp) => sp.slice(1).map((q, i) => ({ a: sp[i] as StyledPoint, b: q })))
const isDiagonal = (g: { a: StyledPoint; b: StyledPoint }): boolean => Math.abs(Math.abs(g.b.x - g.a.x) - Math.abs(g.b.y - g.a.y)) < 0.05 && Math.abs(g.b.x - g.a.x) > 0.5
const allPoints = (s: StyledStroke): StyledPoint[] => s.subpaths.flat()

// штрихи столбца легенды (левее области чертежа) и чертёжной части страницы (правее столбца, над основной надписью)
const inColumn = (strokes: StyledStroke[], area: Rect): StyledStroke[] => strokes.filter((s) => allPoints(s).every((p) => p.x <= area.x + TOL))
const inChart = (strokes: StyledStroke[], area: Rect): StyledStroke[] =>
  strokes.filter((s) => allPoints(s).every((p) => p.x >= area.x - TOL && p.y <= area.y + area.h + TOL))

const bboxOf = (strokes: StyledStroke[]): Rect | null => {
  const pts = strokes.flatMap(allPoints)
  if (pts.length === 0) return null
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

// образцы столбца: сплошные контуры, слитые по вертикали в ряды (по одному ряду на запись), сверху вниз
function sampleRows(doc: jsPDF, n: number, format: PageFormat = "A4"): Rect[] {
  const boxes = inColumn(parseStyledStrokes(doc, n), areaOf(format))
    .filter(isSolid)
    .map((s) => bboxOf([s]))
    .filter((b): b is Rect => b !== null)
    .sort((a, b) => a.y - b.y)
  const rows: Rect[] = []
  for (const b of boxes) {
    const last = rows[rows.length - 1]
    if (last && b.y <= last.y + last.h + TOL) {
      const x = Math.min(last.x, b.x)
      const y = Math.min(last.y, b.y)
      rows[rows.length - 1] = { x, y, w: Math.max(last.x + last.w, b.x + b.w) - x, h: Math.max(last.y + last.h, b.y + b.h) - y }
    } else rows.push(b)
  }
  return rows
}

// признаки рисунка штриховки материала: сплошная/пунктирная диагональ, волна вдоль стены, наклон диагоналей
interface MaterialLook {
  solidDiagonal: boolean
  dashedDiagonal: boolean
  dashes: string[] // рисунки пунктира диагоналей (по возрастанию)
  pitch: number | null // шаг между соседними параллельными диагоналями, мм (округлён до 0,01)
  wavy: boolean
  slope: "rising" | "falling" | "none"
}
function lookOf(strokes: StyledStroke[]): MaterialLook {
  const hatch = strokes.filter(isHatchWidth)
  const diagonal = hatch.flatMap((s) => segmentsOf(s).filter(isDiagonal).map((g) => ({ s, g })))
  const sign = diagonal.map(({ g }) => Math.sign((g.b.x - g.a.x) * (g.b.y - g.a.y)))
  const rising = sign.filter((v) => v < 0).length
  const falling = sign.filter((v) => v > 0).length
  // линия диагонали задаётся константой x + y (45°) или y − x (135°); шаг — наименьшая положительная разность констант
  const constants = [...new Set(diagonal.map(({ g }) => Math.round((Math.sign((g.b.x - g.a.x) * (g.b.y - g.a.y)) < 0 ? g.a.x + g.a.y : g.a.y - g.a.x) * 100) / 100))].sort((a, b) => a - b)
  const gaps = constants.slice(1).map((c, i) => Math.round((c - (constants[i] ?? 0)) * 100) / 100).filter((d) => d > 0.01)
  return {
    solidDiagonal: diagonal.some(({ s }) => s.dash.length === 0),
    dashedDiagonal: diagonal.some(({ s }) => s.dash.length > 0),
    dashes: [...new Set(diagonal.filter(({ s }) => s.dash.length > 0).map(({ s }) => s.dash.map((d) => Math.round(d * 100) / 100).join(",")))].sort(),
    pitch: gaps.length === 0 ? null : Math.min(...gaps),
    wavy: hatch.some((s) => s.subpaths.some((sp) => sp.length >= 4)),
    slope: rising === 0 && falling === 0 ? "none" : rising >= falling ? "rising" : "falling",
  }
}

describe("состав записей на листах документа", () => {
  const pages = [MEASURE, DEMOLITION, MOUNTING]

  it("LG-1: на листе «Обмерочный план» подписи «Кирпич», «Бетон» в порядке записей, подписи двери нет", () => {
    build(pages)
    expect(legendLinesOn(1)).toEqual(["Кирпич", "Бетон"])
  })

  it("LG-4, LG-15: на листе «Демонтаж» — «Кирпич», «Бетон», затем «Демонтируемая стена» двумя строками", () => {
    build(pages)
    expect(legendLinesOn(2)).toEqual(["Кирпич", "Бетон", "Демонтируемая", "стена"])
  })

  it("LG-6: у каждого листа своя легенда: «Монтаж» только с бетоном — только «Бетон»", () => {
    build(pages)
    expect(legendLinesOn(3)).toEqual(["Бетон"])
  })

  it("LG-2: на листах нет лишних записей материалов и сноса", () => {
    build([MEASURE, MOUNTING])
    for (const absent of ["Железобетон", "Дерево", "Демонтируемая"]) expect(legendLinesOn(1)).not.toContain(absent)
    for (const absent of ["Кирпич", "Демонтируемая"]) expect(legendLinesOn(2)).not.toContain(absent)
  })

  it("LG-3: окно, дверь и проём в легенду не входят: на листе нет подписей «Проём», «Дверь», «Окно» вообще", () => {
    build([page([BRICK], [windowOn("w1"), doorOn("w1"), doorwayOn("w1")])])
    expect(legendLinesOn(1)).toEqual(["Кирпич"])
    for (const word of ["Проём", "Дверь", "Окно"]) expect(labelsOn(1)).not.toContain(word)
  })

  it("LG-3: на странице «Демонтаж» с элементами легенда — только материалы и снос", () => {
    const elements = [doorwayOn("w2"), doorOn("w2"), windowOn("w2")]
    const p = page([BRICK, CONCRETE], elements, effectiveMarks([MARK], [BRICK, CONCRETE], elements), "Демонтаж")
    expect(p.demolition?.length).toBe(1)
    build([p])
    expect(legendLinesOn(1)).toEqual(["Кирпич", "Бетон", "Демонтируемая", "стена"])
  })

  it("LG-5: «Демонтаж» без действующих пометок — записи «Демонтируемая стена» нет", () => {
    build([MEASURE, page([BRICK, CONCRETE], [DOOR], [], "Демонтаж")])
    expect(legendLinesOn(2)).toEqual(["Кирпич", "Бетон"])
  })

  it("LG-3: элемент, стены которого на странице нет, записи не создаёт и экспорт не ломает", () => {
    build([page([BRICK], [{ ...DOOR, wallId: "gone" }])])
    expect(legendLinesOn(1)).toEqual(["Кирпич"])
  })

  it("LG-7: страница без стен рядом со страницами со стенами — подписей легенды на ней нет", () => {
    build([MEASURE, EMPTY])
    expect(legendLinesOn(1)).toEqual(["Кирпич", "Бетон"])
    expect(legendLinesOn(2)).toEqual([])
  })

  it("LG-8: ни на одной странице нет стен — подписей легенды нет, столбца нет", () => {
    const doc = build([EMPTY, EMPTY])
    expect(legendLinesOn(1)).toEqual([])
    expect(legendLinesOn(2)).toEqual([])
    expect(legendWidthMm([EMPTY, EMPTY])).toBe(0)
    expect(doc.getNumberOfPages()).toBe(2)
  })

  it("LG-2: в PDF нет записей для объектов, которых нет в приложении", () => {
    build([MEASURE, DEMOLITION, MOUNTING])
    for (const n of [1, 2, 3])
      for (const absent of ["Газобетон", "Вентканал", "Канализационные коммуникации", "Радиатор"]) expect(labelsOn(n)).not.toContain(absent)
  })

  it("LG-3: подпись высоты двери «H=210» стоит на чертеже, а не в легенде", () => {
    build([MEASURE])
    const area = areaOf()
    const heights = textsOn(1).filter((t) => t.text.startsWith("H="))
    expect(heights.map((t) => t.text)).toEqual(["H=210"])
    expect(heights[0]?.x ?? 0).toBeGreaterThanOrEqual(area.x)
  })
})

describe("положение легенды на листе", () => {
  const pages = [MEASURE, DEMOLITION, MOUNTING]

  it("LG-10: подписи — в столбце легенды, ниже одна другой в порядке записей, первая у верхнего края", () => {
    const doc = build(pages)
    const col = colOf()
    const area = areaOf()
    const on = legendTextsOn(2)
    expect(on.map((t) => t.text)).toEqual(["Кирпич", "Бетон", "Демонтируемая", "стена"])
    for (const t of on) {
      const { left, right } = extentOf(doc, t)
      expect(left, t.text).toBeGreaterThanOrEqual(col.x - TOL)
      expect(right, t.text).toBeLessThanOrEqual(area.x + TOL)
      expect(t.y, t.text).toBeGreaterThanOrEqual(col.y - TOL)
      expect(t.y, t.text).toBeLessThanOrEqual(col.y + col.h)
    }
    for (let i = 1; i < on.length; i++) expect(on[i]?.y ?? 0, on[i]?.text).toBeGreaterThan(on[i - 1]?.y ?? Infinity)
    const rows = sampleRows(doc, 2)
    const pitch = (rows[1]?.y ?? 0) - (rows[0]?.y ?? 0)
    expect((on[0]?.y ?? Infinity) - col.y).toBeLessThan(pitch)
  })

  it("LG-10: контуры образцов лежат в столбце и начинаются у верха области", () => {
    const doc = build(pages)
    const col = colOf()
    for (const n of [1, 2, 3]) {
      const rows = sampleRows(doc, n)
      expect(rows.length, `страница ${n}`).toBeGreaterThan(0)
      for (const r of rows) expect(insideRect(r, col), `страница ${n}`).toBe(true)
      const first = rows[0]
      const pitch = rows.length > 1 ? (rows[1]?.y ?? 0) - (first?.y ?? 0) : col.h
      expect((first?.y ?? Infinity) - col.y, `страница ${n}`).toBeLessThan(pitch)
    }
  })

  it("LG-14: образцы начинаются на положительном, одинаковом для всех записей и страниц расстоянии от левой границы области", () => {
    const doc = build(pages)
    const col = colOf()
    const offsets = [1, 2, 3].flatMap((n) => sampleRows(doc, n).map((r) => r.x - col.x))
    expect(offsets.length).toBe(2 + 3 + 1)
    for (const o of offsets) {
      expect(o).toBeGreaterThan(1)
      expect(o).toBeCloseTo(offsets[0] ?? 0, 2)
    }
  })

  it("LG-14: образцы 2:1 (ширина вдвое больше высоты), не выше шага записей", () => {
    const doc = build(pages)
    for (const n of [1, 2, 3]) {
      const rows = sampleRows(doc, n)
      for (const r of rows) {
        expect(r.w / r.h, `страница ${n}`).toBeCloseTo(2, 1)
        expect(r.h, `страница ${n}`).toBeGreaterThan(3)
      }
      const pitch = (rows[1]?.y ?? 0) - (rows[0]?.y ?? 0)
      if (rows.length > 1) expect(rows[0]?.h ?? Infinity).toBeLessThan(pitch)
    }
  })

  it("LG-14: шаг между записями одинаков внутри страницы и на всех страницах (в том числе перед записью с переносом)", () => {
    const doc = build(pages)
    const steps = [1, 2, 3].flatMap((n) => {
      const rows = sampleRows(doc, n)
      return rows.slice(1).map((r, i) => r.y - (rows[i]?.y ?? 0))
    })
    expect(steps.length).toBe(1 + 2)
    for (const s of steps) expect(s).toBeCloseTo(steps[0] ?? 0, 2)
    expect(steps[0] ?? 0).toBeGreaterThan(8)
  })

  it("LG-10: образец стоит слева от подписи: подпись начинается правее образца", () => {
    const doc = build(pages)
    const rows = sampleRows(doc, 2)
    for (const t of legendTextsOn(2)) {
      const row = rows.reduce((best, r) => (Math.abs(r.y + r.h / 2 - t.y) < Math.abs(best.y + best.h / 2 - t.y) ? r : best))
      expect(extentOf(doc, t).left, t.text).toBeGreaterThan(row.x + row.w)
    }
  })

  it("LG-15: однострочная подпись по центру образца по высоте", () => {
    const doc = build(pages)
    const rows = sampleRows(doc, 1)
    const on = legendTextsOn(1)
    expect(on.length).toBe(rows.length)
    on.forEach((t, i) => {
      const r = rows[i]
      expect(r).toBeDefined()
      if (r) expect(t.y - 0.35 * t.fontMm, t.text).toBeCloseTo(r.y + r.h / 2, 0)
    })
  })

  it("LG-15: «Демонтируемая стена» — две строки с общим левым краем, вторая ниже, обе не шире предела; образец по центру блока", () => {
    const doc = build(pages)
    const rows = sampleRows(doc, 2)
    const [first, second] = legendTextsOn(2).filter((t) => t.text === "Демонтируемая" || t.text === "стена")
    expect(first?.text).toBe("Демонтируемая")
    expect(second?.text).toBe("стена")
    if (!first || !second) return
    expect(second.x).toBeCloseTo(first.x, 3)
    expect(second.y).toBeGreaterThan(first.y + 3)
    expect(second.y - first.y).toBeLessThan(7)
    for (const t of [first, second]) {
      const { left, right } = extentOf(doc, t)
      expect(right - left, t.text).toBeLessThanOrEqual(LABEL_LIMIT_MM + TOL)
    }
    const row = rows[2]
    expect(row).toBeDefined()
    if (row) expect((first.y + second.y) / 2 - 0.35 * first.fontMm).toBeCloseTo(row.y + row.h / 2, 0)
  })

  it("LG-15: следующая запись не накладывается на блок: подписи разных записей ниже предыдущей и их y возрастают", () => {
    const doc = build([page([BRICK, CONCRETE], [], effectiveMarks([MARK], [BRICK, CONCRETE], []), "Демонтаж")])
    const rows = sampleRows(doc, 1)
    const ys = legendTextsOn(1).map((t) => t.y)
    for (let i = 1; i < ys.length; i++) expect(ys[i] ?? 0).toBeGreaterThan(ys[i - 1] ?? Infinity)
    for (let i = 1; i < rows.length; i++) expect(rows[i]?.y ?? 0).toBeGreaterThan((rows[i - 1]?.y ?? 0) + (rows[i - 1]?.h ?? 0))
  })

  it("LG-11: ни один путь страницы не пересекает границу между столбцом легенды и областью чертежа", () => {
    const doc = build(pages)
    const area = areaOf()
    const frame = frameRect("A4")
    for (const n of [1, 2, 3]) {
      for (const p of parsePaths(doc, n)) {
        const b = pathsBBox([p])
        if (!b) continue
        const isFrame = Math.abs(b.x - frame.x) < TOL && Math.abs(b.w - frame.w) < TOL
        const inCol = b.x + b.w <= area.x + TOL
        const inDrawing = b.x >= area.x - TOL
        expect(isFrame || inCol || inDrawing, `страница ${n}: путь ${b.x.toFixed(2)}…${(b.x + b.w).toFixed(2)}`).toBe(true)
      }
    }
  })

  it("LG-11: с учётом клиппинга ни один видимый штрих страницы не выходит за рамку листа, а штрихи столбца — за столбец", () => {
    const doc = build(pages)
    const col = colOf()
    const area = areaOf()
    const frame = frameRect("A4")
    for (const n of [1, 2, 3]) {
      for (const s of parseStyledStrokes(doc, n)) {
        const b = visibleBBox(s)
        if (!b) continue
        expect(insideRect(b, frame), `страница ${n}: штрих ${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.w.toFixed(2)}×${b.h.toFixed(2)}`).toBe(true)
        if (b.x + b.w / 2 < area.x) expect(insideRect(b, col), `страница ${n}: штрих столбца ${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.w.toFixed(2)}×${b.h.toFixed(2)}`).toBe(true)
      }
    }
  })

  it("LG-11: легенда с максимумом записей (4 материала и снос) не выходит за столбец ни на одном формате", () => {
    const walls = [wall("w1", "brick", 0), wall("w2", "concrete", 300), wall("w3", "reinforced", 600), wall("w4", "wood-long", 900)]
    const full = page(walls, [], effectiveMarks([MARK], walls, []), "Демонтаж")
    expect(full.demolition?.length).toBe(1)
    for (const format of ["A4", "A3", "A2", "A1", "A0"] as const) {
      const doc = build([full], 200, format)
      const column = colOf(format)
      const drawn = areaOf(format)
      // перенос «Дерево (вдоль)» спекой не задан: строки, склеенные пробелом, дают подписи в порядке записей
      expect(legendLinesOn(1, format).join(" "), format).toBe("Кирпич Бетон Железобетон Дерево (вдоль) Демонтируемая стена")
      expect(legendLinesOn(1, format)[0], format).toBe("Кирпич")
      expect(legendLinesOn(1, format).slice(-2), format).toEqual(["Демонтируемая", "стена"])
      for (const t of legendTextsOn(1, format)) {
        const { left, right } = extentOf(doc, t)
        expect(left, `${format} ${t.text}`).toBeGreaterThanOrEqual(column.x - TOL)
        expect(right, `${format} ${t.text}`).toBeLessThanOrEqual(drawn.x + TOL)
        expect(t.y, `${format} ${t.text}`).toBeGreaterThanOrEqual(column.y - TOL)
        expect(t.y, `${format} ${t.text}`).toBeLessThanOrEqual(column.y + column.h)
      }
      const rows = sampleRows(doc, 1, format)
      expect(rows.length, format).toBe(5)
      for (const r of rows) expect(insideRect(r, column), format).toBe(true)
    }
  })

  it("AR-6: чертёж на листе центрирован в области без колонки: левый и правый зазоры до границ области равны", () => {
    const only = page([BRICK])
    const doc = build([only], 100)
    const drawn = areaOf()
    const bbox = bboxOf(inChart(parseStyledStrokes(doc, 1), drawn).filter(isSolid).filter((s) => !isFrameLike(s)))
    expect(bbox).not.toBeNull()
    if (!bbox) return
    expect(bbox.x).toBeGreaterThanOrEqual(drawn.x)
    expect(bbox.x - drawn.x).toBeCloseTo(drawn.x + drawn.w - (bbox.x + bbox.w), 1)
  })

  it("LG-9: ширина столбца общая: чертёж одинаковой геометрии стоит одинаково на листах с разной по ширине легендой", () => {
    const narrow = page([wall("w1", "brick", 0)])
    const wide = page([wall("w1", "reinforced", 0)])
    const doc = build([narrow, wide])
    const drawn = areaOf()
    const boxes = [1, 2].map((n) => bboxOf(inChart(parseStyledStrokes(doc, n), drawn).filter(isSolid).filter((s) => !isFrameLike(s))))
    expect(boxes[0]).not.toBeNull()
    expect(boxes[1]).not.toBeNull()
    if (!boxes[0] || !boxes[1]) return
    expect(boxes[0].x).toBeCloseTo(boxes[1].x, 2)
    expect(boxes[0].x + boxes[0].w).toBeCloseTo(boxes[1].x + boxes[1].w, 2)
    // и это положение — центр области, у которой столбец общий (а не столбец узкой страницы)
    expect(boxes[0].x - drawn.x).toBeCloseTo(drawn.x + drawn.w - (boxes[0].x + boxes[0].w), 1)
  })
})

// пути рамки и основной надписи: широкие прямоугольники листа, а не чертёж
function isFrameLike(s: StyledStroke): boolean {
  const b = bboxOf([s])
  return b !== null && b.w > 150
}

describe("инварианты легенды", () => {
  it("легенда не зависит от масштаба чертежа: подписи на тех же местах при 1:100 и 1:50", () => {
    const pages = [MEASURE, DEMOLITION]
    build(pages, 100)
    const at100 = [1, 2].flatMap((n) => legendTextsOn(n).map((t) => ({ ...t })))
    build(pages, 50)
    const at50 = [1, 2].flatMap((n) => legendTextsOn(n).map((t) => ({ ...t })))
    expect(at100.length).toBeGreaterThan(0)
    expect(at50).toEqual(at100)
  })

  it("PDF остаётся векторным: легенда не добавляет растровых изображений", () => {
    const doc = build([MEASURE, DEMOLITION, MOUNTING])
    expect(String(doc.output())).not.toMatch(/\/Subtype\s*\/Image/)
  })

  it("размеры образцов не зависят от масштаба: штрихи столбца легенды (геометрия, толщина, цвет, пунктир) одни и те же при 1:50, 1:100 и 1:200", () => {
    const pages = [MEASURE, DEMOLITION]
    const signature = (scale: number): string[] => {
      const doc = build(pages, scale)
      const area = areaOf()
      return [1, 2].map((n) =>
        JSON.stringify(
          parseStyledStrokes(doc, n)
            .filter((s) => {
              const b = visibleBBox(s)
              return b !== null && b.x + b.w / 2 < area.x && b.x > frameRect("A4").x
            })
            .map((s) => ({
              p: s.subpaths.map((sp) => sp.map((q) => [Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100])),
              w: Math.round(s.widthMm * 1000) / 1000,
              c: s.color.map((v) => Math.round(v * 1000) / 1000),
              d: s.dash.map((v) => Math.round(v * 1000) / 1000),
            })),
        ),
      )
    }
    const base = signature(100)
    expect(base[0]?.length ?? 0).toBeGreaterThan(10)
    expect(signature(50)).toEqual(base)
    expect(signature(200)).toEqual(base)
  })

  it("каждая строка подписей документа целиком помещается правее образца и левее области чертежа", () => {
    const pages = [MEASURE, DEMOLITION, MOUNTING]
    const doc = build(pages)
    const area = areaOf()
    for (const n of [1, 2, 3]) for (const t of legendTextsOn(n)) expect(extentOf(doc, t).right, t.text).toBeLessThanOrEqual(area.x + TOL)
    const longest = legendTextsOn(2).find((t) => t.text === "Демонтируемая")
    expect(longest).toBeDefined()
  })
})

describe("образцы легенды", () => {
  const MATERIAL_WALLS: [string, Wall["type"]][] = [
    ["Кирпич", "brick"],
    ["Бетон", "concrete"],
    ["Железобетон", "reinforced"],
    ["Дерево (вдоль)", "wood-long"],
  ]
  // рисунок образца и рисунок того же материала на чертеже одной и той же страницы
  function looksOf(type: Wall["type"]): { sample: MaterialLook; chart: MaterialLook } {
    const only = page([wall("w1", type, 0)], [], undefined, "Обмерочный план")
    const doc = build([only])
    const area = areaOf()
    const strokes = parseStyledStrokes(doc, 1)
    return { sample: lookOf(inColumn(strokes, area)), chart: lookOf(inChart(strokes, area)) }
  }

  it.each(MATERIAL_WALLS)("LG-12: образец «%s» штрихуется так же, как этот материал на чертеже той же страницы", (_label, type) => {
    const { sample, chart } = looksOf(type)
    expect(sample).toEqual(chart)
  })

  it("LG-12: образцы четырёх материалов различаются между собой", () => {
    const samples = MATERIAL_WALLS.map(([, type]) => JSON.stringify(looksOf(type).sample))
    expect(new Set(samples).size).toBe(4)
  })

  it("LG-12: на странице «Демонтаж» образец «Демонтируемая стена» — красный контур и красная штриховка 135° внутри столбца", () => {
    const pages = [MEASURE, DEMOLITION, MOUNTING]
    const doc = build(pages)
    const area = areaOf()
    const red = inColumn(parseStyledStrokes(doc, 2), area).filter((s) => isRed(s.color))
    expect(red.some(isSolid)).toBe(true)
    // штриховка обрезана контуром образца: видимые границы красных штрихов не выходят за красный контур
    const contour = bboxOf(red.filter(isSolid))
    expect(contour).not.toBeNull()
    for (const s of red.filter(isHatchWidth)) {
      const b = visibleBBox(s)
      if (b && contour) expect(insideRect(b, contour, 0.05), `штрих ${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.w.toFixed(2)}×${b.h.toFixed(2)}`).toBe(true)
    }
    const hatch = red.filter(isHatchWidth).flatMap((s) => segmentsOf(s))
    expect(hatch.length).toBeGreaterThan(0)
    for (const g of hatch) {
      expect(isDiagonal(g)).toBe(true)
      expect((g.b.x - g.a.x) * (g.b.y - g.a.y)).toBeGreaterThan(0)
    }
  })

  it("LG-12: образец «Демонтируемая стена» тех же размеров 2:1, что образцы материалов", () => {
    const doc = build([MEASURE, DEMOLITION, MOUNTING])
    const rows = sampleRows(doc, 2)
    expect(rows.length).toBe(3)
    const [brick, , demolition] = rows
    expect(demolition?.w ?? 0).toBeCloseTo(brick?.w ?? 1, 1)
    expect(demolition?.h ?? 0).toBeCloseTo(brick?.h ?? 1, 1)
  })

  it("LG-12: красного нет ни на обмерочной странице, ни на «Монтаж» (в столбце легенды тоже)", () => {
    const doc = build([MEASURE, DEMOLITION, MOUNTING])
    expect(parseStyledStrokes(doc, 1).filter((s) => isRed(s.color))).toEqual([])
    expect(parseStyledStrokes(doc, 3).filter((s) => isRed(s.color))).toEqual([])
  })

  it("LG-12: образец материала на странице «Монтаж» — чёрным цветом (весь столбец)", () => {
    const doc = build([MOUNTING])
    const area = areaOf()
    const strokes = inColumn(parseStyledStrokes(doc, 1), area)
    expect(strokes.length).toBeGreaterThan(0)
    for (const s of strokes) expect(sameColor(s.color, INK), `цвет ${s.color.join(",")}`).toBe(true)
  })

  it("LG-12: образцы на обмерочной странице с дверью — чёрные, штриховка кирпича под 45°", () => {
    const p = page([BRICK], [doorOn("w1")], undefined, "Обмерочный план")
    const doc = build([p])
    const area = areaOf()
    const strokes = inColumn(parseStyledStrokes(doc, 1), area)
    for (const s of strokes) expect(sameColor(s.color, INK), `цвет ${s.color.join(",")}`).toBe(true)
    const diagonal = strokes.filter((s) => isHatchWidth(s) && segmentsOf(s).every(isDiagonal))
    expect(diagonal.length).toBeGreaterThan(0)
    for (const s of diagonal) for (const g of segmentsOf(s)) expect((g.b.x - g.a.x) * (g.b.y - g.a.y)).toBeLessThan(0)
  })

  it("LG-12: на странице «Демонтаж» с элементами образцы материалов — серым цветом подложки, не чёрным", () => {
    const elements = [doorwayOn("w2"), doorOn("w2"), windowOn("w2")]
    const only = page([BRICK, CONCRETE], elements, effectiveMarks([MARK], [BRICK, CONCRETE], elements), "Демонтаж")
    expect(only.demolition?.length).toBe(1)
    const doc = build([only])
    const area = areaOf()
    const sampleStrokes = inColumn(parseStyledStrokes(doc, 1), area).filter((s) => !isRed(s.color))
    expect(sampleStrokes.length).toBeGreaterThan(0)
    for (const s of sampleStrokes) expect(sameColor(s.color, MUTED), `цвет ${s.color.join(",")}`).toBe(true)
  })

  it("LG-12: на странице «Демонтаж» без действующих пометок образцы материалов тоже серые, красного нет", () => {
    const only = page([BRICK], [], [], "Демонтаж")
    const doc = build([only])
    const area = areaOf()
    const strokes = inColumn(parseStyledStrokes(doc, 1), area)
    expect(strokes.length).toBeGreaterThan(0)
    for (const s of strokes) expect(sameColor(s.color, MUTED), `цвет ${s.color.join(",")}`).toBe(true)
  })

  it("LG-12: образцы материалов на странице «Демонтаж» с пометкой — серым цветом подложки, не чёрным", () => {
    const only = page([BRICK], [], effectiveMarks([MARK], [BRICK], []), "Демонтаж")
    const doc = build([only])
    const area = areaOf()
    const grey = inColumn(parseStyledStrokes(doc, 1), area).filter((s) => !isRed(s.color))
    expect(grey.length).toBeGreaterThan(0)
    for (const s of grey) expect(sameColor(s.color, MUTED), `цвет ${s.color.join(",")}`).toBe(true)
  })
})
