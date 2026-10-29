import { prepareCanvas } from "../render"
import { drawSwitchingScene } from "../switching/switching-render"
import type { SwitchingView } from "../switching/switching-render"
import type { CeilingOptions } from "../ceiling/ceiling-render"
import type { LightSwitch, Unit, View } from "../types"

// Отрисовка плана «Электрооборудование» (change add-electrical-plan, design D3, D7): снизу вверх — подложка «Реконструкции», предметы
// «Мебели» серыми линиями без габаритов, выключатели «Потолков и освещения», выноски и примечания. Слои рисует та же функция, что и
// страница PDF «Группы включения», но без объектов освещения, вытяжек, меток линий и потолков; выделения, призраков и подсветки
// ластика у выключателей нет. Одна функция для холста и PDF.

export type ElectricalView = Pick<SwitchingView, "walls" | "doorways" | "communications" | "batteries" | "pieces" | "drywall" | "callouts" | "selectedCalloutId" | "erasingCalloutId" | "items"> & {
  switches: readonly LightSwitch[]
}

export function drawElectricalScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: ElectricalView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  drawSwitchingScene(ctx, w, h, { ...scene, lights: [], selectedLightId: null }, unit, view, opts)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderElectrical(canvas: HTMLCanvasElement, scene: ElectricalView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawElectricalScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
