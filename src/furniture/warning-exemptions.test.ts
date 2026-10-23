import { describe, expect, it } from "vitest"
import type { Battery, FurnitureItem, Wall } from "../types"
import type { FurnitureKind } from "./furniture-kinds"
import { furnitureOverlaps, obstaclesOf } from "./overlap"
import { warningText } from "./warning"

// change furniture-overlap-exemptions: плашка по настоящим пересечениям сцены (spec furniture-plan «Пересечения стола»).

const item = (id: string, kind: FurnitureKind, x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })

const host: Wall = { id: "h", a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thicknessCm: 20, type: "brick" }
const battery: Battery = { id: "b", wallId: "h", face: 1, anchor: "a", offsetCm: 50, lengthCm: 100, thicknessCm: 10, gapCm: 0 }
const obstacles = obstaclesOf({ walls: [host], drywall: [], plaster: [], elements: [], batteries: [battery], communications: [] })

describe("плашка при исключённых наложениях", () => {
  it("WE-01: шторы на батарее — плашки нет", () => {
    expect(warningText(furnitureOverlaps([item("c", "curtains", 100, 30, 40, 40)], obstacles))).toBeNull()
  })

  it("WE-02: шторы на батарее и на стене — плашка называет только стену", () => {
    expect(warningText(furnitureOverlaps([item("c", "curtains", 100, 15, 40, 40)], obstacles))).toBe("Шторы пересекается: стена")
  })

  it("WE-03: телевизор на тумбе — плашки нет", () => {
    expect(warningText(furnitureOverlaps([item("a", "tv", 100, 100, 91, 11), item("b", "wallCabinet", 100, 100, 180, 42)], []))).toBeNull()
  })

  it("WE-04: телевизор на тумбе и на столе — «Мебель пересекается: стол, телевизор», тумбы в плашке нет", () => {
    // сцена из FOE-06: стол задевает телевизор, но не тумбу
    const items = [item("a", "tv", 100, 80, 91, 11), item("b", "wallCabinet", 100, 100, 180, 42), item("c", "table", 100, 60, 40, 30)]
    expect(warningText(furnitureOverlaps(items, []))).toBe("Мебель пересекается: стол, телевизор")
  })
})
