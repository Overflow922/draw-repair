import { describe, expect, it } from "vitest"
import { batteryCorner, batteryHolds, batteryRect } from "./battery-geometry"
import { at, axisOverlap, bat, boxOf, duct, expectBox, expectPoint, riser, sceneF, sceneRP, w } from "./battery.test-utils"
import type { Box } from "./battery.test-utils"

// change add-battery: положение батареи по привязке, параллельность стене, углы, проверка пересечений
// (spec battery «Батарея и опорная стена», «Размещение батареи вдоль стены»; design D1, D2; test-plan B-GEO-*, B-PLC-3, B-GRD-12).
// Эталоны — осевая сцена W (0,0)-(500,0) t20: грань +1 это y = 10, грань −1 это y = −10.

const { W } = sceneF()

describe("положение батареи по привязке", () => {
  it("B-GEO-1: привязка a, 100 см, длина 70, толщина 10, отступ 3 на грани +1 — прямоугольник [100,170]×[13,23]", () => {
    expectBox(batteryRect(bat("W", "a", 100), W), 100, 13, 170, 23)
  })

  it("B-GEO-2: привязка b, 100 см — прямоугольник [330,400]×[13,23]", () => {
    expectBox(batteryRect(bat("W", "b", 100), W), 330, 13, 400, 23)
  })

  it("B-GEO-3: грань −1 — прямоугольник [100,170]×[−23,−13]", () => {
    expectBox(batteryRect(bat("W", "a", 100, { face: -1 }), W), 100, -23, 170, -13)
  })

  it("B-GEO-3b: отступ 0 — задняя сторона лежит на грани стены", () => {
    expectBox(batteryRect(bat("W", "a", 100, { gapCm: 0 }), W), 100, 10, 170, 20)
  })

  it("B-GEO-3c: дробное расстояние привязки (224,5) не округляется", () => {
    expectBox(batteryRect(bat("W", "a", 224.5, { lengthCm: 71 }), W), 224.5, 13, 295.5, 23)
  })

  it("B-GEO-3d: смена толщины стены переносит батарею: отступ от новой грани прежний (стена 30 см: грань y = 15)", () => {
    const thick = { ...W, thicknessCm: 30 }
    expectBox(batteryRect(bat("W", "a", 100), thick), 100, 18, 170, 28)
  })
})

describe("батарея всегда параллельна стене", () => {
  const D = w(0, 0, 300, 400, "D") // ось длиной 500, d = (0.6, 0.8), нормаль (−0.8, 0.6)

  it("B-GEO-4: на наклонной стене углы лежат на осях стены: t ∈ [100,170], поперёк [13,23]", () => {
    const r = batteryRect(bat("D", "a", 100), D)
    expect(r).toHaveLength(4)
    const expected = [at(D, 100, 13), at(D, 100, 23), at(D, 170, 13), at(D, 170, 23)]
    for (const e of expected) expect(r.some((p) => Math.hypot(p.x - e.x, p.y - e.y) < 1e-6)).toBe(true)
  })

  it("B-GEO-4b: длинные стороны параллельны оси, торцы перпендикулярны", () => {
    const a = batteryCorner(bat("D", "a", 100), D, "a", "back")
    const b = batteryCorner(bat("D", "a", 100), D, "b", "back")
    const f = batteryCorner(bat("D", "a", 100), D, "a", "front")
    const axis = { x: 0.6, y: 0.8 }
    expect((b.x - a.x) * axis.y - (b.y - a.y) * axis.x).toBeCloseTo(0, 6)
    expect((f.x - a.x) * axis.x + (f.y - a.y) * axis.y).toBeCloseTo(0, 6)
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(70, 6)
    expect(Math.hypot(f.x - a.x, f.y - a.y)).toBeCloseTo(10, 6)
  })

  it("B-GEO-4c: после поворота стены батарея поворачивается вместе с ней (тот же t и поперечное положение)", () => {
    const turned = w(0, 0, 400, 300, "D") // тот же центр поворота, ось (0.8, 0.6)
    const r = batteryRect(bat("D", "a", 100), turned)
    for (const e of [at(turned, 100, 13), at(turned, 170, 23)]) expect(r.some((p) => Math.hypot(p.x - e.x, p.y - e.y) < 1e-6)).toBe(true)
  })
})

