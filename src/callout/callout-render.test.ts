import { describe, expect, it } from "vitest"
import { drawDemolitionScene } from "../demolition/demolition-render"
import { sceneF2, jambDimension, jambPoint } from "../dimension-anchor.test-utils"
import { VIEW, recorder, strokes, texts, toScreen } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import { PDF_METRICS, SCREEN_METRICS, drawScene } from "../render"
import type { RenderMetrics, RenderOptions } from "../render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Callout, Point, View, Wall } from "../types"
import { colorRecorder } from "../doorway/window.test-utils"
import { calloutLayout } from "./callout-layout"
import { A, B, callout, expectedTextPoint, markerRecorder, measure } from "./callout.test-utils"

// change add-callout: отрисовка выносок на холсте и на плане «Демонтаж» (spec callout «Отображение выноски», «Выделение, перенос и правка
// выноски», «Удаление выноски ластиком», «Выноска не участвует в привязках и расчётах»; demolition-plan «Выноски на плане «Демонтаж»»;
// design D7; test-plan C-RND-*, C-INV-2, C-INV-3).

const INK = LIGHT_PALETTE.ink
const PAPER = LIGHT_PALETTE.paper
const lineTexts = (c: Callout): string[] => c.text.split("\n")

function draw(opts: RenderOptions, view: View = VIEW, walls: Wall[] = [], metrics: RenderMetrics = SCREEN_METRICS): Op[] {
  const { ctx, ops } = recorder()
  drawScene(ctx, 1600, 1200, walls, null, "cm", view, [], { grid: false, metrics, ...opts })
  return ops
}

// вершины заливки-стрелки: треугольник с остриём в точке tip
const arrowheads = (ops: Op[], tip: Point): Point[][] =>
  ops
    .filter((o): o is Extract<Op, { kind: "fill" }> => o.kind === "fill" && !o.hasArc)
    .flatMap((o) => o.subpaths)
    .filter((sp) => sp.length >= 3 && sp.some((p) => Math.hypot(p.x - tip.x, p.y - tip.y) < 0.5))

