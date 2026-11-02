import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { SectionLine } from "../types"
import { pickSection } from "./section-hit"
import { SECTION_ARROW_CM, SECTION_BAR_GAP_CM, SECTION_BAR_OVERHANG_CM, SECTION_STROKE_CM, dashedPath, endMarks } from "./section-marks"

// change add-section-view: обозначение линии и выбор кликом (spec section-view «Обозначение линии разреза на плане»,
// «Выделение и удаление линии разреза»)

const A: SectionLine = { id: "A1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const entries = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: [A] } })).sections

describe("обозначение линии", () => {
  // как на references/sections.png: стрелка по взгляду лежит с противоположной стороны линии, остриё — в конце жирного штриха
  it("SV-100: на каждом конце жирный штрих внутрь линии и стрелка взгляда, остриём упирающаяся в конец линии", () => {
    const [first, last] = endMarks(A)
    expect(first.end).toEqual({ x: 200, y: -100 })
    expect(first.tail).toEqual({ x: 200 - SECTION_ARROW_CM, y: -100 })
    expect(first.strokeTo).toEqual({ x: 200, y: -100 + SECTION_STROKE_CM })
    expect(last.end).toEqual({ x: 200, y: 100 })
    expect(last.tail).toEqual({ x: 200 - SECTION_ARROW_CM, y: 100 })
    expect(last.strokeTo).toEqual({ x: 200, y: 100 - SECTION_STROKE_CM })
  })

  it("SV-108: обозначение стоит сбоку от стрелки, снаружи от линии", () => {
    const [first, last] = endMarks(A)
    expect(first.labelAt.x).toBeCloseTo(200 - SECTION_ARROW_CM / 2, 9)
    expect(first.labelAt.y).toBeLessThan(first.end.y)
    expect(last.labelAt.y).toBeGreaterThan(last.end.y)
  })

  it("SV-109: жирный штрих выступает наружу за стрелку, штриховая линия начинается с зазором за штрихом", () => {
    const [first, last] = endMarks(A)
    expect(first.strokeFrom).toEqual({ x: 200, y: -100 - SECTION_BAR_OVERHANG_CM })
    expect(last.strokeFrom).toEqual({ x: 200, y: 100 + SECTION_BAR_OVERHANG_CM })
    expect(dashedPath(A)).toEqual([
      { x: 200, y: -100 + SECTION_STROKE_CM + SECTION_BAR_GAP_CM },
      { x: 200, y: 100 - SECTION_STROKE_CM - SECTION_BAR_GAP_CM },
    ])
  })

  it("SV-110: ступеньки остаются в штриховой линии; у слишком короткой линии штриховой части нет", () => {
    const stepped: SectionLine = { ...A, points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 400, y: 100 }] }
    expect(dashedPath(stepped)?.slice(1, -1)).toEqual([{ x: 200, y: 0 }, { x: 200, y: 100 }])
    const short: SectionLine = { ...A, points: [{ x: 0, y: 0 }, { x: 0, y: 40 }] }
    expect(dashedPath(short)).toBeNull()
  })

  it("SV-101: жирный штрих не длиннее самого отрезка", () => {
    const short: SectionLine = { ...A, points: [{ x: 0, y: 0 }, { x: 0, y: 10 }] }
    expect(endMarks(short)[0].strokeTo).toEqual({ x: 0, y: 10 })
  })

  it("SV-111: концевой штрих целиком (с выступом) короче стрелки, как на references/sections.png (штрих укорочен на 33 %)", () => {
    const [first] = endMarks(A)
    const bar = Math.hypot(first.strokeTo.x - first.strokeFrom.x, first.strokeTo.y - first.strokeFrom.y)
    const arrow = Math.hypot(first.end.x - first.tail.x, first.end.y - first.tail.y)
    expect(bar).toBeLessThan(arrow)
    expect(bar / arrow).toBeGreaterThan(0.5)
  })

  it.each([
    ["up", { x: 0, y: SECTION_ARROW_CM }],
    ["down", { x: 0, y: -SECTION_ARROW_CM }],
  ] as const)("SV-102: стрелка при взгляде %s начинается с противоположной стороны и идёт к концу линии", (view, delta) => {
    const l: SectionLine = { ...A, view, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }
    expect(endMarks(l)[0].tail).toEqual({ x: delta.x, y: delta.y })
  })
})

describe("выбор", () => {
  it("SV-103: клик у отрезка линии выбирает линию", () => {
    expect(pickSection(entries, { x: 203, y: 20 }, 5)).toBe("A1")
  })

  it("SV-104: клик у обозначения выбирает линию", () => {
    const [first] = endMarks(A)
    expect(pickSection(entries, first.labelAt, 5)).toBe("A1")
  })

  it("SV-105: клик по штриховке сечения в фигуре выбирает линию", () => {
    // фигура: x от 400, пол y = 5; сечение стены шириной 10 (s' 95…105) и высотой 250
    expect(pickSection(entries, { x: 500, y: -100 }, 5)).toBe("A1")
  })

  it("SV-106: клик по названию фигуры (над её верхом) выбирает линию", () => {
    expect(pickSection(entries, { x: 500, y: -245 - 5 }, 5)).toBe("A1")
  })

  it("SV-107: клик по пустому месту фигуры и по стене плана линию не выбирает", () => {
    expect(pickSection(entries, { x: 420, y: -100 }, 5)).toBeNull()
    expect(pickSection(entries, { x: 150, y: 0 }, 5)).toBeNull()
  })
})
