import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { kindEntry } from "./furniture-kinds"
import { hitItem, itemCorners, newItem } from "./item"
import type { ItemDrawingFn } from "./item-drawing"
import { wallShowerDrainDrawing } from "./wall-shower-drain-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-wall-shower-drain: рисунок вида «Трап в стену» (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок трапа в стену»,
// «Трап в стену другого размера», «Трап в стену поворачивается с предметом»).
// Линии: 0 контур лотка, 1 тело лотка, 2 щель у лицевой стороны (y = l).

const r4 = (v: number): number => Math.round(v * 1e4) / 1e4
const bounds = (line: readonly Point[] | undefined): number[] => {
  const xs = (line ?? []).map((p) => p.x)
  const ys = (line ?? []).map((p) => p.y)
  return [r4(Math.min(...xs)), r4(Math.min(...ys)), r4(Math.max(...xs)), r4(Math.max(...ys))]
}
const near = (line: readonly Point[] | undefined, x: number, y: number): boolean =>
  (line ?? []).some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6)
const centre = (line: readonly Point[] | undefined): number[] => {
  const [x0, y0, x1, y1] = bounds(line)
  return [r4(((x0 ?? 0) + (x1 ?? 0)) / 2), r4(((y0 ?? 0) + (y1 ?? 0)) / 2)]
}

// зазор между охватами двух линий по вертикали и по бокам: контур ⊃ тело ⊃ щель не касаются
function gaps(drawing: ReturnType<ItemDrawingFn>): number[] {
  const [outer, body, slot] = drawing.lines.map(bounds)
  if (!outer || !body || !slot) return [-1]
  return [
    (body[0] ?? 0) - (outer[0] ?? 0),
    (body[1] ?? 0) - (outer[1] ?? 0),
    (outer[2] ?? 0) - (body[2] ?? 0),
    (slot[1] ?? 0) - (body[3] ?? 0),
    (outer[3] ?? 0) - (slot[3] ?? 0),
    (slot[0] ?? 0) - (outer[0] ?? 0),
  ]
}

