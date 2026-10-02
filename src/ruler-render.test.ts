import { describe, expect, it } from "vitest"
import { nearestEdgeIntersection } from "./geometry"
import { drawScene, PDF_METRICS } from "./render"
import type { RenderOptions } from "./render"
import type { RulerReading } from "./ruler"
import type { Dimension, Point, Unit, View, Wall } from "./types"
import { PX_PER_CM } from "./types"
import { W, sceneR } from "./room-area.test-utils"
import { contrastOnWhite, parseColor } from "./wall-tracking.test-utils"
import { angleDiff, arcRecorder, extraOps, near, normSector, rot } from "./ruler.test-utils"
import type { ArcRec, Op } from "./ruler.test-utils"

// Тесты change ruler-tool: отрисовка замеров линейки (spec ruler-tool «Отображение
// замеров линейки», design D5). Операции линейки выделяются как разница между рисованием
// с опцией ruler и без неё — тест не зависит от конкретного цвета реализации.

const VIEW: View = { zoom: 1, pan: { x: -50, y: -50 } }

const screen = (p: Point, view: View = VIEW): Point => {
  const k = PX_PER_CM * view.zoom
  return { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
}

type Space = Extract<RulerReading, { kind: "space" }>
type RoomAngle = Space["angles"][number]

function draw(walls: Wall[], unit: Unit, view: View, opts: RenderOptions): Op[] {
  const { ctx, ops } = arcRecorder()
  drawScene(ctx, 1200, 900, walls, null, unit, view, [], opts)
  return ops
}

function rulerOps(walls: Wall[], ruler: RulerReading, unit: Unit = "mm", view: View = VIEW, base: RenderOptions = {}): { extra: Op[]; prefix: number; suffix: number; baseLen: number } {
  const without = draw(walls, unit, view, base)
  const withR = draw(walls, unit, view, { ...base, ruler })
  return { ...extraOps(without, withR), baseLen: without.length }
}

const texts = (ops: Op[]): string[] => ops.flatMap((o) => (o.kind === "text" ? [o.text] : []))
const arcsOf = (ops: Op[]): ArcRec[] => ops.flatMap((o) => (o.kind === "stroke" || o.kind === "fill" ? o.arcs : []))
const strokes = (ops: Op[]): Extract<Op, { kind: "stroke" }>[] => ops.filter((o): o is Extract<Op, { kind: "stroke" }> => o.kind === "stroke")

const wallReading = (wall: Wall): RulerReading => ({
  kind: "wall",
  wall,
  from: wall.a,
  to: wall.b,
  lengthCm: Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y),
})

const angle = (at: Point, startDir: Point, sweepDeg: number): RoomAngle => ({ at, startDir, sweepDeg, deg: Math.abs(sweepDeg) })

const anglesReading = (angles: RoomAngle[]): RulerReading => ({ kind: "space", horizontal: null, vertical: null, angles })

const SPANS: Space = {
  kind: "space",
  horizontal: { from: { x: 10, y: 100 }, to: { x: 410, y: 100 }, lengthCm: 400 },
  vertical: { from: { x: 100, y: 10 }, to: { x: 100, y: 310 }, lengthCm: 300 },
  angles: [],
}

const R_ANGLES: RoomAngle[] = [
  angle({ x: 10, y: 10 }, { x: 1, y: 0 }, 90),
  angle({ x: 410, y: 10 }, { x: 0, y: 1 }, 90),
  angle({ x: 410, y: 310 }, { x: -1, y: 0 }, 90),
  angle({ x: 10, y: 310 }, { x: 0, y: -1 }, 90),
]

// цвета существующих слоёв, с которыми замер нельзя спутать
const TAKEN = ["#333", "#555", "rgba(8, 145, 178, 0.9)", "rgba(8, 145, 178, 0.4)", "rgba(8, 145, 178, 0.25)", "rgba(220, 38, 38, 0.5)", "#e0e0e0", "#999"]
const isWhiteish = (style: string): boolean => {
  const c = parseColor(style)
  return !!c && c.every((v) => v >= 250)
}

// отрезок двух точек в обводке, совпадающий с a–b (в любом направлении)
const hasSegment = (ops: Op[], a: Point, b: Point, tol = 1): boolean =>
  strokes(ops).some((s) => s.subpaths.some((sp) => sp.length >= 2 && ((near(sp[0], a, tol) && near(sp[sp.length - 1], b, tol)) || (near(sp[0], b, tol) && near(sp[sp.length - 1], a, tol)))))

