import { describe, expect, it } from "vitest"
import { drawPatternPreview, drawScene } from "./render"
import type { RenderOptions } from "./render"
import { DARK_PALETTE, LIGHT_PALETTE } from "./theme"
import type { Palette } from "./theme"
import { previewCanvas, styleRecorder } from "./theme.test-utils"
import type { PaintOp } from "./theme.test-utils"
import { MATERIALS } from "./types"
import type { Dimension, Material, View, Wall } from "./types"

// Тесты change dark-theme: цвета сцены берутся из палитры (spec color-theme «Две цветовые схемы»,
// «Вспомогательные построения в тёмной схеме», spec room-areas «Заливка помещения», design D2).

const VIEW: View = { zoom: 1, pan: { x: -50, y: -50 } }
const AREA = / м²$/

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

// замкнутый прямоугольник 420×320 — одно помещение
const room = (): Wall[] => [
  wall("n", 0, 0, 420, 0),
  wall("e", 420, 0, 420, 320),
  wall("s", 420, 320, 0, 320),
  wall("w", 0, 320, 0, 0),
]

// размер вдоль северной стены между пересечениями её грани с гранями западной и восточной стен
const northDim = (): Dimension => ({
  from: { a: { wallId: "n", edge: 0 }, b: { wallId: "w", edge: 0 } },
  to: { a: { wallId: "n", edge: 0 }, b: { wallId: "e", edge: 0 } },
  offset: -60,
})

function draw(walls: Wall[], opts: RenderOptions = {}, selected: Wall[] = [], preview: Wall | null = null): PaintOp[] {
  const { ctx, ops } = styleRecorder()
  drawScene(ctx, 1200, 900, walls, preview, "mm", VIEW, selected, opts)
  return ops
}

// все построения сразу: выделение, подсветка, рамка, квадрат, трекинг, угол, линейка, черновик размера
function fullOptions(walls: Wall[], palette?: Palette): RenderOptions {
  const dim = northDim()
  return {
    ...(palette ? { palette } : {}),
    dimensions: [dim],
    selectedDims: [{ ...dim, offset: -120 }],
    hover: walls[2],
    hoverDim: { ...dim, offset: -180 },
    marquee: { x1: 10, y1: 10, x2: 300, y2: 200 },
    marqueeHits: { walls: [walls[3]], dims: [{ ...dim, offset: -240 }] },
    square: [
      { x: 500, y: 0 },
      { x: 520, y: 0 },
      { x: 520, y: 20 },
      { x: 500, y: 20 },
    ],
    tracks: [{ from: { x: 500, y: 100 }, to: { x: 700, y: 100 } }],
    angle: { at: { x: 600, y: 300 }, from: { x: 1, y: 0 }, to: { x: 0, y: 1 }, deg: 90 },
    ruler: { kind: "wall", wall: walls[1], from: walls[1].a, to: walls[1].b, lengthCm: 320 },
    dimDraft: { a: { x: 0, y: 500 }, b: { x: 200, y: 500 }, p1: { x: 0, y: 540 }, p2: { x: 200, y: 540 }, nx: 0, ny: 1 },
    dimRubber: [
      { x: 0, y: 600 },
      { x: 150, y: 650 },
    ],
    dimSnap: { x: 150, y: 650 },
  }
}

const styles = (ops: PaintOp[]): Set<string> => new Set(ops.map((o) => o.style))
const dimTexts = (ops: PaintOp[], kind: "fillText" | "strokeText"): PaintOp[] =>
  ops.filter((o) => o.kind === kind && o.text !== undefined && /^\d+$/.test(o.text))

describe("палитра по умолчанию", () => {
  it("RND-DEFAULT-1: без палитры сцена рисуется ровно как со светлой", () => {
    const walls = room()
    const plain = draw(walls, fullOptions(walls), [walls[0]], wall("p", 500, 400, 800, 400))
    const light = draw(walls, fullOptions(walls, LIGHT_PALETTE), [walls[0]], wall("p", 500, 400, 800, 400))
    expect(plain.length).toBeGreaterThan(20)
    expect(plain).toEqual(light)
  })

  it("RND-DEFAULT-2: ручки стены и размера без палитры — как со светлой", () => {
    const walls = room()
    const dimOpts: RenderOptions = { dimensions: [northDim()], selectedDims: [northDim()] }
    expect(draw(walls, {}, [walls[0]])).toEqual(draw(walls, { palette: LIGHT_PALETTE }, [walls[0]]))
    expect(draw(walls, dimOpts)).toEqual(draw(walls, { ...dimOpts, palette: LIGHT_PALETTE }))
    expect(draw(walls, {}, [walls[0]]).filter((o) => o.kind === "fill" && o.hasArc)).toHaveLength(3)
  })

  // в fullOptions выделены и стена, и размер — ручек нет; залитая дуга одна — точка привязки
  it("RND-FIXTURE-1: сцена полного набора действительно рисует размеры, подписи и точку привязки", () => {
    const walls = room()
    const ops = draw(walls, fullOptions(walls, DARK_PALETTE), [walls[0]])
    expect(dimTexts(ops, "fillText").length).toBeGreaterThanOrEqual(5) // размер, выделенный, подсветка, рамка, линейка, черновик
    expect(ops.some((o) => o.kind === "fillText" && AREA.test(o.text ?? ""))).toBe(true)
    expect(ops.filter((o) => o.kind === "fill" && o.hasArc).length).toBeGreaterThanOrEqual(1)
  })
})

