import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildPdf } from "./export/pdf"
import { moveWalls } from "./geometry"
import { PDF_METRICS, SCREEN_METRICS, drawScene } from "./render"
import type { RenderOptions } from "./render"
import type { Dimension, Point, Unit, View, Wall } from "./types"
import { PX_PER_CM } from "./types"
import {
  W,
  areaLabels,
  isWhite,
  otherTexts,
  recordingContext,
  roomFills,
  sceneR,
  sceneRP,
  sceneRbox,
  sceneRisland,
  sceneU,
  strokesOf,
} from "./room-area.test-utils"
import type { DrawOp } from "./room-area.test-utils"

// Тесты change room-area-labels: заливка и подписи помещений в drawScene (spec room-areas, design D7).
// Ожидания по геометрии — аналитические (центры прямоугольных помещений), без вызова findRooms.

const GRID_STROKE = "#e0e0e0"
const INK = "#333"
const SELECTION = "rgba(8, 145, 178, 0.5)"

const VIEW: View = { zoom: 1, pan: { x: -50, y: -50 } }

const toScreen = (p: Point, view: View = VIEW): Point => {
  const k = PX_PER_CM * view.zoom
  return { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
}

interface DrawArgs {
  walls: Wall[]
  preview?: Wall | null
  unit?: Unit
  view?: View
  selected?: Wall[]
  opts?: RenderOptions
}

function draw({ walls, preview = null, unit = "mm", view = VIEW, selected = [], opts = {} }: DrawArgs): DrawOp[] {
  const { ctx, ops } = recordingContext()
  drawScene(ctx, 1200, 900, walls, preview, unit, view, selected, opts)
  return ops
}

const near = (p: Point, q: Point, tol: number): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= tol

// вершина пути лежит на границе прямоугольника (в экранных координатах)
function onRectBoundary(p: Point, min: Point, max: Point, tol: number): boolean {
  const inX = p.x >= min.x - tol && p.x <= max.x + tol
  const inY = p.y >= min.y - tol && p.y <= max.y + tol
  const onV = Math.abs(p.x - min.x) <= tol || Math.abs(p.x - max.x) <= tol
  const onH = Math.abs(p.y - min.y) <= tol || Math.abs(p.y - max.y) <= tol
  return inX && inY && (onV || onH)
}

const corners = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

describe("drawScene — заливка помещений", () => {
  it("RND-FILL-1: помещение залито белым по внутренней области", () => {
    const fills = roomFills(draw({ walls: sceneR() }))
    expect(fills).toHaveLength(1)
    const pts = fills[0].subpaths.flat()
    const min = toScreen({ x: 10, y: 10 })
    const max = toScreen({ x: 410, y: 310 })
    for (const c of corners(10, 10, 410, 310).map((p) => toScreen(p))) expect(pts.some((q) => near(q, c, 0.5))).toBe(true)
    for (const q of pts) expect(onRectBoundary(q, min, max, 0.5)).toBe(true)
  })

  it("RND-FILL-MULTI-1: каждое из нескольких помещений залито по своей области", () => {
    const fills = roomFills(draw({ walls: sceneRP() }))
    expect(fills.length).toBeGreaterThan(0)
    const subpaths = fills.flatMap((f) => f.subpaths)
    for (const [x0, x1] of [
      [10, 190],
      [210, 410],
    ]) {
      const min = toScreen({ x: x0, y: 10 })
      const max = toScreen({ x: x1, y: 310 })
      const room = corners(x0, 10, x1, 310).map((p) => toScreen(p))
      const path = subpaths.find((sp) => room.every((c) => sp.some((q) => near(q, c, 0.5))))
      expect(path).toBeDefined()
      for (const q of path ?? []) expect(onRectBoundary(q, min, max, 0.5)).toBe(true)
    }
  })

  it("RND-FILL-BOX-1: помещение внутри короба залито по своей области", () => {
    const view: View = { zoom: 0.5, pan: { x: -50, y: -50 } }
    const subpaths = roomFills(draw({ walls: sceneRbox(), view })).flatMap((f) => f.subpaths)
    const min = toScreen({ x: 405, y: 305 }, view)
    const max = toScreen({ x: 595, y: 495 }, view)
    const room = corners(405, 305, 595, 495).map((p) => toScreen(p, view))
    const path = subpaths.find((sp) => room.every((c) => sp.some((q) => near(q, c, 0.5))) && sp.every((q) => onRectBoundary(q, min, max, 0.5)))
    expect(path).toBeDefined()
  })

  it("RND-FILL-HOLE-1: остров вырезан из заливки правилом evenodd (design D7)", () => {
    const fills = roomFills(draw({ walls: sceneRisland() }))
    expect(fills).toHaveLength(1)
    expect(fills[0].rule).toBe("evenodd")
    expect(fills[0].subpaths.length).toBeGreaterThanOrEqual(2)
    const island = corners(160, 150, 260, 170).map((p) => toScreen(p))
    const islandPath = fills[0].subpaths.find((sp) => island.every((c) => sp.some((q) => near(q, c, 0.5))))
    expect(islandPath).toBeDefined()
  })

  it("RND-FILL-NONE-1: незамкнутый контур — ни заливки, ни подписи", () => {
    const ops = draw({ walls: sceneU() })
    expect(roomFills(ops)).toEqual([])
    expect(areaLabels(ops)).toEqual([])
  })

  it("RND-NOGRID-1: без сетки (PDF) заливки нет, подпись есть", () => {
    const ops = draw({ walls: sceneR(), opts: { grid: false } })
    expect(roomFills(ops)).toEqual([])
    expect(areaLabels(ops).map((o) => o.text)).toEqual(["12,00 м²"])
  })

  it("RND-ORDER-1: сетка < заливка < выделение < стены < подпись площади < размеры", () => {
    const walls = sceneR()
    const a = walls[0]
    const dim: Dimension = {
      from: { a: { wallId: a.id, edge: 2 }, b: { wallId: a.id, edge: 1 } },
      to: { a: { wallId: a.id, edge: 3 }, b: { wallId: a.id, edge: 1 } },
      offset: 60,
    }
    const ops = draw({ walls, selected: [a], opts: { dimensions: [dim] } })
    // штрихи стен — первые штрихи цветом INK; их число берётся из отрисовки без размеров,
    // потому что линии размеров тоже рисуются INK и идут после стен
    const wallStrokeCount = strokesOf(draw({ walls, selected: [a] }), INK).length
    const grid = strokesOf(ops, GRID_STROKE)
    const fills = roomFills(ops)
    const selection = ops.filter((o) => (o.kind === "stroke" && o.strokeStyle === SELECTION) || (o.kind === "fill" && o.fillStyle === SELECTION))
    const wallInk = strokesOf(ops, INK).slice(0, wallStrokeCount)
    const labels = areaLabels(ops)
    const dims = otherTexts(ops)
    expect(grid.length).toBeGreaterThan(0)
    expect(fills).toHaveLength(1)
    expect(selection.length).toBeGreaterThan(0)
    expect(wallInk.length).toBeGreaterThan(0)
    expect(labels).toHaveLength(1)
    expect(dims.length).toBeGreaterThan(0)
    const last = (xs: DrawOp[]): number => Math.max(...xs.map((o) => o.index))
    const first = (xs: DrawOp[]): number => Math.min(...xs.map((o) => o.index))
    expect(last(grid)).toBeLessThan(fills[0].index)
    expect(fills[0].index).toBeLessThan(first(selection))
    expect(fills[0].index).toBeLessThan(first(wallInk))
    expect(last(wallInk)).toBeLessThan(labels[0].index)
    expect(labels[0].index).toBeLessThan(first(dims))
  })
})

describe("drawScene — подписи площади", () => {
  it("RND-LABEL-1: по подписи в каждой комнате в её центре", () => {
    const labels = areaLabels(draw({ walls: sceneRP() }))
    expect(labels.map((o) => o.text).sort()).toEqual(["5,40 м²", "6,00 м²"])
    const tol = PX_PER_CM * VIEW.zoom + 0.5
    const left = labels.find((o) => o.text === "5,40 м²")
    const right = labels.find((o) => o.text === "6,00 м²")
    expect(left && near(left.at, toScreen({ x: 100, y: 160 }), tol)).toBe(true)
    expect(right && near(right.at, toScreen({ x: 310, y: 160 }), tol)).toBe(true)
    for (const o of labels) expect(o.textAlign).toBe("center")
  })

  it("RND-LABEL-STYLE-1: подпись видима на белой заливке и отцентрована на точке (design D7)", () => {
    const labels = areaLabels(draw({ walls: sceneRP() }))
    expect(labels).toHaveLength(2)
    for (const o of labels) {
      expect(isWhite(o.fillStyle)).toBe(false)
      expect(o.fillStyle).toBe(INK)
      expect(o.textAlign).toBe("center")
      expect(o.textBaseline).toBe("middle")
    }
  })

  it("RND-UNIT-1: подпись не зависит от единицы длин", () => {
    for (const unit of ["m", "cm", "mm"] as const) expect(areaLabels(draw({ walls: sceneR(), unit })).map((o) => o.text)).toEqual(["12,00 м²"])
  })

  it("RND-ZOOM-1: шрифт постоянен в экранных единицах, точка привязки следует за зумом", () => {
    const fonts: string[] = []
    for (const zoom of [1, 4]) {
      const view: View = { zoom, pan: { x: 100, y: 50 } }
      const labels = areaLabels(draw({ walls: sceneR(), view }))
      expect(labels).toHaveLength(1)
      expect(near(labels[0].at, toScreen({ x: 210, y: 160 }, view), PX_PER_CM * zoom + 0.5)).toBe(true)
      fonts.push(labels[0].font)
    }
    expect(fonts[0]).toBe(fonts[1])
    expect(fonts[0]).toContain(`${SCREEN_METRICS.labelPx}px`)
    expect(fonts[0]).toContain(SCREEN_METRICS.font)
  })

  it("RND-PDF-1: метрики PDF — подпись шрифтом PDF", () => {
    const labels = areaLabels(draw({ walls: sceneR(), opts: { grid: false, metrics: PDF_METRICS } }))
    expect(labels.map((o) => o.text)).toEqual(["12,00 м²"])
    expect(labels[0].font).toContain(`${PDF_METRICS.labelPx}px`)
    expect(labels[0].font).toContain(PDF_METRICS.font)
  })
})

describe("drawScene — превью и актуальность", () => {
  it("RND-PREVIEW-1: превью, замыкающее контур, помещения не создаёт", () => {
    const ops = draw({ walls: sceneU(), preview: W(420, 320, 0, 320) })
    expect(roomFills(ops)).toEqual([])
    expect(areaLabels(ops)).toEqual([])
  })

  it("RND-PREVIEW-2: превью, делящее помещение, его не делит", () => {
    const labels = areaLabels(draw({ walls: sceneR(), preview: W(200, 0, 200, 320) }))
    expect(labels.map((o) => o.text)).toEqual(["12,00 м²"])
  })

  it("RND-LIVE-1: изменение стен на месте отражается на следующей отрисовке", () => {
    const walls = sceneR()
    expect(areaLabels(draw({ walls })).map((o) => o.text)).toEqual(["12,00 м²"])
    moveWalls(walls, [walls[1]], { x: 100, y: 0 })
    expect(areaLabels(draw({ walls })).map((o) => o.text)).toEqual(["15,00 м²"])
  })

  it("RND-THICK-LIVE-1: изменение толщины стены на месте отражается на следующей отрисовке", () => {
    const walls = sceneR()
    expect(areaLabels(draw({ walls })).map((o) => o.text)).toEqual(["12,00 м²"])
    walls[1].thicknessCm = 30
    expect(areaLabels(draw({ walls })).map((o) => o.text)).toEqual(["11,85 м²"])
  })
})

describe("PDF с помещениями", () => {
  const font = readFileSync(new URL("./assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")

  it("PDF-SMOKE-1: экспорт чертежа с помещениями строится без ошибок", () => {
    const doc = buildPdf(sceneRP(), [], "mm", 100, "A4", font)
    expect(Buffer.from(doc.output("arraybuffer")).subarray(0, 5).toString()).toBe("%PDF-")
  })
})
