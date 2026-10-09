import { describe, expect, it } from "vitest"
import { recorder, sameSegment, segments, strokes, texts } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import { SCREEN_METRICS } from "../render"
import type { RenderMetrics } from "../render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Palette } from "../theme"
import type { Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { W, mk, wall } from "./demolition.test-utils"
import { drawDemolitionScene } from "./demolition-render"
import type { DemolitionScene } from "./demolition-render"
import { effectiveMarks } from "./marks"
import { markRegion } from "./mark-region"

// change demolition-doorway-sizes: размеры пометки как у проёма на плане «Демонтаж» (spec demolition-plan «Размерные
// линии пометок», «Ластик на плане «Демонтаж»»; design D3–D5). Записывающий холст; координаты — экранные.
// Эталоны: линия размера на 1,2·кегль/k от грани; выносные линии от грани до линии плюс выступ метрик;
// комната с замкнутыми углами: грань y = 10 между стыками 10 и 490, грань y = −10 — между −10 и 510.

const VIEW: View = { zoom: 1, pan: { x: -20, y: -50 } }
const K = PX_PER_CM * VIEW.zoom
const RED = "#d32f2f"
const sx = (x: number): number => (x - VIEW.pan.x) * K
const sy = (y: number): number => (y - VIEW.pan.y) * K
const at = (x: number, y: number): Point => ({ x: sx(x), y: sy(y) })
const TOL = 1e-4

const free = [W()]
const room = (): Wall[] => [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]

interface Extra {
  walls?: readonly Wall[]
  color?: string
  metrics?: RenderMetrics
  palette?: Palette
  widths?: boolean
}

function render(scene: Partial<DemolitionScene>, extra: Extra = {}, unit: "cm" | "m" | "mm" = "cm"): Op[] {
  const { ctx, ops } = recorder()
  const walls = extra.walls ?? free
  drawDemolitionScene(ctx, 800, 600, { walls, doorways: [], marks: [], ...scene }, unit, VIEW, {
    color: extra.color ?? RED,
    grid: false,
    palette: extra.palette ?? LIGHT_PALETTE,
    metrics: extra.metrics,
    widths: extra.widths,
  })
  return ops
}

const marksOn = (walls: readonly Wall[], list = [mk("m", "W", "a", 100, 190)]) => effectiveMarks(list, walls)

const thin = (ops: Op[], color: string, m: RenderMetrics = SCREEN_METRICS): [Point, Point][] =>
  strokes(ops)
    .filter((o) => o.strokeStyle === color && Math.abs(o.lineWidth - m.hatchPx) < 1e-9)
    .flatMap((o) => segments(o))
const vertical = ([p, q]: [Point, Point]): boolean => Math.abs(p.x - q.x) < TOL
const horizontal = ([p, q]: [Point, Point]): boolean => Math.abs(p.y - q.y) < TOL

function extensionAt(ops: Op[], x: number, faceY: number, lineY: number, m: RenderMetrics = SCREEN_METRICS, color = RED): boolean {
  const dir = Math.sign(lineY - faceY)
  const to = { x: sx(x), y: sy(lineY) + dir * m.dimOvershootPx }
  return thin(ops, color, m).some((s) => vertical(s) && sameSegment(s, at(x, faceY), to, TOL))
}

function lineCovers(ops: Op[], lineY: number, x0: number, x1: number): boolean {
  const horiz = thin(ops, RED).filter((s) => horizontal(s) && Math.abs(s[0].y - sy(lineY)) < TOL)
  for (let px = Math.min(sx(x0), sx(x1)); px <= Math.max(sx(x0), sx(x1)); px += 0.5) {
    if (!horiz.some(([p, q]) => px >= Math.min(p.x, q.x) - TOL && px <= Math.max(p.x, q.x) + TOL)) return false
  }
  return horiz.length > 0
}

const onLine = (ops: Op[], lineY: number) => thin(ops, RED).filter((s) => horizontal(s) && Math.abs(s[0].y - sy(lineY)) < TOL)

const arrows = (ops: Op[], color = RED) =>
  ops.filter((o): o is Extract<Op, { kind: "fill" }> => o.kind === "fill" && o.fillStyle === color && o.subpaths.length === 1 && o.subpaths[0]?.length === 3 && !o.hasArc)

const sortedTexts = (ops: Op[]): string[] => texts(ops).map((t) => t.text).sort()

const OFF = (1.2 * SCREEN_METRICS.labelPx) / K
const LINE_P = 10 + OFF // линия размера у грани y = 10
const LINE_M = -10 - OFF // линия размера у грани y = −10

describe("цепочки выделенной пометки на обеих гранях", () => {
  it("SZ-51: свободная стена, пометка 100–190: выносные линии в x = 0, 100, 190, 500 на обеих гранях", () => {
    const ops = render({ marks: marksOn(free), selectedId: "m" })
    for (const x of [0, 100, 190, 500]) {
      expect(extensionAt(ops, x, 10, LINE_P), `+1 x=${x}`).toBe(true)
      expect(extensionAt(ops, x, -10, LINE_M), `−1 x=${x}`).toBe(true)
    }
  })

  it("SZ-51: числа 100, 90, 310 — по два (по одному на каждой грани); двенадцать стрелок", () => {
    const ops = render({ marks: marksOn(free), selectedId: "m" })
    expect(sortedTexts(ops)).toEqual(["100", "100", "310", "310", "90", "90"])
    expect(arrows(ops)).toHaveLength(12)
  })

  it("SZ-51: размерные линии покрывают 0–100, 100–190, 190–500 на каждой грани", () => {
    const ops = render({ marks: marksOn(free), selectedId: "m" })
    for (const line of [LINE_P, LINE_M]) {
      expect(lineCovers(ops, line, 0, 100)).toBe(true)
      expect(lineCovers(ops, line, 100, 190)).toBe(true)
      expect(lineCovers(ops, line, 190, 500)).toBe(true)
    }
  })

  it("SZ-50: комната: грань y = 10 — выносные линии в x = 10, 100, 190, 490; грань y = −10 — в x = −10, 100, 190, 510", () => {
    const ws = room()
    const ops = render({ walls: ws, marks: marksOn(ws), selectedId: "m" }, { walls: ws })
    for (const x of [10, 100, 190, 490]) expect(extensionAt(ops, x, 10, LINE_P), `+1 x=${x}`).toBe(true)
    for (const x of [-10, 100, 190, 510]) expect(extensionAt(ops, x, -10, LINE_M), `−1 x=${x}`).toBe(true)
  })

  it("SZ-50: комната: числа 90, 90, 300 на внутренней грани и 110, 90, 320 на наружной", () => {
    const ws = room()
    const ops = render({ walls: ws, marks: marksOn(ws), selectedId: "m" }, { walls: ws })
    expect(sortedTexts(ops)).toEqual(["110", "300", "320", "90", "90", "90"].sort())
  })

  it("SZ-50: размерные линии комнаты идут между стыками: 10–490 на внутренней грани и −10–510 на наружной", () => {
    const ws = room()
    const ops = render({ walls: ws, marks: marksOn(ws), selectedId: "m" }, { walls: ws })
    expect(lineCovers(ops, LINE_P, 10, 490)).toBe(true)
    expect(lineCovers(ops, LINE_M, -10, 510)).toBe(true)
    const inner = onLine(ops, LINE_P).flatMap((s) => [s[0].x, s[1].x])
    expect(Math.min(...inner)).toBeCloseTo(sx(10), 3)
    expect(Math.max(...inner)).toBeCloseTo(sx(490), 3)
  })

  it("SZ-53: у правимых чисел выделенной пометки линия разбита на сплошные края и штриховой отрезок: девять горизонтальных штрихов на каждой грани", () => {
    const ops = render({ marks: marksOn(free), selectedId: "m" })
    expect(onLine(ops, LINE_P)).toHaveLength(9)
    expect(onLine(ops, LINE_M)).toHaveLength(9)
  })

  it("SZ-53: штриховой отрезок под числом ширины по центру участка и по ширине числа (2 символа × 0,6 × кегль)", () => {
    const ops = render({ marks: marksOn(free), selectedId: "m" })
    const textWidth = 2 * 0.6 * SCREEN_METRICS.labelPx
    for (const line of [LINE_P, LINE_M]) {
      const found = onLine(ops, line).find((s) => Math.abs((s[0].x + s[1].x) / 2 - sx(145)) < TOL && Math.abs(Math.abs(s[1].x - s[0].x) - textWidth) < 1e-3)
      expect(found, `линия ${line}`).toBeDefined()
    }
  })

  it("SZ-52: пометка 0–190 на свободной стене: у расстояния до a на обеих гранях только число «0»; стрелок восемь (ширина и расстояние до b на двух гранях)", () => {
    const ops = render({ marks: marksOn(free, [mk("m", "W", "a", 0, 190)]), selectedId: "m" })
    expect(sortedTexts(ops)).toEqual(["0", "0", "190", "190", "310", "310"])
    expect(arrows(ops)).toHaveLength(8)
    for (const t of texts(ops).filter((x) => x.text === "0")) expect(Math.abs(t.at.x - sx(0))).toBeLessThan(1)
  })

  it("SZ-52: нулевое число подчёркнуто (штрих шириной числа «0» по центру в x = 0) на каждой грани", () => {
    const ops = render({ marks: marksOn(free, [mk("m", "W", "a", 0, 190)]), selectedId: "m" })
    const underline = thin(ops, RED).filter((s) => horizontal(s) && Math.abs((s[0].x + s[1].x) / 2 - sx(0)) < 1e-3 && Math.abs(Math.abs(s[1].x - s[0].x) - 0.6 * SCREEN_METRICS.labelPx) < 1e-3)
    expect(underline.length).toBeGreaterThanOrEqual(2)
  })

  it("SZ-52: пометка на всю стену в комнате: числа 0, 480, 0 на внутренней и 0, 520, 0 на наружной; стрелок четыре", () => {
    const ws = room()
    const ops = render({ walls: ws, marks: marksOn(ws, [mk("m", "W", "a", 0, 500)]), selectedId: "m" }, { walls: ws })
    expect(sortedTexts(ops)).toEqual(["0", "0", "0", "0", "480", "520"])
    expect(arrows(ops)).toHaveLength(4)
    expect(extensionAt(ops, 10, 10, LINE_P)).toBe(true)
    expect(extensionAt(ops, 490, 10, LINE_P)).toBe(true)
    expect(extensionAt(ops, -10, -10, LINE_M)).toBe(true)
    expect(extensionAt(ops, 510, -10, LINE_M)).toBe(true)
  })

  it("SZ-51: единицы: в метрах числа «1», «0,9», «3,1»", () => {
    const ops = render({ marks: marksOn(free), selectedId: "m" }, {}, "m")
    expect(sortedTexts(ops)).toEqual(["0,9", "0,9", "1", "1", "3,1", "3,1"])
  })

  it("SZ-59: стена в обратном направлении (500,0)→(0,0): выносные линии пометки 100–190 в x = 400 и 310 на обеих гранях", () => {
    const rev = [wall(500, 0, 0, 0, "W")]
    const ops = render({ walls: rev, marks: marksOn(rev), selectedId: "m" }, { walls: rev })
    for (const x of [400, 310]) {
      expect(extensionAt(ops, x, 10, LINE_P), `y=10 x=${x}`).toBe(true)
      expect(extensionAt(ops, x, -10, LINE_M), `y=−10 x=${x}`).toBe(true)
    }
  })
})

describe("превью протяжки", () => {
  it("SZ-58: превью 100–190 на свободной стене: цепочка из шести размеров — числа 100, 90, 310 на каждой грани", () => {
    const ops = render({ ghost: { wallId: "W", from: 100, to: 190 } })
    expect(sortedTexts(ops)).toEqual(["100", "100", "310", "310", "90", "90"])
    expect(arrows(ops)).toHaveLength(12)
    for (const x of [0, 100, 190, 500]) {
      expect(extensionAt(ops, x, 10, LINE_P), `+1 x=${x}`).toBe(true)
      expect(extensionAt(ops, x, -10, LINE_M), `−1 x=${x}`).toBe(true)
    }
  })

  it("SZ-54: у размеров превью подчёркивания нет: по одному штриху на линии размера (три на грань)", () => {
    const ops = render({ ghost: { wallId: "W", from: 100, to: 190 } })
    expect(onLine(ops, LINE_P)).toHaveLength(3)
    expect(onLine(ops, LINE_M)).toHaveLength(3)
  })

  it("SZ-58: превью в комнате: размеры между стыками 10 и 490 на внутренней грани", () => {
    const ws = room()
    const ops = render({ walls: ws, ghost: { wallId: "W", from: 100, to: 190 } }, { walls: ws })
    expect(sortedTexts(ops)).toEqual(["110", "300", "320", "90", "90", "90"].sort())
    expect(extensionAt(ops, 10, 10, LINE_P)).toBe(true)
  })

  it("SZ-58: превью и выделенная пометка вместе: числа обеих цепочек", () => {
    const list = [mk("m", "W", "a", 300, 350)]
    const ops = render({ marks: marksOn(free, list), selectedId: "m", ghost: { wallId: "W", from: 100, to: 190 } })
    expect(texts(ops)).toHaveLength(12)
  })

  it("SZ-58: превью на несуществующую стену ничего не рисует", () => {
    expect(texts(render({ ghost: { wallId: "nope", from: 100, to: 190 } }))).toEqual([])
  })
})

describe("невыделенные пометки на экране и ширины в PDF", () => {
  it("SZ-55: невыделенная пометка на экране — без размеров: ни выносных линий, ни стрелок, ни чисел", () => {
    const ops = render({ marks: marksOn(free) })
    expect(arrows(ops)).toEqual([])
    expect(texts(ops)).toEqual([])
    expect(thin(ops, RED).filter((s) => vertical(s) || horizontal(s))).toEqual([])
  })

  it("SZ-55: выделена другая пометка: у невыделенной по-прежнему нет размеров", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("n", "W", "a", 300, 350)]
    const ops = render({ marks: marksOn(free, list), selectedId: "m" })
    expect(sortedTexts(ops)).toEqual(["100", "100", "310", "310", "90", "90"])
    expect(extensionAt(ops, 300, 10, LINE_P)).toBe(false)
    expect(extensionAt(ops, 350, 10, LINE_P)).toBe(false)
  })

  it("SZ-55: выделение чужого идентификатора ничего не показывает", () => {
    expect(texts(render({ marks: marksOn(free), selectedId: "other" }))).toEqual([])
  })

  it("SZ-56: режим PDF (widths): ширина пометки 100–190 одним размером на грани y = 10: выносные в x = 100 и 190, число 90, две стрелки", () => {
    const ops = render({ marks: marksOn(free) }, { widths: true })
    expect(extensionAt(ops, 100, 10, LINE_P)).toBe(true)
    expect(extensionAt(ops, 190, 10, LINE_P)).toBe(true)
    expect(lineCovers(ops, LINE_P, 100, 190)).toBe(true)
    expect(sortedTexts(ops)).toEqual(["90"])
    expect(arrows(ops)).toHaveLength(2)
  })

  it("SZ-56: режим PDF: размерная линия сплошная — один горизонтальный штрих (без подчёркивания)", () => {
    const ops = render({ marks: marksOn(free) }, { widths: true })
    expect(onLine(ops, LINE_P)).toHaveLength(1)
  })

  it("SZ-08: пометка на железобетонной стене не действует: даже выделенной размеров нет", () => {
    const reinforced = [W("reinforced")]
    const ops = render({ walls: reinforced, marks: marksOn(reinforced), selectedId: "m" }, { walls: reinforced })
    expect(texts(ops)).toEqual([])
    expect(arrows(ops)).toEqual([])
  })

  it("SZ-56: режим PDF: на грани y = −10 размеров нет", () => {
    const ops = render({ marks: marksOn(free) }, { widths: true })
    expect(extensionAt(ops, 100, -10, LINE_M)).toBe(false)
    expect(onLine(ops, LINE_M)).toEqual([])
  })

  it("SZ-56: режим PDF: у каждой пометки своя ширина", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("n", "W", "a", 300, 420)]
    const ops = render({ marks: marksOn(free, list) }, { widths: true })
    expect(sortedTexts(ops)).toEqual(["120", "90"])
    expect(arrows(ops)).toHaveLength(4)
  })

  it("SZ-57: режим PDF, пометка на всю стену в комнате: ширина по грани между стыками 10 и 490 — число 480, выносные линии в x = 10 и 490", () => {
    const ws = room()
    const ops = render({ walls: ws, marks: marksOn(ws, [mk("m", "W", "a", 0, 500)]) }, { walls: ws, widths: true })
    expect(sortedTexts(ops)).toEqual(["480"])
    expect(extensionAt(ops, 10, 10, LINE_P)).toBe(true)
    expect(extensionAt(ops, 490, 10, LINE_P)).toBe(true)
  })

  it("SZ-56: режим PDF: у выделенной пометки вместе с widths рисуется цепочка (выделение главнее)", () => {
    const ops = render({ marks: marksOn(free), selectedId: "m" }, { widths: true })
    expect(sortedTexts(ops)).toEqual(["100", "100", "310", "310", "90", "90"])
  })

  it("SZ-56: цвет из параметров", () => {
    const ops = render({ marks: marksOn(free) }, { widths: true, color: "#00aa00" })
    expect(extensionAt(ops, 100, 10, LINE_P, SCREEN_METRICS, "#00aa00")).toBe(true)
    expect(thin(ops, RED)).toEqual([])
  })
})