describe("рисунок трапа в стену", () => {
  it("WSD-01: трап 70×8 — 3 линии: контур (0;0)–(70;8), тело (1,5;1,5)–(68,5;5), щель (3;6)–(67;7)", () => {
    const d = wallShowerDrainDrawing(size(70, 8))
    expect(d.lines).toHaveLength(3)
    expect(bounds(d.lines[0])).toEqual([0, 0, 70, 8])
    expect(bounds(d.lines[1])).toEqual([1.5, 1.5, 68.5, 5])
    expect(bounds(d.lines[2])).toEqual([3, 6, 67, 7])
  })

  it("WSD-02: углы — радиус 0,6 у контура и 0,3 у тела и щели", () => {
    const d = wallShowerDrainDrawing(size(70, 8))
    expect(near(d.lines[0], 0.6, 0)).toBe(true)
    expect(near(d.lines[0], 0, 0.6)).toBe(true)
    expect(near(d.lines[1], 1.8, 1.5)).toBe(true)
    expect(near(d.lines[2], 3.3, 6)).toBe(true)
  })

  it("WSD-03: контур — первая линия (он же контур обводки выделения и ластика), рисунок внутри и без пересечений", () => {
    const d = wallShowerDrainDrawing(size(70, 8))
    expect(pts(d.lines[0])).toEqual([...pts(d.outline), pts(d.outline)[0]])
    expect(inside(d.lines, 70, 8)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("WSD-04: трап 100×8 — линии удлинены по ширине, щель та же по ширине 1 у лицевой стороны", () => {
    const d = wallShowerDrainDrawing(size(100, 8))
    expect(bounds(d.lines[0])).toEqual([0, 0, 100, 8])
    expect(bounds(d.lines[1])).toEqual([1.5, 1.5, 98.5, 5])
    expect(bounds(d.lines[2])).toEqual([3, 6, 97, 7])
  })

  it("WSD-05: трап 70×12 — тело растянуто в глубину, щель остаётся у лицевой стороны", () => {
    const d = wallShowerDrainDrawing(size(70, 12))
    expect(bounds(d.lines[0])).toEqual([0, 0, 70, 12])
    expect(bounds(d.lines[1])).toEqual([1.5, 1.5, 68.5, 9])
    expect(bounds(d.lines[2])).toEqual([3, 10, 67, 11])
  })

  it("WSD-06: трап 35×4 — k = 0,5: углы контура 0,3, тело (0,75;0,75)–(34,25;2,5), щель (1,5;3)–(33,5;3,5)", () => {
    const d = wallShowerDrainDrawing(size(35, 4))
    expect(bounds(d.lines[0])).toEqual([0, 0, 35, 4])
    expect(near(d.lines[0], 0.3, 0)).toBe(true)
    expect(bounds(d.lines[1])).toEqual([0.75, 0.75, 34.25, 2.5])
    expect(near(d.lines[1], 0.9, 0.75)).toBe(true)
    expect(bounds(d.lines[2])).toEqual([1.5, 3, 33.5, 3.5])
    expect(inside(d.lines, 35, 4)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("WSD-07: сетка размеров 10–200 × 3–60 — внутри прямоугольника, без пересечений, зазоры между линиями не меньше 0,5·k", () => {
    const problems: string[] = []
    for (const w of [10, 25, 35, 69, 70, 71, 100, 200]) {
      for (const l of [3, 4, 7, 8, 9, 12, 30, 60]) {
        const d = wallShowerDrainDrawing(size(w, l))
        const k = Math.min(1, w / 70, l / 8)
        if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
        if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
        if (gaps(d).some((g) => g < 0.5 * k - 1e-9)) problems.push(`${w}×${l}: зазор меньше 0,5·k`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe("трап в стену как предмет плана", () => {
  const { defaults } = kindEntry("wallShowerDrain")

  it("WSD-08: новый предмет по значениям каталога — 70×8, угол 0, центр в точке постановки", () => {
    const item = newItem("k", "wallShowerDrain", { x: 120, y: 80 }, defaults)
    expect([item.widthCm, item.lengthCm, item.angleDeg, item.x, item.y]).toEqual([70, 8, 0, 120, 80])
    expect(itemCorners(item).map((p) => [p.x, p.y])).toEqual([[85, 76], [155, 76], [155, 84], [85, 84]])
  })

  it("WSD-09: при угле 90° прямоугольник предмета — 8×70 вокруг того же центра", () => {
    const item = newItem("k", "wallShowerDrain", { x: 120, y: 80 }, { ...defaults, angleDeg: 90 })
    const xs = itemCorners(item).map((p) => Math.round(p.x * 1e6) / 1e6)
    const ys = itemCorners(item).map((p) => Math.round(p.y * 1e6) / 1e6)
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([116, 124, 45, 115])
    expect(hitItem(item, { x: 120, y: 110 })).toBe(true)
    expect(hitItem(item, { x: 135, y: 80 })).toBe(false)
  })
})

describe("рисунок трапа в стену поворачивается с предметом", () => {
  it("WSD-10: при угле 0 щель ниже центра предмета, при угле 180° — выше, на том же расстоянии", () => {
    const at = (angleDeg: number): number[] => {
      const item = newItem("k", "wallShowerDrain", { x: 100, y: 50 }, { widthCm: 70, lengthCm: 8, angleDeg })
      return centre(itemDrawingInPlan(item).lines[2])
    }
    const [x0, y0] = at(0)
    const [x180, y180] = at(180)
    expect(y0).toBeCloseTo(50 + 2.5, 3)
    expect(y180).toBeCloseTo(50 - 2.5, 3)
    expect(x0).toBeCloseTo(100, 3)
    expect(x180).toBeCloseTo(100, 3)
  })
})
