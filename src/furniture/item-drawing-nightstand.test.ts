import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { nightstandDrawing } from "./item-drawing"
import type { ItemSize } from "./item-drawing"

// change add-furniture-bed-nightstand: рисунок прикроватного столика по эскизу (spec furniture-plan «Каталог видов мебели», сценарии
// «Рисунок прикроватного столика», «Прикроватный столик другого размера»). Ожидания — числа из спеки. Линии: 0 контур, 1 рамка из
// трёх сплошных сторон, дальше штрихи пунктира верхней стороны.

const EPS = 1e-9
const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const rounded = (v: number): number => Math.round(v * 1e6) / 1e6
const pts = (line: readonly Point[] | undefined): number[][] => (line ?? []).map((p) => [rounded(p.x), rounded(p.y)])
const inside = (lines: readonly (readonly Point[])[], w: number, l: number): boolean =>
  lines.flat().every((p) => p.x >= -EPS && p.x <= w + EPS && p.y >= -EPS && p.y <= l + EPS)

describe("рисунок прикроватного столика", () => {
  it("NS-01: столик 30×60 — контур, рамка из трёх сторон и десять штрихов пунктира", () => {
    const d = nightstandDrawing(size(30, 60))
    expect(d.lines).toHaveLength(12)
    expect(pts(d.lines[0])).toEqual([[0, 0], [30, 0], [30, 60], [0, 60], [0, 0]])
    expect(pts(d.lines[1])).toEqual([[2.5, 2.5], [2.5, 57.5], [27.5, 57.5], [27.5, 2.5]])
  })

  it("NS-02: пунктир идёт по верхней стороне рамки слева направо, штрих 1,5 см, промежуток 1 см", () => {
    const dashes = nightstandDrawing(size(30, 60)).lines.slice(2)
    expect(dashes).toHaveLength(10)
    expect(pts(dashes[0])).toEqual([[2.5, 2.5], [4, 2.5]])
    expect(pts(dashes[1])).toEqual([[5, 2.5], [6.5, 2.5]])
    expect(pts(dashes[9])).toEqual([[25, 2.5], [26.5, 2.5]])
  })

  it("NS-03: силуэт — прямоугольник предмета, рисунок внутри", () => {
    const d = nightstandDrawing(size(30, 60))
    expect(pts(d.outline)).toEqual([[0, 0], [30, 0], [30, 60], [0, 60]])
    expect(d.lines[0]).toEqual([...d.outline, d.outline[0]])
    expect(inside(d.lines, 30, 60)).toBe(true)
  })

  it("NS-04: столик 40×40 — рамка с тем же отступом 2,5 см, пунктир во всю верхнюю сторону", () => {
    const d = nightstandDrawing(size(40, 40))
    expect(pts(d.lines[1])).toEqual([[2.5, 2.5], [2.5, 37.5], [37.5, 37.5], [37.5, 2.5]])
    expect(pts(d.lines[2])).toEqual([[2.5, 2.5], [4, 2.5]])
    const lastDash = d.lines[d.lines.length - 1] ?? []
    expect(rounded(lastDash[lastDash.length - 1]?.x ?? NaN)).toBeLessThanOrEqual(37.5)
    expect(inside(d.lines, 40, 40)).toBe(true)
  })

  it("NS-05: столик 15×30 — детали уменьшены вдвое: отступ 1,25, штрих 0,75, промежуток 0,5", () => {
    const d = nightstandDrawing(size(15, 30))
    expect(pts(d.lines[1])).toEqual([[1.25, 1.25], [1.25, 28.75], [13.75, 28.75], [13.75, 1.25]])
    expect(pts(d.lines[2])).toEqual([[1.25, 1.25], [2, 1.25]])
    expect(pts(d.lines[3])).toEqual([[2.5, 1.25], [3.25, 1.25]])
    expect(inside(d.lines, 15, 30)).toBe(true)
  })

  it("NS-06: масштаб деталей 1 из аргумента задаёт детали в полном размере при любых габаритах", () => {
    const d = nightstandDrawing(size(20, 40), 1)
    expect(pts(d.lines[1])).toEqual([[2.5, 2.5], [2.5, 37.5], [17.5, 37.5], [17.5, 2.5]])
  })
})
