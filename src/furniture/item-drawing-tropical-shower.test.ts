import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { kindEntry } from "./furniture-kinds"
import { hitItem, itemCorners, newItem } from "./item"
import type { ItemDrawingFn } from "./item-drawing"
import { tropicalShowerDrawing } from "./tropical-shower-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-tropical-shower: рисунок вида «Тропический душ» (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок
// тропического душа», «Тропический душ другого размера», «Тропический душ поворачивается с предметом»).
// Линии: 0 корпус, 1 панель, 2–25 форсунки (ряд за рядом сверху вниз, в ряду слева направо).

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

function gridProblems(drawing: ItemDrawingFn): string[] {
  const problems: string[] = []
  for (const w of [10, 25, 30, 40, 47, 90, 200]) {
    for (const l of [5, 12, 30, 31, 100, 200]) {
      const d = drawing(size(w, l))
      if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
      if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
    }
  }
  return problems
}

describe("рисунок тропического душа", () => {
  it("TS-01: душ 40×30 — 26 линий: корпус, панель, 24 форсунки", () => {
    const d = tropicalShowerDrawing(size(40, 30))
    expect(d.lines).toHaveLength(26)
    expect(bounds(d.lines[0])).toEqual([0, 0, 40, 30])
    expect(near(d.lines[0], 3, 0)).toBe(true)
    expect(near(d.lines[0], 0, 3)).toBe(true)
    expect(bounds(d.lines[1])).toEqual([3, 3, 37, 27])
    expect(near(d.lines[1], 4.8, 3)).toBe(true)
    expect(near(d.lines[1], 3, 4.8)).toBe(true)
  })

  it("TS-02: форсунки — окружности радиуса 0,9, центры x = 8…32 с шагом 4,8, y = 9…21 с шагом 4, ряд за рядом сверху вниз", () => {
    const d = tropicalShowerDrawing(size(40, 30))
    const xs = [8, 12.8, 17.6, 22.4, 27.2, 32]
    const ys = [9, 13, 17, 21]
    ys.forEach((y, j) =>
      xs.forEach((x, i) => {
        expect(isCircle(d.lines[2 + j * 6 + i], x, y, 0.9)).toBe(true)
      }),
    )
  })

  it("TS-03: контур — корпус (он же контур обводки выделения и ластика)", () => {
    const d = tropicalShowerDrawing(size(40, 30))
    expect(pts(d.lines[0])).toEqual([...pts(d.outline), pts(d.outline)[0]])
    expect(inside(d.lines, 40, 30)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("TS-04: душ 60×40 — k = 1, корпус и панель растянуты, сетка той же величины по центру", () => {
    const d = tropicalShowerDrawing(size(60, 40))
    expect(bounds(d.lines[0])).toEqual([0, 0, 60, 40])
    expect(bounds(d.lines[1])).toEqual([3, 3, 57, 37])
    expect(isCircle(d.lines[2], 18, 14, 0.9)).toBe(true)
    expect(isCircle(d.lines[25], 42, 26, 0.9)).toBe(true)
  })

  it("TS-05: душ 20×15 — k = 0,5: углы 1,5, панель с отступом 1,5 и углами 0,9, форсунки радиуса 0,45", () => {
    const d = tropicalShowerDrawing(size(20, 15))
    expect(bounds(d.lines[0])).toEqual([0, 0, 20, 15])
    expect(near(d.lines[0], 1.5, 0)).toBe(true)
    expect(bounds(d.lines[1])).toEqual([1.5, 1.5, 18.5, 13.5])
    expect(near(d.lines[1], 2.4, 1.5)).toBe(true)
    expect(isCircle(d.lines[2], 4, 4.5, 0.45)).toBe(true)
    expect(isCircle(d.lines[25], 16, 10.5, 0.45)).toBe(true)
    expect(inside(d.lines, 20, 15)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("TS-06: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(tropicalShowerDrawing)).toEqual([])
  })
})

describe("тропический душ как предмет плана", () => {
  const { defaults } = kindEntry("tropicalShower")

  it("TS-08: новый предмет по значениям каталога — 40×30, угол 0, центр в точке постановки", () => {
    const item = newItem("k", "tropicalShower", { x: 120, y: 80 }, defaults)
    expect([item.widthCm, item.lengthCm, item.angleDeg, item.x, item.y]).toEqual([40, 30, 0, 120, 80])
    expect(itemCorners(item).map((p) => [p.x, p.y])).toEqual([[100, 65], [140, 65], [140, 95], [100, 95]])
  })

  it("TS-09: при угле 90° прямоугольник предмета — 30×40 вокруг того же центра", () => {
    const item = newItem("k", "tropicalShower", { x: 120, y: 80 }, { ...defaults, angleDeg: 90 })
    const xs = itemCorners(item).map((p) => Math.round(p.x * 1e6) / 1e6)
    const ys = itemCorners(item).map((p) => Math.round(p.y * 1e6) / 1e6)
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([105, 135, 60, 100])
    expect(hitItem(item, { x: 120, y: 98 })).toBe(true)
    expect(hitItem(item, { x: 138, y: 80 })).toBe(false)
  })
})

describe("рисунок тропического душа поворачивается с предметом", () => {
  it("TS-07: душ 40×30 с углом 90° — на экране 4 форсунки в ряду и 6 рядов, сетка по центру предмета", () => {
    const item = newItem("k", "tropicalShower", { x: 100, y: 50 }, { widthCm: 40, lengthCm: 30, angleDeg: 90 })
    const nozzles = itemDrawingInPlan(item).lines.slice(2).map(centre)
    expect(nozzles).toHaveLength(24)
    expect(new Set(nozzles.map((c) => c[0])).size).toBe(4)
    expect(new Set(nozzles.map((c) => c[1])).size).toBe(6)
    const meanX = nozzles.reduce((s, c) => s + (c[0] ?? 0), 0) / nozzles.length
    const meanY = nozzles.reduce((s, c) => s + (c[1] ?? 0), 0) / nozzles.length
    expect(Math.abs(meanX - item.x)).toBeLessThan(0.01)
    expect(Math.abs(meanY - item.y)).toBeLessThan(0.01)
  })
})
