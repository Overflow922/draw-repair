import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { angleGap, dominantDirection, fallingConstant, isFalling, isRising, pitchOf, risingConstant } from "../wall-hatch.test-utils"
import { LIGHT_PALETTE } from "../theme"
import { hexToRgb01, isRed, sameColor } from "./pdf-colors.test-utils"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintBox, PaintOp, PaintPoint, PaintRgb } from "./pdf-paint.test-utils"
import { insideRect } from "./pdf-ops.test-utils"
import type { DemolitionMark, Material, Wall } from "../types"
import type { Drawing } from "../types"
import type { PageFormat } from "./pdf"
import { buildPdfPages, pagesOf } from "./pdf"
import { legendWidthMm } from "./legend"
import { drawingArea, legendArea } from "./sheet-layout"

// change new-wall-materials: штриховки пяти материалов в PDF — страница «Обмерочный план» и образцы легенды
// (spec wall-types «Штриховка стены по материалу», wall-joints «Непрерывность штриховки через стык», pdf-export
// «Легенда на странице PDF»; test-plan WM-H1…WM-H8, WM-L6). Рисунок измеряется по операторам страницы jsPDF:
// штриховка в потоке длиннее стены (её обрезает клиппинг), поэтому берутся направления, шаги, толщины, пунктир и порядок.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const TOL = 0.02
const CONTOUR_MM = 0.6
const HATCH_MAX_MM = 0.3
const PAPER = hexToRgb01(LIGHT_PALETTE.paper)

const LINEAR: readonly Material[] = ["blocks", "brick", "concrete", "gkl"]
const ALL: readonly Material[] = ["blocks", "brick", "concrete", "gkl", "wood-long"]

const wall = (type: Material, ax = 0, ay = 0, bx = 600, by = 0, id = "w1", thicknessCm = 60): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm, type })

interface Built {
  doc: jsPDF
  area: PaintBox
  column: PaintBox
}

function build(walls: Wall[], scale = 25, format: PageFormat = "A3", demolition: DemolitionMark[] = []): Built {
  const d: Drawing = { id: "a", name: "Чертёж 1", walls, dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...(demolition.length > 0 ? { demolition } : {}) }
  const pages = pagesOf(d)
  const columnMm = legendWidthMm(pages)
  const doc = buildPdfPages(pages, "cm", scale, format, font, "Чертёж 1", SEP)
  return { doc, area: drawingArea(format, columnMm), column: legendArea(format, columnMm) }
}

const pointsOf = (op: PaintOp): PaintPoint[] => op.subpaths.flat()
// штриховка и тайлы в потоке длиннее стены или образца (обрезаются клиппингом): принадлежность чертежу или столбцу легенды —
// по середине габаритов операции по x, а не по каждой точке
const centerX = (op: PaintOp): number => {
  const xs = pointsOf(op).map((p) => p.x)
  return (Math.min(...xs) + Math.max(...xs)) / 2
}
const inArea = (op: PaintOp, area: PaintBox): boolean => centerX(op) >= area.x - TOL
const inColumn = (op: PaintOp, area: PaintBox): boolean => centerX(op) <= area.x + TOL
const slanted = (op: PaintOp): boolean => op.subpaths.some((sp) => sp.slice(1).some((q, i) => Math.abs(q.x - (sp[i]?.x ?? q.x)) > 0.01 && Math.abs(q.y - (sp[i]?.y ?? q.y)) > 0.01))

const isHatchOp = (op: PaintOp): op is Extract<PaintOp, { kind: "stroke" }> => op.kind === "stroke" && op.widthMm <= HATCH_MAX_MM && op.widthMm > 0.05 && (slanted(op) || op.dash.length > 0)
const isContourOp = (op: PaintOp): op is Extract<PaintOp, { kind: "stroke" }> => op.kind === "stroke" && Math.abs(op.widthMm - CONTOUR_MM) < TOL
const isWallFill = (op: PaintOp): op is Extract<PaintOp, { kind: "fill" }> => op.kind === "fill" && op.box !== null && op.color.some((c) => c < 0.99)

