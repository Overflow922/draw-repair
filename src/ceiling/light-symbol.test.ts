import { describe, expect, it } from "vitest"
import { LIGHT_PALETTE } from "../theme"
import type { LightFixture, Point } from "../types"
import { LIGHT_SYMBOL_PX_PER_MM, drawLightSymbol, lightHitRadiusPx } from "./light-symbol"

// change add-ceiling-lighting: условные знаки освещения (spec ceiling-lighting «Условные знаки освещения»; design D4).
// Знак рисуется в экранных координатах (или в мм бумаги в PDF) с центром в точке at; проверяются размеры и направление.

interface Rec {
  points: Point[] // все точки линий и крайние точки дуг
  arcs: { c: Point; r: number; start: number; end: number }[]
  texts: { text: string; x: number; y: number; fill: string }[]
  fills: string[]
  strokes: string[]
}

function recorder(): { ctx: CanvasRenderingContext2D; rec: Rec } {
  const rec: Rec = { points: [], arcs: [], texts: [], fills: [], strokes: [] }
  const state = { fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "start", textBaseline: "alphabetic" }
  const ctx = {
    ...state,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo(x: number, y: number) {
      rec.points.push({ x, y })
    },
    lineTo(x: number, y: number) {
      rec.points.push({ x, y })
    },
    bezierCurveTo(_a: number, _b: number, _c: number, _d: number, x: number, y: number) {
      rec.points.push({ x, y })
    },
    arc(x: number, y: number, r: number, start: number, end: number) {
      rec.arcs.push({ c: { x, y }, r, start, end })
      const steps = 16
      const span = end - start
      for (let i = 0; i <= steps; i++) {
        const a = start + (span * i) / steps
        rec.points.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) })
      }
    },
    fill() {
      rec.fills.push(String(ctx.fillStyle))
    },
    stroke() {
      rec.strokes.push(String(ctx.strokeStyle))
    },
    fillText(text: string, x: number, y: number) {
      rec.texts.push({ text, x, y, fill: String(ctx.fillStyle) })
    },
    measureText: (t: string) => ({ width: t.length * 5 }),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rec }
}

const draw = (l: LightFixture, pxPerMm = LIGHT_SYMBOL_PX_PER_MM): Rec => {
  const { ctx, rec } = recorder()
  drawLightSymbol(ctx, l, { x: 100, y: 100 }, pxPerMm, LIGHT_PALETTE)
  return rec
}

const extent = (rec: Rec): { minX: number; maxX: number; minY: number; maxY: number } => ({
  minX: Math.min(...rec.points.map((p) => p.x)),
  maxX: Math.max(...rec.points.map((p) => p.x)),
  minY: Math.min(...rec.points.map((p) => p.y)),
  maxY: Math.max(...rec.points.map((p) => p.y)),
})

const at = (kind: Exclude<LightFixture["kind"], "sconce">): LightFixture => ({ id: "l", kind, x: 0, y: 0 })

describe("условные знаки освещения", () => {
  it("CL-Y1: точечный — окружность диаметром 12 px (3 мм) красной линией с крестом внутри", () => {
    const rec = draw(at("spot"))
    expect(LIGHT_SYMBOL_PX_PER_MM).toBe(4)
    expect(rec.arcs.map((a) => a.r * 2)).toEqual([12])
    const e = extent(rec)
    expect(e.maxX - e.minX).toBeCloseTo(12, 6)
    expect(e.maxY - e.minY).toBeCloseTo(12, 6)
    expect(rec.strokes.every((s) => s === LIGHT_PALETTE.lightingRed)).toBe(true)
    expect(rec.fills).toEqual([])
  })

  it("CL-Y2: в PDF тот же знак — 3 мм при 1 единице на мм, не зависит от масштаба чертежа", () => {
    expect(draw(at("spot"), 1).arcs.map((a) => a.r * 2)).toEqual([3])
  })

  it("CL-Y3: ДПС — красный залитый круг 12 px, внутренняя окружность 6 px цвета фона, подпись «ДПС» справа", () => {
    const rec = draw(at("smoke-detector"))
    expect(rec.arcs.map((a) => a.r * 2).sort((a, b) => a - b)).toEqual([6, 12])
    expect(rec.fills).toContain(LIGHT_PALETTE.lightingRed)
    expect(rec.strokes).toContain(LIGHT_PALETTE.paper)
    expect(rec.texts).toHaveLength(1)
    expect(rec.texts[0]?.text).toBe("ДПС")
    expect(rec.texts[0]?.fill).toBe(LIGHT_PALETTE.lightingRed)
    expect(rec.texts[0]?.x).toBeGreaterThan(106)
  })

  it("CL-Y4: люстра — красное кольцо наружным диаметром 20 px, перекрестие 32 px цвета контуров", () => {
    const rec = draw(at("chandelier"))
    const e = extent(rec)
    expect(e.maxX - e.minX).toBeCloseTo(32, 6)
    expect(e.maxY - e.minY).toBeCloseTo(32, 6)
    expect(rec.strokes).toContain(LIGHT_PALETTE.lightingRed)
    expect(rec.strokes).toContain(LIGHT_PALETTE.ink)
    // кольцо: линия толщиной 5 px по окружности радиусом 7,5 px — наружный край на 10 px
    expect(rec.arcs.map((a) => a.r)).toEqual([7.5])
  })

  it("CL-Y5: бра — полукруг радиуса 8 px, дуга по направлению в помещение, диаметр на грани", () => {
    const down: LightFixture = { id: "b", kind: "sconce", x: 0, y: 0, angleDeg: 90 }
    const e = extent(draw(down))
    expect(e.minY).toBeCloseTo(100, 6)
    expect(e.maxY).toBeCloseTo(108, 6)
    expect(e.maxX - e.minX).toBeCloseTo(16, 6)
    const right: LightFixture = { ...down, angleDeg: 0 }
    const r = extent(draw(right))
    expect(r.minX).toBeCloseTo(100, 6)
    expect(r.maxX).toBeCloseTo(108, 6)
  })

  it("CL-Y6: электровывод — оранжевый круг 10 px и оранжевый хвостик вправо вверх", () => {
    const rec = draw(at("lighting-outlet"))
    expect(rec.arcs.map((a) => a.r * 2)).toEqual([10])
    expect(rec.fills).toEqual([LIGHT_PALETTE.lightingOrange])
    expect(rec.strokes).toEqual([LIGHT_PALETTE.lightingOrange])
    const tail = rec.points.filter((p) => p.x > 105)
    expect(tail.length).toBeGreaterThan(0)
    expect(Math.min(...tail.map((p) => p.y))).toBeLessThan(100)
    expect(extent(rec).maxX).toBeCloseTo(100 + 5 + 12, 0)
  })

  it("CL-Y7: зона клика — не меньше 8 px вокруг центра", () => {
    for (const kind of ["spot", "smoke-detector", "chandelier", "sconce", "lighting-outlet"] as const) expect(lightHitRadiusPx(kind)).toBeGreaterThanOrEqual(8)
  })
})
