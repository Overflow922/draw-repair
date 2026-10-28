import { describe, expect, it } from "vitest"
import type { Doorway, FurnitureItem, Wall, WallElement } from "../types"
import type { FurnitureKind } from "./furniture-kinds"
import { furnitureOverlaps, itemOverlaps, obstaclesOf, overlapKinds } from "./overlap"
import type { ObstacleSource } from "./overlap"
import { warningText } from "./warning"

// change add-wall-shower-drain: трап в стену лежит в стене (spec furniture-plan «Пересечения стола», сценарии «Трап в стену в стене»,
// «Трап в стену выступает из стены», «Трап в стену на окне»). Стена подложки (0,0)–(400,0) толщиной 20 занимает y −10…10.

const item = (id: string, kind: FurnitureKind, x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const source = (parts: Partial<ObstacleSource> = {}): ObstacleSource => ({ walls: [], drywall: [], plaster: [], elements: [], batteries: [], communications: [], ...parts })
const wallAt = (id: string, thicknessCm: number, type: Wall["type"]): Wall => ({ id, a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thicknessCm, type })

const host = wallAt("h", 20, "brick")
const drain = (id: string, y: number): FurnitureItem => item(id, "wallShowerDrain", 100, y, 70, 8)

describe("трап в стену в стене", () => {
  it("OWD-01: трап целиком в теле стены подложки — пересечения нет", () => {
    expect(itemOverlaps(drain("d", 0), obstaclesOf(source({ walls: [host] })))).toEqual([])
  })

  it("OWD-02: трап в теле стены гипсокартона — пересечения нет", () => {
    expect(itemOverlaps(drain("d", 0), obstaclesOf(source({ drywall: [wallAt("g", 10, "gkl")] })))).toEqual([])
  })

  it("OWD-03: трап в полосе штукатурки — пересечения нет", () => {
    expect(itemOverlaps(drain("d", 0), obstaclesOf(source({ plaster: [wallAt("p", 5, "brick")] })))).toEqual([])
  })

  it("OWD-04: стол на том же месте пересечение со стеной даёт (исключение только у трапа)", () => {
    expect(overlapKinds(itemOverlaps(item("t", "table", 100, 0, 70, 8), obstaclesOf(source({ walls: [host] }))))).toEqual(["wall"])
  })

  it("OWD-05: призрак трапа в стене пересечений не даёт", () => {
    expect(itemOverlaps(drain("ghost", 2), obstaclesOf(source({ walls: [host], drywall: [wallAt("g", 10, "gkl")] })))).toEqual([])
  })
})

describe("трап в стену выступает из стены", () => {
  // трап y 4…12: заходит в стену до y = 10, вынесенная часть y 10…12 — в комнате; стул 45×45 центром (100, 33,5): y 11…56 — на вынесенной
  // части трапа на 1 см и со стеной (y ≤ 10) не соприкасается
  const obstacles = obstaclesOf(source({ walls: [host] }))
  const overlaps = furnitureOverlaps([drain("d", 8), item("c", "chair", 100, 33.5, 45, 45)], obstacles)

  it("OWD-06: остаётся только пара трапа и стула, стены в пересечениях нет", () => {
    expect(overlapKinds(overlaps)).toEqual(["furniture"])
    expect(overlaps.map((o) => [o.itemKind, o.otherKind].sort())).toEqual([["chair", "wallShowerDrain"]])
  })

  it("OWD-07: плашка читает «Мебель пересекается: стул, трап в стену»", () => {
    expect(warningText(overlaps)).toBe("Мебель пересекается: стул, трап в стену")
  })
})

describe("трап в стену на окне", () => {
  // окно x 100–190 в стене; трап 70×8 центром (145, 0) целиком в проёме
  const win: WallElement = { ...({ id: "y", wallId: "h", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210 } satisfies Doorway), kind: "window", sillCm: 80 }
  const obstacles = obstaclesOf(source({ walls: [host], elements: [win] }))
  const overlaps = itemOverlaps(item("d", "wallShowerDrain", 145, 0, 70, 8), obstacles)

  it("OWD-08: трап на окне — остаётся пересечение с окном", () => {
    expect(overlapKinds(overlaps)).toEqual(["window"])
  })

  it("OWD-09: плашка читает «Трап в стену пересекается: окно», со стулом на трапе — «Мебель пересекается: окно, стул, трап в стену»", () => {
    expect(warningText(overlaps)).toBe("Трап в стену пересекается: окно")
    // стул 45×45 центром (145, 20): y −2,5…42,5 — на трапе (y −4…4) и в проёме окна
    const withChair = furnitureOverlaps([item("d", "wallShowerDrain", 145, 0, 70, 8), item("c", "chair", 145, 20, 45, 45)], obstacles)
    expect(warningText(withChair)).toBe("Мебель пересекается: окно, стул, трап в стену")
  })
})
