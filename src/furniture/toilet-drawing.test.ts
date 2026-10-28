import { describe, expect, it } from "vitest"
import type { Point, ToiletSizes } from "../types"
import { toiletDrawing } from "./toilet-drawing"

// change add-toilet: рисунок вида «Унитаз» (spec furniture-plan «Унитаз», сценарий «Рисунок по умолчанию»; картинка
// references/toilet.png). Эталоны посчитаны вручную по формулам спеки.

const DEFAULT: ToiletSizes = { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 }
const draw = (t: ToiletSizes = DEFAULT, forcedScale?: number) =>
  toiletDrawing({ widthCm: t.blockWidthCm, lengthCm: t.bowlLengthCm + t.blockDepthCm, toilet: t }, forcedScale)

const bbox = (line: readonly Point[]): [number, number, number, number] => [
  Math.min(...line.map((p) => p.x)),
  Math.min(...line.map((p) => p.y)),
  Math.max(...line.map((p) => p.x)),
  Math.max(...line.map((p) => p.y)),
]
const round = (v: number): number => Math.round(v * 1000) / 1000
const roundedBox = (line: readonly Point[]): number[] => bbox(line).map(round)

const area = (poly: readonly Point[]): number => {
  let s = 0
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  })
  return Math.abs(s) / 2
}

describe("рисунок унитаза по умолчанию", () => {
  it("TLD-01: восемь линий в порядке спеки", () => {
    expect(draw().lines).toHaveLength(8)
  })

  it("TLD-02: линия 1 — блок (0; 0)–(70; 20) замкнутым прямоугольником, линии 2–3 — его диагонали", () => {
    const [block, d1, d2] = draw().lines
    expect(block).toEqual([{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }])
    expect(d1).toEqual([{ x: 0, y: 0 }, { x: 70, y: 20 }])
    expect(d2).toEqual([{ x: 70, y: 0 }, { x: 0, y: 20 }])
  })

  it("TLD-03: линия 4 — контур чаши: бока x = 16 и x = 54 от блока до y = 53, полуокружность радиуса 19 с центром (35; 53) через нос (35; 72)", () => {
    const bowl = draw().lines[3]
    expect(bowl[0]).toEqual({ x: 16, y: 20 })
    expect(bowl[1]).toEqual({ x: 16, y: 53 })
    expect(bowl[bowl.length - 2]).toEqual({ x: 54, y: 53 })
    expect(bowl[bowl.length - 1]).toEqual({ x: 54, y: 20 })
    const arcPoints = bowl.slice(1, -1)
    for (const p of arcPoints) expect(Math.hypot(p.x - 35, p.y - 53)).toBeCloseTo(19, 6)
    expect(arcPoints.some((p) => Math.abs(p.x - 35) < 1e-9 && Math.abs(p.y - 72) < 1e-9)).toBe(true)
  })

  it("TLD-04: линия 5 — сиденье x 22,5–47,5, y 36–65,5", () => {
    expect(roundedBox(draw().lines[4])).toEqual([22.5, 36, 47.5, 65.5])
  })

  it("TLD-05: линия 6 — отверстие, эллипс с центром (35; 46) и полуосями 4,2 и 5,5", () => {
    expect(roundedBox(draw().lines[5])).toEqual([30.8, 40.5, 39.2, 51.5])
  })

  it("TLD-06: линии 7 и 8 — дуги крышки с концами (16; 32) и (54; 32) и вершинами y = 23,7 и y = 28,6", () => {
    const [outer, inner] = draw().lines.slice(6)
    for (const [arcLine, apexY] of [[outer, 23.7], [inner, 28.6]] as const) {
      expect(arcLine[0].x).toBeCloseTo(16, 9)
      expect(arcLine[0].y).toBeCloseTo(32, 9)
      expect(arcLine[arcLine.length - 1].x).toBeCloseTo(54, 9)
      expect(arcLine[arcLine.length - 1].y).toBeCloseTo(32, 9)
      expect(Math.min(...arcLine.map((p) => p.y))).toBeCloseTo(apexY, 9)
      const apex = arcLine.reduce((a, b) => (b.y < a.y ? b : a))
      expect(apex.x).toBeCloseTo(35, 6)
    }
  })

  it("TLD-07: силуэт — Т-образный контур блока и чаши, площадь ≈ 70·20 + 38·33 + π·19²/2", () => {
    const { outline } = draw()
    expect(outline).toContainEqual({ x: 0, y: 0 })
    expect(outline).toContainEqual({ x: 70, y: 0 })
    expect(outline).toContainEqual({ x: 70, y: 20 })
    expect(outline).toContainEqual({ x: 0, y: 20 })
    expect(outline.some((p) => Math.abs(p.x - 35) < 1e-9 && Math.abs(p.y - 72) < 1e-9)).toBe(true)
    expect(Math.abs(area(outline) - (1400 + 1254 + (Math.PI * 19 * 19) / 2))).toBeLessThan(3)
  })
})

