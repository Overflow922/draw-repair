import { describe, expect, it } from "vitest"
import { dashRecorder } from "../doorway/selection-editing.test-utils"
import { itemSizeLayout } from "../furniture/item-size-layout"
import { nearestDimAnchor } from "../geometry"
import { recordingContext } from "../room-area.test-utils"
import type { TextOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Dimension, DimPoint, FurnitureItem, Wall } from "../types"
import { drawPlumbingScene } from "./plumbing-render"
import type { PlumbingView } from "./plumbing-render"

// change add-plumbing-plan: отрисовка плана «Сантехника» на холсте
// (spec plumbing-plan «Отображение плана «Сантехника»», сценарии «Габариты раковины», «Габариты не правятся», «Размер поверх
// габарита»; design D7)
//
//  вид сверху, схематично, не в масштабе. Стены W1 и W2 толщиной 20 см сходятся углом, внутренняя вершина V = (0, 0).
//  Раковина S 45 × 40, угол 0, центр C = (107.5, 20); размер плана от V до C — 107,5, линия на смещении над раковиной
//
//   V######################################
//   #|<--------- 107,5 -------->|            <-- размер плана
//   #|              +-----------:-----------+
//   #|              |    45     C           | 40
//   #               +-----------------------+

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const W1: Wall = { id: "w1", a: { x: -20, y: -10 }, b: { x: 400, y: -10 }, thicknessCm: 20, type: "brick" }
const W2: Wall = { id: "w2", a: { x: -10, y: -20 }, b: { x: -10, y: 400 }, thicknessCm: 20, type: "brick" }
const sink = (): FurnitureItem => ({ id: "s", kind: "sink", x: 107.5, y: 20, widthCm: 45, lengthCm: 40, angleDeg: 0 })

const vertexV = (): DimPoint => {
  const hit = nearestDimAnchor({ x: 0.5, y: 0.5 }, [W1, W2], [], 5)
  if (!hit) throw new Error("нет вершины V")
  return hit.anchor
}
// размер от V до центра раковины; смещение ставит его линию над габаритом ширины
const toCenter = (): Dimension => ({ from: vertexV(), to: { kind: "item", itemId: "s", at: { kind: "center" } }, offset: -20 })

const viewOf = (items: FurnitureItem[]): PlumbingView => ({ walls: [W1, W2], doorways: [], pieces: [], drywall: [], items })
const OPTS = { grid: false, palette: LIGHT_PALETTE, theme: "light" } as const

const texts = (items: FurnitureItem[], dimensions: Dimension[] = []): TextOp[] => {
  const rec = recordingContext()
  drawPlumbingScene(rec.ctx, 800, 600, viewOf(items), "cm", VIEW, { ...OPTS, dimensions })
  return rec.ops.filter((o): o is TextOp => o.kind === "fillText")
}

describe("холст плана «Сантехника»", () => {
  it("PR-01: у раковины габариты «45» и «40» — те же числа, что на «Мебели»", () => {
    const shown = texts([sink()]).map((o) => o.text)
    expect(shown).toEqual(itemSizeLayout(sink(), "cm", 2, { labelPx: 14, dimTextGapPx: 1.5 }).map((n) => n.text))
    expect([...shown].sort()).toEqual(["40", "45"])
  })

  it("PR-02: размер плана к центру раковины нарисован числом 108 (107,5 см) после габаритов — поверх них", () => {
    const ops = texts([sink()], [toCenter()]).map((o) => o.text)
    const dim = ops.indexOf("108")
    expect(dim).toBeGreaterThan(ops.indexOf("45"))
    expect(dim).toBeGreaterThan(ops.indexOf("40"))
  })

  it("PR-03: размер к прибору, которого нет в сцене, не рисуется", () => {
    expect(texts([], [toCenter()]).map((o) => o.text)).not.toContain("108")
  })

  it("PR-04: ни габариты, ни размер плана не подчёркнуты — числа не правятся", () => {
    const rec = dashRecorder()
    drawPlumbingScene(rec.ctx, 800, 600, viewOf([sink()]), "cm", VIEW, { ...OPTS, dimensions: [toCenter()] })
    expect(rec.dashed).toHaveLength(0)
  })
})
