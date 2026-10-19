import { strokeCommunications } from "../communications/communications-render"
import { markDimensions } from "../demolition/mark-dimensions"
import { drawCallouts } from "../callout/callout-render"
import { drawDimensionGeom, drawElementsLayer, drawRoomBlocks, drawScene, prepareCanvas, SCREEN_METRICS, tracePolygons } from "../render"
import type { RenderMetrics } from "../render"
import type { Room } from "../room-area"
import type { RoomBlock } from "../room-block"
import type { RulerReading } from "../ruler"
import { LIGHT_PALETTE } from "../theme"
import type { Palette, Theme } from "../theme"
import { PX_PER_CM } from "../types"
import type { Battery, Callout, Communication, Point, Screed, Unit, View, Wall, WallElement } from "../types"
import { SCREED_HATCH, strokeHatchSeries } from "../wall-hatch"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { screedLabelBox } from "./screed-label"
import { screedLabel } from "./rough-model"

// Отрисовка плана «Черновые работы» (change add-rough-works-plan, design D4, D8, D9): подложка — результат «Монтажа» серым,
// стяжка — штриховкой помещения, штукатурка — фиолетовой полосой; блоки помещений поверх. Одна функция для холста и PDF.

// подсветка цели инструмента «Штукатурка» (change plaster-click-whole-face, design D6): куски на стенах подложки
export interface PlasterGhostPiece {
  wall: Wall // стена подложки
  from: number
  to: number
  face: 1 | -1
}

export interface PlasterGhost {
  pieces: readonly PlasterGhostPiece[]
  thicknessMm: number
}

export interface RoughSceneView {
  walls: readonly Wall[] // подложка: остатки и собственные стены «Монтажа»
  doorways: readonly WallElement[]
  communications?: readonly Communication[]
  batteries?: readonly Battery[]
  pieces: readonly PlasterPiece[]
  screeds: readonly { screed: Screed; room: Room }[]
  blocks: readonly RoomBlock[]
  selectedPlasterId?: string | null
  selectedScreedId?: string | null
  ghost?: PlasterGhost | null
  ruler?: RulerReading | null
  erasing?: { kind: "plaster" | "screed"; id: string } | null
  callouts?: readonly Callout[]
  selectedCalloutId?: string | null
  erasingCalloutId?: string | null
}

export interface RoughOptions {
  grid?: boolean
  metrics?: RenderMetrics
  palette?: Palette
  theme?: Theme
  // размеры участков штукатурки (холст); в PDF их нет (spec pdf-export «Страница плана «Черновые работы»»)
  dimensions?: boolean
}

export interface PlasterColors {
  fill: string
  stroke: string
}

// штукатурка — фиолетовая заливка с тёмным контуром (spec rough-works-plan «Цвет штукатурки»); PDF — всегда светлая схема
export const plasterColors = (theme: Theme): PlasterColors =>
  theme === "dark" ? { fill: "#b768bd", stroke: "#e9c4ec" } : { fill: "#a44ea8", stroke: "#4a1f4d" }

const GHOST_DASH = [6, 4]
const GHOST_ALPHA = 0.45

