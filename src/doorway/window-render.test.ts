import { describe, expect, it } from "vitest"
import { SCREEN_METRICS, drawScene } from "../render"
import type { RenderOptions } from "../render"
import { findRooms } from "../room-area"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Point, Unit, View, Wall, WallElement } from "../types"
import { parseColor } from "../wall-tracking.test-utils"
import {
  AREA_LABEL,
  D0,
  VIEW,
  clippedIn,
  door,
  onSegment,
  sameSegment,
  sceneF,
  sceneR,
  sceneRT,
  segments,
  strokes,
  toScreen,
  w,
} from "./doorway.test-utils"
import type { Op, StrokeOp } from "./doorway.test-utils"
import { WA, WN, colorRecorder, win } from "./window.test-utils"
import type { ColoredText } from "./window.test-utils"

// change add-window: обозначение окна и подпись «H / H под.» на холсте
// (spec window «Отображение окна», «Подпись окна»; design D5, D6). Ожидания — по геометрии сцен.

const INK = LIGHT_PALETTE.ink
const PAPER = LIGHT_PALETTE.paper

function draw(walls: Wall[], opts: RenderOptions, unit: Unit = "cm", view: View = VIEW): { ops: Op[]; texts: ColoredText[] } {
  const { ctx, ops, texts } = colorRecorder()
  drawScene(ctx, 1600, 1200, walls, null, unit, view, [], { grid: false, ...opts })
  return { ops, texts }
}

const TOL = 0.5
const contour = (ops: Op[]): StrokeOp[] => strokes(ops).filter((o) => o.strokeStyle === INK && o.lineWidth === SCREEN_METRICS.contourPx)
// тонкие линии цвета чернил, горизонтальные на экране (штриховка — диагональная)
const thinInkHorizontal = (ops: Op[]): [Point, Point][] =>
  strokes(ops)
    .filter((o) => o.strokeStyle === INK && o.lineWidth < SCREEN_METRICS.contourPx)
    .flatMap(segments)
    .filter(([p, q]) => Math.abs(p.y - q.y) < 0.01 && Math.abs(p.x - q.x) > 0.01)
const greyThin = (ops: Op[]): [Point, Point][] =>
  strokes(ops)
    .filter((o) => o.strokeStyle !== INK && o.strokeStyle !== PAPER && o.lineWidth < SCREEN_METRICS.contourPx)
    .flatMap(segments)

// отрезок контура покрывает обе точки
const covered = (segs: [Point, Point][], p: Point, q: Point): boolean => segs.some((s) => onSegment(p, s, TOL) && onSegment(q, s, TOL))

// оконный блок на горизонтальной стене: участок [x1, x2] по x, ось y = 0, толщина t
function expectWindowBlock(ops: Op[], x1: number, x2: number, t: number, view: View = VIEW): void {
  const S = (x: number, y: number): Point => toScreen({ x, y }, view)
  const c = contour(ops).flatMap(segments)
  const h = t / 2
  const s = 0.6 * t
  // вырез
  expect(clippedIn(ops, S((x1 + x2) / 2, 0))).toBe(false)
  expect(clippedIn(ops, S(x1 + 1, h - 1))).toBe(false)
  // грани через окно — контуром на всём участке
  for (const y of [-h, h]) expect(covered(c, S(x1 + 0.5, y), S(x2 - 0.5, y))).toBe(true)
  // откосы
  for (const x of [x1, x2]) expect(covered(c, S(x, -h + 0.5), S(x, h - 0.5))).toBe(true)
  // квадраты у откосов: сторона 0.6·T, по центру толщины, вплотную к откосу
  for (const [a, b] of [
    [x1, x1 + s],
    [x2 - s, x2],
  ]) {
    for (const y of [-s / 2, s / 2]) expect(covered(c, S(a + 0.2, y), S(b - 0.2, y))).toBe(true)
    const inner = a === x1 ? b : a
    expect(covered(c, S(inner, -s / 2 + 0.2), S(inner, s / 2 - 0.2))).toBe(true)
  }
  // стёкла: тонкие линии на ±T/6 от квадрата до квадрата
  const glass = thinInkHorizontal(ops)
  for (const y of [-t / 6, t / 6]) expect(glass.some((g) => sameSegment(g, S(x1 + s, y), S(x2 - s, y), TOL))).toBe(true)
  // стёкла не заходят в квадраты и не лежат на ±T/3
  for (const y of [-t / 6, t / 6]) expect(glass.some((g) => onSegment(S(x1 + s / 2, y), g, 0.1))).toBe(false)
  for (const y of [-t / 3, t / 3]) expect(glass.some((g) => onSegment(S((x1 + x2) / 2, y), g, TOL))).toBe(false)
  // грани через окно не серые
  for (const y of [-h, h]) expect(greyThin(ops).some((g) => onSegment(S((x1 + x2) / 2, y), g, TOL))).toBe(false)
}

