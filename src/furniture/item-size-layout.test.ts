import { describe, expect, it } from "vitest"
import { numberAt } from "../doorway/editable-numbers"
import type { FurnitureItem, Point, Unit } from "../types"
import type { ItemNumber, ItemSize } from "./item-number"
import { itemSizeLayout } from "./item-size-layout"

// change furniture-dimensions: габариты предмета мебели (spec furniture-plan «Габариты предмета мебели»).
// Ожидания считаются здесь независимо: точки переводятся в систему предмета (начало — левый верхний угол при угле 0,
// x — вдоль ширины, y — вдоль длины), отступ линии от стороны — кегль и два зазора в px, делённые на px/см.

const SCREEN = { labelPx: 14, dimTextGapPx: 1.5 }
const PDF = { labelPx: 3.5, dimTextGapPx: 0.6 }
const insetCm = (k: number, m = SCREEN): number => (m.labelPx + 2 * m.dimTextGapPx) / k
const TOL = 1e-6

const item = (kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number, angleDeg = 0): FurnitureItem => ({ id: "i", kind, x, y, widthCm, lengthCm, angleDeg })

// точка чертежа → система предмета
function toLocal(t: FurnitureItem, p: Point): Point {
  const r = (t.angleDeg * Math.PI) / 180
  const u = { x: Math.cos(r), y: Math.sin(r) }
  const v = { x: -Math.sin(r), y: Math.cos(r) }
  const dx = p.x - t.x
  const dy = p.y - t.y
  return { x: dx * u.x + dy * u.y + t.widthCm / 2, y: dx * v.x + dy * v.y + t.lengthCm / 2 }
}

const sizeOf = (numbers: readonly ItemNumber[], size: ItemSize): ItemNumber => {
  const n = numbers.find((x) => x.field.kind === "size" && x.field.size === size)
  if (!n) throw new Error(`нет размера ${size}`)
  return n
}

interface LocalLine {
  across: number // координата линии поперёк размера (y у ширины, x у длины)
  from: number // концы вдоль размера
  to: number
  textAcross: number // центр числа поперёк размера
  textAlong: number
}

function localLine(t: FurnitureItem, n: ItemNumber, size: ItemSize): LocalLine {
  if (!n.geom) throw new Error("нет размерной линии")
  const p1 = toLocal(t, n.geom.p1)
  const p2 = toLocal(t, n.geom.p2)
  const c = toLocal(t, n.center)
  if (size === "width") {
    expect(p1.y).toBeCloseTo(p2.y, 6)
    return { across: p1.y, from: Math.min(p1.x, p2.x), to: Math.max(p1.x, p2.x), textAcross: c.y, textAlong: c.x }
  }
  expect(p1.x).toBeCloseTo(p2.x, 6)
  return { across: p1.x, from: Math.min(p1.y, p2.y), to: Math.max(p1.y, p2.y), textAcross: c.x, textAlong: c.y }
}

// линия внутри: на расстоянии inset от одной из двух сторон, концы на сторонах, число между линией и этой стороной
function expectInside(t: FurnitureItem, n: ItemNumber, size: ItemSize, k: number, m = SCREEN): void {
  const extent = size === "width" ? t.widthCm : t.lengthCm
  const across = size === "width" ? t.lengthCm : t.widthCm
  const l = localLine(t, n, size)
  const inset = insetCm(k, m)
  expect(l.from).toBeCloseTo(0, 6)
  expect(l.to).toBeCloseTo(extent, 6)
  const nearStart = Math.abs(l.across - inset) < TOL
  const nearEnd = Math.abs(l.across - (across - inset)) < TOL
  expect(nearStart || nearEnd, `линия на ${l.across}, ожидалось ${inset} или ${across - inset}`).toBe(true)
  if (nearStart) {
    expect(l.textAcross).toBeGreaterThan(0)
    expect(l.textAcross).toBeLessThan(inset)
  } else {
    expect(l.textAcross).toBeGreaterThan(across - inset)
    expect(l.textAcross).toBeLessThan(across)
  }
  expect(l.textAlong).toBeCloseTo(extent / 2, 6)
}

// линия снаружи: на расстоянии inset за одной из сторон, концы напротив углов, число дальше линии от предмета
function expectOutside(t: FurnitureItem, n: ItemNumber, size: ItemSize, k: number, m = SCREEN): void {
  const extent = size === "width" ? t.widthCm : t.lengthCm
  const across = size === "width" ? t.lengthCm : t.widthCm
  const l = localLine(t, n, size)
  const inset = insetCm(k, m)
  expect(l.from).toBeCloseTo(0, 6)
  expect(l.to).toBeCloseTo(extent, 6)
  const before = Math.abs(l.across + inset) < TOL
  const after = Math.abs(l.across - (across + inset)) < TOL
  expect(before || after, `линия на ${l.across}, ожидалось ${-inset} или ${across + inset}`).toBe(true)
  if (before) expect(l.textAcross).toBeLessThan(l.across)
  else expect(l.textAcross).toBeGreaterThan(l.across)
}

const layout = (t: FurnitureItem, k: number, unit: Unit = "cm", m = SCREEN): ItemNumber[] => itemSizeLayout(t, unit, k, m)