describe("подсветка ластика", () => {
  const erasing = (id: string | null | undefined, palette: Palette = LIGHT_PALETTE, list = [mk("m", "W", "a", 100, 190), mk("n", "W", "a", 300, 400)]): Op[] =>
    render({ marks: marksOn(free, list), erasing: id }, { palette })

  it("SZ-60: область пометки под курсором обводится цветом подсветки ластика схемы", () => {
    const ops = erasing("m")
    const region = markRegion(effectiveMarks([mk("m", "W", "a", 100, 190)], free)[0] ?? (() => { throw new Error("нет пометки") })(), free)
      .flat()
      .map((p) => at(p.x, p.y))
    const lit = strokes(ops).filter((o) => o.strokeStyle === LIGHT_PALETTE.erase)
    expect(lit.length).toBeGreaterThan(0)
    const points = lit.flatMap((o) => o.subpaths.flat())
    for (const v of region) expect(points.some((p) => Math.hypot(p.x - v.x, p.y - v.y) < TOL), `вершина ${v.x}:${v.y}`).toBe(true)
  })

  it("SZ-60: обводка подсветки не тоньше контура области", () => {
    const widths = strokes(erasing("m")).filter((o) => o.strokeStyle === LIGHT_PALETTE.erase).map((o) => o.lineWidth)
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(SCREEN_METRICS.contourPx)
  })

  it("SZ-60: подсвечивается только одна область: у другой пометки вершин подсветки нет", () => {
    const lit = strokes(erasing("m")).filter((o) => o.strokeStyle === LIGHT_PALETTE.erase).flatMap((o) => o.subpaths.flat())
    expect(lit.every((p) => p.x <= sx(190) + TOL)).toBe(true)
  })

  it("SZ-60: без цели (null или не задана) подсветки нет", () => {
    for (const id of [null, undefined]) expect(strokes(erasing(id)).some((o) => o.strokeStyle === LIGHT_PALETTE.erase)).toBe(false)
  })

  it("SZ-60: цель, которой нет среди действующих пометок, подсветки не даёт", () => {
    expect(strokes(erasing("nope")).some((o) => o.strokeStyle === LIGHT_PALETTE.erase)).toBe(false)
  })

  it("SZ-60: цвет подсветки берётся из схемы: у тёмной — свой", () => {
    const ops = erasing("m", DARK_PALETTE)
    expect(strokes(ops).some((o) => o.strokeStyle === DARK_PALETTE.erase)).toBe(true)
  })

  it("SZ-61: подсветка ластика не рисует размеров и не выделяет", () => {
    const ops = erasing("m")
    expect(texts(ops)).toEqual([])
    expect(arrows(ops)).toEqual([])
  })
})
