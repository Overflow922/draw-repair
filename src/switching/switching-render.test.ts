import { describe, expect, it } from "vitest"
import { itemDrawingInPlan } from "../furniture/furniture-render"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, StrokeOp, TextOp } from "../room-area.test-utils"
import { rectWalls } from "../rough/rough.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Callout, FurnitureItem, LightFixture } from "../types"
import { drawSwitchingScene } from "./switching-render"
import type { SwitchingView } from "./switching-render"

// change add-switching-plan: отрисовка плана «Группы включения» на холсте
// (spec switching-plan «Мебель и освещение на плане «Группы включения»», «Отображение плана «Группы включения»»; design D4)
//
//  вид сверху, схематично, не в масштабе. Помещение — внутренние грани x = 0, x = 400, y = 0, y = 300
//
//   ####################################
//   #      (+)                [ T ]     #     знаки освещения и стол; ни заливки потолка, ни чисел расстояний
//   #                                   #
//   ####################################

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WALLS = rectWalls("w", -10, -10, 410, 310)
const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })
const table: FurnitureItem = { id: "t", kind: "table", x: 200, y: 150, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const callout: Callout = { id: "c", target: { x: 100, y: 80 }, at: { x: 150, y: 120 }, text: "Выключатель" }

const viewOf = (extra: Partial<SwitchingView> = {}): SwitchingView => ({ walls: WALLS, doorways: [], pieces: [], drywall: [], items: [], lights: [spot("a", 100, 80)], ...extra })

const draw = (view: SwitchingView): DrawOp[] => {
  const rec = recordingContext()
  drawSwitchingScene(rec.ctx, 1200, 900, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const texts = (ops: DrawOp[]): TextOp[] => ops.filter((o): o is TextOp => o.kind === "fillText")
const redStrokes = (ops: DrawOp[]): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed)

describe("холст плана «Группы включения»", () => {
  it("SW-20: знаки всех видов освещения нарисованы цветом освещения", () => {
    const lights: LightFixture[] = [spot("a", 100, 80), { id: "b", kind: "smoke-detector", x: 150, y: 80 }, { id: "c", kind: "chandelier", x: 200, y: 80 }, { id: "d", kind: "sconce", x: 0, y: 200, angleDeg: 0 }, { id: "e", kind: "lighting-outlet", x: 300, y: 80 }]
    expect(redStrokes(draw(viewOf({ lights }))).length).toBeGreaterThanOrEqual(5)
  })

  it("SW-21: расстояний нет — ни числа «100», ни «80» у светильника", () => {
    expect(texts(draw(viewOf())).map((t) => t.text)).toEqual([])
  })

  it("SW-22: заливки натяжного потолка и его подписи нет", () => {
    const ops = draw(viewOf())
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.ceiling)).toBe(false)
    expect(texts(ops).some((t) => t.text.endsWith("мм"))).toBe(false)
  })

  it("SW-23: у стола нет габаритов — ни «80», ни «160»", () => {
    expect(texts(draw(viewOf({ items: [table], lights: [] }))).map((t) => t.text)).toEqual([])
  })

  it("SW-24: стол рисуется серыми линиями подложки (muted)", () => {
    const ops = draw(viewOf({ items: [table], lights: [] }))
    expect(ops.some((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.muted)).toBe(true)
    expect(itemDrawingInPlan(table).lines.length).toBeGreaterThan(0)
  })

  it("SW-25: знаки нарисованы после линий стола", () => {
    const ops = draw(viewOf({ items: [table], lights: [spot("a", 200, 150)] }))
    const lastTable = ops.map((o, i) => (o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.muted ? i : -1)).reduce((a, b) => Math.max(a, b), -1)
    const firstSymbol = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed)
    expect(firstSymbol).toBeGreaterThan(lastTable)
  })

  it("SW-26: выноска нарисована после знака светильника", () => {
    const ops = draw(viewOf({ callouts: [callout] }))
    const symbol = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed)
    const text = ops.findIndex((o) => o.kind === "fillText" && o.text === "Выключатель")
    expect(symbol).toBeGreaterThanOrEqual(0)
    expect(text).toBeGreaterThan(symbol)
  })

  it("SW-27: знак светильника не зависит от масштаба", () => {
    const size = (zoom: number): number => {
      const rec = recordingContext()
      drawSwitchingScene(rec.ctx, 1200, 900, viewOf(), "cm", { zoom, pan: { x: 0, y: 0 } }, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
      const xs = rec.ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed)
      return xs.length
    }
    expect(size(2)).toBe(size(1))
  })
})
