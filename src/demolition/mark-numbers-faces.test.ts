import { describe, expect, it } from "vitest"
import type { DemolitionMark, Wall } from "../types"
import { W, deepFreeze, mk, wall } from "./demolition.test-utils"
import { editNumber } from "./mark-numbers"
import { span } from "./marks"

// change demolition-doorway-sizes: правка чисел по граням (spec demolition-plan «Выделение пометки и правка чисел на
// месте»; design D2). Расстояние на грани измеряется вдоль грани от стыка до границы участка; правка расстояния
// сдвигает участок, правка ширины сохраняет начало. Сравниваются границы по оси (span), а не запись пометки.

const room = (): Wall[] => [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]
const withT = (): Wall[] => [...room(), wall(300, 10, 300, 400, "P", "brick", 10)]
const free = (): Wall[] => [W()]
const base = (): DemolitionMark[] => [mk("m", "W", "a", 100, 190)]

type Which = "gapA" | "width" | "gapB"

// границы по оси пометок на стене W
function spans(marks: readonly DemolitionMark[] | undefined, walls: readonly Wall[]): [number, number][] {
  const w = walls.find((x) => x.id === "W")
  if (!w || !marks) return []
  return marks.filter((m) => m.wallId === "W").map((m) => span(m, w))
}

function edit(walls: Wall[], which: Which, side: 1 | -1, value: number, marks: DemolitionMark[] = base()) {
  return editNumber(marks, walls, "m", which, side, value)
}

describe("правка расстояний по граням (комната с замкнутыми углами)", () => {
  it("SZ-20: расстояние на внутренней грани (+1) в сторону a = 150 → участок 160–250 (от стыка 10)", () => {
    expect(spans(edit(room(), "gapA", 1, 150)?.marks, room())).toEqual([[160, 250]])
  })

  it("SZ-20: то же на наружной грани (−1): от стыка −10 → участок 140–230", () => {
    expect(spans(edit(room(), "gapA", -1, 150)?.marks, room())).toEqual([[140, 230]])
  })

  it("SZ-20: ширина участка вдоль оси сохраняется при правке расстояния", () => {
    for (const side of [1, -1] as const) {
      const [s] = spans(edit(room(), "gapA", side, 77)?.marks, room())
      expect(s ? s[1] - s[0] : null).toBeCloseTo(90, 9)
    }
  })

  it("SZ-21: расстояние до стыка в сторону b на грани +1 = 50 → участок 350–440 (стык 490)", () => {
    expect(spans(edit(room(), "gapB", 1, 50)?.marks, room())).toEqual([[350, 440]])
  })

  it("SZ-21: то же на грани −1 (стык 510) → участок 370–460", () => {
    expect(spans(edit(room(), "gapB", -1, 50)?.marks, room())).toEqual([[370, 460]])
  })

  it("SZ-23: ширина на грани +1 = 120 при участке 100–190 → 100–220 (начало 100 сохранено)", () => {
    expect(spans(edit(room(), "width", 1, 120)?.marks, room())).toEqual([[100, 220]])
    expect(spans(edit(room(), "width", -1, 120)?.marks, room())).toEqual([[100, 220]])
  })

  it("SZ-23: пометка на всю стену, ширина на грани +1 = 100 → 0–110 (начало на стыке 10), на грани −1 → 0–90 (начало на стыке −10)", () => {
    const whole = [mk("m", "W", "a", 0, 500)]
    expect(spans(edit(room(), "width", 1, 100, whole)?.marks, room())).toEqual([[0, 110]])
    expect(spans(edit(room(), "width", -1, 100, whole)?.marks, room())).toEqual([[0, 90]])
  })

  it("SZ-23: ширина, уводящая конец левее начала, принимается как наименьшая допустимая — 1 см", () => {
    const whole = [mk("m", "W", "a", 0, 500)]
    expect(spans(edit(room(), "width", -1, 5, whole)?.marks, room())).toEqual([[0, 1]])
  })

  it("SZ-20: возвращается идентификатор пометки", () => {
    expect(edit(room(), "gapA", 1, 150)?.id).toBe("m")
  })
})

describe("правка на свободной стене совпадает с осевой", () => {
  it.each([1, -1] as const)("SZ-22: грань %i: gapA 150 → 150–240, gapB 50 → 360–450, ширина 200 → 100–300", (side) => {
    expect(spans(edit(free(), "gapA", side, 150)?.marks, free())).toEqual([[150, 240]])
    expect(spans(edit(free(), "gapB", side, 50)?.marks, free())).toEqual([[360, 450]])
    expect(spans(edit(free(), "width", side, 200)?.marks, free())).toEqual([[100, 300]])
  })
})

describe("Т-примыкание делит грань", () => {
  it("SZ-27: расстояние до стыка в сторону b на грани +1 = 50 → участок 155–245 (стык 295)", () => {
    expect(spans(edit(withT(), "gapB", 1, 50)?.marks, withT())).toEqual([[155, 245]])
  })

  it("SZ-27: расстояние в сторону a на грани +1 = 20 → участок 30–120 (стык 10)", () => {
    expect(spans(edit(withT(), "gapA", 1, 20)?.marks, withT())).toEqual([[30, 120]])
  })

  it("SZ-27: на грани −1 перегородки нет: gapB = 50 → 370–460", () => {
    expect(spans(edit(withT(), "gapB", -1, 50)?.marks, withT())).toEqual([[370, 460]])
  })
})

