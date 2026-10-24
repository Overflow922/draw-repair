import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { content, drawing as reconstructionDrawing, drywall } from "../reconstruction/reconstruction.test-utils"
import { drawing as roughDrawing, openingOn, plaster, rectWalls, wall } from "../rough/rough.test-utils"
import type { FurnitureItem, Point, Wall } from "../types"
import type { ItemNumber, ItemSide } from "./item-number"
import { furnitureReachBodies, itemDistanceLayout, itemWallReach, reachBodies } from "./item-wall-reach"

// change furniture-dimensions: расстояния сторон выделенного предмета до стен
// (spec furniture-plan «Расстояния выделенного предмета до стен»). Помещение сценариев — внутренние грани x = 0, x = 400,
// y = 0, y = 300: оси стен толщиной 20 см на x = −10, x = 410, y = −10, y = 310.

const SCREEN = { labelPx: 14, dimTextGapPx: 1.5 }
const ROOM = (): Wall[] => rectWalls("w", -10, -10, 410, 310)
const SIDES: readonly ItemSide[] = ["left", "right", "top", "bottom"]

const item = (x: number, y: number, widthCm = 80, lengthCm = 160, angleDeg = 0): FurnitureItem => ({ id: "t", kind: "table", x, y, widthCm, lengthCm, angleDeg })

// наружная нормаль стороны в чертеже: right — ось ширины u, bottom — ось длины v
function normalOf(t: FurnitureItem, side: ItemSide): Point {
  const r = (t.angleDeg * Math.PI) / 180
  const u = { x: Math.cos(r), y: Math.sin(r) }
  const v = { x: -Math.sin(r), y: Math.cos(r) }
  switch (side) {
    case "right":
      return u
    case "left":
      return { x: -u.x, y: -u.y }
    case "bottom":
      return v
    case "top":
      return { x: -v.x, y: -v.y }
  }
}

const reach = (t: FurnitureItem, side: ItemSide, walls: readonly Wall[]): number | null => itemWallReach(t, side, reachBodies(walls))?.t ?? null

const distanceOf = (numbers: readonly ItemNumber[], side: ItemSide): ItemNumber | undefined =>
  numbers.find((n) => n.field.kind === "distance" && n.field.side === side)

