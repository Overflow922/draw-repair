import { describe, expect, it } from "vitest"
import { CHAIN_OFFSET_EM } from "../doorway/editable-numbers"
import { SCREEN_METRICS } from "../render"
import { PX_PER_CM } from "../types"
import type { DemolitionMark, Unit, Wall } from "../types"
import { W, deepFreeze, mk, wall } from "./demolition.test-utils"
import { markDimensions } from "./mark-dimensions"
import type { MarkDimension } from "./mark-dimensions"
import type { MarkSpan } from "./mark-model"
import { editNumber, markNumberAt } from "./mark-numbers"
import { effectiveMarks, span } from "./marks"

// change demolition-corner-dimensions: цепочка «от угла до области» у каждой пометки, нулевые размеры опущены целиком
// (specs demolition-plan «Размерные линии пометок», «Выделение пометки и правка чисел на месте»; design D1, D5).
// Оракулы выведены из спецификации: свободная стена W (0,0)–(500,0), толщина 20 (грани y = ±10); комната
// с замкнутыми углами — грань +1 между стыками 10 и 490, грань −1 между −10 и 510.

const K = PX_PER_CM
const LABEL = SCREEN_METRICS.labelPx
const room = (): Wall[] => [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]
const withT = (): Wall[] => [...room(), wall(300, 10, 300, 400, "P", "brick", 10)]

function spanOf(walls: readonly Wall[], from: number, to: number): MarkSpan {
  const w = walls.find((x) => x.id === "W")
  if (!w) throw new Error("нет стены W")
  return { wall: w, from, to }
}

const chainOf = (walls: readonly Wall[], from: number, to: number, unit: Unit = "cm"): MarkDimension[] =>
  markDimensions(spanOf(walls, from, to), walls, "chain", unit, K, LABEL)

const summary = (list: MarkDimension[]): [number, string, string][] => list.map((d) => [d.side, d.target, d.text])

