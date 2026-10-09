import { describe, expect, it } from "vitest"
import type { DemolitionMark, Point, Wall } from "../types"
import { idGen, mk, wall } from "./demolition.test-utils"
import { createDemolitionTool } from "./demolition-tool"
import type { DemolitionToolHost } from "./demolition-tool"
import { span } from "./marks"

// change demolition-doorway-sizes: числа выделенной пометки по граням в инструменте (spec demolition-plan «Выделение
// пометки и правка чисел на месте»; design D3, D5). Комната с замкнутыми углами: W (0,0)–(500,0) и три стены, грань
// y = 10 между стыками 10 и 490, грань y = −10 между −10 и 510. Масштаб экрана 2 px на см, кегль 14: линия размера
// на 1,2·14/2 = 8,4 см от грани, центр числа ниже линии на (1,5 + 7)/2 = 4,25 см «вверх» по экрану.

const K = 2
const LABEL = 14
const OFF = (1.2 * LABEL) / K
const LIFT = (1.5 + LABEL / 2) / K
const room = (): Wall[] => [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]

function setup(marks: DemolitionMark[] = [mk("m", "W", "a", 100, 190)]) {
  let list = marks
  const walls = room()
  let record = 0
  const host: DemolitionToolHost = {
    walls: () => walls,
    elements: () => [],
    marks: () => list,
    setMarks: (next) => {
      list = next
    },
    record: () => {
      record++
    },
    changed: () => {},
    redraw: () => {},
    radiusCm: () => 6,
    newId: idGen(),
  }
  const tool = createDemolitionTool(host)
  return { tool, marks: () => list, records: () => record, walls }
}

const at = (x: number, y: number): Point => ({ x, y })
const number = (s: ReturnType<typeof setup>, p: Point) => s.tool.numberAt(p, "cm", K, LABEL, 1)

// центры чисел: грань +1 (линия на y = 10 + OFF, число выше линии), грань −1 (линия на y = −10 − OFF)
const YP = 10 + OFF - LIFT
const YM = -10 - OFF - LIFT

describe("числа выделенной пометки по граням", () => {
  it("SZ-47: без выделения чисел нет: numberAt по месту числа — null", () => {
    const s = setup()
    expect(number(s, at(145, YP))).toBeNull()
  })

  it("SZ-47: у невыделенной пометки (выделена другая) числа не правятся", () => {
    const s = setup([mk("m", "W", "a", 100, 190), mk("n", "W", "a", 300, 350)])
    s.tool.select({ x: 325, y: 0 })
    expect(number(s, at(145, YP))).toBeNull()
  })

  it("SZ-30: грань +1: число ширины (центр x = 145) находится с целью width и стороной 1; значение 90", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    expect(number(s, at(145, YP))).toMatchObject({ target: "width", side: 1, valueCm: 90 })
  })

  it("SZ-30: грань +1: число gapA (центр x = 55 — между стыком 10 и границей 100) — цель gapA, значение 90", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    expect(number(s, at(55, YP))).toMatchObject({ target: "gapA", side: 1, valueCm: 90 })
  })

  it("SZ-30: грань +1: число gapB (центр x = 340) — цель gapB, значение 300", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    expect(number(s, at(340, YP))).toMatchObject({ target: "gapB", side: 1, valueCm: 300 })
  })

  it("SZ-31: грань −1: числа gapA (центр x = 45), width (145), gapB (350) со значениями 110, 90, 320", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    expect(number(s, at(45, YM))).toMatchObject({ target: "gapA", side: -1, valueCm: 110 })
    expect(number(s, at(145, YM))).toMatchObject({ target: "width", side: -1, valueCm: 90 })
    expect(number(s, at(350, YM))).toMatchObject({ target: "gapB", side: -1, valueCm: 320 })
  })

  it("SZ-31: точка на размерной линии между числами и мимо чисел — null", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    expect(number(s, at(110, 10 + OFF))).toBeNull()
    expect(number(s, at(110, -10 - OFF))).toBeNull()
    expect(number(s, at(250, 100))).toBeNull()
  })
})

describe("применение чисел по граням в инструменте", () => {
  it("SZ-32: gapA на грани −1 = 150 → участок 140–230 одним шагом истории, пометка остаётся выделенной", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.applyNumber({ target: "gapA", side: -1 }, 150)).toBe(true)
    const [m] = s.marks()
    expect(m ? span(m, s.walls[0] as Wall) : null).toEqual([140, 230])
    expect(s.records()).toBe(1)
    expect(s.tool.selectedId()).toBe("m")
  })

  it("SZ-32: gapA на грани +1 = 150 → 160–250: сторона грани учитывается (результат отличается от грани −1)", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    s.tool.applyNumber({ target: "gapA", side: 1 }, 150)
    const [m] = s.marks()
    expect(m ? span(m, s.walls[0] as Wall) : null).toEqual([160, 250])
  })

  it("SZ-32: gapB на грани +1 = 50 → 350–440; gapB на грани −1 = 50 → 370–460", () => {
    const plus = setup()
    plus.tool.select({ x: 150, y: 0 })
    plus.tool.applyNumber({ target: "gapB", side: 1 }, 50)
    expect(plus.marks()[0] ? span(plus.marks()[0] as DemolitionMark, plus.walls[0] as Wall) : null).toEqual([350, 440])
    const minus = setup()
    minus.tool.select({ x: 150, y: 0 })
    minus.tool.applyNumber({ target: "gapB", side: -1 }, 50)
    expect(minus.marks()[0] ? span(minus.marks()[0] as DemolitionMark, minus.walls[0] as Wall) : null).toEqual([370, 460])
  })

  it("SZ-32: ширина на грани −1 = 120 → 100–220", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.applyNumber({ target: "width", side: -1 }, 120)).toBe(true)
    const [m] = s.marks()
    expect(m ? span(m, s.walls[0] as Wall) : null).toEqual([100, 220])
  })

  it("SZ-32: недопустимое значение на любой грани ничего не меняет и истории не пишет", () => {
    const s = setup()
    s.tool.select({ x: 150, y: 0 })
    for (const side of [1, -1] as const) {
      expect(s.tool.applyNumber({ target: "gapA", side }, -1)).toBe(false)
      expect(s.tool.applyNumber({ target: "width", side }, 0)).toBe(false)
    }
    expect(s.records()).toBe(0)
  })

  it("SZ-32: без выделения applyNumber возвращает false на обеих гранях", () => {
    const s = setup()
    expect(s.tool.applyNumber({ target: "width", side: 1 }, 120)).toBe(false)
    expect(s.tool.applyNumber({ target: "width", side: -1 }, 120)).toBe(false)
  })
})
