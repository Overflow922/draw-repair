import { describe, expect, it } from "vitest"
import type { FurnitureItem, Point, ToiletSizes, Wall } from "../types"
import { furnitureOverlaps, itemOverlaps, obstaclesOf, overlapKinds } from "./overlap"
import type { ObstacleSource, Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-toilet: пересечения унитаза (spec furniture-plan «Унитаз», сценарии «Блок в гипсокартоне», «Чаша в гипсокартоне»,
// «Блок в стене подложки», «Свободные участки по бокам чаши»). Эталоны посчитаны вручную по геометрии сцен.
//
// Унитаз 38 / 52 / 70 / 20, центр (100, 100), угол 0: предмет x 65–135, y 64–136; блок x 65–135, y 64–84; чаша x 81–119, y 84–136.

const DEFAULT: ToiletSizes = { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 }
const toilet = (id: string, x: number, y: number, angleDeg = 0): FurnitureItem => ({ id, kind: "toilet", x, y, widthCm: 70, lengthCm: 72, angleDeg, toilet: DEFAULT })
const table = (id: string, x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind: "table", x, y, widthCm, lengthCm, angleDeg: 0 })
const wall = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm: number): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm, type: "brick" })
const source = (parts: Partial<ObstacleSource> = {}): ObstacleSource => ({ walls: [], drywall: [], plaster: [], elements: [], batteries: [], communications: [], ...parts })

const area = (region: readonly Point[]): number => {
  let s = 0
  region.forEach((a, i) => {
    const b = region[(i + 1) % region.length]
    s += a.x * b.y - b.x * a.y
  })
  return Math.abs(s) / 2
}
const totalArea = (overlaps: readonly Overlap[]): number => overlaps.reduce((s, o) => s + area(o.region), 0)
const bbox = (overlaps: readonly Overlap[]): number[] => {
  const pts = overlaps.flatMap((o) => o.region)
  return [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))].map((v) => Math.round(v * 1000) / 1000)
}

// стена гипсокартона x 60–140, y 60–84
const drywall = wall("d", 60, 72, 140, 72, 24)

describe("блок и гипсокартон", () => {
  it("TLO-01: блок внутри стены гипсокартона x 60–140, y 60–84 — пересечения нет, плашки нет", () => {
    const o = itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ drywall: [drywall] })))
    expect(o).toEqual([])
    expect(warningText(o)).toBeNull()
  })

  it("TLO-02: сдвиг на 4 см вверх (центр (100, 96)) — чаша заходит в гипсокартон на 38 × 4, блок не подсвечен, плашка «гипсокартон»", () => {
    const o = itemOverlaps(toilet("t", 100, 96), obstaclesOf(source({ drywall: [drywall] })))
    expect(overlapKinds(o)).toEqual(["drywall"])
    expect(totalArea(o)).toBeCloseTo(152, 6)
    expect(bbox(o)).toEqual([81, 80, 119, 84])
    expect(warningText(o)).toBe("Унитаз пересекается: гипсокартон")
  })

  it("TLO-04: гипсокартон только поверх чаши (стена x 90–110, y 100–120) — пересечение 20 × 20", () => {
    const o = itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ drywall: [wall("d", 100, 100, 100, 120, 20)] })))
    expect(totalArea(o)).toBeCloseTo(400, 6)
  })
})

describe("блок и другие препятствия", () => {
  // вертикальная стена подложки x 130–150, y 0–300
  const brick = wall("w", 140, 0, 140, 300, 20)

  it("TLO-10: блок заходит в стену подложки на 5 см — область 5 × 20, плашка «стена»", () => {
    const o = itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ walls: [brick] })))
    expect(overlapKinds(o)).toEqual(["wall"])
    expect(totalArea(o)).toBeCloseTo(100, 6)
    expect(bbox(o)).toEqual([130, 64, 135, 84])
    expect(warningText(o)).toBe("Унитаз пересекается: стена")
  })

  it("TLO-11: блок лежит и в гипсокартоне, и в стене подложки — называется только стена", () => {
    const o = itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ walls: [brick], drywall: [drywall] })))
    expect(overlapKinds(o)).toEqual(["wall"])
    expect(totalArea(o)).toBeCloseTo(100, 6)
  })

  it("TLO-12: блок заходит в полосу штукатурки x 129–135 — область 6 × 20, пересечение, плашка «штукатурка»", () => {
    const o = itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ plaster: [wall("p", 132, 0, 132, 300, 6)] })))
    expect(overlapKinds(o)).toEqual(["plaster"])
    expect(totalArea(o)).toBeCloseTo(120, 6)
  })
})

