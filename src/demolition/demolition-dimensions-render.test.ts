import { describe, expect, it } from "vitest"
import { recorder, sameSegment, segments, strokes, texts } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import { PDF_METRICS, SCREEN_METRICS } from "../render"
import type { RenderMetrics } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { W, mk, wall } from "./demolition.test-utils"
import { demolitionColor, drawDemolitionScene } from "./demolition-render"
import type { DemolitionScene } from "./demolition-render"
import { effectiveMarks } from "./marks"

// change demolition-dimension-chains: размеры пометок на плане «Демонтаж» (spec demolition-plan «Размерные линии
// пометок»; design D1–D3). Операции канваса фиксирует записывающий контекст; координаты — экранные.
// Эталоны: стена W (0,0)-(500,0), толщина 20, грань y = 10, линия размера на 1,2·кегль от грани, выносные линии
// от грани до линии плюс выступ метрик.

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

describe("размер ширины пометки на экране", () => {
  it("DC-10: невыделенная пометка 100–190: выносные линии в x = 100 и x = 190 от грани y = 10 за линию размера", () => {
    const ops = render({ marks: marks() })
    expect(extensionAt(ops, 100, FACE, LINE)).toBe(true)
    expect(extensionAt(ops, 190, FACE, LINE)).toBe(true)
  })

  it("DC-10: размерная линия от x = 100 до x = 190 на расстоянии 1,2·кегль от грани", () => {
    const ops = render({ marks: marks() })
    expect(lineCovers(ops, LINE, 100, 190)).toBe(true)
    // линия не продолжается за границы участка
    const horiz = thin(ops, RED).filter((s) => horizontal(s) && Math.abs(s[0].y - sy(LINE)) < TOL)
    expect(Math.min(...horiz.flatMap((s) => [s[0].x, s[1].x]))).toBeCloseTo(sx(100), 3)
    expect(Math.max(...horiz.flatMap((s) => [s[0].x, s[1].x]))).toBeCloseTo(sx(190), 3)
  })

  it("DC-10: на концах линии две красные стрелки (треугольники), острия в x = 100 и x = 190", () => {
    const tris = arrows(render({ marks: marks() }))
    expect(tris).toHaveLength(2)
    const tips = tris.map((t) => t.subpaths[0]?.[0])
    for (const x of [100, 190]) {
      expect(tips.some((p) => p && Math.abs(p.x - sx(x)) < TOL && Math.abs(p.y - sy(LINE)) < TOL)).toBe(true)
    }
  })

  it("DC-10: число 90 стоит над размерной линией: по центру участка, на кегль-зазор выше линии", () => {
    const [t, ...rest] = texts(render({ marks: marks() }))
    expect(rest).toEqual([])
    expect(t?.text).toBe("90")
    expect(Math.abs((t?.at.x ?? 0) - sx(145))).toBeLessThan(TOL)
    expect(Math.abs((t?.at.y ?? 0) - (sy(LINE) - SCREEN_METRICS.dimTextGapPx))).toBeLessThan(TOL)
  })

  it("DC-10: единицы: в метрах «0,9», в миллиметрах «900»; линии не меняются", () => {
    for (const [unit, text] of [["m", "0,9"], ["mm", "900"]] as const) {
      const ops = render({ marks: marks() }, {}, unit)
      expect(texts(ops).map((t) => t.text)).toEqual([text])
      expect(extensionAt(ops, 100, FACE, LINE)).toBe(true)
    }
  })

  it("DC-10: пометка без пометок на плане — ни выносных линий, ни стрелок, ни красного", () => {
    const ops = render({ marks: [] })
    expect(arrows(ops)).toEqual([])
    expect(thin(ops, RED)).toEqual([])
  })
})

