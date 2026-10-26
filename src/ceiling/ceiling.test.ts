import { describe, expect, it } from "vitest"
import { findRooms } from "../room-area"
import { reconcileRooms } from "../room-explication"
import { idGen, rectWalls } from "../rough/rough.test-utils"
import type { StretchCeiling, Wall } from "../types"
import { CEILING_DROP_DEFAULT, addCeiling, ceilingLabel, isDropMm, parseDropMm, removeCeiling, setCeilingDrop } from "./ceiling"

// change add-ceiling-plan: модель натяжного потолка — значение опускания, подпись, постановка, правка
// (spec ceiling-plan «Натяжной потолок помещения», «Инструмент «Натяжной потолок»», «Подпись натяжного потолка и правка на месте»)

const ceiling = (id: string, x: number, y: number, dropMm = 50): StretchCeiling => ({ id, at: { x, y }, dropMm })
// комната K: внутренняя область [10,410]×[10,310]
const roomItems = (walls: Wall[] = rectWalls("k", 0, 0, 420, 320)) => reconcileRooms(findRooms(walls), [])

describe("опускание", () => {
  it("CP-30: значение по умолчанию — 50", () => {
    expect(CEILING_DROP_DEFAULT).toBe(50)
  })

  it("CP-31: целое число больше нуля применяется, верхней границы нет", () => {
    expect(parseDropMm("50")).toBe(50)
    expect(parseDropMm(" 80 ")).toBe(80)
    expect(parseDropMm("450")).toBe(450)
    expect(parseDropMm("5000")).toBe(5000)
    expect(parseDropMm("1")).toBe(1)
  })

  it("CP-32: ноль, отрицательное, дробное, нечисловое и пустое не применяются", () => {
    for (const text of ["0", "-50", "-80", "2,5", "2.5", "abc", "", " ", "50мм", "1e3"]) expect(parseDropMm(text)).toBeNull()
  })

  it("CP-33: проверка значения документа — целое больше нуля", () => {
    expect(isDropMm(50)).toBe(true)
    expect(isDropMm(1)).toBe(true)
    for (const v of [0, -5, 2.5, Number.NaN, Number.POSITIVE_INFINITY, "50", null, undefined]) expect(isDropMm(v)).toBe(false)
  })

  it("CP-34: подпись — «-<опускание>мм»", () => {
    expect(ceilingLabel(50)).toBe("-50мм")
    expect(ceilingLabel(450)).toBe("-450мм")
  })
})

describe("постановка", () => {
  it("CP-35: клик в помещении без потолка ставит потолок в точке клика с опусканием из панели", () => {
    expect(addCeiling([], roomItems(), { x: 210, y: 170 }, 50, idGen())).toEqual([ceiling("n1", 210, 170, 50)])
  })

  it("CP-36: в помещении с действующим потолком, вне помещений и в теле стены — тот же массив", () => {
    const list = [ceiling("s", 200, 160)]
    expect(addCeiling(list, roomItems(), { x: 100, y: 100 }, 80, idGen())).toBe(list)
    expect(addCeiling(list, roomItems(), { x: 600, y: 160 }, 80, idGen())).toBe(list)
    expect(addCeiling(list, roomItems(), { x: 5, y: 160 }, 80, idGen())).toBe(list)
  })

  it("CP-37: серия постановок в двух помещениях — два потолка в порядке постановки", () => {
    const items = roomItems([...rectWalls("k", 0, 0, 420, 320), { id: "p", a: { x: 200, y: 0 }, b: { x: 200, y: 320 }, thicknessCm: 20, type: "brick" }])
    const id = idGen()
    const one = addCeiling([], items, { x: 100, y: 160 }, 50, id)
    const two = addCeiling(one, items, { x: 300, y: 160 }, 80, id)
    expect(two).toEqual([ceiling("n1", 100, 160, 50), ceiling("n2", 300, 160, 80)])
  })
})

describe("снятие и опускание", () => {
  it("CP-38: removeCeiling и неизвестный идентификатор", () => {
    const list = [ceiling("a", 100, 100), ceiling("b", 300, 200)]
    expect(removeCeiling(list, "a")).toEqual([ceiling("b", 300, 200)])
    expect(removeCeiling(list, "x")).toBe(list)
  })

  it("CP-39: setCeilingDrop меняет только опускание; то же значение или неизвестный потолок — тот же массив", () => {
    const list = [ceiling("a", 100, 100, 50)]
    expect(setCeilingDrop(list, "a", 80)).toEqual([ceiling("a", 100, 100, 80)])
    expect(setCeilingDrop(list, "a", 50)).toBe(list)
    expect(setCeilingDrop(list, "zz", 80)).toBe(list)
  })
})