describe("масштаб деталей и размеры", () => {
  it("TLD-10: у чаши 19 × 26 (k = 0,5) сиденье начинается с x = 28,75 и y = 28, отверстие на y = 33", () => {
    const d = draw({ bowlWidthCm: 19, bowlLengthCm: 26, blockWidthCm: 70, blockDepthCm: 20 })
    // cx = 35; сиденье: x от 35 − 9,5 + 3,25 = 28,75, y от 20 + 8 = 28 до 46 − 3,25 = 42,75
    expect(roundedBox(d.lines[4])).toEqual([28.75, 28, 41.25, 42.75])
    // отверстие: центр y = 46 − 13 = 33, полуоси 2,1 и 2,75
    expect(roundedBox(d.lines[5])).toEqual([32.9, 30.25, 37.1, 35.75])
  })

  it("TLD-11: форсированный масштаб (образец легенды) задаёт детали независимо от размеров", () => {
    const d = draw(DEFAULT, 0.5)
    // cx = 35, k = 0,5: x от 35 − 19 + 3,25 = 19,25 до 50,75; y от 20 + 8 = 28 до 72 − 3,25 = 68,75
    expect(roundedBox(d.lines[4])).toEqual([19.25, 28, 50.75, 68.75])
  })

  it("TLD-12: чаша шире 38 и длиннее 52 не растягивает детали: сиденье у чаши 50 × 60 при ширине блока 80", () => {
    const d = draw({ bowlWidthCm: 50, bowlLengthCm: 60, blockWidthCm: 80, blockDepthCm: 25 })
    // cx = 40, k = 1: x от 40 − 25 + 6,5 = 21,5 до 58,5; y от 25 + 16 = 41 до 85 − 6,5 = 78,5
    expect(roundedBox(d.lines[4])).toEqual([21.5, 41, 58.5, 78.5])
  })

  it.each([
    [{ bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 }],
    [{ bowlWidthCm: 19, bowlLengthCm: 26, blockWidthCm: 40, blockDepthCm: 10 }],
    [{ bowlWidthCm: 50, bowlLengthCm: 60, blockWidthCm: 80, blockDepthCm: 25 }],
    [{ bowlWidthCm: 40, bowlLengthCm: 20, blockWidthCm: 40, blockDepthCm: 5 }],
  ])("TLD-13: линии целиком внутри прямоугольника предмета (%j)", (t) => {
    const w = t.blockWidthCm
    const l = t.bowlLengthCm + t.blockDepthCm
    for (const p of [...draw(t).lines.flat(), ...draw(t).outline]) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9)
      expect(p.x).toBeLessThanOrEqual(w + 1e-9)
      expect(p.y).toBeGreaterThanOrEqual(-1e-9)
      expect(p.y).toBeLessThanOrEqual(l + 1e-9)
    }
  })

  it("TLD-14: без размеров унитаза в параметрах рисунок строится по ширине и длине предмета", () => {
    const d = toiletDrawing({ widthCm: 70, lengthCm: 72 })
    expect(d.lines).toHaveLength(8)
    expect(d.lines[0]).toEqual([{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }])
  })
})
