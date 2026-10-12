import { describe, expect, it } from "vitest"
import { SCREEN_METRICS, drawScene } from "../render"
import type { RenderOptions } from "../render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Point, Unit, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { VIEW, sameSegment, segments, strokes, toScreen } from "../doorway/doorway.test-utils"
import type { Op, StrokeOp } from "../doorway/doorway.test-utils"
import { circleRecorder, duct, riser, room } from "./communications.test-utils"
import type { ColoredText } from "../doorway/window.test-utils"

// change add-communications: отображение коммуникаций на холсте (spec communications «Отображение коммуникаций»,
// «Размеры выделенной коммуникации»; test-plan CR-*, CN-*). Ожидания — по геометрии и палитре схемы.
// Окружности записываются как ломаные (circleRecorder), экранные координаты — toScreen.

function draw(walls: Wall[], opts: RenderOptions, unit: Unit = "cm"): { ops: Op[]; texts: ColoredText[] } {
  const { ctx, ops, texts } = circleRecorder()
  drawScene(ctx, 1600, 1200, walls, null, unit, VIEW, [], { grid: false, ...opts })
  return { ops, texts }
}

const contour = (ops: Op[], ink: string): StrokeOp[] => strokes(ops).filter((o) => o.strokeStyle === ink && o.lineWidth === SCREEN_METRICS.contourPx)
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y)

// подпуть-окружность: достаточно вершин, все на расстоянии r от центра, охват по обеим осям — диаметр
function circleIn(ops: StrokeOp[], center: Point, r: number, tol = 0.6): boolean {
  return ops.some((o) =>
    o.subpaths.some((sp) => {
      if (sp.length < 16) return false
      if (!sp.every((p) => Math.abs(dist(p, center) - r) <= tol)) return false
      const xs = sp.map((p) => p.x)
      const ys = sp.map((p) => p.y)
      return Math.max(...xs) - Math.min(...xs) >= 2 * r - 2 * tol && Math.max(...ys) - Math.min(...ys) >= 2 * r - 2 * tol
    }),
  )
}

const S = (x: number, y: number): Point => toScreen({ x, y })

describe("стояк", () => {
  it("CR-01: Ø11 с центром (100,100) — окружность радиуса 5,5 см линией контура (11 px на экране)", () => {
    const { ops } = draw([], { communications: [riser(100, 100, 11)] })
    expect(circleIn(contour(ops, LIGHT_PALETTE.ink), S(100, 100), 5.5 * PX_PER_CM * VIEW.zoom)).toBe(true)
  })

  it("CR-01b: размер окружности следует диаметру: Ø20 — радиус 10 см", () => {
    const { ops } = draw([], { communications: [riser(100, 100, 20)] })
    const c = contour(ops, LIGHT_PALETTE.ink)
    expect(circleIn(c, S(100, 100), 10 * PX_PER_CM * VIEW.zoom)).toBe(true)
    expect(circleIn(c, S(100, 100), 5.5 * PX_PER_CM * VIEW.zoom)).toBe(false)
  })

  it("CR-01c: стояк не заштрихован и не содержит диагонали", () => {
    const { ops } = draw([], { communications: [riser(100, 100, 11)] })
    expect(circleIn(contour(ops, LIGHT_PALETTE.ink), S(100, 100), 11)).toBe(true)
    // единственный путь цвета контура — окружность; прямых отрезков нет
    const lines = contour(ops, LIGHT_PALETTE.ink).flatMap((o) => o.subpaths).filter((sp) => sp.length === 2)
    expect(lines).toHaveLength(0)
  })

  it("CR-05: два стояка рисуются каждый на своём месте", () => {
    const { ops } = draw([], { communications: [riser(100, 100, 10, "a"), riser(250, 180, 16, "b")] })
    const c = contour(ops, LIGHT_PALETTE.ink)
    expect(circleIn(c, S(100, 100), 5 * 2)).toBe(true)
    expect(circleIn(c, S(250, 180), 8 * 2)).toBe(true)
  })
})

