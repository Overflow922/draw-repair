import { describe, expect, it } from "vitest"
import type { Table } from "../types"
import { hitTable, newTable, normalizeAngle, tableCorners } from "./table"

// change furniture-plan-table: стол (spec furniture-plan «Стол»). Числа выведены из спецификации, а не из модуля.

const table = (angleDeg: number, extra: Partial<Table> = {}): Table => ({ id: "t", x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg, ...extra })

const bounds = (t: Table): { minX: number; minY: number; maxX: number; maxY: number } => {
  const xs = tableCorners(t).map((p) => p.x)
  const ys = tableCorners(t).map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

describe("геометрия стола", () => {
  it("FP-100: ширина вдоль X, длина вдоль Y — стол с центром (200, 100) 80×160 занимает (160, 20)–(240, 180)", () => {
    const b = bounds(table(0))
    expect(b.minX).toBeCloseTo(160)
    expect(b.minY).toBeCloseTo(20)
    expect(b.maxX).toBeCloseTo(240)
    expect(b.maxY).toBeCloseTo(180)
  })

  it("FP-101: угол 90 поворачивает вокруг центра — (120, 60)–(280, 140)", () => {
    const b = bounds(table(90))
    expect(b.minX).toBeCloseTo(120)
    expect(b.minY).toBeCloseTo(60)
    expect(b.maxX).toBeCloseTo(280)
    expect(b.maxY).toBeCloseTo(140)
  })

  it("FP-102: поворот по часовой на экране — середина верхней стороны при угле 90 уходит вправо от центра", () => {
    // точка (0, −80) относительно центра (0, 0): при 0 — середина верхней стороны
    const corners = tableCorners(table(90, { x: 0, y: 0 }))
    const topMid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }
    expect(topMid.x).toBeCloseTo(80)
    expect(topMid.y).toBeCloseTo(0)
  })

  it("FP-103: поворот не сдвигает центр — середина диагонали стола остаётся центром при любом угле", () => {
    for (const a of [0, 30, 45, 135, 270, 359]) {
      const c = tableCorners(table(a))
      expect((c[0].x + c[2].x) / 2).toBeCloseTo(200)
      expect((c[0].y + c[2].y) / 2).toBeCloseTo(100)
    }
  })
})

describe("угол", () => {
  it("FP-104: приведение к [0, 360): 360 → 0, −90 → 270, 450 → 90", () => {
    expect(normalizeAngle(360)).toBe(0)
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(359.5)).toBe(359.5)
  })

  it("FP-104: −0 приводится к 0", () => {
    expect(Object.is(normalizeAngle(-0), 0)).toBe(true)
    expect(Object.is(normalizeAngle(-360), 0)).toBe(true)
  })

  it("FP-105: новый стол получает центр в точке клика и приведённый угол", () => {
    expect(newTable("n", { x: 300, y: 200 }, { widthCm: 80, lengthCm: 160, angleDeg: 450 })).toEqual({
      id: "n",
      x: 300,
      y: 200,
      widthCm: 80,
      lengthCm: 160,
      angleDeg: 90,
    })
  })
})

describe("попадание в стол", () => {
  it("FP-106: точка внутри стола — попадание, снаружи — нет", () => {
    expect(hitTable(table(0), { x: 200, y: 100 })).toBe(true)
    expect(hitTable(table(0), { x: 239, y: 179 })).toBe(true)
    expect(hitTable(table(0), { x: 241, y: 100 })).toBe(false)
  })

  it("FP-106: у повёрнутого стола попадание считается в его системе, а не по описанному прямоугольнику", () => {
    // угол 45: угол описанного прямоугольника далеко от тела
    const t = table(45)
    const corner = bounds(t)
    expect(hitTable(t, { x: corner.minX + 1, y: corner.minY + 1 })).toBe(false)
    expect(hitTable(t, { x: 200, y: 100 })).toBe(true)
  })

  it("FP-106: допуск расширяет тело наружу", () => {
    expect(hitTable(table(0), { x: 243, y: 100 }, 5)).toBe(true)
    expect(hitTable(table(0), { x: 246, y: 100 }, 5)).toBe(false)
  })
})
