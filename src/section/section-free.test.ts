import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, SectionLine } from "../types"
import { SECTION_STROKE_CM, endMarks } from "./section-marks"

// change add-section-view: штрих, стрелка и буква на концах линии стоят на свободном месте — не на стенах подложки, батареях
// и коммуникациях; разрезается только гипсокартон (spec section-view «Обозначение линии разреза на плане»)
//
//   комната 420 x 520, стены 20 (нижняя стена занимает y = 510…530), стена ГКЛ G на y = 300 (x = 100…300)
//   линия A–A: x = 200, взгляд right
//
//      y = 300   ====== G ======     линия режет G
//      y = 520   #### стена ####     конец линии стоит НА стене подложки: его выносят наружу, за y = 530 + штрих
//      y = 575   ##  <- свободное место
//                                             схематично, не в масштабе
const make = (line: SectionLine) =>
  reconstructionScene(drawing({ walls: rectWalls("k", 0, 0, 420, 520), reconstruction: { walls: [drywall("G", 100, 300, 300, 300, 10, 250)], dimensions: [], sections: [line] } })).sections[0]

const line = (y0: number, y1: number): SectionLine => ({ id: "L", label: "A", view: "right", points: [{ x: 200, y: y0 }, { x: 200, y: y1 }] })

describe("вынос концов на свободное место", () => {
  it("SV-160: конец на свободном месте остаётся на месте", () => {
    const entry = make(line(100, 450))
    expect(entry.shown.points).toEqual(entry.line.points)
  })

  it("SV-161: конец на стене подложки выносится наружу вдоль линии; хранимая линия не меняется", () => {
    const entry = make(line(100, 520))
    expect(entry.line.points).toEqual([{ x: 200, y: 100 }, { x: 200, y: 520 }])
    expect(entry.shown.points[0]).toEqual({ x: 200, y: 100 })
    // штрих (внутрь линии) и стрелка с буквой не должны задевать стену 510…530
    expect(entry.shown.points[1].y).toBeGreaterThanOrEqual(530 + SECTION_STROKE_CM)
    expect(entry.shown.points[1].x).toBe(200)
  })

  it("SV-162: после выноса штрих, стрелка и буква не лежат на стене подложки", () => {
    const entry = make(line(100, 520))
    const last = endMarks(entry.shown)[1]
    const onWall = (y: number): boolean => y >= 510 && y <= 530
    for (const p of [last.end, last.tail, last.strokeFrom, last.strokeTo, last.labelAt]) expect(onWall(p.y)).toBe(false)
  })

  it("SV-163: вынос не меняет фигуру разреза: ширина и сечения те же", () => {
    const moved = make(line(100, 520))
    const plain = make(line(100, 450))
    expect(moved.figure.pieces.map((p) => p.wallId)).toEqual(plain.figure.pieces.map((p) => p.wallId))
    expect(moved.figure.width).toBeCloseTo(420, 9)
  })

  it("SV-164: линия режет только гипсокартон: стена подложки в фигуре не появляется", () => {
    const entry = make(line(100, 520))
    expect(entry.figure.pieces.every((p) => p.wallId === "G")).toBe(true)
  })

  it("SV-165: коммуникация под концом тоже выносит его", () => {
    const d: Drawing = {
      ...drawing({ walls: rectWalls("k", 0, 0, 420, 520), reconstruction: { walls: [drywall("G", 100, 300, 300, 300, 10, 250)], dimensions: [], sections: [line(100, 450)] } }),
      communications: [{ kind: "riser", id: "c", x: 200, y: 450, diameterCm: 20 }],
    }
    const [entry] = reconstructionScene(d).sections
    expect(entry.shown.points[1].y).toBeGreaterThan(450)
  })
})
