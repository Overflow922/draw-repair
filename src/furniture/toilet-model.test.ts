import { describe, expect, it } from "vitest"
import type { FurnitureItem } from "../types"
import { kindEntry } from "./furniture-kinds"
import { newItem } from "./item"
import { defaultParams, editParams, panelValues } from "./item-params"
import { scaleToilet } from "./toilet"

// change add-toilet: модель унитаза (spec furniture-plan «Унитаз», «Панель унитаза»). Эталоны посчитаны вручную по сценариям спеки.

const toiletAt = (x: number, y: number): FurnitureItem => newItem("t", "toilet", { x, y }, defaultParams("toilet"))

describe("унитаз в каталоге", () => {
  it("TLT-01: вид «Унитаз» — прибор 70 × 72 с четырьмя размерами 38 / 52 / 70 / 20 по умолчанию", () => {
    const e = kindEntry("toilet")
    expect(e.label).toBe("Унитаз")
    expect(e.plaqueWord).toBe("унитаз")
    expect(e.water).toBe(true)
    expect(e.icon.length).toBeGreaterThan(0)
    expect(e.defaults).toEqual({
      widthCm: 70,
      lengthCm: 72,
      angleDeg: 0,
      toilet: { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 },
    })
  })

  it("TLT-02: новый унитаз хранит четыре размера, ширину 70 и длину 72", () => {
    expect(toiletAt(100, 100)).toEqual({
      id: "t",
      kind: "toilet",
      x: 100,
      y: 100,
      widthCm: 70,
      lengthCm: 72,
      angleDeg: 0,
      toilet: { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 },
    })
  })

  it("TLT-03: у предметов других видов полей унитаза нет", () => {
    expect(newItem("s", "sink", { x: 0, y: 0 }, defaultParams("sink"))).not.toHaveProperty("toilet")
    expect(defaultParams("table")).not.toHaveProperty("toilet")
  })
})

describe("правка размеров унитаза", () => {
  it("TLT-10: глубина блока 25 даёт длину предмета 77, ширина и длина чаши, центр и угол прежние", () => {
    const edited = editParams(defaultParams("toilet"), toiletAt(100, 100), { toilet: { blockDepthCm: 25 } }).table
    expect(edited).toMatchObject({ x: 100, y: 100, angleDeg: 0, widthCm: 70, lengthCm: 77 })
    expect(edited?.toilet).toEqual({ bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 25 })
  })

  it("TLT-11: ширина блока 80 даёт ширину предмета 80, остальные размеры прежние", () => {
    const edited = editParams(defaultParams("toilet"), toiletAt(100, 100), { toilet: { blockWidthCm: 80 } }).table
    expect(edited).toMatchObject({ widthCm: 80, lengthCm: 72 })
    expect(edited?.toilet).toEqual({ bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 80, blockDepthCm: 20 })
  })

  it("TLT-12: длина чаши 60 даёт длину предмета 80", () => {
    expect(editParams(defaultParams("toilet"), toiletAt(0, 0), { toilet: { bowlLengthCm: 60 } }).table).toMatchObject({ widthCm: 70, lengthCm: 80 })
  })

  it("TLT-13: ширина чаши больше ширины блока не применяется", () => {
    expect(editParams(defaultParams("toilet"), toiletAt(0, 0), { toilet: { bowlWidthCm: 80 } }).table).toBeNull()
  })

  it("TLT-14: ширина блока меньше ширины чаши не применяется", () => {
    expect(editParams(defaultParams("toilet"), toiletAt(0, 0), { toilet: { blockWidthCm: 30 } }).table).toBeNull()
  })

  it("TLT-15: длина чаши меньше половины её ширины не применяется, ровно половина — применяется", () => {
    expect(editParams(defaultParams("toilet"), toiletAt(0, 0), { toilet: { bowlLengthCm: 18 } }).table).toBeNull()
    expect(editParams(defaultParams("toilet"), toiletAt(0, 0), { toilet: { bowlLengthCm: 19 } }).table).toMatchObject({ lengthCm: 39 })
  })

  it.each([0, -5, Number.NaN])("TLT-16: размер %s не применяется", (v) => {
    expect(editParams(defaultParams("toilet"), toiletAt(0, 0), { toilet: { blockDepthCm: v } }).table).toBeNull()
  })

  it("TLT-17: без выделенного унитаза правка меняет значения для новых, предмета нет", () => {
    const r = editParams(defaultParams("toilet"), null, { toilet: { blockDepthCm: 25 } })
    expect(r.table).toBeNull()
    expect(r.params.toilet).toEqual({ bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 25 })
    expect(r.params).toMatchObject({ widthCm: 70, lengthCm: 77 })
  })

  it("TLT-18: правка выделенного унитаза не меняет значения для новых", () => {
    const params = defaultParams("toilet")
    expect(editParams(params, toiletAt(0, 0), { toilet: { blockWidthCm: 80 } }).params).toEqual(params)
  })

  it("TLT-19: угол правится и у унитаза", () => {
    expect(editParams(defaultParams("toilet"), toiletAt(0, 0), { angleDeg: 90 }).table).toMatchObject({ angleDeg: 90, widthCm: 70, lengthCm: 72 })
  })

  it("TLT-20: панель выделенного унитаза показывает его размеры", () => {
    const selected = editParams(defaultParams("toilet"), toiletAt(0, 0), { toilet: { blockWidthCm: 80 } }).table
    expect(panelValues(defaultParams("toilet"), selected).toilet).toEqual({ bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 80, blockDepthCm: 20 })
  })
})

describe("масштаб размеров унитаза", () => {
  it("TLT-30: все четыре размера в одном отношении (образец легенды): 0,5 даёт 19 / 26 / 35 / 10", () => {
    expect(scaleToilet({ bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 }, 0.5)).toEqual({ bowlWidthCm: 19, bowlLengthCm: 26, blockWidthCm: 35, blockDepthCm: 10 })
  })
})
