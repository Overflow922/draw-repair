import { describe, expect, it } from "vitest"
import type { Drawing, Point, WallElement } from "../types"
import { roughScene } from "./rough-scene"
import { screedThresholds } from "./screed-threshold"
import { boxOf, drawing, rectWalls, screed, wall } from "./rough.test-utils"

// change screed-floor-layers: порог проёма со стяжкой (spec rough-works-plan «Стяжка на пороге проёма»)
// Сцена: комната 0..420 × 0..520 (внутри x 10..410, y 10..510), перегородка p по x = 210 толщиной 20 (грани x = 200 и 220).
// Ось p идёт a → b вниз, нормаль (−d.y, d.x) = (−1, 0): сторона +1 — левая комната, сторона −1 — правая.

const doorway = (wallId: string, offsetCm: number, widthCm: number, extra: Partial<WallElement> = {}): WallElement => ({ id: `e-${wallId}`, wallId, anchor: "a", offsetCm, widthCm, heightCm: 210, ...extra }) as WallElement

const walls = () => [...rectWalls("k", 0, 0, 420, 520), wall("p", 210, 0, 210, 520)]

const thresholdsOf = (d: Drawing) => {
  const s = roughScene(d)
  return screedThresholds(s.base.walls, s.base.doorways, s.screeds.map(({ screed: sc, item }) => ({ screed: sc, room: item.room })))
}

const LEFT = (mm: number) => screed("l", 100, 260, mm)
const RIGHT = (mm: number) => screed("r", 300, 260, mm)
const key = (p: Point): number => p.y

describe("порог со стяжкой", () => {
  it("RW-300: одинаковая стяжка с обеих сторон — обе половины штрихуются, линии нет", () => {
    const t = thresholdsOf(drawing({ walls: walls(), doorways: [doorway("p", 200, 90)], roughScreeds: [LEFT(65), RIGHT(65)] }))
    expect(t).toHaveLength(1)
    expect(t[0]!.divider).toBeNull()
    const halves = [...t[0]!.halves].sort((a, b) => boxOf([a.poly]).minX - boxOf([b.poly]).minX)
    expect(halves.map((h) => h.thicknessMm)).toEqual([65, 65])
    expect(boxOf([halves[0]!.poly])).toEqual({ minX: 200, minY: 200, maxX: 210, maxY: 290 })
    expect(boxOf([halves[1]!.poly])).toEqual({ minX: 210, minY: 200, maxX: 220, maxY: 290 })
  })

  it("RW-301: стяжки 50 и 65 мм — обе половины и линия по середине проёма от откоса до откоса", () => {
    const t = thresholdsOf(drawing({ walls: walls(), doorways: [doorway("p", 200, 90)], roughScreeds: [LEFT(50), RIGHT(65)] }))
    expect(t).toHaveLength(1)
    const halves = [...t[0]!.halves].sort((a, b) => boxOf([a.poly]).minX - boxOf([b.poly]).minX)
    expect(halves.map((h) => h.thicknessMm)).toEqual([50, 65])
    const line = [t[0]!.divider!.p1, t[0]!.divider!.p2].sort((a, b) => key(a) - key(b))
    expect(line).toEqual([{ x: 210, y: 200 }, { x: 210, y: 290 }])
  })

  it("RW-302: стяжка только с одной стороны — штрихуется половина с этой стороны, линия есть", () => {
    const t = thresholdsOf(drawing({ walls: walls(), doorways: [doorway("p", 200, 90)], roughScreeds: [LEFT(50)] }))
    expect(t).toHaveLength(1)
    expect(t[0]!.halves).toHaveLength(1)
    expect(t[0]!.halves[0]!.thicknessMm).toBe(50)
    expect(boxOf([t[0]!.halves[0]!.poly])).toEqual({ minX: 200, minY: 200, maxX: 210, maxY: 290 })
    expect(t[0]!.divider).not.toBeNull()
  })

  it("RW-303: дверь во внешней стене — половина со стороны помещения и линия", () => {
    const t = thresholdsOf(drawing({ walls: walls(), doorways: [doorway("k1", 150, 90)], roughScreeds: [LEFT(65)] }))
    expect(t).toHaveLength(1)
    expect(t[0]!.halves).toHaveLength(1)
    expect(boxOf([t[0]!.halves[0]!.poly])).toEqual({ minX: 150, minY: 0, maxX: 240, maxY: 10 })
    expect(t[0]!.divider).not.toBeNull()
  })

  it("RW-304: стяжки нет ни с одной стороны — порога нет", () => {
    expect(thresholdsOf(drawing({ walls: walls(), doorways: [doorway("p", 200, 90)] }))).toEqual([])
  })

  it("RW-305: окно порога не имеет", () => {
    const win = doorway("p", 200, 90, { kind: "window", sillCm: 90 } as Partial<WallElement>)
    expect(thresholdsOf(drawing({ walls: walls(), doorways: [win], roughScreeds: [LEFT(65), RIGHT(65)] }))).toEqual([])
  })

  it("RW-306: дверь с полотном — порог как у проёма", () => {
    const door = doorway("p", 200, 90, { kind: "door", hinge: "a", swing: "left" } as Partial<WallElement>)
    const t = thresholdsOf(drawing({ walls: walls(), doorways: [door], roughScreeds: [LEFT(65), RIGHT(65)] }))
    expect(t).toHaveLength(1)
    expect(t[0]!.halves).toHaveLength(2)
  })

  it("RW-307: расстояние от конца b считается от b", () => {
    const t = thresholdsOf(drawing({ walls: walls(), doorways: [doorway("p", 30, 90, { anchor: "b" } as Partial<WallElement>)], roughScreeds: [LEFT(65), RIGHT(65)] }))
    expect(boxOf([t[0]!.halves[0]!.poly])).toMatchObject({ minY: 400, maxY: 490 })
  })
})
