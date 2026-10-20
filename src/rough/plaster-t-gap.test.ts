import { describe, expect, it } from "vitest"
import type { Drawing, PlasterMark, Point } from "../types"
import { plasterPieces, plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { plasterDimensions } from "./plaster-dimensions"
import { createPlasterTool } from "./plaster-tool"
import type { PlasterToolHost } from "./plaster-tool"
import { roughScene } from "./rough-scene"
import { areaOf, drawing, idGen, plaster, wall } from "./rough.test-utils"

// change plaster-t-gap-opposite-face: штукатурка сплошная через T-примыкание, когда оси стен плоскости оканчиваются на гранях
// перпендикулярной стены (spec rough-works-plan «Штукатурка не прерывается на стыке коллинеарных стен», сценарии «Оси стен плоскости
// оканчиваются на гранях T-примыкания» и «Сохранённая пометка через T-примыкание действует сплошной»)

const at = (x: number, y: number): Point => ({ x, y })
const base = (id: string): string => id.replace(/~\d+$/, "")

// плоскость y = −5 (грань −1): брусья W1 и W2 толщиной 10 см оканчиваются на гранях S (x = 490 и 510), S стоит снизу
const W1 = wall("W1", 0, 0, 490, 0, 10)
const W2 = wall("W2", 510, 0, 1000, 0, 10)
const S = wall("S", 500, 5, 500, 200, 20)

const NONE: PlasterMark[] = []

function clickSetup(initial: Drawing) {
  let d = initial
  const host: PlasterToolHost = {
    drawing: () => d,
    scene: () => roughScene(d),
    marks: () => d.roughPlaster ?? NONE,
    setMarks: (next) => {
      d = { ...d, roughPlaster: next }
    },
    record: () => undefined,
    changed: () => undefined,
    redraw: () => undefined,
    radiusCm: () => 5,
    newId: idGen(),
    newThicknessMm: () => 20,
  }
  const tool = createPlasterTool(host)
  return {
    click: (p: Point): void => {
      tool.down(at(0, 0))
      tool.up(p, at(1, 1))
    },
    drawing: () => d,
  }
}

// интервалы x полос, лежащих на линии плоскости (внешняя сторона полосы — y = lineY)
function runsAlong(pieces: readonly PlasterPiece[], lineY: number): (readonly [number, number])[] {
  return pieces
    .map((p) => plasterStrip(p))
    .filter((poly) => poly.some((q) => Math.abs(q.y - lineY) < 1e-6))
    .map((poly) => [Math.min(...poly.map((q) => q.x)), Math.max(...poly.map((q) => q.x))] as const)
    .sort((p, q) => p[0] - q[0])
}

function expectContinuous(spans: readonly (readonly [number, number])[], from: number, to: number): void {
  expect(spans[0]?.[0]).toBeCloseTo(from)
  expect(spans[spans.length - 1]?.[1]).toBeCloseTo(to)
  spans.slice(1).forEach(([lo], i) => expect(lo).toBeCloseTo(spans[i]?.[1] ?? NaN))
}

describe("оси стен плоскости оканчиваются на гранях T-примыкания", () => {
  it("TG-1: после клика пометки в пределах осей, а полоса непрерывна от x = 0 до x = 1000", () => {
    const s = clickSetup(drawing({ walls: [W1, W2, S] }))
    s.click(at(100, -4))
    const marks = (s.drawing().roughPlaster ?? []).flatMap((m) => (m.face === "end" ? [] : [[m.wallId, m.face, m.fromCm, m.toCm]]))
    expect(marks).toEqual([
      ["W1", -1, 0, 490],
      ["W2", -1, 0, 490],
    ])
    expectContinuous(runsAlong(plasterPieces(s.drawing()), -7), 0, 1000)
  })

  it("TG-2: сохранённые пометки без клика дают ту же сплошную полосу и не рвут цепочку размеров", () => {
    const d = drawing({ walls: [W1, W2, S], roughPlaster: [plaster("m1", "W1", -1, "a", 0, 490), plaster("m2", "W2", -1, "a", 0, 490)] })
    const pieces = plasterPieces(d)
    expectContinuous(runsAlong(pieces, -7), 0, 1000)
    // цепочка не разрывается: линия размера W1 доходит до начала линии размера W2 (совпадение границ — change plaster-dimension-collinear-joint)
    const extent = (id: string): readonly [number, number] => {
      const piece = pieces.find((p) => base(p.wall.id) === id)
      const xs = piece ? plasterDimensions(piece, pieces, d.walls, "cm", 2, 14).filter((x) => x.side === -1 && x.target === "width").flatMap((x) => [x.geom.p1.x, x.geom.p2.x]) : []
      return [Math.min(...xs), Math.max(...xs)]
    }
    expect(extent("W1")[1]).toBeGreaterThanOrEqual(extent("W2")[0] - 1e-6)
  })

  it("TG-5: площадь штукатурки включает щель на ширине S: 1000 × 2 см", () => {
    const d = drawing({ walls: [W1, W2, S], roughPlaster: [plaster("m1", "W1", -1, "a", 0, 490), plaster("m2", "W2", -1, "a", 0, 490)] })
    expect(areaOf(plasterPieces(d).map(plasterStrip))).toBeCloseTo(1000 * 2, 6)
  })

  it("TG-3: пометка одной стены без пометки у соседа не заходит в щель", () => {
    const d = drawing({ walls: [W1, W2, S], roughPlaster: [plaster("m1", "W1", -1, "a", 0, 490)] })
    expectContinuous(runsAlong(plasterPieces(d), -7), 0, 490)
  })
})

describe("чертёж пользователя: коридор «Чертежа 2»", () => {
  // стены «Монтажа» вокруг стоек cb6ccd90 (x = 458.2) и 7db5d9ff (x = 783.4); пометки на грани коридора поставлены кликом
  const walls = [
    wall("9f8296c0", 453.2, 390.4, 353.2, 390.4, 10, "blocks"),
    wall("9c596e0b", 463.2, 390.4, 778.4, 390.4, 10, "blocks"),
    wall("c0da63a1", 788.4, 390.4, 1099.8, 390.4, 10, "blocks"),
    wall("cb6ccd90", 458.2, 665.4, 458.2, 395.4, 10, "blocks"),
    wall("7db5d9ff", 783.4, 395.4, 783.4, 828.9, 10, "blocks"),
  ]
  const own = [walls[0], walls[1], walls[2], walls[3], walls[4]].flatMap((w) => (w ? [w] : []))
  const d: Drawing = {
    ...drawing({ walls: [], mounting: { walls: own, dimensions: [] } }),
    roughPlaster: [
      { id: "9d2515f5", wallId: "9f8296c0", face: 1, anchor: "a", fromCm: 0, toCm: 100, thicknessMm: 20 },
      { id: "d5b00b5a", wallId: "9c596e0b", face: -1, anchor: "a", fromCm: 0, toCm: 315.2, thicknessMm: 20 },
      { id: "de50a92e", wallId: "c0da63a1", face: -1, anchor: "a", fromCm: 0, toCm: 311.4, thicknessMm: 20 },
    ],
  }

  it("TG-4: щелей по 10 см над стойками (x = 453.2…463.2 и 778.4…788.4) нет", () => {
    const spans = runsAlong(plasterPieces(d), 383.4)
    expect(spans.length).toBeGreaterThan(0)
    spans.slice(1).forEach(([lo], i) => expect(lo).toBeCloseTo(spans[i]?.[1] ?? NaN))
  })
})
