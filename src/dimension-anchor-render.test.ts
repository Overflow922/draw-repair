import { describe, expect, it } from "vitest"
import { drawScene } from "./render"
import type { RenderOptions } from "./render"
import { mountingScene } from "./mounting/mounting-scene"
import { dimPointPoint, nearestDimAnchor } from "./geometry"
import { pageBounds, pagesOf } from "./export/pdf"
import { LIGHT_PALETTE } from "./theme"
import type { Drawing, Dimension, DimPoint, Point, Unit, View, Wall } from "./types"
import { VIEW, numberTexts, onSegment, recorder, segments, strokes, toScreen } from "./doorway/doorway.test-utils"
import type { Op } from "./doorway/doorway.test-utils"
import { expectAt, jambDimension, jambPoint, sceneF2, w, win } from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: размер с откосами виден на холсте и в сцене «Монтаж»
// (spec dimension-tool «Точки замера на откосах элементов стены», «Отрисовка размера»; mounting-plan
// «Элементы и размеры на остатках»; design D4, D8). Ожидания — по геометрии сцен в экранных координатах.

const S = (x: number, y: number) => toScreen({ x, y })
const TOL = 1

function draw(walls: Wall[], opts: RenderOptions, unit: Unit = "cm", view: View = VIEW): Op[] {
  const { ctx, ops } = recorder()
  drawScene(ctx, 1600, 1200, walls, null, unit, view, [], { grid: false, ...opts })
  return ops
}

// размер между откосами e1.b и e2.a на грани +1 со смещением 30: линия на y = 40 между x = 220 и x = 300
const gap = (): Dimension => jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1), 30)

// горизонтальный отрезок размерной линии проходит через точку; диагональная штриховка стен не считается
// (записывающий контекст не применяет clip, и её штрихи проходят у любой точки габарита стены)
const horizontal = (s: [Point, Point]): boolean => Math.abs(s[0].y - s[1].y) < 1e-6
const lineThrough = (ops: Op[], x: number, y: number, color?: string): boolean =>
  strokes(ops)
    .filter((o) => color === undefined || o.strokeStyle === color)
    .flatMap(segments)
    .some((s) => horizontal(s) && onSegment(S(x, y), s, TOL))

describe("отрисовка размера с откосами", () => {
  it("DA-34: размерная линия и число 80 рисуются между откосами окон", () => {
    const { walls, elements } = sceneF2()
    const ops = draw(walls, { dimensions: [gap()], doorways: elements })
    expect(numberTexts(ops).map((t) => t.text)).toContain("80")
    for (const x of [225, 295]) expect(lineThrough(ops, x, 40), `линия у x = ${x}`).toBe(true)
    for (const x of [215, 305]) expect(lineThrough(ops, x, 40), `линия не выходит за откос x = ${x}`).toBe(false)
  })

  it("DA-34b: число размера лежит над серединой линии, а не у начала координат", () => {
    const { walls, elements } = sceneF2()
    const ops = draw(walls, { dimensions: [gap()], doorways: elements })
    const label = numberTexts(ops).find((t) => t.text === "80")
    expect(label).toBeDefined()
    if (!label) return
    const mid = S(260, 40)
    expect(Math.abs(label.at.x - mid.x)).toBeLessThanOrEqual(30)
    expect(Math.abs(label.at.y - mid.y)).toBeLessThanOrEqual(30)
  })

  it("DA-34c: единицы отображения — число в мм", () => {
    const { walls, elements } = sceneF2()
    const ops = draw(walls, { dimensions: [gap()], doorways: elements }, "mm")
    expect(numberTexts(ops).map((t) => t.text)).toContain("800")
  })

  it("DA-34d: без списка элементов размер с откосами не рисуется — число не появляется", () => {
    const { walls } = sceneF2()
    const ops = draw(walls, { dimensions: [gap()] })
    expect(numberTexts(ops).map((t) => t.text)).not.toContain("80")
    expect(lineThrough(ops, 225, 40)).toBe(false)
  })

  it("DA-36: размер на откосе отсутствующего элемента не рисуется и не бросает", () => {
    const { walls, elements } = sceneF2()
    const dangling = jambDimension(jambPoint("ghost", "a", 1), jambPoint("e2", "a", 1), 30)
    const ops = draw(walls, { dimensions: [dangling], doorways: elements })
    expect(numberTexts(ops).map((t) => t.text)).not.toContain("80")
    expect(lineThrough(ops, 280, 40)).toBe(false)
  })

  it("DA-34e: размер с откосом наравне с граневым размером — оба рисуются", () => {
    const { walls, elements } = sceneF2()
    const mixed = jambDimension(jambPoint("e2", "b", 1), jambPoint("e2", "a", 1), 30)
    const ops = draw(walls, { dimensions: [gap(), mixed], doorways: elements })
    const numbers = numberTexts(ops).map((t) => t.text)
    expect(numbers).toContain("80")
    expect(numbers).toContain("120")
  })
})