describe("текст выноски", () => {
  it("C-RND-1: размер шрифта выноски равен размеру числа размера на экране", () => {
    const { walls, elements } = sceneF2()
    const dim = jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1))
    const dimOps = draw({ dimensions: [dim], doorways: elements }, VIEW, walls)
    const number = texts(dimOps).find((t) => /^80/.test(t.text))
    expect(number, "число размера 80").toBeDefined()
    const own = texts(draw({ callouts: [A()] })).filter((t) => lineTexts(A()).includes(t.text))
    expect(own.length).toBeGreaterThan(0)
    for (const t of own) expect(t.font).toBe(number?.font)
    for (const t of own) expect(t.font).toBe(`${SCREEN_METRICS.labelPx}px ${SCREEN_METRICS.font}`)
  })

  it("C-RND-1b: в метриках PDF — шрифт PDF того же размера, что число размера", () => {
    const { walls, elements } = sceneF2()
    const dim = jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1))
    const number = texts(draw({ dimensions: [dim], doorways: elements }, VIEW, walls, PDF_METRICS)).find((t) => /^80/.test(t.text))
    const own = texts(draw({ callouts: [A()] }, VIEW, [], PDF_METRICS)).filter((t) => lineTexts(A()).includes(t.text))
    expect(own.length).toBeGreaterThan(0)
    for (const t of own) expect(t.font).toBe(number?.font)
    for (const t of own) expect(t.font).toBe(`${PDF_METRICS.labelPx}px ${PDF_METRICS.font}`)
  })

  it("C-RND-2: шрифт прямой — без курсива и наклона", () => {
    for (const t of texts(draw({ callouts: [A(), B()] })).filter((x) => [...lineTexts(A()), "Тест"].includes(x.text))) {
      expect(t.font).not.toMatch(/italic|oblique/i)
    }
  })

  it("C-RND-2b: непустые строки выведены в порядке ввода, каждая отдельной операцией, сверху вниз", () => {
    const c = callout("c", { x: 300, y: 100 }, { x: 100, y: 100 }, "первая\n\nтретья")
    const own = texts(draw({ callouts: [c] })).filter((t) => t.text !== "")
    expect(own.map((t) => t.text)).toEqual(["первая", "третья"])
    expect(own[0].at.y).toBeLessThan(own[1].at.y)
  })

  function textCallsOf(c: Callout, metrics: RenderMetrics = SCREEN_METRICS): { calls: ReturnType<typeof markerRecorder>["textCalls"]; layout: ReturnType<typeof calloutLayout> } {
    const rec = markerRecorder()
    drawScene(rec.ctx, 1600, 1200, [], null, "cm", VIEW, [], { grid: false, metrics, callouts: [c] })
    const layout = calloutLayout(c, VIEW, metrics, measure)
    return { calls: rec.textCalls.filter((t) => lineTexts(c).includes(t.text)), layout }
  }

  it("C-RND-2c: каждая строка выведена ровно в раскладочной позиции — при любом выборе textAlign и textBaseline (A, вправо)", () => {
    const { calls, layout } = textCallsOf(A())
    expect(calls.map((t) => t.text)).toEqual(lineTexts(A()))
    calls.forEach((t, i) => {
      const want = expectedTextPoint(t, layout.lines[i], measure(layout.lines[i].text), SCREEN_METRICS.labelPx)
      expect(t.x).toBeCloseTo(want.x, 6)
      expect(t.y).toBeCloseTo(want.y, 6)
    })
  })

  it("C-RND-2d: то же для выноски с выравниванием влево и трёх строк разной длины (B-подобная)", () => {
    const c = callout("c", { x: 50, y: 100 }, { x: 150, y: 200 }, "к\nочень длинная вторая\nсредняя")
    const { calls, layout } = textCallsOf(c)
    expect(layout.align).toBe("left")
    expect(calls.map((t) => t.text)).toEqual(["к", "очень длинная вторая", "средняя"])
    calls.forEach((t, i) => {
      const want = expectedTextPoint(t, layout.lines[i], measure(layout.lines[i].text), SCREEN_METRICS.labelPx)
      expect(t.x).toBeCloseTo(want.x, 6)
      expect(t.y).toBeCloseTo(want.y, 6)
    })
  })

  it("C-RND-2e: в метриках PDF положение строк тоже совпадает с раскладкой этих метрик", () => {
    const { calls, layout } = textCallsOf(A(), PDF_METRICS)
    calls.forEach((t, i) => {
      const want = expectedTextPoint(t, layout.lines[i], measure(layout.lines[i].text), PDF_METRICS.labelPx)
      expect(t.x).toBeCloseTo(want.x, 6)
      expect(t.y).toBeCloseTo(want.y, 6)
    })
  })

  it("C-RND-2f: отрисовка выносок не оставляет изменённым состояние холста (шрифт, цвета, толщина, выравнивание)", () => {
    const stateAfter = (list: readonly Callout[]) => {
      const rec = markerRecorder()
      drawScene(rec.ctx, 1600, 1200, [], null, "cm", VIEW, [], { grid: false, callouts: list, selectedCallout: list[0]?.id ?? null })
      return rec.state()
    }
    expect(stateAfter([A(), B()])).toEqual(stateAfter([]))
  })

  it("C-RND-5: под текстом подложка цвета фона, нарисованная раньше текста и покрывающая все строки", () => {
    const l = calloutLayout(A(), VIEW, SCREEN_METRICS, measure)
    const ops = draw({ callouts: [A()] })
    const firstText = ops.findIndex((o) => o.kind === "text" && lineTexts(A()).includes(o.text))
    expect(firstText).toBeGreaterThan(-1)
    const covers = ops.slice(0, firstText).some(
      (o) =>
        o.kind === "fill" &&
        o.fillStyle === PAPER &&
        o.subpaths.some((sp) => {
          const xs = sp.map((p) => p.x)
          const ys = sp.map((p) => p.y)
          return Math.min(...xs) <= l.box.x + 1 && Math.max(...xs) >= l.box.x + l.box.w - 1 && Math.min(...ys) <= l.box.y + 1 && Math.max(...ys) >= l.box.y + l.box.h - 1
        }),
    )
    expect(covers).toBe(true)
  })
})

