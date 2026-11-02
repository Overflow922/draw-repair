import { describe, expect, it } from "vitest"
import { drawReconstructionScene, drywallColors } from "../reconstruction/reconstruction-render"
import type { ReconstructionView } from "../reconstruction/reconstruction-render"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import { recordingContext } from "../room-area.test-utils"
import type { StrokeOp, TextOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import { PX_PER_CM } from "../types"
import type { Point, SectionLine } from "../types"
import { SECTION_ARROW_CM, SECTION_DASH_CM } from "./section-marks"
import type { SectionMarks } from "./section-draw"

// change add-section-view: линия и фигура на холсте (spec section-view «Обозначение линии разреза на плане»,
// «Фигура разреза — содержание и штриховка»; reconstruction-plan «Отображение плана «Реконструкция»»)

const K = PX_PER_CM
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const COLOR = drywallColors("light").stroke

const line: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 250, y: 0 }, { x: 250, y: 200 }] }
// стена гипсокартона (100,100)-(400,100), толщина 10, высота 250; линия x = 250 от y = 0 до y = 200, взгляд вправо:
// фигура правее габаритов (x = 400 + 100 = 500), ширина 200, пол на y = 105, сечение стены s' 95…105
const d = drawing({ walls: [], reconstruction: { walls: [drywall("G", 100, 100, 400, 100, 10, 250)], dimensions: [], sections: [line] } })

