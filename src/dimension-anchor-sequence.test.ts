import { describe, expect, it } from "vitest"
import { dimPointPoint, nearestDimAnchor, nearestEdgeIntersection } from "./geometry"
import { autoWallDimensions, syncAutoDimensions } from "./auto-dimensions"
import type { Dimension, DimPoint, Wall } from "./types"
import { expectAt, jambPoint, lengthBetween, sceneR, sceneR2, w } from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: последовательности стен (комната рисуется стена за стеной) — позднее
// добавленные стены меняют контуры ранних, а откосы окон остаются на своих местах
// (spec dimension-tool «Точки замера на откосах элементов стены»; test-plan.md «Integration Cases»; память
// check-multi-step-sequences).

const ORDERS: string[][] = [
  ["W", "R", "B", "L"],
  ["W", "L", "B", "R"],
  ["R", "W", "L", "B"],
  ["B", "R", "L", "W"],
]

describe("комната, нарисованная стена за стеной", () => {
  const { W, R, B, L, e1, e3, elements } = sceneR2()
  const byId: Record<string, Wall> = { W, R, B, L }
  const e2 = { ...e1, id: "e2", offsetCm: 300 }
  const withTwo = [e1, e2, e3]

  for (const order of ORDERS) {
    it(`DA-41: порядок ${order.join("→")} — после каждой стены откосы окон на W не сдвигаются, расстояние 80`, () => {
      for (let n = 1; n <= order.length; n++) {
        const walls = order.slice(0, n).map((id) => byId[id])
        if (!walls.includes(W)) continue
        const p = dimPointPoint(jambPoint("e1", "b", 1), walls, withTwo)
        const q = dimPointPoint(jambPoint("e2", "a", 1), walls, withTwo)
        expectAt(p, 220, 10)
        expectAt(q, 300, 10)
        expect(p && q ? lengthBetween(p, q) : NaN).toBeCloseTo(80, 3)
        expectAt(dimPointPoint(jambPoint("e1", "b", -1), walls, withTwo), 220, -10)
      }
    })
  }

  it("DA-41b: в готовой комнате снап по-прежнему даёт откосы на обеих гранях W и вершины у углов", () => {
    const walls = [W, R, B, L]
    const jamb = nearestDimAnchor({ x: 221, y: 11 }, walls, withTwo, 3)
    expect(jamb?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "b", face: 1 })
    const outer = nearestDimAnchor({ x: 301, y: -11 }, walls, withTwo, 3)
    expect(outer?.anchor).toEqual({ kind: "jamb", elementId: "e2", jamb: "a", face: -1 })
    const corner = nearestDimAnchor({ x: 11, y: 11 }, walls, withTwo, 3)
    expect(corner?.anchor).toHaveProperty("a")
    expectAt(corner?.point ?? null, 10, 10)
  })

  it("DA-41c: окно на B (ось в обратную сторону) — откосы на нормали (0, −1), не зависят от порядка стен", () => {
    for (const order of ORDERS) {
      const walls = order.map((id) => byId[id])
      expectAt(dimPointPoint(jambPoint("e3", "a", 1), walls, elements), 400, 390)
      expectAt(dimPointPoint(jambPoint("e3", "b", 1), walls, elements), 280, 390)
    }
  })

  it("DA-3b: размер «откос окна — угол соседней стены» следует за поворотом соседней стены", () => {
    const walls = [W, R, B, L]
    const corner = nearestEdgeIntersection({ x: 490, y: 10 }, walls, 2)
    expect(corner).not.toBeNull()
    if (!corner) return
    const edge: DimPoint = { a: corner.a, b: corner.b }
    const dim: Dimension = { from: jambPoint("e1", "b", 1), to: edge, offset: 25 }
    const before = dimPointPoint(dim.to, walls, withTwo)
    expectAt(before, 490, 10)
    const tilted = [W, w(500, 0, 540, 400, "R"), B, L]
    const after = dimPointPoint(dim.to, tilted, withTwo)
    const jambAfter = dimPointPoint(dim.from, tilted, withTwo)
    expect(after).not.toBeNull()
    expectAt(jambAfter, 220, 10)
    if (!after) return
    expect(after.y).toBeCloseTo(10, 3)
    expect(after.x).not.toBeCloseTo(490, 1)
    expect(jambAfter ? lengthBetween(jambAfter, after) : NaN).toBeCloseTo(Math.abs(after.x - 220), 3)
  })
})

describe("авторазмеры не затронуты откосами", () => {
  it("DA-42: автоматические размеры стены граневые и не зависят от элементов", () => {
    const walls = sceneR().walls
    const plain = autoWallDimensions(walls[0], walls)
    expect(plain.length).toBeGreaterThan(0)
    for (const d of plain) {
      expect("kind" in d.from).toBe(false)
      expect("kind" in d.to).toBe(false)
    }
  })

  it("DA-42b: пересчёт автоматических размеров не трогает ручной размер с откосами", () => {
    const { walls, elements } = sceneR2()
    const manual: Dimension = { from: jambPoint("e1", "b", 1), to: jambPoint("e3", "a", 1), offset: 40 }
    const scene = { walls, dimensions: [manual], doorways: elements }
    const synced = syncAutoDimensions(scene, "W")
    expect(synced.dimensions).toContainEqual(manual)
    expect(synced.dimensions.filter((d) => d.auto === "W").length).toBeGreaterThan(0)
    for (const d of synced.dimensions.filter((x) => x.auto !== undefined)) expect("kind" in d.from).toBe(false)
  })
})
