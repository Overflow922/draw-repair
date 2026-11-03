import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { rectOverlapsPolygon, sweepAlong } from "./section-figure-collide"
import { moveFigure } from "./section-figure-move"
import type { FigureMoveContext } from "./section-figure-move"
import type { Bounds } from "./section-layout"

// change move-section-figure: упор и скольжение при перемещении фигуры (spec section-view «Перемещение фигуры разреза»)

const box = (minX: number, minY: number, maxX: number, maxY: number): Point[] => [
  { x: minX, y: minY },
  { x: maxX, y: minY },
  { x: maxX, y: maxY },
  { x: minX, y: maxY },
]

// фигура 100 x 50: position — левая нижняя точка (пол), занимает y от position.y - 50 до position.y
const rectAt = (p: Point): Bounds => ({ minX: p.x, minY: p.y - 50, maxX: p.x + 100, maxY: p.y })
const ctx = (...obstacles: Point[][]): FigureMoveContext => ({ rectAt, obstacles })

describe("пересечение прямоугольника с многоугольником", () => {
  it("MSF-20: касание гранью пересечением не считается, заход на 1 см считается", () => {
    const wall = box(100, 0, 120, 100)
    expect(rectOverlapsPolygon({ minX: 0, minY: 10, maxX: 100, maxY: 60 }, wall)).toBe(false)
    expect(rectOverlapsPolygon({ minX: 0, minY: 10, maxX: 101, maxY: 60 }, wall)).toBe(true)
  })

  it("MSF-21: наклонная стена, прямоугольник в её рамке, но не на ней, не пересекается", () => {
    const diagonal: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 110, y: 100 }, { x: 100, y: 100 }]
    expect(rectOverlapsPolygon({ minX: 80, minY: 0, maxX: 110, maxY: 20 }, diagonal)).toBe(false)
    expect(rectOverlapsPolygon({ minX: 0, minY: 0, maxX: 30, maxY: 20 }, diagonal)).toBe(true)
  })
})

describe("ход вдоль оси", () => {
  it("MSF-22: ход упирается в препятствие на пути", () => {
    expect(sweepAlong({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, box(250, 10, 300, 40), "x", 400)).toBe(150)
  })

  it("MSF-23: препятствие выше или ниже полосы хода не мешает", () => {
    expect(sweepAlong({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, box(250, 60, 300, 90), "x", 400)).toBe(400)
  })

  it("MSF-24: ход влево и по оси Y", () => {
    expect(sweepAlong({ minX: 300, minY: 0, maxX: 400, maxY: 50 }, box(100, 0, 200, 50), "x", -500)).toBe(-100)
    expect(sweepAlong({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, box(0, 120, 100, 150), "y", 300)).toBe(70)
  })
})

describe("перемещение фигуры", () => {
  it("MSF-30: свободное место — фигура уходит ровно за курсором", () => {
    expect(moveFigure({ x: 0, y: 0 }, { x: 300, y: -40 }, ctx())).toEqual({ x: 300, y: -40 })
  })

  it("MSF-31: сдвиг округляется до 1 см", () => {
    expect(moveFigure({ x: 0, y: 0 }, { x: 10.4, y: 10.6 }, ctx())).toEqual({ x: 10, y: 11 })
  })

  it("MSF-32: фигура упирается в соседнюю фигуру справа и стоит у её границы", () => {
    const b = box(150, -50, 250, 0)
    expect(moveFigure({ x: 0, y: 0 }, { x: 300, y: 0 }, ctx(b))).toEqual({ x: 50, y: 0 })
  })

  it("MSF-33: по диагонали фигура упирается по X и скользит по Y", () => {
    const wall = box(150, -300, 170, 300)
    expect(moveFigure({ x: 0, y: 0 }, { x: 300, y: -200 }, ctx(wall))).toEqual({ x: 50, y: -200 })
  })

  it("MSF-34: тонкое препятствие не проскакивается при большом сдвиге курсора", () => {
    const thin = box(200, -100, 201, 100)
    expect(moveFigure({ x: 0, y: 0 }, { x: 2000, y: 0 }, ctx(thin)).x).toBe(100)
  })

  it("MSF-35: наклонная стена останавливает фигуру у своей грани, а не у рамки", () => {
    // стена идёт из (200,100) в (200,-100) вертикально, а косая — из (150,-100) в (250,100)
    const slanted: Point[] = [{ x: 150, y: -100 }, { x: 160, y: -100 }, { x: 260, y: 100 }, { x: 250, y: 100 }]
    const moved = moveFigure({ x: 0, y: 0 }, { x: 400, y: 0 }, ctx(slanted))
    expect(rectOverlapsPolygon(rectAt(moved), slanted)).toBe(false)
    expect(rectOverlapsPolygon(rectAt({ x: moved.x + 1, y: moved.y }), slanted)).toBe(true)
  })

  it("MSF-36: фигура, уже стоящая на препятствии, может уйти с него, но не войдёт в другое", () => {
    const under = box(40, -40, 60, -10)
    const ahead = box(400, -100, 450, 100)
    const moved = moveFigure({ x: 0, y: 0 }, { x: 1000, y: 0 }, ctx(under, ahead))
    expect(moved).toEqual({ x: 300, y: 0 })
  })

  it("MSF-37: упёршаяся фигура остаётся на месте, лишнее движение вдоль препятствия невозможно", () => {
    const wall = box(100, -100, 120, 100)
    expect(moveFigure({ x: 0, y: 0 }, { x: 50, y: 0 }, ctx(wall))).toEqual({ x: 0, y: 0 })
  })

  it("MSF-38: движение назад по тому же жесту возвращает фигуру: позиция считается от начала жеста", () => {
    const wall = box(150, -300, 170, 300)
    const forward = moveFigure({ x: 0, y: 0 }, { x: 300, y: 0 }, ctx(wall))
    const back = moveFigure({ x: 0, y: 0 }, { x: 20, y: 0 }, ctx(wall))
    expect(forward.x).toBe(50)
    expect(back.x).toBe(20)
  })

  it("MSF-39: два препятствия подряд — фигура останавливается у ближнего", () => {
    const near = box(200, -100, 210, 100)
    const far = box(400, -100, 410, 100)
    expect(moveFigure({ x: 0, y: 0 }, { x: 900, y: 0 }, ctx(far, near)).x).toBe(100)
  })
})
