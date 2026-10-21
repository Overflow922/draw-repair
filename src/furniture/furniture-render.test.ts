import { describe, expect, it } from "vitest"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { content, drawing, drywall, plaster } from "../reconstruction/reconstruction.test-utils"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp } from "../room-area.test-utils"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Theme } from "../theme"
import { PX_PER_CM } from "../types"
import type { Drawing, Point, Table } from "../types"
import { conflictColor, drawFurnitureScene, tableColors } from "./furniture-render"
import type { FurnitureView } from "./furniture-render"
import type { Overlap } from "./overlap"

// change furniture-plan-table: отображение плана — слои, цвета, реальный масштаб столов, подсветка
// (spec furniture-plan «Отображение плана «Мебель» и цвет стола», «Пересечения стола»)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const K = PX_PER_CM
const table = (id: string, x: number, y: number, angleDeg = 0, widthCm = 80, lengthCm = 160): Table => ({ id, x, y, widthCm, lengthCm, angleDeg })

const viewOf = (d: Drawing, extra: Partial<FurnitureView> = {}): FurnitureView => {
  const s = reconstructionScene(d)
  return { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, tables: [], ...extra }
}

const draw = (view: FurnitureView, theme: Theme = "light") => {
  const rec = recordingContext()
  drawFurnitureScene(rec.ctx, 800, 600, view, "cm", VIEW, { grid: false, palette: theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE, theme })
  return rec.ops
}

const fills = (ops: ReturnType<typeof draw>, style: string): FillOp[] => ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === style)
const box = (pts: readonly Point[]) => ({ minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)) })
const rgb = (css: string): [number, number, number] => {
  const hex = css.match(/^#([0-9a-f]{6})$/i)
  if (hex?.[1]) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16)) as [number, number, number]
  const parts = css.match(/rgba?\(([^)]+)\)/)?.[1]?.split(",").map((s) => parseFloat(s)) ?? []
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}
const distance = (a: string, b: string): number => Math.hypot(...rgb(a).map((v, i) => v - (rgb(b)[i] ?? 0)))

describe("цвета", () => {
  it("FP-300: цвет стола различим от бумаги, серой подложки, зелёного гипсокартона, красной подсветки и собственного контура в обеих схемах", () => {
    for (const [theme, palette] of [["light", LIGHT_PALETTE], ["dark", DARK_PALETTE]] as const) {
      const c = tableColors(theme)
      for (const other of [palette.paper, palette.muted, drywallColors(theme).fill, conflictColor(theme), c.stroke]) expect(distance(c.fill, other)).toBeGreaterThan(40)
    }
  })

  it("FP-300: цвета светлой и тёмной схем различны", () => {
    expect(tableColors("light").fill).not.toBe(tableColors("dark").fill)
  })

  it("FP-301: цвет подсветки задаётся схемой и различен в светлой и тёмной", () => {
    expect(conflictColor("light")).not.toBe(conflictColor("dark"))
  })
})

