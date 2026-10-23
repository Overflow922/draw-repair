import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { curtainsDrawing } from "./curtains-drawing"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-curtains: рисунок штор по картинке пользователя (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок штор»,
// «Шторы другого размера», «Короткие шторы», «Шторы длиннее размеров по умолчанию», «Карниз поворачивается с предметом»).
// Линии: 0 лицевая волна, 1 волна складок, затем n отрезков верхней прямой карниза и n отрезков нижней.

const P = 100 / 3

const near = (line: readonly Point[] | undefined, expected: number[][]): void => {
  const got = pts(line)
  expect(got).toHaveLength(expected.length)
  expected.forEach((p, i) => {
    expect(got[i]?.[0]).toBeCloseTo(p[0] ?? NaN, 2)
    expect(got[i]?.[1]).toBeCloseTo(p[1] ?? NaN, 2)
  })
}

const at = (line: readonly Point[] | undefined, i: number): number[] => pts(line)[i] ?? []

describe("рисунок штор", () => {
  it("CU-01: шторы 300×13 — двадцать линий: две волны и по девять отрезков двух прямых карниза", () => {
    const d = curtainsDrawing(size(300, 13))
    expect(d.lines).toHaveLength(20)
  })

  it("CU-02: лицевая волна — от (0; 6,5), гребни на y = 0 посередине складок, впадины 6,5 на границах, конец (300; 6,5)", () => {
    const wave = curtainsDrawing(size(300, 13)).lines[0]
    near([wave?.[0] as Point], [[0, 6.5]])
    for (let i = 0; i < 9; i++) {
      const crest = wave?.find((p) => Math.abs(p.x - (P * i + P / 2)) < 1e-6)
      expect(crest?.y).toBeCloseTo(0, 6)
    }
    for (let i = 1; i <= 8; i++) {
      const trough = wave?.find((p) => Math.abs(p.x - P * i) < 1e-6)
      expect(trough?.y).toBeCloseTo(6.5, 6)
    }
    const last = wave?.[(wave?.length ?? 1) - 1]
    expect(last?.x).toBeCloseTo(300, 6)
    expect(last?.y).toBeCloseTo(6.5, 6)
  })

  it("CU-03: волна складок — арки с вершинами (16,67 + 33,33·i; 2,5), концы арок на y = 10, восемь провалов с дном y = 12,5", () => {
    const fold = curtainsDrawing(size(300, 13)).lines[1] ?? []
    expect(at(fold, 0)).toEqual([3.3333, 10])
    expect(Math.min(...fold.map((p) => p.y))).toBeCloseTo(2.5, 6)
    expect(Math.max(...fold.map((p) => p.y))).toBeCloseTo(12.5, 6)
    for (let i = 0; i < 9; i++) {
      const top = fold.find((p) => Math.abs(p.x - (P * i + P / 2)) < 1e-6)
      expect(top?.y).toBeCloseTo(2.5, 6)
    }
    for (let i = 1; i <= 8; i++) {
      const bottom = fold.find((p) => Math.abs(p.x - P * i) < 1e-6)
      expect(bottom?.y).toBeCloseTo(12.5, 6)
      // провал уже 0,1·p по обе стороны от границы: на y = 10 его концы лежат на x = i·p ± 3,33
      expect(fold.some((p) => Math.abs(p.x - (P * i - P / 10)) < 1e-6 && Math.abs(p.y - 10) < 1e-6)).toBe(true)
      expect(fold.some((p) => Math.abs(p.x - (P * i + P / 10)) < 1e-6 && Math.abs(p.y - 10) < 1e-6)).toBe(true)
    }
    const last = fold[fold.length - 1]
    expect(last?.x).toBeCloseTo(300 - P / 10, 6)
    expect(last?.y).toBeCloseTo(10, 6)
  })

  it("CU-04: карниз — две прямые y = 10 и y = 11,5, у каждой девять отрезков между провалами", () => {
    const d = curtainsDrawing(size(300, 13))
    const spans: [number, number][] = [[0, P - P / 10]]
    for (let i = 1; i <= 7; i++) spans.push([P * i + P / 10, P * (i + 1) - P / 10])
    spans.push([P * 8 + P / 10, 300])
    ;[10, 11.5].forEach((y, row) => {
      spans.forEach(([x0, x1], i) => near(d.lines[2 + row * 9 + i], [[x0, y], [x1, y]]))
    })
    expect(at(d.lines[2], 1)).toEqual([30, 10])
    expect(at(d.lines[3], 0)).toEqual([36.6667, 10])
    expect(at(d.lines[10], 0)).toEqual([270, 10])
  })

  it("CU-05: контур для обводки — прямоугольник предмета, в линии рисунка он не входит", () => {
    const d = curtainsDrawing(size(300, 13))
    expect(pts(d.outline)).toEqual([[0, 0], [300, 0], [300, 13], [0, 13]])
    expect(d.lines.some((l) => l.some((p) => p.x === 300 && p.y === 13))).toBe(false)
  })

  it("CU-06: шторы 300×13 — рисунок внутри прямоугольника, линии не пересекаются", () => {
    const d = curtainsDrawing(size(300, 13))
    expect(inside(d.lines, 300, 13)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("CU-07: шторы шириной 100, 200 и 400 — три, шесть и двенадцать складок, детали по y те же", () => {
    expect([100, 200, 300, 400].map((w) => curtainsDrawing(size(w, 13)).lines.length)).toEqual([8, 14, 20, 26])
    const d = curtainsDrawing(size(400, 13))
    expect(Math.min(...(d.lines[1] ?? []).map((p) => p.y))).toBeCloseTo(2.5, 6)
    expect(Math.max(...(d.lines[1] ?? []).map((p) => p.y))).toBeCloseTo(12.5, 6)
    expect(at(d.lines[2], 0)).toEqual([0, 10])
    expect(at(d.lines[2 + 12], 0)).toEqual([0, 11.5])
  })

  it("CU-08: шторы 300×6,5 — k = 0,5, восемнадцать складок, числа по y вдвое меньше", () => {
    const d = curtainsDrawing(size(300, 6.5))
    expect(d.lines).toHaveLength(38)
    expect(Math.max(...(d.lines[1] ?? []).map((p) => p.y))).toBeCloseTo(6.25, 6)
    expect(Math.min(...(d.lines[1] ?? []).map((p) => p.y))).toBeCloseTo(1.25, 6)
    expect(at(d.lines[2], 1)[1]).toBe(5)
    expect(at(d.lines[20], 1)[1]).toBe(5.75)
    expect(inside(d.lines, 300, 6.5)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("CU-09: шторы 300×30 — тот же рисунок, что у 300×13, нижняя часть свободна", () => {
    const tall = curtainsDrawing(size(300, 30))
    const base = curtainsDrawing(size(300, 13))
    expect(tall.lines.map(pts)).toEqual(base.lines.map(pts))
    expect(pts(tall.outline)).toEqual([[0, 0], [300, 0], [300, 30], [0, 30]])
    expect(Math.max(...tall.lines.flat().map((p) => p.y))).toBeCloseTo(12.5, 6)
  })

  it("CU-10: образец легенды — масштаб 1 из аргумента при длине 3,47 даёт подобие рисунка (k = l / 13)", () => {
    const l = (13 * 80) / 300
    const d = curtainsDrawing(size(80, l), 1)
    expect(d.lines).toHaveLength(20)
    expect(inside(d.lines, 80, l)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
    expect(Math.max(...d.lines.flat().map((p) => p.y))).toBeCloseTo(12.5 * (l / 13), 6)
  })

  it("CU-11: сетка размеров 20–700 × 3–60 — внутри прямоугольника и без пересечений", () => {
    const problems: string[] = []
    // перебор пересечений квадратичен по числу отрезков, поэтому сетка редкая, но с нецелыми шагами складки
    for (const w of [20, 47, 100, 163, 300, 411, 700]) {
      for (const l of [3, 6.5, 9.1, 13, 30, 60]) {
        const d = curtainsDrawing(size(w, l))
        if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
        if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
      }
    }
    expect(problems).toEqual([])
  })

  it("CU-12: шторы с углом 90° — карниз слева от центра, складки правее", () => {
    const item = newItem("c", "curtains", { x: 0, y: 0 }, { widthCm: 300, lengthCm: 13, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)
    expect(meanX(lines[2])).toBeLessThan(meanX(lines[0]))
    expect(meanX(lines[2])).toBeLessThan(meanX(lines[1]))
  })
})
