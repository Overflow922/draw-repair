import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import { kitchenCabinetDrawing } from "./kitchen-cabinet-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-kitchen-cabinet-fridge: рисунок кухонного шкафа (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок кухонного
// шкафа», «Кухонный шкаф другого размера», «Фасад шкафа поворачивается с предметом»).
// Линии: 0 корпус, 1 линия панели, 2 планка ручки, 3 и 4 стойки ручки (левая, правая).

describe("рисунок кухонного шкафа", () => {
  it("KC-01: шкаф 60×62 — пять линий с числами из спеки", () => {
    const d = kitchenCabinetDrawing(size(60, 62))
    expect(d.lines).toHaveLength(5)
    expect(pts(d.lines[0])).toEqual([[0, 2], [60, 2], [60, 62], [0, 62], [0, 2]])
    expect(pts(d.lines[1])).toEqual([[0, 5], [60, 5]])
    expect(pts(d.lines[2])).toEqual([[17.25, 0], [42.75, 0]])
    expect(pts(d.lines[3])).toEqual([[21.25, 0], [21.25, 2]])
    expect(pts(d.lines[4])).toEqual([[38.75, 0], [38.75, 2]])
  })

  it("KC-02: контур для обводки — прямоугольник предмета, в линии он не входит; рисунок внутри, без пересечений", () => {
    const d = kitchenCabinetDrawing(size(60, 62))
    expect(pts(d.outline)).toEqual([[0, 0], [60, 0], [60, 62], [0, 62]])
    expect(d.lines.some((l) => l.some((p) => p.x === 60 && p.y === 0))).toBe(false)
    expect(inside(d.lines, 60, 62)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KC-03: шкаф 90×62 — ручка по центру ширины, корпус и панель по всей ширине", () => {
    const d = kitchenCabinetDrawing(size(90, 62))
    expect(pts(d.lines[1])).toEqual([[0, 5], [90, 5]])
    expect(pts(d.lines[2])).toEqual([[32.25, 0], [57.75, 0]])
    expect(pts(d.lines[3])).toEqual([[36.25, 0], [36.25, 2]])
    expect(pts(d.lines[4])).toEqual([[53.75, 0], [53.75, 2]])
  })

  it("KC-04: шкаф 60×100 — корпус глубже, ручка и панель те же", () => {
    const d = kitchenCabinetDrawing(size(60, 100))
    expect(pts(d.lines[0])).toEqual([[0, 2], [60, 2], [60, 100], [0, 100], [0, 2]])
    expect(d.lines.slice(1).map(pts)).toEqual(kitchenCabinetDrawing(size(60, 62)).lines.slice(1).map(pts))
  })

  it("KC-05: шкаф 60×31 — k = 0,5, все числа вдвое меньше", () => {
    const d = kitchenCabinetDrawing(size(60, 31))
    expect(pts(d.lines[0])).toEqual([[0, 1], [60, 1], [60, 31], [0, 31], [0, 1]])
    expect(pts(d.lines[1])).toEqual([[0, 2.5], [60, 2.5]])
    expect(pts(d.lines[2])).toEqual([[23.625, 0], [36.375, 0]])
    expect(pts(d.lines[3])).toEqual([[25.625, 0], [25.625, 1]])
    expect(pts(d.lines[4])).toEqual([[34.375, 0], [34.375, 1]])
    expect(inside(d.lines, 60, 31)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KC-06: образец легенды — масштаб 1 из аргумента при уменьшенных габаритах даёт подобие рисунка", () => {
    const d = kitchenCabinetDrawing(size(15, 15.5), 1)
    expect(d.lines).toHaveLength(5)
    expect(pts(d.lines[0])).toEqual([[0, 0.5], [15, 0.5], [15, 15.5], [0, 15.5], [0, 0.5]])
    expect(inside(d.lines, 15, 15.5)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KC-07: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    const problems: string[] = []
    for (const w of [10, 25, 47, 60, 90, 200]) {
      for (const l of [5, 12, 31, 62, 100, 200]) {
        const d = kitchenCabinetDrawing(size(w, l))
        if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
        if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
      }
    }
    expect(problems).toEqual([])
  })

  it("KC-08: шкаф с углом 90° — ручка справа от центра, корпус левее", () => {
    const item = newItem("k", "kitchenCabinet", { x: 0, y: 0 }, { widthCm: 60, lengthCm: 62, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)
    expect(meanX(lines[2])).toBeGreaterThan(meanX(lines[1]))
    expect(meanX(lines[1])).toBeGreaterThan(meanX(lines[0]))
  })
})
