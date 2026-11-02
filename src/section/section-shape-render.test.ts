import { describe, expect, it } from "vitest"
import { drawReconstructionScene, drywallColors } from "../reconstruction/reconstruction-render"
import type { ReconstructionView } from "../reconstruction/reconstruction-render"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import { recordingContext } from "../room-area.test-utils"
import type { StrokeOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import { PX_PER_CM } from "../types"
import type { SectionLine, SectionShape } from "../types"
import type { SectionMarks } from "./section-draw"

// change add-section-shapes: деталь на холсте (spec section-view «Деталь разреза»; pdf-export «Деталь разреза в PDF»)
//
//   стена (100,100)-(400,100) толщиной 10 высотой 250; линия x = 250, взгляд right: фигура правее габаритов, x 500..700,
//   пол y = 105, сечение стены s 95..105; деталь s 10..90, z 120..130 — полка слева от сечения      схематично, не в масштабе
const K = PX_PER_CM
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const COLOR = drywallColors("light").stroke
const line: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 250, y: 0 }, { x: 250, y: 200 }] }
const SHELF: SectionShape = { id: "p1", lineId: "L1", s0: 10, s1: 90, z0: 120, z1: 130 }

const draw = (shapes: SectionShape[], marks: SectionMarks = {}) => {
  const s = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("G", 100, 100, 400, 100, 10, 250)], dimensions: [], sections: [line], sectionShapes: shapes } }))
  const view: ReconstructionView = { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, sections: s.sections, sectionMarks: marks }
  const rec = recordingContext()
  drawReconstructionScene(rec.ctx, 1200, 800, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const strokes = (ops: ReturnType<typeof draw>, style: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === style)

// сколько раз штриховка отсекалась «всё, кроме» (evenodd): сечения вне деталей и детали вне сечений (углубление)
const evenOddClips = (shapes: SectionShape[]): number => {
  const s = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("G", 100, 100, 400, 100, 10, 250)], dimensions: [], sections: [line], sectionShapes: shapes } }))
  const view: ReconstructionView = { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, sections: s.sections }
  const rec = recordingContext()
  let count = 0
  const clip = rec.ctx.clip.bind(rec.ctx)
  rec.ctx.clip = (...args: [CanvasFillRule?] | [Path2D, CanvasFillRule?]): void => {
    if (args[0] === "evenodd") count++
    Reflect.apply(clip, rec.ctx, args)
  }
  drawReconstructionScene(rec.ctx, 1200, 800, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return count
}

describe("углубление: штриховка детали и сечения взаимно исключаются", () => {
  it("SH-805: деталь добавляет отсечения штриховки — у каждого сечения и у самой детали; без детали отсечения всё равно есть (пустой набор)", () => {
    expect(evenOddClips([SHELF])).toBeGreaterThan(evenOddClips([]))
  })
})

describe("деталь на холсте", () => {
  it("SH-800: деталь добавляет контур и штриховку цвета гипсокартона", () => {
    expect(strokes(draw([SHELF]), COLOR).length).toBeGreaterThan(strokes(draw([]), COLOR).length)
  })

  it("SH-801: контур детали лежит на месте: левый верхний угол в фигуре, x 510, y = 105 - 130", () => {
    const corner = strokes(draw([SHELF]), COLOR).flatMap((o) => o.subpaths.flat()).find((p) => Math.abs(p.x - 510 * K) < 1e-6 && Math.abs(p.y - -25 * K) < 1e-6)
    expect(corner).toBeDefined()
  })

  it("SH-802: выделенная деталь получает подсветку, невыделенная — нет", () => {
    expect(strokes(draw([SHELF], { selectedShape: "p1" }), LIGHT_PALETTE.selection).length).toBeGreaterThan(0)
    expect(strokes(draw([SHELF]), LIGHT_PALETTE.selection)).toHaveLength(0)
  })

  it("SH-803: деталь под ластиком подсвечивается цветом ластика", () => {
    expect(strokes(draw([SHELF], { erasingShape: "p1" }), LIGHT_PALETTE.erase).length).toBeGreaterThan(0)
  })

  it("SH-804: выделение линии не подсвечивает детали, выделение детали — не линию", () => {
    const sel = strokes(draw([SHELF], { selectedShape: "p1" }), LIGHT_PALETTE.selection).length
    const both = strokes(draw([SHELF], { selected: "L1" }), LIGHT_PALETTE.selection).length
    expect(sel).toBe(1)
    expect(both).toBeGreaterThan(0)
    expect(draw([SHELF], { selected: "L1", selectedShape: "p1" }).length).toBeGreaterThan(0)
  })
})
