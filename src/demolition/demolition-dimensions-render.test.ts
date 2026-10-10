import { describe, expect, it } from "vitest"
import { recorder, sameSegment, segments, strokes, texts } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import { PDF_METRICS, SCREEN_METRICS } from "../render"
import type { RenderMetrics } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { W, mk } from "./demolition.test-utils"
import { demolitionColor, drawDemolitionScene } from "./demolition-render"
import type { DemolitionScene } from "./demolition-render"
import { effectiveMarks } from "./marks"

// change demolition-dimension-chains: размеры пометок на плане «Демонтаж» (spec demolition-plan «Размерные линии
// пометок»; design D1–D3). Операции канваса фиксирует записывающий контекст; координаты — экранные.
// Эталоны: стена W (0,0)-(500,0), толщина 20, грань y = 10, линия размера на 1,2·кегль от грани, выносные линии
// от грани до линии плюс выступ метрик.
// TCR-4 (change demolition-corner-dimensions): цепочка на двух гранях у каждой пометки; режим widths удалён; в этом файле
// ширина невыделенной пометки в составе цепочки (остальное — SZ-50…SZ-59 и CD-* в demolition-sizes-render.test.ts).
// Здесь остались проверки ширины в режиме widths с теми же оракулами и проверка малого отступа; тесты цепочек
// DC-11, DC-12, DC-13, DC-15 и DC-04 перенесены в demolition-sizes-render.test.ts (SZ-50…SZ-59).

const VIEW: View = { zoom: 1, pan: { x: -20, y: -50 } }
const K = PX_PER_CM * VIEW.zoom
const RED = "#d32f2f"
const sx = (x: number): number => (x - VIEW.pan.x) * K
const sy = (y: number): number => (y - VIEW.pan.y) * K
const at = (x: number, y: number): Point => ({ x: sx(x), y: sy(y) })
const TOL = 1e-4

const walls = [W()]

function render(
  scene: Partial<DemolitionScene> & { walls?: readonly Wall[] },
  opts: { color?: string; metrics?: RenderMetrics } = {},
  unit: "cm" | "m" | "mm" = "cm",
): Op[] {
  const { ctx, ops } = recorder()
  drawDemolitionScene(ctx, 800, 600, { walls, doorways: [], marks: [], ...scene }, unit, VIEW, { color: RED, grid: false, palette: LIGHT_PALETTE, ...opts })
  return ops
}

const marks = (list = [mk("m", "W", "a", 100, 190)], ws: Wall[] = walls) => effectiveMarks(list, ws)

// штрихи толщины hatchPx заданного цвета (выносные и размерные линии, штриховка области) отрезками
const thin = (ops: Op[], color: string, m: RenderMetrics = SCREEN_METRICS): [Point, Point][] =>
  strokes(ops)
    .filter((o) => o.strokeStyle === color && Math.abs(o.lineWidth - m.hatchPx) < 1e-9)
    .flatMap((o) => segments(o))

const vertical = ([p, q]: [Point, Point]): boolean => Math.abs(p.x - q.x) < TOL
const horizontal = ([p, q]: [Point, Point]): boolean => Math.abs(p.y - q.y) < TOL

// выносная линия на x чертежа: от грани стены (faceY) до линии размера плюс выступ — в экранных координатах
function extensionAt(ops: Op[], x: number, faceY: number, lineY: number, m: RenderMetrics = SCREEN_METRICS, color = RED): boolean {
  const dir = Math.sign(lineY - faceY)
  const from = at(x, faceY)
  const to = { x: sx(x), y: sy(lineY) + dir * m.dimOvershootPx }
  return thin(ops, color, m).some((s) => vertical(s) && sameSegment(s, from, to, TOL))
}

// размерная линия на высоте lineY от x0 до x1 покрыта горизонтальными штрихами сплошь (подчёркивание — штрих той же линии)
function lineCovers(ops: Op[], lineY: number, x0: number, x1: number, m: RenderMetrics = SCREEN_METRICS, color = RED): boolean {
  const horiz = thin(ops, color, m).filter((s) => horizontal(s) && Math.abs(s[0].y - sy(lineY)) < TOL)
  for (let px = Math.min(sx(x0), sx(x1)); px <= Math.max(sx(x0), sx(x1)); px += 0.5) {
    if (!horiz.some(([p, q]) => px >= Math.min(p.x, q.x) - TOL && px <= Math.max(p.x, q.x) + TOL)) return false
  }
  return horiz.length > 0
}

const arrows = (ops: Op[], color = RED) => ops.filter((o): o is Extract<Op, { kind: "fill" }> => o.kind === "fill" && o.fillStyle === color && o.subpaths.length === 1 && o.subpaths[0]?.length === 3 && !o.hasArc)

const FACE = 10
const LINE = FACE + (1.2 * SCREEN_METRICS.labelPx) / K

