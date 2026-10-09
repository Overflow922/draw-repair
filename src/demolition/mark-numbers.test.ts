import { describe, expect, it } from "vitest"
import type { DemolitionMark } from "../types"
import { W, deepFreeze, mk, wall } from "./demolition.test-utils"
import { span } from "./marks"
import { editNumber, markNumberAt } from "./mark-numbers"
import type { MarkNumberSpot } from "./mark-numbers"

// change demolition-plan: числа участка (spec demolition-plan «Выделение пометки и правка чисел на месте»;
// design D5). Стена W — (0,0)-(500,0), кирпич, 20 см; расстояния — от конца a.
// TCR-1 (change demolition-doorway-sizes): editNumber получает сторону грани (1 — свободная стена: оба участка грани
// [0, 500], значения прежние); тесты numbersOf удалены вместе с функцией (их содержание — SZ-01, SZ-02 в
// mark-chains.test.ts), тесты раскладки чисел перенесены на markDimensions (mark-dimensions.test.ts).

const walls = [W()]
const base = (): DemolitionMark[] => [mk("m", "W", "a", 100, 190)]

const result = (marks: readonly DemolitionMark[], which: "gapA" | "width" | "gapB", value: number, ws = walls) => editNumber(marks, ws, "m", which, 1, value)

describe("editNumber: допустимые значения", () => {
  it("NU-01: расстояние от a = 150 сдвигает участок с сохранением ширины: 150–240", () => {
    expect(result(base(), "gapA", 150)).toEqual({ marks: [mk("m", "W", "a", 150, 240)], id: "m" })
  })

  it("NU-02: расстояние до b = 50 сдвигает участок: 360–450 (привязка b, 50…140)", () => {
    expect(result(base(), "gapB", 50)).toEqual({ marks: [mk("m", "W", "b", 50, 140)], id: "m" })
  })

  it("NU-03: ширина 200 сохраняет начало: 100–300", () => {
    expect(result(base(), "width", 200)).toEqual({ marks: [mk("m", "W", "a", 100, 300)], id: "m" })
  })

  it("NU-04: ширина 900 принимается как наибольшая допустимая: 100–500 (привязка b, 0…400)", () => {
    expect(result(base(), "width", 900)).toEqual({ marks: [mk("m", "W", "b", 0, 400)], id: "m" })
  })

  it("NU-05: расстояние от a = 900 принимается как наибольшее допустимое: 410–500", () => {
    expect(result(base(), "gapA", 900)).toEqual({ marks: [mk("m", "W", "b", 0, 90)], id: "m" })
  })

  it("NU-05: расстояние до b = 900 принимается как наибольшее допустимое: 0–90", () => {
    expect(result(base(), "gapB", 900)).toEqual({ marks: [mk("m", "W", "a", 0, 90)], id: "m" })
  })

  it("NU-05: граничные допустимые: gapA = 0 → 0–90; gapA = L − W = 410 → 410–500", () => {
    expect(result(base(), "gapA", 0)?.marks).toEqual([mk("m", "W", "a", 0, 90)])
    expect(result(base(), "gapA", 410)?.marks).toEqual([mk("m", "W", "b", 0, 90)])
  })

  it("NU-05: граничная ширина — ровно L − from принимается без зажима", () => {
    expect(result(base(), "width", 400)?.marks).toEqual([mk("m", "W", "b", 0, 400)])
  })

  it("NU-03: ширина ровно 1 см принимается: 100–101", () => {
    expect(result(base(), "width", 1)?.marks).toEqual([mk("m", "W", "a", 100, 101)])
  })

  it("NU-01: правка не меняет другие пометки списка", () => {
    const list = [mk("x", "W", "a", 400, 450), mk("m", "W", "a", 100, 190)]
    const next = editNumber(list, walls, "m", "gapA", 1, 150)
    expect(next?.marks).toEqual([mk("x", "W", "a", 400, 450), mk("m", "W", "a", 150, 240)])
  })
})

