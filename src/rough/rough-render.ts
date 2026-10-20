import { batteryRect } from "../battery/battery-geometry"
import { hostOfBattery } from "../battery/battery-motion"
import { strokeCommunications } from "../communications/communications-render"
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
import { plasterStrip, revealSpan } from "./plaster"
import { revealDimension } from "./plaster-reveal"
import type { PlasterPiece } from "./plaster"
import { plasterDimensions, plasterRunDimensions } from "./plaster-dimensions"
import { endDimension } from "./plaster-end"
import type { PlasterTargetPiece } from "./plaster-face"
import { screedLabelBox } from "./screed-label"
import { screedThresholds } from "./screed-threshold"
import { screedLabel } from "./rough-model"

// Отрисовка плана «Черновые работы» (change add-rough-works-plan, design D4, D8, D9): подложка — результат «Монтажа» серым,
// стяжка — штриховкой помещения, штукатурка — фиолетовой полосой; блоки помещений поверх. Одна функция для холста и PDF.

// подсветка цели инструмента «Штукатурка» (change plaster-click-whole-face, design D6): куски на стенах подложки
// измеренная подсветка — превью протяжки (change plaster-partial-drag): у неё показан размер участка; у цели клика размеров нет
export interface PlasterGhost {
  pieces: readonly PlasterTargetPiece[]
  thicknessMm: number
  measured?: boolean
}

