import { describe, expect, it } from "vitest"
import { drawDemolitionScene } from "../demolition/demolition-render"
import { VIEW, clips, insidePolygon, recorder, sameSegment, segments, strokes, texts, toScreen } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import { SCREEN_METRICS, drawScene } from "../render"
import type { RenderOptions } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Battery, Dimension, Point, Unit, Wall } from "../types"
import { bat, sceneF, sceneR, windowAt } from "./battery.test-utils"

// change add-battery: отображение батареи, числа выделенной батареи, красная область сноса на плане «Демонтаж»
// (spec battery «Отображение батареи», «Числа выделенной батареи»; demolition-plan «Снос батареи»; design D8, D10; test-plan B-RND-*).
// Ожидания — по геометрии сцены: стена W (0,0)-(500,0) t20, батарея X [100,170]×[13,23]; вид VIEW (масштаб 1, 2 px на см).

const { W } = sceneF()
const X = bat("W", "a", 100)
const INK = LIGHT_PALETTE.ink
const MUTED = LIGHT_PALETTE.muted
const RED = "#d32f2f"

function draw(walls: Wall[], opts: RenderOptions, unit: Unit = "cm"): Op[] {
  const { ctx, ops } = recorder()
  drawScene(ctx, 1600, 1200, walls, null, unit, VIEW, [], { grid: false, ...opts })
  return ops
}

const screenSides = (corners: Point[]): [Point, Point][] => corners.map((p, i) => [toScreen(p), toScreen(corners[(i + 1) % corners.length])])
const SIDES = screenSides([
  { x: 100, y: 13 },
  { x: 170, y: 13 },
  { x: 170, y: 23 },
  { x: 100, y: 23 },
])
const contourSegments = (ops: Op[]): [Point, Point][] =>
  strokes(ops).filter((o) => o.strokeStyle === INK && o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments)
const thinInk = (ops: Op[]): [Point, Point][] =>
  strokes(ops).filter((o) => o.strokeStyle === INK && o.lineWidth < SCREEN_METRICS.contourPx).flatMap(segments)
const hasSide = (all: [Point, Point][], p: Point, q: Point): boolean => all.some((s) => sameSegment(s, p, q, 0.5))

describe("прямоугольник и секции", () => {
  it("B-RND-1: контур батареи — четыре стороны прямоугольника [100,170]×[13,23] линией контура цвета ink", () => {
    const sides = contourSegments(draw([W], { batteries: [X] }))
    for (const [p, q] of SIDES) expect(hasSide(sides, p, q)).toBe(true)
  })

  it("B-RND-1b: секции: тонкие линии поперёк длины, параллельные торцам; число секций целое, около 7 (шаг ≈ 10 см)", () => {
    const ops = draw([W], { batteries: [X] })
    const sections = thinInk(ops).filter(([p, q]) => Math.abs(p.x - q.x) < 0.5 && p.x > toScreen({ x: 100, y: 0 }).x + 0.5 && p.x < toScreen({ x: 170, y: 0 }).x - 0.5)
    expect(sections.length).toBeGreaterThanOrEqual(6)
    expect(sections.length).toBeLessThanOrEqual(7)
  })

  it("B-RND-1c: каждая секция идёт через всю толщину: от y = 13 до y = 23 (20 px)", () => {
    const ops = draw([W], { batteries: [X] })
    const sections = thinInk(ops).filter(([p, q]) => Math.abs(p.x - q.x) < 0.5 && p.x > toScreen({ x: 101, y: 0 }).x && p.x < toScreen({ x: 169, y: 0 }).x)
    expect(sections.length).toBeGreaterThan(0)
    for (const [p, q] of sections) {
      expect(Math.min(p.y, q.y)).toBeCloseTo(toScreen({ x: 0, y: 13 }).y, 0)
      expect(Math.max(p.y, q.y)).toBeCloseTo(toScreen({ x: 0, y: 23 }).y, 0)
    }
  })

  it("B-RND-1d: короткая батарея 5 см: контур нарисован (число секций границами не проверяется)", () => {
    const tiny = bat("W", "a", 100, { lengthCm: 5 })
    const ops = draw([W], { batteries: [tiny] })
    expect(hasSide(contourSegments(ops), toScreen({ x: 100, y: 13 }), toScreen({ x: 105, y: 13 }))).toBe(true)
  })

  it("B-RND-2: отступ пуст: нигде нет заливки, покрывающей точку (135; 11,5) между гранью стены и задней стороной батареи", () => {
    const gap = toScreen({ x: 135, y: 11.5 })
    const ops = draw([W], { batteries: [X] })
    expect(hasSide(contourSegments(ops), toScreen({ x: 100, y: 13 }), toScreen({ x: 170, y: 13 }))).toBe(true) // батарея нарисована
    const fills = ops.filter((o) => o.kind === "fill")
    expect(fills.some((f) => f.kind === "fill" && f.subpaths.some((sp) => insidePolygon(gap, sp)))).toBe(false)
  })

  it("B-RND-3: батарея на грани −1: прямоугольник [100,170]×[−23,−13]", () => {
    const outer = bat("W", "a", 100, { face: -1 })
    const sides = contourSegments(draw([W], { batteries: [outer] }))
    expect(hasSide(sides, toScreen({ x: 100, y: -23 }), toScreen({ x: 170, y: -23 }))).toBe(true)
    expect(hasSide(sides, toScreen({ x: 100, y: -13 }), toScreen({ x: 170, y: -13 }))).toBe(true)
  })

  it("B-RND-4: без батарей в опциях ничего лишнего: нет контурных линий в зоне [13,23]", () => {
    const ops = draw([W], {})
    expect(hasSide(contourSegments(ops), toScreen({ x: 100, y: 13 }), toScreen({ x: 170, y: 13 }))).toBe(false)
  })
})

