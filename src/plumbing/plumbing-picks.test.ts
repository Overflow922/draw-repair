import { describe, expect, it } from "vitest"
import { erasePick, pressPick } from "../doorway/doorway-scene"
import { nearestDimAnchor } from "../geometry"
import type { Dimension, DimPoint, FurnitureItem, Wall } from "../types"

// change add-plumbing-plan: ластик и нажатие на плане «Сантехника» не берут приборы, а размеры к приборам — берут
// (spec drawing-plans «Ластик «Сантехники» не трогает приборы», «Delete на «Сантехнике» не удаляет приборы»; design D3, D4)
//
//  схематично, не в масштабе: угол стен W1/W2 с вершиной V = (0, 0), раковина S 45 × 40 с центром (107.5, 20),
//  размер V → центр S с линией на y = −20 (выше раковины)
//
//   ---------------------------------  y = -20  размер
//   V###############################   y = 0
//   #             +-------+
//   #             |   S   |            клик по (107.5, 25) — внутри раковины
//   #             +-------+

const W1: Wall = { id: "w1", a: { x: -20, y: -10 }, b: { x: 400, y: -10 }, thicknessCm: 20, type: "brick" }
const W2: Wall = { id: "w2", a: { x: -10, y: -20 }, b: { x: -10, y: 400 }, thicknessCm: 20, type: "brick" }
const S: FurnitureItem = { id: "s", kind: "sink", x: 107.5, y: 20, widthCm: 45, lengthCm: 40, angleDeg: 0 }

const vertexV = (): DimPoint => {
  const hit = nearestDimAnchor({ x: 0.5, y: 0.5 }, [W1, W2], [], 5)
  if (!hit) throw new Error("нет вершины V")
  return hit.anchor
}
const dim = (): Dimension => ({ from: vertexV(), to: { kind: "item", itemId: "s", at: { kind: "center" } }, offset: -20 })

describe("выбор на плане «Сантехника»", () => {
  it("PK-01: клик ластика внутри раковины ничего не берёт", () => {
    expect(erasePick({ x: 107.5, y: 25 }, { walls: [W1, W2], dimensions: [dim()], doorways: [], items: [S] }, 5, 2)).toBeNull()
  })

  it("PK-02: клик ластика по линии размера к раковине берёт размер", () => {
    const d = dim()
    expect(erasePick({ x: 50, y: -20 }, { walls: [W1, W2], dimensions: [d], doorways: [], items: [S] }, 5, 2)).toEqual({ kind: "dimension", dimension: d })
  })

  it("PK-03: без списка приборов размер к прибору не разрешается и не берётся", () => {
    // точка лежит и в теле стены W1: стена подложки на плане только для чтения, её отсекает main.ts (editableWall)
    expect(erasePick({ x: 50, y: -20 }, { walls: [W1, W2], dimensions: [dim()], doorways: [] }, 5, 2)?.kind).not.toBe("dimension")
  })

  it("PK-04: нажатие внутри раковины без инструмента ничего не выделяет", () => {
    const options = { selectedWall: null, middleMarker: false, dimensions: true, elements: false }
    expect(pressPick({ x: 107.5, y: 25 }, { walls: [W1, W2], dimensions: [dim()], doorways: [], items: [S] }, 5, 2, options)).toBeNull()
  })
})