describe("линия и стрелка", () => {
  it("C-RND-4: на конце линии нарисована стрелка того же размера, что у размерных линий; остриё — в точке стрелки", () => {
    const tip = toScreen(A().target)
    const heads = arrowheads(draw({ callouts: [A()] }), tip)
    expect(heads.length).toBeGreaterThan(0)
    const head = heads[0]
    const others = head.filter((p) => Math.hypot(p.x - tip.x, p.y - tip.y) >= 0.5)
    expect(others).toHaveLength(2)
    const side = Math.hypot(SCREEN_METRICS.dimArrowPx, SCREEN_METRICS.dimArrowPx / 3)
    for (const p of others) expect(Math.hypot(p.x - tip.x, p.y - tip.y)).toBeCloseTo(side, 3)
  })

  it("C-RND-4b: стрелка направлена к точке стрелки: основание — со стороны текста", () => {
    const tip = toScreen(A().target)
    const head = arrowheads(draw({ callouts: [A()] }), tip)[0]
    const base = head.filter((p) => Math.hypot(p.x - tip.x, p.y - tip.y) >= 0.5)
    const mid = { x: (base[0].x + base[1].x) / 2, y: (base[0].y + base[1].y) / 2 }
    expect(mid.x).toBeLessThan(tip.x) // текст левее точки стрелки у A
    expect(Math.hypot(mid.x - tip.x, mid.y - tip.y)).toBeCloseTo(SCREEN_METRICS.dimArrowPx, 3)
  })

  it("C-RND-4d: стрелка наклонной выноски — равнобедренный треугольник той же формы, основание на расстоянии dimArrowPx вдоль линии к тексту", () => {
    const c = B() // линия идёт от текста (500, 600) к стрелке (300, 400) — по диагонали
    const l = calloutLayout(c, VIEW, SCREEN_METRICS, measure)
    const tip = toScreen(c.target)
    const head = arrowheads(draw({ callouts: [c] }), tip)[0]
    expect(head).toBeDefined()
    const base = head.filter((p) => Math.hypot(p.x - tip.x, p.y - tip.y) >= 0.5)
    expect(base).toHaveLength(2)
    const side = Math.hypot(SCREEN_METRICS.dimArrowPx, SCREEN_METRICS.dimArrowPx / 3)
    for (const p of base) expect(Math.hypot(p.x - tip.x, p.y - tip.y)).toBeCloseTo(side, 3)
    const mid = { x: (base[0].x + base[1].x) / 2, y: (base[0].y + base[1].y) / 2 }
    expect(Math.hypot(mid.x - tip.x, mid.y - tip.y)).toBeCloseTo(SCREEN_METRICS.dimArrowPx, 3)
    // ось стрелки — вдоль линии выноски: середина основания лежит на отрезке от остриё к началу линии
    const dx = l.lineStart.x - tip.x
    const dy = l.lineStart.y - tip.y
    const len = Math.hypot(dx, dy)
    expect((mid.x - tip.x) / SCREEN_METRICS.dimArrowPx).toBeCloseTo(dx / len, 3)
    expect((mid.y - tip.y) / SCREEN_METRICS.dimArrowPx).toBeCloseTo(dy / len, 3)
    // основание перпендикулярно оси
    const bx = base[1].x - base[0].x
    const by = base[1].y - base[0].y
    expect(bx * dx + by * dy).toBeCloseTo(0, 3)
  })

  it("C-RND-4e: толщина линии выноски — как у размерной линии (hatchPx) на экране и в PDF", () => {
    for (const metrics of [SCREEN_METRICS, PDF_METRICS]) {
      const l = calloutLayout(A(), VIEW, metrics, measure)
      const ops = draw({ callouts: [A()] }, VIEW, [], metrics)
      const near = (p: Point, q: Point): boolean => Math.hypot(p.x - q.x, p.y - q.y) < 1.5
      const line = strokes(ops).find((s) => s.subpaths.some((sp) => sp.length >= 2 && sp.some((p) => near(p, l.lineStart)) && sp.some((p) => near(p, l.arrowTip))))
      expect(line, "линия выноски").toBeDefined()
      expect(line?.lineWidth).toBe(metrics.hatchPx)
    }
  })

  it("C-RND-3: зум не меняет шрифт, размер стрелки и толщину линии; положение остриё следует за чертежом", () => {
    const widthsAt = (zoom: number): number[] =>
      [...new Set(strokes(draw({ callouts: [A()] }, { zoom, pan: { x: -100, y: -100 } })).map((s) => s.lineWidth))].sort((a, b) => a - b)
    expect(widthsAt(0.5)).toEqual(widthsAt(1))
    expect(widthsAt(4)).toEqual(widthsAt(1))
    for (const zoom of [0.5, 1, 4]) {
      const view: View = { zoom, pan: { x: -100, y: -100 } }
      const ops = draw({ callouts: [A()] }, view)
      const tip = toScreen(A().target, view)
      const head = arrowheads(ops, tip)[0]
      expect(head, `zoom ${zoom}`).toBeDefined()
      const others = head.filter((p) => Math.hypot(p.x - tip.x, p.y - tip.y) >= 0.5)
      for (const p of others) expect(Math.hypot(p.x - tip.x, p.y - tip.y)).toBeCloseTo(Math.hypot(9, 3), 3)
      for (const t of texts(ops).filter((x) => lineTexts(A()).includes(x.text))) expect(t.font).toBe(`${SCREEN_METRICS.labelPx}px ${SCREEN_METRICS.font}`)
      const widths = new Set(strokes(ops).filter((s) => s.strokeStyle === INK).map((s) => s.lineWidth))
      expect([...widths].every((w) => w <= SCREEN_METRICS.contourPx)).toBe(true)
    }
  })

  it("C-RND-4c: линия проведена тонкой линией от начала у текста до остриё стрелки", () => {
    const l = calloutLayout(A(), VIEW, SCREEN_METRICS, measure)
    const tip = toScreen(A().target)
    const ops = draw({ callouts: [A()] })
    const hasLine = strokes(ops).some(
      (s) =>
        s.lineWidth < SCREEN_METRICS.contourPx &&
        s.subpaths.some((sp) => sp.length >= 2 && sp.some((p) => Math.hypot(p.x - l.lineStart.x, p.y - l.lineStart.y) < 1.5) && sp.some((p) => Math.hypot(p.x - tip.x, p.y - tip.y) < 1.5 + SCREEN_METRICS.dimArrowPx)),
    )
    expect(hasLine).toBe(true)
  })
})

