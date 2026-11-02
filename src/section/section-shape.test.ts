import { describe, expect, it } from "vitest"
import type { SectionShape } from "../types"
import { dragShape, figureFrame, insideFrame, isValidShapeBounds, moveShape, resizeShape, shapeFromCorners } from "./section-shape"

// change add-section-shapes: деталь разреза (spec section-view «Деталь разреза», «Выделение, перемещение и правка детали разреза»)
//
//   фигура 220 x 250 (s вправо, z вверх), полка s 30..190, z 120..125                 схематично, не в масштабе
//
//   z=250 +---------------------+
//         |                     |
//   z=125 |   +=============+   |
//   z=120 |   +=============+   |
//   z=0   +---------------------+
//         s=0 30          190 220
const FRAME = { left: 0, right: 220, height: 250 }
const SHELF: SectionShape = { id: "p", lineId: "L", s0: 30, s1: 190, z0: 120, z1: 125 }

describe("прямоугольник по двум углам", () => {
  it("SH-100: углы можно задавать в любом порядке", () => {
    const a = shapeFromCorners({ s: 10, z: 120 }, { s: 210, z: 125 }, "p", "L")
    const b = shapeFromCorners({ s: 210, z: 125 }, { s: 10, z: 120 }, "p", "L")
    expect(a).toEqual({ id: "p", lineId: "L", s0: 10, s1: 210, z0: 120, z1: 125 })
    expect(b).toEqual(a)
  })

  it("SH-101: нулевая высота или ширина — не деталь", () => {
    expect(shapeFromCorners({ s: 10, z: 120 }, { s: 210, z: 120 }, "p", "L")).toBeNull()
    expect(shapeFromCorners({ s: 10, z: 120 }, { s: 10, z: 125 }, "p", "L")).toBeNull()
  })

  it("SH-102: проверка границ: s0 < s1, z0 < z1, конечные числа", () => {
    expect(isValidShapeBounds(SHELF)).toBe(true)
    expect(isValidShapeBounds({ ...SHELF, s1: 30 })).toBe(false)
    expect(isValidShapeBounds({ ...SHELF, z0: 130 })).toBe(false)
    expect(isValidShapeBounds({ ...SHELF, s0: Number.NaN })).toBe(false)
    expect(isValidShapeBounds({ ...SHELF, z1: Number.POSITIVE_INFINITY })).toBe(false)
  })

  it("SH-103: деталь внутри прямоугольника фигуры", () => {
    expect(insideFrame(SHELF, FRAME)).toBe(true)
    expect(insideFrame({ ...SHELF, s1: 221 }, FRAME)).toBe(false)
    expect(insideFrame({ ...SHELF, z0: -1 }, FRAME)).toBe(false)
  })
})