describe("обозначение окна", () => {
  it("WL-01: на стене 20 см — вырез, грани и откосы контуром, квадраты 12×12, стёкла на ±10/3", () => {
    const { walls } = sceneF()
    const { ops } = draw(walls, { doorways: [WA()] })
    expectWindowBlock(ops, 100, 220, 20)
    // контроль: вне окна штриховка есть
    expect(clippedIn(ops, toScreen({ x: 50, y: 0 }))).toBe(true)
  })

  it("WL-02: обратное направление стены с привязкой b даёт то же обозначение", () => {
    const back = w(500, 0, 0, 0, "W")
    const { ops } = draw([back], { doorways: [win("W", "b", 100)] })
    expectWindowBlock(ops, 100, 220, 20)
  })

  it("WL-03: узкое окно 20 см — квадраты есть, стёкол нет", () => {
    const { walls } = sceneF()
    const { ops } = draw(walls, { doorways: [win("W", "a", 100, 20)] })
    const c = contour(ops).flatMap(segments)
    const S = (x: number, y: number): Point => toScreen({ x, y })
    expect(covered(c, S(100.2, -6), S(111.8, -6))).toBe(true)
    expect(covered(c, S(108.2, 6), S(119.8, 6))).toBe(true)
    const glass = thinInkHorizontal(ops).filter(([p]) => p.x >= S(99, 0).x && p.x <= S(121, 0).x)
    expect(glass).toEqual([])
  })

  it("WL-03b: граница 1.2·T — при ширине 24 стёкол нет, при 24.5 есть (длиной 0.5)", () => {
    const { walls } = sceneF()
    const zoomed: View = { zoom: 4, pan: { x: 0, y: -100 } }
    const S = (x: number, y: number): Point => toScreen({ x, y }, zoomed)
    // только в полосе толщины стены: рамка подписи окна — тоже тонкая линия чернил, но вне стены
    const inside = (g: [Point, Point]): boolean =>
      g[0].x >= S(99, 0).x && g[0].x <= S(125, 0).x && Math.abs(g[0].y - S(0, 0).y) <= S(0, 10).y - S(0, 0).y + TOL
    const at24 = draw(walls, { doorways: [win("W", "a", 100, 24)] }, "cm", zoomed).ops
    expect(thinInkHorizontal(at24).filter(inside)).toEqual([])
    const at245 = draw(walls, { doorways: [win("W", "a", 100, 24.5)] }, "cm", zoomed).ops
    const glass = thinInkHorizontal(at245).filter(inside)
    for (const y of [-20 / 6, 20 / 6]) expect(glass.some((g) => sameSegment(g, S(112, y), S(112.5, y), TOL))).toBe(true)
  })

  it("WL-03c: при ширине ровно 1.2·T нет ни одной тонкой линии на ±T/6, в том числе нулевой длины", () => {
    const { walls } = sceneF()
    const zoomed: View = { zoom: 4, pan: { x: 0, y: -100 } }
    const S = (x: number, y: number): Point => toScreen({ x, y }, zoomed)
    const ops = draw(walls, { doorways: [win("W", "a", 100, 24)] }, "cm", zoomed).ops
    const thinInk = strokes(ops)
      .filter((o) => o.strokeStyle === INK && o.lineWidth < SCREEN_METRICS.contourPx)
      .flatMap((o) => o.subpaths)
    for (const y of [-20 / 6, 20 / 6]) {
      const at = S(0, y).y
      const hits = thinInk.filter((sp) => sp.some((p) => Math.abs(p.y - at) < 0.1 && p.x >= S(99, 0).x && p.x <= S(125, 0).x))
      expect(hits).toEqual([])
    }
  })

  it("WL-04: стена 10 см — квадраты 6×6, стёкла на ±10/6", () => {
    const thin = w(0, 0, 500, 0, "W", 10)
    const { ops } = draw([thin], { doorways: [win("W", "a", 100)] })
    expectWindowBlock(ops, 100, 220, 10)
  })

  it("WL-05: нарушенное окно за торцом стены не рисуется за гранью", () => {
    const { walls } = sceneF()
    const { ops } = draw(walls, { doorways: [win("W", "a", 450, 90)] })
    const limit = toScreen({ x: 500, y: 0 }).x + TOL
    // тонкие линии — только в полосе толщины стены: рамка подписи окна лежит вне стены
    const band = (g: [Point, Point]): boolean => Math.abs(g[0].y - toScreen({ x: 0, y: 0 }).y) <= toScreen({ x: 0, y: 10 }).y - toScreen({ x: 0, y: 0 }).y + TOL
    const drawn = [...contour(ops).flatMap(segments), ...thinInkHorizontal(ops).filter(band)]
    for (const [p, q] of drawn) {
      expect(p.x).toBeLessThanOrEqual(limit)
      expect(q.x).toBeLessThanOrEqual(limit)
    }
    expect(clippedIn(ops, toScreen({ x: 475, y: 0 }))).toBe(false)
    // часть окна на стене нарисована: квадрат у левого откоса и грани контуром
    const S = (x: number, y: number): Point => toScreen({ x, y })
    const c = contour(ops).flatMap(segments)
    for (const y of [-6, 6]) expect(covered(c, S(450.2, y), S(461.8, y))).toBe(true)
    for (const y of [-10, 10]) expect(covered(c, S(451, y), S(499, y))).toBe(true)
  })

  it("WL-06: на одной стене грани через проём серые, через окно — контуром", () => {
    const { walls } = sceneF()
    const { ops } = draw(walls, { doorways: [D0(), WN()] })
    const S = (x: number, y: number): Point => toScreen({ x, y })
    const grey = greyThin(ops)
    const c = contour(ops).flatMap(segments)
    for (const y of [-10, 10]) {
      expect(grey.some((g) => onSegment(S(145, y), g, TOL))).toBe(true)
      expect(covered(c, S(145, y), S(146, y))).toBe(false)
      expect(grey.some((g) => onSegment(S(340, y), g, TOL))).toBe(false)
      expect(covered(c, S(281, y), S(399, y))).toBe(true)
    }
    expectWindowBlock(ops, 280, 400, 20)
  })
})

