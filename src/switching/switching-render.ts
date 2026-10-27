import { drawCeilingScene } from "../ceiling/ceiling-render"
import type { CeilingOptions, CeilingView } from "../ceiling/ceiling-render"
import { prepareCanvas } from "../render"
import type { Unit, View } from "../types"

// Отрисовка плана «Группы включения» (change add-switching-plan, design D4): снизу вверх — подложка «Реконструкции», предметы «Мебели»
// серыми линиями без габаритов, знаки объектов освещения, выноски и примечания. Это слои «Потолков и освещения» без натяжных потолков
// и без расстояний: поэтому сцена идёт через drawCeilingScene с пустым списком потолков и без тел стен для расстояний. Одна функция
// для холста и PDF.

export type SwitchingView = Pick<CeilingView, "walls" | "doorways" | "communications" | "batteries" | "pieces" | "drywall" | "callouts" | "selectedCalloutId" | "erasingCalloutId" | "items" | "lights">

export function drawSwitchingScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SwitchingView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  drawCeilingScene(ctx, w, h, { ...scene, ceilings: [] }, unit, view, opts)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderSwitching(canvas: HTMLCanvasElement, scene: SwitchingView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawSwitchingScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