describe("тема", () => {
  it("C-RND-6: цвет текста и линии берётся из палитры темы: ink светлой и тёмной схемы", () => {
    for (const palette of [LIGHT_PALETTE, DARK_PALETTE]) {
      const { ctx, ops } = recorder()
      drawScene(ctx, 1600, 1200, [], null, "cm", VIEW, [], { grid: false, palette, callouts: [A()] })
      expect(strokes(ops).some((s) => s.strokeStyle === palette.ink)).toBe(true)
      const head = ops.find((o) => o.kind === "fill" && o.fillStyle === palette.ink && !o.hasArc)
      expect(head).toBeDefined()
    }
  })
})

describe("цвет текста", () => {
  it("C-RND-6b: текст выноски — цветом ink палитры темы (светлой и тёмной), не цветом фона и не приглушённым", () => {
    for (const palette of [LIGHT_PALETTE, DARK_PALETTE]) {
      const { ctx, texts: colored } = colorRecorder()
      drawScene(ctx, 1600, 1200, [], null, "cm", VIEW, [], { grid: false, palette, callouts: [A()] })
      const own = colored.filter((t) => lineTexts(A()).includes(t.text))
      expect(own.map((t) => t.text)).toEqual(lineTexts(A()))
      for (const t of own) expect(t.fillStyle).toBe(palette.ink)
      expect(palette.ink).not.toBe(palette.muted)
      expect(palette.ink).not.toBe(palette.paper)
    }
  })
})