describe("размеры выделенного элемента и призрака измеряются до соседа", () => {
  // числа цепочек: только цифры (подписи H, H под. и площади отброшены)
  const chainNumbers = (texts: ColoredText[], below: boolean): string[] => {
    const face = toScreen({ x: 0, y: 0 }).y
    return texts
      .filter((t) => /^\d+$/.test(t.text) && (below ? t.at.y > face : t.at.y < face))
      .map((t) => t.text)
      .sort()
  }

  it("WL-11: выделенный проём в RN — 90|90|90 на внутренней грани, 110|90|90 на наружной, без 300/320", () => {
    const { walls } = sceneR()
    const d = D0()
    const { texts } = draw(walls, { doorways: [d, WN()], selectedDoorways: [d] })
    expect(chainNumbers(texts, true)).toEqual(["90", "90", "90"])
    expect(chainNumbers(texts, false)).toEqual(["110", "90", "90"])
    expect(texts.map((t) => t.text)).not.toContain("300")
    expect(texts.map((t) => t.text)).not.toContain("320")
  })

  it("WL-11b: призрак в промежутке 190…280 — 0|90|0 на обеих гранях", () => {
    const { walls } = sceneR()
    const ghost = door("W", "a", 190, 90, 210, "g")
    const { texts } = draw(walls, { doorways: [D0(), WN()], doorwayGhost: ghost })
    expect(chainNumbers(texts, true)).toEqual(["0", "0", "90"])
    expect(chainNumbers(texts, false)).toEqual(["0", "0", "90"])
  })
})

describe("помещения не зависят от окон", () => {
  it("WL-10: окно в перегородке — две комнаты с прежними площадями", () => {
    const { walls } = sceneRT()
    const area = (texts: ColoredText[]): string[] => texts.filter((t) => AREA_LABEL.test(t.text)).map((t) => t.text).sort()
    const plain = area(draw(walls, {}).texts)
    expect(plain).toHaveLength(2)
    const withWindow = area(draw(walls, { doorways: [win("Q", "a", 100, 90)] }).texts)
    expect(withWindow).toEqual(plain)
    expect(findRooms(walls)).toHaveLength(2)
  })
})

