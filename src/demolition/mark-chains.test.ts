import { describe, expect, it } from "vitest"
import type { Wall } from "../types"
import { W, deepFreeze, wall } from "./demolition.test-utils"
import { faceBounds, markChains } from "./mark-chains"
import type { MarkSpan } from "./mark-model"

// change demolition-doorway-sizes: размеры пометки по граням до ближайших стыков (spec demolition-plan «Выделение
// пометки и правка чисел на месте»; design D1). Оракулы — из геометрии стыков (doorway «Стыки грани и расстояния
// проёма»), а не из продакшн-кода демонтажа: свободная стена — грани [0, 500]; комната с замкнутыми углами —
// внутренняя грань y = 10 лежит между стыками 10 и 490, наружная y = −10 — между −10 и 510.

const room = (): Wall[] => [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]
const withT = (): Wall[] => [...room(), wall(300, 10, 300, 400, "P", "brick", 10)] // перегородка к грани y = 10 в x = 295…305

function spanOn(walls: readonly Wall[], id: string, from: number, to: number): MarkSpan {
  const w = walls.find((x) => x.id === id)
  if (!w) throw new Error(`нет стены ${id}`)
  return { wall: w, from, to }
}

const lengths = (items: { lengthCm: number }[]): number[] => items.map((i) => i.lengthCm)

