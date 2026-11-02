import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Point, SectionLine } from "../types"
import { SECTION_BAR_GAP_CM, SECTION_STROKE_CM, dashedPath, endMarks } from "./section-marks"

// change add-section-view: жирные штрихи на концах линии одинаковой длины и не заходят на разрезаемую стену — у стены
// конец линии выносится наружу, а штрих не укорачивается (spec section-view «Обозначение линии разреза на плане»)
//
//   y = -30  ##  конец линии вынесен: до грани стены хватает на штрих (10,72) и зазор (10)
//   y = -19  ##  штрих кончается
//   y = -9   . . зазор 10 см
//   y = -5  ======= стена W (ось y = 0, толщина 10) ======= режется линией x = 200
//                                        схематично, не в масштабе
const entriesOf = (line: SectionLine) =>
  reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: [line] } })).sections

const line = (y0: number, y1: number): SectionLine => ({ id: "L", label: "A", view: "right", points: [{ x: 200, y: y0 }, { x: 200, y: y1 }] })
const length = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)

describe("штрихи у стены", () => {
  it("SV-150: у стены конец линии выносится наружу, чтобы вошёл штрих полной длины и зазор до грани", () => {
    const [entry] = entriesOf(line(-20, 100))
    // стена W занимает y = -5…5; до конца -20 только 15 см, а нужно 16 + 10
    expect(entry.shown.points[0].y).toBeLessThanOrEqual(-5 - SECTION_BAR_GAP_CM - SECTION_STROKE_CM)
    expect(entry.line.points[0].y).toBe(-20)
    const [first] = endMarks(entry.shown)
    expect(first.strokeTo.y).toBeLessThanOrEqual(-5 - SECTION_BAR_GAP_CM + 1e-9)
  })

  it("SV-151: у обоих концов штрихи одной длины, даже когда у одного конца рядом стена", () => {
    const [entry] = entriesOf(line(-20, 100))
    const [first, last] = endMarks(entry.shown)
    expect(length(first.end, first.strokeTo)).toBeCloseTo(SECTION_STROKE_CM, 9)
    expect(length(last.end, last.strokeTo)).toBeCloseTo(SECTION_STROKE_CM, 9)
  })

  it("SV-152: штриховая линия начинается за штрихом с зазором, от вынесенного конца", () => {
    const [entry] = entriesOf(line(-20, 100))
    const path = dashedPath(entry.shown)
    expect(path?.[0].y).toBeCloseTo(entry.shown.points[0].y + SECTION_STROKE_CM + SECTION_BAR_GAP_CM, 9)
  })

  it("SV-153: конец линии в разрезаемой стене выносится за неё, штрих полной длины", () => {
    const [entry] = entriesOf(line(0, 100))
    expect(entry.shown.points[0].y).toBeLessThanOrEqual(-5 - SECTION_BAR_GAP_CM - SECTION_STROKE_CM)
    const [first] = endMarks(entry.shown)
    expect(length(first.end, first.strokeTo)).toBeCloseTo(SECTION_STROKE_CM, 9)
  })

  it("SV-154: стены рядом нет — конец остаётся на месте", () => {
    const [entry] = entriesOf(line(-300, 300))
    expect(entry.shown.points).toEqual(entry.line.points)
  })

  it("SV-155: то же у другого конца линии", () => {
    const [entry] = entriesOf(line(-100, 20))
    expect(entry.shown.points[1].y).toBeGreaterThanOrEqual(5 + SECTION_BAR_GAP_CM + SECTION_STROKE_CM)
    const [, last] = endMarks(entry.shown)
    expect(last.strokeTo.y).toBeGreaterThanOrEqual(5 + SECTION_BAR_GAP_CM - 1e-9)
  })
})