const draw = (marks: SectionMarks = {}) => {
  const s = reconstructionScene(d)
  const view: ReconstructionView = { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, sections: s.sections, sectionMarks: marks }
  const rec = recordingContext()
  drawReconstructionScene(rec.ctx, 1200, 800, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const strokesOf = (ops: ReturnType<typeof draw>, style: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === style)
const texts = (ops: ReturnType<typeof draw>, text: string): TextOp[] => ops.filter((o): o is TextOp => o.kind === "fillText" && o.text === text)
const near = (a: Point, x: number, y: number): boolean => Math.abs(a.x - x * K) < 1e-6 && Math.abs(a.y - y * K) < 1e-6

describe("линия на холсте", () => {
  it("SV-130: на обоих концах обозначение «A» сбоку от стрелки, снаружи от линии", () => {
    const labels = texts(draw(), "A")
    expect(labels).toHaveLength(2)
    const x = (250 - SECTION_ARROW_CM / 2) * K
    expect(labels.every((t) => Math.abs(t.at.x - x) < 1e-6)).toBe(true)
    expect(labels.map((t) => Math.round(t.at.y / K)).sort((a, b) => a - b)).toEqual([-12, 212])
  })

  it("SV-131: жирный штрих на конце линии толще самой линии, цвет — контур гипсокартона", () => {
    const ops = draw()
    expect(strokesOf(ops, COLOR).length).toBeGreaterThan(0)
  })

  it("SV-132: линия нарисована поверх зелёной заливки стены гипсокартона", () => {
    const ops = draw()
    const fill = ops.find((o) => o.kind === "fill" && o.fillStyle === drywallColors("light").fill)
    const label = ops.find((o) => o.kind === "fillText" && o.text === "A")
    expect(fill && label && fill.index < label.index).toBe(true)
  })
})

describe("оформление линии по references/sections.png", () => {
  const dashes = (): number[][] => {
    const s = reconstructionScene(d)
    const view: ReconstructionView = { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, sections: s.sections }
    const rec = recordingContext()
    const seen: number[][] = []
    rec.ctx.setLineDash = (segments: number[]): void => { seen.push([...segments]) }
    drawReconstructionScene(rec.ctx, 1200, 800, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
    return seen
  }

  it("SV-140: между жирными штрихами линия штриховая, после неё штриховка сброшена", () => {
    const seen = dashes()
    expect(seen).toContainEqual(SECTION_DASH_CM.map((v) => v * K))
    expect(seen[seen.length - 1]).toEqual([])
  })

  it("SV-142: линия, в которую упираются стрелки (концевой штрих), в 2,5 раза толще штриховой линии разреза", () => {
    const s = reconstructionScene(d)
    const view: ReconstructionView = { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, sections: s.sections }
    const rec = recordingContext()
    const widths: { width: number; dashed: boolean }[] = []
    let dash: number[] = []
    rec.ctx.setLineDash = (segments: number[]): void => { dash = [...segments] }
    const stroke = rec.ctx.stroke.bind(rec.ctx)
    rec.ctx.stroke = (): void => { widths.push({ width: rec.ctx.lineWidth, dashed: dash.length > 0 }); stroke() }
    drawReconstructionScene(rec.ctx, 1200, 800, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
    const dashedWidth = widths.find((w) => w.dashed)?.width
    expect(dashedWidth).toBeGreaterThan(0)
    expect(widths.some((w) => !w.dashed && Math.abs(w.width / (dashedWidth ?? 1) - 2.5) < 1e-9)).toBe(true)
  })

  it("SV-141: стрелка горизонтальная (перпендикулярна линии), лежит с противоположной от взгляда стороны и упирается остриём в конец линии", () => {
    const arrows = strokesOf(draw(), COLOR).flatMap((s) => s.subpaths).filter((sp) => sp.length === 2 && near(sp[0], 250 - SECTION_ARROW_CM, 0) && near(sp[1], 250, 0))
    expect(arrows).toHaveLength(1)
  })
})
describe("фигура на холсте", () => {
  it("SV-133: название «A–A» над фигурой по центру", () => {
    const [title] = texts(draw(), "A–A")
    expect(title).toBeDefined()
    expect(title.at.x).toBeCloseTo(600 * K, 6)
    expect(title.at.y).toBeLessThan(-145 * K)
  })

  it("SV-134: отдельной линии пола вдоль ширины фигуры нет", () => {
    const floor = strokesOf(draw(), COLOR).find((s) => s.subpaths.some((sp) => sp.length === 2 && near(sp[0], 500, 105) && near(sp[1], 700, 105)))
    expect(floor).toBeUndefined()
  })

  it("SV-135: сечение — контур прямоугольника 10 × 250 в масштабе чертежа", () => {
    const rect = strokesOf(draw(), COLOR).find((s) =>
      s.subpaths.some((sp) => sp.length === 5 && near(sp[0], 595, -145) && near(sp[2], 605, 105)),
    )
    expect(rect).toBeDefined()
  })

  it("SV-136: сечение заштриховано: несколько линий штриховки цветом контура, 2 точки каждая", () => {
    const hatch = strokesOf(draw(), COLOR).flatMap((s) => s.subpaths).filter((sp) => sp.length === 2 && sp.every((p) => p.x >= 450 * K))
    expect(hatch.length).toBeGreaterThan(3)
  })

  it("SV-137: стена подложки и стена за плоскостью в фигуре не рисуются: прямоугольник один", () => {
    const rects = strokesOf(draw(), COLOR).flatMap((s) => s.subpaths).filter((sp) => sp.length === 5 && sp.every((q) => q.x > 450 * K))
    expect(rects).toHaveLength(1)
  })
})

describe("выделение", () => {
  it("SV-138: выделенная линия подсвечена вместе с фигурой, без выделения подсветки нет", () => {
    expect(strokesOf(draw(), LIGHT_PALETTE.selection)).toEqual([])
    const halo = strokesOf(draw({ selected: "L1" }), LIGHT_PALETTE.selection)
    // линия, две стрелки и контур сечения
    expect(halo.length).toBeGreaterThanOrEqual(4)
  })

  it("SV-139: ластик подсвечивает линию цветом ластика", () => {
    expect(strokesOf(draw({ erasing: "L1" }), LIGHT_PALETTE.erase).length).toBeGreaterThan(0)
  })
})
