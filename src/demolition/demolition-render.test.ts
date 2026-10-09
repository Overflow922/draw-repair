import { describe, expect, it } from "vitest"
import { door, recorder, sceneR, segments, strokes, texts, clips, AREA_LABEL, H_LABEL } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import { PDF_METRICS, SCREEN_METRICS } from "../render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { W, mk } from "./demolition.test-utils"
import { demolitionColor, drawDemolitionScene } from "./demolition-render"
import type { DemolitionScene } from "./demolition-render"
import { markRegion } from "./mark-region"
import { markLabelSpot, markNumberLayout } from "./mark-numbers"
import { effectiveMarks } from "./marks"

// change demolition-plan: отрисовка плана «Демонтаж» (spec demolition-plan «Отображение плана «Демонтаж»»;
// design D8). Подложка рисуется серым, область сноса — бумагой, красным контуром и красной штриховкой 135°.
// Операции канваса фиксирует записывающий контекст (doorway.test-utils); координаты — экранные.

const VIEW: View = { zoom: 1, pan: { x: -20, y: -50 } }
const K = PX_PER_CM * VIEW.zoom
const RED = "#d32f2f"
const toScreen = (p: Point): Point => ({ x: (p.x - VIEW.pan.x) * K, y: (p.y - VIEW.pan.y) * K })

const walls = [W()]
const marksOn = (list = [mk("m", "W", "a", 100, 190)], ws: Wall[] = walls) => effectiveMarks(list, ws)

function render(scene: Partial<DemolitionScene> & { walls?: readonly Wall[] }, opts: Partial<Parameters<typeof drawDemolitionScene>[6]> = {}, unit: "cm" | "m" | "mm" = "cm"): Op[] {
  const { ctx, ops } = recorder()
  drawDemolitionScene(ctx, 800, 600, { walls, doorways: [], marks: [], ...scene }, unit, VIEW, { color: RED, grid: false, palette: LIGHT_PALETTE, ...opts })
  return ops
}

const samePolygon = (a: Point[], b: Point[], tol = 1e-6): boolean => {
  const key = (p: Point): string => `${Math.round(p.x / tol)}:${Math.round(p.y / tol)}`
  const ka = new Set(a.map(key))
  return ka.size === new Set(b.map(key)).size && b.every((p) => ka.has(key(p)))
}

const regionScreen = (): Point[][] => {
  const [r] = marksOn()
  return markRegion(r!, walls).map((poly) => poly.map(toScreen))
}

const stylesOf = (ops: Op[]): Set<string> => {
  const s = new Set<string>()
  for (const o of ops) {
    if (o.kind === "stroke") s.add(o.strokeStyle)
    if (o.kind === "fill") s.add(o.fillStyle)
  }
  return s
}

const redStrokes = (ops: Op[], color = RED) => strokes(ops).filter((o) => o.strokeStyle === color)
const hatchOf = (ops: Op[], style: string, widthPx = SCREEN_METRICS.hatchPx) => strokes(ops).filter((o) => o.strokeStyle === style && Math.abs(o.lineWidth - widthPx) < 1e-9).flatMap((o) => segments(o))

describe("подложка", () => {
  it("RN-01: подложка серая: вся геометрия стен нарисована цветом muted, цвета ink нет нигде", () => {
    const styles = stylesOf(render({ walls: sceneR().walls }))
    expect(styles.has(LIGHT_PALETTE.muted)).toBe(true)
    expect(styles.has(LIGHT_PALETTE.ink)).toBe(false)
  })

  it("RN-01: у подложки есть контур (толщина contourPx) и штриховка материала (толщина hatchPx)", () => {
    const ops = render({})
    expect(strokes(ops).some((o) => o.strokeStyle === LIGHT_PALETTE.muted && o.lineWidth === SCREEN_METRICS.contourPx)).toBe(true)
    expect(hatchOf(ops, LIGHT_PALETTE.muted).length).toBeGreaterThan(3)
  })

  it("RN-01: штриховка кирпича подложки идёт под 45° (в экранных координатах dx·dy < 0)", () => {
    for (const [p, q] of hatchOf(render({}), LIGHT_PALETTE.muted)) expect((q.x - p.x) * (q.y - p.y)).toBeLessThan(0)
  })

  it("RN-01: у подложки нет подписей: комната без подписи площади, размеров нет — текста нет вовсе", () => {
    const ops = render({ walls: sceneR().walls })
    expect(texts(ops)).toEqual([])
    expect(texts(ops).filter((t) => AREA_LABEL.test(t.text))).toEqual([])
  })

  it("RN-05: подписи элементов стены на подложке не рисуются (H=…), даже для переданных (видимых) проёмов", () => {
    const ops = render({ doorways: [door("W", "a", 300, 90, 210)] })
    expect(texts(ops).filter((t) => H_LABEL.test(t.text))).toEqual([])
    expect(texts(ops)).toEqual([])
  })

  it("RN-05: вырез видимого проёма остаётся в подложке: контур стены с проёмом отличается от контура сплошной стены", () => {
    const solid = strokes(render({})).filter((o) => o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).length
    const cut = strokes(render({ doorways: [door("W", "a", 300, 90, 210)] })).filter((o) => o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).length
    expect(cut).toBeGreaterThan(solid)
  })

  it("RN-12: без пометок и превью красного нет", () => {
    expect(stylesOf(render({})).has(RED)).toBe(false)
  })
})

