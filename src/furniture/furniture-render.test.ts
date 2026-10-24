import { describe, expect, it } from "vitest"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { content, drawing, drywall, plaster } from "../reconstruction/reconstruction.test-utils"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, FillOp, StrokeOp } from "../room-area.test-utils"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Theme } from "../theme"
import { PX_PER_CM } from "../types"
import type { Drawing, Point, FurnitureItem } from "../types"
import { conflictColor, drawFurnitureScene } from "./furniture-render"
import type { FurnitureView } from "./furniture-render"
import type { Overlap } from "./overlap"

// change furniture-plan-table: отображение плана — слои, цвета, реальный масштаб столов, подсветка
// (spec furniture-plan «Отображение плана «Мебель» и цвет стола», «Пересечения стола»)
// TCR (change furniture-items-catalog): стол стал предметом мебели (Table → FurnitureItem, tables → items, table*.ts → item*.ts) с видом «table»; меняются только имена и вид в данных, утверждения о поведении не менялись
// TCR (change furniture-line-drawings): предмет — линии рисунка вида без заливки (цвет вида и его заливка в спеке сняты): тесты цвета вида FP-300 заменены проверкой «без заливки», заливка стола в FP-302…FP-306 — обводкой линиями цвета контуров схемы, обводка выделения FP-308 — без заливки

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const K = PX_PER_CM
const table = (id: string, x: number, y: number, angleDeg = 0, widthCm = 80, lengthCm = 160): FurnitureItem => ({ id, kind: "table", x, y, widthCm, lengthCm, angleDeg })
const chair = (id: string, x: number, y: number, angleDeg = 0): FurnitureItem => ({ id, kind: "chair", x, y, widthCm: 45, lengthCm: 45, angleDeg })

const viewOf = (d: Drawing, extra: Partial<FurnitureView> = {}): FurnitureView => {
  const s = reconstructionScene(d)
  return { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, items: [], ...extra }
}

const draw = (view: FurnitureView, theme: Theme = "light") => {
  const rec = recordingContext()
  drawFurnitureScene(rec.ctx, 800, 600, view, "cm", VIEW, { grid: false, palette: theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE, theme })
  return rec.ops
}

// TCR (change furniture-dimensions): на холсте появились габариты предметов — размерные линии цвета размеров плана (ink): штрихи
// из отрезков в две точки и залитые треугольники стрелок (spec furniture-plan «Габариты предмета мебели»). Подсчёт линий и
// заливок предмета (FP-300, FP-302, FP-303, FP-305) их исключает; утверждения о самом предмете не менялись
const isDimensionOp = (o: DrawOp): boolean =>
  o.kind === "stroke" ? o.subpaths.every((sp) => sp.length <= 2) : o.kind === "fill" ? o.subpaths.every((sp) => sp.length <= 3) : false
const fills = (ops: ReturnType<typeof draw>, style: string): FillOp[] => ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === style)
const strokes = (ops: ReturnType<typeof draw>, style: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === style && !isDimensionOp(o))
const box = (pts: readonly Point[]) => ({ minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)) })
const INK = LIGHT_PALETTE.ink

describe("цвета", () => {
  it("FP-300: предмет рисуется без заливки — на плане со столом и стулом нет ни одной заливки", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(draw(viewOf(drawing(), { items: [table("t", 200, 100), chair("c", 400, 100)] }), theme).filter((o) => o.kind === "fill" && !isDimensionOp(o))).toEqual([])
    }
  })

  it("FP-300: линии предмета — цвета контуров схемы, в тёмной схеме другого цвета", () => {
    const view = viewOf(drawing(), { items: [table("t", 200, 100)] })
    expect(strokes(draw(view), INK)).toHaveLength(1)
    expect(strokes(draw(view, "dark"), DARK_PALETTE.ink)).toHaveLength(1)
    expect(INK).not.toBe(DARK_PALETTE.ink)
  })

  it("FP-301: цвет подсветки задаётся схемой и различен в светлой и тёмной", () => {
    expect(conflictColor("light")).not.toBe(conflictColor("dark"))
  })
})

