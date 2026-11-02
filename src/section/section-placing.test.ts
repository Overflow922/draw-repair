import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { addVertex, canFinish, completeLine, finishVertices, nextVertex, sideView, startPlacing } from "./section-placing"
import type { Placing } from "./section-placing"

// change add-section-view: размещение линии разреза — вершины, завершение, направление
// (spec section-view «Инструмент «Разрез» и размещение линии»)

const P = (x: number, y: number): Point => ({ x, y })
const placeAll = (first: Point, ...rest: Point[]): Placing => rest.reduce<Placing>((s, c) => addVertex(s, c), startPlacing(first))
const pointsOf = (s: Placing): Point[] => s.points

describe("вершины", () => {
  it("SV-80: ось первого отрезка — та, к которой курсор ближе после первого клика", () => {
    // первая вершина (200, -100), курсор (250, 90): отклонение по Y больше — вертикаль
    expect(nextVertex([P(200, -100)], P(250, 90))).toEqual(P(200, 90))
    expect(nextVertex([P(200, -100)], P(290, -90))).toEqual(P(290, -100))
  })

  it("SV-81: оси следующих отрезков чередуются", () => {
    const s = placeAll(P(0, 0), P(100, 3))
    expect(pointsOf(s)).toEqual([P(0, 0), P(100, 0)])
    expect(nextVertex(pointsOf(s), P(120, 40))).toEqual(P(100, 40))
    const s3 = addVertex(s, P(120, 40))
    expect(nextVertex(pointsOf(s3), P(210, 45))).toEqual(P(210, 40))
  })

  it("SV-82: клик, дающий отрезок нулевой длины, вершину не добавляет", () => {
    const s = startPlacing(P(200, -100))
    expect(addVertex(s, P(200, -100))).toEqual(s)
    expect(nextVertex([P(200, -100)], P(200, -100))).toBeNull()
  })

  it("SV-83: рабочий отрезок, идущий назад, отклоняется; ступенька — в любую сторону", () => {
    const s = placeAll(P(0, 0), P(100, 0), P(100, 40))
    // третий (рабочий) отрезок обязан идти вправо, как первый
    expect(nextVertex(pointsOf(s), P(40, 40))).toBeNull()
    expect(nextVertex(pointsOf(s), P(200, 40))).toEqual(P(200, 40))
    // ступенька вверх допустима
    expect(nextVertex(pointsOf(placeAll(P(0, 0), P(100, 0))), P(100, -50))).toEqual(P(100, -50))
  })
})

describe("завершение набора", () => {
  it("SV-84: прямая линия (один отрезок) завершается", () => {
    const s = placeAll(P(200, -100), P(200, 100))
    expect(canFinish(s)).toBe(true)
    expect(finishVertices(s).phase).toBe("side")
  })

  it("SV-85: Г-образная линия (два отрезка) не завершается", () => {
    const s = placeAll(P(0, 0), P(100, 0), P(100, 40))
    expect(canFinish(s)).toBe(false)
    expect(finishVertices(s)).toEqual(s)
  })

  it("SV-86: из одной вершины завершить нельзя", () => {
    expect(canFinish(startPlacing(P(0, 0)))).toBe(false)
  })

  it("SV-87: три отрезка завершаются", () => {
    expect(canFinish(placeAll(P(0, 0), P(100, 0), P(100, 40), P(200, 40)))).toBe(true)
  })
})

describe("направление и создание", () => {
  it("SV-88: сторона курсора выбирает взгляд", () => {
    const horizontal = [P(0, 0), P(200, 0)]
    expect(sideView(horizontal, P(100, 50))).toBe("down")
    expect(sideView(horizontal, P(100, -50))).toBe("up")
    const vertical = [P(200, -100), P(200, 100)]
    expect(sideView(vertical, P(260, 0))).toBe("right")
    expect(sideView(vertical, P(140, 0))).toBe("left")
  })

  it("SV-89: прямая линия: три шага дают линию A со взглядом right", () => {
    const side = finishVertices(placeAll(P(200, -100), P(200, 100)))
    expect(completeLine(side, P(300, 0), "id1", [])).toEqual({
      id: "id1",
      label: "A",
      view: "right",
      points: [P(200, -100), P(200, 100)],
    })
  })

  it("SV-90: обозначение — первая свободная буква", () => {
    const side = finishVertices(placeAll(P(0, 0), P(100, 0)))
    expect(completeLine(side, P(50, 40), "id2", ["A", "B"])?.label).toBe("C")
  })

  it("SV-91: линия создаётся только на шаге направления", () => {
    expect(completeLine(placeAll(P(0, 0), P(100, 0)), P(50, 40), "id3", [])).toBeNull()
  })

  it("SV-92: вершины линии — копии, а не те же объекты", () => {
    const a = P(0, 0)
    const side = finishVertices(placeAll(a, P(100, 0)))
    const line = completeLine(side, P(50, 40), "id4", [])
    a.x = 99
    expect(line?.points[0]).toEqual(P(0, 0))
  })
})
