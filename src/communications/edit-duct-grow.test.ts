import { describe, expect, it } from "vitest"
import { applyNumber, communicationNumbers } from "./edit"
import type { NumberField } from "./edit"
import { slideReach } from "./geometry"
import type { Direction } from "./geometry"
import type { Communication, Duct, Wall } from "../types"
import { duct, riser, w } from "./communications.test-utils"

// change fix-duct-resize-against-wall: рост воздуховода на свободное место вдоль оси
// (spec communications «Правка чисел коммуникации»; test-plan DG-*). Эталоны выводятся из спеки и геометрии сцен:
// стена толщиной 20 с осью на x = X имеет грани X − 10 и X + 10.

const WIDTH: NumberField = { kind: "width" }
const DEPTH: NumberField = { kind: "depth" }

const asDuct = (c: Communication): Duct => {
  if (c.kind !== "duct") throw new Error("ожидался воздуховод")
  return c
}
// границы тела воздуховода по его данным: [левая, правая, верхняя, нижняя]
const bounds = (c: Communication): [number, number, number, number] => {
  const d = asDuct(c)
  return [d.x - d.widthCm / 2, d.x + d.widthCm / 2, d.y - d.depthCm / 2, d.y + d.depthCm / 2]
}
const reach = (c: Communication, dir: Direction, walls: readonly Wall[]): number | null => slideReach(c, dir, walls)?.distanceCm ?? null

// вертикальные стены с гранями, обращёнными к воздуховоду, на x = faceLeft и x = faceRight
const vertical = (faceLeft: number, faceRight: number): Wall[] => [w(faceLeft - 10, -500, faceLeft - 10, 500, "L"), w(faceRight + 10, -500, faceRight + 10, 500, "R")]
// горизонтальные стены с гранями на y = faceTop и y = faceBottom
const horizontal = (faceTop: number, faceBottom: number): Wall[] => [w(-500, faceTop - 10, 500, faceTop - 10, "T"), w(-500, faceBottom + 10, 500, faceBottom + 10, "B")]

