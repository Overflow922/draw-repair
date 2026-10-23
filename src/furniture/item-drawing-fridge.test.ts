import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { fridgeDrawing } from "./fridge-drawing"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-kitchen-cabinet-fridge: рисунок двустворчатого холодильника (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок
// двустворчатого холодильника», «Холодильник другого размера», «Холодильник длиннее размеров по умолчанию», «Двери холодильника поворачиваются
// с предметом»). Линии: 0 корпус, 1 круг, 2–25 снежинка (на луч: луч и две засечки), 26 и 27 створки левой и правой двери, 28 и 29 их дуги.

const DEG = 180 / Math.PI

const last = (line: readonly Point[] | undefined): Point => line?.[line.length - 1] ?? { x: NaN, y: NaN }
const first = (line: readonly Point[] | undefined): Point => line?.[0] ?? { x: NaN, y: NaN }

function expectPoint(p: Point, x: number, y: number): void {
  expect(p.x).toBeCloseTo(x, 1)
  expect(p.y).toBeCloseTo(y, 1)
}

describe("рисунок двустворчатого холодильника", () => {
  it("FR-01: холодильник 100×90 — тридцать линий, корпус 60 глубиной", () => {
    const d = fridgeDrawing(size(100, 90))
    expect(d.lines).toHaveLength(30)
    expect(pts(d.lines[0])).toEqual([[0, 0], [100, 0], [100, 60], [0, 60], [0, 0]])
    expect(pts(d.outline)).toEqual([[0, 0], [100, 0], [100, 90], [0, 90]])
  })

  it("FR-02: круг радиуса 18,5 с центром (48; 30)", () => {
    const circle = fridgeDrawing(size(100, 90)).lines[1] ?? []
    circle.forEach((p) => expect(Math.hypot(p.x - 48, p.y - 30)).toBeCloseTo(18.5, 6))
    expect(Math.min(...circle.map((p) => p.x))).toBeCloseTo(29.5, 1)
    expect(Math.max(...circle.map((p) => p.y))).toBeCloseTo(48.5, 1)
  })

  it("FR-03: снежинка — восемь лучей длиной 15 от центра круга, на концах по две засечки 3,5 под ±40° назад", () => {
    const d = fridgeDrawing(size(100, 90))
    for (let i = 0; i < 8; i++) {
      const a = (i * 45) / DEG
      const spoke = d.lines[2 + 3 * i]
      expectPoint(first(spoke), 48, 30)
      expectPoint(last(spoke), 48 + 15 * Math.cos(a), 30 + 15 * Math.sin(a))
      ;[40, -40].forEach((turn, j) => {
        const barb = d.lines[3 + 3 * i + j]
        expectPoint(first(barb), 48 + 15 * Math.cos(a), 30 + 15 * Math.sin(a))
        const back = a + Math.PI + turn / DEG
        expectPoint(last(barb), 48 + 15 * Math.cos(a) + 3.5 * Math.cos(back), 30 + 15 * Math.sin(a) + 3.5 * Math.sin(back))
      })
    }
  })

  it("FR-04: левая дверь 40 — θ ≈ 48,7°, нижний угол E1 ≈ (26,4; 90), E2 ≈ (27,9; 88,7), створка начинается в углу корпуса", () => {
    const leaf = fridgeDrawing(size(100, 90)).lines[26] ?? []
    expect(leaf).toHaveLength(4)
    expectPoint(leaf[0] as Point, 0, 60)
    expectPoint(leaf[1] as Point, 26.4, 90)
    expectPoint(leaf[2] as Point, 27.9, 88.7)
    expectPoint(leaf[3] as Point, 2.66, 60)
    const theta = Math.asin(30 / Math.sqrt(40 * 40 - 4)) * DEG
    expect(theta).toBeCloseTo(48.7, 1)
  })

  it("FR-05: правая дверь 60 — θ ≈ 30,0°, E1 ≈ (48,1; 90), E2 ≈ (47,1; 88,3), створка начинается в углу корпуса", () => {
    const leaf = fridgeDrawing(size(100, 90)).lines[27] ?? []
    expect(leaf).toHaveLength(4)
    expectPoint(leaf[0] as Point, 100, 60)
    expectPoint(leaf[1] as Point, 48.1, 90)
    expectPoint(leaf[2] as Point, 47.1, 88.3)
    expectPoint(leaf[3] as Point, 96, 60)
  })

  it("FR-06: дуги раскрытия — радиусы 40 и 60 вокруг петель, обе начинаются в (40; 60), кончаются в E2", () => {
    const d = fridgeDrawing(size(100, 90))
    const left = d.lines[28] ?? []
    const right = d.lines[29] ?? []
    expectPoint(first(left), 40, 60)
    expectPoint(first(right), 40, 60)
    expectPoint(last(left), 27.9, 88.7)
    expectPoint(last(right), 47.1, 88.3)
    left.forEach((p) => expect(Math.hypot(p.x, p.y - 60)).toBeCloseTo(40, 6))
    right.forEach((p) => expect(Math.hypot(p.x - 100, p.y - 60)).toBeCloseTo(60, 6))
  })

  it("FR-07: рисунок 100×90 внутри прямоугольника, линии не пересекаются", () => {
    const d = fridgeDrawing(size(100, 90))
    expect(inside(d.lines, 100, 90)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("FR-08: холодильник 150×90 — двери 60 и 90 (θ ≈ 30,0° и 19,5°), круг с центром (72; 30)", () => {
    const d = fridgeDrawing(size(150, 90))
    expect(d.lines).toHaveLength(30)
    expectPoint(first(d.lines[28]), 60, 60)
    expectPoint(first(d.lines[29]), 60, 60)
    expect(last(d.lines[26]?.slice(0, 2)).y).toBeCloseTo(90, 6)
    expect(last((d.lines[27] ?? []).slice(0, 2)).y).toBeCloseTo(90, 6)
    expect(Math.asin(30 / Math.sqrt(90 * 90 - 4)) * DEG).toBeCloseTo(19.5, 1)
    ;(d.lines[1] ?? []).forEach((p) => expect(Math.hypot(p.x - 72, p.y - 30)).toBeCloseTo(18.5, 6))
    expect(inside(d.lines, 150, 90)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("FR-09: холодильник 100×45 — k = 0,5: корпус 30, круг 9,25 с центром (48; 15), лучи 7,5, ход дверей 15", () => {
    const d = fridgeDrawing(size(100, 45))
    expect(pts(d.lines[0])).toEqual([[0, 0], [100, 0], [100, 30], [0, 30], [0, 0]])
    ;(d.lines[1] ?? []).forEach((p) => expect(Math.hypot(p.x - 48, p.y - 15)).toBeCloseTo(9.25, 6))
    expectPoint(last(d.lines[2]), 55.5, 15)
    const leaf = d.lines[26] ?? []
    expect((leaf[1] as Point).y).toBeCloseTo(45, 6)
    expect(Math.asin(15 / Math.sqrt(40 * 40 - 1)) * DEG).toBeCloseTo(22.0, 1)
    expect(inside(d.lines, 100, 45)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("FR-10: холодильник 100×120 — корпус 90, круг с центром (48; 45), двери те же, но ниже на 30", () => {
    const tall = fridgeDrawing(size(100, 120))
    const base = fridgeDrawing(size(100, 90))
    expect(pts(tall.lines[0])).toEqual([[0, 0], [100, 0], [100, 90], [0, 90], [0, 0]])
    expectPoint(first(tall.lines[1]), 48 + 18.5, 45)
    ;[26, 27, 28, 29].forEach((i) => {
      expect(tall.lines[i]?.map((p) => p.y - 30).map((v) => Math.round(v * 1e6))).toEqual(base.lines[i]?.map((p) => Math.round(p.y * 1e6)))
    })
    expect(inside(tall.lines, 100, 120)).toBe(true)
  })

  it("FR-11: образец легенды — масштаб 1 из аргумента при уменьшенных габаритах даёт подобие рисунка (k = l / 90)", () => {
    const d = fridgeDrawing(size(17.78, 16), 1)
    expect(d.lines).toHaveLength(30)
    expect(inside(d.lines, 17.78, 16)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("FR-12: сетка размеров 20–300 × 10–200 — внутри прямоугольника и без пересечений", () => {
    const problems: string[] = []
    for (const w of [20, 47, 100, 150, 300]) {
      for (const l of [10, 31, 45, 90, 120, 200]) {
        const d = fridgeDrawing(size(w, l))
        if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
        if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
      }
    }
    expect(problems).toEqual([])
  })

  it("FR-13: холодильник с углом 90° — двери слева от центра, корпус со снежинкой правее", () => {
    const item = newItem("f", "fridge", { x: 0, y: 0 }, { widthCm: 100, lengthCm: 90, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)
    expect(meanX(lines[28])).toBeLessThan(meanX(lines[1]))
    expect(meanX(lines[29])).toBeLessThan(meanX(lines[1]))
  })
})