describe("границы пометки на грани", () => {
  it("SZ-01: комната с замкнутыми углами, пометка 100–190: грань +1 между стыками 10 и 490, грань −1 между −10 и 510", () => {
    const ws = room()
    const r = spanOn(ws, "W", 100, 190)
    expect(faceBounds(r, ws, 1)).toEqual({ j0: 10, j1: 490, start: 100, end: 190 })
    expect(faceBounds(r, ws, -1)).toEqual({ j0: -10, j1: 510, start: 100, end: 190 })
  })

  it("SZ-02: свободная стена: на обеих гранях стыки у торцов — 0 и 500", () => {
    const ws = [W()]
    const r = spanOn(ws, "W", 100, 190)
    expect(faceBounds(r, ws, 1)).toEqual({ j0: 0, j1: 500, start: 100, end: 190 })
    expect(faceBounds(r, ws, -1)).toEqual({ j0: 0, j1: 500, start: 100, end: 190 })
  })

  it("SZ-03: пометка у конца a (from = 0): торцевая часть включена — начало совпадает со стыком грани", () => {
    const ws = room()
    const r = spanOn(ws, "W", 0, 190)
    expect(faceBounds(r, ws, 1)).toEqual({ j0: 10, j1: 490, start: 10, end: 190 })
    expect(faceBounds(r, ws, -1)).toEqual({ j0: -10, j1: 510, start: -10, end: 190 })
  })

  it("SZ-03: пометка у конца b (to = длине): конец совпадает со стыком грани", () => {
    const ws = room()
    const r = spanOn(ws, "W", 300, 500)
    expect(faceBounds(r, ws, 1)).toEqual({ j0: 10, j1: 490, start: 300, end: 490 })
    expect(faceBounds(r, ws, -1)).toEqual({ j0: -10, j1: 510, start: 300, end: 510 })
  })

  it("SZ-03: допуск торца — граница в пределах 0,01 см от конца стены считается торцом, дальше — нет", () => {
    const ws = room()
    expect(faceBounds(spanOn(ws, "W", 0.005, 190), ws, 1)?.start).toBe(10)
    expect(faceBounds(spanOn(ws, "W", 0.005, 190), ws, -1)?.start).toBe(-10)
    expect(faceBounds(spanOn(ws, "W", 0.5, 190), ws, 1)?.start).toBe(10) // max(j0 = 10, from = 0,5)
    expect(faceBounds(spanOn(ws, "W", 0.5, 190), ws, -1)?.start).toBe(0.5)
    expect(faceBounds(spanOn(ws, "W", 495, 499.995), ws, -1)?.end).toBe(510)
    expect(faceBounds(spanOn(ws, "W", 495, 499.5), ws, -1)?.end).toBe(499.5)
  })

  it("SZ-04: Т-примыкание делит грань +1: пометка 100–190 лежит на участке [10, 295]; грань −1 прежняя", () => {
    const ws = withT()
    const r = spanOn(ws, "W", 100, 190)
    expect(faceBounds(r, ws, 1)).toEqual({ j0: 10, j1: 295, start: 100, end: 190 })
    expect(faceBounds(r, ws, -1)).toEqual({ j0: -10, j1: 510, start: 100, end: 190 })
  })

  it("SZ-04: пометка 320–400 лежит на втором участке грани +1 [305, 490]", () => {
    const ws = withT()
    expect(faceBounds(spanOn(ws, "W", 320, 400), ws, 1)).toEqual({ j0: 305, j1: 490, start: 320, end: 400 })
  })

  it("SZ-05: угол только у конца a (стена L от начала W), конец b свободный: внутри 10…500, снаружи −10…500", () => {
    const ws = [wall(0, 0, 500, 0, "W"), wall(0, 0, 0, 400, "L")]
    const r = spanOn(ws, "W", 100, 190)
    expect(faceBounds(r, ws, 1)).toEqual({ j0: 10, j1: 500, start: 100, end: 190 })
    expect(faceBounds(r, ws, -1)).toEqual({ j0: -10, j1: 500, start: 100, end: 190 })
  })

  it("SZ-07: пометка через Т-стык: границы зажаты участком грани с наибольшим перекрытием", () => {
    const ws = withT()
    // пометка 250–350: на [10, 295] перекрытие 45 см, на [305, 490] — 45 см; при равенстве берётся первый (меньшие t)
    expect(faceBounds(spanOn(ws, "W", 250, 350), ws, 1)).toEqual({ j0: 10, j1: 295, start: 250, end: 295 })
    // пометка 200–340: на [10, 295] перекрытие 95, на [305, 490] — 35 → первый участок, конец зажат у стыка 295
    expect(faceBounds(spanOn(ws, "W", 200, 340), ws, 1)).toEqual({ j0: 10, j1: 295, start: 200, end: 295 })
    // пометка 280–450: на первом перекрытие 15, на втором 145 → второй участок, начало зажато у стыка 305
    expect(faceBounds(spanOn(ws, "W", 280, 450), ws, 1)).toEqual({ j0: 305, j1: 490, start: 305, end: 450 })
  })

  it("SZ-07: пометка 296–301 целиком в разрыве у Т-примыкания: границы зажаты у стыка 295, ширина на грани 0", () => {
    const ws = withT()
    expect(faceBounds(spanOn(ws, "W", 296, 301), ws, 1)).toEqual({ j0: 10, j1: 295, start: 295, end: 295 })
  })

  it("SZ-07: пометка 299–303 левее участка [305, 490]: конец не меньше начала — начало и конец на стыке 305, размеры 0, 0, 185", () => {
    const ws = withT()
    expect(faceBounds(spanOn(ws, "W", 299, 303), ws, 1)).toEqual({ j0: 305, j1: 490, start: 305, end: 305 })
    expect(lengths(markChains(spanOn(ws, "W", 299, 303), ws)).slice(0, 3)).toEqual([0, 0, 185])
  })

  it("SZ-06: вырожденная стена (a = b) — границ грани нет", () => {
    const ws = [wall(10, 10, 10, 10, "Z")]
    expect(faceBounds({ wall: ws[0] as Wall, from: 0, to: 5 }, ws, 1)).toBeNull()
  })

  it("SZ-06: вход не мутируется", () => {
    const ws = deepFreeze(room())
    const r = deepFreeze(spanOn(ws, "W", 100, 190))
    expect(() => faceBounds(r, ws, 1)).not.toThrow()
    expect(() => markChains(r, ws)).not.toThrow()
  })
})