describe("цепочка выделенной пометки на экране", () => {
  it("DC-11: выделенная пометка 100–190: выносные линии в x = 0, 100, 190, 500", () => {
    const ops = render({ marks: marks(), selectedId: "m" })
    for (const x of [0, 100, 190, 500]) expect(extensionAt(ops, x, FACE, LINE), `x=${x}`).toBe(true)
  })

  it("DC-11: три размерные линии покрывают 0–100, 100–190 и 190–500 на одной высоте", () => {
    const ops = render({ marks: marks(), selectedId: "m" })
    expect(lineCovers(ops, LINE, 0, 100)).toBe(true)
    expect(lineCovers(ops, LINE, 100, 190)).toBe(true)
    expect(lineCovers(ops, LINE, 190, 500)).toBe(true)
  })

  it("DC-11: по две стрелки на каждый размер — шесть красных стрелок", () => {
    expect(arrows(render({ marks: marks(), selectedId: "m" }))).toHaveLength(6)
  })

  it("DC-11: числа 100, 90, 310 стоят над своими линиями: по центрам отрезков", () => {
    const ts = texts(render({ marks: marks(), selectedId: "m" }))
    expect(ts.map((t) => t.text).sort()).toEqual(["100", "310", "90"])
    for (const [text, mid] of [["100", 50], ["90", 145], ["310", 345]] as const) {
      const t = ts.find((x) => x.text === text)
      expect(Math.abs((t?.at.x ?? 0) - sx(mid)), text).toBeLessThan(TOL)
      expect(Math.abs((t?.at.y ?? 0) - (sy(LINE) - SCREEN_METRICS.dimTextGapPx)), text).toBeLessThan(TOL)
    }
  })

  it("DC-11: у невыделенной пометки рядом с выделенной — только ширина: числа 100, 310 и 50, 90; восемь стрелок", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("n", "W", "a", 300, 350)]
    const ops = render({ marks: marks(list), selectedId: "m" })
    expect(texts(ops).map((t) => t.text).sort()).toEqual(["100", "310", "50", "90"])
    expect(arrows(ops)).toHaveLength(8)
    expect(extensionAt(ops, 300, FACE, LINE)).toBe(true)
    expect(extensionAt(ops, 350, FACE, LINE)).toBe(true)
  })

  it("DC-11: выделение чужого идентификатора ничего не меняет: у пометки одна ширина", () => {
    const ops = render({ marks: marks(), selectedId: "other" })
    expect(texts(ops).map((t) => t.text)).toEqual(["90"])
    expect(arrows(ops)).toHaveLength(2)
  })
})

describe("подчёркивание правимых чисел", () => {
  const onLine = (ops: Op[]) => thin(ops, RED).filter((s) => horizontal(s) && Math.abs(s[0].y - sy(LINE)) < TOL)

  it("DC-15: у выделенной пометки линия каждого из трёх размеров разбита на сплошные края и штриховой отрезок под числом: 9 горизонтальных штрихов", () => {
    expect(onLine(render({ marks: marks(), selectedId: "m" }))).toHaveLength(9)
  })

  it("DC-15: у невыделенной пометки размерная линия цельная: один горизонтальный штрих", () => {
    expect(onLine(render({ marks: marks() }))).toHaveLength(1)
    expect(onLine(render({ marks: [], ghost: { wallId: "W", from: 100, to: 190 } }))).toHaveLength(1)
  })

  it("DC-15: штриховой отрезок под числом ширины лежит по центру участка и по ширине числа: 2 символа × 0,6 × кегль", () => {
    const horiz = onLine(render({ marks: marks(), selectedId: "m" }))
    const textWidth = 2 * 0.6 * SCREEN_METRICS.labelPx
    const middle = horiz.find((s) => Math.abs((s[0].x + s[1].x) / 2 - sx(145)) < TOL && Math.abs(Math.abs(s[1].x - s[0].x) - textWidth) < 1e-3)
    expect(middle).toBeDefined()
  })

  it("DC-15: подчёркивание у нулевого отступа: штрих шириной числа «0» (0,6 × кегль) под числом, по центру в x = 0", () => {
    const ops = render({ marks: marks([mk("m", "W", "a", 0, 190)]), selectedId: "m" })
    const underline = thin(ops, RED).find((s) => horizontal(s) && Math.abs((s[0].x + s[1].x) / 2 - sx(0)) < 1e-3 && Math.abs(Math.abs(s[1].x - s[0].x) - 0.6 * SCREEN_METRICS.labelPx) < 1e-3)
    expect(underline).toBeDefined()
  })
})

describe("малые размеры", () => {
  it("DC-16: отступ 3 см — ненулевой размер: выносная линия в x = 3 и числа 3, 187, 310, шесть стрелок", () => {
    const ops = render({ marks: marks([mk("m", "W", "a", 3, 190)]), selectedId: "m" })
    expect(texts(ops).map((t) => t.text).sort()).toEqual(["187", "3", "310"])
    expect(extensionAt(ops, 3, FACE, LINE)).toBe(true)
    expect(arrows(ops)).toHaveLength(6)
  })
})

