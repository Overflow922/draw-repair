import { describe, expect, it } from "vitest"
import { dashRecorder } from "../doorway/selection-editing.test-utils"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing } from "../reconstruction/reconstruction.test-utils"
import { recordingContext } from "../room-area.test-utils"
import type { TextOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing, FurnitureItem } from "../types"
import { conflictColor, drawFurnitureScene } from "./furniture-render"
import type { FurnitureView } from "./furniture-render"
import type { ItemNumber } from "./item-number"
import type { Overlap } from "./overlap"
import { itemSizeLayout } from "./item-size-layout"
import { itemDistanceLayout, reachBodies } from "./item-wall-reach"
import { rectWalls } from "../rough/rough.test-utils"

// change furniture-dimensions: слой габаритов и чисел выделенного предмета на холсте
// (spec furniture-plan «Габариты предмета мебели», «Правка габаритов на месте», «Расстояния выделенного предмета до стен»,
// «Отображение плана «Мебель» и цвет стола»)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const SCREEN = { labelPx: 14, dimTextGapPx: 1.5 }
const table = (id: string, x: number, y: number): FurnitureItem => ({ id, kind: "table", x, y, widthCm: 80, lengthCm: 160, angleDeg: 0 })
const chair = (id: string, x: number, y: number): FurnitureItem => ({ id, kind: "chair", x, y, widthCm: 45, lengthCm: 45, angleDeg: 0 })

const viewOf = (d: Drawing, extra: Partial<FurnitureView> = {}): FurnitureView => {
  const s = reconstructionScene(d)
  return { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, items: [], ...extra }
}

const texts = (view: FurnitureView): TextOp[] => {
  const rec = recordingContext()
  drawFurnitureScene(rec.ctx, 800, 600, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops.filter((o): o is TextOp => o.kind === "fillText")
}

const dashedCount = (view: FurnitureView): number => {
  const rec = dashRecorder()
  drawFurnitureScene(rec.ctx, 800, 600, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.dashed.length
}

// числа выделенного стола — та же раскладка, что строит холст
const editableOf = (t: FurnitureItem): { itemId: string; numbers: ItemNumber[] } => ({
  itemId: t.id,
  numbers: [...itemSizeLayout(t, "cm", 2, SCREEN), ...itemDistanceLayout(t, reachBodies(rectWalls("w", -10, -10, 410, 310)), "cm", 2, SCREEN)],
})

describe("габариты на холсте", () => {
  it("FD-400: габариты у всех предметов без выделения — «80» и «160» у стола, «45» дважды у стула", () => {
    const shown = texts(viewOf(drawing(), { items: [table("t", 200, 100), chair("c", 400, 100)] })).map((o) => o.text)
    expect(shown.filter((x) => x === "80")).toHaveLength(1)
    expect(shown.filter((x) => x === "160")).toHaveLength(1)
    expect(shown.filter((x) => x === "45")).toHaveLength(2)
  })

  it("FD-401: у призрака постановки — габариты «45» и «45»", () => {
    const shown = texts(viewOf(drawing(), { itemGhost: chair("", 300, 200) })).map((o) => o.text)
    expect(shown).toEqual(["45", "45"])
  })

  it("FD-402: числа габаритов нарисованы цветом размеров плана поверх подсветки пересечения", () => {
    const rec = recordingContext()
    const overlap: Overlap = { kind: "wall", itemId: "t", itemKind: "table", region: [{ x: 160, y: 20 }, { x: 240, y: 20 }, { x: 240, y: 40 }, { x: 160, y: 40 }] }
    drawFurnitureScene(rec.ctx, 800, 600, viewOf(drawing(), { items: [table("t", 200, 100)], overlaps: [overlap] }), "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
    const fill = rec.ops.findIndex((o) => o.kind === "fill" && o.fillStyle === conflictColor("light"))
    const width = rec.ops.findIndex((o) => o.kind === "fillText" && o.text === "80")
    expect(fill).toBeGreaterThanOrEqual(0)
    expect(width).toBeGreaterThan(fill)
    const op = rec.ops[width]
    expect(op?.kind === "fillText" ? op.fillStyle : null).toBe(LIGHT_PALETTE.ink)
  })

  it("FD-403: без выделения ни одно число не подчёркнуто", () => {
    expect(dashedCount(viewOf(drawing(), { items: [table("t", 200, 100), chair("c", 400, 100)] }))).toBe(0)
  })
})

describe("числа выделенного предмета", () => {
  const t = table("t", 100, 120)

  it("FD-410: у выделенного — габариты и четыре расстояния; габариты не рисуются дважды", () => {
    const shown = texts(viewOf(drawing(), { items: [t], editable: editableOf(t) })).map((o) => o.text).sort()
    expect(shown).toEqual(["100", "160", "260", "40", "60", "80"])
  })

  it("FD-411: числа выделенного подчёркнуты, у второго стола — нет", () => {
    const other = table("o", 300, 120)
    const withSelection = dashedCount(viewOf(drawing(), { items: [t, other], editable: editableOf(t) }))
    // шесть правимых чисел выделенного стола — шесть штриховых подчёркиваний; у второго стола — ни одного
    expect(withSelection).toBe(6)
  })

  it("FD-412: нулевое расстояние — «0» без размерной линии, подчёркнутое", () => {
    const flush = table("f", 40, 120) // левая сторона на грани x = 0
    const view = viewOf(drawing(), { items: [flush], editable: editableOf(flush) })
    expect(texts(view).map((o) => o.text)).toContain("0")
    expect(dashedCount(view)).toBe(6)
  })
})