describe("область сноса", () => {
  it("RN-02: область закрашена цветом бумаги по контуру области, закраска идёт до красных линий", () => {
    const ops = render({ marks: marksOn() })
    const region = regionScreen()
    const paper = ops.findIndex((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.paper && o.subpaths.some((sp) => region.some((poly) => samePolygon(sp, poly))))
    expect(paper).toBeGreaterThanOrEqual(0)
    const firstRed = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === RED)
    expect(firstRed).toBeGreaterThan(paper)
  })

  it("RN-02: красный контур области толщиной contourPx идёт по сторонам области и не выходит за её габариты", () => {
    const ops = render({ marks: marksOn() })
    const region = regionScreen().flat()
    const minX = Math.min(...region.map((p) => p.x))
    const maxX = Math.max(...region.map((p) => p.x))
    const minY = Math.min(...region.map((p) => p.y))
    const maxY = Math.max(...region.map((p) => p.y))
    const contour = redStrokes(ops).filter((o) => o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments)
    expect(contour.length).toBeGreaterThanOrEqual(3)
    for (const [p, q] of contour) {
      for (const pt of [p, q]) {
        expect(pt.x).toBeGreaterThanOrEqual(minX - 1e-6)
        expect(pt.x).toBeLessThanOrEqual(maxX + 1e-6)
        expect(pt.y).toBeGreaterThanOrEqual(minY - 1e-6)
        expect(pt.y).toBeLessThanOrEqual(maxY + 1e-6)
      }
    }
  })

  it("RN-02: красная штриховка идёт под 135° (dx·dy > 0, |dx| = |dy|), толщиной hatchPx, внутри клипа по области", () => {
    const ops = render({ marks: marksOn() })
    const lines = hatchOf(ops, RED)
    expect(lines.length).toBeGreaterThan(3)
    for (const [p, q] of lines) {
      const dx = q.x - p.x
      const dy = q.y - p.y
      expect(dx * dy).toBeGreaterThan(0)
      expect(Math.abs(Math.abs(dx) - Math.abs(dy))).toBeLessThan(1e-6)
    }
    const region = regionScreen()
    expect(clips(ops).some((c) => c.subpaths.some((sp) => region.some((poly) => samePolygon(sp, poly))))).toBe(true)
  })

  it("RN-02: красный — только цвет из параметров: смена color меняет цвет всех красных линий", () => {
    const ops = render({ marks: marksOn() }, { color: "#00aa00" })
    expect(redStrokes(ops, "#00aa00").length).toBeGreaterThan(0)
    expect(stylesOf(ops).has(RED)).toBe(false)
  })

  it("RN-03: ширина участка числом: «90» в сантиметрах, «0,9» в метрах, «900» в миллиметрах", () => {
    for (const [unit, text] of [["cm", "90"], ["m", "0,9"], ["mm", "900"]] as const) {
      const ops = render({ marks: marksOn() }, {}, unit)
      expect(texts(ops).map((t) => t.text)).toEqual([text])
    }
  })

  it("RN-03: подпись ширины стоит у участка: x по центру участка, ниже верха стены на стороне нормали", () => {
    const [r] = marksOn()
    const spot = markLabelSpot(r!, "cm", K, SCREEN_METRICS.labelPx)
    const [t] = texts(render({ marks: marksOn() }))
    expect(Math.abs(t!.at.x - toScreen(spot.center).x)).toBeLessThan(1)
    expect(Math.abs(t!.at.y - toScreen(spot.center).y)).toBeLessThan(SCREEN_METRICS.labelPx)
    expect(t!.at.x).toBeCloseTo(toScreen({ x: 145, y: 0 }).x, 0)
  })

  it("RN-04: остаток стены серый и без красного: красные контуры только в габаритах области сноса", () => {
    const ops = render({ marks: marksOn() })
    const region = regionScreen().flat()
    const maxX = Math.max(...region.map((p) => p.x))
    const minX = Math.min(...region.map((p) => p.x))
    const mutedPoints = strokes(ops).filter((o) => o.strokeStyle === LIGHT_PALETTE.muted && o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).flat()
    expect(mutedPoints.some((p) => p.x < minX - 1)).toBe(true)
    expect(mutedPoints.some((p) => p.x > maxX + 1)).toBe(true)
    // красного левее и правее области сноса нет
    for (const o of redStrokes(ops).filter((s) => s.lineWidth === SCREEN_METRICS.contourPx)) for (const pt of o.subpaths.flat()) {
      expect(pt.x).toBeGreaterThanOrEqual(minX - 1e-6)
      expect(pt.x).toBeLessThanOrEqual(maxX + 1e-6)
    }
  })

  it("RN-06: у выделенной пометки три числа (100, 90, 310), у невыделенной — только ширина", () => {
    const [r] = marksOn()
    expect(texts(render({ marks: marksOn(), selectedId: "m" })).map((t) => t.text).sort()).toEqual(["100", "310", "90"])
    expect(texts(render({ marks: marksOn(), selectedId: "other" })).map((t) => t.text)).toEqual(["90"])
    expect(markNumberLayout(r!, "cm", K, SCREEN_METRICS.labelPx)).toHaveLength(3)
  })

  it("RN-06: несколько пометок — по подписи ширины у каждой", () => {
    const list = marksOn([mk("m1", "W", "a", 50, 100), mk("m2", "W", "a", 300, 420)])
    expect(texts(render({ marks: list })).map((t) => t.text).sort()).toEqual(["120", "50"])
  })

  it("RN-07: превью протяжки — красные линии и ширина «90» без закраски бумагой", () => {
    const ops = render({ marks: [], ghost: { wallId: "W", from: 100, to: 190 } })
    expect(redStrokes(ops).length).toBeGreaterThan(0)
    expect(texts(ops).map((t) => t.text)).toEqual(["90"])
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.paper)).toBe(false)
  })

  it("RN-07: превью без стены или с неизвестной стеной ничего не рисует", () => {
    expect(stylesOf(render({ marks: [], ghost: { wallId: "nope", from: 100, to: 190 } })).has(RED)).toBe(false)
    expect(stylesOf(render({ marks: [], ghost: null })).has(RED)).toBe(false)
  })

  it("RN-08: метрики PDF: красный контур и штриховка толщиной PDF_METRICS.contourPx и hatchPx", () => {
    const ops = render({ marks: marksOn() }, { metrics: PDF_METRICS })
    expect(redStrokes(ops).some((o) => o.lineWidth === PDF_METRICS.contourPx)).toBe(true)
    expect(hatchOf(ops, RED, PDF_METRICS.hatchPx).length).toBeGreaterThan(3)
  })

  it("RN-09: тёмная схема: бумага и серый подложки берутся из палитры", () => {
    const ops = render({ marks: marksOn() }, { palette: DARK_PALETTE })
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle === DARK_PALETTE.paper)).toBe(true)
    const styles = stylesOf(ops)
    expect(styles.has(DARK_PALETTE.muted)).toBe(true)
    expect(styles.has(DARK_PALETTE.ink)).toBe(false)
  })

  it("RN-13: сетка включается параметром grid (по умолчанию как на обмерочном плане)", () => {
    const withGrid = render({}, { grid: true })
    const without = render({}, { grid: false })
    expect(strokes(withGrid).length).toBeGreaterThan(strokes(without).length)
  })
})

describe("demolitionColor", () => {
  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

  it.each(["light", "dark"] as const)("RN-10: цвет схемы %s — шестизначный hex, преобладает красный", (theme) => {
    const c = demolitionColor(theme)
    expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    const [r, g, b] = rgb(c)
    expect(r).toBeGreaterThan(2 * g)
    expect(r).toBeGreaterThan(2 * b)
  })

  it("RN-10: светлая и тёмная схемы различны и оба не совпадают с цветом бумаги своей палитры", () => {
    expect(demolitionColor("light")).not.toBe(demolitionColor("dark"))
    expect(demolitionColor("light").toLowerCase()).not.toBe(LIGHT_PALETTE.paper)
    expect(demolitionColor("dark").toLowerCase()).not.toBe(DARK_PALETTE.paper)
  })
})