describe("габариты стола", () => {
  it("FD-100: стол 80 × 160, угол 0, масштаб 1 — «80» у верхней стороны и «160» у левой, внутри", () => {
    const t = item("table", 200, 100, 80, 160)
    const numbers = layout(t, 2)
    expect(numbers).toHaveLength(2)
    const width = sizeOf(numbers, "width")
    const length = sizeOf(numbers, "length")
    expect(width.text).toBe("80")
    expect(length.text).toBe("160")
    expect(width.valueCm).toBe(80)
    expect(length.valueCm).toBe(160)
    expectInside(t, width, "width", 2)
    expectInside(t, length, "length", 2)
    // при угле 0: ширина у верхней стороны (y = 20), длина у левой (x = 160)
    expect(localLine(t, width, "width").across).toBeCloseTo(insetCm(2), 6)
    expect(localLine(t, length, "length").across).toBeCloseTo(insetCm(2), 6)
    expect(width.center.y).toBeGreaterThan(20)
    expect(width.center.y).toBeLessThan(20 + insetCm(2))
    expect(length.center.x).toBeGreaterThan(160)
    expect(length.center.x).toBeLessThan(160 + insetCm(2))
  })

  it("FD-101: у повёрнутого на 90 стола «80» вдоль оси ширины (вертикаль экрана), «160» — вдоль длины (горизонталь), оба внутри", () => {
    const t = item("table", 200, 100, 80, 160, 90)
    const numbers = layout(t, 2)
    const width = sizeOf(numbers, "width")
    const length = sizeOf(numbers, "length")
    expectInside(t, width, "width", 2)
    expectInside(t, length, "length", 2)
    if (!width.geom || !length.geom) throw new Error("нет линий")
    expect(width.geom.p1.x).toBeCloseTo(width.geom.p2.x, 6)
    expect(Math.abs(width.geom.p1.y - width.geom.p2.y)).toBeCloseTo(80, 6)
    expect(length.geom.p1.y).toBeCloseTo(length.geom.p2.y, 6)
    expect(Math.abs(length.geom.p1.x - length.geom.p2.x)).toBeCloseTo(160, 6)
  })

  it("FD-102: при любом угле число стоит между своей линией и стороной, к которой обращён верх числа", () => {
    for (const angle of [0, 30, 90, 135, 180, 225, 270, 315]) {
      const t = item("table", 200, 100, 80, 160, angle)
      const numbers = layout(t, 2)
      expectInside(t, sizeOf(numbers, "width"), "width", 2)
      expectInside(t, sizeOf(numbers, "length"), "length", 2)
      for (const n of numbers) {
        if (!n.geom) throw new Error("нет линии")
        // верх текста (перпендикуляр к направлению против оси y экрана) смотрит от линии к числу
        const up = { x: n.dir.y, y: -n.dir.x }
        const mid = { x: (n.geom.p1.x + n.geom.p2.x) / 2, y: (n.geom.p1.y + n.geom.p2.y) / 2 }
        expect((n.center.x - mid.x) * up.x + (n.center.y - mid.y) * up.y).toBeGreaterThan(0)
      }
    }
  })

  it("FD-103: единица «мм» — «800» и «1600»", () => {
    const numbers = layout(item("table", 200, 100, 80, 160), 2, "mm")
    expect(sizeOf(numbers, "width").text).toBe("800")
    expect(sizeOf(numbers, "length").text).toBe("1600")
  })

  it("FD-104: число габарита находится по точке своего центра (попадание клика)", () => {
    const numbers = layout(item("table", 200, 100, 80, 160), 2)
    for (const n of numbers) expect(numberAt(n.center, numbers, 0)).toBe(n)
  })
})

describe("внутри или снаружи", () => {
  it("FD-110: телевизор 91 × 11 при масштабе 0,5 (1 px = 1 см): оба размера снаружи", () => {
    const t = item("tv", 300, 200, 91, 11)
    const numbers = layout(t, 1)
    expectOutside(t, sizeOf(numbers, "width"), "width", 1)
    expectOutside(t, sizeOf(numbers, "length"), "length", 1)
  })

  it("FD-111: тот же телевизор при масштабе 1: оба размера внутри", () => {
    const t = item("tv", 300, 200, 91, 11)
    const numbers = layout(t, 2)
    expectInside(t, sizeOf(numbers, "width"), "width", 2)
    expectInside(t, sizeOf(numbers, "length"), "length", 2)
  })

  it("FD-112: решение для каждого размера отдельно — у предмета 80 × 8 ширина снаружи (поперёк 8 < 8,5), длина внутри", () => {
    const t = item("table", 300, 200, 80, 8)
    const numbers = layout(t, 2)
    expectOutside(t, sizeOf(numbers, "width"), "width", 2)
    expectInside(t, sizeOf(numbers, "length"), "length", 2)
  })

  it("FD-113: число длиннее стороны выносится наружу, хотя поперёк места хватает", () => {
    // «11» при 1 px/см — 16,8 см текста на стороне 11 см; поперёк — 91 см
    const t = item("tv", 300, 200, 91, 11)
    expectOutside(t, sizeOf(layout(t, 1), "length"), "length", 1)
  })

  it("FD-114: в PDF при 1:50 (0,2 мм листа на см) телевизор 91 × 11 — оба снаружи, стол 80 × 160 — оба внутри", () => {
    const k = 0.2
    const tv = item("tv", 300, 200, 91, 11)
    const tvNumbers = layout(tv, k, "cm", PDF)
    expectOutside(tv, sizeOf(tvNumbers, "width"), "width", k, PDF)
    expectOutside(tv, sizeOf(tvNumbers, "length"), "length", k, PDF)
    const table = item("table", 200, 100, 80, 160)
    const tableNumbers = layout(table, k, "cm", PDF)
    expectInside(table, sizeOf(tableNumbers, "width"), "width", k, PDF)
    expectInside(table, sizeOf(tableNumbers, "length"), "length", k, PDF)
  })
})