describe("цепочки пометки по граням", () => {
  it("SZ-01: комната, пометка 100–190: шесть размеров — грань +1: 90, 90, 300; грань −1: 110, 90, 320", () => {
    const ws = room()
    const items = markChains(spanOn(ws, "W", 100, 190), ws)
    expect(items.map((i) => [i.side, i.target])).toEqual([
      [1, "gapA"],
      [1, "width"],
      [1, "gapB"],
      [-1, "gapA"],
      [-1, "width"],
      [-1, "gapB"],
    ])
    expect(lengths(items)).toEqual([90, 90, 300, 110, 90, 320])
  })

  it("SZ-01: границы размеров вдоль оси: грань +1 — [10,100], [100,190], [190,490]; грань −1 — [−10,100], [100,190], [190,510]", () => {
    const ws = room()
    const items = markChains(spanOn(ws, "W", 100, 190), ws)
    expect(items.map((i) => [i.fromCm, i.toCm])).toEqual([
      [10, 100],
      [100, 190],
      [190, 490],
      [-10, 100],
      [100, 190],
      [190, 510],
    ])
  })

  it("SZ-02: свободная стена, 100–190: на обеих гранях 100, 90, 310", () => {
    const ws = [W()]
    expect(lengths(markChains(spanOn(ws, "W", 100, 190), ws))).toEqual([100, 90, 310, 100, 90, 310])
  })

  it("SZ-03: пометка на всю стену в комнате: грань +1 — 0, 480, 0; грань −1 — 0, 520, 0", () => {
    const ws = room()
    expect(lengths(markChains(spanOn(ws, "W", 0, 500), ws))).toEqual([0, 480, 0, 0, 520, 0])
  })

  it("SZ-03: пометка 0–190 в комнате: отступ у конца a нулевой на обеих гранях", () => {
    const ws = room()
    expect(lengths(markChains(spanOn(ws, "W", 0, 190), ws))).toEqual([0, 180, 300, 0, 200, 320])
  })

  it("SZ-04: Т-примыкание: грань +1 — 90, 90, 105; грань −1 — 110, 90, 320", () => {
    const ws = withT()
    expect(lengths(markChains(spanOn(ws, "W", 100, 190), ws))).toEqual([90, 90, 105, 110, 90, 320])
  })

  it("SZ-07: пометка в разрыве у Т-примыкания: размеры не отрицательны — грань +1: 285, 0, 0; грань −1: 306, 5, 209", () => {
    const ws = withT()
    expect(lengths(markChains(spanOn(ws, "W", 296, 301), ws))).toEqual([285, 0, 0, 306, 5, 209])
  })

  it("SZ-05: угол у конца a и свободный конец b: грань +1 — 90, 90, 310; грань −1 — 110, 90, 310", () => {
    const ws = [wall(0, 0, 500, 0, "W"), wall(0, 0, 0, 400, "L")]
    expect(lengths(markChains(spanOn(ws, "W", 100, 190), ws))).toEqual([90, 90, 310, 110, 90, 310])
  })

  it("SZ-09: стена в обратном направлении (500,0)→(0,0): сторона +1 — нормаль (0, −1); числа те же, границы от конца a = (500, 0)", () => {
    const ws = [wall(500, 0, 0, 0, "W")]
    const items = markChains(spanOn(ws, "W", 100, 190), ws)
    expect(lengths(items)).toEqual([100, 90, 310, 100, 90, 310])
    expect(items.map((i) => i.side)).toEqual([1, 1, 1, -1, -1, -1])
  })

  it("SZ-06: размер нулевой длины остаётся в цепочке с lengthCm = 0 (число «0» у границы)", () => {
    const ws = room()
    const items = markChains(spanOn(ws, "W", 0, 190), ws)
    expect(items[0]).toMatchObject({ side: 1, target: "gapA", lengthCm: 0 })
  })

  it("SZ-06: стена без граней — пустая цепочка", () => {
    const ws = [wall(10, 10, 10, 10, "Z")]
    expect(markChains({ wall: ws[0] as Wall, from: 0, to: 5 }, ws)).toEqual([])
  })

  it("SZ-10: сумма трёх размеров грани равна длине её участка между стыками", () => {
    const ws = room()
    const items = markChains(spanOn(ws, "W", 123.5, 211.25), ws)
    const sum = (side: number): number => items.filter((i) => i.side === side).reduce((s, i) => s + i.lengthCm, 0)
    expect(sum(1)).toBeCloseTo(480, 9)
    expect(sum(-1)).toBeCloseTo(520, 9)
  })
})