describe("допустимые значения по граням", () => {
  it("SZ-24: расстояние от a за стеной принимается ближайшим допустимым: gapA 900 → 410–500", () => {
    expect(spans(edit(room(), "gapA", 1, 900)?.marks, room())).toEqual([[410, 500]])
  })

  it("SZ-24: расстояние до b за стеной: gapB 900 → 0–90", () => {
    expect(spans(edit(room(), "gapB", 1, 900)?.marks, room())).toEqual([[0, 90]])
  })

  it("SZ-24: gapA = 0 на наружной грани (стык −10) даёт from' = −10 → зажимается до 0 → 0–90", () => {
    expect(spans(edit(room(), "gapA", -1, 0)?.marks, room())).toEqual([[0, 90]])
  })

  it("SZ-24: gapA = 0 на внутренней грани (стык 10) → 10–100 без зажима", () => {
    expect(spans(edit(room(), "gapA", 1, 0)?.marks, room())).toEqual([[10, 100]])
  })

  it("SZ-24: расстояние до стыка b = 0: на грани +1 (стык 490) → 400–490, на грани −1 (стык 510) → to' = 510 зажимается до 500 → 410–500", () => {
    expect(spans(edit(room(), "gapB", 1, 0)?.marks, room())).toEqual([[400, 490]])
    expect(spans(edit(room(), "gapB", -1, 0)?.marks, room())).toEqual([[410, 500]])
  })

  it("SZ-24: ширина за стеной: 900 → 100–500", () => {
    expect(spans(edit(room(), "width", 1, 900)?.marks, room())).toEqual([[100, 500]])
  })

  it("SZ-24: ширина ровно 1 см принимается: 100–101", () => {
    expect(spans(edit(room(), "width", 1, 1)?.marks, room())).toEqual([[100, 101]])
  })
})

describe("недопустимый ввод и вход", () => {
  it.each([
    ["не число", "gapA", Number.NaN],
    ["бесконечность", "width", Number.POSITIVE_INFINITY],
    ["отрицательное расстояние до a", "gapA", -1],
    ["отрицательное расстояние до b", "gapB", -0.5],
    ["ширина 0", "width", 0],
    ["ширина меньше 1 см", "width", 0.99],
    ["отрицательная ширина", "width", -10],
  ] as const)("SZ-25: %s → null на обеих гранях", (_name, which, value) => {
    expect(edit(room(), which, 1, value)).toBeNull()
    expect(edit(room(), which, -1, value)).toBeNull()
  })

  it("SZ-25: неизвестный идентификатор → null", () => {
    expect(editNumber(base(), room(), "zzz", "gapA", 1, 150)).toBeNull()
  })

  it("SZ-25: пометка на железобетонной стене → null", () => {
    expect(edit([W("reinforced")], "gapA", 1, 150)).toBeNull()
  })

  it("SZ-25: вход не мутируется ни при успехе, ни при отказе", () => {
    const list = deepFreeze(base())
    const frozen = deepFreeze(room())
    expect(() => editNumber(list, frozen, "m", "gapA", 1, 150)).not.toThrow()
    expect(() => editNumber(list, frozen, "m", "gapA", 1, -1)).not.toThrow()
  })
})

describe("слияние после правки по граням", () => {
  it("SZ-26: ширина первого на грани +1 становится 200 и перекрывает второй: остаётся 100–300, идентификатор m", () => {
    const list = [mk("m", "W", "a", 100, 190), mk("m2", "W", "a", 250, 300)]
    const out = edit(room(), "width", 1, 200, list)
    expect(spans(out?.marks, room())).toEqual([[100, 300]])
    expect(out?.id).toBe("m")
  })

  it("SZ-26: сдвиг на грани −1 на соседа: слитая пометка присутствует под возвращённым идентификатором", () => {
    const list = [mk("m2", "W", "a", 10, 50), mk("m", "W", "a", 100, 190)]
    const out = edit(room(), "gapA", -1, 50, list) // from' = −10 + 50 = 40 → 40–130 пересекает 10–50
    expect(out?.marks).toHaveLength(1)
    expect(out?.marks[0]?.id).toBe(out?.id)
    expect(spans(out?.marks, room())).toEqual([[10, 130]])
  })

  it("SZ-26: правка не меняет другие пометки и пометки других стен", () => {
    const two = [...room(), wall(0, 100, 500, 100, "V")]
    const list = [mk("v", "V", "a", 100, 250), mk("x", "W", "a", 400, 450), mk("m", "W", "a", 100, 190)]
    const out = editNumber(list, two, "m", "gapA", 1, 150)
    expect(out?.marks.find((m) => m.id === "v")).toEqual(mk("v", "V", "a", 100, 250))
    expect(out?.marks.find((m) => m.id === "x")).toEqual(mk("x", "W", "a", 400, 450))
  })
})
