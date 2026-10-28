import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { kindEntry } from "./furniture-kinds"
import { hitItem, itemCorners, newItem } from "./item"
import type { ItemDrawingFn } from "./item-drawing"
import { washbasinDrawing } from "./washbasin-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-washbasin: рисунок вида «Умывальник» (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок умывальника»,
// «Умывальник другого размера», «Умывальник поворачивается с предметом»).
// Линии: 0 рамка, 1 чаша, 2 слив, 3 смеситель, 4 левый вентиль, 5 правый вентиль.

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
const isCircle = (line: readonly Point[] | undefined, cx: number, cy: number, r: number): boolean =>
  (line ?? []).length > 12 && (line ?? []).every((p) => Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) < 1e-9)

// наименьший зазор между охватами соседних линий: рамка ⊃ чаша ⊃ слив, смеситель и вентили между задней стороной и чашей
function minGap(drawing: ReturnType<ItemDrawingFn>): number {
  const [frame, bowl, drain, mixer, valveL, valveR] = drawing.lines.map(bounds)
  if (!frame || !bowl || !drain || !mixer || !valveL || !valveR) return -1
  const [fx0, fy0, fx1, fy1] = frame as [number, number, number, number]
  const [bx0, by0, bx1, by1] = bowl as [number, number, number, number]
  const [dx0, dy0, dx1, dy1] = drain as [number, number, number, number]
  const [mx0, my0, mx1, my1] = mixer as [number, number, number, number]
  const [, ly0, lx1, ly1] = valveL as [number, number, number, number]
  const [rx0, ry0, , ry1] = valveR as [number, number, number, number]
  return Math.min(
    bx0 - fx0, fx1 - bx1, by0 - fy0, fy1 - by1,
    dx0 - bx0, bx1 - dx1, dy0 - by0, by1 - dy1,
    my0 - fy0, by0 - my1, ly0 - fy0, by0 - ly1, ry0 - fy0, by0 - ry1,
    mx0 - lx1, rx0 - mx1,
  )
}