describe("подсветка размера с откосами", () => {
  const P = LIGHT_PALETTE

  it("DA-43: подсветка ластика (hoverDim) рисует размер с откосами цветом erase", () => {
    const { walls, elements } = sceneF2()
    const ops = draw(walls, { hoverDim: gap(), doorways: elements })
    for (const x of [225, 295]) expect(lineThrough(ops, x, 40, P.erase), `линия erase у x = ${x}`).toBe(true)
    expect(lineThrough(ops, 225, 40, P.ink)).toBe(false)
  })

  it("DA-43b: выделенный размер (selectedDims) рисуется цветом selectedDim", () => {
    const { walls, elements } = sceneF2()
    const dim = gap()
    const ops = draw(walls, { dimensions: [dim], selectedDims: [dim], doorways: elements })
    for (const x of [225, 295]) expect(lineThrough(ops, x, 40, P.selectedDim), `линия selectedDim у x = ${x}`).toBe(true)
  })

  it("DA-43c: размер в рамке выделения (marqueeHits.dims) рисуется цветом marqueeDim", () => {
    const { walls, elements } = sceneF2()
    const dim = gap()
    const ops = draw(walls, { dimensions: [dim], marqueeHits: { walls: [], dims: [dim] }, doorways: elements })
    for (const x of [225, 295]) expect(lineThrough(ops, x, 40, P.marqueeDim), `линия marqueeDim у x = ${x}`).toBe(true)
  })

  it("DA-43d: обычный размер с откосами рисуется цветом ink и не цветом подсветки", () => {
    const { walls, elements } = sceneF2()
    const ops = draw(walls, { dimensions: [gap()], doorways: elements })
    expect(lineThrough(ops, 225, 40, P.ink)).toBe(true)
    for (const color of [P.erase, P.selectedDim, P.marqueeDim]) expect(lineThrough(ops, 225, 40, color)).toBe(false)
  })
})