describe("рост ширины воздуховода на свободное место", () => {
  it("DG-01: свободно по 50 см с обеих сторон — ширина 30 → 60 растёт поровну, центр прежний, расстояния по 35", () => {
    const walls = vertical(35, 165)
    const r = applyNumber(duct(100, 100), WIDTH, 60, walls, [])
    expect(r.changed).toBe(true)
    expect(bounds(r.communication)).toEqual([70, 130, 90, 110])
    expect(reach(r.communication, "left", walls)).toBeCloseTo(35, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(35, 4)
  })

  it("DG-02: воздуховод 300 × 200 прижат слева (0) и снизу (0), справа 113 — ввод 413 применяется целиком, центр +56,5", () => {
    const walls = [...vertical(0, 413), ...horizontal(-1000, 200)]
    const start = duct(150, 100, 300, 200)
    const r = applyNumber(start, WIDTH, 413, walls, [])
    expect(r.changed).toBe(true)
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(413, 4)
    expect(d.depthCm).toBe(200)
    expect(d.x).toBeCloseTo(206.5, 4)
    expect(d.y).toBe(100)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "down", walls)).toBeCloseTo(0, 4)
  })

  it("DG-02b: то же зеркально — воздуховод прижат справа, свободно слева 113 → ширина 413, центр 56,5 влево", () => {
    const walls = vertical(0, 413)
    const r = applyNumber(duct(263, 100, 300, 200), WIDTH, 413, walls, [])
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(413, 4)
    expect(d.x).toBeCloseTo(206.5, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(0, 4)
  })

  it("DG-03: слева 5 см, справа 100 — ширина 30 → 60: слева касание, справа 75, центр +10", () => {
    const walls = vertical(80, 215)
    const r = applyNumber(duct(100, 100), WIDTH, 60, walls, [])
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(60, 4)
    expect(d.x).toBeCloseTo(110, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(75, 4)
  })

  it("DG-03b: то же зеркально — слева 100, справа 5: касание справа, слева 75, центр 10 влево", () => {
    const walls = vertical(-15, 120)
    const r = applyNumber(duct(100, 100), WIDTH, 60, walls, [])
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(60, 4)
    expect(d.x).toBeCloseTo(90, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(75, 4)
  })

  it("DG-03c: свободно ровно по 15 см — ширина +30 растёт поровну, центр прежний, обе стороны касаются", () => {
    const walls = vertical(70, 130)
    const r = applyNumber(duct(100, 100), WIDTH, 60, walls, [])
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(60, 4)
    expect(d.x).toBeCloseTo(100, 4)
  })

  it("DG-03d: слева 5, справа 25 — ширина +30 занимает всё место, обе стороны касаются", () => {
    const walls = vertical(80, 140)
    const r = applyNumber(duct(100, 100), WIDTH, 60, walls, [])
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(60, 4)
    expect(d.x).toBeCloseTo(110, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(0, 4)
  })

  it("DG-05: слева касание, справа 113 — ввод на 200 больше ограничен местом: ширина +113, касание с обеих сторон", () => {
    const walls = vertical(85, 228)
    const r = applyNumber(duct(100, 100), WIDTH, 230, walls, [])
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(143, 4)
    expect(d.x).toBeCloseTo(156.5, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(0, 4)
    // число показывает фактическое значение, а не запрошенное
    const shown = communicationNumbers(r.communication, walls).find((n) => n.field.kind === "width")
    expect(shown?.valueCm).toBeCloseTo(143, 4)
  })

  it("DG-05b: границы места — 413,01 даёт 413, 412,99 применяется целиком (справа остаётся 0,01)", () => {
    const walls = vertical(0, 413)
    const start = duct(150, 100, 300, 200)
    const over = asDuct(applyNumber(start, WIDTH, 413.01, walls, []).communication)
    expect(over.widthCm).toBeCloseTo(413, 4)
    const under = applyNumber(start, WIDTH, 412.99, walls, [])
    expect(under.changed).toBe(true)
    expect(asDuct(under.communication).widthCm).toBeCloseTo(412.99, 4)
    expect(reach(under.communication, "right", walls)).toBeCloseTo(0.01, 4)
  })

  it("DG-06: слева касание, справа в 40 см стоит стояк — ширина +100 ограничена: +40, касание стояка", () => {
    const walls = vertical(85, 5000)
    const blocker = riser(160, 100, 10, "r9") // левый край x = 155
    const r = applyNumber(duct(100, 100), WIDTH, 130, walls, [blocker])
    const d = asDuct(r.communication)
    expect(d.widthCm).toBeCloseTo(70, 4)
    const [, right] = bounds(r.communication)
    expect(right).toBeCloseTo(155, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
  })

  it("DG-06b: слева другая коммуникация, справа стена — рост идёт в сторону стены до касания", () => {
    const blocker = duct(60, 100, 30, 20, "d9") // правый край x = 75
    const walls = vertical(-5000, 140)
    const r = applyNumber(duct(90, 100), WIDTH, 100, walls, [blocker]) // слева 0 (75…105), справа 35
    const [left, right] = bounds(r.communication)
    expect(left).toBeCloseTo(75, 4)
    expect(right).toBeCloseTo(140, 4)
  })

  it("DG-07: уменьшение 300 → 200 вокруг центра, расстояния растут по 50", () => {
    const walls = vertical(50, 350)
    const r = applyNumber(duct(200, 100, 300, 100), WIDTH, 200, walls, [])
    expect(r.changed).toBe(true)
    expect(bounds(r.communication)).toEqual([100, 300, 50, 150])
    expect(reach(r.communication, "left", walls)).toBeCloseTo(50, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(50, 4)
  })

  it("DG-07b: уменьшение у стены (касание слева) тоже вокруг центра: левая грань отходит от стены", () => {
    const walls = vertical(50, 5000)
    const r = applyNumber(duct(200, 100, 300, 100), WIDTH, 200, walls, [])
    expect(asDuct(r.communication).x).toBeCloseTo(200, 6)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(50, 4)
  })

  it("DG-08: обе стороны упёрты — рост не применяется, changed = false, воздуховод прежний", () => {
    const walls = vertical(85, 115)
    const start = duct(100, 100)
    const r = applyNumber(start, WIDTH, 60, walls, [])
    expect(r.changed).toBe(false)
    expect(r.communication).toEqual(start)
  })

  it("DG-08b: исходный объект не мутируется, id и вид сохраняются", () => {
    const walls = vertical(0, 413)
    const start = duct(150, 100, 300, 200, "keep")
    const r = applyNumber(start, WIDTH, 413, walls, [])
    expect(start).toEqual(duct(150, 100, 300, 200, "keep"))
    expect(r.communication.id).toBe("keep")
    expect(r.communication.kind).toBe("duct")
  })

  it("DG-08c: ширина без других стен и коммуникаций растёт от центра как введено", () => {
    const r = applyNumber(duct(100, 100), WIDTH, 80, [], [])
    expect(bounds(r.communication)).toEqual([60, 140, 90, 110])
  })

  it("DG-08d: нечисло и бесконечность для ширины не применяются", () => {
    const start = duct(100, 100)
    for (const v of [NaN, Infinity]) {
      const r = applyNumber(start, WIDTH, v, vertical(0, 413), [])
      expect(r.changed).toBe(false)
      expect(r.communication).toEqual(start)
    }
  })
})

describe("рост глубины воздуховода на свободное место", () => {
  it("DG-04: вверху касание, внизу 50 — глубина +40 уходит вниз: вверху 0, внизу 10, x прежний", () => {
    const walls = horizontal(90, 160)
    const r = applyNumber(duct(100, 100), DEPTH, 60, walls, [])
    const d = asDuct(r.communication)
    expect(d.depthCm).toBeCloseTo(60, 4)
    expect(d.widthCm).toBe(30)
    expect(d.x).toBe(100)
    expect(d.y).toBeCloseTo(120, 4)
    expect(reach(r.communication, "up", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "down", walls)).toBeCloseTo(10, 4)
  })

  it("DG-04b: внизу касание, вверху 50 — глубина +40 уходит вверх, центр 20 вверх", () => {
    const walls = horizontal(40, 110)
    const r = applyNumber(duct(100, 100), DEPTH, 60, walls, [])
    const d = asDuct(r.communication)
    expect(d.depthCm).toBeCloseTo(60, 4)
    expect(d.y).toBeCloseTo(80, 4)
    expect(d.x).toBe(100)
  })

  it("DG-04c: глубина свободна по обе стороны — растёт поровну, центр прежний", () => {
    const walls = horizontal(0, 200)
    const r = applyNumber(duct(100, 100), DEPTH, 60, walls, [])
    expect(bounds(r.communication)).toEqual([85, 115, 70, 130])
  })

  it("DG-04d: глубина ограничена местом между стенами", () => {
    const walls = horizontal(90, 130)
    const r = applyNumber(duct(100, 100), DEPTH, 500, walls, [])
    const [, , top, bottom] = bounds(r.communication)
    expect(top).toBeCloseTo(90, 4)
    expect(bottom).toBeCloseTo(130, 4)
  })
})

describe("исходное наложение и стояк", () => {
  it("DG-09: воздуховод, уже налегающий на стену слева, не углубляется в неё: левая грань остаётся, растёт вправо", () => {
    // стена с гранью x = 10, левая грань воздуховода x = 3 (наложение 7 см)
    const walls = vertical(10, 5000)
    const start = duct(18, 100)
    const r = applyNumber(start, WIDTH, 60, walls, [])
    const [left, right] = bounds(r.communication)
    expect(left).toBeCloseTo(3, 4)
    expect(right).toBeCloseTo(63, 4)
  })

  it("DG-10: диаметр стояка по-прежнему растёт от центра: у стены не растёт, хотя справа место есть", () => {
    const touch = riser(15, 100)
    const r = applyNumber(touch, { kind: "diameter" }, 30, [w(0, 0, 0, 400, "L")], [])
    expect(r.changed).toBe(false)
    expect(r.communication).toEqual(touch)
  })
})
