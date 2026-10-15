import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import { LIGHT_PALETTE } from "../theme"
import type { Battery, Communication, DemolitionMark, Wall } from "../types"
import { hexToRgb01 } from "./pdf-colors.test-utils"
import type { Rgb } from "./pdf-colors.test-utils"
import { parseStyledStrokes } from "./pdf-style.test-utils"
import type { StyledStroke } from "./pdf-style.test-utils"
import type { PageFormat, PlanPage } from "./pdf"
import { buildPdfPages } from "./pdf"
import { legendWidthMm } from "./legend"
import { drawingArea, legendArea } from "./sheet-layout"

// change add-legend-objects: образцы «Батарея», «Стояк», «Воздуховод» на листах PDF
// (spec pdf-export «Легенда на странице PDF»; design D3–D5). Образцы разбираются из потока операторов страницы:
// строка легенды — слитые по вертикали сплошные контуры в столбце слева от области чертежа.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const TOL = 0.05
const SOLID_MM = 0.3
const INK = hexToRgb01(LIGHT_PALETTE.ink)
const MUTED = hexToRgb01(LIGHT_PALETTE.muted)

const wall = (id: string, type: Wall["type"], y: number): Wall => ({ id, a: { x: 0, y }, b: { x: 500, y }, thicknessCm: 20, type })
const BATTERY: Battery = { id: "b1", wallId: "w1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
const RISER: Communication = { kind: "riser", id: "r1", x: 250, y: 200, diameterCm: 11 }
const DUCT: Communication = { kind: "duct", id: "d1", x: 100, y: 200, widthCm: 30, depthCm: 20 }
const MARK: DemolitionMark = { id: "m1", wallId: "w1", anchor: "a", fromCm: 300, toCm: 390 }

const ALL_MATERIALS = [wall("w1", "brick", 0), wall("w2", "concrete", 300), wall("w3", "gkl", 400), wall("w4", "wood-long", 500), wall("w5", "blocks", 600)]
const objects = { batteries: [BATTERY], communications: [RISER, DUCT] }

const measure = (walls: Wall[] = [ALL_MATERIALS[0] as Wall]): PlanPage => ({ walls, dimensions: [], doorways: [], ...objects })
const demolition = (walls: Wall[] = [ALL_MATERIALS[0] as Wall]): PlanPage => ({
  walls,
  dimensions: [],
  doorways: [],
  demolition: effectiveMarks([MARK], walls, []),
  ...objects,
})

interface Box {
  x: number
  y: number
  w: number
  h: number
  strokes: StyledStroke[]
}

const boxOf = (s: StyledStroke): Box => {
  const pts = s.subpaths.flat()
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, strokes: [s] }
}

// строки легенды сверху вниз: сплошные контуры столбца, слитые по вертикали
function legendRows(doc: jsPDF, pageNumber: number, pages: PlanPage[], format: PageFormat): Box[] {
  const area = drawingArea(format, legendWidthMm(pages))
  const boxes = parseStyledStrokes(doc, pageNumber)
    .filter((s) => s.widthMm > SOLID_MM)
    .map(boxOf)
    .filter((b) => b.x + b.w / 2 <= area.x)
    .sort((a, b) => a.y - b.y)
  const rows: Box[] = []
  for (const b of boxes) {
    const last = rows[rows.length - 1]
    if (last && b.y <= last.y + last.h + TOL) {
      const x = Math.min(last.x, b.x)
      const y = Math.min(last.y, b.y)
      rows[rows.length - 1] = { x, y, w: Math.max(last.x + last.w, b.x + b.w) - x, h: Math.max(last.y + last.h, b.y + b.h) - y, strokes: [...last.strokes, ...b.strokes] }
    } else rows.push(b)
  }
  return rows
}

const build = (pages: PlanPage[], format: PageFormat = "A4"): jsPDF => buildPdfPages(pages, "cm", 100, format, font, "Чертёж 1", SEP)
const colorsOf = (row: Box | undefined): Rgb[] => (row?.strokes ?? []).map((s) => s.color)
const sameRgb = (a: Rgb, b: Rgb): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)

describe("образцы объектов в легенде PDF", () => {
  it("на обмерочной странице четыре строки: «Кирпич», «Батарея», «Стояк», «Воздуховод»", () => {
    const pages = [measure()]
    expect(legendRows(build(pages), 1, pages, "A4")).toHaveLength(4)
  })

  it("образцы имеют вид объектов: батарея 16×4 мм, стояк — круг 8 мм, воздуховод 16×8 мм", () => {
    const pages = [measure()]
    const [, battery, riser, duct] = legendRows(build(pages), 1, pages, "A4")
    expect(battery?.w).toBeCloseTo(16, 0)
    expect(battery?.h).toBeCloseTo(4, 0)
    expect(riser?.w).toBeCloseTo(8, 0)
    expect(riser?.h).toBeCloseTo(8, 0)
    expect(duct?.w).toBeCloseTo(16, 0)
    expect(duct?.h).toBeCloseTo(8, 0)
  })

  it("образцы стоят по центру своей строки и начинаются там же по x, что образец материала", () => {
    const pages = [measure()]
    const rows = legendRows(build(pages), 1, pages, "A4")
    const left = rows[0]?.x ?? 0
    rows.forEach((row, i) => {
      expect(row.x, `строка ${i}`).toBeCloseTo(i === 2 ? left + 4 : left, 0)
      const first = rows[0]
      if (first) expect(row.y + row.h / 2, `строка ${i}`).toBeCloseTo(first.y + first.h / 2 + 14 * i, 0)
    })
  })

  it("на «Демонтаже» образец батареи серый, образцы стояка и воздуховода — цветом контура", () => {
    const pages = [measure(), demolition()]
    const rows = legendRows(build(pages), 2, pages, "A4")
    const [, battery, riser, duct] = rows
    expect(colorsOf(battery).every((c) => sameRgb(c, MUTED))).toBe(true)
    expect(colorsOf(riser).every((c) => sameRgb(c, INK))).toBe(true)
    expect(colorsOf(duct).every((c) => sameRgb(c, INK))).toBe(true)
  })

  it("на обмерочной странице образец батареи цветом контура", () => {
    const pages = [measure()]
    expect(colorsOf(legendRows(build(pages), 1, pages, "A4")[1]).every((c) => sameRgb(c, INK))).toBe(true)
  })
})

describe("вместимость легенды по высоте", () => {
  it.each(["A4", "A3", "A2", "A1", "A0"] as const)("%s: пять материалов, три объекта и снос — девять строк внутри области чертежа", (format) => {
    const pages = [demolition(ALL_MATERIALS)]
    const rows = legendRows(build(pages, format), 1, pages, format)
    expect(rows).toHaveLength(9)
    const column = legendArea(format, legendWidthMm(pages))
    const last = rows[rows.length - 1]
    expect((last?.y ?? 0) + (last?.h ?? 0)).toBeLessThanOrEqual(column.y + column.h)
  })
})
