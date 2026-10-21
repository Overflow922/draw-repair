import { describe, expect, it } from "vitest"
import { parseLengthField } from "../length-field"
import type { Table } from "../types"
import { TABLE_DEFAULTS, editParams, panelValues, parseAngleField } from "./table-params"

// change furniture-plan-table: параметры панели «Стол» (spec furniture-plan «Панель группы «Мебель» и инструмента «Стол»»)

const table: Table = { id: "t", x: 0, y: 0, widthCm: 80, lengthCm: 160, angleDeg: 0 }

describe("значения по умолчанию", () => {
  it("FP-120: ширина 80 см, длина 160 см, угол 0", () => {
    expect(TABLE_DEFAULTS).toEqual({ widthCm: 80, lengthCm: 160, angleDeg: 0 })
  })
})

describe("разбор полей", () => {
  it("FP-121: длина в текущей единице → сантиметры; запятая допустима", () => {
    expect(parseLengthField("100", "cm")).toBe(100)
    expect(parseLengthField("1,2", "m")).toBeCloseTo(120)
    expect(parseLengthField("900", "mm")).toBeCloseTo(90)
  })

  it("FP-121: нечисло, ноль и отрицательное длиной не принимаются", () => {
    for (const bad of ["", "abc", "0", "-5"]) expect(parseLengthField(bad, "cm")).toBeNull()
  })

  it("FP-122: угол приводится к [0, 360): 360 → 0, −90 → 270, 450 → 90; ноль допустим", () => {
    expect(parseAngleField("360")).toBe(0)
    expect(parseAngleField("-90")).toBe(270)
    expect(parseAngleField("450")).toBe(90)
    expect(parseAngleField("0")).toBe(0)
    expect(parseAngleField("12,5")).toBe(12.5)
  })

  it("FP-122: нечисловой угол не принимается", () => {
    expect(parseAngleField("")).toBeNull()
    expect(parseAngleField("abc")).toBeNull()
  })
})

describe("панель", () => {
  it("FP-123: без выделенного стола панель показывает значения для новых, с выделенным — его значения", () => {
    expect(panelValues(TABLE_DEFAULTS, null)).toEqual(TABLE_DEFAULTS)
    expect(panelValues(TABLE_DEFAULTS, { ...table, widthCm: 90, lengthCm: 200, angleDeg: 30 })).toEqual({ widthCm: 90, lengthCm: 200, angleDeg: 30 })
  })

  it("FP-124: без выделения правка меняет значения для новых столов", () => {
    const r = editParams(TABLE_DEFAULTS, null, { widthCm: 100, lengthCm: 200, angleDeg: 45 })
    expect(r.params).toEqual({ widthCm: 100, lengthCm: 200, angleDeg: 45 })
    expect(r.table).toBeNull()
  })

  it("FP-125: с выделенным столом правка меняет стол, а значения для новых не меняются", () => {
    const r = editParams(TABLE_DEFAULTS, table, { widthCm: 90 })
    expect(r.table).toEqual({ ...table, widthCm: 90 })
    expect(r.params).toEqual(TABLE_DEFAULTS)
  })

  it("FP-125: поворот выделенного стола не меняет центр", () => {
    const r = editParams(TABLE_DEFAULTS, { ...table, x: 300, y: 200 }, { angleDeg: 30 })
    expect(r.table).toMatchObject({ x: 300, y: 200, angleDeg: 30 })
  })

  it("FP-126: некорректные значения не применяются; без изменений стол не возвращается", () => {
    expect(editParams(TABLE_DEFAULTS, table, { widthCm: 0 }).table).toBeNull()
    expect(editParams(TABLE_DEFAULTS, table, { lengthCm: -3 }).table).toBeNull()
    expect(editParams(TABLE_DEFAULTS, table, { angleDeg: Number.NaN }).table).toBeNull()
    expect(editParams(TABLE_DEFAULTS, table, { widthCm: 80 }).table).toBeNull()
    expect(editParams(TABLE_DEFAULTS, null, { widthCm: 0 }).params).toEqual(TABLE_DEFAULTS)
  })

  it("FP-126: угол в правке приводится к диапазону", () => {
    expect(editParams(TABLE_DEFAULTS, table, { angleDeg: 450 }).table?.angleDeg).toBe(90)
    expect(editParams(TABLE_DEFAULTS, null, { angleDeg: -90 }).params.angleDeg).toBe(270)
  })
})