describe("editNumber: недопустимый ввод", () => {
  it.each([
    ["не число", "gapA", Number.NaN],
    ["бесконечность", "width", Number.POSITIVE_INFINITY],
    ["отрицательный отступ от a", "gapA", -1],
    ["отрицательный отступ до b", "gapB", -0.5],
    ["ширина 0", "width", 0],
    ["ширина меньше 1 см", "width", 0.99],
    ["отрицательная ширина", "width", -10],
  ] as const)("NU-06: %s → null", (_name, which, value) => {
    expect(result(base(), which, value)).toBeNull()
  })

  it("NU-06: неизвестный идентификатор → null", () => {
    expect(editNumber(base(), walls, "zzz", "gapA", 1, 150)).toBeNull()
  })

  it("NU-06: пометка на железобетонной стене (не действует) → null", () => {
    expect(result(base(), "gapA", 150, [W("reinforced")])).toBeNull()
  })

  it("NU-06: пометка на отсутствующую стену → null", () => {
    expect(result(base(), "gapA", 150, [])).toBeNull()
  })

  it("NU-06: вход не мутируется ни при успехе, ни при отказе", () => {
    const list = deepFreeze(base())
    const frozen = deepFreeze([W()])
    expect(() => editNumber(list, frozen, "m", "gapA", 1, 150)).not.toThrow()
    expect(() => editNumber(list, frozen, "m", "gapA", 1, -1)).not.toThrow()
  })
})

describe("editNumber: слияние после правки", () => {
  it("NU-07: ширина первого становится 200 и перекрывает второй — остаётся один участок 100–300, идентификатор m", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("m2", "W", "a", 250, 300)]
    expect(editNumber(list, walls, "m", "width", 1, 200)).toEqual({ marks: [mk("m", "W", "a", 100, 300)], id: "m" })
  })

  it("NU-07: сдвиг влево на соседа: слитая пометка (id — первой слитой по порядку списка) присутствует в результате под возвращённым id", () => {
    const list = [mk("m2", "W", "a", 10, 50), mk("m", "W", "a", 100, 190)]
    const out = editNumber(list, walls, "m", "gapA", 1, 40) // 40–130 пересекает 10–50
    expect(out).not.toBeNull()
    expect(out?.marks).toHaveLength(1)
    expect(out?.marks[0]?.id).toBe(out?.id)
    expect(out?.marks[0] ? span(out.marks[0], W()) : null).toEqual([10, 130])
  })

  it("NU-07: правка, не вызывающая пересечения, не сливает: остаётся два участка", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("m2", "W", "a", 300, 350)]
    expect(editNumber(list, walls, "m", "width", 1, 100)?.marks).toHaveLength(2)
  })

  it("NU-07: касание после правки сливает: 100–200 и 200–300", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("m2", "W", "a", 200, 300)]
    expect(editNumber(list, walls, "m", "width", 1, 100)).toEqual({ marks: [mk("m", "W", "a", 100, 300)], id: "m" })
  })

  it("NU-07: пометки других стен не затрагиваются", () => {
    const two = [W(), wall(0, 100, 500, 100, "V")]
    const list = [mk("v", "V", "a", 100, 250), mk("m", "W", "a", 100, 190)]
    const out = editNumber(list, two, "m", "width", 1, 200)
    expect(out?.marks).toEqual([mk("v", "V", "a", 100, 250), mk("m", "W", "a", 100, 300)])
  })
})

describe("markNumberAt", () => {
  const spot: MarkNumberSpot = { side: 1, target: "width", text: "90", valueCm: 90, center: { x: 100, y: 20 }, dir: { x: 1, y: 0 }, widthCm: 10, heightCm: 6 }
  const other: MarkNumberSpot = { ...spot, target: "gapA", text: "100", valueCm: 100, center: { x: 108, y: 20 } }

  it("NU-10: точка в центре попадает", () => {
    expect(markNumberAt({ x: 100, y: 20 }, [spot], 1)).toBe(spot)
  })

  it("NU-10: точка в пределах прямоугольника с допуском попадает, за допуском — нет", () => {
    expect(markNumberAt({ x: 105.9, y: 20 }, [spot], 1)).toBe(spot)
    expect(markNumberAt({ x: 106.1, y: 20 }, [spot], 1)).toBeNull()
    expect(markNumberAt({ x: 100, y: 23.9 }, [spot], 1)).toBe(spot)
    expect(markNumberAt({ x: 100, y: 24.1 }, [spot], 1)).toBeNull()
  })

  it("NU-10: из двух накладывающихся выбирается число с ближайшим центром", () => {
    expect(markNumberAt({ x: 105, y: 20 }, [spot, other], 1)).toBe(other)
    expect(markNumberAt({ x: 103, y: 20 }, [spot, other], 1)).toBe(spot)
  })

  it("NU-10: пустой список — null", () => {
    expect(markNumberAt({ x: 100, y: 20 }, [], 1)).toBeNull()
  })

  it("NU-10: прямоугольник учитывает направление текста (повёрнутый вдоль y)", () => {
    const rotated: MarkNumberSpot = { ...spot, dir: { x: 0, y: 1 } }
    expect(markNumberAt({ x: 100, y: 25 }, [rotated], 0)).toBe(rotated)
    expect(markNumberAt({ x: 105, y: 20 }, [rotated], 0)).toBeNull()
  })
})
