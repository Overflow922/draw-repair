import { describe, expect, it } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import type { Wall } from "../types"
import { W, axisOf, deepFreeze, idsOf, mark, opening, wall, windowAt } from "./mounting.test-utils"
import { remnantId, remnantWalls } from "./remnants"

// change mounting-plan: остатки стен после сноса (spec mounting-plan «Остатки — живая производная»; design D1).
// Стена W — (0,0)-(500,0), кирпич, 20 см; идентификатор остатка — `W~<начало участка в мм>`.

const remnants = (walls: Wall[], marks = [] as ReturnType<typeof mark>[], elements = [] as Parameters<typeof effectiveMarks>[2]) =>
  remnantWalls(walls, effectiveMarks(marks, walls, elements))

describe("remnantId", () => {
  it("MP-01: идентификатор — стена, тильда и начало в миллиметрах", () => {
    expect(remnantId("W", 0)).toBe("W~0")
    expect(remnantId("W", 190)).toBe("W~1900")
    expect(remnantId("W", 190.04)).toBe("W~1900")
    expect(remnantId("W", 190.06)).toBe("W~1901")
  })
})

describe("remnantWalls: без сноса", () => {
  it("MP-01: стена без пометок — один остаток целиком с идентификатором W~0 и прежними концами, толщиной и материалом", () => {
    const [r, ...rest] = remnants([W("concrete")])
    expect(rest).toEqual([])
    expect(r).toEqual({ id: "W~0", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "concrete" })
  })

  it("MP-01: остаток не совпадает по идентификатору с исходной стеной", () => {
    expect(idsOf(remnants([W()]))).not.toContain("W")
  })
})

describe("remnantWalls: участок вычтен", () => {
  it("MP-02: пометка 100–190 даёт два остатка: 0–100 и 190–500", () => {
    const out = remnants([W()], [mark("m", "W", "a", 100, 190)])
    expect(idsOf(out)).toEqual(["W~0", "W~1900"])
    expect(out.map(axisOf)).toEqual([
      [0, 0, 100, 0],
      [190, 0, 500, 0],
    ])
  })

  it("MP-02: остатки сохраняют толщину и материал исходной стены", () => {
    const out = remnants([wall("W", 0, 0, 500, 0, 30, "wood-long")], [mark("m", "W", "a", 100, 190)])
    expect(out.map((r) => [r.thicknessCm, r.type])).toEqual([
      [30, "wood-long"],
      [30, "wood-long"],
    ])
  })

  it("MP-03: пометка с концом привязки b считается от конца b: b, 50–200 даёт остатки 0–300 и 450–500", () => {
    const out = remnants([W()], [mark("m", "W", "b", 50, 200)])
    expect(idsOf(out)).toEqual(["W~0", "W~4500"])
    expect(out.map(axisOf)).toEqual([
      [0, 0, 300, 0],
      [450, 0, 500, 0],
    ])
  })

  it("MP-03: снос от конца a оставляет остаток с началом в конце пометки и идентификатором по этому началу", () => {
    const out = remnants([W()], [mark("m", "W", "a", 0, 150)])
    expect(idsOf(out)).toEqual(["W~1500"])
    expect(out.map(axisOf)).toEqual([[150, 0, 500, 0]])
  })

  it("MP-03: две пометки одной стены дают три остатка в порядке вдоль оси", () => {
    const out = remnants([W()], [mark("m2", "W", "a", 250, 300), mark("m1", "W", "a", 100, 190)])
    expect(out.map(axisOf)).toEqual([
      [0, 0, 100, 0],
      [190, 0, 250, 0],
      [300, 0, 500, 0],
    ])
    expect(idsOf(out)).toEqual(["W~0", "W~1900", "W~3000"])
  })

  it("MP-03: остатки наклонной стены лежат на её оси", () => {
    const out = remnants([wall("D", 0, 0, 300, 400)], [mark("m", "D", "a", 100, 200)])
    expect(out.map(axisOf)).toEqual([
      [0, 0, 60, 80],
      [120, 160, 300, 400],
    ])
  })

  it("MP-03: порядок стен чертежа сохраняется, остатки стены без пометок остаются целиком", () => {
    const walls = [wall("A", 0, 0, 100, 0), W(), wall("C", 0, 100, 100, 100)]
    const out = remnants(walls, [mark("m", "W", "a", 100, 190)])
    expect(idsOf(out)).toEqual(["A~0", "W~0", "W~1900", "C~0"])
  })
})

describe("remnantWalls: стена снесена, недействующие пометки", () => {
  it("MP-04: стена, снесённая целиком, остатков не даёт", () => {
    expect(remnants([W()], [mark("m", "W", "a", 0, 500)])).toEqual([])
  })

  it("MP-04: от соседней стены остаток остаётся", () => {
    const out = remnants([W(), wall("V", 0, 100, 500, 100)], [mark("m", "W", "a", 0, 500)])
    expect(idsOf(out)).toEqual(["V~0"])
  })

  it("MP-05: пометка на железобетонной стене не вычитается", () => {
    const out = remnants([W("reinforced")], [mark("m", "W", "a", 100, 190)])
    expect(idsOf(out)).toEqual(["W~0"])
    expect(out.map(axisOf)).toEqual([[0, 0, 500, 0]])
  })

  it("MP-05: пометка через участок окна не вычитается", () => {
    const out = remnants([W()], [mark("m", "W", "a", 100, 190)], [windowAt("win", "W", "a", 200)])
    expect(out.map(axisOf)).toEqual([[0, 0, 500, 0]])
  })

  it("MP-06: пометка на отсутствующую стену остатки не меняет", () => {
    const out = remnants([W()], [mark("m", "X", "a", 100, 190)])
    expect(idsOf(out)).toEqual(["W~0"])
  })

  it("MP-06: проём не мешает пометке — остаток вычтен", () => {
    const out = remnants([W()], [mark("m", "W", "a", 100, 190)], [opening("o", "W", "a", 120)])
    expect(idsOf(out)).toEqual(["W~0", "W~1900"])
  })
})

describe("remnantWalls: границы допуска", () => {
  it("MP-07: остаток короче допуска 0,01 см отбрасывается", () => {
    const out = remnants([W()], [mark("m", "W", "a", 0, 499.995)])
    expect(out).toEqual([])
  })

  it("MP-07: остаток длиннее допуска сохраняется", () => {
    const out = remnants([W()], [mark("m", "W", "a", 0, 499.98)])
    expect(out.map(axisOf)).toEqual([[499.98, 0, 500, 0]])
  })

  it("MP-07: остатки не пересекаются по оси и вместе с пометками покрывают стену", () => {
    const out = remnants([W()], [mark("m1", "W", "a", 100, 190), mark("m2", "W", "b", 50, 100)])
    const len = out.reduce((s, r) => s + Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y), 0)
    expect(len).toBeCloseTo(500 - 90 - 50, 6)
    const xs = out.flatMap((r) => [r.a.x, r.b.x])
    expect(xs).toEqual([...xs].sort((p, q) => p - q))
  })

  it("MP-07: идентификаторы остатков уникальны", () => {
    const out = remnants([W(), wall("V", 0, 100, 500, 100)], [mark("m1", "W", "a", 100, 190), mark("m2", "V", "a", 100, 190)])
    expect(new Set(idsOf(out)).size).toBe(out.length)
  })

  it("MP-08: функция не мутирует входные стены и пометки", () => {
    const walls = deepFreeze([W()])
    const marks = deepFreeze([mark("m", "W", "a", 100, 190)])
    expect(() => remnantWalls(walls, effectiveMarks(marks, walls))).not.toThrow()
  })
})
