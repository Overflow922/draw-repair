import { drawCallouts } from "../callout/callout-render"
import { previewSceneOf } from "../preview-scene"
import { drawDimensionsLayer, drawGestureOverlays, drawHandles, drawPlacementHints, prepareCanvas, SCREEN_METRICS, tracePolygons } from "../render"
import type { RenderOptions } from "../render"
import { drawRoughScene } from "../rough/rough-render"
import type { RoughSceneView } from "../rough/rough-render"
import { LIGHT_PALETTE } from "../theme"
import type { Palette, Theme } from "../theme"
import { PX_PER_CM } from "../types"
import type { DrywallWall, Point, Unit, View, Wall } from "../types"
import { contourSegments, displayPolygons } from "../wall-geometry"
import type { PlasterPiece } from "../rough/plaster"

// Отрисовка плана «Реконструкция» (change reconstruction-plan, design D5, D6): подложка — «Черновые работы» без стяжки и блоков
// помещений, штукатурка серая; поверх — стены гипсокартона зелёной заливкой в реальном масштабе толщины. Одна функция для холста и PDF.

export interface DrywallColors {
  fill: string
  stroke: string
}

// гипсокартон — зелёная заливка с тёмным контуром (spec reconstruction-plan «Цвет гипсокартона»); PDF — всегда светлая схема
export const drywallColors = (theme: Theme): DrywallColors =>
  theme === "dark" ? { fill: "#4f9a56", stroke: "#c6e8c9" } : { fill: "#6dbd6a", stroke: "#1e5a24" }

export interface ReconstructionView extends Omit<RoughSceneView, "screeds" | "blocks" | "selectedScreedId" | "ghost" | "erasing" | "ruler"> {
  walls: readonly Wall[] // подложка: остатки и собственные стены «Монтажа»
  pieces: readonly PlasterPiece[]
  drywall: readonly DrywallWall[]
  preview?: DrywallWall | null
  // подсветка стен под выделением, ластиком и рамкой: контур цвета под телом стены
  outlines?: readonly { wall: DrywallWall; color: string }[]
  // стена с маркерами правки (одиночное выделение)
  handles?: DrywallWall | null
  // слой поверх стен гипсокартона и под размерами: столы плана «Мебель» (change furniture-plan-table, design D3)
  above?: (ctx: CanvasRenderingContext2D, toScreen: (p: Point) => Point) => void
}

// опции холста и PDF: жесты построения (квадрат установки, размеры, рамка, линейка) приходят теми же полями, что у обмерочного плана
export interface ReconstructionOptions extends RenderOptions {
  theme?: Theme
}

const PREVIEW_ALPHA = 0.4

// заливка и контур одной стены; контур собирается цепочкой — один подпуть на связный контур, швы между стенами не рисуются
function drawDrywallWall(ctx: CanvasRenderingContext2D, wall: DrywallWall, all: Wall[], toScreen: (p: Point) => Point, colors: DrywallColors, contourPx: number): void {
  ctx.fillStyle = colors.fill
  tracePolygons(ctx, displayPolygons(wall, all).map((poly) => poly.map(toScreen)))
  ctx.fill()
  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = contourPx
  ctx.lineCap = "square"
  ctx.beginPath()
  let end: Point | null = null
  for (const { p1, p2 } of contourSegments(wall, all)) {
    const s1 = toScreen(p1)
    const s2 = toScreen(p2)
    if (!end || Math.hypot(end.x - s1.x, end.y - s1.y) > 1e-6) ctx.moveTo(s1.x, s1.y)
    ctx.lineTo(s2.x, s2.y)
    end = s2
  }
  ctx.stroke()
  ctx.lineCap = "butt"
}

// halo под телом стены: заливка и контур формы цветом подсветки (как drawOutline обмерочного плана)
function drawHalo(ctx: CanvasRenderingContext2D, wall: DrywallWall, all: Wall[], toScreen: (p: Point) => Point, color: string, contourPx: number): void {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = contourPx * 4
  ctx.lineJoin = "round"
  const polys = displayPolygons(wall, all).map((poly) => poly.map(toScreen))
  tracePolygons(ctx, polys)
  ctx.fill()
  tracePolygons(ctx, polys)
  ctx.stroke()
  ctx.lineJoin = "miter"
}

export function drawReconstructionScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: ReconstructionView,
  unit: Unit,
  view: View,
  opts: ReconstructionOptions = {},
): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const palette: Palette = opts.palette ?? LIGHT_PALETTE
  const colors = drywallColors(opts.theme ?? "light")
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  const own = [...scene.drywall]
  // геометрия стен ГКЛ считается по ним самим: подложка торцы и углы гипсокартона не меняет
  const drywallScene: Wall[] = scene.preview ? [...own, scene.preview] : own
  const sceneOf = previewSceneOf(scene.preview ?? null, own, drywallScene)
  const drawn: RenderOptions = { ...opts, metrics: m, palette }

  const overlay = (c: CanvasRenderingContext2D): void => {
    for (const { wall, color } of scene.outlines ?? []) drawHalo(c, wall, sceneOf(wall), toScreen, color, m.contourPx)
    for (const wall of own) drawDrywallWall(c, wall, sceneOf(wall), toScreen, colors, m.contourPx)
    if (scene.preview) {
      c.globalAlpha = PREVIEW_ALPHA
      drawDrywallWall(c, scene.preview, drywallScene, toScreen, colors, m.contourPx)
      c.globalAlpha = 1
    }
    scene.above?.(c, toScreen)
    if (scene.handles) drawHandles(c, scene.handles, toScreen, palette)
    drawPlacementHints(c, toScreen, drawn, m, palette)
    // размеры плана — по полному списку стен: подложка и гипсокартон
    drawDimensionsLayer(c, [...scene.walls, ...own], unit, view, drawn, (opts.selectedDims ?? []).length === 1)
  }

  drawRoughScene(
    ctx,
    w,
    h,
    { ...scene, screeds: [], blocks: [], callouts: undefined },
    unit,
    view,
    { grid: opts.grid, metrics: m, palette, theme: opts.theme, dimensions: false, plasterPaint: { fill: palette.muted, stroke: palette.muted }, overlay },
  )
  if (scene.callouts?.length) drawCallouts(ctx, scene.callouts, view, m, palette, { selected: scene.selectedCalloutId, erasing: scene.erasingCalloutId })
  drawGestureOverlays(ctx, toScreen, unit, view, drawn, m, palette)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderReconstruction(canvas: HTMLCanvasElement, scene: ReconstructionView, unit: Unit, view: View, opts: ReconstructionOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawReconstructionScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