describe("ширина невыделенной пометки в цепочке", () => {
  it("DC-10: пометка 100–190: выносные линии в x = 100 и x = 190 от грани y = 10 за линию размера", () => {
    const ops = render({ marks: marks() })
    expect(extensionAt(ops, 100, FACE, LINE)).toBe(true)
    expect(extensionAt(ops, 190, FACE, LINE)).toBe(true)
  })

  it("DC-10: размерная линия от x = 100 до x = 190 на расстоянии 1,2·кегль от грани", () => {
    const ops = render({ marks: marks() })
    expect(lineCovers(ops, LINE, 100, 190)).toBe(true)
    expect(lineCovers(ops, LINE, 0, 500)).toBe(true)
  })

  it("DC-10: у ширины две красные стрелки (треугольники), острия в x = 100 и x = 190; всего в цепочке двенадцать", () => {
    const tris = arrows(render({ marks: marks() }))
    expect(tris).toHaveLength(12)
    const tips = tris.map((t) => t.subpaths[0]?.[0])
    for (const x of [100, 190]) {
      expect(tips.some((p) => p && Math.abs(p.x - sx(x)) < TOL && Math.abs(p.y - sy(LINE)) < TOL)).toBe(true)
    }
  })

  it("DC-10: число 90 стоит над размерной линией грани +1: по центру участка, на кегль-зазор выше линии", () => {
    const list = texts(render({ marks: marks() }))
    expect(list).toHaveLength(6)
    const t = list.find((x) => x.text === "90" && Math.abs(x.at.y - (sy(LINE) - SCREEN_METRICS.dimTextGapPx)) < TOL)
    expect(Math.abs((t?.at.x ?? 0) - sx(145))).toBeLessThan(TOL)
    expect(Math.abs((t?.at.y ?? 0) - (sy(LINE) - SCREEN_METRICS.dimTextGapPx))).toBeLessThan(TOL)
  })

  it("DC-10: единицы: в метрах «0,9», в миллиметрах «900»; линии не меняются", () => {
    for (const [unit, text] of [["m", "0,9"], ["mm", "900"]] as const) {
      const ops = render({ marks: marks() }, {}, unit)
      expect(texts(ops).map((t) => t.text)).toContain(text)
      expect(extensionAt(ops, 100, FACE, LINE)).toBe(true)
    }
  })

  it("DC-10: без пометок на плане — ни выносных линий, ни стрелок, ни красного", () => {
    const ops = render({ marks: [] })
    expect(arrows(ops)).toEqual([])
    expect(thin(ops, RED)).toEqual([])
  })
})

describe("малые размеры", () => {
  it("DC-16: отступ 3 см у выделенной пометки — ненулевой размер: выносная линия в x = 3, числа 3, 187, 310 на каждой грани, двенадцать стрелок", () => {
    const ops = render({ marks: marks([mk("m", "W", "a", 3, 190)]), selectedId: "m" })
    expect(texts(ops).map((t) => t.text).sort()).toEqual(["187", "187", "3", "3", "310", "310"])
    expect(extensionAt(ops, 3, FACE, LINE)).toBe(true)
    expect(arrows(ops)).toHaveLength(12)
  })
})

describe("цвет и метрики", () => {
  it("DC-14: цвет из параметров: выносные линии, линия и стрелки зелёные, красного нет", () => {
    const ops = render({ marks: marks() }, { color: "#00aa00" })
    expect(extensionAt(ops, 100, FACE, LINE, SCREEN_METRICS, "#00aa00")).toBe(true)
    expect(lineCovers(ops, LINE, 100, 190, SCREEN_METRICS, "#00aa00")).toBe(true)
    expect(arrows(ops, "#00aa00")).toHaveLength(12)
    expect(thin(ops, RED)).toEqual([])
    expect(arrows(ops, RED)).toEqual([])
  })

  it("DC-14: метрики PDF: выносные и размерная линии толщиной PDF_METRICS.hatchPx, выступ и отступ линии по метрикам PDF", () => {
    const m = PDF_METRICS
    const line = FACE + (1.2 * m.labelPx) / K
    const ops = render({ marks: marks() }, { metrics: m })
    expect(extensionAt(ops, 100, FACE, line, m)).toBe(true)
    expect(extensionAt(ops, 190, FACE, line, m)).toBe(true)
    expect(lineCovers(ops, line, 100, 190, m)).toBe(true)
  })

  it("DC-14: цвет сноса светлой темы красный, тёмной — светлее; размеры берут цвет из параметров", () => {
    const dark = demolitionColor("dark")
    const ops = render({ marks: marks() }, { color: dark })
    expect(extensionAt(ops, 100, FACE, LINE, SCREEN_METRICS, dark)).toBe(true)
  })

  it("DC-14: цвет и метрики PDF у цепочки пометки: выносные линии с выступом метрик PDF на обеих гранях, выделена она или нет", () => {
    const m = PDF_METRICS
    const off = (1.2 * m.labelPx) / K
    const ops = render({ marks: marks() }, { metrics: m })
    expect(extensionAt(ops, 100, FACE, FACE + off, m)).toBe(true)
    expect(extensionAt(ops, 100, -FACE, -FACE - off, m)).toBe(true)
  })
})