describe("состав цепочки: нулевые размеры опущены целиком (CD-05, CD-06, CD-07)", () => {
  it("CD-05: пометка 100–190 на свободной стене — шесть размеров: на каждой грани gapA 100, ширина 90, gapB 310", () => {
    expect(summary(chainOf([W()], 100, 190))).toEqual([
      [1, "gapA", "100"],
      [1, "width", "90"],
      [1, "gapB", "310"],
      [-1, "gapA", "100"],
      [-1, "width", "90"],
      [-1, "gapB", "310"],
    ])
  })

  it.each([
    ["0–190: нет gapA", 0, 190, ["width", "gapB"]],
    ["300–500: нет gapB", 300, 500, ["gapA", "width"]],
    ["0–500: только ширина", 0, 500, ["width"]],
  ] as const)("CD-05: %s — на каждой грани остаются только перечисленные размеры", (_name, from, to, targets) => {
    const list = chainOf([W()], from, to)
    for (const s of [1, -1] as const) expect(list.filter((d) => d.side === s).map((d) => d.target)).toEqual(targets)
  })

  it("CD-05: у каждого оставшегося размера есть геометрия, а текст не «0»", () => {
    for (const d of chainOf([W()], 0, 190)) {
      expect(d.geom).not.toBeNull()
      expect(d.text).not.toBe("0")
      expect(d.valueCm).toBeGreaterThan(0)
    }
  })

  it("CD-05: отступ меньше допуска нуля (1e-7 см) считается нулевым: gapA опущен", () => {
    expect(chainOf([W()], 1e-7, 190).some((d) => d.target === "gapA")).toBe(false)
  })

  it("CD-05: малый отступ 3 см не опускается: gapA «3» с геометрией", () => {
    const first = chainOf([W()], 3, 190)[0]
    expect(first?.target).toBe("gapA")
    expect(first?.text).toBe("3")
    expect(first?.geom).not.toBeNull()
  })

  it("CD-05: отступ меньше сантиметра (0,6 см) не нулевой и не опускается: gapA «1» с геометрией, ширина и gapB на месте", () => {
    const list = chainOf([W()], 0.6, 190.6)
    expect(list.filter((d) => d.side === 1).map((d) => d.target)).toEqual(["gapA", "width", "gapB"])
    expect(list[0]?.geom).not.toBeNull()
    expect(list[0]?.text).toBe("1")
  })
  it("CD-07: комната, пометка на всю стену: на грани +1 один размер 480 между стыками 10 и 490, на грани −1 — 520 между −10 и 510", () => {
    const list = chainOf(room(), 0, 500)
    expect(summary(list)).toEqual([
      [1, "width", "480"],
      [-1, "width", "520"],
    ])
    expect([list[0]?.fromCm, list[0]?.toCm]).toEqual([10, 490])
    expect([list[1]?.fromCm, list[1]?.toCm]).toEqual([-10, 510])
  })

  it("CD-04: комната, пометка 100–190: грань +1 — 90, 90, 300 между стыками 10 и 490, грань −1 — 110, 90, 320 между −10 и 510", () => {
    const list = chainOf(room(), 100, 190)
    expect(list.map((d) => d.text)).toEqual(["90", "90", "300", "110", "90", "320"])
    expect(list.map((d) => [d.fromCm, d.toCm])).toEqual([[10, 100], [100, 190], [190, 490], [-10, 100], [100, 190], [190, 510]])
  })

  it("CD-04: инвариант: gapA + ширина + gapB равны длине участка грани между стыками, значения не отрицательны", () => {
    for (const [ws, from, to, lengths] of [
      [[W()], 100, 190, { 1: 500, [-1]: 500 }],
      [room(), 100, 190, { 1: 480, [-1]: 520 }],
      [room(), 20, 480, { 1: 480, [-1]: 520 }],
    ] as const) {
      const list = chainOf(ws, from, to)
      for (const s of [1, -1] as const) {
        const sum = list.filter((d) => d.side === s).reduce((acc, d) => acc + d.valueCm, 0)
        expect(sum).toBeCloseTo(lengths[s], 6)
      }
      for (const d of list) expect(d.valueCm).toBeGreaterThan(0)
    }
  })

  it("CD-12: пометка 296–301 в разрыве у Т-примыкания: на грани +1 остаётся только gapA 285 (W = 0 и B = 0 опущены), на грани −1 — 306, 5, 209", () => {
    const list = chainOf(withT(), 296, 301)
    expect(summary(list)).toEqual([
      [1, "gapA", "285"],
      [-1, "gapA", "306"],
      [-1, "width", "5"],
      [-1, "gapB", "209"],
    ])
  })

  it("CD-19: единицы меняют только текст: в м — «1», «0,9», «3,1»; в мм — «1000», «900», «3100»; геометрия та же", () => {
    const cm = chainOf([W()], 100, 190)
    const m = chainOf([W()], 100, 190, "m")
    const mm = chainOf([W()], 100, 190, "mm")
    expect(m.slice(0, 3).map((d) => d.text)).toEqual(["1", "0,9", "3,1"])
    expect(mm.slice(0, 3).map((d) => d.text)).toEqual(["1000", "900", "3100"])
    expect(m.map((d) => d.geom)).toEqual(cm.map((d) => d.geom))
    expect(mm.map((d) => d.geom)).toEqual(cm.map((d) => d.geom))
  })

  it("CD-10: цепочки пометок одной стены независимы: 100–200 даёт 100, 100, 300, а 250–300 даёт 250, 50, 200 (не зависят от соседней)", () => {
    const w = W()
    const first = markDimensions({ wall: w, from: 100, to: 200 }, [w], "chain", "cm", K, LABEL)
    const second = markDimensions({ wall: w, from: 250, to: 300 }, [w], "chain", "cm", K, LABEL)
    expect(first.slice(0, 3).map((d) => d.text)).toEqual(["100", "100", "300"])
    expect(second.slice(0, 3).map((d) => d.text)).toEqual(["250", "50", "200"])
  })

  it("CD-20: направление стены: на обратной стене (500,0)→(0,0) участок 100–190 от конца a лежит между x = 400 и 310 на гранях y = −10 (+1) и y = 10 (−1)", () => {
    const rev = wall(500, 0, 0, 0, "W")
    const list = markDimensions({ wall: rev, from: 100, to: 190 }, [rev], "chain", "cm", K, LABEL)
    const widths = list.filter((d) => d.target === "width")
    expect(widths.map((d) => d.side)).toEqual([1, -1])
    const plus = widths[0]?.geom
    const minus = widths[1]?.geom
    if (!plus || !minus) throw new Error("ожидалась геометрия")
    expect(plus.a.y).toBeCloseTo(-10, 6)
    expect(plus.a.x).toBeCloseTo(400, 6)
    expect(plus.b.x).toBeCloseTo(310, 6)
    expect(minus.a.y).toBeCloseTo(10, 6)
  })

  it("CD-20: смещение линии размера от грани — CHAIN_OFFSET_EM · кегль / k в сторону своей грани", () => {
    const off = (CHAIN_OFFSET_EM * LABEL) / K
    const list = chainOf([W()], 100, 190)
    expect(list[1]?.geom?.p1.y).toBeCloseTo(10 + off, 9)
    expect(list[4]?.geom?.p1.y).toBeCloseTo(-10 - off, 9)
  })

  it("CD-25: вход (пометка и стены) не мутируется: заморозка не вызывает ошибки", () => {
    const w = deepFreeze(W())
    const walls = deepFreeze([w])
    expect(() => markDimensions(deepFreeze({ wall: w, from: 0, to: 190 }), walls, "chain", "cm", K, LABEL)).not.toThrow()
  })
})

