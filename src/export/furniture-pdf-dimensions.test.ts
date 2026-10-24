import { describe, expect, it } from "vitest"
import { dashRecorder } from "../doorway/selection-editing.test-utils"
import { drawFurnitureScene } from "../furniture/furniture-render"
import type { FurnitureView } from "../furniture/furniture-render"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { PDF_METRICS } from "../render"
import { recordingContext } from "../room-area.test-utils"
import type { TextOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import { PX_PER_CM } from "../types"
import type { Drawing, FurnitureItem } from "../types"
import { pageBounds, pagesOf } from "./pdf"

// change furniture-dimensions: габариты предметов на странице «Мебель» (spec pdf-export «Страница плана «Мебель»»)

const SCALE = 50
const MM_PER_CM = 10 / SCALE // 0,2 мм листа на см чертежа
const INSET_CM = (PDF_METRICS.labelPx + 2 * PDF_METRICS.dimTextGapPx) / MM_PER_CM

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const withItems = (d: Drawing, items: FurnitureItem[]): Drawing => ({ ...d, furniture: { items, dimensions: [] } })
const ROOM = (): Drawing => drawing({ walls: rectWalls("k", 0, 0, 420, 520) })

// страница «Мебель» так, как её рисует экспорт: метрики PDF, масштаб страницы, без чисел выделенного
const pdfView = (d: Drawing): FurnitureView => {
  const s = reconstructionScene(d)
  return { walls: s.underlay, doorways: [], pieces: s.pieces, drywall: s.own, items: d.furniture?.items ?? [] }
}
const PAGE_VIEW = { zoom: MM_PER_CM / PX_PER_CM, pan: { x: 0, y: 0 } }
const OPTS = { grid: false, metrics: PDF_METRICS, palette: LIGHT_PALETTE, theme: "light" } as const

describe("габариты на странице «Мебель»", () => {
  it("FD-500: стол 80 × 160 при 1:50 — числа «80» и «160» на странице, без подчёркивания", () => {
    const d = withItems(ROOM(), [item("t", "table", 200, 260, 80, 160)])
    const rec = recordingContext()
    drawFurnitureScene(rec.ctx, 420, 297, pdfView(d), "cm", PAGE_VIEW, OPTS)
    const shown = rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text)
    expect(shown).toContain("80")
    expect(shown).toContain("160")
    const dash = dashRecorder()
    drawFurnitureScene(dash.ctx, 420, 297, pdfView(d), "cm", PAGE_VIEW, OPTS)
    expect(dash.dashed).toEqual([])
  })

  it("FD-501: телевизор 91 × 11 при 1:50 — оба размера снаружи, страница их охватывает", () => {
    // телевизор левее и выше комнаты: его левый и верхний края — край габаритов страницы, если бы размеры были внутри
    const tv = item("v", "tv", -1000, -1000, 91, 11)
    const left = tv.x - tv.widthCm / 2
    const top = tv.y - tv.lengthCm / 2
    // эталон: предмет с теми же левым и верхним краями, размеры которого помещаются внутрь
    const big = item("b", "table", left + 200, top + 200, 400, 400)
    const page = (it: FurnitureItem) => {
      const p = pagesOf(withItems(ROOM(), [it]))[5]
      if (!p) throw new Error("нет страницы «Мебель»")
      return pageBounds(p, SCALE)
    }
    const base = page(big)
    const withTv = page(tv)
    expect(withTv.minX).toBeLessThanOrEqual(base.minX - INSET_CM + 1e-6)
    expect(withTv.minY).toBeLessThanOrEqual(base.minY - INSET_CM + 1e-6)
  })

  it("FD-502: габариты страницы не зависят от зума холста", () => {
    const d = withItems(ROOM(), [item("v", "tv", 200, 260, 91, 11)])
    const zoomed: Drawing = { ...d, view: { zoom: 3, pan: { x: 40, y: -20 } } }
    const at = (x: Drawing) => {
      const p = pagesOf(x)[5]
      if (!p) throw new Error("нет страницы «Мебель»")
      return pageBounds(p, SCALE)
    }
    expect(at(zoomed)).toEqual(at(d))
  })
})
