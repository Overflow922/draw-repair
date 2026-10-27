import { CHAR_WIDTH } from "../doorway/element-label"
import { sconceNormal } from "../ceiling/light-reach"
import { SMOKE_FONT_MM } from "../ceiling/light-symbol"
import type { LabelBox } from "../anchor-label"
import type { Palette } from "../theme"
import type { LightSwitch, Point } from "../types"
import { keyLabel } from "./light-switch"

// Знак выключателя (change add-light-switch, design D4; вид — references/lines.png): у каждой клавиши кружок диаметром 3 мм на
// грани, стойка 3 мм наружу, штрих 2,5 мм на её конце (при нормали вверх — влево) и подпись из имён линий над клавишей. Размеры
// в миллиметрах бумаги, u — единиц носителя на мм (на холсте LIGHT_SYMBOL_PX_PER_MM = 4, в PDF 1); знак рисуется в координатах
// носителя с центром блока в точке at. Одна функция для холста и PDF.

const LINE_MM = 0.35
const CIRCLE_D_MM = 3
const STALK_MM = 3
const DASH_MM = 2.5
const KEY_STEP_MM = 12
const LABEL_DIST_MM = 7
export const SWITCH_HIT_PX = 8 // зона клика вокруг каждой части знака, не меньше

export interface KeyGeometry {
  circle: { c: Point; r: number }
  stalk: [Point, Point]
  dash: [Point, Point]
  label: Point // центр подписи
}

const along = (p: Point, d: Point, s: number): Point => ({ x: p.x + d.x * s, y: p.y + d.y * s })

// положение частей клавиши index выключателя sw с центром блока at
export function keyGeometry(sw: LightSwitch, index: number, at: Point, u: number): KeyGeometry {
  const n = sconceNormal(sw.angle)
  const t = { x: -n.y, y: n.x } // вдоль грани
  const d = { x: n.y, y: -n.x } // штрих: нормаль, повёрнутая на 90° против часовой стрелки на экране
  const face = along(at, t, (index - (sw.keys.length - 1) / 2) * KEY_STEP_MM * u)
  const r = (CIRCLE_D_MM / 2) * u
  const stalkStart = along(face, n, 2 * r)
  const stalkEnd = along(stalkStart, n, STALK_MM * u)
  return {
    circle: { c: along(face, n, r), r },
    stalk: [stalkStart, stalkEnd],
    dash: [stalkEnd, along(stalkEnd, d, DASH_MM * u)],
    label: along(face, n, LABEL_DIST_MM * u),
  }
}

// рамка подписи клавиши (по центру label); null — у клавиши без линий подписи нет
export function switchLabelBox(sw: LightSwitch, index: number, at: Point, u: number): LabelBox | null {
  const text = keyLabel(sw.keys[index]?.lines ?? [])
  if (text === "") return null
  const fontPx = SMOKE_FONT_MM * u
  const w = text.length * fontPx * CHAR_WIDTH
  const c = keyGeometry(sw, index, at, u).label
  return { x: c.x - w / 2, y: c.y - fontPx / 2, w, h: fontPx }
}

// точки габарита выключателя с подписями клавиш, см чертежа: kMm — мм листа (или px холста) на см чертежа, знак — в мм бумаги (u)
export function switchExtent(sw: LightSwitch, kMm: number, u: number): Point[] {
  const at = { x: sw.at.x * kMm, y: sw.at.y * kMm }
  const points = sw.keys.flatMap((_, i): Point[] => {
    const g = keyGeometry(sw, i, at, u)
    const box = switchLabelBox(sw, i, at, u)
    return [
      { x: g.circle.c.x - g.circle.r, y: g.circle.c.y - g.circle.r },
      { x: g.circle.c.x + g.circle.r, y: g.circle.c.y + g.circle.r },
      g.dash[1],
      ...(box ? [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y + box.h }] : []),
    ]
  })
  return points.map((p) => ({ x: p.x / kMm, y: p.y / kMm }))
}

export interface SwitchHighlight {
  color: string
  lineWidth: number
}

// u — единиц носителя на мм; font — гарнитура носителя; highlight — подсветка выделения или ластика (только на холсте)
export function drawSwitch(ctx: CanvasRenderingContext2D, sw: LightSwitch, at: Point, u: number, palette: Palette, font = "sans-serif", highlight?: SwitchHighlight): void {
  ctx.save()
  ctx.lineCap = "round"
  const strokeKey = (g: KeyGeometry, color: string, width: number): void => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(g.circle.c.x, g.circle.c.y, g.circle.r, 0, Math.PI * 2)
    ctx.moveTo(g.stalk[0].x, g.stalk[0].y)
    ctx.lineTo(g.stalk[1].x, g.stalk[1].y)
    ctx.lineTo(g.dash[1].x, g.dash[1].y)
    ctx.stroke()
  }
  sw.keys.forEach((key, i) => {
    const g = keyGeometry(sw, i, at, u)
    if (highlight) strokeKey(g, highlight.color, highlight.lineWidth)
    strokeKey(g, palette.lightingRed, LINE_MM * u)
    const text = keyLabel(key.lines)
    if (text === "") return
    ctx.font = `${SMOKE_FONT_MM * u}px ${font}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = palette.lightingRed
    ctx.fillText(text, g.label.x, g.label.y)
  })
  ctx.restore()
}

export type SwitchPart = "circle" | "stalk" | "dash" | "label"

export interface SwitchHit {
  keyIndex: number
  part: SwitchPart
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  const s = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy))
}

// часть знака под точкой p (в координатах носителя); подпись главнее кружка, кружок — стойки, стойка — штриха; из совпавших
// клавиш побеждает последняя
export function switchHit(sw: LightSwitch, at: Point, p: Point, u: number): SwitchHit | null {
  for (let i = sw.keys.length - 1; i >= 0; i--) {
    const g = keyGeometry(sw, i, at, u)
    const box = switchLabelBox(sw, i, at, u)
    if (box && p.x >= box.x - SWITCH_HIT_PX && p.x <= box.x + box.w + SWITCH_HIT_PX && p.y >= box.y - SWITCH_HIT_PX && p.y <= box.y + box.h + SWITCH_HIT_PX) return { keyIndex: i, part: "label" }
    if (Math.hypot(p.x - g.circle.c.x, p.y - g.circle.c.y) <= g.circle.r + SWITCH_HIT_PX) return { keyIndex: i, part: "circle" }
    if (segmentDistance(p, g.stalk[0], g.stalk[1]) <= SWITCH_HIT_PX) return { keyIndex: i, part: "stalk" }
    if (segmentDistance(p, g.dash[0], g.dash[1]) <= SWITCH_HIT_PX) return { keyIndex: i, part: "dash" }
  }
  return null
}
