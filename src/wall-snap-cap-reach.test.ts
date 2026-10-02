import { describe, expect, it } from "vitest"
import { snapRadiusCm, snapVertex } from "./wall-snap"
import type { Point, Wall } from "./types"
import { W, sceneS } from "./wall-snap.test-utils"

// change fix-wall-snap-overlap, ревизия 4: коллинеарное продолжение от свободного торца
// срабатывает только вблизи торца — не дальше зоны прилипания reach = max(R, newHalf)
// от плоскости торца вдоль оси.

const GRID = 10

const snap = (p: Point, walls: Wall[], zoom = 1, t = 20, orthoFrom?: Point) =>
  snapVertex(p, walls, snapRadiusCm(zoom), GRID, t, orthoFrom)

describe("Дальность продолжения от торца", () => {
  it("CAP-REACH-1: масштаб 1, новая 20 (reach 10) — граница включительно", () => {
    // change cap-snap-vertex-at-square-center: прилипшая вершина — центр квадрата
    expect(snap({ x: 110, y: 3 }, sceneS())).toEqual({ point: { x: 110, y: 0 }, source: "wall" })
    expect(snap({ x: 110.5, y: 3 }, sceneS())).toEqual({ point: { x: 110, y: 0 }, source: "grid" })
  })

  it("CAP-REACH-2: отдалённый вид (reach = R = 24)", () => {
    expect(snap({ x: 124, y: 2 }, sceneS(), 0.25)).toEqual({ point: { x: 110, y: 0 }, source: "wall" })
    expect(snap({ x: 124.5, y: 2 }, sceneS(), 0.25)).toEqual({ point: { x: 120, y: 0 }, source: "grid" })
  })

  it("CAP-REACH-3: толстая новая стена (reach = newHalf = 20)", () => {
    expect(snap({ x: 120, y: 3 }, sceneS(), 1, 40)).toEqual({ point: { x: 120, y: 0 }, source: "wall" })
    expect(snap({ x: 121, y: 3 }, sceneS(), 1, 40)).toEqual({ point: { x: 120, y: 0 }, source: "grid" })
  })

  it("CAP-REACH-A: начальный торец a ограничен так же", () => {
    expect(snap({ x: -10, y: 3 }, sceneS())).toEqual({ point: { x: -10, y: 0 }, source: "wall" })
    expect(snap({ x: -11, y: 3 }, sceneS())).toEqual({ point: { x: -10, y: 0 }, source: "grid" })
  })

  it("CAP-FAR-USER-1: сцена ручной проверки — далёкий торец тонкой стены не притягивает второй конец", () => {
    const walls = [
      W(50, 50, 350, 50),
      W(350, 50, 350, 250),
      W(350, 250, 50, 250),
      W(50, 250, 60, 60),
      W(200, 60, 200, 180, 10),
    ]
    expect(snap({ x: 195, y: 290 }, walls, 1, 20, { x: 0, y: 0 })).toEqual({ point: { x: 200, y: 290 }, source: "grid" })
  })

  it("CAP-CONTINUE-1: стена продолжается по той же линии — конец не возвращается к торцу", () => {
    expect(snap({ x: 300, y: 2 }, sceneS(), 1, 20, { x: 100, y: 0 })).toEqual({ point: { x: 300, y: 0 }, source: "grid" })
  })
})
