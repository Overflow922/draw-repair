import { describe, expect, it } from "vitest"
import type { SectionShape } from "../types"
import { setGap, shapeGaps } from "./section-shape-gaps"

// change add-section-shapes: расстояния детали до граней (spec section-view «Выделение, перемещение и правка детали разреза»)
//
//   фигура 220 x 250; сечения стен s 0..10 и s 210..220 (высота 250); полка s 30..190, z 120..125     схематично, не в масштабе
//
//   //|<-- 20 -->+==========+<-- 20 -->|//
//   //|          |    160   |           |//     z = 125
//   //|                 ^                |//
//   //|                 | 120            |//
//   ---------------------------------------      пол z = 0
const FRAME = { left: 0, right: 220, height: 250 }
const FIG = { width: 220, height: 250 }
const piece = (s0: number, s1: number) => ({ wallId: "W", segment: 0, s0, s1, heightCm: 250 })
const FIGURE = { ...FIG, pieces: [piece(0, 10), piece(210, 220)] }
const SHELF: SectionShape = { id: "p", lineId: "L", s0: 30, s1: 190, z0: 120, z1: 125 }
const gapOf = (shape: SectionShape, others: SectionShape[] = [], figure = FIGURE) => Object.fromEntries(shapeGaps(shape, figure, others).map((g) => [g.side, g]))

describe("расстояния до граней", () => {
  // TCR (change add-section-shapes, правка по замечанию пользователя): края фигуры — грани, сверху расстояние до верха фигуры
  it("SH-150: до сечений слева и справа, до пола снизу и до верха фигуры сверху", () => {
    const g = gapOf(SHELF)
    expect(g.left?.distance).toBe(20)
    expect(g.right?.distance).toBe(20)
    expect(g.bottom?.distance).toBe(120)
    expect(g.top).toMatchObject({ distance: 125, face: 250 })
  })

  it("SH-151: размерная линия идёт через середину участка стороны, перекрытого гранью", () => {
    const g = gapOf(SHELF)
    expect(g.left).toMatchObject({ face: 10, at: 122.5 })
    expect(g.bottom).toMatchObject({ face: 0, at: 110 })
  })

  it("SH-152: расстояние до другой детали сверху", () => {
    const block: SectionShape = { id: "b", lineId: "L", s0: 10, s1: 210, z0: 190, z1: 250 }
    expect(gapOf(SHELF, [block]).top?.distance).toBe(65)
    expect(gapOf(block, [SHELF]).bottom?.distance).toBe(65)
  })

  it("SH-153: сама деталь в список других не входит", () => {
    expect(gapOf(SHELF, [SHELF]).top?.distance).toBe(125) // до верха фигуры, а не до самой себя
  })

  it("SH-154: деталь, не перекрывающая грань по другой оси, её не видит", () => {
    const high: SectionShape = { id: "b", lineId: "L", s0: 30, s1: 190, z0: 200, z1: 205 }
    // сечения стен высотой 250 всё равно перекрывают по z, но отдельная деталь выше полки не мешает слева и справа
    expect(gapOf(SHELF, [high]).left?.distance).toBe(20)
  })

  // TCR (change add-section-shapes, правка по замечанию пользователя): сторона внутри сечения (углубление) меряется до внешней грани сечения
  it("SH-155: сторона, зашедшая в сечение, — расстояние до внешней грани сечения", () => {
    const deep: SectionShape = { ...SHELF, s0: 5, s1: 215 }
    const g = gapOf(deep)
    expect(g.left).toMatchObject({ distance: 5, face: 0 })
    expect(g.right).toMatchObject({ distance: 5, face: 220 })
  })

  it("SH-155a: деталь целиком в сечении на всю фигуру — расстояния до внешних граней сечения, нулей нет", () => {
    const full = { ...FIG, pieces: [piece(0, 220)] }
    const niche: SectionShape = { id: "n", lineId: "L", s0: 60, s1: 160, z0: 100, z1: 160 }
    const g = gapOf(niche, [], full)
    expect([g.left?.distance, g.right?.distance, g.bottom?.distance, g.top?.distance]).toEqual([60, 60, 100, 90])
  })

  it("SH-156: деталь на полу — расстояние снизу 0", () => {
    expect(gapOf({ ...SHELF, z0: 0, z1: 5 }).bottom).toMatchObject({ distance: 0, face: 0 })
  })

  it("SH-157: у фигуры без сечений слева и справа — до краёв фигуры", () => {
    const g = gapOf(SHELF, [], { ...FIG, pieces: [] })
    expect(g.left).toMatchObject({ distance: 30, face: 0 })
    expect(g.right).toMatchObject({ distance: 30, face: 220 })
    expect(g.bottom?.distance).toBe(120)
  })
})

describe("ввод расстояния", () => {
  const gaps = (s: SectionShape) => shapeGaps(s, FIGURE, [])

  it("SH-160: слева 50 сдвигает деталь на 30 вправо, размеры прежние", () => {
    expect(setGap(SHELF, gaps(SHELF), "left", 50, FRAME)).toEqual({ ...SHELF, s0: 60, s1: 220 })
  })

  it("SH-161: снизу 150 ставит низ на z = 150", () => {
    expect(setGap(SHELF, gaps(SHELF), "bottom", 150, FRAME)).toEqual({ ...SHELF, z0: 150, z1: 155 })
  })

  it("SH-162: справа 0 ставит сторону вплотную к грани", () => {
    expect(setGap(SHELF, gaps(SHELF), "right", 0, FRAME)).toEqual({ ...SHELF, s0: 50, s1: 210 })
  })

  it("SH-163: ввод 0 у стороны внутри сечения ставит её на внешнюю грань сечения", () => {
    const deep: SectionShape = { ...SHELF, s0: 5, s1: 215 }
    expect(setGap(deep, gaps(deep), "left", 0, FRAME)).toEqual({ ...deep, s0: 0, s1: 210 })
  })

  it("SH-164: выход за фигуру отклоняется целиком", () => {
    expect(setGap(SHELF, gaps(SHELF), "bottom", 250, FRAME)).toBeNull()
  })

  it("SH-165: не число и отрицательное не применяются", () => {
    for (const v of [-5, Number.NaN]) expect(setGap(SHELF, gaps(SHELF), "left", v, FRAME)).toBeNull()
  })

  it("SH-165a: сверху 10 ставит верх на 10 см ниже верха фигуры", () => {
    expect(setGap(SHELF, gaps(SHELF), "top", 10, FRAME)).toEqual({ ...SHELF, z0: 235, z1: 240 })
  })

  it("SH-166: то же значение — не правка", () => {
    expect(setGap(SHELF, gaps(SHELF), "left", 20, FRAME)).toBeNull()
  })
})