describe("батарея на отсутствующей стене", () => {
  it("B-GEO-5: опорной стены нет — батарея не рисуется и отрисовка не падает", () => {
    const ghost = bat("Z", "a", 100, { id: "z" })
    const ops = draw([W], { batteries: [ghost] })
    expect(hasSide(contourSegments(ops), toScreen({ x: 100, y: 13 }), toScreen({ x: 170, y: 13 }))).toBe(false)
    expect(hasSide(contourSegments(ops), toScreen({ x: 100, y: -13 }), toScreen({ x: 170, y: -13 }))).toBe(false)
  })
})

describe("числа выделенной батареи", () => {
  // комната: видимая грань W идёт от x = 10 до x = 490, поэтому числа батареи [100,170] — 90 и 320
  const room = (): Wall[] => sceneR().walls
  const labels = (ops: Op[]): string[] => texts(ops).map((t) => t.text)
  const ACTUAL = ["90", "320", "70"]

  it("B-RND-5: одна выделенная батарея: числа 90, 320, 70, 10, 3 (единица — см)", () => {
    const shown = labels(draw(room(), { batteries: [X], selectedBatteries: [X] }))
    for (const n of [...ACTUAL, "10", "3"]) expect(shown).toContain(n)
  })

  it("B-RND-5b: единица мм: 900, 3200, 700, 100, 30", () => {
    const shown = labels(draw(room(), { batteries: [X], selectedBatteries: [X] }, "mm"))
    for (const n of ["900", "3200", "700", "100", "30"]) expect(shown).toContain(n)
  })

  it("B-RND-5c: единица м: числа с запятой — 0,9; 3,2; 0,7", () => {
    const shown = labels(draw(room(), { batteries: [X], selectedBatteries: [X] }, "m"))
    for (const n of ["0,9", "3,2", "0,7"]) expect(shown).toContain(n)
  })

  it("B-RND-5d: свободная стена: видимая грань от x = 0 до x = 500, числа 100 и 330", () => {
    const shown = labels(draw([W], { batteries: [X], selectedBatteries: [X] }))
    for (const n of ["100", "330", "70"]) expect(shown).toContain(n)
  })

  it("B-RND-6: невыделенная батарея нарисована, но настоящих чисел (90, 320, 70) не показывает — тот же сценарий, что B-RND-5", () => {
    const ops = draw(room(), { batteries: [X] })
    expect(hasSide(contourSegments(ops), toScreen({ x: 100, y: 13 }), toScreen({ x: 170, y: 13 }))).toBe(true)
    for (const n of ACTUAL) expect(labels(ops)).not.toContain(n)
  })

  it("B-RND-6b: мультивыделение двух батарей — обе нарисованы, чисел нет (при одной выделенной они были бы — B-RND-5)", () => {
    const Y: Battery = bat("W", "a", 300, { id: "y" }) // числа Y были бы 290 / 120 / 70
    const ops = draw(room(), { batteries: [X, Y], selectedBatteries: [X, Y] })
    const sides = contourSegments(ops)
    expect(hasSide(sides, toScreen({ x: 100, y: 13 }), toScreen({ x: 170, y: 13 }))).toBe(true)
    expect(hasSide(sides, toScreen({ x: 300, y: 13 }), toScreen({ x: 370, y: 13 }))).toBe(true)
    for (const n of [...ACTUAL, "290", "120"]) expect(labels(ops)).not.toContain(n)
  })

  it("B-RND-6c: выделена одна из двух батарей — числа только у неё (X: 90/320, не Y: 290/120)", () => {
    const Y: Battery = bat("W", "a", 300, { id: "y" })
    const shown = labels(draw(room(), { batteries: [X, Y], selectedBatteries: [X] }))
    expect(shown).toContain("90")
    expect(shown).not.toContain("290")
  })
})