describe("выделение и подсветка ластика", () => {
  const strip = (ops: Op[]): string[] => ops.map((o) => JSON.stringify(o))

  // точки маркеров: центры дуг и углов прямоугольников плюс вершины операций, которых нет в обычной отрисовке
  function markerPoints(opts: RenderOptions, list: readonly Callout[], view: View = VIEW): Point[] {
    const plain = draw({ callouts: list }, view)
    const rec = markerRecorder()
    drawScene(rec.ctx, 1600, 1200, [], null, "cm", view, [], { grid: false, callouts: list, ...opts })
    const known = new Set(plain.map((o) => JSON.stringify(o)))
    const extraOps = rec.ops.filter((o) => !known.has(JSON.stringify(o)))
    const vertices = extraOps.flatMap((o) => (o.kind === "fill" || o.kind === "stroke" ? o.subpaths.flat() : []))
    return [...rec.shapes, ...vertices]
  }
  const near = (pts: Point[], p: Point, tol = 12): boolean => pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= tol)

  it("C-RND-7: выделенная выноска получает маркеры у точки стрелки и у точки текста; остальное рисуется так же", () => {
    const plain = draw({ callouts: [A()] })
    const selected = draw({ callouts: [A()], selectedCallout: "a" })
    expect(strip(selected).filter((s) => !strip(plain).includes(s)).length).toBeGreaterThanOrEqual(2)
    expect(texts(selected).map((t) => t.text)).toEqual(texts(plain).map((t) => t.text))
    const pts = markerPoints({ selectedCallout: "a" }, [A()])
    expect(near(pts, toScreen(A().target)), "маркер у точки стрелки").toBe(true)
    expect(near(pts, toScreen(A().at)), "маркер у точки текста").toBe(true)
  })

  it("C-RND-7d: маркеры стоят у точек и при другом зуме и сдвиге вида", () => {
    for (const view of [{ zoom: 2, pan: { x: 30, y: -40 } }, { zoom: 0.5, pan: { x: -300, y: 20 } }] as View[]) {
      const pts = markerPoints({ selectedCallout: "a" }, [A()], view)
      expect(near(pts, toScreen(A().target, view)), `target, zoom ${view.zoom}`).toBe(true)
      expect(near(pts, toScreen(A().at, view)), `at, zoom ${view.zoom}`).toBe(true)
    }
  })

  it("C-RND-7c: оба маркера — разные: у точки стрелки и у точки текста есть собственные, не один на двоих", () => {
    const pts = markerPoints({ selectedCallout: "a" }, [A()])
    const nearTip = pts.filter((p) => Math.hypot(p.x - toScreen(A().target).x, p.y - toScreen(A().target).y) <= 12)
    const nearText = pts.filter((p) => Math.hypot(p.x - toScreen(A().at).x, p.y - toScreen(A().at).y) <= 12)
    expect(nearTip.length).toBeGreaterThan(0)
    expect(nearText.length).toBeGreaterThan(0)
  })

  it("C-RND-8: без выделения или с идентификатором другой выноски маркеров нет", () => {
    const plain = draw({ callouts: [A(), B()] })
    expect(strip(draw({ callouts: [A(), B()], selectedCallout: null }))).toEqual(strip(plain))
    expect(strip(draw({ callouts: [A(), B()], selectedCallout: "нет такой" }))).toEqual(strip(plain))
  })

  it("C-RND-7b: выделена одна из двух — маркеры только у неё, у другой в точках маркеров ничего не появляется", () => {
    const list = [A(), B()]
    const ptsA = markerPoints({ selectedCallout: "a" }, list)
    const ptsB = markerPoints({ selectedCallout: "b" }, list)
    expect(near(ptsA, toScreen(A().target))).toBe(true)
    expect(near(ptsA, toScreen(A().at))).toBe(true)
    expect(near(ptsA, toScreen(B().target))).toBe(false)
    expect(near(ptsA, toScreen(B().at))).toBe(false)
    expect(near(ptsB, toScreen(B().target))).toBe(true)
    expect(near(ptsB, toScreen(B().at))).toBe(true)
    expect(near(ptsB, toScreen(A().target))).toBe(false)
    expect(near(ptsB, toScreen(A().at))).toBe(false)
  })

  it("C-RND-9: подсветка ластика — цветом подсветки, и только у указанной выноски", () => {
    const erase = LIGHT_PALETTE.erase
    const none = draw({ callouts: [A(), B()] })
    expect(strokes(none).some((s) => s.strokeStyle === erase)).toBe(false)
    const hot = draw({ callouts: [A(), B()], erasingCallout: "a" })
    expect(strokes(hot).some((s) => s.strokeStyle === erase)).toBe(true)
    const other = draw({ callouts: [A()], erasingCallout: "нет такой" })
    expect(strokes(other).some((s) => s.strokeStyle === erase)).toBe(false)
  })

  it("C-RND-10: подсветка и выделение не меняют текст выноски", () => {
    const base = texts(draw({ callouts: [A()] })).map((t) => t.text)
    expect(texts(draw({ callouts: [A()], erasingCallout: "a" })).map((t) => t.text)).toEqual(base)
  })
})

