import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { wallCabinetDrawing } from "./item-drawing"
import type { ItemSize } from "./item-drawing"

// change add-furniture-tv-wall-cabinet: рисунок подвесной тумбы по эскизу (spec furniture-plan «Каталог видов мебели», сценарии
// «Рисунок подвесной тумбы», «Подвесная тумба другого размера»). Ожидания — числа из спеки.

const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const rounded = (v: number): number => Math.round(v * 1e6) / 1e6
const pts = (line: readonly Point[] | undefined): number[][] => (line ?? []).map((p) => [rounded(p.x), rounded(p.y)])
const inside = (lines: readonly (readonly Point[])[], w: number, l: number): boolean =>
  lines.flat().every((p) => p.x >= -1e-9 && p.x <= w + 1e-9 && p.y >= -1e-9 && p.y <= l + 1e-9)

describe("рисунок подвесной тумбы", () => {
  it("WC-01: тумба 180×42 — прямоугольник с острыми углами и два крепления, других линий нет", () => {
    const d = wallCabinetDrawing(size(180, 42))
    expect(d.lines).toHaveLength(3)
    expect(pts(d.lines[0])).toEqual([[0, 0], [180, 0], [180, 42], [0, 42], [0, 0]])
    expect(pts(d.lines[1])).toEqual([[13, 42], [13, 35], [19, 35], [19, 42]])
    expect(pts(d.lines[2])).toEqual([[161, 42], [161, 35], [167, 35], [167, 42]])
  })

  it("WC-02: силуэт — прямоугольник предмета, первая линия замкнута им", () => {
    const d = wallCabinetDrawing(size(180, 42))
    expect(pts(d.outline)).toEqual([[0, 0], [180, 0], [180, 42], [0, 42]])
    expect(d.lines[0]).toEqual([...d.outline, d.outline[0]])
  })

  it("WC-03: тумба 120×60 — крепления прежних размеров с отступом 13 см от боков у нижнего края", () => {
    const d = wallCabinetDrawing(size(120, 60))
    expect(pts(d.lines[0])).toEqual([[0, 0], [120, 0], [120, 60], [0, 60], [0, 0]])
    expect(pts(d.lines[1])).toEqual([[13, 60], [13, 53], [19, 53], [19, 60]])
    expect(pts(d.lines[2])).toEqual([[101, 60], [101, 53], [107, 53], [107, 60]])
  })

  it("WC-04: тумба 90×21 — детали уменьшены вдвое, рисунок внутри", () => {
    const d = wallCabinetDrawing(size(90, 21))
    expect(pts(d.lines[1])).toEqual([[6.5, 21], [6.5, 17.5], [9.5, 17.5], [9.5, 21]])
    expect(pts(d.lines[2])).toEqual([[80.5, 21], [80.5, 17.5], [83.5, 17.5], [83.5, 21]])
    expect(inside(d.lines, 90, 21)).toBe(true)
  })

  it("WC-05: масштаб деталей 1 из аргумента — детали в полном размере при любых габаритах", () => {
    const d = wallCabinetDrawing(size(80, 18.7), 1)
    expect(pts(d.lines[1])).toEqual([[13, 18.7], [13, 11.7], [19, 11.7], [19, 18.7]])
  })
})
