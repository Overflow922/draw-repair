import { canvasTranslucent, drawCeilingScene } from "../ceiling/ceiling-render"
import type { CeilingOptions, CeilingView } from "../ceiling/ceiling-render"
import { LIGHT_PALETTE } from "../theme"
import { prepareCanvas, SCREEN_METRICS } from "../render"
import type { ExhaustFan, LightSwitch, Point, Unit, View } from "../types"
import { drawExhaust } from "./exhaust-symbol"
import { drawLineLabel } from "./light-line-label"
import { drawSwitch } from "./switch-symbol"

// Отрисовка плана «Группы включения» (change add-switching-plan, design D4): снизу вверх — подложка «Реконструкции», предметы «Мебели»
// серыми линиями без габаритов, знаки объектов освещения, метки линий (change add-light-lines, design D5), выноски и примечания.
// Это слои «Потолков и освещения» без натяжных потолков и без расстояний: поэтому сцена идёт через drawCeilingScene с пустым
// списком потолков и без тел стен для расстояний. Одна функция для холста и PDF.

// метка линии для рисования: центр светильника в координатах чертежа; выделение и подсветка ластика — только на холсте
export interface LineLabelView {
  id: string
  name: string
  at: Point
}

export type SwitchingView = Pick<CeilingView, "walls" | "doorways" | "communications" | "batteries" | "pieces" | "drywall" | "callouts" | "selectedCalloutId" | "erasingCalloutId" | "items" | "lights" | "selectedLightId"> & {
  lineLabels?: readonly LineLabelView[]
  selectedLineId?: string | null
  erasingLineId?: string | null
  // выключатели (change add-light-switch, design D4): слой выше меток линий и ниже выносок; призрак — полупрозрачный, без подписей
  switches?: readonly LightSwitch[]
  switchGhost?: LightSwitch | null
  selectedSwitchId?: string | null
  erasingSwitchId?: string | null
  // вытяжки (change add-exhaust-fan, design D4): слой выше знаков освещения и ниже меток линий; призрак — полупрозрачный
  exhausts?: readonly ExhaustFan[]
  exhaustGhost?: ExhaustFan | null
  selectedExhaustId?: string | null
  erasingExhaustId?: string | null
}

const GHOST_ALPHA = 0.4

export function drawSwitchingScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SwitchingView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const palette = opts.palette ?? LIGHT_PALETTE
  const translucent = opts.translucent ?? canvasTranslucent(ctx)
  const labels = scene.lineLabels ?? []
  const aboveLights: CeilingView["aboveLights"] = (c, toScreen) => {
    for (const f of scene.exhausts ?? []) {
      const color = f.id === scene.erasingExhaustId ? palette.erase : f.id === scene.selectedExhaustId ? palette.selection : undefined
      drawExhaust(c, toScreen({ x: f.x, y: f.y }), m.symbolMmPx, palette, color)
    }
    const fanGhost = scene.exhaustGhost
    if (fanGhost) translucent(GHOST_ALPHA, () => drawExhaust(c, toScreen({ x: fanGhost.x, y: fanGhost.y }), m.symbolMmPx, palette))
    for (const label of labels) {
      const highlight =
        label.id === scene.erasingLineId
          ? { color: palette.erase, lineWidth: m.contourPx * 2 }
          : label.id === scene.selectedLineId
            ? { color: palette.selection, lineWidth: m.contourPx * 2 }
            : undefined
      drawLineLabel(c, label.name, toScreen(label.at), m.symbolMmPx, palette, m.font, highlight)
    }
    for (const s of scene.switches ?? []) {
      const highlight =
        s.id === scene.erasingSwitchId
          ? { color: palette.erase, lineWidth: m.contourPx * 2 }
          : s.id === scene.selectedSwitchId
            ? { color: palette.selection, lineWidth: m.contourPx * 2 }
            : undefined
      drawSwitch(c, s, toScreen(s.at), m.symbolMmPx, palette, m.font, highlight)
    }
    const ghost = scene.switchGhost
    if (ghost) translucent(GHOST_ALPHA, () => drawSwitch(c, ghost, toScreen(ghost.at), m.symbolMmPx, palette, m.font))
  }
  drawCeilingScene(ctx, w, h, { ...scene, ceilings: [], aboveLights }, unit, view, opts)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderSwitching(canvas: HTMLCanvasElement, scene: SwitchingView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawSwitchingScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
