import { describe, expect, it } from "vitest"
import { batteryHolds, batteryRect } from "./battery-geometry"
import { batteryNumbers, setBatteryDistance, setBatteryGap, setBatteryLength, setBatteryThickness } from "./battery-edit"
import { applied, bat, boxOf, ctxOf, duct, expectBox, sceneF, sceneR, sceneRP, windowAt } from "./battery.test-utils"

// change add-battery: числа выделенной батареи и их правка на месте (spec battery «Числа выделенной батареи», «Правка чисел батареи»;
// design D3; test-plan B-NUM-5..14). Сцена R: W (0,0)-(500,0) t20; внутренняя грань y = 10 идёт от x = 10 до x = 490.

const { walls } = sceneR()
const X = bat("W", "a", 100) // [100,170], y ∈ [13,23]
const c = ctxOf({ snapCm: 0 })
const rect = (b: ReturnType<typeof bat>) => batteryRect(b, walls[0])

describe("числа выделенной батареи", () => {
  it("B-NUM-5: расстояния до концов видимого участка грани (10…490) и размеры: 90 / 320 / 70 / 10 / 3", () => {
    expect(batteryNumbers(X, walls)).toEqual({ toA: 90, toB: 320, lengthCm: 70, thicknessCm: 10, gapCm: 3 })
  })

  it("B-NUM-5b: батарея вплотную к стыку — расстояние «0»", () => {
    expect(batteryNumbers(bat("W", "a", 10), walls).toA).toBe(0)
    expect(batteryNumbers(bat("W", "a", 420), walls).toB).toBe(0)
  })

  it("B-NUM-5c: участок ограничен перегородкой P (тело x ∈ [295,305]): числа считаются до её граней (до 295 и от 305)", () => {
    const rp = sceneRP()
    const left = batteryNumbers(bat("W", "a", 100), rp.walls)
    expect(left.toA).toBe(90)
    expect(left.toB).toBe(125) // 295 − 170
    const right = batteryNumbers(bat("W", "a", 330), rp.walls)
    expect(right.toA).toBe(25) // 330 − 305
    expect(right.toB).toBe(90) // 490 − 400
  })

  it("B-NUM-5e: числа на грани −1 идут по внешней грани (−10, от x = −10 до x = 510)", () => {
    const outer = bat("W", "a", 100, { face: -1 })
    expect(batteryNumbers(outer, walls)).toMatchObject({ toA: 110, toB: 340 })
  })
})

describe("ввод расстояния", () => {
  it("B-NUM-7: 200 в числе «до конца a» → торец на x = 210, длина 70, привязка a", () => {
    const b = applied(setBatteryDistance(X, walls, "a", 200, c))
    expect(b).toMatchObject({ anchor: "a", offsetCm: 210, lengthCm: 70 })
  })

  it("B-NUM-7b: 200 в числе «до конца b» → батарея [220,290], привязка меняется на b (расстояние от конца стены 210)", () => {
    const b = applied(setBatteryDistance(X, walls, "b", 200, c))
    expect(b).toMatchObject({ anchor: "b", offsetCm: 210, lengthCm: 70 })
    expectBox(rect(b), 220, 13, 290, 23)
  })

  it("B-NUM-7c: расстояние 0 прижимает батарею к стыку", () => {
    expect(applied(setBatteryDistance(X, walls, "a", 0, c)).offsetCm).toBe(10)
    const b = applied(setBatteryDistance(X, walls, "b", 0, c))
    expectBox(rect(b), 420, 13, 490, 23)
  })

  it("B-PLC-9: вплотную к соседу: Y [200,270], расстояние 160 → Y начинается на x = 170 (торцы совпали) — значение применено", () => {
    const Y = bat("W", "a", 200, { id: "y" })
    expect(applied(setBatteryDistance(Y, walls, "a", 160, ctxOf({ batteries: [X], snapCm: 0 }))).offsetCm).toBe(170)
  })

  it("B-NUM-9b: расстояние, ведущее к наложению на соседа, заменяется ближайшим допустимым (Y у X: 150 → 170, торец X)", () => {
    const Y = bat("W", "a", 200, { id: "y" })
    expect(applied(setBatteryDistance(Y, walls, "a", 150, ctxOf({ batteries: [X], snapCm: 0 }))).offsetCm).toBeCloseTo(170, 4)
  })

  it("B-NUM-7d: расстояние, выводящее за участок грани, ограничено стыком (1000 → конец на x = 490)", () => {
    const b = applied(setBatteryDistance(X, walls, "a", 1000, c))
    expectBox(rect(b), 420, 13, 490, 23)
  })

  it("B-CTR-8b: ввод числа не прилипает к центру окна (260): расстояние 212 → торец на x = 222 (центр 257), а не 225", () => {
    const win = windowAt("W", "a", 200)
    expect(applied(setBatteryDistance(X, walls, "a", 212, ctxOf({ elements: [win], snapCm: 6 }))).offsetCm).toBe(222)
  })

  it("B-NUM-7e: сохраняется грань и параметры", () => {
    expect(applied(setBatteryDistance(X, walls, "a", 200, c))).toMatchObject({ wallId: "W", face: 1, thicknessCm: 10, gapCm: 3 })
  })
})

