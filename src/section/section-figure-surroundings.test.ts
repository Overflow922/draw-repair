import { describe, expect, it } from "vitest"
import type { DoorLeaf } from "../doorway/doorway-layout"
import type { CalloutLayout } from "../callout/callout-layout"
import type { Point } from "../types"
import { rectOverlapsPolygon } from "./section-figure-collide"
import { calloutPolygons, dimensionPolygons, doorSwingPolygon, planSurroundings } from "./section-figure-surroundings"

// change move-section-figure: объекты плана как препятствия фигуры (spec section-view «Перемещение фигуры разреза»)

const hits = (polys: readonly (readonly Point[])[], r: { minX: number; minY: number; maxX: number; maxY: number }): boolean =>
  polys.some((p) => rectOverlapsPolygon(r, p))

// дверь: петля (0,0), закрытое положение вдоль +x на 80, открытое вдоль +y
const door: DoorLeaf = {
  leaf: [],
  hinge: { x: 0, y: 0 },
  radius: 80,
  arcFrom: { x: 80, y: 0 },
  arcTo: { x: 0, y: 80 },
  side: 1,
}

describe("сектор открывания двери", () => {
  it("MSF-60: точки внутри четверти круга заняты, за дугой и в противоположной четверти свободны", () => {
    const sector = [doorSwingPolygon(door)]
    expect(hits(sector, { minX: 20, minY: 20, maxX: 30, maxY: 30 })).toBe(true)
    expect(hits(sector, { minX: 70, minY: 70, maxX: 79, maxY: 79 })).toBe(false)
    expect(hits(sector, { minX: -30, minY: -30, maxX: -20, maxY: -20 })).toBe(false)
  })
})

describe("размерные линии", () => {
  it("MSF-61: размерная и выносные линии — препятствия, место между ними свободно", () => {
    const polys = dimensionPolygons({ a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, p1: { x: 0, y: 50 }, p2: { x: 200, y: 50 } })
    expect(hits(polys, { minX: 90, minY: 48, maxX: 110, maxY: 52 })).toBe(true)
    expect(hits(polys, { minX: -2, minY: 10, maxX: 2, maxY: 20 })).toBe(true)
    expect(hits(polys, { minX: 90, minY: 10, maxX: 110, maxY: 20 })).toBe(false)
  })
})

describe("выноски", () => {
  const layout: CalloutLayout = {
    align: "left",
    lines: [],
    box: { x: 100, y: 100, w: 200, h: 40 },
    lineStart: { x: 100, y: 120 },
    arrowTip: { x: 0, y: 120 },
  }

  it("MSF-62: подложка выноски переводится из пикселей в единицы чертежа с учётом масштаба и сдвига", () => {
    // 2 px на см, сдвиг (10, 20): подложка x от 60 до 160, y от 70 до 90
    const polys = calloutPolygons(layout, 2, { x: 10, y: 20 })
    expect(hits(polys, { minX: 100, minY: 75, maxX: 110, maxY: 85 })).toBe(true)
    expect(hits(polys, { minX: 170, minY: 75, maxX: 180, maxY: 85 })).toBe(false)
  })

  it("MSF-63: линия выноски к стрелке — препятствие", () => {
    const polys = calloutPolygons(layout, 2, { x: 10, y: 20 })
    expect(hits(polys, { minX: 20, minY: 78, maxX: 30, maxY: 82 })).toBe(true)
  })
})

describe("сводка окружения", () => {
  it("MSF-64: собирает стены, двери, размеры и выноски; пустой план даёт пустой список", () => {
    expect(planSurroundings({ obstacles: [], doors: [], dimensions: [], callouts: [], pxPerCm: 1, pan: { x: 0, y: 0 } })).toEqual([])
    const wall = { shape: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], wallId: "W" }
    const polys = planSurroundings({ obstacles: [wall], doors: [door], dimensions: [], callouts: [], pxPerCm: 1, pan: { x: 0, y: 0 } })
    expect(hits(polys, { minX: 2, minY: 2, maxX: 5, maxY: 5 })).toBe(true)
    expect(hits(polys, { minX: 300, minY: 300, maxX: 310, maxY: 310 })).toBe(false)
  })
})
