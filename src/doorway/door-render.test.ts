import { describe, expect, it } from "vitest"
import { SCREEN_METRICS, drawScene } from "../render"
import type { RenderOptions } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Point, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { D0, VIEW, clippedIn, onSegment, sceneF, segments, strokes, texts, toScreen } from "./doorway.test-utils"
import type { Op, StrokeOp } from "./doorway.test-utils"
import { win } from "./window.test-utils"
import { DR, arcPointAt, arcRecorder, expectedLeaf, onPolylineArc, onStrokedArc } from "./door.test-utils"
import type { ArcCall, ExpectedLeaf } from "./door.test-utils"

// change add-door: обозначение двери на холсте — вырез как у проёма, полотно линиями контура, тонкая дуга
// с центром в петле, подпись «H=…»; призрак и выделение (spec door «Отображение двери», «Инструмент «Дверь»»;
// design D3). Ожидания — по формулам спецификации (door.test-utils expectedLeaf).

const INK = LIGHT_PALETTE.ink
const PAPER = LIGHT_PALETTE.paper
const S = (p: Point): Point => toScreen(p, VIEW)
const K = PX_PER_CM * VIEW.zoom
const W90 = 90 // ширина двери DR, см

function draw(walls: Wall[], opts: RenderOptions): { ops: Op[]; arcs: ArcCall[] } {
  const { ctx, ops, arcs } = arcRecorder()
  drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [], { grid: false, ...opts })
  return { ops, arcs }
}

const contour = (ops: Op[]): [Point, Point][] =>
  strokes(ops)
    .filter((o) => o.strokeStyle === INK && o.lineWidth === SCREEN_METRICS.contourPx)
    .flatMap(segments)
const thin = (ops: Op[]): StrokeOp[] => strokes(ops).filter((o) => o.lineWidth < SCREEN_METRICS.contourPx && o.strokeStyle !== PAPER)
const greyThin = (ops: Op[]): [Point, Point][] =>
  strokes(ops)
    .filter((o) => o.strokeStyle !== INK && o.strokeStyle !== PAPER && o.lineWidth < SCREEN_METRICS.contourPx)
    .flatMap(segments)

const TOL = 0.5
const covered = (segs: [Point, Point][], p: Point, q: Point): boolean => segs.some((s) => onSegment(p, s, TOL) && onSegment(q, s, TOL))
const lerp = (p: Point, q: Point, t: number): Point => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })

// точка (мир) нарисована тонкой дугой с центром center (мир) и радиусом W90:
// дугой контекста или ломаной тонкой линии, вершины которой лежат на этой окружности
function onThinArc(ops: Op[], arcs: ArcCall[], world: Point, center: Point): boolean {
  const p = S(world)
  const a = onStrokedArc(arcs, p, 1.5)
  if (a) return a.lineWidth < SCREEN_METRICS.contourPx
  return onPolylineArc(thin(ops).flatMap(segments), S(center), W90 * K, p, 1.5)
}

// дуга от закрытого положения ровно на 95°: точки у обоих концов пролёта есть, сразу за концами — нет
function expectArc95(ops: Op[], arcs: ArcCall[], e: ExpectedLeaf): void {
  for (const deg of [3, 20, 47.5, 80, 93]) expect(onThinArc(ops, arcs, arcPointAt(e, W90, deg), e.hinge), `${deg}°`).toBe(true)
  for (const deg of [-45, -5, 100, 140]) expect(onThinArc(ops, arcs, arcPointAt(e, W90, deg), e.hinge), `${deg}°`).toBe(false)
}

const ref = (hinge: "a" | "b", swing: "left" | "right") => expectedLeaf({ x: 0, y: 0 }, { x: 500, y: 0 }, 100, 190, 20, hinge, swing, W90)

