import { describe, expect, it } from "vitest"
import { door, w } from "./doorway/doorway.test-utils"
import { drawScene } from "./render"
import type { Point, View } from "./types"
import { PX_PER_CM } from "./types"
import { jambTracks, snapStartVertex } from "./wall-snap"
import { strokeRecorder, strokesAlong } from "./stroke-recorder.test-utils"
import type { StrokeRecord } from "./stroke-recorder.test-utils"

// change snap-wall-to-opening-jambs: линия привязки к откосу рисуется пунктиром, пока квадрат прилип,
// и исчезает вместе с прилипанием (spec wall-drawing «Привязка к плоскости откоса проёма»).

const W0 = w(0, 0, 500, 0, "W")
const DOOR = door("W", "a", 100, 90, 210, "d1")
const view: View = { zoom: 1, pan: { x: -50, y: -150 } }

const screen = (p: Point): Point => {
  const k = PX_PER_CM * view.zoom
  return { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
}

const draw = (tracks: ReturnType<typeof jambTracks>): StrokeRecord[] => {
  const { ctx, strokes } = strokeRecorder()
  drawScene(ctx, 1200, 900, [W0], null, "mm", view, [], { tracks, doorways: [DOOR] })
  return strokes
}

const isDashed = (s: StrokeRecord): boolean => s.dashPx.some((v) => v > 0)
const snapAt = (p: Point) => snapStartVertex(p, [W0], 12, 10, 20, [DOOR])

describe("отрисовка линии привязки к откосу", () => {
  it("JR-1: пока квадрат прилип — пунктир от откоса (100, −10) до края квадрата (100, −70)", () => {
    const snap = snapAt({ x: 104, y: -60 })
    const lines = strokesAlong(draw(jambTracks(snap, snap.point)), screen({ x: 100, y: -10 }), screen({ x: 100, y: -70 })).filter(isDashed)
    expect(lines).toHaveLength(1)
  })

  it("JR-2: без прилипания (сетка) линии нет", () => {
    const snap = snapAt({ x: 130, y: -60 })
    expect(jambTracks(snap, snap.point)).toEqual([])
    expect(draw(jambTracks(snap, snap.point)).filter(isDashed)).toHaveLength(0)
  })

  it("JR-3: квадрат стоит не в точке привязки (конец сегмента обрезан) — линии нет", () => {
    const snap = snapAt({ x: 104, y: -60 })
    expect(jambTracks(snap, { x: 110, y: -40 })).toEqual([])
  })

  it("JR-4: нет снимка или нет положения квадрата — линий нет", () => {
    expect(jambTracks(null, { x: 0, y: 0 })).toEqual([])
    expect(jambTracks(snapAt({ x: 104, y: -60 }), null)).toEqual([])
  })
})