describe("воздуховод", () => {
  const d = duct(100, 100, 30, 20)
  const tl = S(85, 90)
  const tr = S(115, 90)
  const br = S(115, 110)
  const bl = S(85, 110)

  it("CR-02: прямоугольник 30×20 от (85,90) до (115,110) — все четыре вершины в контуре", () => {
    const { ops } = draw([], { communications: [d] })
    const pts = contour(ops, LIGHT_PALETTE.ink).flatMap((o) => o.subpaths).flat()
    for (const corner of [tl, tr, br, bl]) expect(pts.some((p) => dist(p, corner) <= 0.6), `${corner.x},${corner.y}`).toBe(true)
  })

  it("CR-02b: диагональ — от левого верхнего угла к правому нижнему, другой диагонали нет", () => {
    const { ops } = draw([], { communications: [d] })
    const segs = contour(ops, LIGHT_PALETTE.ink).flatMap(segments)
    expect(segs.some((s) => sameSegment(s, tl, br, 0.6))).toBe(true)
    expect(segs.some((s) => sameSegment(s, tr, bl, 0.6))).toBe(false)
  })

  it("CR-02c: воздуховод не повёрнут: стороны вертикальны и горизонтальны, ширина по X, глубина по Y", () => {
    const { ops } = draw([], { communications: [duct(100, 100, 50, 10)] })
    const pts = contour(ops, LIGHT_PALETTE.ink).flatMap((o) => o.subpaths).flat()
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50 * PX_PER_CM * VIEW.zoom, 0)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(10 * PX_PER_CM * VIEW.zoom, 0)
  })

  it("CR-04: тёмная схема — контур цветом чернил тёмной схемы, а не светлой", () => {
    const { ops } = draw([], { communications: [d, riser(250, 100, 11)], palette: DARK_PALETTE })
    expect(contour(ops, DARK_PALETTE.ink).flatMap(segments).some((s) => sameSegment(s, tl, br, 0.6))).toBe(true)
    expect(circleIn(contour(ops, DARK_PALETTE.ink), S(250, 100), 5.5 * PX_PER_CM * VIEW.zoom)).toBe(true)
    expect(contour(ops, LIGHT_PALETTE.ink)).toHaveLength(0)
  })
})

describe("порядок и выделение", () => {
  it("CR-06: без списка коммуникаций сцена не меняется (нет окружностей и диагоналей)", () => {
    const { ops } = draw(room().walls, {})
    expect(circleIn(contour(ops, LIGHT_PALETTE.ink), S(100, 100), 10)).toBe(false)
  })

  it("CR-07: выделенная коммуникация подсвечена цветом выделения, невыделенная — нет", () => {
    const sel = riser(100, 100, 10, "s")
    const other = riser(250, 100, 10, "o")
    const { ops } = draw([], { communications: [sel, other], selectedCommunications: [sel] })
    const selStrokes = strokes(ops).filter((o) => o.strokeStyle === LIGHT_PALETTE.selection)
    expect(circleIn(selStrokes, S(100, 100), 10, 3)).toBe(true)
    expect(circleIn(selStrokes, S(250, 100), 10, 3)).toBe(false)
  })

  it("CR-08: подсветка ластика — красным (цвет erase) у коммуникации под курсором", () => {
    const hovered = duct(100, 100)
    const { ops } = draw([], { communications: [hovered], hoverCommunication: hovered })
    const erase = strokes(ops).filter((o) => o.strokeStyle === LIGHT_PALETTE.erase)
    expect(erase.length).toBeGreaterThan(0)
    const pts = erase.flatMap((o) => o.subpaths).flat()
    expect(pts.some((p) => dist(p, S(85, 90)) <= 3)).toBe(true)
    expect(pts.some((p) => dist(p, S(115, 110)) <= 3)).toBe(true)
  })

  it("CR-09: призрак установки рисуется той же формой на своём месте", () => {
    const ghost = riser(150, 150, 12, "g")
    const { ops } = draw([], { communications: [], communicationGhost: ghost })
    const all = strokes(ops)
    expect(circleIn(all, S(150, 150), 6 * PX_PER_CM * VIEW.zoom, 0.6)).toBe(true)
  })
})