describe("рисунок умывальника", () => {
  it("WB-01: умывальник 60×48 — 6 линий: рамка (0;0)–(60;48), чаша (6;14)–(54;43), слив, смеситель, два вентиля", () => {
    const d = washbasinDrawing(size(60, 48))
    expect(d.lines).toHaveLength(6)
    expect(bounds(d.lines[0])).toEqual([0, 0, 60, 48])
    expect(bounds(d.lines[1])).toEqual([6, 14, 54, 43])
    expect(isCircle(d.lines[2], 30, 28.5, 1.6)).toBe(true)
    expect(isCircle(d.lines[3], 30, 7, 2.2)).toBe(true)
    expect(isCircle(d.lines[4], 20, 7, 1.5)).toBe(true)
    expect(isCircle(d.lines[5], 40, 7, 1.5)).toBe(true)
  })

  it("WB-02: углы — радиус 2 у рамки и 8 у чаши", () => {
    const d = washbasinDrawing(size(60, 48))
    expect(near(d.lines[0], 2, 0)).toBe(true)
    expect(near(d.lines[0], 0, 2)).toBe(true)
    expect(near(d.lines[1], 14, 14)).toBe(true)
    expect(near(d.lines[1], 6, 22)).toBe(true)
  })

  it("WB-03: рамка — первая линия (она же контур обводки выделения и ластика), рисунок внутри и без пересечений", () => {
    const d = washbasinDrawing(size(60, 48))
    expect(pts(d.lines[0])).toEqual([...pts(d.outline), pts(d.outline)[0]])
    expect(inside(d.lines, 60, 48)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("WB-04: умывальник 80×48 — рамка и чаша шире, смеситель, вентили и слив по середине ширины", () => {
    const d = washbasinDrawing(size(80, 48))
    expect(bounds(d.lines[0])).toEqual([0, 0, 80, 48])
    expect(bounds(d.lines[1])).toEqual([6, 14, 74, 43])
    expect(isCircle(d.lines[2], 40, 28.5, 1.6)).toBe(true)
    expect(isCircle(d.lines[3], 40, 7, 2.2)).toBe(true)
    expect(isCircle(d.lines[4], 30, 7, 1.5)).toBe(true)
    expect(isCircle(d.lines[5], 50, 7, 1.5)).toBe(true)
  })

  it("WB-05: умывальник 60×60 — чаша углублена вниз от задней стороны, слив в середине чаши, смеситель и вентили у задней стороны", () => {
    const d = washbasinDrawing(size(60, 60))
    expect(bounds(d.lines[0])).toEqual([0, 0, 60, 60])
    expect(bounds(d.lines[1])).toEqual([6, 14, 54, 55])
    expect(isCircle(d.lines[2], 30, 34.5, 1.6)).toBe(true)
    expect(isCircle(d.lines[3], 30, 7, 2.2)).toBe(true)
    expect(isCircle(d.lines[4], 20, 7, 1.5)).toBe(true)
  })

  it("WB-06: умывальник 30×24 — k = 0,5: рамка с углами 1, чаша (3;7)–(27;21,5) с углами 4, слив r 0,8, смеситель r 1,1, вентили r 0,75", () => {
    const d = washbasinDrawing(size(30, 24))
    expect(bounds(d.lines[0])).toEqual([0, 0, 30, 24])
    expect(near(d.lines[0], 1, 0)).toBe(true)
    expect(bounds(d.lines[1])).toEqual([3, 7, 27, 21.5])
    expect(near(d.lines[1], 7, 7)).toBe(true)
    expect(isCircle(d.lines[2], 15, 14.25, 0.8)).toBe(true)
    expect(isCircle(d.lines[3], 15, 3.5, 1.1)).toBe(true)
    expect(isCircle(d.lines[4], 10, 3.5, 0.75)).toBe(true)
    expect(isCircle(d.lines[5], 20, 3.5, 0.75)).toBe(true)
    expect(inside(d.lines, 30, 24)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("WB-07: сетка размеров 10–200 × 10–120 — внутри прямоугольника, без пересечений, зазоры между линиями не меньше 0,5·k", () => {
    const problems: string[] = []
    for (const w of [10, 25, 30, 59, 60, 61, 80, 120, 200]) {
      for (const l of [10, 24, 47, 48, 49, 60, 120]) {
        const d = washbasinDrawing(size(w, l))
        const k = Math.min(1, w / 60, l / 48)
        if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
        if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
        if (minGap(d) < 0.5 * k - 1e-9) problems.push(`${w}×${l}: зазор меньше 0,5·k`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe("умывальник как предмет плана", () => {
  const { defaults } = kindEntry("washbasin")

  it("WB-09: новый предмет по значениям каталога — 60×48, угол 0, центр в точке постановки", () => {
    const item = newItem("k", "washbasin", { x: 120, y: 80 }, defaults)
    expect([item.widthCm, item.lengthCm, item.angleDeg, item.x, item.y]).toEqual([60, 48, 0, 120, 80])
    expect(itemCorners(item).map((p) => [p.x, p.y])).toEqual([[90, 56], [150, 56], [150, 104], [90, 104]])
  })

  it("WB-10: при угле 90° прямоугольник предмета — 48×60 вокруг того же центра", () => {
    const item = newItem("k", "washbasin", { x: 120, y: 80 }, { ...defaults, angleDeg: 90 })
    const xs = itemCorners(item).map((p) => Math.round(p.x * 1e6) / 1e6)
    const ys = itemCorners(item).map((p) => Math.round(p.y * 1e6) / 1e6)
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([96, 144, 50, 110])
    expect(hitItem(item, { x: 120, y: 105 })).toBe(true)
    expect(hitItem(item, { x: 150, y: 80 })).toBe(false)
  })
})

describe("рисунок умывальника поворачивается с предметом", () => {
  it("WB-08: при угле 0 смеситель выше центра предмета, при угле 180° — ниже, на том же расстоянии", () => {
    const at = (angleDeg: number): number[] => {
      const item = newItem("k", "washbasin", { x: 100, y: 50 }, { widthCm: 60, lengthCm: 48, angleDeg })
      return centre(itemDrawingInPlan(item).lines[3])
    }
    const [x0, y0] = at(0)
    const [x180, y180] = at(180)
    expect(y0).toBeCloseTo(50 - 17, 3)
    expect(y180).toBeCloseTo(50 + 17, 3)
    expect(x0).toBeCloseTo(100, 3)
    expect(x180).toBeCloseTo(100, 3)
  })
})
