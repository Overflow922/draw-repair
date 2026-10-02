import { describe, expect, it } from "vitest"
import { drawScene } from "./render"
import type { RenderOptions } from "./render"
import type { Point, View, Wall } from "./types"
import { PX_PER_CM } from "./types"
import { W } from "./wall-snap.test-utils"
import { contrastOnWhite, parseColor, strokeRecorder, strokesAlong } from "./wall-tracking.test-utils"
import type { StrokeRecord, Track } from "./wall-tracking.test-utils"

// Тесты change wall-axis-tracking-snap: отрисовка линий трекинга (spec wall-drawing
// «Трекинг по узлам чертежа», design D3). Линии передаются в drawScene через RenderOptions.

const INK = "#333" // контур стен
const GRID_STROKE = "#e0e0e0"
const SQUARE_STROKE = "#999" // квадрат установки

const TRACK: Track = { from: { x: 103, y: 0 }, to: { x: 103, y: 210 } }

const screen = (p: Point, view: View): Point => {
  const k = PX_PER_CM * view.zoom
  return { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
}

function draw(walls: Wall[], view: View, opts: RenderOptions): StrokeRecord[] {
  const { ctx, strokes } = strokeRecorder()
  drawScene(ctx, 1200, 900, walls, null, "mm", view, [], opts)
  return strokes
}

const isDashed = (s: StrokeRecord): boolean => s.dashPx.some((v) => v > 0)

describe("отрисовка линий трекинга", () => {
  it("TRK-R-1: линия от узла до конца — пунктир контрастного цвета, отличного от стен и сетки", () => {
    const view: View = { zoom: 1, pan: { x: -50, y: -50 } }
    const strokes = draw([W(0, 0, 103, 0)], view, { tracks: [TRACK] })
    const lines = strokesAlong(strokes, screen(TRACK.from, view), screen(TRACK.to, view))
    expect(lines).toHaveLength(1)
    const [line] = lines
    expect(isDashed(line)).toBe(true)
    expect(line.widthPx).toBeGreaterThanOrEqual(1)
    // не сливается со стенами, сеткой, квадратом установки
    for (const style of [INK, GRID_STROKE, SQUARE_STROKE]) expect(line.strokeStyle.toLowerCase()).not.toBe(style)
    // контрастна на белом фоне холста: не менее 3:1 (WCAG, неречевые элементы)
    const rgb = parseColor(line.strokeStyle)
    expect(rgb, `цвет ${line.strokeStyle}`).not.toBeNull()
    if (rgb) expect(contrastOnWhite(rgb)).toBeGreaterThanOrEqual(3)
  })

  it("TRK-R-4: каждая из двух линий трекинга рисуется пунктиром", () => {
    const view: View = { zoom: 1, pan: { x: -50, y: -50 } }
    const second: Track = { from: { x: 400, y: 57 }, to: { x: 103, y: 57 } }
    const first: Track = { from: { x: 103, y: 0 }, to: { x: 103, y: 57 } }
    const strokes = draw([W(0, 0, 103, 0), W(400, 57, 500, 57)], view, { tracks: [first, second] })
    for (const t of [first, second]) {
      const lines = strokesAlong(strokes, screen(t.from, view), screen(t.to, view)).filter(isDashed)
      expect(lines, `линия от (${t.from.x}, ${t.from.y})`).toHaveLength(1)
    }
  })

  it("TRK-R-2: толщина и пунктир в пикселях экрана не зависят от масштаба вида", () => {
    const records = [0.25, 1, 4].map((zoom) => {
      const view: View = { zoom, pan: { x: 0, y: -20 } }
      const lines = strokesAlong(draw([W(0, 0, 103, 0)], view, { tracks: [TRACK] }), screen(TRACK.from, view), screen(TRACK.to, view))
      expect(lines, `zoom ${zoom}`).toHaveLength(1)
      return lines[0]
    })
    const [base, ...rest] = records
    for (const r of rest) {
      expect(r.widthPx).toBeCloseTo(base.widthPx, 9)
      expect(r.dashPx).toHaveLength(base.dashPx.length)
      r.dashPx.forEach((v, i) => expect(v).toBeCloseTo(base.dashPx[i], 9))
      expect(r.strokeStyle).toBe(base.strokeStyle)
    }
  })

  it("TRK-R-3: без линий трекинга пунктирной линии от узла до конца нет", () => {
    const view: View = { zoom: 1, pan: { x: -50, y: -50 } }
    for (const opts of [{}, { tracks: [] }, { tracks: null }] satisfies RenderOptions[]) {
      const lines = strokesAlong(draw([W(0, 0, 103, 0)], view, opts), screen(TRACK.from, view), screen(TRACK.to, view))
      expect(lines.filter(isDashed)).toHaveLength(0)
    }
  })
})