describe("габариты при неподвижном центре", () => {
  it("SH-110: ширина 100 при центре s = 110 даёт 60…160", () => {
    expect(resizeShape(SHELF, "width", 100, FRAME)).toEqual({ ...SHELF, s0: 60, s1: 160 })
  })

  it("SH-111: высота меняется вокруг центра по z", () => {
    expect(resizeShape(SHELF, "height", 11, FRAME)).toEqual({ ...SHELF, z0: 117, z1: 128 })
  })

  it("SH-112: не число, ноль и отрицательное значение не применяются", () => {
    for (const v of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(resizeShape(SHELF, "width", v, FRAME)).toBeNull()
  })

  it("SH-113: выход за фигуру отклоняется целиком, а не обрезается", () => {
    expect(resizeShape(SHELF, "width", 250, FRAME)).toBeNull()
  })

  it("SH-114: то же значение — не правка", () => {
    expect(resizeShape(SHELF, "width", 160, FRAME)).toBeNull()
  })
})

describe("сдвиг стрелками", () => {
  it("SH-120: шаг 10 вверх", () => {
    expect(moveShape(SHELF, 0, 10, FRAME)).toEqual({ ...SHELF, z0: 130, z1: 135 })
  })

  it("SH-121: Shift — шаг 1 вправо", () => {
    expect(moveShape(SHELF, 1, 0, FRAME)).toEqual({ ...SHELF, s0: 31, s1: 191 })
  })

  it("SH-122: сдвиг за границу фигуры ничего не меняет", () => {
    const top = { ...SHELF, z0: 245, z1: 250 }
    expect(moveShape(top, 0, 10, FRAME)).toBeNull()
    expect(moveShape(SHELF, 40, 0, FRAME)).toBeNull()
  })

  it("SH-123: нулевой сдвиг — не правка", () => {
    expect(moveShape(SHELF, 0, 0, FRAME)).toBeNull()
  })
})

describe("перетаскивание мышью", () => {
  it("SH-130: сдвиг округляется до 1 см", () => {
    expect(dragShape(SHELF, 10.4, 0, FRAME)).toEqual({ ...SHELF, s0: 40, s1: 200 })
  })

  it("SH-131: у границы фигуры деталь останавливается, а не выходит", () => {
    expect(dragShape(SHELF, 500, 0, FRAME)).toEqual({ ...SHELF, s0: 60, s1: 220 })
    expect(dragShape(SHELF, 0, -500, FRAME)).toEqual({ ...SHELF, z0: 0, z1: 5 })
  })

  it("SH-132: жест, не сдвинувший деталь, — null (шага истории нет)", () => {
    expect(dragShape(SHELF, 0.3, -0.2, FRAME)).toBeNull()
    expect(dragShape({ ...SHELF, s0: 60, s1: 220 }, 500, 0, FRAME)).toBeNull()
  })
})

describe("габарит сечений", () => {
  // сечения s 20..220 на линии s 0..240: деталь не выходит левее s = 20 и правее s = 220
  const frame = figureFrame({ width: 240, height: 250, pieces: [{ wallId: "W", segment: 0, s0: 20, s1: 220, heightCm: 250 }] })

  it("SH-133: рамка — от левого края левого сечения до правого края правого", () => {
    expect(frame).toEqual({ left: 20, right: 220, height: 250 })
    expect(figureFrame({ width: 240, height: 0, pieces: [] })).toEqual({ left: 0, right: 240, height: 0 })
  })

  it("SH-134: перетаскивание влево останавливается на левом краю сечений, ввод левее отклонён", () => {
    expect(dragShape(SHELF, -500, 0, frame)).toMatchObject({ s0: 20, s1: 20 + (SHELF.s1 - SHELF.s0) })
    expect(moveShape({ ...SHELF, s0: 20, s1: 60 }, -10, 0, frame)).toBeNull()
    expect(insideFrame({ ...SHELF, s0: 19, s1: 60 }, frame)).toBe(false)
  })
})

describe("привязка при перетаскивании", () => {
  const frame = { left: 0, right: 300, height: 250 }
  const box: SectionShape = { id: "b", lineId: "L", s0: 0, s1: 40, z0: 0, z1: 10 }

  it("SH-135: край в радиусе привязки притягивается к грани точно, по каждой оси независимо", () => {
    const snap = { s: [100], z: [30], radiusCm: 3 }
    // правый край 99 -> 100, верх 29 -> 30: углы совпали; остальные размеры прежние
    expect(dragShape(box, 59, 19, frame, snap)).toEqual({ ...box, s0: 60, s1: 100, z0: 20, z1: 30 })
    // по z: верх 20,4 дальше радиуса от грани 30 — обычное округление сдвига до 1 см (10)
    expect(dragShape(box, 59, 10.4, frame, snap)).toEqual({ ...box, s0: 60, s1: 100, z0: 10, z1: 20 })
  })

  it("SH-136: левый край тоже притягивается; дальше радиуса — обычное округление", () => {
    expect(dragShape(box, 101.6, 0, frame, { s: [100], z: [], radiusCm: 3 })).toEqual({ ...box, s0: 100, s1: 140 })
    expect(dragShape(box, 70.4, 0, frame, { s: [100], z: [], radiusCm: 3 })).toEqual({ ...box, s0: 70, s1: 110 })
  })

  it("SH-137: притянутый результат тоже зажат прямоугольником фигуры", () => {
    expect(dragShape(box, -1, 0, frame, { s: [-2], z: [], radiusCm: 3 })).toBeNull()
  })
})