export function drawRoughScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: RoughSceneView,
  unit: Unit,
  view: View,
  opts: RoughOptions = {},
): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const palette = opts.palette ?? LIGHT_PALETTE
  const colors = plasterColors(opts.theme ?? "light")
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  const origin = toScreen({ x: 0, y: 0 })
  const walls = [...scene.walls]
  const grey = { ...palette, ink: palette.muted }

  const highlight = (polys: Point[][], color: string): void => {
    ctx.strokeStyle = color
    ctx.lineWidth = m.contourPx * 2
    for (const poly of polys) {
      tracePolygons(ctx, [poly])
      ctx.stroke()
    }
  }

  // слой под телами стен: штриховка стяжки по помещению, затем полосы штукатурки
  const beneath = (c: CanvasRenderingContext2D): void => {
    for (const { screed, room } of scene.screeds) {
      const outline = room.outline.map(toScreen)
      c.save()
      tracePolygons(c, [outline])
      c.clip()
      c.strokeStyle = palette.ink
      strokeHatchSeries(c, outline, SCREED_HATCH, origin, m)
      c.restore()
      // острова внутри помещения стяжкой не покрываются
      c.fillStyle = palette.paper
      for (const hole of room.holes) {
        tracePolygons(c, [hole.map(toScreen)])
        c.fill()
      }
      c.strokeStyle = palette.ink
      c.lineWidth = m.hatchPx
      tracePolygons(c, [outline, ...room.holes.map((hole) => hole.map(toScreen))])
      c.stroke()
      if (scene.erasing?.kind === "screed" && scene.erasing.id === screed.id) highlight([outline], palette.erase)
    }
    for (const piece of scene.pieces) {
      const poly = plasterStrip(piece).map(toScreen)
      c.fillStyle = colors.fill
      tracePolygons(c, [poly])
      c.fill()
      c.strokeStyle = colors.stroke
      c.lineWidth = m.hatchPx
      c.stroke()
      if (scene.erasing?.kind === "plaster" && scene.erasing.id === piece.mark.id) highlight([poly], palette.erase)
      else if (scene.selectedPlasterId === piece.mark.id) highlight([poly], palette.selection)
    }
  }

  drawScene(ctx, w, h, walls, null, unit, view, [], {
    grid: opts.grid,
    metrics: m,
    palette: grey,
    dimensions: [],
    doorways: [...scene.doorways],
    batteries: scene.batteries,
    ruler: scene.ruler,
    underlay: true,
    beneath,
  })

  drawElementsLayer(ctx, walls, unit, view, { metrics: m, palette: grey, doorways: [...scene.doorways] })
  strokeCommunications(ctx, scene.communications ?? [], view, palette.ink, m.contourPx, palette.concreteFill)

  // блоки помещений — обычным цветом, поверх штриховки и полос
  drawRoomBlocks(ctx, scene.blocks, null, toScreen, m, palette)

  // размеры участков: у выделенной пометки — цепочка своей грани, у остальных — только ширина
  for (const piece of opts.dimensions === false ? [] : scene.pieces) {
    const selected = scene.selectedPlasterId === piece.mark.id
    for (const d of markDimensions(piece, walls, "chain", unit, k, m.labelPx)) {
      if (d.side !== piece.mark.face || (!selected && d.target !== "width")) continue
      drawDimensionGeom(ctx, d.geom, d.text, colors.stroke, view, m, palette, false, selected)
    }
  }

  const ghost = scene.ghost
  if (ghost) {
    for (const part of ghost.pieces) {
      const piece: PlasterPiece = {
        mark: { id: "ghost", wallId: part.wall.id, face: part.face, anchor: "a", fromCm: part.from, toCm: part.to, thicknessMm: ghost.thicknessMm },
        wall: part.wall,
        from: part.from,
        to: part.to,
      }
      ctx.save()
      const strip = plasterStrip(piece).map(toScreen)
      // подсветка — полупрозрачная фиолетовая полоса с пунктирным контуром; размеров у неё нет
      ctx.globalAlpha = GHOST_ALPHA
      ctx.fillStyle = colors.fill
      tracePolygons(ctx, [strip])
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = colors.stroke
      ctx.lineWidth = m.contourPx
      ctx.setLineDash(GHOST_DASH)
      ctx.stroke()
      ctx.restore()
    }
  }

  // подписи стяжек: подложка цвета бумаги и текст постоянного размера в опорной точке
  ctx.save()
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (const { screed } of scene.screeds) {
    const at = toScreen(screed.at)
    const box = screedLabelBox(at, screed.thicknessMm, m.labelPx)
    ctx.fillStyle = palette.paper
    ctx.fillRect(box.x, box.y, box.w, box.h)
    ctx.fillStyle = palette.ink
    ctx.fillText(screedLabel(screed.thicknessMm), at.x, at.y)
    if (scene.selectedScreedId === screed.id) {
      ctx.strokeStyle = palette.selection
      ctx.lineWidth = m.contourPx * 2
      ctx.strokeRect(box.x, box.y, box.w, box.h)
    }
  }
  ctx.restore()

  if (scene.callouts?.length) drawCallouts(ctx, scene.callouts, view, m, palette, { selected: scene.selectedCalloutId, erasing: scene.erasingCalloutId })
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderRough(canvas: HTMLCanvasElement, scene: RoughSceneView, unit: Unit, view: View, opts: RoughOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawRoughScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}

// точки габаритов подложки страницы для PDF: вершины полос и рамки подписей стяжек (см чертежа); kMm — мм листа на см чертежа
export function roughExtent(scene: Pick<RoughSceneView, "pieces" | "screeds">, kMm: number, labelPx: number): Point[] {
  const strips = scene.pieces.flatMap(plasterStrip)
  const labels = scene.screeds.flatMap(({ screed }): Point[] => {
    const box = screedLabelBox({ x: 0, y: 0 }, screed.thicknessMm, labelPx)
    const hw = box.w / 2 / kMm
    const hh = box.h / 2 / kMm
    return [
      { x: screed.at.x - hw, y: screed.at.y - hh },
      { x: screed.at.x + hw, y: screed.at.y + hh },
    ]
  })
  return [...strips, ...labels]
}