describe("подпись окна", () => {
  const label = (texts: ColoredText[]): { h: ColoredText; sill: ColoredText } => {
    const h = texts.filter((t) => /^H=/.test(t.text))
    const sill = texts.filter((t) => /^H под\.=/.test(t.text))
    expect(h).toHaveLength(1)
    expect(sill).toHaveLength(1)
    return { h: h[0], sill: sill[0] }
  }
  const isBlue = (css: string): boolean => {
    const rgb = parseColor(css)
    if (!rgb) return false
    const [r, g, b] = rgb
    return b > r + 40 && b > g
  }

  it("WL-07: «H=150» чернилами и синее «H под.=85» над свободной стеной, в общей рамке", () => {
    const { walls } = sceneF()
    const { ops, texts } = draw(walls, { doorways: [WA()] })
    const { h, sill } = label(texts)
    expect(h.text).toBe("H=150")
    expect(sill.text).toBe("H под.=85")
    expect(h.fillStyle).toBe(INK)
    expect(sill.fillStyle).toBe(LIGHT_PALETTE.sill)
    expect(isBlue(sill.fillStyle)).toBe(true)
    // «H под.» правее «H=» на одной строке; обе над стеной (слева на экране от a → b)
    expect(sill.at.x).toBeGreaterThan(h.at.x)
    expect(Math.abs(sill.at.y - h.at.y)).toBeLessThan(TOL)
    const face = toScreen({ x: 0, y: -10 }).y
    expect(h.at.y).toBeLessThan(face)
    // рамка: обведённый путь, охватывающий обе части, целиком над стеной
    const frames = strokes(ops).filter((o) =>
      o.strokeStyle === INK &&
      o.subpaths.some((sp) => {
        if (sp.length < 4) return false
        const xs = sp.map((p) => p.x)
        const ys = sp.map((p) => p.y)
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
        return x0 < h.at.x && x1 > sill.at.x && y0 < h.at.y && y1 > h.at.y && y1 < face
      }),
    )
    expect(frames.length).toBeGreaterThan(0)
  })

  it("WL-07b: у проёма рамки и синей части нет (регрессия)", () => {
    const { walls } = sceneF()
    const { texts } = draw(walls, { doorways: [D0()] })
    expect(texts.filter((t) => /^H под\./.test(t.text))).toEqual([])
    expect(texts.filter((t) => t.text === "H=210")).toHaveLength(1)
  })

  it("WL-08: мм — «H=1500», «H под.=850»; м — «H=1,5», «H под.=0,85»", () => {
    const { walls } = sceneF()
    const mm = label(draw(walls, { doorways: [WA()] }, "mm").texts)
    expect([mm.h.text, mm.sill.text]).toEqual(["H=1500", "H под.=850"])
    const m = label(draw(walls, { doorways: [WA()] }, "m").texts)
    expect([m.h.text, m.sill.text]).toEqual(["H=1,5", "H под.=0,85"])
  })

  it("WL-08b: подоконник 0 подписывается «H под.=0»", () => {
    const { walls } = sceneF()
    const { sill } = label(draw(walls, { doorways: [win("W", "a", 100, 120, 150, 0)] }).texts)
    expect(sill.text).toBe("H под.=0")
  })

  it("WL-09: окно в наружной стене помещения — подпись со стороны помещения", () => {
    const { walls } = sceneR()
    const { h, sill } = label(draw(walls, { doorways: [WN()] }).texts)
    const inner = toScreen({ x: 0, y: 10 }).y
    expect(h.at.y).toBeGreaterThan(inner)
    expect(sill.at.y).toBeGreaterThan(inner)
  })

  it("WL-07c: синий цвет подоконника есть и в тёмной палитре и отличается от чернил", () => {
    const elements: WallElement[] = [WA()]
    const { walls } = sceneF()
    const { texts } = draw(walls, { doorways: elements, palette: DARK_PALETTE })
    const sill = texts.find((t) => /^H под\./.test(t.text))
    expect(sill?.fillStyle).toBe(DARK_PALETTE.sill)
    const h = texts.find((t) => t.text === "H=150")
    expect(h?.fillStyle).toBe(DARK_PALETTE.ink)
    expect(DARK_PALETTE.sill).not.toBe(DARK_PALETTE.ink)
    expect(isBlue(DARK_PALETTE.sill)).toBe(true)
  })
})