describe("нулевой отступ", () => {
  it("DC-12: пометка 0–190 выделена: у gapA только число «0» над концом стены, линии размера нет левее x = 0", () => {
    const ops = render({ marks: marks([mk("m", "W", "a", 0, 190)]), selectedId: "m" })
    expect(texts(ops).map((t) => t.text).sort()).toEqual(["0", "190", "310"])
    const zero = texts(ops).find((t) => t.text === "0")
    expect(Math.abs((zero?.at.x ?? 0) - sx(0))).toBeLessThan(1)
    const xs = thin(ops, RED).filter((s) => horizontal(s) && Math.abs(s[0].y - sy(LINE)) < TOL).flatMap((s) => [s[0].x, s[1].x])
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(sx(0) - TOL)
  })

  it("DC-12: у нулевого отступа нет своей размерной линии: стрелок четыре (ширина и gapB), а не шесть", () => {
    const ops = render({ marks: marks([mk("m", "W", "a", 0, 190)]), selectedId: "m" })
    expect(arrows(ops)).toHaveLength(4)
    expect(extensionAt(ops, 190, FACE, LINE)).toBe(true)
    expect(extensionAt(ops, 500, FACE, LINE)).toBe(true)
  })

  it("DC-12: пометка на всю стену выделена: два нуля и один размер ширины 500 — две стрелки", () => {
    const ops = render({ marks: marks([mk("m", "W", "a", 0, 500)]), selectedId: "m" })
    expect(texts(ops).map((t) => t.text).sort()).toEqual(["0", "0", "500"])
    expect(arrows(ops)).toHaveLength(2)
    expect(lineCovers(ops, LINE, 0, 500)).toBe(true)
  })
})

describe("сторона нормали и превью", () => {
  it("DC-04: обратная стена (500,0)→(0,0): размер на стороне y < 0: выносные в x = 400 и 310 от грани y = −10", () => {
    const rev = [wall(500, 0, 0, 0, "R")]
    const ops = render({ walls: rev, marks: effectiveMarks([mk("m", "R", "a", 100, 190)], rev) })
    const line = -FACE - (1.2 * SCREEN_METRICS.labelPx) / K
    expect(extensionAt(ops, 400, -FACE, line)).toBe(true)
    expect(extensionAt(ops, 310, -FACE, line)).toBe(true)
    expect(lineCovers(ops, line, 310, 400)).toBe(true)
  })

  it("DC-13: превью протяжки 100–190: выносные линии, линия, стрелки и число 90", () => {
    const ops = render({ marks: [], ghost: { wallId: "W", from: 100, to: 190 } })
    expect(extensionAt(ops, 100, FACE, LINE)).toBe(true)
    expect(extensionAt(ops, 190, FACE, LINE)).toBe(true)
    expect(lineCovers(ops, LINE, 100, 190)).toBe(true)
    expect(arrows(ops)).toHaveLength(2)
    expect(texts(ops).map((t) => t.text)).toEqual(["90"])
  })

  it("DC-13: превью в метрах и миллиметрах: число «0,9» и «900»", () => {
    for (const [unit, text] of [["m", "0,9"], ["mm", "900"]] as const) {
      expect(texts(render({ marks: [], ghost: { wallId: "W", from: 100, to: 190 } }, {}, unit)).map((t) => t.text)).toEqual([text])
    }
  })

  it("DC-13: превью поверх существующей пометки: размеры обеих — 90 и 50", () => {
    const ops = render({ marks: marks([mk("m", "W", "a", 300, 350)]), ghost: { wallId: "W", from: 100, to: 190 } })
    expect(texts(ops).map((t) => t.text).sort()).toEqual(["50", "90"])
    expect(arrows(ops)).toHaveLength(4)
  })
})

describe("цвет и метрики", () => {
  it("DC-14: цвет из параметров: выносные линии, линия и стрелки зелёные, красного нет", () => {
    const ops = render({ marks: marks() }, { color: "#00aa00" })
    expect(extensionAt(ops, 100, FACE, LINE, SCREEN_METRICS, "#00aa00")).toBe(true)
    expect(lineCovers(ops, LINE, 100, 190, SCREEN_METRICS, "#00aa00")).toBe(true)
    expect(arrows(ops, "#00aa00")).toHaveLength(2)
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
})
