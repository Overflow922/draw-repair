import { describe, expect, it } from "vitest"
import type { Point, Wall, WallDoor } from "../types"
import { doorLeaf } from "./doorway-layout"
import type { DoorLeaf } from "./doorway-layout"
import { expectPoint, sceneF, sceneR, w } from "./doorway.test-utils"
import { COS95, DR, SIN95, dr, expectedLeaf } from "./door.test-utils"
import type { Hinge, Swing } from "./door.test-utils"

// change add-door: геометрия обозначения двери — петля, полотно 4 см под 95° и дуга открывания
// (spec door «Отображение двери», «Дверь — элемент стены»; design D3). Эталоны — по формулам спецификации.

const LEAF_CM = 4

const leafOf = (d: WallDoor, walls: Wall[]): DoorLeaf => {
  const l = doorLeaf(d, walls)
  expect(l).not.toBeNull()
  if (!l) throw new Error("нет обозначения")
  return l
}

const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y })
const len = (p: Point): number => Math.hypot(p.x, p.y)
const cross = (p: Point, q: Point): number => p.x * q.y - p.y * q.x
const angleDeg = (p: Point, q: Point): number => (Math.acos((p.x * q.x + p.y * q.y) / (len(p) * len(q))) * 180) / Math.PI

// прямоугольник полотна: одна длинная сторона hinge → leafEnd, вторая — сдвиг на 4 см прочь от arcFrom
function expectLeafRect(l: DoorLeaf, hinge: Point, leafEnd: Point, awayFrom: Point): void {
  const v = sub(leafEnd, hinge)
  const vl = len(v)
  let p = { x: -v.y / vl, y: v.x / vl }
  // p направлен в сторону, где нет закрытого положения полотна
  if (cross(v, sub(awayFrom, hinge)) * cross(v, p) > 0) p = { x: -p.x, y: -p.y }
  const expected = [hinge, leafEnd, { x: leafEnd.x + p.x * LEAF_CM, y: leafEnd.y + p.y * LEAF_CM }, { x: hinge.x + p.x * LEAF_CM, y: hinge.y + p.y * LEAF_CM }]
  expect(l.leaf).toHaveLength(4)
  for (const e of expected) expect(l.leaf.some((c: Point) => Math.hypot(c.x - e.x, c.y - e.y) < 1e-3)).toBe(true)
}

function expectMatches(l: DoorLeaf, a: Point, b: Point, t1: number, t2: number, thickness: number, hinge: Hinge, swing: Swing, width: number): void {
  const e = expectedLeaf(a, b, t1, t2, thickness, hinge, swing, width)
  expectPoint(l.hinge, e.hinge.x, e.hinge.y)
  expectPoint(l.arcFrom, e.arcFrom.x, e.arcFrom.y)
  expectPoint(l.arcTo, e.arcTo.x, e.arcTo.y)
  expect(l.radius).toBeCloseTo(width, 6)
  expectLeafRect(l, e.hinge, e.arcTo, e.arcFrom)
}

describe("дверь на стене 20 см", () => {
  it("DG-01: a/left — петля (100, −10), полотно до (92.156, −99.658), дуга от (190, −10)", () => {
    const { walls } = sceneF()
    const l = leafOf(DR("a", "left"), walls)
    expectPoint(l.hinge, 100, -10)
    expectPoint(l.arcFrom, 190, -10)
    expectPoint(l.arcTo, 100 + 90 * COS95, -10 - 90 * SIN95)
    expectPoint(l.arcTo, 92.156, -99.658)
    expect(l.radius).toBeCloseTo(90, 6)
    // прямоугольник полотна — по другую сторону от (190, −10): x меньше линии полотна
    expectLeafRect(l, { x: 100, y: -10 }, { x: 92.156, y: -99.658 }, { x: 190, y: -10 })
    const minX = Math.min(...l.leaf.map((c: Point) => c.x))
    expect(minX).toBeLessThan(92.156 - 3)
  })

  it("DG-02: b/right — петля (190, 10), полотно до (197.844, 99.658), дуга от (100, 10)", () => {
    const { walls } = sceneF()
    const l = leafOf(DR("b", "right"), walls)
    expectPoint(l.hinge, 190, 10)
    expectPoint(l.arcFrom, 100, 10)
    expectPoint(l.arcTo, 197.844, 99.658)
    expectLeafRect(l, { x: 190, y: 10 }, { x: 197.844, y: 99.658 }, { x: 100, y: 10 })
  })

  it("DG-03: все четыре направления — по формулам спецификации", () => {
    const { walls } = sceneF()
    for (const hinge of ["a", "b"] as const)
      for (const swing of ["left", "right"] as const)
        expectMatches(leafOf(DR(hinge, swing), walls), { x: 0, y: 0 }, { x: 500, y: 0 }, 100, 190, 20, hinge, swing, 90)
  })

  it("DG-03b: a/right — петля (100, 10), дуга от (190, 10); b/left — петля (190, −10), дуга от (100, −10)", () => {
    const { walls } = sceneF()
    const ar = leafOf(DR("a", "right"), walls)
    expectPoint(ar.hinge, 100, 10)
    expectPoint(ar.arcFrom, 190, 10)
    expect(ar.arcTo.y).toBeGreaterThan(90)
    const bl = leafOf(DR("b", "left"), walls)
    expectPoint(bl.hinge, 190, -10)
    expectPoint(bl.arcFrom, 100, -10)
    expect(bl.arcTo.y).toBeLessThan(-90)
  })
})

