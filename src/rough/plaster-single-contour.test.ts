import { describe, expect, it } from "vitest"
import type { Drawing, PlasterMark, Wall } from "../types"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { plasterDimensions } from "./plaster-dimensions"
import { endDimension } from "./plaster-end"
import { endDimensionBounds } from "./plaster-end-bounds"
import { roughScene } from "./rough-scene"
import { boxOf, drawing, plaster, wall } from "./rough.test-utils"

// change plaster-single-contour: полосы одного угла образуют единый контур (spec rough-works-plan «Единый контур штукатурки»,
// «Пометка штукатурки» — «Размер торца у внутреннего угла»)

const K = 2
const LABEL = 14

const endMark = (id: string, wallId: string, anchor: "a" | "b", thicknessMm: number): PlasterMark => ({ id, wallId, face: "end", anchor, thicknessMm })

const pieceOf = (d: Drawing, markId: string): PlasterPiece => {
  const piece = roughScene(d).pieces.find((p) => p.mark.id === markId)
  if (!piece) throw new Error(`no piece ${markId}`)
  return piece
}

const boxOfMark = (d: Drawing, markId: string) => boxOf([plasterStrip(pieceOf(d, markId))])

const boundsOf = (d: Drawing, markId: string): [number, number] => endDimensionBounds(pieceOf(d, markId), roughScene(d).pieces)

// выступ S (ось вверх: (0, −10) → (0, −30), толщина 20 см) у стены W; грань +1 — x = 10, грань −1 — x = −10
const protrusion = (endMm: number, sideMm: number, otherSideMm: number): Drawing =>
  drawing({
    walls: [wall("W", -100, 0, 100, 0), wall("S", 0, -10, 0, -30)],
    roughPlaster: [endMark("e", "S", "b", endMm), plaster("l", "S", 1, "a", 0, 20, sideMm), plaster("r", "S", -1, "a", 0, 20, otherSideMm)],
  })

describe("внешний угол торца: боковые полосы разной толщины", () => {
  it("SC-1: торец 20 мм, боковые 14 и 30 мм — торец доходит до внешних поверхностей обеих, размер 24,4", () => {
    const d = protrusion(20, 14, 30)
    expect(boxOfMark(d, "e")).toMatchObject({ minX: -13, maxX: 11.4, minY: -32, maxY: -30 })
    const [from, to] = boundsOf(d, "e")
    expect(to - from).toBeCloseTo(24.4, 6)
    expect(endDimension(wall("S", 0, -10, 0, -30), "b", from, to, 20, "mm", K, LABEL)?.text).toBe("244")
  })

  it("SC-2: торец 10 мм тоньше боковых — он всё равно достраивается до их внешних поверхностей", () => {
    const d = protrusion(10, 14, 30)
    expect(boxOfMark(d, "e")).toMatchObject({ minX: -13, maxX: 11.4, minY: -31, maxY: -30 })
    const [from, to] = boundsOf(d, "e")
    expect(to - from).toBeCloseTo(24.4, 6)
  })

  it("SC-3: торец 50 мм — края по бокам те же, размеры боковых полос длиннее на 3 см", () => {
    const sideWidth = (d: Drawing): number | undefined => {
      const scene = roughScene(d)
      const dims = plasterDimensions(pieceOf(d, "l"), scene.pieces, scene.base.walls, "cm", K, LABEL, scene.base.doorways)
      return dims.find((x) => x.target === "width")?.valueCm
    }
    const thin = protrusion(20, 14, 30)
    const thick = protrusion(50, 14, 30)
    expect(boxOfMark(thick, "e")).toMatchObject({ minX: -13, maxX: 11.4, minY: -35, maxY: -30 })
    const [from, to] = boundsOf(thick, "e")
    expect(to - from).toBeCloseTo(24.4, 6)
    expect((sideWidth(thick) ?? 0) - (sideWidth(thin) ?? 0)).toBeCloseTo(3, 6)
  })

  it("SC-4: без боковой полосы с одной стороны расширения с неё нет", () => {
    const d = drawing({
      walls: [wall("W", -100, 0, 100, 0), wall("S", 0, -10, 0, -30)],
      roughPlaster: [endMark("e", "S", "b", 20), plaster("l", "S", 1, "a", 0, 20, 14)],
    })
    expect(boxOfMark(d, "e")).toMatchObject({ minX: -10, maxX: 11.4 })
  })
})

// H: (0, 0) → (500, 0), толщина 10 см (y −5…5), торец b свободен; грань +1 — y = 5
const H = (): Wall => wall("H", 0, 0, 500, 0, 10)
// N начинается у торца H и стоит на 0,2 см выше: её грань +1 — y = −5,2, полоса 20 мм — y −5,2…−3,2
const N = (): Wall => wall("N", 500, -10.2, 700, -10.2, 10)

