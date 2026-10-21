import { describe, expect, it } from "vitest"
import type { Drawing, PlasterMark, Wall } from "../types"
import { plasterStrip } from "./plaster"
import { plasterDimensions } from "./plaster-dimensions"
import { roughScene } from "./rough-scene"
import { drawing, plaster, wall } from "./rough.test-utils"

// change plaster-corner-wrap: угол двух боковых полос (spec rough-works-plan «Угол двух боковых полос»)

const K = 2
const LABEL = 14

const A = (): Wall => wall("A", 0, 0, 500, 0)
const B = (): Wall => wall("B", 500, 0, 500, 400)

interface Box {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function stripBox(d: Drawing, markId: string): Box | null {
  const piece = roughScene(d).pieces.find((p) => p.mark.id === markId)
  if (!piece) return null
  const pts = plasterStrip(piece)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

// единственный сегмент ширины размера пометки
function width(d: Drawing, markId: string): number | undefined {
  const scene = roughScene(d)
  const piece = scene.pieces.find((p) => p.mark.id === markId)
  const dims = piece ? plasterDimensions(piece, scene.pieces, scene.base.walls, "cm", K, LABEL, scene.base.doorways) : []
  return dims.find((x) => x.target === "width")?.valueCm
}

const marks = (faceA: 1 | -1, faceB: 1 | -1, tA = 20, tB = 20): PlasterMark[] => [
  plaster("p", "A", faceA, "a", 0, 500, tA),
  plaster("q", "B", faceB, "a", 0, 400, tB),
]

describe("внутренний угол", () => {
  it("CW-1: полосы кончаются на гранях соседей, размеры 488 и 388", () => {
    const d = drawing({ walls: [A(), B()], roughPlaster: marks(1, 1) })
    expect(stripBox(d, "p")).toMatchObject({ minX: 0, maxX: 490 })
    expect(stripBox(d, "q")).toMatchObject({ minY: 10, maxY: 400 })
    expect(width(d, "p")).toBeCloseTo(488, 6)
    expect(width(d, "q")).toBeCloseTo(388, 6)
  })

  it("CW-2: смена толщины соседа меняет размер, но не полосу до грани и не размер соседа", () => {
    const d = drawing({ walls: [A(), B()], roughPlaster: marks(1, 1, 20, 50) })
    expect(stripBox(d, "p")).toMatchObject({ minX: 0, maxX: 490 })
    expect(width(d, "p")).toBeCloseTo(485, 6)
    expect(width(d, "q")).toBeCloseTo(388, 6)
  })
})

describe("внешний угол", () => {
  it("CW-3: ведущая полоса A закрывает угол, полосы не накладываются; размеры 512 и 410", () => {
    const d = drawing({ walls: [A(), B()], roughPlaster: marks(-1, -1) })
    expect(stripBox(d, "p")).toMatchObject({ minX: 0, maxX: 512, minY: -12, maxY: -10 })
    expect(stripBox(d, "q")).toMatchObject({ minX: 510, maxX: 512, minY: -10, maxY: 400 })
    expect(width(d, "p")).toBeCloseTo(512, 6)
    expect(width(d, "q")).toBeCloseTo(410, 6)
  })

  it.each([
    [37, 513.7],
    [55, 515.5],
  ])("CW-4: толщина соседа %i мм даёт полосу и размер ведущей %f", (tB, expected) => {
    const d = drawing({ walls: [A(), B()], roughPlaster: marks(-1, -1, 20, tB) })
    expect(stripBox(d, "p")?.maxX).toBeCloseTo(expected, 6)
    expect(width(d, "p")).toBeCloseTo(expected, 6)
    expect(width(d, "q")).toBeCloseTo(410, 6)
  })

  it("CW-5: толщина ведущей полосы меняет её ширину, но не длину", () => {
    const d = drawing({ walls: [A(), B()], roughPlaster: marks(-1, -1, 37, 20) })
    expect(stripBox(d, "p")).toMatchObject({ maxX: 512, minY: -13.7, maxY: -10 })
    expect(width(d, "p")).toBeCloseTo(512, 6)
    expect(width(d, "q")).toBeCloseTo(410, 6)
  })

  it("CW-6: без полосы соседа ведущая кончается у края грани", () => {
    const d = drawing({ walls: [A(), B()], roughPlaster: [plaster("p", "A", -1, "a", 0, 500)] })
    expect(stripBox(d, "p")?.maxX).toBeCloseTo(510, 6)
    expect(width(d, "p")).toBeCloseTo(510, 6)
  })

  it("CW-7: ведущей становится полоса стены, стоящей в чертеже раньше", () => {
    const d = drawing({ walls: [B(), A()], roughPlaster: marks(-1, -1) })
    expect(stripBox(d, "q")).toMatchObject({ minY: -12, maxY: 400 })
    expect(width(d, "q")).toBeCloseTo(412, 6)
    expect(stripBox(d, "p")?.maxX).toBeCloseTo(510, 6)
    expect(width(d, "p")).toBeCloseTo(510, 6)
  })
})
