import { drawFurnitureScene } from "../furniture/furniture-render"
import type { FurnitureView } from "../furniture/furniture-render"
import type { ReconstructionOptions } from "../reconstruction/reconstruction-render"
import { prepareCanvas } from "../render"
import type { Unit, View } from "../types"

// Отрисовка плана «Сантехника» (change add-plumbing-plan, design D7): подложка и приборы рисуются как на плане «Мебель», но приборы
// только для чтения — без подсветки выделения и ластика, пересечений, призрака и правимых чисел; габариты приборов, затем размеры
// плана, точки которых разрешаются по тем же приборам. Страница PDF идёт через drawFurnitureScene.

export type PlumbingView = Pick<
  FurnitureView,
  "walls" | "doorways" | "communications" | "batteries" | "pieces" | "drywall" | "callouts" | "selectedCalloutId" | "erasingCalloutId" | "items"
>

export function drawPlumbingScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: PlumbingView, unit: Unit, view: View, opts: ReconstructionOptions = {}): void {
  drawFurnitureScene(ctx, w, h, { ...scene }, unit, view, { ...opts, dimItems: scene.items })
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderPlumbing(canvas: HTMLCanvasElement, scene: PlumbingView, unit: Unit, view: View, opts: ReconstructionOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawPlumbingScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