// кусок подсветки как кусок пометки той же толщины; откос без протяжённости (проём уже половины толщины) не подсвечивается
function ghostPiece(part: PlasterTargetPiece, thicknessMm: number): PlasterPiece[] {
  const id = "ghost"
  if (part.face === "end") return [{ mark: { id, wallId: part.wall.id, face: "end", anchor: part.end, thicknessMm }, wall: part.wall, from: part.from, to: part.to }]
  if (part.face === "reveal") {
    const span = revealSpan(part.element, part.wall, part.jamb, thicknessMm)
    return span ? [{ mark: { id, face: "reveal", elementId: part.element.id, jamb: part.jamb, thicknessMm }, wall: part.wall, from: span[0], to: span[1] }] : []
  }
  return [{ mark: { id, wallId: part.wall.id, face: part.face, anchor: "a", fromCm: part.from, toCm: part.to, thicknessMm }, wall: part.wall, from: part.from, to: part.to }]
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
  // цвет полос штукатурки вместо фиолетового (подложка плана «Реконструкция» рисует её серой, change reconstruction-plan, design D5)
  plasterPaint?: PlasterColors
  // слой поверх подложки и полос, под подписями стяжек и выносками (стены гипсокартона плана «Реконструкция»)
  overlay?: (ctx: CanvasRenderingContext2D) => void
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
  const colors = opts.plasterPaint ?? plasterColors(opts.theme ?? "light")
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  const origin = toScreen({ x: 0, y: 0 })
  const walls = [...scene.walls]
  const grey = { ...palette, ink: palette.muted }
  const thresholds = screedThresholds(walls, scene.doorways, scene.screeds)

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
    // объекты в помещениях закрывают пол: штриховка под телом батареи не видна
    c.fillStyle = palette.paper
    for (const battery of scene.screeds.length ? (scene.batteries ?? []) : []) {
      const host = hostOfBattery(battery, walls)
      if (!host) continue
      tracePolygons(c, [batteryRect(battery, host).map(toScreen)])
      c.fill()
    }
    for (const piece of scene.pieces) if (piece.mark.face !== "reveal") paintPiece(c, piece)
  }

  // полоса штукатурки с подсветкой выделения и ластика
  const paintPiece = (c: CanvasRenderingContext2D, piece: PlasterPiece): void => {
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

  // порог проёма — часть пола: рисуется слоем элементов поверх закраски проёма бумагой (иначе закраска стирает штриховку);
  // половины со стяжкой штрихуются с той же фазой, что помещения, линия — где уровни различаются
  const openingFloor = (c: CanvasRenderingContext2D): void => {
    for (const threshold of thresholds) {
      for (const half of threshold.halves) {
        const poly = half.poly.map(toScreen)
        c.save()
        tracePolygons(c, [poly])
        c.clip()
        c.strokeStyle = palette.ink
        strokeHatchSeries(c, poly, SCREED_HATCH, origin, m)
        c.restore()
      }
      if (!threshold.divider) continue
      const [from, to] = [toScreen(threshold.divider.p1), toScreen(threshold.divider.p2)]
      c.strokeStyle = palette.ink
      c.lineWidth = m.hatchPx
      c.beginPath()
      c.moveTo(from.x, from.y)
      c.lineTo(to.x, to.y)
      c.stroke()
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

  drawElementsLayer(ctx, walls, unit, view, { metrics: m, palette: grey, doorways: [...scene.doorways], openingFloor })
  // откос лежит в проёме: слой элементов закрашивает проём бумагой, поэтому откосы рисуются поверх него
  for (const piece of scene.pieces) if (piece.mark.face === "reveal") paintPiece(ctx, piece)
  strokeCommunications(ctx, scene.communications ?? [], view, palette.ink, m.contourPx, palette.concreteFill)

  // блоки помещений — обычным цветом, поверх штриховки и полос
  drawRoomBlocks(ctx, scene.blocks, null, toScreen, m, palette)

  const ghost = scene.ghost
  const ghostPieces: PlasterPiece[] = ghost ? ghost.pieces.flatMap((part) => ghostPiece(part, ghost.thicknessMm)) : []
  if (ghost) {
    for (const piece of ghostPieces) {
      ctx.save()
      const strip = plasterStrip(piece).map(toScreen)
      // подсветка — полупрозрачная фиолетовая полоса с пунктирным контуром; размер только у превью протяжки (ниже)
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

  opts.overlay?.(ctx)

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

  // размеры участков — поверх всего чертежа; один размер на непрерывную полосу плоскости (сегменты ширины по проёмам); у выделенной
  // пометки к нему добавлены расстояния до стыков, у остальных — только ширина
  ctx.save()
  ctx.font = `${m.labelPx}px ${m.font}`
  if (opts.dimensions !== false) {
    const runs = plasterRunDimensions(scene.pieces, walls, scene.doorways, unit, k, m.labelPx)
    const inRun = new Set(runs.flatMap((run) => run.endPieces))
    // торец — один размер, длина торца (change plaster-wall-end-face, design D7); торец в плоскости входит в размер участка
    for (const piece of scene.pieces) {
      if (piece.mark.face !== "end" || inRun.has(piece)) continue
      const d = endDimension(piece.wall, piece.mark.anchor, piece.from, piece.to, piece.mark.thicknessMm, unit, k, m.labelPx)
      if (d) drawDimensionGeom(ctx, d.geom, d.text, colors.stroke, view, m, palette, false, scene.selectedPlasterId === piece.mark.id, true)
    }
    // откос — один размер, толщина стены (change plaster-opening-reveals, design D5)
    for (const piece of scene.pieces) {
      const d = revealDimension(piece, unit, k, m.labelPx)
      if (d) drawDimensionGeom(ctx, d.geom, d.text, colors.stroke, view, m, palette, false, scene.selectedPlasterId === piece.mark.id, true)
    }
    for (const run of runs) {
      const selected = scene.selectedPlasterId !== null && scene.selectedPlasterId !== undefined && run.markIds.includes(scene.selectedPlasterId)
      for (const d of run.dimensions) {
        if (selected || d.target === "width") drawDimensionGeom(ctx, d.geom, d.text, colors.stroke, view, m, palette, false, selected, true)
      }
    }
  }
  // превью протяжки — ширина участка, как у невыделенной пометки
  for (const piece of opts.dimensions === false || !ghost?.measured ? [] : ghostPieces) {
    if (piece.mark.face === "end") continue
    for (const d of plasterDimensions(piece, scene.pieces, walls, unit, k, m.labelPx, scene.doorways)) {
      if (d.target === "width") drawDimensionGeom(ctx, d.geom, d.text, colors.stroke, view, m, palette, false, false, true)
    }
  }
  ctx.restore()
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
