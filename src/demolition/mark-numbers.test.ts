import { describe, expect, it } from "vitest"
import { CHAIN_OFFSET_EM, DIM_TEXT_GAP_PX } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import type { DemolitionMark } from "../types"
import { W, deepFreeze, mk, wall } from "./demolition.test-utils"
import { effectiveMarks, span } from "./marks"
import { editNumber, markLabelSpot, markNumberAt, markNumberLayout, numbersOf } from "./mark-numbers"
import type { MarkNumberSpot } from "./mark-numbers"

// change demolition-plan: числа участка (spec demolition-plan «Выделение пометки и правка чисел на месте»;
// design D5). Стена W — (0,0)-(500,0), кирпич, 20 см; расстояния — от конца a.

const walls = [W()]
const base = (): DemolitionMark[] => [mk("m", "W", "a", 100, 190)]

const result = (marks: readonly DemolitionMark[], which: "gapA" | "width" | "gapB", value: number, ws = walls) => editNumber(marks, ws, "m", which, value)

describe("numbersOf", () => {
  it("NU-12: числа участка 100–190 стены 500: отступ от a 100, ширина 90, отступ до b 310", () => {
    const [r] = effectiveMarks(base(), walls)
    expect(numbersOf(r!)).toEqual({ gapA: 100, width: 90, gapB: 310 })
  })

  it("NU-12: запись с привязкой b даёт те же числа (a-координаты 360–450)", () => {
    const [r] = effectiveMarks([mk("m", "W", "b", 50, 140)], walls)
    expect(numbersOf(r!)).toEqual({ gapA: 360, width: 90, gapB: 50 })
  })

  it("NU-12: сумма трёх чисел равна длине стены", () => {
    const [r] = effectiveMarks([mk("m", "W", "a", 37.5, 211.25)], walls)
    const n = numbersOf(r!)
    expect(n.gapA + n.width + n.gapB).toBeCloseTo(500, 9)
  })

  it("NU-12: целая стена — отступы 0", () => {
    const [r] = effectiveMarks([mk("m", "W", "a", 0, 500)], walls)
    expect(numbersOf(r!)).toEqual({ gapA: 0, width: 500, gapB: 0 })
  })
})

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
    const next = editNumber(list, walls, "m", "gapA", 150)
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
    expect(editNumber(base(), walls, "zzz", "gapA", 150)).toBeNull()
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
    expect(() => editNumber(list, frozen, "m", "gapA", 150)).not.toThrow()
    expect(() => editNumber(list, frozen, "m", "gapA", -1)).not.toThrow()
  })
})

describe("editNumber: слияние после правки", () => {
  it("NU-07: ширина первого становится 200 и перекрывает второй — остаётся один участок 100–300, идентификатор m", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("m2", "W", "a", 250, 300)]
    expect(editNumber(list, walls, "m", "width", 200)).toEqual({ marks: [mk("m", "W", "a", 100, 300)], id: "m" })
  })

  it("NU-07: сдвиг влево на соседа: слитая пометка (id — первой слитой по порядку списка) присутствует в результате под возвращённым id", () => {
    const list = [mk("m2", "W", "a", 10, 50), mk("m", "W", "a", 100, 190)]
    const out = editNumber(list, walls, "m", "gapA", 40) // 40–130 пересекает 10–50
    expect(out).not.toBeNull()
    expect(out?.marks).toHaveLength(1)
    expect(out?.marks[0]?.id).toBe(out?.id)
    expect(out?.marks[0] ? span(out.marks[0], W()) : null).toEqual([10, 130])
  })

  it("NU-07: правка, не вызывающая пересечения, не сливает: остаётся два участка", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("m2", "W", "a", 300, 350)]
    expect(editNumber(list, walls, "m", "width", 100)?.marks).toHaveLength(2)
  })

  it("NU-07: касание после правки сливает: 100–200 и 200–300", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("m2", "W", "a", 200, 300)]
    expect(editNumber(list, walls, "m", "width", 100)).toEqual({ marks: [mk("m", "W", "a", 100, 300)], id: "m" })
  })

  it("NU-07: пометки других стен не затрагиваются", () => {
    const two = [W(), wall(0, 100, 500, 100, "V")]
    const list = [mk("v", "V", "a", 100, 250), mk("m", "W", "a", 100, 190)]
    const out = editNumber(list, two, "m", "width", 200)
    expect(out?.marks).toEqual([mk("v", "V", "a", 100, 250), mk("m", "W", "a", 100, 300)])
  })
})

