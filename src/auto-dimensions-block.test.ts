import { describe, expect, it } from "vitest"
import { placeWall } from "./auto-dimensions"
import { dimsOf, expectThickness, measure, placeAll, split, w } from "./auto-dimensions.test-utils"
import type { Scene } from "./history"
import type { Point, Wall } from "./types"

// change fix-diagonal-corner-block-snap-and-dimensions (test-plan.md, BD-*, IC-*): торцы, закрытые блоком
// диагонального углового стыка, не получают размера толщины (dimension-tool, «Торцы, закрытые блоком
// диагонального стыка, без размера толщины»). Размеры длины граней здесь намеренно не проверяются
// (вне объёма изменения). Эталоны выведены из спецификации и геометрии сцен.
//
// Сцена: A (−100,0)→(0,0) t20, B (10,10)→(10,110) t20; блок x ∈ [0,20], y ∈ [−10,10].

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const BLOCK: Box = { x0: 0, y0: -10, x1: 20, y1: 10 }
const EPS = 1e-6

const strictlyInside = (p: Point, b: Box): boolean => p.x > b.x0 + EPS && p.x < b.x1 - EPS && p.y > b.y0 + EPS && p.y < b.y1 - EPS

// отрезок заходит внутрь блока: выборка внутренних точек, независимо от кода размеров
function segmentEntersBox(a: Point, b: Point, box: Box): boolean {
  for (let i = 1; i < 100; i++) {
    const t = i / 100
    if (strictlyInside({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, box)) return true
  }
  return false
}

function expectNothingInsideBlock(scene: Scene, box: Box = BLOCK): void {
  for (const d of scene.dimensions) {
    const m = measure(d, scene.walls)
    expect(segmentEntersBox(m.from, m.to, box), `отрезок замера ${JSON.stringify([m.from, m.to])} в блоке`).toBe(false)
    expect(segmentEntersBox(m.line[0], m.line[1], box), `размерная линия ${JSON.stringify(m.line)} в блоке`).toBe(false)
  }
}

const A = (): Wall => w(-100, 0, 0, 0, "A")
const B = (): Wall => w(10, 10, 10, 110, "B")

describe("Т-образная стена из диагонального стыка", () => {
  it("BD-1: у A размер толщины только на дальнем торце a, на торце b у блока его нет", () => {
    const a = A()
    const scene = placeAll([a, B()])
    const s = split(scene, a)
    expect(s.thickness).toHaveLength(1)
    expectThickness(s.thickness[0], a, 0, -1)
  })

  it("BD-2: у B размер толщины только на дальнем торце b, на торце a внутри блока его нет", () => {
    const b = B()
    const scene = placeAll([A(), b])
    const s = split(scene, b)
    expect(s.thickness).toHaveLength(1)
    expectThickness(s.thickness[0], b, 100, 1)
  })

  it("BD-5: ни отрезок замера, ни размерная линия автоматических размеров не лежат внутри блока", () => {
    expectNothingInsideBlock(placeAll([A(), B()]))
  })

  it("BD-6: стены в обратном порядке (B, затем A) — тот же набор размеров толщины, ничего в блоке", () => {
    const a = A()
    const b = B()
    const scene = placeAll([b, a])
    expect(split(scene, a).thickness).toHaveLength(1)
    expect(split(scene, b).thickness).toHaveLength(1)
    expectThickness(split(scene, a).thickness[0], a, 0, -1)
    expectThickness(split(scene, b).thickness[0], b, 100, 1)
    expectNothingInsideBlock(scene)
  })
})

describe("третья стена вплотную к блоку", () => {
  it("BD-3: после C (10,−10)→(10,−110) размеры толщины A и B у блока по-прежнему отсутствуют, у C — только на свободном торце", () => {
    const a = A()
    const b = B()
    const c = w(10, -10, 10, -110, "C")
    const scene = placeAll([a, b, c])
    expect(split(scene, a).thickness).toHaveLength(1)
    expect(split(scene, b).thickness).toHaveLength(1)
    const sc = split(scene, c)
    expect(sc.thickness).toHaveLength(1)
    expectThickness(sc.thickness[0], c, 100, 1)
    expectNothingInsideBlock(scene)
  })

  it("IC-1: цепочка A, B, C — нигде в размерах не появляется толщина A у блока: всего три размера толщины (A, B, C)", () => {
    const scene = placeAll([A(), B(), w(10, -10, 10, -110, "C")])
    const thickness = scene.dimensions.filter((d) => {
      const m = measure(d, scene.walls)
      const owner = scene.walls.find((x) => x.id === d.auto)
      if (!owner) return false
      return Math.abs(m.length - owner.thicknessCm) < EPS
    })
    expect(thickness).toHaveLength(3)
    expect(dimsOf(scene, "A").length).toBeGreaterThanOrEqual(1)
  })

  it("BD-7: пересчёт — установка C не оставляет у A и B размеров, пересчитанных заново с толщиной внутри блока", () => {
    const base = placeAll([A(), B()])
    const next = placeWall(base, w(10, -10, 10, -110, "C"))
    expect(next).not.toBeNull()
    if (next) expectNothingInsideBlock(next)
  })
})

describe("большая толщина стен", () => {
  it("IC-2: A и B толщиной 195 — у каждой по одному размеру толщины на дальнем торце, в блоке 195 × 195 размеров нет", () => {
    const a = w(-1000, 0, 0, 0, "A", 195)
    const b = w(97.5, 97.5, 97.5, 1000, "B", 195)
    const scene = placeAll([a, b])
    expect(split(scene, a).thickness).toHaveLength(1)
    expect(split(scene, b).thickness).toHaveLength(1)
    expectThickness(split(scene, a).thickness[0], a, 0, -1)
    expectThickness(split(scene, b).thickness[0], b, 902.5, 1)
    expectNothingInsideBlock(scene, { x0: 0, y0: -97.5, x1: 195, y1: 97.5 })
  })
})

describe("стык не диагональный", () => {
  it("BD-4: параллельные стены на диагонали (блока нет) — каждая получает размеры толщины на обоих торцах", () => {
    const a = A()
    const b = w(10, 10, 110, 10, "B")
    const scene = placeAll([a, b])
    expect(split(scene, a).thickness).toHaveLength(2)
    expect(split(scene, b).thickness).toHaveLength(2)
  })

  it("BD-4a: свободная стена рядом с блоком, не касающаяся его, — толщина на обоих торцах", () => {
    const scene = placeAll([A(), B(), w(200, 0, 300, 0, "D")])
    expect(split(scene, scene.walls[2]).thickness).toHaveLength(2)
  })
})
