import { describe, expect, it } from "vitest"
import type { Battery, Doorway, FurnitureItem, Wall, WallElement } from "../types"
import { FURNITURE_KIND_ORDER, isFurnitureKind, kindEntry } from "./furniture-kinds"
import type { FurnitureKind } from "./furniture-kinds"
import { furnitureOverlaps, itemOverlaps, obstaclesOf, overlapKinds } from "./overlap"
import type { ObstacleSource } from "./overlap"

// change furniture-overlap-exemptions: наложения, которые не считаются пересечением (spec furniture-plan «Пересечения стола»).
// Сцены посчитаны вручную: стена (0,0)–(400,0) толщиной 20 занимает y −10…10, батарея на её грани +1 — x 50–150, y 10…20.

const item = (id: string, kind: FurnitureKind, x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const source = (parts: Partial<ObstacleSource> = {}): ObstacleSource => ({ walls: [], drywall: [], plaster: [], elements: [], batteries: [], communications: [], ...parts })

const host: Wall = { id: "h", a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thicknessCm: 20, type: "brick" }
const battery: Battery = { id: "b", wallId: "h", face: 1, anchor: "a", offsetCm: 50, lengthCm: 100, thicknessCm: 10, gapCm: 0 }
const withBattery = obstaclesOf(source({ walls: [host], batteries: [battery] }))

const CABINETS = ["wallCabinet", "nightstand", "kitchenCabinet"] as const

describe("шторы и батарея", () => {
  it("FOE-01: шторы на батарее — пересечения нет", () => {
    // шторы 40×40 с центром (100, 30): y 10–50, x 80–120 — касаются стены и налагаются на батарею 40 × 10
    expect(itemOverlaps(item("c", "curtains", 100, 30, 40, 40), withBattery)).toEqual([])
  })

  it("FOE-02: стол на той же батарее пересечение даёт (исключение только у штор)", () => {
    expect(overlapKinds(itemOverlaps(item("t", "table", 100, 30, 40, 40), withBattery))).toEqual(["battery"])
  })

  it("FOE-03: шторы на батарее и на стене — остаётся только стена", () => {
    // y −5…35: заходит в стену на 15 (y −5…10) и налагается на батарею
    const o = itemOverlaps(item("c", "curtains", 100, 15, 40, 40), withBattery)
    expect(overlapKinds(o)).toEqual(["wall"])
  })

  it("FOE-04: шторы на окне и на диване — окно и диван остаются", () => {
    // окно x 100–190 в стене; шторы 40×40 центром (145, 0), диван 80×40 центром (145, 25) налагается на шторы (y 5–20) и на окно, не выходя за его откосы
    const win: WallElement = { ...({ id: "y", wallId: "h", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210 } satisfies Doorway), kind: "window", sillCm: 80 }
    const obstacles = obstaclesOf(source({ walls: [host], elements: [win] }))
    const o = furnitureOverlaps([item("c", "curtains", 145, 0, 40, 40), item("s", "sofa", 145, 25, 80, 40)], obstacles)
    expect(overlapKinds(o)).toEqual(["window", "furniture"])
  })
})

describe("телевизор и тумба", () => {
  for (const cabinet of CABINETS) {
    it(`FOE-05: телевизор на предмете «${cabinet}» — пересечения нет при любом порядке идентификаторов`, () => {
      const tv = (id: string): FurnitureItem => item(id, "tv", 100, 100, 91, 11)
      const cab = (id: string): FurnitureItem => item(id, cabinet, 100, 100, 100, 40)
      expect(furnitureOverlaps([tv("a"), cab("b")], [])).toEqual([])
      expect(furnitureOverlaps([cab("a"), tv("b")], [])).toEqual([])
    })
  }

  it("FOE-06: телевизор на тумбе и на столе — остаётся только пара со столом", () => {
    // тумба 180×42: y 79–121; телевизор 91×11 центром (100, 80): y 74.5–85.5, на тумбе 6.5; стол 40×30 центром (100, 60): y 45–75,
    // на телевизор налагается на 0.5, до тумбы не доходит
    const o = furnitureOverlaps([item("a", "tv", 100, 80, 91, 11), item("b", "wallCabinet", 100, 100, 180, 42), item("c", "table", 100, 60, 40, 30)], [])
    expect(o.map((x) => [x.itemKind, x.otherKind].sort())).toEqual([["table", "tv"]])
  })

  it("FOE-07: тумба на тумбе и телевизор на телевизоре — пересечение остаётся", () => {
    expect(furnitureOverlaps([item("a", "wallCabinet", 100, 100, 180, 42), item("b", "kitchenCabinet", 100, 100, 60, 62)], [])).toHaveLength(1)
    expect(furnitureOverlaps([item("a", "tv", 100, 100, 91, 11), item("b", "tv", 100, 100, 91, 11)], [])).toHaveLength(1)
  })

  it("FOE-08: телевизор на шкафе-купе — пересечение остаётся (исключены только тумбы)", () => {
    expect(furnitureOverlaps([item("a", "tv", 100, 100, 91, 11), item("b", "slidingWardrobe", 100, 100, 300, 60)], [])).toHaveLength(1)
  })
})

describe("каталог", () => {
  it("FOE-10: исключения перечисляют только существующие виды мебели", () => {
    for (const kind of FURNITURE_KIND_ORDER) for (const other of kindEntry(kind).overlapExemptions?.furniture ?? []) expect(isFurnitureKind(other)).toBe(true)
  })
})

describe("призрак", () => {
  it("FOE-09: призрак телевизора над тумбой и призрак штор над батареей пересечений не дают", () => {
    expect(itemOverlaps(item("ghost", "tv", 100, 100, 91, 11), [], [item("b", "wallCabinet", 100, 100, 180, 42)])).toEqual([])
    expect(itemOverlaps(item("ghost", "curtains", 100, 30, 40, 40), withBattery)).toEqual([])
  })
})
