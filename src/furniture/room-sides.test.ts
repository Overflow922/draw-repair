import { describe, expect, it } from "vitest"
import { rect, W } from "../room-area.test-utils"
import type { Point } from "../types"
import { roomSidesAt, sidesOf } from "./room-sides"
import type { Side } from "./room-sides"

// change furniture-center-snap: стороны помещения, в котором стоит предмет (spec furniture-plan «Центровка предметов»)

const mids = (sides: readonly Side[]): Point[] =>
  sides.map((s) => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 })).sort((p, q) => p.x - q.x || p.y - q.y)

const box = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

describe("стороны контура", () => {
  it("FCS-200: у прямоугольника четыре стороны, середины на серединах", () => {
    expect(mids(sidesOf(box(0, 0, 400, 300), []))).toEqual([
      { x: 0, y: 150 },
      { x: 200, y: 0 },
      { x: 200, y: 300 },
      { x: 400, y: 150 },
    ])
  })

  it("FCS-201: коллинеарные соседние рёбра — одна сторона", () => {
    const outline = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }]
    expect(sidesOf(outline, [])).toHaveLength(4)
  })

  it("FCS-202: наклонная сторона — середина (150, 150)", () => {
    const triangle = [{ x: 0, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }]
    expect(mids(sidesOf(triangle, []))).toContainEqual({ x: 150, y: 150 })
  })

  it("FCS-203: участки короче 30 см стороной не считаются", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 190, y: 0 },
      { x: 190, y: 10 },
      { x: 200, y: 10 },
      { x: 200, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ]
    expect(mids(sidesOf(outline, [])).filter((m) => m.y === 0)).toEqual([{ x: 95, y: 0 }, { x: 300, y: 0 }])
    expect(sidesOf(outline, [])).toHaveLength(5)
  })

  it("FCS-204: контур острова даёт свои стороны", () => {
    expect(sidesOf(box(0, 0, 400, 300), [box(100, 100, 150, 150)])).toHaveLength(8)
  })
})

describe("помещение точки", () => {
  it("FCS-210: внутри комнаты — стороны её внутреннего контура", () => {
    const walls = rect(-10, -10, 410, 310)
    expect(mids(roomSidesAt(walls, { x: 193, y: 80 }))).toEqual([
      { x: 0, y: 150 },
      { x: 200, y: 0 },
      { x: 200, y: 300 },
      { x: 400, y: 150 },
    ])
  })

  it("FCS-211: две комнаты — только стороны комнаты точки, середина длинной стены не используется", () => {
    const walls = [...rect(-10, 0, 810, 310), W(310, 0, 310, 310)]
    const sides = mids(roomSidesAt(walls, { x: 160, y: 100 }))
    expect(sides).toContainEqual({ x: 150, y: 10 })
    expect(sides.every((m) => m.x <= 300)).toBe(true)
    expect(sides).not.toContainEqual({ x: 400, y: 10 })
  })

  it("FCS-212: вне помещения сторон нет", () => {
    expect(roomSidesAt(rect(-10, -10, 410, 310), { x: -500, y: -500 })).toEqual([])
  })
})
