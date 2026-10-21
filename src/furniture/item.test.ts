import { describe, expect, it } from "vitest"
import type { FurnitureItem } from "../types"
import { hitItem, newItem, normalizeAngle, itemCorners, itemLocalToWorld } from "./item"

// change furniture-plan-table: стол (spec furniture-plan «Стол»). Числа выведены из спецификации, а не из модуля.
// TCR (change furniture-items-catalog): стол стал предметом мебели (Table → FurnitureItem, tables → items, table*.ts → item*.ts) с видом «table»; меняются только имена и вид в данных, утверждения о поведении не менялись

const table = (angleDeg: number, extra: Partial<FurnitureItem> = {}): FurnitureItem => ({ id: "t", kind: "table", x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg, ...extra })

const bounds = (t: FurnitureItem): { minX: number; minY: number; maxX: number; maxY: number } => {
  const xs = itemCorners(t).map((p) => p.x)
  const ys = itemCorners(t).map((p) => p.y)
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
    const corners = itemCorners(table(90, { x: 0, y: 0 }))
    const topMid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }
    expect(topMid.x).toBeCloseTo(80)
    expect(topMid.y).toBeCloseTo(0)
  })

  it("FP-103: поворот не сдвигает центр — середина диагонали стола остаётся центром при любом угле", () => {
    for (const a of [0, 30, 45, 135, 270, 359]) {
      const c = itemCorners(table(a))
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
    // TCR (change furniture-items-catalog): новый предмет получает вид
    expect(newItem("n", "table", { x: 300, y: 200 }, { widthCm: 80, lengthCm: 160, angleDeg: 450 })).toEqual({
      id: "n",
      kind: "table",
      x: 300,
      y: 200,
      widthCm: 80,
      lengthCm: 160,
      angleDeg: 90,
    })
  })
})

// change furniture-line-drawings: точки рисунка вида переводятся из системы предмета в чертёж
// (spec furniture-plan «Каталог видов мебели»: рисунок поворачивается и смещается вместе с предметом)
describe("точка предмета в чертёж", () => {
  it("ID-30: при угле 0 углы системы предмета — углы прямоугольника", () => {
    const t = table(0)
    expect(itemLocalToWorld(t, { x: 0, y: 0 })).toEqual({ x: 160, y: 20 })
    expect(itemLocalToWorld(t, { x: 80, y: 160 })).toEqual({ x: 240, y: 180 })
    expect(itemLocalToWorld(t, { x: 40, y: 80 })).toEqual({ x: 200, y: 100 })
  })

  it("ID-31: при угле 90 верх предмета (y = 0) смотрит вправо от центра", () => {
    const p = itemLocalToWorld(table(90), { x: 40, y: 0 })
    expect(p.x).toBeCloseTo(280, 9)
    expect(p.y).toBeCloseTo(100, 9)
  })

  it("ID-32: совпадает с углами itemCorners", () => {
    const t = table(30)
    const [a, b, c, d] = itemCorners(t)
    const local = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 160 }, { x: 0, y: 160 }].map((p) => itemLocalToWorld(t, p))
    ;[a, b, c, d].forEach((corner, i) => {
      expect(local[i]?.x).toBeCloseTo(corner.x, 9)
      expect(local[i]?.y).toBeCloseTo(corner.y, 9)
    })
  })
})

describe("попадание в стол", () => {
  it("FP-106: точка внутри стола — попадание, снаружи — нет", () => {
    expect(hitItem(table(0), { x: 200, y: 100 })).toBe(true)
    expect(hitItem(table(0), { x: 239, y: 179 })).toBe(true)
    expect(hitItem(table(0), { x: 241, y: 100 })).toBe(false)
  })

  it("FP-106: у повёрнутого стола попадание считается в его системе, а не по описанному прямоугольнику", () => {
    // угол 45: угол описанного прямоугольника далеко от тела
    const t = table(45)
    const corner = bounds(t)
    expect(hitItem(t, { x: corner.minX + 1, y: corner.minY + 1 })).toBe(false)
    expect(hitItem(t, { x: 200, y: 100 })).toBe(true)
  })

  it("FP-106: допуск расширяет тело наружу", () => {
    expect(hitItem(table(0), { x: 243, y: 100 }, 5)).toBe(true)
    expect(hitItem(table(0), { x: 246, y: 100 }, 5)).toBe(false)
  })
})