describe("углы батареи", () => {
  it("B-GEO-6: четыре угла — торец у конца a / b оси × задняя / передняя сторона", () => {
    const b = bat("W", "a", 100)
    expectPoint(batteryCorner(b, W, "a", "back"), 100, 13)
    expectPoint(batteryCorner(b, W, "a", "front"), 100, 23)
    expectPoint(batteryCorner(b, W, "b", "back"), 170, 13)
    expectPoint(batteryCorner(b, W, "b", "front"), 170, 23)
  })

  it("B-GEO-6b: «ближний к концу a» не зависит от стороны привязки: батарея с привязкой b", () => {
    const b = bat("W", "b", 100) // [330, 400]
    expectPoint(batteryCorner(b, W, "a", "back"), 330, 13)
    expectPoint(batteryCorner(b, W, "b", "front"), 400, 23)
  })

  it("B-GEO-6c: на грани −1 задняя сторона — ближняя к стене (y = −13), передняя — y = −23", () => {
    const b = bat("W", "a", 100, { face: -1 })
    expectPoint(batteryCorner(b, W, "a", "back"), 100, -13)
    expectPoint(batteryCorner(b, W, "a", "front"), 100, -23)
  })
})

describe("проверка пересечений батареи", () => {
  const scene = (over: Partial<Parameters<typeof batteryHolds>[1]> = {}) => ({ walls: [W], batteries: [], communications: [], ...over })
  const X = bat("W", "a", 100)

  it("B-GEO-7: батарея на свободной стене допустима (опорная стена не считается препятствием)", () => {
    expect(batteryHolds(X, scene())).toBe(true)
  })

  it("B-PLC-3: торцами вплотную — допустимо; наложение на 1 см — нет", () => {
    const Y = bat("W", "a", 170, { id: "b1" })
    expect(batteryHolds(Y, scene({ batteries: [X] }))).toBe(true)
    const Z = bat("W", "a", 169, { id: "b2" })
    expect(batteryHolds(Z, scene({ batteries: [X] }))).toBe(false)
  })

  it("B-GRD-12: порог глубины наложения 0,01 см: 0,009 — допустимо, 0,011 — нет", () => {
    expect(batteryHolds(bat("W", "a", 169.991, { id: "b1" }), scene({ batteries: [X] }))).toBe(true)
    expect(batteryHolds(bat("W", "a", 169.989, { id: "b2" }), scene({ batteries: [X] }))).toBe(false)
  })

  it("B-PLC-4: батареи на противоположных гранях с общим участком вдоль оси не пересекаются", () => {
    const Y = bat("W", "a", 100, { id: "b1", face: -1 })
    expect(batteryHolds(Y, scene({ batteries: [X] }))).toBe(true)
  })

  it("B-PLC-6: перегородка, примкнутая к грани, — препятствие (тело x ∈ [295,305])", () => {
    const { walls, P } = sceneRP()
    expect(P.thicknessCm).toBe(10)
    expect(batteryHolds(bat("W", "a", 225), { walls, batteries: [], communications: [] })).toBe(true) // конец на 295: касание
    expect(batteryHolds(bat("W", "a", 226), { walls, batteries: [], communications: [] })).toBe(false)
  })

  it("B-PLC-7: воздуховод 20×20 с центром (200,25) (y ∈ [15,35]) пересекает полосу батареи [13,23]", () => {
    const D = duct(200, 25, 20, 20)
    expect(batteryHolds(bat("W", "a", 125), scene({ communications: [D] }))).toBe(false) // [125,195] заходит на x ≥ 190
    expect(batteryHolds(bat("W", "a", 120), scene({ communications: [D] }))).toBe(true) // конец 190: касание
  })

  it("B-PLC-8: стояк — круг: наложение по расстоянию до круга, а не до его коробки", () => {
    // Ø 20, центр (200,25): ближайшая к центру точка прямоугольника с торцом X — (X, 23)
    const R = riser(200, 25, 20)
    expect(batteryHolds(bat("W", "a", 120), scene({ communications: [R] }))).toBe(true) // торец 190: до круга ≈ 0,2 см
    expect(batteryHolds(bat("W", "a", 121), scene({ communications: [R] }))).toBe(false) // торец 191: наложение
  })

  it("B-PLC-16: окно и проём лежат в теле опорной стены — батарея перед ними допустима (сцена элементов не нужна)", () => {
    const b = bat("W", "a", 200, { gapCm: 0 })
    expect(batteryHolds(b, scene())).toBe(true)
    expect(axisOverlap(boxOf(batteryRect(b, W)), { minX: 200, minY: -10, maxX: 320, maxY: 10 } satisfies Box)).toBe(0)
  })

  it("B-GRD-13: другая батарея с наложением по высоте полосы, но не по длине, допустима", () => {
    const Y = bat("W", "a", 300, { id: "b1" })
    expect(batteryHolds(Y, scene({ batteries: [X] }))).toBe(true)
  })

  it("B-GRD-14: сама батарея в списке не считается препятствием для себя", () => {
    expect(batteryHolds(X, scene({ batteries: [X] }))).toBe(true)
  })
})
