import { describe, expect, it } from "vitest"
import { door, recorder, sceneR, segments, strokes, texts, clips, AREA_LABEL, H_LABEL } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import { drawScene, PDF_METRICS, SCREEN_METRICS } from "../render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { W, door_, mk, window_ } from "./demolition.test-utils"
import { demolitionColor, drawDemolitionScene } from "./demolition-render"
import type { DemolitionScene } from "./demolition-render"
import { markRegion } from "./mark-region"
import { markDimensions } from "./mark-dimensions"
import { effectiveMarks } from "./marks"
import type { ResolvedMark } from "./marks"

// change demolition-plan: отрисовка плана «Демонтаж» (spec demolition-plan «Отображение плана «Демонтаж»»;
// design D8). Подложка рисуется серым, область сноса — бумагой, красным контуром и красной штриховкой 135°.
// Операции канваса фиксирует записывающий контекст (doorway.test-utils); координаты — экранные.

const VIEW: View = { zoom: 1, pan: { x: -20, y: -50 } }
const K = PX_PER_CM * VIEW.zoom
const RED = "#d32f2f"
const toScreen = (p: Point): Point => ({ x: (p.x - VIEW.pan.x) * K, y: (p.y - VIEW.pan.y) * K })

const walls = [W()]
const marksOn = (list = [mk("m", "W", "a", 100, 190)], ws: Wall[] = walls) => effectiveMarks(list, ws)

function render(scene: Partial<DemolitionScene> & { walls?: readonly Wall[] }, opts: Partial<Parameters<typeof drawDemolitionScene>[6]> = {}, unit: "cm" | "m" | "mm" = "cm"): Op[] {
  const { ctx, ops } = recorder()
  drawDemolitionScene(ctx, 800, 600, { walls, doorways: [], marks: [], ...scene }, unit, VIEW, { color: RED, grid: false, palette: LIGHT_PALETTE, ...opts })
  return ops
}

const samePolygon = (a: Point[], b: Point[], tol = 1e-6): boolean => {
  const key = (p: Point): string => `${Math.round(p.x / tol)}:${Math.round(p.y / tol)}`
  const ka = new Set(a.map(key))
  return ka.size === new Set(b.map(key)).size && b.every((p) => ka.has(key(p)))
}

const regionScreenOf = (list: readonly ResolvedMark[]): Point[][] => list.flatMap((r) => markRegion(r, walls).map((poly) => poly.map(toScreen)))
const regionScreen = (): Point[][] => regionScreenOf(marksOn())

const stylesOf = (ops: Op[]): Set<string> => {
  const s = new Set<string>()
  for (const o of ops) {
    if (o.kind === "stroke") s.add(o.strokeStyle)
    if (o.kind === "fill") s.add(o.fillStyle)
  }
  return s
}

const redStrokes = (ops: Op[], color = RED) => strokes(ops).filter((o) => o.strokeStyle === color)
const hatchOf = (ops: Op[], style: string, widthPx = SCREEN_METRICS.hatchPx) => strokes(ops).filter((o) => o.strokeStyle === style && Math.abs(o.lineWidth - widthPx) < 1e-9).flatMap((o) => segments(o))

describe("подложка", () => {
  it("RN-01: подложка серая: вся геометрия стен нарисована цветом muted, цвета ink нет нигде", () => {
    const styles = stylesOf(render({ walls: sceneR().walls }))
    expect(styles.has(LIGHT_PALETTE.muted)).toBe(true)
    expect(styles.has(LIGHT_PALETTE.ink)).toBe(false)
  })

  it("RN-01: у подложки есть контур (толщина contourPx) и штриховка материала (толщина hatchPx)", () => {
    const ops = render({})
    expect(strokes(ops).some((o) => o.strokeStyle === LIGHT_PALETTE.muted && o.lineWidth === SCREEN_METRICS.contourPx)).toBe(true)
    expect(hatchOf(ops, LIGHT_PALETTE.muted).length).toBeGreaterThan(3)
  })

  it("RN-01: штриховка кирпича подложки идёт под 45° (в экранных координатах dx·dy < 0)", () => {
    for (const [p, q] of hatchOf(render({}), LIGHT_PALETTE.muted)) expect((q.x - p.x) * (q.y - p.y)).toBeLessThan(0)
  })

  it("RN-01: у подложки нет подписей: комната без подписи площади, размеров нет — текста нет вовсе", () => {
    const ops = render({ walls: sceneR().walls })
    expect(texts(ops)).toEqual([])
    expect(texts(ops).filter((t) => AREA_LABEL.test(t.text))).toEqual([])
  })

  // TCR-2 (change demolition-show-elements): элементы на подложке рисуются полностью, в том числе подписи высоты
  it("RN-05: подпись высоты проёма «H=210» рисуется на подложке один раз; других подписей нет", () => {
    const ops = render({ doorways: [door("W", "a", 300, 90, 210)] })
    expect(texts(ops).filter((t) => H_LABEL.test(t.text)).map((t) => t.text)).toEqual(["H=210"])
    expect(texts(ops).map((t) => t.text)).toEqual(["H=210"])
  })

  it("RN-05: вырез видимого проёма остаётся в подложке: контур стены с проёмом отличается от контура сплошной стены", () => {
    const solid = strokes(render({})).filter((o) => o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).length
    const cut = strokes(render({ doorways: [door("W", "a", 300, 90, 210)] })).filter((o) => o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).length
    expect(cut).toBeGreaterThan(solid)
  })

  it("RN-12: без пометок и превью красного нет", () => {
    expect(stylesOf(render({})).has(RED)).toBe(false)
  })
})