describe("предметы на холсте", () => {
  it("FP-302: стол 80×160 — габариты рисунка в реальном масштабе размеров", () => {
    const ops = draw(viewOf(drawing(), { items: [table("t", 200, 100)] }))
    const s = strokes(ops, INK)
    expect(s).toHaveLength(1)
    // первый подконтур — внешний контур рисунка
    const b = box(s[0]?.subpaths[0] ?? [])
    expect(b.maxX - b.minX).toBeCloseTo(80 * K, 6)
    expect(b.maxY - b.minY).toBeCloseTo(160 * K, 6)
    expect(b.minX).toBeCloseTo(160 * K, 6)
    expect(b.minY).toBeCloseTo(20 * K, 6)
  })

  it("FP-302: у стола два контура — внешний и внутренняя линия кромки, оба со скруглёнными углами", () => {
    const sub = strokes(draw(viewOf(drawing(), { items: [table("t", 200, 100)] })), INK)[0]?.subpaths ?? []
    expect(sub).toHaveLength(2)
    for (const poly of sub) expect(poly.length).toBeGreaterThan(8)
    const inner = box(sub[1] ?? [])
    expect(inner.minX).toBeCloseTo((160 + 6) * K, 6)
    expect(inner.minY).toBeCloseTo((20 + 6) * K, 6)
  })

  it("FP-302: повёрнутый на 90 стол — ширина вдоль Y, длина вдоль X", () => {
    const s = strokes(draw(viewOf(drawing(), { items: [table("t", 200, 100, 90)] })), INK)
    const b = box(s[0]?.subpaths[0] ?? [])
    expect(b.maxX - b.minX).toBeCloseTo(160 * K, 6)
    expect(b.maxY - b.minY).toBeCloseTo(80 * K, 6)
  })

  it("FP-302: повёрнутый на 90 стул — спинка справа от центра", () => {
    const sub = strokes(draw(viewOf(drawing(), { items: [chair("c", 200, 100, 90)] })), INK)[0]?.subpaths ?? []
    // внутренняя линия спинки — второй подконтур: дуга спинки (7 см от верха при угле 0) справа от центра на экране, концы
    // подлокотников — на переднем (при угле 0 нижнем) крае, то есть слева; подлокотники идут по горизонтали сверху и снизу
    const back = box(sub[1] ?? [])
    expect(back.maxX).toBeCloseTo((200 + 22.5 - 7) * K, 6)
    expect(back.minX).toBeCloseTo((200 - 22.5) * K, 6)
    expect(back.maxY - back.minY).toBeCloseTo((45 - 14) * K, 6)
  })

  it("FP-303: линии на каждый предмет; тёмная схема рисует линиями своего цвета", () => {
    const view = viewOf(drawing(), { items: [table("a", 100, 100), table("b", 400, 100)] })
    expect(strokes(draw(view), INK)).toHaveLength(2)
    expect(strokes(draw(view, "dark"), DARK_PALETTE.ink)).toHaveLength(2)
  })

  it("FP-304: предмет лежит поверх подложки: линии после заливки гипсокартона и штукатурки", () => {
    const d = drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)], reconstruction: content([drywall("g", 0, 40, 300, 40)]) })
    const ops = draw(viewOf(d, { items: [table("t", 150, 30)] }))
    const fillIndex = (style: string): number => ops.findIndex((o) => o.kind === "fill" && o.fillStyle === style)
    const itemIndex = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === INK && o.subpaths.length === 2 && o.subpaths[0]?.length !== 4)
    expect(itemIndex).toBeGreaterThan(fillIndex(drywallColors("light").fill))
    expect(itemIndex).toBeGreaterThan(fillIndex(LIGHT_PALETTE.muted))
  })

  it("FP-305: призрак рисуется полупрозрачно, поставленный предмет — непрозрачно", () => {
    const rec = recordingContext()
    const alphas: number[] = []
    const original = rec.ctx.stroke.bind(rec.ctx)
    function spiedStroke(): void
    function spiedStroke(path: Path2D): void
    function spiedStroke(path?: Path2D): void {
      const before = rec.ops.length
      if (path === undefined) original()
      else original(path)
      const op = rec.ops[before]
      if (rec.ctx.strokeStyle === INK && op && !isDimensionOp(op)) alphas.push(rec.ctx.globalAlpha)
    }
    rec.ctx.stroke = spiedStroke
    drawFurnitureScene(rec.ctx, 800, 600, viewOf(drawing(), { items: [table("t", 600, 100)], itemGhost: table("", 200, 100) }), "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
    expect(alphas).toHaveLength(2)
    expect(alphas[0]).toBe(1)
    expect(alphas[1]).toBeLessThan(1)
    expect(alphas[1]).toBeGreaterThan(0)
  })
})