describe("расстояния до стен", () => {
  it("FD-200: стол 80 × 160 с центром (100, 120) — 60 слева, 260 справа, 40 сверху, 100 снизу", () => {
    const t = item(100, 120)
    expect(reach(t, "left", ROOM())).toBeCloseTo(60, 6)
    expect(reach(t, "right", ROOM())).toBeCloseTo(260, 6)
    expect(reach(t, "top", ROOM())).toBeCloseTo(40, 6)
    expect(reach(t, "bottom", ROOM())).toBeCloseTo(100, 6)
    const numbers = itemDistanceLayout(t, reachBodies(ROOM()), "cm", 2, SCREEN)
    expect(SIDES.map((s) => distanceOf(numbers, s)?.text)).toEqual(["60", "260", "40", "100"])
  })

  it("FD-201: оси следуют за поворотом — стол с углом 90 и центром (200, 150): 120 по горизонтали, 110 по вертикали", () => {
    const t = item(200, 150, 80, 160, 90)
    for (const side of SIDES) {
      const n = normalOf(t, side)
      const expected = Math.abs(n.x) > 0.5 ? 120 : 110
      expect(reach(t, side, ROOM()), side).toBeCloseTo(expected, 6)
    }
  })

  it("FD-202: наклонный стул 40 × 40 (угол 45, центр (100, 100)) у стены x = 0 — «101» вдоль нормали стороны у двух сторон, у двух других чисел нет", () => {
    const walls = [wall("W", -10, -1000, -10, 1000)]
    const t: FurnitureItem = { id: "c", kind: "chair", x: 100, y: 100, widthCm: 40, lengthCm: 40, angleDeg: 45 }
    const corner = 100 - 20 * Math.SQRT2 // угол стула, ближайший к стене
    const expected = corner / Math.SQRT1_2
    const facing = SIDES.filter((s) => normalOf(t, s).x < 0)
    expect(facing).toHaveLength(2)
    for (const side of SIDES) {
      const r = itemWallReach(t, side, reachBodies(walls))
      if (!facing.includes(side)) {
        expect(r, side).toBeNull()
        continue
      }
      if (!r) throw new Error(`нет расстояния ${side}`)
      expect(r.t).toBeCloseTo(expected, 6)
      // линия идёт от угла стула вдоль нормали стороны (под 45° к стене), а не перпендикулярно стене
      expect(r.from.x).toBeCloseTo(corner, 6)
      expect(r.from.y).toBeCloseTo(100, 6)
      expect(r.to.x).toBeCloseTo(0, 6)
      expect(Math.abs(r.to.y - r.from.y)).toBeCloseTo(corner, 6)
    }
    const numbers = itemDistanceLayout(t, reachBodies(walls), "cm", 2, SCREEN)
    expect(numbers.map((n) => n.text)).toEqual(["101", "101"])
  })

  it("FD-203: ближайшая точка стороны — колонна с гранью y = 30 на x 80..120: сверху 10, линия через x = 100", () => {
    const walls = [...ROOM(), wall("col", 100, 0, 100, 30, 40)]
    const r = itemWallReach(item(100, 120), "top", reachBodies(walls))
    if (!r) throw new Error("нет расстояния")
    expect(r.t).toBeCloseTo(10, 6)
    expect(r.from.x).toBeCloseTo(100, 6)
    expect(r.from.y).toBeCloseTo(40, 6)
    expect(r.to.y).toBeCloseTo(30, 6)
  })

  it("FD-204: колонна у края стороны — линия через середину участка касания, а не стороны", () => {
    // колонна x 120..160, сторона стола x 60..140: участок касания x 120..140
    const walls = [...ROOM(), wall("col", 140, 0, 140, 30, 40)]
    const r = itemWallReach(item(100, 120), "top", reachBodies(walls))
    expect(r?.t).toBeCloseTo(10, 6)
    expect(r?.from.x).toBeCloseTo(130, 6)
  })

  it("FD-205: нет стены по направлению — справа числа нет, остальные показаны", () => {
    const walls = [wall("L", -10, -10, -10, 310), wall("T", -10, -10, 1000, -10), wall("B", -10, 310, 1000, 310)]
    const t = item(100, 120)
    expect(reach(t, "right", walls)).toBeNull()
    const numbers = itemDistanceLayout(t, reachBodies(walls), "cm", 2, SCREEN)
    expect(distanceOf(numbers, "right")).toBeUndefined()
    expect(SIDES.filter((s) => distanceOf(numbers, s)).sort()).toEqual(["bottom", "left", "top"])
  })

  it("FD-206: левая сторона зашла на 10 см за грань x = 0 — расстояние отсчитывается от этой грани (−10), показано «0» без линии", () => {
    const t = item(30, 120)
    expect(reach(t, "left", ROOM())).toBeCloseTo(-10, 6)
    const left = distanceOf(itemDistanceLayout(t, reachBodies(ROOM()), "cm", 2, SCREEN), "left")
    expect(left?.text).toBe("0")
    expect(left?.valueCm).toBe(0)
    expect(left?.geom).toBeNull()
  })

  it("FD-209: стол зашёл в стену справа — расстояния слева, сверху и снизу прежние, справа −10", () => {
    // стол x 330..410: правая сторона за гранью x = 400 на 10 см
    const t = item(370, 120)
    expect(reach(t, "right", ROOM())).toBeCloseTo(-10, 6)
    expect(reach(t, "left", ROOM())).toBeCloseTo(330, 6)
    expect(reach(t, "top", ROOM())).toBeCloseTo(40, 6)
    expect(reach(t, "bottom", ROOM())).toBeCloseTo(100, 6)
  })

  it("FD-207: касание — расстояние 0, число «0» без линии", () => {
    const t = item(40, 120)
    expect(reach(t, "left", ROOM())).toBeCloseTo(0, 6)
    const left = distanceOf(itemDistanceLayout(t, reachBodies(ROOM()), "cm", 2, SCREEN), "left")
    expect(left?.text).toBe("0")
    expect(left?.geom).toBeNull()
  })

  it("FD-208: размерная линия расстояния идёт от стороны до грани, число в текущей единице", () => {
    const left = distanceOf(itemDistanceLayout(item(100, 120), reachBodies(ROOM()), "mm", 2, SCREEN), "left")
    expect(left?.text).toBe("600")
    expect(left?.valueCm).toBeCloseTo(60, 6)
    const g = left?.geom
    if (!g) throw new Error("нет линии")
    expect([g.p1.x, g.p2.x].sort((a, b) => a - b)).toEqual([expect.closeTo(0, 6), expect.closeTo(60, 6)])
    expect(g.p1.y).toBeCloseTo(120, 6)
    expect(g.p2.y).toBeCloseTo(120, 6)
  })
})

describe("грани подложки «Мебели»", () => {
  const walls = (): Wall[] => rectWalls("w", -10, -10, 410, 310)
  const left = (d: ReturnType<typeof roughDrawing>): number | null => itemWallReach(item(100, 120), "left", furnitureReachBodies(reconstructionScene(d)))?.t ?? null

  it("FD-210: штукатурка 3 см на внутренней грани x = 0 — слева 57 (до поверхности штукатурки)", () => {
    // штукатурка на обеих гранях левой стены w4: внутренняя даёт поверхность x = 3
    const d = roughDrawing({ walls: walls(), roughPlaster: [plaster("p1", "w4", 1, "a", 0, 320, 30), plaster("p2", "w4", -1, "a", 0, 320, 30)] })
    expect(left(d)).toBeCloseTo(57, 6)
  })

  it("FD-211: стена гипсокартона толщиной 10 см у левой стены — слева 50", () => {
    const d = reconstructionDrawing({ walls: walls(), reconstruction: content([drywall("g1", 5, 0, 5, 300, 10)]) })
    expect(left(d)).toBeCloseTo(50, 6)
  })

  it("FD-212: проём в стене напротив стола не прерывает грань — слева по-прежнему 60", () => {
    // проём на w4 (ось от (−10, 310) вверх): откосы на y = 210 и y = 120, против стороны стола y 40..200
    const d = roughDrawing({ walls: walls(), doorways: [openingOn("o1", "w4", 100, 90)] })
    expect(left(d)).toBeCloseTo(60, 6)
  })
})