describe("столы на холсте", () => {
  it("FP-302: стол 80×160 — заливка цвета стола в реальном масштабе размеров", () => {
    const ops = draw(viewOf(drawing(), { tables: [table("t", 200, 100)] }))
    const f = fills(ops, tableColors("light").fill)
    expect(f).toHaveLength(1)
    const b = box(f[0]?.subpaths.flat() ?? [])
    expect(b.maxX - b.minX).toBeCloseTo(80 * K, 6)
    expect(b.maxY - b.minY).toBeCloseTo(160 * K, 6)
    expect(b.minX).toBeCloseTo(160 * K, 6)
    expect(b.minY).toBeCloseTo(20 * K, 6)
  })

  it("FP-302: повёрнутый на 90 стол — ширина вдоль Y, длина вдоль X", () => {
    const f = fills(draw(viewOf(drawing(), { tables: [table("t", 200, 100, 90)] })), tableColors("light").fill)
    const b = box(f[0]?.subpaths.flat() ?? [])
    expect(b.maxX - b.minX).toBeCloseTo(160 * K, 6)
    expect(b.maxY - b.minY).toBeCloseTo(80 * K, 6)
  })

  it("FP-303: по заливке на каждый стол; тёмная схема красит столом другого цвета", () => {
    const view = viewOf(drawing(), { tables: [table("a", 100, 100), table("b", 400, 100)] })
    expect(fills(draw(view), tableColors("light").fill)).toHaveLength(2)
    expect(fills(draw(view, "dark"), tableColors("dark").fill)).toHaveLength(2)
  })

  it("FP-304: стол лежит поверх подложки: заливка стола после заливки гипсокартона и штукатурки", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)], reconstruction: content([drywall("g", 0, 40, 300, 40)]) })
    const ops = draw(viewOf(d, { tables: [table("t", 150, 30)] }))
    const index = (style: string): number => ops.findIndex((o) => o.kind === "fill" && o.fillStyle === style)
    expect(index(tableColors("light").fill)).toBeGreaterThan(index(drywallColors("light").fill))
    expect(index(tableColors("light").fill)).toBeGreaterThan(index(LIGHT_PALETTE.muted))
  })

  it("FP-305: призрак рисуется полупрозрачно цветом стола, поставленный стол — непрозрачно", () => {
    const rec = recordingContext()
    const alphas: number[] = []
    const original = rec.ctx.fill.bind(rec.ctx)
    function spiedFill(fillRule?: CanvasFillRule): void
    function spiedFill(path: Path2D, fillRule?: CanvasFillRule): void
    function spiedFill(first?: Path2D | CanvasFillRule, second?: CanvasFillRule): void {
      if (rec.ctx.fillStyle === tableColors("light").fill) alphas.push(rec.ctx.globalAlpha)
      if (first === undefined || typeof first === "string") original(first)
      else original(first, second)
    }
    rec.ctx.fill = spiedFill
    drawFurnitureScene(rec.ctx, 800, 600, viewOf(drawing(), { tables: [table("t", 600, 100)], tableGhost: table("", 200, 100) }), "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
    expect(alphas).toHaveLength(2)
    expect(alphas[0]).toBe(1)
    expect(alphas[1]).toBeLessThan(1)
    expect(alphas[1]).toBeGreaterThan(0)
  })
})

describe("подсветка пересечений", () => {
  const overlap: Overlap = { kind: "wall", tableId: "t", region: [{ x: 240, y: 20 }, { x: 250, y: 20 }, { x: 250, y: 180 }, { x: 240, y: 180 }] }

  it("FP-306: область пересечения заливается цветом подсветки схемы поверх стола", () => {
    const ops = draw(viewOf(drawing(), { tables: [table("t", 210, 100)], overlaps: [overlap] }))
    const f = fills(ops, conflictColor("light"))
    expect(f).toHaveLength(1)
    const b = box(f[0]?.subpaths.flat() ?? [])
    expect([b.minX, b.minY, b.maxX, b.maxY]).toEqual([240 * K, 20 * K, 250 * K, 180 * K])
    const order = (style: string): number => ops.findIndex((o) => o.kind === "fill" && o.fillStyle === style)
    expect(order(conflictColor("light"))).toBeGreaterThan(order(tableColors("light").fill))
  })

  it("FP-306: цвет подсветки берётся из палитры схемы", () => {
    const f = fills(draw(viewOf(drawing(), { tables: [table("t", 210, 100)], overlaps: [overlap] }), "dark"), conflictColor("dark"))
    expect(f).toHaveLength(1)
  })

  it("FP-307: без пересечений (и в PDF, где они не передаются) подсветки нет", () => {
    expect(fills(draw(viewOf(drawing(), { tables: [table("t", 210, 100)] })), conflictColor("light"))).toEqual([])
  })
})

describe("обводка", () => {
  it("FP-308: выделенный и стираемый стол обводятся цветами выделения и ластика", () => {
    const view = viewOf(drawing(), { tables: [table("a", 100, 100), table("b", 400, 100)], selectedTableIds: new Set(["a"]), erasingTableId: "b" })
    const ops = draw(view)
    expect(fills(ops, LIGHT_PALETTE.selection)).toHaveLength(1)
    expect(fills(ops, LIGHT_PALETTE.erase)).toHaveLength(1)
  })
})
