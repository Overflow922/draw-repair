import { describe, expect, it } from "vitest"
import { applyNumber, communicationNumbers } from "./edit"
import type { NumberField } from "./edit"
import { slideReach } from "./geometry"
import type { Direction } from "./geometry"
import type { Communication } from "../types"
import { duct, expectPoint, riser, room, w } from "./communications.test-utils"

// change add-communications: числа выделенной коммуникации и их правка
// (spec communications «Размеры выделенной коммуникации», «Правка чисел коммуникации»; test-plan CN-*, CE-*).

const dist = (field: Direction): NumberField => ({ kind: "distance", dir: field })
const reach = (c: Communication, dir: Direction, walls: ReturnType<typeof room>["walls"]): number | null => slideReach(c, dir, walls)?.distanceCm ?? null
const find = (nums: ReturnType<typeof communicationNumbers>, field: NumberField) =>
  nums.find((n) => n.field.kind === field.kind && (field.kind !== "distance" || (n.field.kind === "distance" && n.field.dir === field.dir)))

describe("числа выделенной коммуникации", () => {
  it("CN-01: стояк Ø10 в комнате — диаметр 10 и расстояния 85, 185, 85, 285", () => {
    const { walls } = room()
    const nums = communicationNumbers(riser(100, 100), walls)
    expect(nums).toHaveLength(5)
    expect(find(nums, { kind: "diameter" })?.valueCm).toBeCloseTo(10, 6)
    expect(find(nums, dist("left"))?.valueCm).toBeCloseTo(85, 6)
    expect(find(nums, dist("right"))?.valueCm).toBeCloseTo(185, 6)
    expect(find(nums, dist("up"))?.valueCm).toBeCloseTo(85, 6)
    expect(find(nums, dist("down"))?.valueCm).toBeCloseTo(285, 6)
  })

  it("CN-02: воздуховод — ширина и глубина, у воздуховода нет диаметра; расстояния только там, где есть стена", () => {
    const F = w(120, 0, 120, 50, "F")
    const nums = communicationNumbers(duct(100, 100, 40, 20), [F])
    expect(nums).toHaveLength(3)
    expect(find(nums, { kind: "width" })?.valueCm).toBeCloseTo(40, 6)
    expect(find(nums, { kind: "depth" })?.valueCm).toBeCloseTo(20, 6)
    expect(find(nums, { kind: "diameter" })).toBeUndefined()
    expect(find(nums, dist("up"))?.valueCm).toBeCloseTo(40, 6)
    expect(find(nums, dist("left"))).toBeUndefined()
    expect(find(nums, dist("right"))).toBeUndefined()
    expect(find(nums, dist("down"))).toBeUndefined()
  })

  it("CN-02b: у стояка нет ширины и глубины", () => {
    const nums = communicationNumbers(riser(100, 100), room().walls)
    expect(find(nums, { kind: "width" })).toBeUndefined()
    expect(find(nums, { kind: "depth" })).toBeUndefined()
  })

  it("CN-03: нулевое расстояние остаётся числом «0»", () => {
    const nums = communicationNumbers(riser(15, 100), room().walls)
    expect(find(nums, dist("left"))?.valueCm).toBeCloseTo(0, 6)
  })

  it("CN-03b: без стен есть только размер", () => {
    const nums = communicationNumbers(riser(100, 100), [])
    expect(nums.map((n) => n.field.kind)).toEqual(["diameter"])
  })

  it("CN-04: числа пересчитываются при сдвиге стены (на 10 см от стояка — расстояние влево 95)", () => {
    const { walls, L } = room()
    L.a = { x: -10, y: 0 }
    L.b = { x: -10, y: 400 }
    const nums = communicationNumbers(riser(100, 100), walls)
    expect(find(nums, dist("left"))?.valueCm).toBeCloseTo(95, 6)
  })

  it("CN-05: положение числа расстояния — между краем коммуникации и стеной, по своему направлению", () => {
    const nums = communicationNumbers(riser(100, 100), room().walls)
    const left = find(nums, dist("left"))?.at
    const right = find(nums, dist("right"))?.at
    const up = find(nums, dist("up"))?.at
    const down = find(nums, dist("down"))?.at
    expect(left?.x).toBeGreaterThan(10)
    expect(left?.x).toBeLessThan(95)
    expect(right?.x).toBeGreaterThan(105)
    expect(right?.x).toBeLessThan(290)
    expect(up?.y).toBeGreaterThan(10)
    expect(up?.y).toBeLessThan(95)
    expect(down?.y).toBeGreaterThan(105)
    expect(down?.y).toBeLessThan(390)
  })
})