describe("план «Монтаж»", () => {
  const baseDrawing = (extra: Partial<Drawing>): Drawing => {
    const { walls, elements } = sceneF2()
    return { id: "a", name: "Чертёж", walls: [{ ...walls[0], id: "w1" }], dimensions: [], doorways: elements.map((e) => ({ ...e, wallId: "w1" })), view: VIEW, ...extra }
  }

  it("DA-37: размер «Монтажа» на откосах видимых старых элементов остаётся в сцене и разрешается в остатке", () => {
    const d = baseDrawing({ mounting: { walls: [], dimensions: [gap()], doorways: [] } })
    const scene = mountingScene(d)
    expect(scene.dimensions).toEqual([gap()])
    expectAt(dimPointPoint(scene.dimensions[0].from, scene.walls, scene.doorways), 220, 10)
    expectAt(dimPointPoint(scene.dimensions[0].to, scene.walls, scene.doorways), 300, 10)
  })

  it("DA-37c: размер на откосах собственного элемента собственной стены остаётся в сцене", () => {
    const own = w(0, 100, 500, 100, "n1")
    const mine = win("n1", "a", 50, 100, 150, 85, "m1")
    const dim = jambDimension(jambPoint("m1", "a", 1), jambPoint("m1", "b", 1), 20)
    const scene = mountingScene(baseDrawing({ mounting: { walls: [own], dimensions: [dim], doorways: [mine] } }))
    expect(scene.dimensions).toEqual([dim])
    expectAt(dimPointPoint(dim.from, scene.walls, scene.doorways), 50, 110)
    expectAt(dimPointPoint(dim.to, scene.walls, scene.doorways), 150, 110)
  })

  it("DA-37d: размер на откосе отсутствующего элемента скрыт и не роняет сцену", () => {
    const dangling = jambDimension(jambPoint("ghost", "a", 1), jambPoint("e2", "a", 1), 30)
    const scene = mountingScene(baseDrawing({ mounting: { walls: [], dimensions: [dangling, gap()], doorways: [] } }))
    expect(scene.dimensions).toEqual([gap()])
  })

  it("DA-37f: у размера «откос + отсутствующий элемент» скрыт при любом порядке точек", () => {
    const ghost = jambPoint("ghost", "a", 1)
    const live = jambPoint("e1", "b", 1)
    const scene = mountingScene(
      baseDrawing({ mounting: { walls: [], dimensions: [jambDimension(live, ghost, 30), jambDimension(ghost, live, 30)], doorways: [] } }),
    )
    expect(scene.dimensions).toEqual([])
  })

  it("DA-37g: смешанный размер «откос + грань отсутствующей стены» скрыт в обоих порядках", () => {
    const lostEdge: DimPoint = { a: { wallId: "no-such-wall", edge: 0 }, b: { wallId: "no-such-wall", edge: 2 } }
    const live = jambPoint("e1", "b", 1)
    const scene = mountingScene(
      baseDrawing({ mounting: { walls: [], dimensions: [{ from: live, to: lostEdge, offset: 5 }, { from: lostEdge, to: live, offset: 5 }], doorways: [] } }),
    )
    expect(scene.dimensions).toEqual([])
  })

  it("DA-44: снап на сцене «Монтаж» с остатком стены даёт откос старого окна на остатке", () => {
    // снос участка 450…500 оставляет остаток 0…450 с окнами e1 (100…220) и e2 (300…420)
    const d = baseDrawing({ demolition: [{ id: "m1", wallId: "w1", anchor: "a", fromCm: 450, toCm: 500 }], mounting: { walls: [], dimensions: [], doorways: [] } })
    const scene = mountingScene(d)
    expect(scene.doorways.map((e) => e.id).sort()).toEqual(["e1", "e2"])
    const hit = nearestDimAnchor({ x: 221, y: 11 }, scene.walls, scene.doorways, 3)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "e1", jamb: "b", face: 1 })
    expectAt(hit?.point ?? null, 220, 10)
  })

  it("DA-44b: снап на сцене «Монтаж» даёт откос собственного окна собственной стены", () => {
    const own = w(0, 100, 500, 100, "n1")
    const mine = win("n1", "a", 50, 100, 150, 85, "m1")
    const scene = mountingScene(baseDrawing({ mounting: { walls: [own], dimensions: [], doorways: [mine] } }))
    const hit = nearestDimAnchor({ x: 151, y: 111 }, scene.walls, scene.doorways, 3)
    expect(hit?.anchor).toEqual({ kind: "jamb", elementId: "m1", jamb: "b", face: 1 })
    expectAt(hit?.point ?? null, 150, 110)
  })

  it("DA-44c: страница PDF «Монтаж» получает размер с откосами и расширяет габарит листа", () => {
    const far = jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1), 200)
    const pages = pagesOf(baseDrawing({ mounting: { walls: [], dimensions: [far], doorways: [] } }))
    const page = pages.find((p) => p.title === "Монтаж")
    expect(page).toBeDefined()
    if (!page) return
    expect(page.dimensions).toEqual([far])
    const without = pageBounds({ ...page, dimensions: [] }, 100)
    expect(pageBounds(page, 100).maxY).toBeGreaterThan(without.maxY + 100)
  })

  it("DA-37e: собственный элемент на отсутствующей стене — его размер скрыт", () => {
    const lost = win("nowhere", "a", 50, 100, 150, 85, "m2")
    const dim = jambDimension(jambPoint("m2", "a", 1), jambPoint("m2", "b", 1), 20)
    const scene = mountingScene(baseDrawing({ mounting: { walls: [], dimensions: [dim], doorways: [lost] } }))
    expect(scene.dimensions).toEqual([])
  })
})
