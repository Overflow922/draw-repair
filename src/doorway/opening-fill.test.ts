import { describe, expect, it } from "vitest"
import { drawScene } from "../render"
import type { RenderOptions } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Point, Wall, WallElement } from "../types"
import { VIEW, door, insidePolygon, recorder, sceneF, segments, toScreen } from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"
import { dr } from "./door.test-utils"
import { win } from "./window.test-utils"

// change fix-opening-fill-and-door-leaf-corner: область между откосами закрашена цветом бумаги, сетка холста
// не просвечивает (spec doorway «Отображение проёма», window «Отображение окна»). Стена W (0,0)-(500,0) t20,
// элемент 100…220 по оси, то есть область [100, 220] × [−10, 10].

const PAPER = LIGHT_PALETTE.paper
const S = (p: Point): Point => toScreen(p, VIEW)
const CORNERS = [S({ x: 100, y: -10 }), S({ x: 220, y: -10 }), S({ x: 220, y: 10 }), S({ x: 100, y: 10 })]
const TOL = 0.5

function draw(walls: Wall[], opts: RenderOptions): Op[] {
  const { ctx, ops } = recorder()
  drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [], { grid: true, ...opts })
  return ops
}

// заливка цветом бумаги ровно по области проёма
const isOpeningFill = (o: Op): boolean =>
  o.kind === "fill" &&
  o.fillStyle === PAPER &&
  o.subpaths.length === 1 &&
  o.subpaths[0].length >= 4 &&
  CORNERS.every((c) => o.subpaths[0].some((p) => Math.hypot(p.x - c.x, p.y - c.y) <= TOL)) &&
  o.subpaths[0].every((p) => CORNERS.some((c) => Math.hypot(p.x - c.x, p.y - c.y) <= TOL))

const fillIndexes = (ops: Op[]): number[] => ops.flatMap((o, i) => (isOpeningFill(o) ? [i] : []))

const doorway = (): WallElement => door("W", "a", 100, 120)
const aDoor = (): WallElement => dr("W", "a", 100, "a", "left", 120)
const aWindow = (): WallElement => win("W", "a", 100, 120)

const KINDS: [string, () => WallElement][] = [
  ["проём", doorway],
  ["дверь", aDoor],
  ["окно", aWindow],
]

describe("заливка области проёма", () => {
  const { walls } = sceneF()

  for (const [name, make] of KINDS) {
    it(`OF-01 (${name}): область между откосами и гранями залита цветом бумаги один раз`, () => {
      const ops = draw(walls, { doorways: [make()] })
      expect(fillIndexes(ops)).toHaveLength(1)
    })

    it(`OF-02 (${name}): заливка после сетки и до линий проёма; сетка вне области остаётся`, () => {
      const ops = draw(walls, { doorways: [make()] })
      const at = fillIndexes(ops)[0]
      expect(at).toBeGreaterThan(-1)
      // сетка нарисована до заливки; линии внутри области — после неё
      expect(ops.findIndex((o) => o.kind === "stroke")).toBeLessThan(at)
      const inner = [S({ x: 101, y: -9 }), S({ x: 219, y: 9 })]
      ops.forEach((o, i) => {
        if (o.kind !== "stroke") return
        const inside = segments(o).some(([p, q]) => [p, q].every((v) => v.x > inner[0].x && v.x < inner[1].x && v.y > inner[0].y && v.y < inner[1].y))
        if (inside) expect(i, "линия внутри области нарисована до заливки").toBeGreaterThan(at)
      })
      // заливка не выходит за область: точка вне неё не закрашена
      for (const o of ops) if (o.kind === "fill" && o.fillStyle === PAPER) expect(insidePolygon(S({ x: 300, y: 0 }), o.subpaths[0] ?? [])).toBe(false)
    })
  }

  it("OF-03: подсветка выделения, наведения и рамки лежит поверх заливки", () => {
    const d = doorway()
    const cases: [string, RenderOptions, string][] = [
      ["выделение", { doorways: [d], selectedDoorways: [d] }, LIGHT_PALETTE.selection],
      ["наведение", { doorways: [d], hoverDoorway: d }, LIGHT_PALETTE.erase],
      ["рамка", { doorways: [d], marqueeHits: { walls: [], dims: [], doorways: [d] } }, LIGHT_PALETTE.marqueeWall],
    ]
    for (const [name, opts, color] of cases) {
      const ops = draw(walls, opts)
      const at = fillIndexes(ops)[0]
      const outline = ops.findIndex((o) => o.kind === "stroke" && o.strokeStyle === color)
      expect(outline, name).toBeGreaterThan(-1)
      expect(outline, name).toBeGreaterThan(at)
    }
  })

  it("OF-04: два проёма на стене — заливка у каждого, у второго своя область", () => {
    const second = door("W", "a", 300, 60, 210, "d1")
    const ops = draw(walls, { doorways: [doorway(), second] })
    expect(fillIndexes(ops)).toHaveLength(1)
    const other = ops.filter((o) => o.kind === "fill" && o.fillStyle === PAPER && o.subpaths[0]?.some((p) => Math.abs(p.x - S({ x: 300, y: 0 }).x) <= TOL))
    expect(other).toHaveLength(1)
  })

  it("OF-05: без проёмов заливки бумагой нет", () => {
    const ops = draw(walls, { doorways: [] })
    expect(ops.some((o) => o.kind === "fill" && o.fillStyle === PAPER)).toBe(false)
  })
})