// подложка подписи: белая обводка того же текста в той же точке или белый прямоугольник,
// залитый после предыдущей подписи и до этой
function expectBacked(extra: Op[], text: string): void {
  const i = extra.findIndex((o) => o.kind === "text" && o.text === text)
  expect(i, `подпись «${text}»`).toBeGreaterThanOrEqual(0)
  const label = extra[i]
  if (label.kind !== "text") return
  const halo = extra.some((o) => o.kind === "textStroke" && o.text === text && near(o.at, label.at, 0.5) && isWhiteish(o.style) && o.widthPx > 0)
  let prev = i - 1
  while (prev >= 0 && extra[prev].kind !== "text") prev--
  const box = extra.slice(prev + 1, i).some((o) => o.kind === "rect" && o.fill && isWhiteish(o.style))
  expect(halo || box, `подложка под «${text}»`).toBe(true)
}

// стиль размерной линии (spec: засечки на концах, число на подложке посередине):
// число у середины a–b, у каждого конца — отдельная от основного отрезка отметка
function expectDimensionLine(extra: Op[], a: Point, b: Point, text: string): void {
  const label = extra.find((o): o is Extract<Op, { kind: "text" }> => o.kind === "text" && o.text === text)
  expect(label, `подпись «${text}»`).toBeDefined()
  if (!label) return
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const d = { x: label.at.x - mid.x, y: label.at.y - mid.y }
  expect(Math.abs(d.x * u.x + d.y * u.y), `«${text}» посередине вдоль линии`).toBeLessThanOrEqual(4)
  expect(Math.abs(-d.x * u.y + d.y * u.x), `«${text}» у линии`).toBeLessThanOrEqual(20)
  const isMain = (sp: Point[]): boolean => sp.length >= 2 && ((near(sp[0], a, 1) && near(sp[sp.length - 1], b, 1)) || (near(sp[0], b, 1) && near(sp[sp.length - 1], a, 1)))
  const marks = extra.flatMap((o) => (o.kind === "stroke" || o.kind === "fill" ? o.subpaths : [])).filter((sp) => !isMain(sp) && sp.length >= 2)
  for (const end of [a, b]) expect(marks.some((sp) => sp.some((p) => near(p, end, 12))), `засечка у ${JSON.stringify(end)}`).toBe(true)
  expectBacked(extra, text)
}

// цвет подсказок построения — цвет дуги угла построения в том же рисовании
function constructionColor(): string {
  const ops = draw([], "mm", VIEW, { angle: { at: { x: 100, y: 100 }, from: { x: 1, y: 0 }, to: { x: 0, y: 1 }, deg: 90 } })
  const arc = strokes(ops).find((s) => s.arcs.length > 0)
  if (!arc) throw new Error("предусловие: угол построения рисует дугу")
  return arc.style
}

function dimensionOnTopWall(walls: Wall[]): Dimension {
  const a = nearestEdgeIntersection({ x: 10, y: 10 }, walls, 2)
  const b = nearestEdgeIntersection({ x: 410, y: 10 }, walls, 2)
  if (!a || !b) throw new Error("предусловие: точки замера размера на углах R")
  return { from: { a: a.a, b: a.b }, to: { a: b.a, b: b.b }, offset: 40 }
}