describe("ввод длины", () => {
  it("B-NUM-8: длина 90 при привязке a — торец привязки на месте, другой на x = 190", () => {
    const b = applied(setBatteryLength(X, walls, 90, c))
    expect(b).toMatchObject({ anchor: "a", offsetCm: 100, lengthCm: 90 })
    expectBox(rect(b), 100, 13, 190, 23)
  })

  it("B-NUM-8b: при привязке b торец привязки (x = 400) на месте, растёт в сторону a", () => {
    const b = applied(setBatteryLength(bat("W", "b", 100), walls, 90, c))
    expect(b).toMatchObject({ anchor: "b", offsetCm: 100, lengthCm: 90 })
    expectBox(rect(b), 310, 13, 400, 23)
  })

  // реализация обязана сравнивать результат с допуском (граница касания не бывает точным целым): «без изменений», а не «применено 70,000001»
  it("B-NUM-9: длина упирается в соседа вплотную справа ([170,240]): 90 → остаётся 70, отказ «без изменений»", () => {
    const Y = bat("W", "a", 170, { id: "y" })
    expect(setBatteryLength(X, walls, 90, ctxOf({ batteries: [Y], snapCm: 0 }))).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("B-NUM-9c: сосед на [180,250]: длина 90 заменяется наибольшей допустимой — 80", () => {
    const Y = bat("W", "a", 180, { id: "y" })
    expect(applied(setBatteryLength(X, walls, 90, ctxOf({ batteries: [Y], snapCm: 0 }))).lengthCm).toBeCloseTo(80, 4)
  })

  it("B-NUM-9d: длина ограничена стыком: от x = 100 до конца участка 490 допустимо 390", () => {
    expect(applied(setBatteryLength(X, walls, 1000, c)).lengthCm).toBeCloseTo(390, 4)
  })

  it("B-NUM-9e: длина уменьшается свободно: 30 → торец на x = 130", () => {
    expectBox(rect(applied(setBatteryLength(X, walls, 30, c))), 100, 13, 130, 23)
  })
})

describe("ввод толщины и отступа", () => {
  it("B-NUM-10: толщина 15 при отступе 3 → y ∈ [13,28], положение вдоль оси и длина прежние", () => {
    const b = applied(setBatteryThickness(X, walls, 15, c))
    expect(b).toMatchObject({ thicknessCm: 15, gapCm: 3, offsetCm: 100, lengthCm: 70 })
    expectBox(rect(b), 100, 13, 170, 28)
  })

  it("B-NUM-10b: толщина ограничена воздуховодом 30×20 с центром (135,43): y ∈ [33,53] — передняя сторона не выше 33, толщина 20", () => {
    const D = duct(135, 43, 30, 20)
    const b = applied(setBatteryThickness(X, walls, 30, ctxOf({ communications: [D], snapCm: 0 })))
    expect(b.thicknessCm).toBeCloseTo(20, 4)
    expect(batteryHolds(b, { walls, batteries: [], communications: [D] })).toBe(true)
  })

  it("B-NUM-11: нулевой отступ допустим: батарея прилегает к грани (y ∈ [10,20])", () => {
    const b = applied(setBatteryGap(X, walls, 0, c))
    expect(b.gapCm).toBe(0)
    expectBox(rect(b), 100, 10, 170, 20)
  })

  it("B-NUM-11b: отступ 5 переносит батарею целиком: y ∈ [15,25], толщина прежняя", () => {
    const b = applied(setBatteryGap(X, walls, 5, c))
    expect(b.thicknessCm).toBe(10)
    expectBox(rect(b), 100, 15, 170, 25)
  })

  it("B-NUM-11c: отступ, при котором батарея налезла бы на воздуховод, ограничивается: центр (135,40), 30×10 → y ∈ [35,45]", () => {
    const D = duct(135, 40, 30, 10)
    const b = applied(setBatteryGap(X, walls, 20, ctxOf({ communications: [D], snapCm: 0 })))
    // передняя сторона: 10 (грань) + отступ + 10 (толщина) ≤ 35 → отступ ≤ 15
    expect(b.gapCm).toBeGreaterThanOrEqual(14)
    expect(b.gapCm).toBeLessThanOrEqual(15.01)
    expect(batteryHolds(b, { walls, batteries: [], communications: [D] })).toBe(true)
  })

  it("B-NUM-11d: толщина и отступ не двигают батарею вдоль оси", () => {
    const b = boxOf(rect(applied(setBatteryThickness(X, walls, 20, c))))
    expect([b.minX, b.maxX]).toEqual([100, 170])
  })
})

describe("недопустимые значения", () => {
  const invalid = [0, -5, Number.NaN, Number.POSITIVE_INFINITY]

  it.each(invalid)("B-NUM-12: длина %s не применяется", (v) => {
    expect(setBatteryLength(X, walls, v, c)).toEqual({ kind: "rejected", reason: "invalid" })
  })

  it.each(invalid)("B-NUM-12b: толщина %s не применяется", (v) => {
    expect(setBatteryThickness(X, walls, v, c)).toEqual({ kind: "rejected", reason: "invalid" })
  })

  it.each([-1, Number.NaN, Number.NEGATIVE_INFINITY])("B-NUM-12c: отступ %s не применяется", (v) => {
    expect(setBatteryGap(X, walls, v, c)).toEqual({ kind: "rejected", reason: "invalid" })
  })

  it.each([-5, Number.NaN])("B-NUM-12d: расстояние %s не применяется", (v) => {
    expect(setBatteryDistance(X, walls, "a", v, c)).toEqual({ kind: "rejected", reason: "invalid" })
  })

  it("B-NUM-14: применение без изменения (то же значение) — «без изменений», записи истории не будет", () => {
    expect(setBatteryLength(X, walls, 70, c)).toEqual({ kind: "rejected", reason: "no-change" })
    expect(setBatteryThickness(X, walls, 10, c)).toEqual({ kind: "rejected", reason: "no-change" })
    expect(setBatteryGap(X, walls, 3, c)).toEqual({ kind: "rejected", reason: "no-change" })
    expect(setBatteryDistance(X, walls, "a", 90, c)).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("B-NUM-14b: исходная батарея не мутируется", () => {
    const frozen = Object.freeze({ ...X })
    expect(() => setBatteryLength(frozen, walls, 90, c)).not.toThrow()
    expect(frozen.lengthCm).toBe(70)
  })
})

describe("свободная стена: видимая грань идёт до торцов", () => {
  const free = sceneF()
  const walls1 = free.walls
  const rect1 = (b: ReturnType<typeof bat>) => batteryRect(b, free.W)

  it("B-NUM-5f: числа свободной стены: до торца a — 100, до торца b — 330", () => {
    expect(batteryNumbers(X, walls1)).toEqual({ toA: 100, toB: 330, lengthCm: 70, thicknessCm: 10, gapCm: 3 })
  })

  it("B-NUM-7f: расстояние 0 прижимает батарею к торцам стены: слева [0,70], справа [430,500]", () => {
    expectBox(rect1(applied(setBatteryDistance(X, walls1, "a", 0, c))), 0, 13, 70, 23)
    expectBox(rect1(applied(setBatteryDistance(X, walls1, "b", 0, c))), 430, 13, 500, 23)
  })

  it("B-NUM-7g: расстояние за торцом ограничено торцом: 1000 влево-вправо не выводит за стену", () => {
    expectBox(rect1(applied(setBatteryDistance(X, walls1, "a", 1000, c))), 430, 13, 500, 23)
  })

  it("B-NUM-9f: длина ограничена торцом стены: при привязке a от x = 100 до x = 500 — 400", () => {
    expect(applied(setBatteryLength(X, walls1, 1000, c)).lengthCm).toBeCloseTo(400, 4)
  })

  it("B-NUM-9g: при привязке b торец привязки (x = 400) на месте, длина растёт до x = 0 — 400", () => {
    const b = applied(setBatteryLength(bat("W", "b", 100), walls1, 1000, c))
    expect(b).toMatchObject({ anchor: "b", offsetCm: 100 })
    expect(b.lengthCm).toBeCloseTo(400, 4)
  })
})

describe("исходное наложение (из документа): правки чисел не углубляют его", () => {
  // воздуховод 20×20 с центром (135,30): y ∈ [20,40] налегает на батарею [100,170]×[13,23] на 3 см
  const walls1 = sceneF().walls
  const D = duct(135, 30, 20, 20)
  const cc = ctxOf({ communications: [D], snapCm: 0 })

  it("B-NUM-15: отступ 5 углубил бы наложение (y ∈ [15,25]: 5 см) — остаётся 3: «без изменений»", () => {
    expect(setBatteryGap(X, walls1, 5, cc)).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("B-NUM-15b: отступ 1 уменьшает наложение до 1 см — применяется", () => {
    expect(applied(setBatteryGap(X, walls1, 1, cc)).gapCm).toBe(1)
  })

  it("B-NUM-15c: толщина 15 углубила бы наложение (передняя сторона y = 28) — остаётся 10: «без изменений»", () => {
    expect(setBatteryThickness(X, walls1, 15, cc)).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("B-NUM-15d: толщина 5 (передняя сторона y = 18, наложения нет) — применяется", () => {
    expect(applied(setBatteryThickness(X, walls1, 5, cc)).thicknessCm).toBe(5)
  })

  it("B-NUM-15e: ввод расстояния, уводящий батарею из наложения (до x = 0), применяется", () => {
    expect(applied(setBatteryDistance(X, walls1, "a", 0, cc)).offsetCm).toBe(0)
  })
})