describe("подсветка пересечений", () => {
  const overlap: Overlap = { kind: "wall", itemId: "t", itemKind: "table", region: [{ x: 240, y: 20 }, { x: 250, y: 20 }, { x: 250, y: 180 }, { x: 240, y: 180 }] }

  it("FP-306: область пересечения заливается цветом подсветки схемы поверх предмета", () => {
    const ops = draw(viewOf(drawing(), { items: [table("t", 210, 100)], overlaps: [overlap] }))
    const f = fills(ops, conflictColor("light"))
    expect(f).toHaveLength(1)
    const b = box(f[0]?.subpaths.flat() ?? [])
    expect([b.minX, b.minY, b.maxX, b.maxY]).toEqual([240 * K, 20 * K, 250 * K, 180 * K])
    const itemIndex = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === INK)
    expect(ops.findIndex((o) => o.kind === "fill" && o.fillStyle === conflictColor("light"))).toBeGreaterThan(itemIndex)
  })

  it("FP-306: цвет подсветки берётся из палитры схемы", () => {
    const f = fills(draw(viewOf(drawing(), { items: [table("t", 210, 100)], overlaps: [overlap] }), "dark"), conflictColor("dark"))
    expect(f).toHaveLength(1)
  })

  it("FP-307: без пересечений (и в PDF, где они не передаются) подсветки нет", () => {
    expect(fills(draw(viewOf(drawing(), { items: [table("t", 210, 100)] })), conflictColor("light"))).toEqual([])
  })
})

describe("обводка", () => {
  const view = viewOf(drawing(), { items: [table("a", 100, 100), chair("b", 400, 100)], selectedItemIds: new Set(["a"]), erasingItemId: "b" })

  it("FP-308: выделенный и стираемый предмет обводятся цветами выделения и ластика", () => {
    const ops = draw(view)
    expect(strokes(ops, LIGHT_PALETTE.selection)).toHaveLength(1)
    expect(strokes(ops, LIGHT_PALETTE.erase)).toHaveLength(1)
  })

  it("FP-308: внутри силуэта заливки выделения и ластика нет", () => {
    const ops = draw(view)
    expect(fills(ops, LIGHT_PALETTE.selection)).toEqual([])
    expect(fills(ops, LIGHT_PALETTE.erase)).toEqual([])
  })

  it("FP-308: обводка идёт по силуэту рисунка — у стола со скруглёнными углами, а не по четырём углам", () => {
    const halo = strokes(draw(view), LIGHT_PALETTE.selection)[0]?.subpaths[0] ?? []
    expect(halo.length).toBeGreaterThan(8)
    const b = box(halo)
    expect(b.maxX - b.minX).toBeCloseTo(80 * K, 6)
    expect(b.maxY - b.minY).toBeCloseTo(160 * K, 6)
  })

  it("FP-308: обводка лежит под линиями предмета", () => {
    const ops = draw(view)
    const haloIndex = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.selection)
    const itemIndex = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === INK)
    expect(haloIndex).toBeLessThan(itemIndex)
  })
})
