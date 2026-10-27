import { describe, expect, it } from "vitest"
import { reachBodies } from "../furniture/item-wall-reach"
import { rectWalls, wall } from "../rough/rough.test-utils"
import type { LightFixture, Wall } from "../types"
import { applyLightDistance, lightNumberLayout } from "./light-numbers"

// change add-ceiling-lighting: числа расстояний объектов освещения и их правка на месте
// (spec ceiling-lighting «Расстояния точки освещения до стен», «Правка расстояний освещения на месте»; design D5).
// Помещение — внутренние грани x = 0, x = 400, y = 0, y = 300.

const SCREEN = { labelPx: 14, dimTextGapPx: 1.5 }
const ROOM = (): Wall[] => rectWalls("w", -10, -10, 410, 310)
const bodies = () => reachBodies(ROOM())
const spot = (x: number, y: number): LightFixture => ({ id: "s", kind: "spot", x, y })
const SCONCE: LightFixture = { id: "b", kind: "sconce", x: 120, y: 0, angleDeg: 90 }

describe("числа объектов освещения", () => {
  it("CL-N1: два числа в текущей единице с размерными линиями от центра до грани", () => {
    const numbers = lightNumberLayout(spot(100, 80), bodies(), "cm", 2, SCREEN)
    expect(numbers.map((n) => [n.axis, n.text])).toEqual([["x", "100"], ["y", "80"]])
    const [x] = numbers
    expect(x?.geom?.a).toEqual({ x: 100, y: 80 })
    expect(x?.geom?.b.x).toBeCloseTo(0, 9)
    expect(numbers.every((n) => n.lightId === "s")).toBe(true)
  })

  it("CL-N2: единица — мм", () => {
    expect(lightNumberLayout(spot(100, 80), bodies(), "mm", 2, SCREEN).map((n) => n.text)).toEqual(["1000", "800"])
  })

  it("CL-N3: ноль — число «0» у центра без линии", () => {
    const zero = lightNumberLayout(spot(100, 0), bodies(), "cm", 2, SCREEN).find((n) => n.axis === "y")
    expect(zero?.text).toBe("0")
    expect(zero?.geom).toBeNull()
    expect(Math.hypot((zero?.center.x ?? 0) - 100, (zero?.center.y ?? 0) - 0)).toBeLessThan(20)
  })

  it("CL-N4: нет грани по оси — нет числа; у бра одно число", () => {
    expect(lightNumberLayout(spot(100, 80), reachBodies([wall("T", -1000, -10, 1000, -10)]), "cm", 2, SCREEN).map((n) => n.axis)).toEqual(["y"])
    expect(lightNumberLayout(SCONCE, bodies(), "cm", 2, SCREEN).map((n) => [n.axis, n.text])).toEqual([["along", "120"]])
  })
})

describe("ввод расстояния", () => {
  it("CL-N10: ввод 60 в число «100» — центр (60, 80)", () => {
    expect(applyLightDistance([spot(100, 80)], "s", "x", 60, bodies())).toEqual([spot(60, 80)])
  })

  it("CL-N11: ввод 350 — центр (350, 80), после этого ближайшая справа — 50", () => {
    const next = applyLightDistance([spot(100, 80)], "s", "x", 350, bodies())
    expect(next).toEqual([spot(350, 80)])
    const [l] = next
    if (!l) throw new Error("нет объекта")
    expect(lightNumberLayout(l, bodies(), "cm", 2, SCREEN).find((n) => n.axis === "x")?.text).toBe("50")
  })

  it("CL-N12: ввод у бра — сдвиг вдоль грани, центр (50, 0), направление прежнее", () => {
    expect(applyLightDistance([SCONCE], "b", "along", 50, bodies())).toEqual([{ ...SCONCE, x: 50 }])
  })

  it("CL-N13: центр точки округляется до целого сантиметра", () => {
    expect(applyLightDistance([spot(100, 80)], "s", "x", 60.4, bodies())).toEqual([spot(60, 80)])
  })

  it("CL-N14: отрицательное, нечисло и ввод в тело стены не применяются — тот же массив", () => {
    const lights = [spot(100, 80)]
    expect(applyLightDistance(lights, "s", "x", -5, bodies())).toBe(lights)
    expect(applyLightDistance(lights, "s", "x", Number.NaN, bodies())).toBe(lights)
    expect(applyLightDistance(lights, "s", "x", 405, bodies())).toBe(lights)
  })

  it("CL-N15: ввод того же значения — тот же массив; ноль ставит центр на грань", () => {
    const lights = [spot(100, 80)]
    expect(applyLightDistance(lights, "s", "x", 100, bodies())).toBe(lights)
    expect(applyLightDistance(lights, "s", "y", 0, bodies())).toEqual([spot(100, 0)])
  })

  it("CL-N16: бра на грани с дробной координатой остаётся на ней", () => {
    const walls = [wall("N", -100, 0, 500, 0, 15), wall("L", -10, -100, -10, 300)]
    const b: LightFixture = { id: "b", kind: "sconce", x: 120, y: 7.5, angleDeg: 90 }
    expect(applyLightDistance([b], "b", "along", 30.3, reachBodies(walls))).toEqual([{ ...b, x: 30 }])
  })
})
