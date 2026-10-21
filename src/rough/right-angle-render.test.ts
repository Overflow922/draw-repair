import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, FillOp, StrokeOp, TextOp } from "../room-area.test-utils"
import { SCREEN_METRICS } from "../render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import { PX_PER_CM } from "../types"
import type { Point, RightAngleMark } from "../types"
import { drawRoughScene, plasterColors, rightAngleArmPx } from "./rough-render"
import type { RoughSceneView } from "./rough-render"
import { roughScene } from "./rough-scene"
import { drawing, plaster, wall } from "./rough.test-utils"

// change plaster-right-angle: знак прямого угла на холсте и в PDF (spec rough-works-plan «Пометка прямого угла»; design D4)
// Внутренний угол стен A и B: V = (488; 12), плечи знака влево и вниз.

const A = wall("A", 0, 0, 500, 0)
const B = wall("B", 500, 0, 500, 400)
const pa = plaster("pa", "A", 1, "a", 0, 500)
const pb = plaster("pb", "B", 1, "a", 0, 400)
const mark: RightAngleMark = { id: "r1", corner: [{ markId: "pa", at: "to" }, { markId: "pb", at: "from" }] }
const V = { x: 488, y: 12 }

const viewOf = (zoom: number, extra: Partial<RoughSceneView> = {}, marks: RightAngleMark[] = [mark]): { scene: RoughSceneView; view: { zoom: number; pan: Point } } => {
  const s = roughScene(drawing({ walls: [A, B], roughPlaster: [pa, pb], roughAngles: marks }))
  return {
    view: { zoom, pan: { x: 0, y: 0 } },
    scene: {
      walls: s.base.walls,
      doorways: s.base.doorways,
      pieces: s.pieces,
      screeds: [],
      blocks: [],
      rightAngles: s.rightAngles.map((a) => ({ id: a.mark.id, point: a.corner.point, arms: a.corner.arms })),
      ...extra,
    },
  }
}

const draw = (zoom: number, extra: Partial<RoughSceneView> = {}, opts: Parameters<typeof drawRoughScene>[6] = {}, marks?: RightAngleMark[]) => {
  const { scene, view } = viewOf(zoom, extra, marks)
  const rec = recordingContext()
  drawRoughScene(rec.ctx, 1200, 900, scene, "cm", view, { grid: false, ...opts })
  return rec.ops
}

const strokes = (ops: DrawOp[]): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke")

// знак — ломаная из трёх точек с вершиной в точке V экрана
const signStrokes = (ops: DrawOp[], zoom: number, color: string): StrokeOp[] => {
  const k = PX_PER_CM * zoom
  return strokes(ops).filter(
    (o) => o.strokeStyle === color && o.subpaths.some((p) => p.length === 3 && Math.hypot((p[1]?.x ?? 0) - V.x * k, (p[1]?.y ?? 0) - V.y * k) < 1e-6),
  )
}

describe("знак прямого угла на холсте", () => {
  it("RA-80: скобка нарисована в вершине, плечи влево и вниз", () => {
    const k = PX_PER_CM
    const arm = rightAngleArmPx(SCREEN_METRICS)
    const [stroke] = signStrokes(draw(1), 1, LIGHT_PALETTE.ink)
    const path = stroke?.subpaths.find((p) => p.length === 3)
    expect(path).toBeDefined()
    const tips = [path?.[0], path?.[2]].map((p) => ({ x: Math.round((p?.x ?? 0) - V.x * k), y: Math.round((p?.y ?? 0) - V.y * k) }))
    const expected = [{ x: -arm, y: 0 }, { x: 0, y: arm }].map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    expect(tips).toEqual(expect.arrayContaining(expected))
  })

  it("RA-81: экранный размер плеч не зависит от масштаба просмотра", () => {
    const arm = (zoom: number): number => {
      const path = signStrokes(draw(zoom), zoom, LIGHT_PALETTE.ink)[0]?.subpaths.find((p) => p.length === 3)
      return Math.hypot((path?.[0]?.x ?? 0) - (path?.[1]?.x ?? 0), (path?.[0]?.y ?? 0) - (path?.[1]?.y ?? 0))
    }
    expect(arm(1)).toBeCloseTo(rightAngleArmPx(SCREEN_METRICS), 6)
    expect(arm(2)).toBeCloseTo(arm(1), 6)
    expect(arm(0.5)).toBeCloseTo(arm(1), 6)
  })

  it("RA-82: без пометки или с недействующей знака нет", () => {
    expect(signStrokes(draw(1, { rightAngles: [] }), 1, LIGHT_PALETTE.ink)).toEqual([])
    expect(signStrokes(draw(1, {}, {}, []), 1, LIGHT_PALETTE.ink)).toEqual([])
  })

  it("RA-83: знак различим на обеих схемах — контур цвета бумаги под чернилами схемы", () => {
    for (const palette of [LIGHT_PALETTE, DARK_PALETTE]) {
      const ops = draw(1, {}, { palette, theme: palette === DARK_PALETTE ? "dark" : "light" })
      expect(signStrokes(ops, 1, palette.ink).length).toBeGreaterThan(0)
      expect(signStrokes(ops, 1, palette.paper).length).toBeGreaterThan(0)
    }
  })

  it("RA-84: слой — над штукатуркой, под размерами", () => {
    const ops = draw(1)
    const fill = plasterColors("light").fill
    const lastPlaster = Math.max(...ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill).map((o) => o.index))
    const sign = signStrokes(ops, 1, LIGHT_PALETTE.ink)[0]
    const firstDimension = Math.min(...ops.filter((o): o is TextOp => o.kind === "fillText" && /\d/.test(o.text)).map((o) => o.index))
    expect(sign).toBeDefined()
    expect(sign?.index).toBeGreaterThan(lastPlaster)
    expect(sign?.index).toBeLessThan(firstDimension)
  })

  it("RA-85: выделенный знак обведён цветом выделения, невыделенный — нет", () => {
    const sel = LIGHT_PALETTE.selection
    expect(signStrokes(draw(1), 1, sel)).toEqual([])
    expect(signStrokes(draw(1, { selectedRightAngleId: "r1" }), 1, sel).length).toBeGreaterThan(0)
  })

  it("RA-86: знак под ластиком подсвечен цветом ластика", () => {
    expect(signStrokes(draw(1, { erasing: { kind: "angle", id: "r1" } }), 1, LIGHT_PALETTE.erase).length).toBeGreaterThan(0)
    expect(signStrokes(draw(1), 1, LIGHT_PALETTE.erase)).toEqual([])
  })

  it("RA-87: подсветка цели — превью знака в вершине и обводка полос угла", () => {
    const { scene } = viewOf(1)
    const s = roughScene(drawing({ walls: [A, B], roughPlaster: [pa, pb] }))
    const corner = s.corners[0]
    if (!corner) throw new Error("нет угла")
    const withGhost = draw(1, { rightAngles: [], angleGhost: { point: corner.point, arms: corner.arms, strips: s.strips } })
    expect(signStrokes(withGhost, 1, LIGHT_PALETTE.ink).length).toBeGreaterThan(0)
    expect(strokes(withGhost).filter((o) => o.strokeStyle === LIGHT_PALETTE.selection).length).toBeGreaterThan(0)
    expect(scene.angleGhost).toBeUndefined()
    const without = draw(1, { rightAngles: [] })
    expect(strokes(without).filter((o) => o.strokeStyle === LIGHT_PALETTE.selection)).toEqual([])
  })
})
