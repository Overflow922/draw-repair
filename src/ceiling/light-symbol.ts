import { SCREEN_METRICS } from "../render"
import type { Palette } from "../theme"
import type { LightFixture, LightKind, Point } from "../types"

// Условные знаки освещения (change add-ceiling-lighting, design D4; рисунок — references/lighting.png): размеры заданы в
// миллиметрах бумаги и не зависят от масштаба чертежа. На холсте — LIGHT_SYMBOL_PX_PER_MM пикселей на мм (знак не меняется с
// зумом), в PDF — 1 единица на мм. Знак рисуется в координатах носителя с центром в точке at; одна функция для холста и PDF.

export const LIGHT_SYMBOL_PX_PER_MM = SCREEN_METRICS.symbolMmPx

const LINE_MM = 0.35
const SPOT_D_MM = 3
const SMOKE_D_MM = 3
const SMOKE_INNER_D_MM = 1.5
const SMOKE_TEXT_GAP_MM = 1
export const SMOKE_FONT_MM = 2.5
const RING_D_MM = 5 // наружный диаметр кольца люстры
const RING_W_MM = 1.25
const CROSS_MM = 8 // перекрестие люстры
const SCONCE_R_MM = 2
const OUTLET_D_MM = 2.5
const TAIL_MM = 3 // хвостик электровывода по X от края круга

// половина габарита знака, мм: от него — зона клика (не меньше 8 px на экране)
const HALF_MM: Record<LightKind, number> = {
  spot: SPOT_D_MM / 2,
  "smoke-detector": SMOKE_D_MM / 2,
  chandelier: RING_D_MM / 2,
  sconce: SCONCE_R_MM,
  "lighting-outlet": OUTLET_D_MM / 2,
}

const MIN_HIT_PX = 8

export const lightHitRadiusPx = (kind: LightKind): number => Math.max(MIN_HIT_PX, HALF_MM[kind] * LIGHT_SYMBOL_PX_PER_MM)

export const SMOKE_LABEL = "ДПС"

function circle(ctx: CanvasRenderingContext2D, c: Point, r: number): void {
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
}

function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

// u — px (единиц) носителя на мм бумаги; font — гарнитура носителя (в PDF — встроенный шрифт)
export function drawLightSymbol(ctx: CanvasRenderingContext2D, l: LightFixture, at: Point, u: number, palette: Palette, font = "sans-serif"): void {
  ctx.save()
  ctx.lineWidth = LINE_MM * u
  switch (l.kind) {
    case "spot": {
      const r = (SPOT_D_MM / 2) * u
      ctx.strokeStyle = palette.lightingRed
      circle(ctx, at, r)
      ctx.stroke()
      segment(ctx, { x: at.x - r, y: at.y }, { x: at.x + r, y: at.y })
      segment(ctx, { x: at.x, y: at.y - r }, { x: at.x, y: at.y + r })
      break
    }
    case "smoke-detector": {
      const r = (SMOKE_D_MM / 2) * u
      ctx.fillStyle = palette.lightingRed
      circle(ctx, at, r)
      ctx.fill()
      ctx.strokeStyle = palette.paper
      circle(ctx, at, (SMOKE_INNER_D_MM / 2) * u)
      ctx.stroke()
      ctx.font = `${SMOKE_FONT_MM * u}px ${font}`
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(SMOKE_LABEL, at.x + r + SMOKE_TEXT_GAP_MM * u, at.y)
      break
    }
    case "chandelier": {
      const w = RING_W_MM * u
      ctx.strokeStyle = palette.lightingRed
      ctx.lineWidth = w
      circle(ctx, at, (RING_D_MM / 2) * u - w / 2)
      ctx.stroke()
      const h = (CROSS_MM / 2) * u
      ctx.lineWidth = LINE_MM * u
      ctx.strokeStyle = palette.ink
      segment(ctx, { x: at.x - h, y: at.y }, { x: at.x + h, y: at.y })
      segment(ctx, { x: at.x, y: at.y - h }, { x: at.x, y: at.y + h })
      break
    }
    case "sconce": {
      // локальные оси: t — вдоль грани, n — в помещение; диаметр на грани, дуга в сторону n, крест «X» внутри
      const a = (l.angleDeg * Math.PI) / 180
      const r = SCONCE_R_MM * u
      const n = { x: Math.cos(a), y: Math.sin(a) }
      const t = { x: -n.y, y: n.x }
      const local = (along: number, across: number): Point => ({ x: at.x + t.x * along + n.x * across, y: at.y + t.y * along + n.y * across })
      ctx.strokeStyle = palette.lightingRed
      ctx.beginPath()
      ctx.arc(at.x, at.y, r, a - Math.PI / 2, a + Math.PI / 2)
      ctx.closePath()
      ctx.stroke()
      const k = Math.SQRT1_2 * r
      segment(ctx, local(-k, k), local(r / 2, 0))
      segment(ctx, local(k, k), local(-r / 2, 0))
      break
    }
    case "lighting-outlet": {
      const r = (OUTLET_D_MM / 2) * u
      ctx.fillStyle = palette.lightingOrange
      circle(ctx, at, r)
      ctx.fill()
      // волнистый хвостик из правого верхнего края круга вправо вверх
      // ломаная по синусоиде (один период): на холсте и в PDF рисуется одинаково
      const s = { x: at.x + r * Math.cos(-Math.PI / 6), y: at.y + r * Math.sin(-Math.PI / 6) }
      const e = { x: at.x + r + TAIL_MM * u, y: at.y - 1.5 * u }
      const steps = 12
      ctx.strokeStyle = palette.lightingOrange
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      for (let i = 1; i <= steps; i++) {
        const f = i / steps
        ctx.lineTo(s.x + (e.x - s.x) * f, s.y + (e.y - s.y) * f - Math.sin(f * Math.PI * 2) * 0.6 * u)
      }
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}