describe("элементы стены на плане демонтажа (change demolition-show-elements)", () => {
  const whole = () => marksOn([mk("m", "W", "a", 0, 500)])
  const hLabels = (ops: Op[]): string[] => texts(ops).filter((t) => H_LABEL.test(t.text)).map((t) => t.text)

  it("RN-14: проём внутри снесённого участка отображается: подпись «H=210» нарисована", () => {
    const ops = render({ doorways: [door("W", "a", 300, 90, 210)], marks: marksOn([mk("m", "W", "a", 100, 400)]) })
    expect(hLabels(ops)).toEqual(["H=210"])
  })

  it("RN-14: проём в целиком снесённой стене отображается", () => {
    expect(hLabels(render({ doorways: [door("W", "a", 300, 90, 210)], marks: whole() }))).toEqual(["H=210"])
  })

  it("RN-15: проём, частично пересекающийся с участком (250–400 и проём 300–390 внутри; 350–500 и проём 300–390 пересекается), и проём, касающийся участка (390–500), отображаются", () => {
    for (const [from, to] of [[250, 400], [350, 500], [390, 500], [100, 300]] as const) {
      const ops = render({ doorways: [door("W", "a", 300, 90, 210)], marks: marksOn([mk("m", "W", "a", from, to)]) })
      expect(hLabels(ops), `участок ${from}–${to}`).toEqual(["H=210"])
    }
  })

  it("RN-15: проём вне участка тоже отображается", () => {
    expect(hLabels(render({ doorways: [door("W", "a", 300, 90, 210)], marks: marksOn([mk("m", "W", "a", 0, 100)]) }))).toEqual(["H=210"])
  })

  it("RN-16: дверь и окно в целиком снесённой стене: полотно и дуга двери и подписи высоты дверь/окно нарисованы", () => {
    const withElements = render({ doorways: [door_("W", "a", 100, 90, "d1"), window_("W", "a", 300, 90, "w1")], marks: whole() })
    const bare = render({ marks: whole() })
    const mutedStrokes = (ops: Op[]) => strokes(ops).filter((o) => o.strokeStyle === LIGHT_PALETTE.muted).flatMap(segments).length
    expect(mutedStrokes(withElements)).toBeGreaterThan(mutedStrokes(bare))
    expect(texts(withElements).some((t) => t.text.includes("210"))).toBe(true)
    expect(texts(withElements).some((t) => t.text.includes("120"))).toBe(true)
  })

  it("RN-17: элементы рисуются поверх области сноса: подпись «H=210» идёт после закраски бумагой области", () => {
    const ops = render({ doorways: [door("W", "a", 300, 90, 210)], marks: whole() })
    const region = regionScreenOf(whole())
    const paper = ops.findIndex((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.paper && o.subpaths.some((sp) => region.some((poly) => samePolygon(sp, poly))))
    const label = ops.findIndex((o) => o.kind === "text" && H_LABEL.test(o.text))
    expect(paper).toBeGreaterThanOrEqual(0)
    expect(label).toBeGreaterThan(paper)
  })

  it("RN-18: элементы серые: цвета ink нет нигде, цвет muted есть", () => {
    const ops = render({ doorways: [door_("W", "a", 300, 90, "d1")], marks: whole() })
    const styles = stylesOf(ops)
    expect(styles.has(LIGHT_PALETTE.ink)).toBe(false)
    expect(styles.has(LIGHT_PALETTE.muted)).toBe(true)
  })

  it("RN-19: вырез элемента в стене рисуется и в снесённой зоне: контур подложки с проёмом длиннее контура сплошной стены", () => {
    const solid = strokes(render({ marks: whole() })).filter((o) => o.strokeStyle === LIGHT_PALETTE.muted && o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).length
    const cut = strokes(render({ doorways: [door("W", "a", 300, 90, 210)], marks: whole() })).filter((o) => o.strokeStyle === LIGHT_PALETTE.muted && o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).length
    expect(cut).toBeGreaterThan(solid)
  })
})

describe("элементы на плане демонтажа совпадают с обмерочным планом (change demolition-show-elements)", () => {
  // Без пометок слой элементов и вырезы стен на плане «Демонтаж» должны давать те же операции канваса, что
  // drawScene обмерочного плана с серой палитрой: позиции, толщины, шрифт, выравнивание и базовая линия подписей.
  // Комната фиксирует сторону подписей; подпись площади на обмерочном плане исключается (на подложке её нет).
  const room = sceneR().walls
  const elements = [door("W", "a", 100, 90, 210), door_("B", "a", 200, 90, "d1"), window_("R", "a", 120, 120, "w1")]
  const grey = { ...LIGHT_PALETTE, ink: LIGHT_PALETTE.muted }

  function capture() {
    const { ctx, ops } = recorder()
    const seen: string[] = []
    const original = ctx.fillText.bind(ctx)
    ctx.fillText = (text: string, x: number, y: number, maxWidth?: number): void => {
      seen.push(`${text}|${ctx.textAlign}|${ctx.textBaseline}`)
      original(text, x, y, maxWidth)
    }
    return { ctx, ops, seen }
  }

  const noArea = (xs: string[]): string[] => xs.filter((s) => !AREA_LABEL.test(s.split("|")[0] ?? ""))

  function both(metrics: typeof SCREEN_METRICS) {
    const demo = capture()
    drawDemolitionScene(demo.ctx, 800, 600, { walls: room, doorways: elements, marks: [] }, "cm", VIEW, { color: RED, grid: false, metrics, palette: LIGHT_PALETTE })
    const measure = capture()
    drawScene(measure.ctx, 800, 600, [...room], null, "cm", VIEW, [], { grid: false, metrics, palette: grey, doorways: [...elements] })
    return { demo, measure }
  }

  it.each([
    ["экранные метрики", SCREEN_METRICS],
    ["метрики PDF", PDF_METRICS],
  ] as const)("RN-20: %s — штрихи, закраски и подписи (позиция, шрифт, выравнивание, базовая линия) такие же, как у обмерочного плана", (_name, metrics) => {
    const { demo, measure } = both(metrics)
    expect(demo.ops.filter((o) => o.kind !== "text")).toEqual(measure.ops.filter((o) => o.kind !== "text"))
    expect(texts(demo.ops)).toEqual(texts(measure.ops).filter((t) => !AREA_LABEL.test(t.text)))
    expect(demo.seen).toEqual(noArea(measure.seen))
    expect(demo.seen.length).toBeGreaterThan(0)
  })

  it("RN-20: подписи элементов не пусты: «H=210» у проёма, 210 у двери, 120 у окна", () => {
    const { demo } = both(SCREEN_METRICS)
    expect(demo.seen.some((s) => s.startsWith("H=210"))).toBe(true)
    expect(texts(demo.ops).some((t) => t.text.includes("120"))).toBe(true)
  })

  it("RN-21: вырез стены по проёму рисуется на подложке: контур стены с проёмом отличается от сплошной (список элементов передан в подложку)", () => {
    const { demo } = both(SCREEN_METRICS)
    const solid = capture()
    drawDemolitionScene(solid.ctx, 800, 600, { walls: room, doorways: [], marks: [] }, "cm", VIEW, { color: RED, grid: false, palette: LIGHT_PALETTE })
    const contour = (ops: Op[]) => strokes(ops).filter((o) => o.lineWidth === SCREEN_METRICS.contourPx && o.strokeStyle === LIGHT_PALETTE.muted).flatMap(segments).length
    expect(contour(demo.ops)).toBeGreaterThan(contour(solid.ops))
  })
})

describe("область сноса", () => {
  it("RN-02: область закрашена цветом бумаги по контуру области, закраска идёт до красных линий", () => {
    const ops = render({ marks: marksOn() })
    const region = regionScreen()
    const paper = ops.findIndex((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.paper && o.subpaths.some((sp) => region.some((poly) => samePolygon(sp, poly))))
    expect(paper).toBeGreaterThanOrEqual(0)
    const firstRed = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === RED)
    expect(firstRed).toBeGreaterThan(paper)
  })

  it("RN-02: красный контур области толщиной contourPx идёт по сторонам области и не выходит за её габариты", () => {
    const ops = render({ marks: marksOn() })
    const region = regionScreen().flat()
    const minX = Math.min(...region.map((p) => p.x))
    const maxX = Math.max(...region.map((p) => p.x))
    const minY = Math.min(...region.map((p) => p.y))
    const maxY = Math.max(...region.map((p) => p.y))
    const contour = redStrokes(ops).filter((o) => o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments)
    expect(contour.length).toBeGreaterThanOrEqual(3)
    for (const [p, q] of contour) {
      for (const pt of [p, q]) {
        expect(pt.x).toBeGreaterThanOrEqual(minX - 1e-6)
        expect(pt.x).toBeLessThanOrEqual(maxX + 1e-6)
        expect(pt.y).toBeGreaterThanOrEqual(minY - 1e-6)
        expect(pt.y).toBeLessThanOrEqual(maxY + 1e-6)
      }
    }
  })

  it("RN-02: красная штриховка идёт под 135° (dx·dy > 0, |dx| = |dy|), толщиной hatchPx, внутри клипа по области", () => {
    const ops = render({ marks: marksOn() })
    // TCR-1 (change demolition-dimension-chains): выносные и размерные линии той же толщины осевые — это не штриховка
    const lines = hatchOf(ops, RED).filter(([p, q]) => Math.abs(q.x - p.x) > 1e-6 && Math.abs(q.y - p.y) > 1e-6)
    expect(lines.length).toBeGreaterThan(3)
    for (const [p, q] of lines) {
      const dx = q.x - p.x
      const dy = q.y - p.y
      expect(dx * dy).toBeGreaterThan(0)
      expect(Math.abs(Math.abs(dx) - Math.abs(dy))).toBeLessThan(1e-6)
    }
    const region = regionScreen()
    expect(clips(ops).some((c) => c.subpaths.some((sp) => region.some((poly) => samePolygon(sp, poly))))).toBe(true)
  })

  it("RN-02: красный — только цвет из параметров: смена color меняет цвет всех красных линий", () => {
    const ops = render({ marks: marksOn() }, { color: "#00aa00" })
    expect(redStrokes(ops, "#00aa00").length).toBeGreaterThan(0)
    expect(stylesOf(ops).has(RED)).toBe(false)
  })

  it("RN-03: ширина участка числом в цепочке: «90» в сантиметрах, «0,9» в метрах, «900» в миллиметрах (по одному на каждой из двух граней)", () => {
    // TCR-4 (change demolition-corner-dimensions): цепочка есть у каждой пометки, выделена она или нет
    for (const [unit, text] of [["cm", "90"], ["m", "0,9"], ["mm", "900"]] as const) {
      const ops = render({ marks: marksOn() }, {}, unit)
      expect(texts(ops).map((t) => t.text).filter((x) => x === text)).toHaveLength(2)
    }
  })

  it("RN-03: подпись ширины стоит у участка: x по центру участка, ниже верха стены на стороне нормали", () => {
    const [r] = marksOn()
    const spot = markDimensions(r!, walls, "chain", "cm", K, SCREEN_METRICS.labelPx).find((d) => d.side === 1 && d.target === "width")!.spot
    const t = texts(render({ marks: marksOn() })).find((x) => x.text === "90" && Math.abs(x.at.y - toScreen(spot.center).y) < SCREEN_METRICS.labelPx)
    expect(Math.abs(t!.at.x - toScreen(spot.center).x)).toBeLessThan(1)
    expect(Math.abs(t!.at.y - toScreen(spot.center).y)).toBeLessThan(SCREEN_METRICS.labelPx)
    expect(t!.at.x).toBeCloseTo(toScreen({ x: 145, y: 0 }).x, 0)
  })

  it("RN-04: остаток стены серый и без красного: красные контуры только в габаритах области сноса", () => {
    const ops = render({ marks: marksOn() })
    const region = regionScreen().flat()
    const maxX = Math.max(...region.map((p) => p.x))
    const minX = Math.min(...region.map((p) => p.x))
    const mutedPoints = strokes(ops).filter((o) => o.strokeStyle === LIGHT_PALETTE.muted && o.lineWidth === SCREEN_METRICS.contourPx).flatMap(segments).flat()
    expect(mutedPoints.some((p) => p.x < minX - 1)).toBe(true)
    expect(mutedPoints.some((p) => p.x > maxX + 1)).toBe(true)
    // красного левее и правее области сноса нет
    for (const o of redStrokes(ops).filter((s) => s.lineWidth === SCREEN_METRICS.contourPx)) for (const pt of o.subpaths.flat()) {
      expect(pt.x).toBeGreaterThanOrEqual(minX - 1e-6)
      expect(pt.x).toBeLessThanOrEqual(maxX + 1e-6)
    }
  })

  it("RN-06: шесть чисел (100, 90, 310 на каждой из двух граней) у пометки — и выделенной, и невыделенной", () => {
    const [r] = marksOn()
    expect(texts(render({ marks: marksOn(), selectedId: "m" })).map((t) => t.text).sort()).toEqual(["100", "100", "310", "310", "90", "90"])
    expect(texts(render({ marks: marksOn(), selectedId: "other" })).map((t) => t.text).sort()).toEqual(["100", "100", "310", "310", "90", "90"])
    expect(texts(render({ marks: marksOn() })).map((t) => t.text).sort()).toEqual(["100", "100", "310", "310", "90", "90"])
    expect(markDimensions(r!, walls, "chain", "cm", K, SCREEN_METRICS.labelPx)).toHaveLength(6)
  })

  it("RN-06: несколько пометок — цепочка у каждой: ширины 50 и 120 по два (две грани), расстояния 50, 300 и 80 до стыков", () => {
    const list = marksOn([mk("m1", "W", "a", 50, 100), mk("m2", "W", "a", 300, 420)])
    const all = texts(render({ marks: list })).map((t) => t.text).sort()
    expect(all).toEqual(["120", "120", "300", "300", "50", "50", "50", "50", "400", "400", "80", "80"].sort())
  })

  it("RN-07: превью протяжки — красные линии и размеры (100, 90, 310 на каждой грани) без закраски бумагой", () => {
    const ops = render({ marks: [], ghost: { wallId: "W", from: 100, to: 190 } })
    expect(redStrokes(ops).length).toBeGreaterThan(0)
    expect(texts(ops).map((t) => t.text).sort()).toEqual(["100", "100", "310", "310", "90", "90"])
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle === LIGHT_PALETTE.paper)).toBe(false)
  })

  it("RN-07: превью без стены или с неизвестной стеной ничего не рисует", () => {
    expect(stylesOf(render({ marks: [], ghost: { wallId: "nope", from: 100, to: 190 } })).has(RED)).toBe(false)
    expect(stylesOf(render({ marks: [], ghost: null })).has(RED)).toBe(false)
  })

  it("RN-08: метрики PDF: красный контур и штриховка толщиной PDF_METRICS.contourPx и hatchPx", () => {
    const ops = render({ marks: marksOn() }, { metrics: PDF_METRICS })
    expect(redStrokes(ops).some((o) => o.lineWidth === PDF_METRICS.contourPx)).toBe(true)
    expect(hatchOf(ops, RED, PDF_METRICS.hatchPx).length).toBeGreaterThan(3)
  })

  it("RN-09: тёмная схема: бумага и серый подложки берутся из палитры", () => {
    const ops = render({ marks: marksOn() }, { palette: DARK_PALETTE })
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle === DARK_PALETTE.paper)).toBe(true)
    const styles = stylesOf(ops)
    expect(styles.has(DARK_PALETTE.muted)).toBe(true)
    expect(styles.has(DARK_PALETTE.ink)).toBe(false)
  })

  it("RN-13: сетка включается параметром grid (по умолчанию как на обмерочном плане)", () => {
    const withGrid = render({}, { grid: true })
    const without = render({}, { grid: false })
    expect(strokes(withGrid).length).toBeGreaterThan(strokes(without).length)
  })
})

describe("demolitionColor", () => {
  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

  it.each(["light", "dark"] as const)("RN-10: цвет схемы %s — шестизначный hex, преобладает красный", (theme) => {
    const c = demolitionColor(theme)
    expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    const [r, g, b] = rgb(c)
    expect(r).toBeGreaterThan(2 * g)
    expect(r).toBeGreaterThan(2 * b)
  })

  it("RN-10: светлая и тёмная схемы различны и оба не совпадают с цветом бумаги своей палитры", () => {
    expect(demolitionColor("light")).not.toBe(demolitionColor("dark"))
    expect(demolitionColor("light").toLowerCase()).not.toBe(LIGHT_PALETTE.paper)
    expect(demolitionColor("dark").toLowerCase()).not.toBe(DARK_PALETTE.paper)
  })
})