describe("ввод расстояния", () => {
  it("CE-01: влево 50 — центр сдвинут на 35 см влево; вправо 220; диаметр прежний", () => {
    const { walls } = room()
    const r = applyNumber(riser(100, 100), dist("left"), 50, walls, [])
    expect(r.changed).toBe(true)
    expectPoint(r.communication, 65, 100, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(50, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(220, 4)
    expect(r.communication.kind === "riser" && r.communication.diameterCm).toBe(10)
  })

  it("CE-01b: вправо, вверх, вниз — сдвиг вдоль своей оси, другая ось не меняется", () => {
    const { walls } = room()
    const right = applyNumber(riser(100, 100), dist("right"), 100, walls, [])
    expectPoint(right.communication, 185, 100, 4)
    const up = applyNumber(riser(100, 100), dist("up"), 20, walls, [])
    expectPoint(up.communication, 100, 35, 4)
    const down = applyNumber(riser(100, 100), dist("down"), 100, walls, [])
    expectPoint(down.communication, 100, 285, 4)
  })

  it("CE-01c: ввод большего расстояния отодвигает от стены", () => {
    const { walls } = room()
    const r = applyNumber(riser(100, 100), dist("left"), 150, walls, [])
    expectPoint(r.communication, 165, 100, 4)
  })

  it("CE-02: расстояние 0 — коммуникация касается грани", () => {
    const { walls } = room()
    const r = applyNumber(riser(100, 100), dist("left"), 0, walls, [])
    expectPoint(r.communication, 15, 100, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
  })

  it("CE-03: слишком большое расстояние ограничено противоположной стеной: 300 → фактическое 270", () => {
    const { walls } = room()
    const r = applyNumber(riser(100, 100), dist("left"), 300, walls, [])
    expect(r.changed).toBe(true)
    expectPoint(r.communication, 285, 100, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(270, 4)
  })

  it("CE-03b: расстояние ограничено другой коммуникацией", () => {
    const { walls } = room()
    const other = [duct(200, 100, 30, 20, "d9")] // x 185…215
    const r = applyNumber(riser(100, 100), dist("left"), 200, walls, other)
    expectPoint(r.communication, 180, 100, 4) // правый край стояка в 185: запрошенный центр 215 недопустим
  })

  it("CE-03c: сдвиг не перескакивает через стену, лежащую на пути (continuous)", () => {
    const { walls } = room()
    // между стояком и правой стеной ставим перегородку x 190…210; расстояние влево 400 требует уйти вправо дальше неё
    const part = w(200, 0, 200, 400, "P")
    const r = applyNumber(riser(100, 100), dist("left"), 400, [...walls, part], [])
    expectPoint(r.communication, 185, 100, 4)
  })

  it("CE-04: нет расстояния в направлении — ввод не применяется", () => {
    const L = w(0, 0, 0, 400, "L")
    const r = applyNumber(riser(100, 100), dist("right"), 50, [L], [])
    expect(r.changed).toBe(false)
    expect(r.communication).toEqual(riser(100, 100))
  })
})

describe("ввод размера", () => {
  it("CE-05: диаметр 16 — центр прежний, расстояния до стен меньше на 3 см", () => {
    const { walls } = room()
    const r = applyNumber(riser(100, 100), { kind: "diameter" }, 16, walls, [])
    expect(r.changed).toBe(true)
    expectPoint(r.communication, 100, 100, 9)
    expect(r.communication.kind === "riser" && r.communication.diameterCm).toBe(16)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(82, 4)
    expect(reach(r.communication, "down", walls)).toBeCloseTo(282, 4)
  })

  it("CE-06: диаметр ограничен стеной: зазор 2 см, ввод 30 → 14 (радиус 7), касание слева", () => {
    const L = w(0, 0, 0, 400, "L") // грань x = 10
    const r = applyNumber(riser(17, 100), { kind: "diameter" }, 30, [L], [])
    expect(r.changed).toBe(true)
    expect(r.communication.kind === "riser" && r.communication.diameterCm).toBeCloseTo(14, 4)
    expect(reach(r.communication, "left", [L])).toBeCloseTo(0, 4)
    expectPoint(r.communication, 17, 100, 9)
  })

  it("CE-06c: размер ровно до касания (14 при зазоре 2) применяется целиком; чуть больше — 14, чуть меньше — как введён", () => {
    const L = w(0, 0, 0, 400, "L")
    const diameter = (v: number) => applyNumber(riser(17, 100), { kind: "diameter" }, v, [L], [])
    const exact = diameter(14)
    expect(exact.changed).toBe(true)
    expect(exact.communication.kind === "riser" && exact.communication.diameterCm).toBeCloseTo(14, 4)
    const over = diameter(14.01)
    expect(over.communication.kind === "riser" && over.communication.diameterCm).toBeCloseTo(14, 4)
    const under = diameter(13.99)
    expect(under.changed).toBe(true)
    expect(under.communication.kind === "riser" && under.communication.diameterCm).toBeCloseTo(13.99, 4)
  })

  it("CE-06b: диаметр ограничен другой коммуникацией", () => {
    const r = applyNumber(riser(100, 100), { kind: "diameter" }, 40, [], [riser(112, 100, 4, "r9")])
    // расстояние между центрами 12, радиус другого 2: наибольший радиус 10 → диаметр 20
    expect(r.communication.kind === "riser" && r.communication.diameterCm).toBeCloseTo(20, 4)
  })

  it("CE-07: ширина воздуховода — по X, глубина прежняя; центр прежний", () => {
    const { walls } = room()
    const r = applyNumber(duct(100, 100), { kind: "width" }, 50, walls, [])
    expect(r.communication.kind === "duct" && [r.communication.widthCm, r.communication.depthCm]).toEqual([50, 20])
    expectPoint(r.communication, 100, 100, 9)
  })

  it("CE-07b: глубина воздуховода — по Y, ширина прежняя", () => {
    const { walls } = room()
    const r = applyNumber(duct(100, 100), { kind: "depth" }, 60, walls, [])
    expect(r.communication.kind === "duct" && [r.communication.widthCm, r.communication.depthCm]).toEqual([30, 60])
  })

  // change fix-duct-resize-against-wall (test-change-request): рост на свободное место вдоль оси, а не от центра
  it("CE-08: ширина у стены слева (зазор 5): ввод 200 помещается — ширина 200, левая грань x = 10, центр x = 110", () => {
    const { walls } = room()
    const r = applyNumber(duct(30, 100), { kind: "width" }, 200, walls, [])
    expect(r.communication.kind === "duct" && r.communication.widthCm).toBeCloseTo(200, 4)
    expectPoint(r.communication, 110, 100, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
  })

  it("CE-08c: ширина у стены слева: ввод 500 ограничен местом между стенами — ширина 280, касание обеих, центр x = 150", () => {
    const { walls } = room()
    const r = applyNumber(duct(30, 100), { kind: "width" }, 500, walls, [])
    expect(r.communication.kind === "duct" && r.communication.widthCm).toBeCloseTo(280, 4)
    expectPoint(r.communication, 150, 100, 4)
    expect(reach(r.communication, "left", walls)).toBeCloseTo(0, 4)
    expect(reach(r.communication, "right", walls)).toBeCloseTo(0, 4)
  })

  it("CE-08b: глубина (вверх 80, вниз 280): ввод 300 помещается — глубина 300, верхняя грань касается стены, центр y = 160", () => {
    const { walls } = room()
    const r = applyNumber(duct(100, 100), { kind: "depth" }, 300, walls, [])
    expect(r.communication.kind === "duct" && r.communication.depthCm).toBeCloseTo(300, 4)
    expectPoint(r.communication, 100, 160, 4)
    expect(reach(r.communication, "up", walls)).toBeCloseTo(0, 4)
  })
})

describe("некорректный ввод и отсутствие изменений", () => {
  const { walls } = room()
  const r0 = riser(100, 100)
  const cases: [string, NumberField, number][] = [
    ["нечисло для расстояния", dist("left"), NaN],
    ["отрицательное расстояние", dist("left"), -5],
    ["бесконечность", dist("left"), Infinity],
    ["нулевой диаметр", { kind: "diameter" }, 0],
    ["отрицательный диаметр", { kind: "diameter" }, -5],
    ["нечисло как диаметр", { kind: "diameter" }, NaN],
  ]
  for (const [name, field, value] of cases)
    it(`CE-09: ${name} — не применяется, changed = false, коммуникация прежняя`, () => {
      const r = applyNumber(r0, field, value, walls, [])
      expect(r.changed).toBe(false)
      expect(r.communication).toEqual(riser(100, 100))
    })

  it("CE-09b: ширина и глубина воздуховода, не большие 0, не применяются", () => {
    const d = duct(100, 100)
    for (const field of [{ kind: "width" }, { kind: "depth" }] as const) for (const v of [0, -1]) {
      const r = applyNumber(d, field, v, walls, [])
      expect(r.changed).toBe(false)
      expect(r.communication).toEqual(duct(100, 100))
    }
  })

  it("CE-10: значение, равное текущему, — changed = false", () => {
    expect(applyNumber(r0, dist("left"), 85, walls, []).changed).toBe(false)
    expect(applyNumber(r0, { kind: "diameter" }, 10, walls, []).changed).toBe(false)
    expect(applyNumber(duct(100, 100), { kind: "width" }, 30, walls, []).changed).toBe(false)
  })

  it("CE-10b: ввод, ограничение которого возвращает исходное положение, — changed = false", () => {
    const touch = riser(15, 100) // уже вплотную к левой стене
    const r = applyNumber(touch, { kind: "diameter" }, 30, [w(0, 0, 0, 400, "L")], [])
    // зазор нулевой: размер вырос бы до границы касания — диаметр 10 уже предельный
    expect(r.changed).toBe(false)
    expect(r.communication).toEqual(touch)
  })

  it("CE-11: исходный объект не мутируется", () => {
    const c = riser(100, 100)
    applyNumber(c, dist("left"), 50, walls, [])
    applyNumber(c, { kind: "diameter" }, 16, walls, [])
    expect(c).toEqual(riser(100, 100))
  })
})
