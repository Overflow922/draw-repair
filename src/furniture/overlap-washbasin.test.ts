import { describe, expect, it } from "vitest"
import type { Doorway, FurnitureItem, Wall, WallElement } from "../types"
import type { FurnitureKind } from "./furniture-kinds"
import { furnitureOverlaps, itemOverlaps, obstaclesOf, overlapKinds } from "./overlap"
import type { ObstacleSource } from "./overlap"

// change add-washbasin: у умывальника нет исключений пересечений (spec furniture-plan «Каталог видов мебели», сценарий «Умывальник
// пересекается как обычный предмет»). Стена подложки (0,0)–(400,0) толщиной 20 занимает y −10…10.

const item = (id: string, kind: FurnitureKind, x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const source = (parts: Partial<ObstacleSource> = {}): ObstacleSource => ({ walls: [], drywall: [], plaster: [], elements: [], batteries: [], communications: [], ...parts })
const host: Wall = { id: "h", a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thicknessCm: 20, type: "brick" }
const basin = (id: string, x: number, y: number): FurnitureItem => item(id, "washbasin", x, y, 60, 48)

describe("умывальник пересекается как обычный предмет", () => {
  it("OWB-01: умывальник на стене подложки — пересечение со стеной", () => {
    expect(overlapKinds(itemOverlaps(basin("b", 100, 0), obstaclesOf(source({ walls: [host] }))))).toEqual(["wall"])
  })

  it("OWB-02: умывальник на окне — пересечение с окном", () => {
    const win: WallElement = { ...({ id: "y", wallId: "h", anchor: "a", offsetCm: 70, widthCm: 90, heightCm: 210 } satisfies Doorway), kind: "window", sillCm: 80 }
    const kinds = overlapKinds(itemOverlaps(basin("b", 115, 0), obstaclesOf(source({ walls: [host], elements: [win] }))))
    expect(kinds).toContain("window")
  })

  it("OWB-03: умывальник на стуле — пара умывальника и стула", () => {
    const overlaps = furnitureOverlaps([basin("b", 100, 100), item("c", "chair", 100, 110, 45, 45)], obstaclesOf(source()))
    expect(overlapKinds(overlaps)).toEqual(["furniture"])
    expect(overlaps.map((o) => [o.itemKind, o.otherKind].sort())).toEqual([["chair", "washbasin"]])
  })

  it("OWB-04: умывальник на кухонном шкафу — пересечение (исключений у вида нет)", () => {
    const overlaps = furnitureOverlaps([basin("b", 100, 100), item("k", "kitchenCabinet", 100, 110, 60, 62)], obstaclesOf(source()))
    expect(overlapKinds(overlaps)).toEqual(["furniture"])
  })

  it("OWB-05: умывальник в стороне от всего — пересечений нет", () => {
    expect(itemOverlaps(basin("b", 300, 300), obstaclesOf(source({ walls: [host] })))).toEqual([])
  })
})