describe("независимость обозначения", () => {
  it("DG-04: привязка b, 310 даёт то же обозначение, что привязка a, 100", () => {
    const { walls } = sceneF()
    for (const hinge of ["a", "b"] as const)
      for (const swing of ["left", "right"] as const) {
        const viaA = leafOf(DR(hinge, swing), walls)
        const viaB = leafOf(dr("W", "b", 310, hinge, swing), walls)
        expectPoint(viaB.hinge, viaA.hinge.x, viaA.hinge.y)
        expectPoint(viaB.arcFrom, viaA.arcFrom.x, viaA.arcFrom.y)
        expectPoint(viaB.arcTo, viaA.arcTo.x, viaA.arcTo.y)
        expectLeafRect(viaB, viaA.hinge, viaA.arcTo, viaA.arcFrom)
      }
  })

  it("DG-06: ось справа налево: петли b, right на участке 100…190 совпадают с a, left на обычной оси", () => {
    const { walls } = sceneF()
    const ref = leafOf(DR("a", "left"), walls)
    const Rv = w(500, 0, 0, 0, "W")
    // участок x 100…190 при оси (500,0)-(0,0): от a = 310, ширина 90
    const rev = leafOf(dr("W", "a", 310, "b", "right"), [Rv])
    expectPoint(rev.hinge, ref.hinge.x, ref.hinge.y)
    expectPoint(rev.arcFrom, ref.arcFrom.x, ref.arcFrom.y)
    expectPoint(rev.arcTo, ref.arcTo.x, ref.arcTo.y)
  })

  it("DG-05: вертикальная стена (0,0)-(0,500): a/left — петля (10, 100), полотно в сторону x > 0", () => {
    const V = w(0, 0, 0, 500, "W")
    const l = leafOf(DR("a", "left"), [V])
    expectPoint(l.hinge, 10, 100)
    expectPoint(l.arcFrom, 10, 190)
    expect(l.arcTo.x).toBeGreaterThan(95)
    expectMatches(l, { x: 0, y: 0 }, { x: 0, y: 500 }, 100, 190, 20, "a", "left", 90)
  })

  it("DG-05b: ось справа налево (500,0)-(0,0): left — сторона y > 0", () => {
    const Rv = w(500, 0, 0, 0, "W")
    const l = leafOf(dr("W", "a", 100, "a", "left"), [Rv])
    // откос у a — x = 400, петля на грани y = +10
    expectPoint(l.hinge, 400, 10)
    expect(l.arcTo.y).toBeGreaterThan(90)
  })
})

describe("инварианты обозначения", () => {
  it("DG-07: угол открывания 95°, радиус и длина полотна равны ширине (наклонная стена)", () => {
    const S = w(0, 0, 400, 300, "W")
    for (const hinge of ["a", "b"] as const)
      for (const swing of ["left", "right"] as const) {
        const l = leafOf(dr("W", "a", 120, hinge, swing, 80), [S])
        expect(len(sub(l.arcFrom, l.hinge))).toBeCloseTo(80, 6)
        expect(len(sub(l.arcTo, l.hinge))).toBeCloseTo(80, 6)
        expect(angleDeg(sub(l.arcFrom, l.hinge), sub(l.arcTo, l.hinge))).toBeCloseTo(95, 6)
        expectMatches(l, { x: 0, y: 0 }, { x: 400, y: 300 }, 120, 200, 20, hinge, swing, 80)
      }
  })

  it("DG-08: стена 10 см — петля на грани (100, −5)", () => {
    const T = w(0, 0, 500, 0, "W", 10)
    const l = leafOf(DR("a", "left"), [T])
    expectPoint(l.hinge, 100, -5)
  })

  it("DG-09: дверь вплотную к углу: петля на грани у x = 10", () => {
    const { walls } = sceneR()
    const l = leafOf(dr("W", "a", 10), walls)
    expectPoint(l.hinge, 10, -10)
    expectPoint(l.arcFrom, 100, -10)
  })

  it("DG-10: ширина 1 см — обозначение без NaN", () => {
    const { walls } = sceneF()
    const l = leafOf(dr("W", "a", 100, "a", "left", 1), walls)
    for (const p of [l.hinge, l.arcFrom, l.arcTo, ...l.leaf]) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    expect(l.radius).toBeCloseTo(1, 6)
  })

  it("DG-11: дверь на отсутствующей стене — нет обозначения", () => {
    const { walls } = sceneF()
    expect(doorLeaf(dr("gone", "a", 100), walls)).toBeNull()
  })
})