describe("числа выделенной коммуникации", () => {
  const { walls } = room()
  const r = riser(100, 100, 10)
  const labels = (texts: ColoredText[]): string[] => texts.map((t) => t.text).filter((t) => !/ м²$/.test(t))

  it("CN-10: выделен стояк Ø10 в комнате (см) — видны «Ø10», 85, 185, 85, 285", () => {
    const { texts } = draw(walls, { communications: [r], selectedCommunications: [r] })
    const l = labels(texts)
    expect(l).toContain("⌀10")
    expect(l.filter((t) => t === "85")).toHaveLength(2)
    expect(l).toContain("185")
    expect(l).toContain("285")
  })

  it("CN-10b: единица «мм» — «⌀100» и 850, 1850, 850, 2850", () => {
    const { texts } = draw(walls, { communications: [r], selectedCommunications: [r] }, "mm")
    const l = labels(texts)
    expect(l).toContain("⌀100")
    expect(l.filter((t) => t === "850")).toHaveLength(2)
    expect(l).toContain("1850")
    expect(l).toContain("2850")
  })

  it("CN-10c: выделен воздуховод 30×20 — числа ширины 30 и глубины 20", () => {
    const d = duct(100, 100, 30, 20)
    const { texts } = draw(walls, { communications: [d], selectedCommunications: [d] })
    const l = labels(texts)
    expect(l).toContain("30")
    expect(l).toContain("20")
    expect(l.some((t) => t.startsWith("⌀"))).toBe(false)
  })

  it("CN-11: нет выделения — чисел нет", () => {
    const { ops, texts } = draw(walls, { communications: [r], selectedCommunications: [] })
    expect(circleIn(contour(ops, LIGHT_PALETTE.ink), S(100, 100), 10)).toBe(true)
    const l = labels(texts)
    expect(l.some((t) => t.startsWith("⌀"))).toBe(false)
    expect(l).not.toContain("185")
    expect(l).not.toContain("285")
  })

  it("CN-11b: две выделенные коммуникации — чисел нет (мультивыделение)", () => {
    const r2 = riser(200, 200, 10, "r2")
    const { ops, texts } = draw(walls, { communications: [r, r2], selectedCommunications: [r, r2] })
    expect(circleIn(contour(ops, LIGHT_PALETTE.ink), S(200, 200), 10)).toBe(true)
    expect(labels(texts).some((t) => t.startsWith("⌀"))).toBe(false)
    expect(labels(texts)).not.toContain("185")
  })

  it("CN-11c: призрак без чисел", () => {
    const { ops, texts } = draw(walls, { communications: [], communicationGhost: r })
    expect(circleIn(strokes(ops), S(100, 100), 10)).toBe(true)
    expect(labels(texts).some((t) => t.startsWith("⌀"))).toBe(false)
    expect(labels(texts)).not.toContain("185")
    expect(labels(texts)).not.toContain("185")
  })

  it("CN-11d: выделен стояк и одновременно виден призрак: числа призрака не выводятся (состояние в приложении недостижимо — инструмент снимает выделение, поэтому числа выделенного не фиксируются)", () => {
    const ghost = riser(200, 200, 12, "g") // его числа были бы «Ø12», 184, 84
    const { texts } = draw(walls, { communications: [r], selectedCommunications: [r], communicationGhost: ghost })
    const l = labels(texts)
    expect(l).not.toContain("⌀12")
    expect(l).not.toContain("184")
    expect(l).not.toContain("84")
  })

  it("CN-14: размерная линия расстояния идёт от края коммуникации до грани стены (влево: от x = 95 до x = 10 на y = 100)", () => {
    const { ops } = draw(walls, { communications: [r], selectedCommunications: [r] })
    const y = S(95, 100).y
    const horizontal = strokes(ops)
      .flatMap(segments)
      .filter(([p, q]) => Math.abs(p.y - y) <= 0.6 && Math.abs(q.y - y) <= 0.6 && Math.abs(p.x - q.x) > 4)
      .flatMap(([p, q]) => [p.x, q.x])
      .filter((x) => x >= S(10, 100).x - 1.5 && x <= S(95, 100).x + 1.5)
    expect(horizontal.length).toBeGreaterThan(0)
    expect(Math.min(...horizontal)).toBeCloseTo(S(10, 100).x, 0) // у грани стены
    expect(Math.max(...horizontal)).toBeCloseTo(S(95, 100).x, 0) // у края коммуникации, а не у центра (x = 100)
  })

  it("CN-12: нулевое расстояние — число «0» у касания", () => {
    const touching = riser(15, 100, 10)
    const { texts } = draw(walls, { communications: [touching], selectedCommunications: [touching] })
    expect(labels(texts)).toContain("0")
  })

  it("CN-13: число расстояния стоит между краем коммуникации и стеной по своей оси", () => {
    const { texts } = draw(walls, { communications: [r], selectedCommunications: [r] })
    const t185 = texts.find((t) => t.text === "185")
    expect(t185).toBeDefined()
    // между правым краем (105, экран x = 410) и гранью R (290, экран x = 780)
    expect(t185?.at.x).toBeGreaterThan(S(105, 100).x)
    expect(t185?.at.x).toBeLessThan(S(290, 100).x)
    const t285 = texts.find((t) => t.text === "285")
    expect(t285?.at.y).toBeGreaterThan(S(100, 105).y)
    expect(t285?.at.y).toBeLessThan(S(100, 390).y)
  })
})

describe("коммуникации и сетка не мешают", () => {
  it("CR-10: коммуникации рисуются и при включённой сетке", () => {
    const { ctx, ops } = circleRecorder()
    drawScene(ctx, 1600, 1200, [], null, "cm", VIEW, [], { grid: true, communications: [riser(100, 100, 11)] } satisfies RenderOptions)
    expect(circleIn(contour(ops, LIGHT_PALETTE.ink), S(100, 100), 11)).toBe(true)
  })
})