describe("нулевые числа не кликабельны (CD-24)", () => {
  it("CD-24: у пометки 0–190 в точке, где стояло бы число «0» (x = 0 над линией размера), число не находится", () => {
    const list = chainOf([W()], 0, 190)
    const spots = list.map((d) => d.spot)
    const off = (CHAIN_OFFSET_EM * LABEL) / K
    const lift = LABEL / 2 / K
    expect(markNumberAt({ x: 0, y: 10 + off - lift }, spots, 0)).toBeNull()
    expect(markNumberAt({ x: 0, y: -10 - off - lift }, spots, 0)).toBeNull()
  })

  it("CD-24: попадание в центр каждого оставшегося числа возвращает его же", () => {
    const list = chainOf([W()], 0, 190)
    for (const d of list) expect(markNumberAt(d.spot.center, list.map((x) => x.spot), 0)).toBe(d.spot)
  })
})

describe("участок у стыка правится другим числом (CD-13)", () => {
  const free = [W()]
  const marks = (): DemolitionMark[] => [mk("m", "W", "a", 0, 190)]
  const spanOfMark = (list: readonly DemolitionMark[] | undefined, id = "m"): [number, number] | null => {
    const m = list?.find((x) => x.id === id)
    const w = free[0]
    return m && w ? span(m, w) : null
  }

  it("CD-13: пометка 0–190 (gapA нулевой и не показан), gapB = 100 → участок 210–400 (ширина 190 сохранена), gapA снова показан", () => {
    const result = editNumber(marks(), free, "m", "gapB", 1, 100)
    expect(spanOfMark(result?.marks)).toEqual([210, 400])
    const w = free[0]
    const m = result?.marks.find((x) => x.id === "m")
    if (!w || !m) throw new Error("нет пометки после правки")
    const list = effectiveMarks(result?.marks ?? [], free).filter((r) => r.mark.id === "m")
    expect(list).toHaveLength(1)
    const dims = markDimensions(list[0] as MarkSpan, free, "chain", "cm", K, LABEL)
    expect(dims.filter((d) => d.side === 1).map((d) => [d.target, d.text])).toEqual([["gapA", "210"], ["width", "190"], ["gapB", "100"]])
  })

  it("CD-13: ширина тоже правит прижатую пометку: 0–190, ширина 250 → 0–250, gapA остаётся нулевым и опущенным", () => {
    const result = editNumber(marks(), free, "m", "width", 1, 250)
    expect(spanOfMark(result?.marks)).toEqual([0, 250])
  })

  it("CD-13: недопустимый ввод у прижатой пометки ничего не меняет: gapB = −5 → null", () => {
    expect(editNumber(marks(), free, "m", "gapB", 1, -5)).toBeNull()
  })
})