describe("форма из двух прямоугольников", () => {
  it("TLO-20: стена x 66–76, y 90–130 в «ухе» слева от чаши — пересечения нет", () => {
    expect(itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ walls: [wall("w", 71, 90, 71, 130, 10)] })))).toEqual([])
  })

  it("TLO-21: стена в «ухе» справа от чаши — пересечения нет", () => {
    expect(itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ walls: [wall("w", 129, 90, 129, 130, 10)] })))).toEqual([])
  })

  it("TLO-22: стена x 116–126, y 90–130 заходит на 3 см в бок чаши (бок x = 119) — область 3 × 40", () => {
    const o = itemOverlaps(toilet("t", 100, 100), obstaclesOf(source({ walls: [wall("w", 121, 90, 121, 130, 10)] })))
    expect(totalArea(o)).toBeCloseTo(3 * 40, 6)
  })

  it("TLO-23: поворот на 90°: блок справа (x 116–136, y 65–135), чаша слева (x 64–116); стена гипсокартона x 116–140 — пересечения нет", () => {
    const rotated = toilet("t", 100, 100, 90)
    expect(itemOverlaps(rotated, obstaclesOf(source({ drywall: [wall("d", 128, 40, 128, 160, 24)] })))).toEqual([])
  })

  it("TLO-24: поворот на 90°, стена гипсокартона сдвинута на 4 см влево (x 112–136) — чаша в гипсокартоне на 4 × 38", () => {
    const o = itemOverlaps(toilet("t", 100, 100, 90), obstaclesOf(source({ drywall: [wall("d", 124, 40, 124, 160, 24)] })))
    expect(overlapKinds(o)).toEqual(["drywall"])
    expect(totalArea(o)).toBeCloseTo(152, 6)
    expect(bbox(o)).toEqual([112, 81, 116, 119])
  })
})

describe("унитаз и другие предметы", () => {
  it("TLO-30: стол 20 × 20 на чаше даёт пересечение 400, плашка «Мебель пересекается: стол, унитаз»", () => {
    const o = furnitureOverlaps([table("a", 100, 110, 20, 20), toilet("z", 100, 100)], obstaclesOf(source()))
    expect(totalArea(o)).toBeCloseTo(400, 6)
    expect(warningText(o)).toBe("Мебель пересекается: стол, унитаз")
  })

  it("TLO-31: порядок предметов не меняет область (унитаз первым)", () => {
    const o = furnitureOverlaps([toilet("a", 100, 100), table("z", 100, 110, 20, 20)], obstaclesOf(source()))
    expect(totalArea(o)).toBeCloseTo(400, 6)
  })

  it("TLO-32: стол на блоке (x 90–110, y 69–79) — пересечение 20 × 10", () => {
    const o = furnitureOverlaps([table("a", 100, 74, 20, 10), toilet("z", 100, 100)], obstaclesOf(source()))
    expect(totalArea(o)).toBeCloseTo(200, 6)
  })

  it("TLO-33: стол 10 × 10 в «ухе» (x 65–75, y 95–105) — пересечения нет", () => {
    expect(furnitureOverlaps([table("a", 70, 100, 10, 10), toilet("z", 100, 100)], obstaclesOf(source()))).toEqual([])
  })

  it("TLO-34: стол в «ухе» унитаза, стоящего первым, — пересечения нет", () => {
    expect(furnitureOverlaps([toilet("a", 100, 100), table("z", 70, 100, 10, 10)], obstaclesOf(source()))).toEqual([])
  })
})