describe("раскладка чисел на холсте", () => {
  const K = 2 // px на см при zoom 1
  const LABEL = 14
  const lat = 10 + (CHAIN_OFFSET_EM * LABEL) / K // полутолщина + вынос цепочки
  const lift = (DIM_TEXT_GAP_PX + LABEL / 2) / K
  const [r] = effectiveMarks(base(), walls)

  it("NU-09: три числа в порядке gapA, width, gapB с текстом в сантиметрах", () => {
    const spots = markNumberLayout(r!, "cm", K, LABEL)
    expect(spots.map((s) => s.target)).toEqual(["gapA", "width", "gapB"])
    expect(spots.map((s) => s.text)).toEqual(["100", "90", "310"])
    expect(spots.map((s) => s.valueCm)).toEqual([100, 90, 310])
  })

  it("NU-08: текст — в текущей единице: м (запятая) и мм", () => {
    expect(markNumberLayout(r!, "m", K, LABEL).map((s) => s.text)).toEqual(["1", "0,9", "3,1"])
    expect(markNumberLayout(r!, "mm", K, LABEL).map((s) => s.text)).toEqual(["1000", "900", "3100"])
  })

  it("NU-09: центры — середины отрезков [0,100], [100,190], [190,500] на стороне нормали (y > 0) с подъёмом над линией", () => {
    const spots = markNumberLayout(r!, "cm", K, LABEL)
    const xs = [50, 145, 345]
    spots.forEach((s, i) => {
      expect(s.center.x).toBeCloseTo(xs[i]!, 9)
      expect(s.center.y).toBeCloseTo(lat - lift, 9)
      expect(s.dir.x).toBeCloseTo(1, 9)
      expect(s.dir.y).toBeCloseTo(0, 9)
    })
  })

  it("NU-09: размеры прямоугольника числа: ширина — длина текста × кегль × CHAR_WIDTH / k, высота — кегль / k", () => {
    const spots = markNumberLayout(r!, "cm", K, LABEL)
    spots.forEach((s) => {
      expect(s.widthCm).toBeCloseTo((s.text.length * LABEL * CHAR_WIDTH) / K, 9)
      expect(s.heightCm).toBeCloseTo(LABEL / K, 9)
    })
  })

  it("NU-10: стена вдоль оси y (a=(0,0), b=(0,500)): сторона нормали (−1, 0), числа левее стены", () => {
    const vertical = [wall(0, 0, 0, 500, "W")]
    const [rv] = effectiveMarks([mk("m", "W", "a", 100, 190)], vertical)
    const spots = markNumberLayout(rv!, "cm", K, LABEL)
    const ys = [50, 145, 345]
    spots.forEach((s, i) => {
      expect(s.center.y).toBeCloseTo(ys[i]!, 9)
      expect(s.center.x).toBeLessThan(-10)
    })
  })

  it("NU-10: текст направлен слева направо (dir.x ≥ 0) у стены, идущей справа налево", () => {
    const reversed = [wall(500, 0, 0, 0, "W")]
    const [rr] = effectiveMarks([mk("m", "W", "a", 100, 190)], reversed)
    for (const s of markNumberLayout(rr!, "cm", K, LABEL)) expect(s.dir.x).toBeGreaterThan(0.99)
  })

  it("NU-11: нулевой отступ — число над точкой: dir = (1, 0), подъём половина кегля, текст «0»", () => {
    const [rz] = effectiveMarks([mk("m", "W", "a", 0, 190)], walls)
    const spot = markNumberLayout(rz!, "cm", K, LABEL)[0]!
    expect(spot.text).toBe("0")
    expect(spot.dir).toEqual({ x: 1, y: 0 })
    expect(spot.center.x).toBeCloseTo(0, 9)
    expect(spot.center.y).toBeCloseTo(lat - LABEL / 2 / K, 9)
  })

  it("NU-13: невыделенная пометка — подпись только ширины, совпадающая с числом width из раскладки", () => {
    const label = markLabelSpot(r!, "cm", K, LABEL)
    const width = markNumberLayout(r!, "cm", K, LABEL)[1]!
    expect(label).toEqual(width)
    expect(label.target).toBe("width")
    expect(label.text).toBe("90")
  })

  it("NU-09: вход не мутируется", () => {
    expect(() => markNumberLayout(deepFreeze(r!), "cm", K, LABEL)).not.toThrow()
  })
})

describe("markNumberAt", () => {
  const spot: MarkNumberSpot = { target: "width", text: "90", valueCm: 90, center: { x: 100, y: 20 }, dir: { x: 1, y: 0 }, widthCm: 10, heightCm: 6 }
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