describe("тёмная палитра в сцене", () => {
  it("RND-DARK-ONLY-1: каждый цвет сцены — из тёмной палитры", () => {
    const walls = room()
    const ops = draw(walls, fullOptions(walls, DARK_PALETTE), [walls[0]], wall("p", 500, 400, 800, 400))
    const allowed = new Set(Object.values(DARK_PALETTE))
    for (const s of styles(ops)) expect(allowed.has(s), `цвет ${s} вне тёмной палитры`).toBe(true)
  })

  it("RND-DARK-ONLY-2: одиночная выделенная стена и выделенный размер (ручки) — тоже только тёмная палитра", () => {
    const walls = room()
    const allowed = new Set(Object.values(DARK_PALETTE))
    const wallOps = draw(walls, { palette: DARK_PALETTE }, [walls[1]])
    const dimOps = draw(walls, { palette: DARK_PALETTE, dimensions: [northDim()], selectedDims: [northDim()] })
    for (const s of styles([...wallOps, ...dimOps])) expect(allowed.has(s), `цвет ${s} вне тёмной палитры`).toBe(true)
  })

  it("RND-DARK-GRID-1: сетка — цветом сетки тёмной схемы", () => {
    const ops = draw([], { palette: DARK_PALETTE })
    const strokes = ops.filter((o) => o.kind === "stroke")
    expect(strokes.length).toBeGreaterThan(0)
    expect(strokes[0].style).toBe(DARK_PALETTE.grid)
  })

  it("RND-DARK-FILL-1: помещение залито цветом тёмного фона, не белым", () => {
    const ops = draw(room(), { palette: DARK_PALETTE })
    const fills = ops.filter((o) => o.kind === "fill" && !o.hasArc)
    expect(fills.some((o) => o.style === DARK_PALETTE.paper)).toBe(true)
    expect(ops.some((o) => o.style === "#fff")).toBe(false)
    // заливка идёт после сетки и до стен
    const gridIdx = ops.findIndex((o) => o.kind === "stroke" && o.style === DARK_PALETTE.grid)
    const fillIdx = ops.findIndex((o) => o.kind === "fill" && o.style === DARK_PALETTE.paper)
    const inkIdx = ops.findIndex((o) => o.kind === "stroke" && o.style === DARK_PALETTE.ink)
    expect(gridIdx).toBeLessThan(fillIdx)
    expect(fillIdx).toBeLessThan(inkIdx)
  })

  it("RND-DARK-FILL-2: без сетки (как в PDF) заливки помещений нет и в тёмной схеме", () => {
    const ops = draw(room(), { palette: DARK_PALETTE, grid: false })
    expect(ops.some((o) => o.kind === "fill" && o.style === DARK_PALETTE.paper)).toBe(false)
  })

  it("RND-DARK-INK-1: стены, штриховка и подпись площади — цветом линий", () => {
    const ops = draw(room(), { palette: DARK_PALETTE })
    const strokes = ops.filter((o) => o.kind === "stroke" && o.style !== DARK_PALETTE.grid)
    expect(strokes.length).toBeGreaterThanOrEqual(8) // штриховка и контур каждой из 4 стен
    for (const s of strokes) expect(s.style).toBe(DARK_PALETTE.ink)
    const area = ops.filter((o) => o.kind === "fillText" && AREA.test(o.text ?? ""))
    expect(area).toHaveLength(1)
    expect(area[0].style).toBe(DARK_PALETTE.ink)
  })

  it("RND-DARK-DIM-1: текст размера — цветом линий на подложке цвета фона", () => {
    const ops = draw(room(), { palette: DARK_PALETTE, dimensions: [northDim()] })
    const fills = dimTexts(ops, "fillText")
    const halos = dimTexts(ops, "strokeText")
    expect(fills).toHaveLength(1)
    expect(halos).toHaveLength(1)
    expect(fills[0].style).toBe(DARK_PALETTE.ink)
    expect(halos[0].style).toBe(DARK_PALETTE.paper)
    expect(halos[0].text).toBe(fills[0].text)
  })

  it("RND-DARK-HANDLES-1: ручки стены залиты цветом фона и обведены контуром ручек", () => {
    const walls = room()
    const ops = draw(walls, { palette: DARK_PALETTE }, [walls[0]])
    const arcFills = ops.filter((o) => o.kind === "fill" && o.hasArc)
    const arcStrokes = ops.filter((o) => o.kind === "stroke" && o.hasArc)
    expect(arcFills).toHaveLength(3)
    expect(arcStrokes).toHaveLength(3)
    for (const f of arcFills) expect(f.style).toBe(DARK_PALETTE.paper)
    for (const s of arcStrokes) expect(s.style).toBe(DARK_PALETTE.handleStroke)
  })

  it("RND-DARK-HANDLES-2: ручки выделенного размера — так же", () => {
    const ops = draw(room(), { palette: DARK_PALETTE, dimensions: [northDim()], selectedDims: [northDim()] })
    const arcFills = ops.filter((o) => o.kind === "fill" && o.hasArc)
    expect(arcFills).toHaveLength(2)
    for (const f of arcFills) expect(f.style).toBe(DARK_PALETTE.paper)
    for (const s of ops.filter((o) => o.kind === "stroke" && o.hasArc)) expect(s.style).toBe(DARK_PALETTE.handleStroke)
    const selected = dimTexts(ops, "fillText").filter((o) => o.style === DARK_PALETTE.selectedDim)
    expect(selected).toHaveLength(1)
  })

  it("RND-DARK-SEL-1: обводка выделенной стены — цветом выделения схемы", () => {
    const walls = room()
    const ops = draw(walls, { palette: DARK_PALETTE }, [walls[0], walls[1]])
    expect(ops.filter((o) => o.kind === "fill" && o.style === DARK_PALETTE.selection)).toHaveLength(2)
    expect(ops.filter((o) => o.kind === "stroke" && o.style === DARK_PALETTE.selection)).toHaveLength(2)
  })

  it("RND-DARK-ERASE-1: подсветка ластика стены и размера — цветом ластика схемы", () => {
    const walls = room()
    const wallOps = draw(walls, { palette: DARK_PALETTE, hover: walls[1] })
    // подсветка стены — заливка и обводка формы, без размеров в сцене
    expect(wallOps.filter((o) => o.kind === "fill" && o.style === DARK_PALETTE.erase)).toHaveLength(1)
    expect(wallOps.filter((o) => o.kind === "stroke" && o.style === DARK_PALETTE.erase)).toHaveLength(1)
    const dimOps = draw(walls, { palette: DARK_PALETTE, hoverDim: northDim() })
    expect(dimTexts(dimOps, "fillText").map((o) => o.style)).toEqual([DARK_PALETTE.erase])
  })

  it("RND-DARK-MARQUEE-1: рамка и попадания рамки — цветами схемы", () => {
    const walls = room()
    const ops = draw(walls, {
      palette: DARK_PALETTE,
      marquee: { x1: 0, y1: 0, x2: 100, y2: 100 },
      marqueeHits: { walls: [walls[0]], dims: [northDim()] },
    })
    expect(ops.filter((o) => o.kind === "strokeRect").map((o) => o.style)).toEqual([DARK_PALETTE.ink])
    expect(ops.some((o) => o.kind === "fill" && o.style === DARK_PALETTE.marqueeWall)).toBe(true)
    expect(dimTexts(ops, "fillText").map((o) => o.style)).toEqual([DARK_PALETTE.marqueeDim])
  })

  it("RND-DARK-AUX-1: квадрат установки, трекинг и резинка размера — цветами схемы", () => {
    const o = fullOptions(room(), DARK_PALETTE)
    const square = draw([], { palette: DARK_PALETTE, grid: false, square: o.square })
    const tracks = draw([], { palette: DARK_PALETTE, grid: false, tracks: o.tracks })
    const rubber = draw([], { palette: DARK_PALETTE, grid: false, dimRubber: o.dimRubber })
    expect(square.map((x) => x.style)).toEqual([DARK_PALETTE.square])
    expect(tracks.map((x) => x.style)).toEqual([DARK_PALETTE.track])
    expect(rubber.map((x) => x.style)).toEqual([DARK_PALETTE.muted])
  })

  it("RND-DARK-DRAFT-1: черновик размера — приглушённым цветом на подложке фона", () => {
    const o = fullOptions(room(), DARK_PALETTE)
    const ops = draw([], { palette: DARK_PALETTE, grid: false, dimDraft: o.dimDraft })
    expect(dimTexts(ops, "fillText").map((x) => x.style)).toEqual([DARK_PALETTE.muted])
    expect(dimTexts(ops, "strokeText").map((x) => x.style)).toEqual([DARK_PALETTE.paper])
  })

  it("RND-DARK-SNAP-1: точка привязки — цветом привязки с обводкой цветом фона", () => {
    const ops = draw([], { palette: DARK_PALETTE, grid: false, dimSnap: { x: 10, y: 10 } })
    expect(ops.map((o) => [o.kind, o.style])).toEqual([
      ["fill", DARK_PALETTE.snap],
      ["stroke", DARK_PALETTE.paper],
    ])
  })

  it("RND-DARK-ANGLE-1: угол построения — цветом угла на тёмной подложке", () => {
    const o = fullOptions(room(), DARK_PALETTE)
    const ops = draw([], { palette: DARK_PALETTE, grid: false, angle: o.angle })
    expect(ops.find((x) => x.kind === "stroke")?.style).toBe(DARK_PALETTE.angle)
    expect(ops.filter((x) => x.kind === "fillRect").map((x) => x.style)).toEqual([DARK_PALETTE.labelBg])
    expect(ops.filter((x) => x.kind === "strokeRect").map((x) => x.style)).toEqual([DARK_PALETTE.angle])
    expect(ops.filter((x) => x.kind === "fillText").map((x) => [x.text, x.style])).toEqual([["90°", DARK_PALETTE.angle]])
  })

  it("RND-DARK-RULER-1: замер линейки — цветом угла схемы на подложке фона", () => {
    const walls = room()
    const ops = draw(walls, {
      palette: DARK_PALETTE,
      grid: false,
      ruler: { kind: "wall", wall: walls[1], from: walls[1].a, to: walls[1].b, lengthCm: 320 },
    })
    expect(dimTexts(ops, "fillText").map((x) => [x.text, x.style])).toEqual([["3200", DARK_PALETTE.angle]])
    expect(dimTexts(ops, "strokeText").map((x) => x.style)).toEqual([DARK_PALETTE.paper])
  })

  it("RND-DARK-RULER-2: пролёт и угол помещения у линейки — цветом угла на тёмной подложке", () => {
    const ops = draw([], {
      palette: DARK_PALETTE,
      grid: false,
      ruler: {
        kind: "space",
        horizontal: { from: { x: 10, y: 100 }, to: { x: 410, y: 100 }, lengthCm: 400 },
        vertical: null,
        angles: [{ at: { x: 10, y: 10 }, startDir: { x: 1, y: 0 }, sweepDeg: 90, deg: 90 }],
      },
    })
    expect(dimTexts(ops, "fillText").map((x) => [x.text, x.style])).toEqual([["4000", DARK_PALETTE.angle]])
    expect(dimTexts(ops, "strokeText").map((x) => x.style)).toEqual([DARK_PALETTE.paper])
    expect(ops.filter((x) => x.kind === "fillText" && x.text === "90°").map((x) => x.style)).toEqual([DARK_PALETTE.angle])
    expect(ops.filter((x) => x.kind === "fillRect").map((x) => x.style)).toEqual([DARK_PALETTE.labelBg])
    expect(ops.filter((x) => x.kind === "strokeRect").map((x) => x.style)).toEqual([DARK_PALETTE.angle])
    for (const s of ops.filter((x) => x.kind === "stroke")) expect(s.style).toBe(DARK_PALETTE.angle)
  })

  it("RND-DARK-PREVIEW-1: превью стены — цветом линий схемы", () => {
    const ops = draw([], { palette: DARK_PALETTE, grid: false }, [], wall("p", 0, 0, 300, 0))
    expect(ops.length).toBeGreaterThan(0)
    for (const o of ops) expect(o.style).toBe(DARK_PALETTE.ink)
  })
})

describe("превью штриховок материалов", () => {
  const materials: Material[] = MATERIALS.map((m) => m.id)

  it.each(materials)("PATTERN-DARK-1: %s — цветом линий тёмной схемы", (mat) => {
    const { canvas, ops } = previewCanvas()
    drawPatternPreview(canvas, mat, DARK_PALETTE)
    expect(ops.length).toBeGreaterThan(0)
    for (const o of ops) expect(o.style).toBe(DARK_PALETTE.ink)
  })

  it.each(materials)("PATTERN-LIGHT-1: %s без палитры — прежним цветом «#333»", (mat) => {
    const { canvas, ops } = previewCanvas()
    drawPatternPreview(canvas, mat)
    expect(ops.length).toBeGreaterThan(0)
    for (const o of ops) expect(o.style).toBe("#333")
  })
})
