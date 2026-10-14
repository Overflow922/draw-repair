import { describe, expect, it } from "vitest"
import { addBatteryMark, batteryMarkAt, demolishedBatteries, liveBatteryMarks, removeBatteryMark } from "./battery-demolition"
import type { BatteryMark } from "../types"
import { bat, sceneF } from "./battery.test-utils"

// change add-battery: снос батареи — пометка целиком, снятие ластиком, следование за батареей, пометка на отсутствующую батарею
// (spec demolition-plan «Снос батареи»; design D8; test-plan B-DEM-*). Чистые функции над списком пометок батарей.
// Сцена: W (0,0)-(500,0) t20; батареи X [100,170]×[13,23] и Y [300,370]×[13,23] на грани y = 10.

const { W } = sceneF()
const X = bat("W", "a", 100)
const Y = bat("W", "a", 300, { id: "y" })
const mark = (id: string, batteryId: string): BatteryMark => ({ id, batteryId })

describe("постановка пометки", () => {
  it("B-DEM-1: клик по батарее создаёт пометку на неё целиком: одна запись со ссылкой на батарею", () => {
    expect(addBatteryMark([], "b0", "m1")).toEqual([mark("m1", "b0")])
  })

  it("B-DEM-1b: пометки разных батарей независимы", () => {
    const marks = addBatteryMark(addBatteryMark([], "b0", "m1"), "y", "m2")
    expect(marks).toEqual([mark("m1", "b0"), mark("m2", "y")])
  })

  it("B-DEM-2: повторная пометка уже помеченной батареи ничего не меняет (тот же состав, без новой записи)", () => {
    const once = addBatteryMark([], "b0", "m1")
    expect(addBatteryMark(once, "b0", "m9")).toEqual(once)
  })

  it("B-DEM-1c: список не мутируется", () => {
    const base: BatteryMark[] = Object.freeze([mark("m1", "b0")]) as BatteryMark[]
    expect(() => addBatteryMark(base, "y", "m2")).not.toThrow()
    expect(base).toHaveLength(1)
  })
})

describe("снятие пометки", () => {
  it("B-DEM-3: ластик снимает пометку по идентификатору, остальные остаются", () => {
    const marks = [mark("m1", "b0"), mark("m2", "y")]
    expect(removeBatteryMark(marks, "m1")).toEqual([mark("m2", "y")])
  })

  it("B-DEM-3b: снятие несуществующей пометки ничего не меняет", () => {
    const marks = [mark("m1", "b0")]
    expect(removeBatteryMark(marks, "zzz")).toEqual(marks)
  })

  it("B-DEM-3c: после снятия повторная пометка той же батареи допустима", () => {
    expect(addBatteryMark(removeBatteryMark([mark("m1", "b0")], "m1"), "b0", "m3")).toEqual([mark("m3", "b0")])
  })
})

describe("попадание в область сноса батареи", () => {
  const marks = [mark("m1", "b0")]

  it("B-DEM-3d: клик внутри прямоугольника помеченной батареи находит пометку", () => {
    expect(batteryMarkAt({ x: 135, y: 18 }, marks, [X, Y], [W], 0)).toEqual(marks[0])
  })

  it("B-DEM-10: клик вне прямоугольника (отступ, стена, пустое место, непомеченная батарея) пометку не находит", () => {
    expect(batteryMarkAt({ x: 135, y: 11.5 }, marks, [X, Y], [W], 0)).toBeNull()
    expect(batteryMarkAt({ x: 135, y: 0 }, marks, [X, Y], [W], 0)).toBeNull()
    expect(batteryMarkAt({ x: 250, y: 100 }, marks, [X, Y], [W], 0)).toBeNull()
    expect(batteryMarkAt({ x: 335, y: 18 }, marks, [X, Y], [W], 0)).toBeNull() // Y не помечена
  })

  it("B-DEM-9: без пометок помеченных батарей нет", () => {
    expect(demolishedBatteries([], [X, Y])).toEqual([])
  })
})

describe("пометка следует за батареей", () => {
  it("B-DEM-5: батарея перемещена — пометка на новом месте (помеченными считаются батареи по идентификатору, а не координаты)", () => {
    const moved = bat("W", "a", 150)
    const marks = [mark("m1", "b0")]
    expect(demolishedBatteries(marks, [moved, Y])).toEqual([moved])
    expect(batteryMarkAt({ x: 185, y: 18 }, marks, [moved, Y], [W], 0)).toEqual(marks[0])
    expect(batteryMarkAt({ x: 105, y: 18 }, marks, [moved, Y], [W], 0)).toBeNull()
  })

  it("B-DEM-5b: пометка не нужна для вида: помеченные батареи возвращаются в порядке списка батарей", () => {
    expect(demolishedBatteries([mark("m2", "y"), mark("m1", "b0")], [X, Y])).toEqual([X, Y])
  })
})

describe("пометка на отсутствующую батарею", () => {
  it("B-DEM-6: удаление батареи убирает её пометку (живые пометки не содержат ссылок на несуществующие батареи)", () => {
    const marks = [mark("m1", "b0"), mark("m2", "y")]
    expect(liveBatteryMarks(marks, [Y])).toEqual([mark("m2", "y")])
    expect(liveBatteryMarks(marks, [])).toEqual([])
  })

  it("B-DEM-6b: пометка на отсутствующую батарею не находится кликом и не даёт помеченных батарей", () => {
    expect(demolishedBatteries([mark("m1", "gone")], [X, Y])).toEqual([])
    expect(batteryMarkAt({ x: 135, y: 18 }, [mark("m1", "gone")], [X, Y], [W], 0)).toBeNull()
  })

  it("B-DEM-6c: отмена удаления (батарея вернулась) возвращает и пометку", () => {
    const marks = [mark("m1", "b0")]
    expect(liveBatteryMarks(marks, [])).toEqual([])
    expect(liveBatteryMarks(marks, [X])).toEqual(marks)
  })
})