describe("отрисовка замеров линейки", () => {
  it("RND-WALL-1: замер стены — линия по оси и длина в мм", () => {
    const walls = sceneR()
    const { extra } = rulerOps(walls, wallReading(walls[0]))
    expect(texts(extra)).toEqual(["4200"])
    expect(hasSegment(extra, screen({ x: 0, y: 0 }), screen({ x: 420, y: 0 }))).toBe(true)
    expectDimensionLine(extra, screen({ x: 0, y: 0 }), screen({ x: 420, y: 0 }), "4200")
  })

  it("RND-WALL-2: замер косой стены — число посередине оси, засечки на концах", () => {
    const wall = W(0, 0, 300, 400)
    const { extra } = rulerOps([wall], wallReading(wall))
    expect(texts(extra)).toEqual(["5000"])
    expectDimensionLine(extra, screen(wall.a), screen(wall.b), "5000")
  })

  it("RND-UNIT-1: единицы блока размеров — м и см", () => {
    const walls = sceneR()
    expect(texts(rulerOps(walls, wallReading(walls[0]), "m").extra)).toEqual(["4,2"])
    expect(texts(rulerOps(walls, wallReading(walls[0]), "cm").extra)).toEqual(["420"])
    expect(texts(rulerOps(walls, SPANS, "m").extra).sort()).toEqual(["3", "4"])
    expect(texts(rulerOps(walls, SPANS, "cm").extra).sort()).toEqual(["300", "400"])
  })

  it("RND-UNIT-2: 150 см в метрах — «1,5»", () => {
    const wall = W(0, 0, 150, 0)
    expect(texts(rulerOps([wall], wallReading(wall), "m").extra)).toEqual(["1,5"])
  })

  it("RND-SPAN-1: два пролёта — два числа и две линии", () => {
    const { extra } = rulerOps(sceneR(), SPANS)
    expect(texts(extra).sort()).toEqual(["3000", "4000"])
    expect(hasSegment(extra, screen({ x: 10, y: 100 }), screen({ x: 410, y: 100 }))).toBe(true)
    expect(hasSegment(extra, screen({ x: 100, y: 10 }), screen({ x: 100, y: 310 }))).toBe(true)
    expectDimensionLine(extra, screen({ x: 10, y: 100 }), screen({ x: 410, y: 100 }), "4000")
    expectDimensionLine(extra, screen({ x: 100, y: 10 }), screen({ x: 100, y: 310 }), "3000")
  })

  it("RND-SPAN-2: пустые пролёты и углы — ничего не рисуется", () => {
    const { extra } = rulerOps(sceneR(), { kind: "space", horizontal: null, vertical: null, angles: [] })
    expect(extra).toEqual([])
  })

  it("RND-COLOR-1: цвет замера — цвет подсказок построения, отличный от размеров, стен и выделения", () => {
    const walls = sceneR()
    const dims = [dimensionOnTopWall(walls)]
    const hint = constructionColor()
    const ruler: Space = { ...SPANS, angles: R_ANGLES }
    for (const reading of [wallReading(walls[0]), ruler]) {
      const { extra } = rulerOps(walls, reading, "mm", VIEW, { dimensions: dims })
      const colored = [...strokes(extra).map((s) => s.style), ...extra.flatMap((o) => (o.kind === "text" ? [o.style] : []))].filter((s) => !isWhiteish(s))
      expect(colored.length).toBeGreaterThan(0)
      for (const style of colored) expect(style, "цвет подсказок построения").toBe(hint)
    }
    const { extra } = rulerOps(walls, wallReading(walls[0]), "mm", VIEW, { dimensions: dims })
    const colored = [...strokes(extra).map((s) => s.style), ...extra.flatMap((o) => (o.kind === "text" ? [o.style] : []))].filter((s) => !isWhiteish(s))
    for (const style of colored) {
      expect(TAKEN).not.toContain(style.trim().toLowerCase())
      const rgb = parseColor(style)
      expect(rgb, style).not.toBeNull()
      if (rgb) expect(contrastOnWhite(rgb)).toBeGreaterThanOrEqual(3)
    }
  })

  it("RND-ANG-ROUND-1: углы подписаны в целых градусах", () => {
    const { extra } = rulerOps(
      sceneR(),
      anglesReading([
        angle({ x: 50, y: 50 }, { x: 1, y: 0 }, 90),
        angle({ x: 150, y: 50 }, { x: 1, y: 0 }, 270),
        angle({ x: 250, y: 50 }, { x: 1, y: 0 }, 112.5),
        angle({ x: 350, y: 50 }, { x: 1, y: 0 }, 67.5),
        angle({ x: 50, y: 250 }, { x: 1, y: 0 }, 180.6),
      ]),
    )
    expect(texts(extra).sort()).toEqual(["113°", "181°", "270°", "68°", "90°"].sort())
    for (const t of ["113°", "181°", "270°", "68°", "90°"]) expectBacked(extra, t)
  })
  for (const sweepDeg of [270, -270]) {
    it(`RND-ARC-1: дуга по знаковому сектору ${sweepDeg}°, подпись на биссектрисе`, () => {
      const a = angle({ x: 40, y: 40 }, { x: 1, y: 0 }, sweepDeg)
      const { extra } = rulerOps(sceneR(), anglesReading([a]))
      const c = screen(a.at)
      const arcs = arcsOf(extra).filter((r) => near(r.center, c, 0.5))
      expect(arcs).toHaveLength(1)
      const got = normSector(arcs[0].start, arcs[0].sweep)
      const want = normSector(Math.atan2(a.startDir.y, a.startDir.x), (sweepDeg * Math.PI) / 180)
      expect(got.sweep).toBeCloseTo(want.sweep, 6)
      expect(angleDiff(got.start, want.start)).toBeLessThanOrEqual(1e-6)
      const label = extra.find((o): o is Extract<Op, { kind: "text" }> => o.kind === "text" && o.text === "270°")
      expect(label).toBeDefined()
      if (!label) return
      const bis = rot(a.startDir, sweepDeg / 2)
      expect(angleDiff(Math.atan2(label.at.y - c.y, label.at.x - c.x), Math.atan2(bis.y, bis.x))).toBeLessThanOrEqual(0.1)
      expect(Math.hypot(label.at.x - c.x, label.at.y - c.y)).toBeGreaterThan(arcs[0].r)
    })
  }

  it("RND-NORAY-1: у угла линейки нет луча отсчёта из вершины", () => {
    const a = angle({ x: 40, y: 40 }, { x: 1, y: 0 }, 270)
    const { extra } = rulerOps(sceneR(), anglesReading([a]))
    const c = screen(a.at)
    expect(arcsOf(extra).filter((r) => near(r.center, c, 0.5)), "дуга угла нарисована").toHaveLength(1)
    const rays = strokes(extra).flatMap((s) => s.subpaths).filter((sp) => sp.length >= 2 && sp.some((p) => near(p, c, 0.5)))
    expect(rays).toEqual([])
  })

  it("RND-ZOOM-1: толщины, радиус дуг и шрифт постоянны в экранных пикселях", () => {
    const walls = sceneR()
    const ruler: Space = { ...SPANS, angles: R_ANGLES }
    const measure = (zoom: number): { widths: number[]; radii: number[]; fonts: number[] } => {
      const view: View = { zoom, pan: { x: -50, y: -50 } }
      const { extra } = rulerOps(walls, ruler, "mm", view)
      const uniq = (xs: number[]): number[] => [...new Set(xs.map((x) => Math.round(x * 1000) / 1000))].sort((p, q) => p - q)
      return {
        widths: uniq(strokes(extra).map((s) => s.widthPx)),
        radii: uniq(arcsOf(extra).map((r) => r.r)),
        fonts: uniq(extra.flatMap((o) => (o.kind === "text" ? [o.fontPx] : []))),
      }
    }
    const ref = measure(1)
    expect(ref.radii.length).toBeGreaterThan(0)
    expect(ref.widths.length).toBeGreaterThan(0)
    expect(ref.fonts.length).toBeGreaterThan(0)
    expect(measure(0.5)).toEqual(ref)
    expect(measure(4)).toEqual(ref)
  })

  it("RND-WALL-ZOOM-1: замер стены — та же толщина линии и шрифт при любом зуме", () => {
    const walls = sceneR()
    const of = (zoom: number): string => {
      const { extra } = rulerOps(walls, wallReading(walls[0]), "mm", { zoom, pan: { x: -50, y: -50 } })
      expect(strokes(extra).length, "линия замера нарисована").toBeGreaterThan(0)
      expect(texts(extra), "число замера нарисовано").toEqual(["4200"])
      return JSON.stringify({
        w: [...new Set(strokes(extra).map((s) => Math.round(s.widthPx * 1000)))].sort(),
        f: extra.flatMap((o) => (o.kind === "text" ? [o.fontPx] : [])),
      })
    }
    expect(of(0.5)).toBe(of(1))
    expect(of(4)).toBe(of(1))
  })

  it("RND-ORDER-1: замеры рисуются поверх заливки, стен, подписи площади и размеров", () => {
    const walls = sceneR()
    const ruler: Space = { ...SPANS, angles: R_ANGLES }
    const { extra, prefix, suffix, baseLen } = rulerOps(walls, ruler, "mm", VIEW, { dimensions: [dimensionOnTopWall(walls)] })
    expect(extra.length).toBeGreaterThan(0)
    expect(prefix).toBe(baseLen)
    expect(suffix).toBe(0)
  })

  it("RND-REG-1: угол построения прежний — луч отсчёта и кратчайший сектор", () => {
    const at = { x: 100, y: 100 }
    const to = { x: Math.SQRT1_2, y: Math.SQRT1_2 }
    const ops = draw([], "mm", VIEW, { angle: { at, from: { x: 1, y: 0 }, to, deg: 45 } })
    const c = screen(at)
    const arcs = arcsOf(ops).filter((r) => near(r.center, c, 0.5))
    expect(arcs).toHaveLength(1)
    expect(Math.abs(arcs[0].sweep)).toBeCloseTo(Math.PI / 4, 6)
    const ray = strokes(ops)
      .flatMap((s) => s.subpaths)
      .filter((sp) => sp.length >= 2 && near(sp[0], c, 0.5))
    expect(ray.length).toBeGreaterThan(0)
    const end = ray[0][ray[0].length - 1]
    expect(Math.hypot(end.x - c.x, end.y - c.y)).toBeGreaterThan(arcs[0].r)
    expect(Math.abs(end.y - c.y)).toBeLessThanOrEqual(0.5)
    expect(texts(ops)).toContain("45°")
  })

  it("RND-NONE-1: ruler: null — то же, что без опции", () => {
    const walls = sceneR()
    const without = draw(walls, "mm", VIEW, {})
    const withNull = draw(walls, "mm", VIEW, { ruler: null })
    expect(extraOps(without, withNull).extra).toEqual([])
    expect(withNull).toHaveLength(without.length)
  })

  it("RND-PDF-1: рисование с PDF-метриками без опции ruler не содержит замеров", () => {
    const walls = sceneR()
    const pdfOpts: RenderOptions = { grid: false, metrics: PDF_METRICS }
    const base = draw(walls, "mm", VIEW, pdfOpts)
    expect(texts(base).filter((t) => /^\d+(,\d+)?$/.test(t) || t.endsWith("°"))).toEqual([])
  })
})