const segs = (ops: readonly PaintOp[]): { a: PaintPoint; b: PaintPoint; op: PaintOp }[] =>
  ops.flatMap((op) => op.subpaths.flatMap((sp) => sp.slice(1).map((q, i) => ({ a: sp[i] as PaintPoint, b: q, op }))))

// штриховка, заливка и контур стены на чертёжной части страницы 1
function chart(b: Built): { all: PaintOp[]; hatch: Extract<PaintOp, { kind: "stroke" }>[]; fills: Extract<PaintOp, { kind: "fill" }>[]; contour: PaintOp[] } {
  const all = parsePaint(b.doc, 1).filter((op) => inArea(op, b.area))
  return {
    all,
    hatch: all.filter(isHatchOp),
    fills: all.filter(isWallFill),
    contour: all.filter((op) => isContourOp(op) && insideRect(boxOfOp(op), b.area)),
  }
}

function boxOfOp(op: PaintOp): PaintBox {
  const pts = pointsOf(op)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function boxOfAll(ops: readonly PaintOp[]): PaintBox {
  const pts = ops.flatMap(pointsOf)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

interface Look {
  rising: boolean
  falling: boolean
  dashed: boolean
  irregular: boolean // есть наклонные отрезки не под 45°/135° (узор дерева)
  filled: boolean
  pitchMm: number | null
  widthMm: number | null
}

const risingPitch = (hatch: readonly PaintOp[]): number | null =>
  pitchOf(segs(hatch).filter(isRising).map((s) => risingConstant(s)), 1e-3)
const fallingPitch = (hatch: readonly PaintOp[]): number | null =>
  pitchOf(segs(hatch).filter(isFalling).map((s) => fallingConstant(s)), 1e-3)

function lookOf(ops: readonly PaintOp[]): Look {
  const hatch = ops.filter(isHatchOp)
  const s = segs(hatch)
  const widths = hatch.map((h) => Math.round(h.widthMm * 1000) / 1000)
  const diag = (g: { a: PaintPoint; b: PaintPoint }): boolean => isRising(g) || isFalling(g)
  return {
    rising: s.some((g) => isRising(g)),
    falling: s.some((g) => isFalling(g)),
    dashed: hatch.some((h) => h.dash.length > 0),
    irregular: s.some((g) => !diag(g) && Math.abs(g.b.x - g.a.x) > 0.01 && Math.abs(g.b.y - g.a.y) > 0.01),
    filled: ops.some(isWallFill),
    pitchMm: (() => {
      const p = risingPitch(hatch) ?? fallingPitch(hatch)
      return p === null ? null : Math.round(p * 100) / 100
    })(),
    widthMm: widths.length === 0 ? null : Math.min(...widths),
  }
}

const must = <T>(v: T | null | undefined, what: string): T => {
  if (v === null || v === undefined) throw new Error(what)
  return v
}

describe("WM-H1: паттерны материалов различимы", () => {
  it("рисунки пяти материалов попарно различны (углы, пунктир, заливка, шаг, толщина, узор)", () => {
    const looks = ALL.map((m) => JSON.stringify(lookOf(chart(build([wall(m)])).all)))
    expect(new Set(looks).size).toBe(ALL.length)
  })

  it("каждый материал реально штрихуется (есть штриховые линии на странице)", () => {
    for (const m of ALL) expect(chart(build([wall(m)])).hatch.length, m).toBeGreaterThan(0)
  })

  it("«Блоки», «Кирпич» — только линии под 45° («/»), без обратной серии, без пунктира, без заливки", () => {
    for (const m of ["blocks", "brick"] as const) {
      const look = lookOf(chart(build([wall(m)])).all)
      expect(look, m).toMatchObject({ rising: true, falling: false, dashed: false, filled: false, irregular: false })
    }
  })

  it("«Дерево» — волнистый узор: наклонные отрезки не под 45°, без пунктира и без заливки", () => {
    const look = lookOf(chart(build([wall("wood-long")])).all)
    expect(look).toMatchObject({ dashed: false, filled: false, irregular: true })
  })
})

describe("WM-H2: «Блоки» гуще и тоньше «Кирпича»", () => {
  it("шаг «Блоков» меньше шага «Кирпича»", () => {
    const blocks = must(lookOf(chart(build([wall("blocks")])).all).pitchMm, "шаг блоков")
    const brick = must(lookOf(chart(build([wall("brick")])).all).pitchMm, "шаг кирпича")
    expect(blocks).toBeLessThan(brick)
  })

  it("линия «Блоков» тоньше линии «Кирпича»", () => {
    const blocks = must(lookOf(chart(build([wall("blocks")])).all).widthMm, "толщина блоков")
    const brick = must(lookOf(chart(build([wall("brick")])).all).widthMm, "толщина кирпича")
    expect(blocks).toBeLessThan(brick)
  })

  it.each(LINEAR)("шаг линейной штриховки «%s» — в пределах 1–10 мм на бумаге", (m) => {
    const pitch = must(lookOf(chart(build([wall(m)])).all).pitchMm, "шаг")
    expect(pitch).toBeGreaterThanOrEqual(1)
    expect(pitch).toBeLessThanOrEqual(10)
  })

  it("«Кирпич» сохраняет прежние шаг (3 мм) и толщину штриховки (0,25 мм)", () => {
    const look = lookOf(chart(build([wall("brick")])).all)
    expect(look.pitchMm).toBeCloseTo(3, 1)
    expect(look.widthMm).toBeCloseTo(0.25, 2)
  })
})

describe("WM-H3, WM-H4: «Бетон» — серая заливка и короткие штрихи", () => {
  it("вся площадь стены залита серым: габариты заливки совпадают с габаритами контура", () => {
    const c = chart(build([wall("concrete")]))
    expect(c.fills.length).toBeGreaterThan(0)
    const contour = boxOfAll(c.contour)
    const fillBox = boxOfAll(c.fills)
    expect(fillBox.x).toBeCloseTo(contour.x, 1)
    expect(fillBox.y).toBeCloseTo(contour.y, 1)
    expect(fillBox.w).toBeCloseTo(contour.w, 1)
    expect(fillBox.h).toBeCloseTo(contour.h, 1)
  })

  it("заливка — серая (равные компоненты), светлее штрихов и не цвет бумаги", () => {
    const c = chart(build([wall("concrete")]))
    expect(c.fills.length).toBeGreaterThan(0)
    for (const f of c.fills) {
      expect(f.color[0]).toBeCloseTo(f.color[1], 2)
      expect(f.color[1]).toBeCloseTo(f.color[2], 2)
      expect(sameColor(f.color, PAPER)).toBe(false)
      expect(f.color[0]).toBeGreaterThan(0.4)
      expect(f.color[0]).toBeLessThan(0.97)
    }
  })

  it("штрихи — пунктир под 45°, короткие (метки не длиннее 3 мм), толщина штриховки", () => {
    const c = chart(build([wall("concrete")]))
    const dashed = c.hatch.filter((h) => h.dash.length > 0)
    expect(dashed.length).toBeGreaterThan(0)
    for (const h of dashed) {
      expect(h.dash[0] ?? 0).toBeGreaterThan(0)
      expect(h.dash[0] ?? 0).toBeLessThanOrEqual(3)
    }
    expect(segs(dashed).every((g) => isRising(g))).toBe(true)
  })

  it("порядок вывода: заливка раньше штрихов, штрихи раньше контура стены", () => {
    const c = chart(build([wall("concrete")]))
    const fillAt = c.all.findIndex((op) => isWallFill(op))
    const hatchAt = c.all.findIndex((op) => isHatchOp(op))
    const contourAt = c.all.findIndex((op) => isContourOp(op) && insideRect(boxOfOp(op), build([wall("concrete")]).area))
    expect(fillAt).toBeGreaterThanOrEqual(0)
    expect(hatchAt).toBeGreaterThan(fillAt)
    expect(contourAt).toBeGreaterThan(hatchAt)
  })

  it.each(["blocks", "brick", "gkl", "wood-long"] as const)("у «%s» заливки нет (кроме белой)", (m) => {
    expect(chart(build([wall(m)])).fills).toEqual([])
  })

  it("заливка бетона не выходит за стену под наклоном: габариты внутри габаритов контура", () => {
    const c = chart(build([wall("concrete", 0, 0, 400, 300)], 50))
    const contour = boxOfAll(c.contour)
    expect(c.fills.length).toBeGreaterThan(0)
    for (const f of c.fills) expect(insideRect(must(f.box, "заливка без габаритов"), contour, 0.05)).toBe(true)
  })
})

describe("WM-H5: «ГКЛ» — ромбическая сетка", () => {
  it("есть обе серии: 45° и 135°, сплошные", () => {
    const c = chart(build([wall("gkl")]))
    const s = segs(c.hatch)
    expect(s.some((g) => isRising(g))).toBe(true)
    expect(s.some((g) => isFalling(g))).toBe(true)
    expect(c.hatch.every((h) => h.dash.length === 0)).toBe(true)
  })

  it("шаг серий одинаков, ячейки — ромбы (квадраты, повёрнутые на 45°)", () => {
    const c = chart(build([wall("gkl")]))
    const up = must(risingPitch(c.hatch), "шаг серии 45°")
    const down = must(fallingPitch(c.hatch), "шаг серии 135°")
    expect(up).toBeCloseTo(down, 2)
  })

  it("обе серии одной толщины, тоньше «Кирпича»", () => {
    const c = chart(build([wall("gkl")]))
    const brick = chart(build([wall("brick")]))
    const widths = new Set(c.hatch.map((h) => Math.round(h.widthMm * 1000) / 1000))
    expect(widths.size).toBe(1)
    expect([...widths][0] ?? 1).toBeLessThan(must(lookOf(brick.all).widthMm, "толщина кирпича"))
  })
})

describe("WM-H6: углы штриховки постоянны при любом наклоне стены", () => {
  const ANGLES = [0, 30, 45, 90, 137, 200]
  const endOf = (deg: number): { x: number; y: number } => ({ x: Math.round(400 * Math.cos((deg * Math.PI) / 180)), y: Math.round(400 * Math.sin((deg * Math.PI) / 180)) })

  for (const m of LINEAR) {
    it.each(ANGLES)(`«${m}» под ${"%i"}°: все линии штриховки строго под 45° (у ГКЛ — и 135°) к осям`, (deg) => {
      const e = endOf(deg)
      const c = chart(build([wall(m, 0, 0, e.x, e.y)], 50))
      const s = segs(c.hatch)
      expect(s.length).toBeGreaterThan(0)
      for (const g of s) expect(isRising(g) || isFalling(g), `${m} ${deg}°: ${g.a.x.toFixed(2)},${g.a.y.toFixed(2)}→${g.b.x.toFixed(2)},${g.b.y.toFixed(2)}`).toBe(true)
      if (m === "gkl") {
        expect(s.some((g) => isRising(g))).toBe(true)
        expect(s.some((g) => isFalling(g))).toBe(true)
      } else {
        expect(s.every((g) => isRising(g))).toBe(true)
      }
    })
  }
})

describe("WM-H8: шаг не зависит от масштаба чертежа", () => {
  it.each(LINEAR)("«%s»: шаг и толщина линий на бумаге одинаковы при 1:25 и 1:50", (m) => {
    const a = lookOf(chart(build([wall(m)], 25)).all)
    const b = lookOf(chart(build([wall(m)], 50)).all)
    expect(a.pitchMm).not.toBeNull()
    expect(b.pitchMm).toBe(a.pitchMm)
    expect(b.widthMm).toBe(a.widthMm)
  })

  it("«Дерево»: размер узора на бумаге не зависит от масштаба — медианная длина отрезка узора и его направление одинаковы при 1:25 и 1:50", () => {
    const stats = (scale: number): { median: number; angle: number } => {
      const c = chart(build([wall("wood-long", 0, 0, 800, 0, "w1", 100)], scale, "A2"))
      const lengths = segs(c.hatch).map((g) => Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y)).sort((p, q) => p - q)
      expect(lengths.length).toBeGreaterThan(20)
      return { median: lengths[Math.floor(lengths.length / 2)] ?? 0, angle: dominantDirection(segs(c.hatch)).angleDeg }
    }
    const a = stats(25)
    const b = stats(50)
    expect(b.median / a.median).toBeGreaterThan(0.95)
    expect(b.median / a.median).toBeLessThan(1.05)
    expect(angleGap(a.angle, b.angle)).toBeLessThan(3)
  })
})

describe("WM-L6: образцы легенды повторяют штриховку материала", () => {
  const sampleLook = (m: Material): { sample: Look; chart: Look } => {
    const b = build([wall(m)])
    const ops = parsePaint(b.doc, 1)
    return { sample: lookOf(ops.filter((op) => inColumn(op, b.area))), chart: lookOf(ops.filter((op) => inArea(op, b.area))) }
  }

  it.each(ALL)("образец «%s» штрихуется так же, как этот материал на чертеже той же страницы", (m) => {
    const { sample, chart: onChart } = sampleLook(m)
    expect(sample).toEqual(onChart)
  })

  it("образец «ГКЛ» содержит обе серии линий", () => {
    const { sample } = sampleLook("gkl")
    expect(sample).toMatchObject({ rising: true, falling: true })
  })

  it("образец «Бетон» залит серым", () => {
    const b = build([wall("concrete")])
    const fills = parsePaint(b.doc, 1).filter((op) => inColumn(op, b.area)).filter(isWallFill)
    expect(fills.length).toBeGreaterThan(0)
    for (const f of fills) expect(isGray(f.color)).toBe(true)
  })

  it("все пять образцов различны между собой", () => {
    const set = new Set(ALL.map((m) => JSON.stringify(sampleLook(m).sample)))
    expect(set.size).toBe(ALL.length)
  })
})

describe("WM-D8: красная штриховка сноса и серая подложка плана «Демонтаж» в PDF", () => {
  const MARK: DemolitionMark = { id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 400 }
  const demolition = (): PaintOp[] => {
    const b = build([wall("brick", 0, 0, 600, 0, "w1"), wall("concrete", 0, 300, 600, 300, "w2")], 25, "A3", [MARK])
    return parsePaint(b.doc, 2).filter((op) => inArea(op, b.area))
  }

  it("красная штриховка области сноса — линии 135° с шагом 3 мм и толщиной штриховки", () => {
    const red = demolition().filter(isHatchOp).filter((op) => isRed(op.color))
    expect(red.length).toBeGreaterThan(0)
    const s = segs(red)
    expect(s.every((g) => isFalling(g))).toBe(true)
    expect(must(fallingPitch(red), "шаг красной штриховки")).toBeCloseTo(3, 2)
    for (const h of red) expect(h.widthMm).toBeCloseTo(0.25, 2)
  })

  it("бетонная стена на подложке: штрихи серые (muted), заливка серая и не белая", () => {
    const ops = demolition()
    const dashed = ops.filter(isHatchOp).filter((op) => op.dash.length > 0)
    expect(dashed.length).toBeGreaterThan(0)
    for (const h of dashed) expect(sameColor(h.color, hexToRgb01(LIGHT_PALETTE.muted))).toBe(true)
    const fills = ops.filter(isWallFill).filter((f) => !isRed(f.color))
    expect(fills.length).toBeGreaterThan(0)
    for (const f of fills) expect(isGray(f.color)).toBe(true)
  })
})

const isGray = (c: PaintRgb): boolean => Math.abs(c[0] - c[1]) < 0.01 && Math.abs(c[1] - c[2]) < 0.01
