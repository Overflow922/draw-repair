import { drawDimensionGeom, drawElementsLayer, drawScene, prepareCanvas, SCREEN_METRICS, strokeHatch135, tracePolygons } from "../render"
import type { RenderMetrics } from "../render"
import type { RulerReading } from "../ruler"
import { LIGHT_PALETTE } from "../theme"
import type { Palette, Theme } from "../theme"
import { PX_PER_CM } from "../types"
import type { Point, Unit, View, Wall, WallElement } from "../types"
import { markDimensions } from "./mark-dimensions"
import type { MarkSpan, ResolvedMark } from "./mark-model"
import { markRegion } from "./mark-region"

// Отрисовка плана «Демонтаж» (change demolition-plan, design D8): геометрия обмерочного плана серой подложкой
// и область сноса каждой действующей пометки — закрашена бумагой, красный контур и красная штриховка 135°.
// Одна функция для холста и PDF.

export interface DemolitionScene {
  walls: readonly Wall[] // подложка: стены обмерочного плана
  doorways: readonly WallElement[] // элементы подложки — без скрытых сносом
  marks: readonly ResolvedMark[]
  selectedId?: string | null
  ghost?: { wallId: string; from: number; to: number } | null // превью протяжки, от конца a
  ruler?: RulerReading | null // замеры инструмента «Линейка» по подложке
  erasing?: string | null // пометка под курсором ластика: область обводится цветом подсветки ластика
}

export interface DemolitionOptions {
  color: string // красный сноса
  grid?: boolean
  metrics?: RenderMetrics
  palette?: Palette
}

export const demolitionColor = (theme: Theme): string => (theme === "dark" ? "#ff5252" : "#d32f2f")

const GHOST_DASH = [6, 4]

export function drawDemolitionScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: DemolitionScene,
  unit: Unit,
  view: View,
  opts: DemolitionOptions,
): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const palette = opts.palette ?? LIGHT_PALETTE
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  const walls = [...scene.walls]
  const doorways = [...scene.doorways]
  const grey = { ...palette, ink: palette.muted } // подложка и элементы стен серые
  drawScene(ctx, w, h, walls, null, unit, view, [], {
    grid: opts.grid,
    metrics: m,
    palette: grey,
    dimensions: [],
    doorways,
    ruler: scene.ruler,
    underlay: true,
  })

  // цепочка размеров пометки как у проёма (changes demolition-doorway-sizes, demolition-corner-dimensions): размеры чертежа
  // с выносными линиями, нулевые опущены; underline — правимые числа выделенной пометки
  const drawDimensions = (span: MarkSpan, underline: boolean): void => {
    for (const d of markDimensions(span, scene.walls, "chain", unit, k, m.labelPx)) drawDimensionGeom(ctx, d.geom, d.text, opts.color, view, m, palette, false, underline)
  }
  // штриховка линиями 135°: линия проходит через точку при y − x = const, фаза — от начала координат экрана
  const origin = toScreen({ x: 0, y: 0 })
  const hatchAnchor = origin.y - origin.x
  for (const r of scene.marks) {
    const polygons = markRegion(r, walls).map((poly) => poly.map(toScreen))
    ctx.save()
    ctx.fillStyle = palette.paper
    tracePolygons(ctx, polygons)
    ctx.fill()
    ctx.clip()
    ctx.strokeStyle = opts.color
    ctx.lineWidth = m.hatchPx
    strokeHatch135(ctx, polygons.flat(), hatchAnchor, m)
    ctx.restore()
    ctx.strokeStyle = opts.color
    ctx.lineWidth = m.contourPx
    for (const poly of polygons) {
      tracePolygons(ctx, [poly])
      ctx.stroke()
    }
    // подсветка ластика — обводка области поверх контура
    if (scene.erasing === r.mark.id) {
      ctx.strokeStyle = palette.erase
      ctx.lineWidth = m.contourPx * 2
      for (const poly of polygons) {
        tracePolygons(ctx, [poly])
        ctx.stroke()
      }
    }
    drawDimensions(r, scene.selectedId === r.mark.id)
  }

  // элементы стен не скрываются сносом и рисуются поверх закраски области (change demolition-show-elements)
  drawElementsLayer(ctx, walls, unit, view, { metrics: m, palette: grey, doorways })

  const ghost = scene.ghost
  const ghostWall = ghost ? walls.find((x) => x.id === ghost.wallId) : undefined
  if (ghost && ghostWall) {
    const span: MarkSpan = { wall: ghostWall, from: ghost.from, to: ghost.to }
    ctx.save()
    ctx.strokeStyle = opts.color
    ctx.lineWidth = m.contourPx
    ctx.setLineDash(GHOST_DASH)
    for (const poly of markRegion(span, walls)) {
      tracePolygons(ctx, [poly.map(toScreen)])
      ctx.stroke()
    }
    ctx.restore()
    drawDimensions(span, false)
  }
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderDemolition(canvas: HTMLCanvasElement, scene: DemolitionScene, unit: Unit, view: View, opts: DemolitionOptions): void {
  const target = prepareCanvas(canvas)
  if (target) drawDemolitionScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