describe("размер с углом батареи на холсте", () => {
  const WA = windowAt("W", "a", 200)
  const link: Dimension = { from: { kind: "corner", batteryId: "b0", end: "b", side: "front" }, to: { kind: "jamb", elementId: "w0", jamb: "a", face: 1 }, offset: 20 }

  it("B-DIM-10: число на холсте — проекция на ось стены (30), а не прямое расстояние √(30² + 13²) ≈ 32,7", () => {
    const shown = texts(draw([W], { batteries: [X], doorways: [WA], dimensions: [link] })).map((t) => t.text)
    expect(shown.filter((s) => s === "30")).toHaveLength(1)
    expect(shown.some((s) => /^32[.,]/.test(s))).toBe(false)
  })

  it("B-DIM-10b: батареи нет — размер к её углу не рисуется (числа 30 нет)", () => {
    const shown = texts(draw([W], { batteries: [], doorways: [WA], dimensions: [link] })).map((t) => t.text)
    expect(shown).not.toContain("30")
  })
})

describe("план «Демонтаж»", () => {
  const samePolygon = (a: Point[], b: Point[], tol = 1e-6): boolean => {
    const key = (p: Point): string => Math.round(p.x / tol) + ":" + Math.round(p.y / tol)
    const ka = new Set(a.map(key))
    return ka.size === new Set(b.map(key)).size && b.every((p) => ka.has(key(p)))
  }
  const RECT = [
    { x: 100, y: 13 },
    { x: 170, y: 13 },
    { x: 170, y: 23 },
    { x: 100, y: 23 },
  ].map((p) => toScreen(p))

  function demolition(demolished: string[], batteries: Battery[] = [X]): Op[] {
    const { ctx, ops } = recorder()
    drawDemolitionScene(
      ctx,
      800,
      600,
      { walls: [W], doorways: [], marks: [], batteries, demolishedBatteryIds: new Set(demolished) },
      "cm",
      VIEW,
      { color: RED, grid: false, palette: LIGHT_PALETTE },
    )
    return ops
  }

  it("B-RND-7: непомеченная батарея — серая подложка: контур цветом muted, красного нет", () => {
    const ops = demolition([])
    const gray = strokes(ops).filter((o) => o.strokeStyle === MUTED).flatMap(segments)
    for (const [p, q] of SIDES) expect(hasSide(gray, p, q)).toBe(true)
    expect(strokes(ops).some((o) => o.strokeStyle === RED)).toBe(false)
  })

  it("B-RND-8: помеченная батарея: красный контур прямоугольника", () => {
    const red = strokes(demolition(["b0"])).filter((o) => o.strokeStyle === RED).flatMap(segments)
    for (const [p, q] of SIDES) expect(hasSide(red, p, q)).toBe(true)
  })

  it("B-RND-8b: красная штриховка 135° (dx·dy > 0, |dx| = |dy|) толщиной hatchPx внутри клипа по прямоугольнику батареи (образец RN-02)", () => {
    const ops = demolition(["b0"])
    const lines = strokes(ops)
      .filter((o) => o.strokeStyle === RED && Math.abs(o.lineWidth - SCREEN_METRICS.hatchPx) < 1e-9)
      .flatMap(segments)
      .filter(([p, q]) => Math.abs(q.x - p.x) > 1e-6 && Math.abs(q.y - p.y) > 1e-6)
    expect(lines.length).toBeGreaterThan(2)
    for (const [p, q] of lines) {
      const dx = q.x - p.x
      const dy = q.y - p.y
      expect(dx * dy).toBeGreaterThan(0)
      expect(Math.abs(Math.abs(dx) - Math.abs(dy))).toBeLessThan(1e-6)
    }
    expect(clips(ops).some((c) => c.subpaths.some((sp) => samePolygon(sp, RECT)))).toBe(true)
  })

  it("B-RND-8c: помечена одна из двух батарей: красный контур и клип только у неё", () => {
    const Y = bat("W", "a", 300, { id: "y" })
    const ops = demolition(["y"], [X, Y])
    const red = strokes(ops).filter((o) => o.strokeStyle === RED).flatMap(segments)
    expect(hasSide(red, toScreen({ x: 300, y: 13 }), toScreen({ x: 370, y: 13 }))).toBe(true)
    expect(hasSide(red, toScreen({ x: 100, y: 13 }), toScreen({ x: 170, y: 13 }))).toBe(false)
    expect(clips(ops).some((c) => c.subpaths.some((sp) => samePolygon(sp, RECT)))).toBe(false)
  })
})