describe("обозначение двери", () => {
  it("DR-01: a/left — вырез, серые грани, полотно контуром, тонкая дуга, подпись H=210", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const { ops, arcs } = draw(walls, { doorways: [d] })
    // вырез и грани — как у проёма
    expect(clippedIn(ops, S({ x: 145, y: 0 }))).toBe(false)
    for (const y of [-10, 10]) expect(covered(greyThin(ops), S({ x: 110, y }), S({ x: 180, y }))).toBe(true)
    // полотно: длинная сторона от петли к открытому концу — линией контура
    const e = ref("a", "left")
    const c = contour(ops)
    expect(covered(c, S(lerp(e.hinge, e.arcTo, 0.05)), S(lerp(e.hinge, e.arcTo, 0.95)))).toBe(true)
    // вторая длинная сторона — на 4 см по другую сторону от закрытого положения (x меньше)
    const off = { x: -4 * towardClosed(e).x, y: -4 * towardClosed(e).y }
    const h2 = { x: e.hinge.x + off.x, y: e.hinge.y + off.y }
    const t2 = { x: e.arcTo.x + off.x, y: e.arcTo.y + off.y }
    expect(covered(c, S(lerp(h2, t2, 0.05)), S(lerp(h2, t2, 0.95)))).toBe(true)
    // дуга: тонкая, с центром в петле, от закрытого положения ровно на 95° в сторону открывания
    expectArc95(ops, arcs, e)
    // подпись высоты
    expect(texts(ops).some((t) => t.text === "H=210")).toBe(true)
  })

  it("DR-01b: b/right — дуга с центром в (190, 10) через сторону y > 0", () => {
    const { walls } = sceneF()
    const { ops, arcs } = draw(walls, { doorways: [DR("b", "right")] })
    const e = ref("b", "right")
    expectArc95(ops, arcs, e)
    expect(covered(contour(ops), S(lerp(e.hinge, e.arcTo, 0.05)), S(lerp(e.hinge, e.arcTo, 0.95)))).toBe(true)
  })

  it("DR-02: у проёма и окна нет полотна и дуги; у двери нет оконного блока", () => {
    const { walls } = sceneF()
    const e = ref("a", "left")
    for (const el of [D0(), win("W", "a", 100, 90)]) {
      const { ops, arcs } = draw(walls, { doorways: [el] })
      expect(onThinArc(ops, arcs, arcPointAt(e, W90, 47.5), e.hinge)).toBe(false)
      expect(covered(contour(ops), S(lerp(e.hinge, e.arcTo, 0.05)), S(lerp(e.hinge, e.arcTo, 0.95)))).toBe(false)
    }
    // оконный квадрат 12 × 12 у откоса x = 100 (для окна той же ширины) у двери не рисуется
    const { ops } = draw(walls, { doorways: [DR()] })
    expect(covered(contour(ops), S({ x: 100.5, y: -6 }), S({ x: 111.5, y: -6 }))).toBe(false)
  })

  it("DR-03: призрак двери рисуется с полотном и дугой", () => {
    const { walls } = sceneF()
    const { ops, arcs } = draw(walls, { doorways: [], doorwayGhost: DR("a", "left") })
    const e = ref("a", "left")
    expectArc95(ops, arcs, e)
  })

  it("DR-04: выделенная дверь подсвечивается по контуру участка между откосами", () => {
    const { walls } = sceneF()
    const d = DR()
    const { ops } = draw(walls, { doorways: [d], selectedDoorways: [d] })
    const sel = strokes(ops)
      .filter((o) => o.strokeStyle === LIGHT_PALETTE.selection)
      .flatMap(segments)
    expect(covered(sel, S({ x: 100, y: -9 }), S({ x: 100, y: 9 }))).toBe(true)
    expect(covered(sel, S({ x: 190, y: -9 }), S({ x: 190, y: 9 }))).toBe(true)
    // полотно не входит в подсветку
    const e = ref("a", "left")
    expect(covered(sel, S(lerp(e.hinge, e.arcTo, 0.3)), S(lerp(e.hinge, e.arcTo, 0.7)))).toBe(false)
  })

  it("DR-05: толщина полотна масштабируется с зумом (4 см чертежа)", () => {
    const { walls } = sceneF()
    const view = { zoom: 2, pan: { x: -100, y: -100 } }
    const { ctx, ops } = arcRecorder()
    drawScene(ctx, 1600, 1200, walls, null, "cm", view, [], { grid: false, doorways: [DR()] })
    const e = ref("a", "left")
    const off = { x: -4 * towardClosed(e).x, y: -4 * towardClosed(e).y }
    const at = (p: Point): Point => toScreen(p, view)
    const c = contour(ops)
    const h2 = { x: e.hinge.x + off.x, y: e.hinge.y + off.y }
    const t2 = { x: e.arcTo.x + off.x, y: e.arcTo.y + off.y }
    expect(covered(c, at(lerp(h2, t2, 0.05)), at(lerp(h2, t2, 0.95)))).toBe(true)
  })
})

// единичная нормаль к полотну, направленная в сторону закрытого положения (u' в design D3)
function towardClosed(e: ReturnType<typeof ref>): Point {
  const v = { x: e.arcTo.x - e.hinge.x, y: e.arcTo.y - e.hinge.y }
  const l = Math.hypot(v.x, v.y)
  let p = { x: -v.y / l, y: v.x / l }
  const toClosed = { x: e.arcFrom.x - e.hinge.x, y: e.arcFrom.y - e.hinge.y }
  if (p.x * toClosed.x + p.y * toClosed.y < 0) p = { x: -p.x, y: -p.y }
  return p
}