describe("выноски не влияют на остальной чертёж", () => {
  const room: Wall[] = [
    { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" },
    { id: "R", a: { x: 500, y: 0 }, b: { x: 500, y: 400 }, thicknessCm: 20, type: "brick" },
    { id: "B", a: { x: 500, y: 400 }, b: { x: 0, y: 400 }, thicknessCm: 20, type: "brick" },
    { id: "L", a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thicknessCm: 20, type: "brick" },
  ]
  const c = callout("c", { x: 250, y: 200 }, { x: 100, y: 300 }, "поверх помещения")

  it("C-INV-3: подпись площади помещения и заливка те же, что без выносок", () => {
    const without = draw({}, VIEW, room)
    const withCallout = draw({ callouts: [c] }, VIEW, room)
    const areaText = (ops: Op[]): string[] => texts(ops).filter((t) => / м²$| см²$/.test(t.text) || /\d/.test(t.text)).map((t) => t.text)
    expect(areaText(withCallout)).toEqual(areaText(without))
    // заливки чертежа (помещения, штриховка): без собственной заливки выноски — стрелки-треугольника
    const drawingFills = (ops: Op[]): string[] =>
      ops.filter((o): o is Extract<Op, { kind: "fill" }> => o.kind === "fill" && o.fillStyle !== PAPER && !o.subpaths.every((sp) => sp.length === 3)).map((o) => JSON.stringify(o))
    expect(drawingFills(withCallout)).toEqual(drawingFills(without))
  })

  it("C-INV-2: операции стен и размеров без выносок идут в том же порядке и в том же виде — выноски дорисовываются сверх", () => {
    const without = draw({}, VIEW, room).map((o) => JSON.stringify(o))
    const withCallout = draw({ callouts: [c] }, VIEW, room).map((o) => JSON.stringify(o))
    const rest = withCallout.filter((o) => without.includes(o))
    expect(rest).toEqual(without)
  })

  it("C-RND-12: без выносок и с пустым списком отрисовка одинакова", () => {
    const base = draw({}, VIEW, room).map((o) => JSON.stringify(o))
    expect(draw({ callouts: [] }, VIEW, room).map((o) => JSON.stringify(o))).toEqual(base)
  })
})

describe("план «Демонтаж»", () => {
  const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
  const RED = "#d32f2f"

  function demolition(extra: { callouts?: readonly Callout[]; selectedCalloutId?: string | null; erasingCalloutId?: string | null }, metrics?: RenderMetrics): Op[] {
    const { ctx, ops } = recorder()
    drawDemolitionScene(ctx, 800, 600, { walls: [W], doorways: [], marks: [], ...extra }, "cm", VIEW, { color: RED, grid: false, palette: LIGHT_PALETTE, ...(metrics ? { metrics } : null) })
    return ops
  }

  it("C-RND-11: выноски плана «Демонтаж» выводятся: строки, стрелка в точке стрелки", () => {
    const ops = demolition({ callouts: [A()] })
    expect(texts(ops).filter((t) => lineTexts(A()).includes(t.text)).map((t) => t.text)).toEqual(lineTexts(A()))
    expect(arrowheads(ops, toScreen(A().target)).length).toBeGreaterThan(0)
  })

  it("C-RND-11b: шрифт выноски на «Демонтаже» тот же, что на других планах", () => {
    const own = texts(demolition({ callouts: [A()] })).filter((t) => lineTexts(A()).includes(t.text))
    for (const t of own) expect(t.font).toBe(`${SCREEN_METRICS.labelPx}px ${SCREEN_METRICS.font}`)
  })

  it("C-RND-11c: выноска рисуется поверх подложки: её первая операция позже операций стены", () => {
    const ops = demolition({ callouts: [A()] })
    const firstCallout = ops.findIndex((o) => o.kind === "text" && lineTexts(A()).includes(o.text))
    const lastWallStroke = ops.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === "stroke" && o.lineWidth === SCREEN_METRICS.contourPx).map(({ i }) => i).pop() ?? -1
    expect(firstCallout).toBeGreaterThan(lastWallStroke)
  })

  it("C-RND-11d: выделение и подсветка ластика работают и здесь", () => {
    const plain = demolition({ callouts: [A()] }).map((o) => JSON.stringify(o))
    const selected = demolition({ callouts: [A()], selectedCalloutId: "a" }).map((o) => JSON.stringify(o))
    expect(selected.filter((s) => !plain.includes(s)).length).toBeGreaterThanOrEqual(2)
    expect(strokes(demolition({ callouts: [A()], erasingCalloutId: "a" })).some((s) => s.strokeStyle === LIGHT_PALETTE.erase)).toBe(true)
    expect(strokes(demolition({ callouts: [A()] })).some((s) => s.strokeStyle === LIGHT_PALETTE.erase)).toBe(false)
  })

  it("C-RND-11f: на «Демонтаже» текст, линия и стрелка выноски — обычным цветом чертежа (ink), а не серым цветом подложки", () => {
    const { ctx, ops, texts: colored } = colorRecorder()
    drawDemolitionScene(ctx, 800, 600, { walls: [W], doorways: [], marks: [], callouts: [A()] }, "cm", VIEW, { color: RED, grid: false, palette: LIGHT_PALETTE })
    const own = colored.filter((t) => lineTexts(A()).includes(t.text))
    expect(own.map((t) => t.text)).toEqual(lineTexts(A()))
    for (const t of own) expect(t.fillStyle).toBe(LIGHT_PALETTE.ink)
    const tip = toScreen(A().target)
    const head = ops.find((o) => o.kind === "fill" && !o.hasArc && o.subpaths.some((sp) => sp.length >= 3 && sp.some((p) => Math.hypot(p.x - tip.x, p.y - tip.y) < 0.5)))
    expect(head?.kind === "fill" && head.fillStyle).toBe(LIGHT_PALETTE.ink)
    expect(strokes(ops).some((s) => s.strokeStyle === LIGHT_PALETTE.ink && s.lineWidth < SCREEN_METRICS.contourPx && s.subpaths.some((sp) => sp.some((p) => Math.hypot(p.x - tip.x, p.y - tip.y) < 12)))).toBe(true)
  })

  it("C-RND-11g: в тёмной теме на «Демонтаже» выноска рисуется цветами тёмной палитры (ink), а не светлой", () => {
    const { ctx, ops, texts: colored } = colorRecorder()
    drawDemolitionScene(ctx, 800, 600, { walls: [W], doorways: [], marks: [], callouts: [A()] }, "cm", VIEW, { color: RED, grid: false, palette: DARK_PALETTE })
    expect(DARK_PALETTE.ink).not.toBe(LIGHT_PALETTE.ink)
    const own = colored.filter((t) => lineTexts(A()).includes(t.text))
    expect(own.map((t) => t.text)).toEqual(lineTexts(A()))
    for (const t of own) expect(t.fillStyle).toBe(DARK_PALETTE.ink)
    const tip = toScreen(A().target)
    const head = ops.find((o) => o.kind === "fill" && !o.hasArc && o.subpaths.some((sp) => sp.length >= 3 && sp.some((p) => Math.hypot(p.x - tip.x, p.y - tip.y) < 0.5)))
    expect(head?.kind === "fill" && head.fillStyle).toBe(DARK_PALETTE.ink)
    const line = strokes(ops).find((s) => s.lineWidth < SCREEN_METRICS.contourPx && s.subpaths.some((sp) => sp.some((p) => Math.hypot(p.x - tip.x, p.y - tip.y) < 12)))
    expect(line?.strokeStyle).toBe(DARK_PALETTE.ink)
    // подложка текста — цвет фона тёмной схемы
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle === DARK_PALETTE.paper)).toBe(true)
  })

  it("C-RND-11e: без выносок отрисовка «Демонтажа» не меняется", () => {
    const base = demolition({}).map((o) => JSON.stringify(o))
    expect(demolition({ callouts: [] }).map((o) => JSON.stringify(o))).toEqual(base)
  })
})