describe("размер торца у внутреннего угла", () => {
  const marks = (withNeighbour: boolean): PlasterMark[] => [
    endMark("e", "H", "b", 20),
    plaster("s", "H", 1, "a", 0, 500, 14),
    ...(withNeighbour ? [plaster("n", "N", 1, "a", 0, 200, 20)] : []),
  ]

  it("SC-5: торец перекрыт полосой соседней стены — размер от её внешней поверхности: 9,6", () => {
    const d = drawing({ walls: [H(), N()], roughPlaster: marks(true) })
    expect(boxOfMark(d, "e")).toMatchObject({ minX: 500, maxX: 502, minY: -5, maxY: 6.4 })
    const [from, to] = boundsOf(d, "e")
    expect(from).toBeCloseTo(-3.2, 6)
    expect(to).toBeCloseTo(6.4, 6)
    expect(endDimension(H(), "b", from, to, 20, "mm", K, LABEL)?.text).toBe("96")
  })

  it("SC-6: без полосы соседней стены размер идёт от грани стены: 11,4", () => {
    const d = drawing({ walls: [H(), N()], roughPlaster: marks(false) })
    const [from, to] = boundsOf(d, "e")
    expect(from).toBeCloseTo(-5, 6)
    expect(to).toBeCloseTo(6.4, 6)
  })

  it("SC-7: полоса торца не обрезается соседней — перекрытие в угловом квадрате остаётся", () => {
    const withN = drawing({ walls: [H(), N()], roughPlaster: marks(true) })
    const without = drawing({ walls: [H(), N()], roughPlaster: marks(false) })
    expect(boxOfMark(withN, "e")).toEqual(boxOfMark(without, "e"))
  })
})

describe("торец «Чертёж 2»: a0048405, соседняя стена 9f8296c0", () => {
  const d = drawing({
    walls: [],
    mounting: {
      walls: [
        wall("a004", 178.9, 400.6, 353.2, 400.6, 10),
        wall("cd0c", 348.2, 395.6, 348.2, 247.4, 10),
        wall("9f82", 453.2, 390.4, 353.2, 390.4, 10),
      ],
      dimensions: [],
    },
    roughPlaster: [
      endMark("e", "a004", "b", 20),
      plaster("s", "a004", 1, "a", 0, 174.3, 14),
      plaster("f", "9f82", -1, "a", 0, 100, 20),
    ],
  })

  it("SC-8: низ торца на внешней поверхности боковой 14 мм (407,0), верх размера на внешней поверхности соседней полосы (397,4), размер 96 мм", () => {
    expect(boxOfMark(d, "e")).toMatchObject({ minX: 353.2, maxX: 355.2, maxY: 407 })
    const [from, to] = boundsOf(d, "e")
    expect(400.6 + from).toBeCloseTo(397.4, 6)
    expect(400.6 + to).toBeCloseTo(407, 6)
    expect(endDimension(wall("a004", 178.9, 400.6, 353.2, 400.6, 10), "b", from, to, 20, "mm", K, LABEL)?.text).toBe("96")
  })
})

describe("торец у края примыкающей стены и с другой стороны", () => {
  it("SC-9: торец закрыт примыканием с одного края — расширение на толщину боковой полосы (14 мм) только у открытого края", () => {
    const abut = wall("V", 500, 4, 600, 4) // тело y −6…14 закрывает торец b стены W, открыто только −10…−6
    const d = drawing({
      walls: [wall("W", 0, 0, 500, 0), abut],
      roughPlaster: [endMark("e", "W", "b", 20), plaster("s", "W", -1, "a", 0, 500, 14)],
    })
    expect(boxOfMark(d, "e")).toMatchObject({ minY: -11.4, maxY: -6 })
  })

  it("SC-10: соседняя полоса с другой стороны торца — верх границы размера на её внешней поверхности: 9,6", () => {
    // зеркало SC-5: боковая полоса на грани −1 (y = −5, 14 мм), сосед N2 ниже торца: его грань −1 — y = 5,2, полоса y 3,2…5,2
    const below = wall("N2", 500, 10.2, 700, 10.2, 10)
    const d = drawing({
      walls: [H(), below],
      roughPlaster: [endMark("e", "H", "b", 20), plaster("s", "H", -1, "a", 0, 500, 14), plaster("n", "N2", -1, "a", 0, 200, 20)],
    })
    expect(boxOfMark(d, "e")).toMatchObject({ minY: -6.4, maxY: 5 })
    const [from, to] = boundsOf(d, "e")
    expect(from).toBeCloseTo(-6.4, 6)
    expect(to).toBeCloseTo(3.2, 6)
  })
})
