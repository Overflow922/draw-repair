import { describe, expect, it } from "vitest"
import { SCREEN_METRICS, drawScene } from "../render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Point, View, Wall, WallElement } from "../types"
import { PX_PER_CM } from "../types"
import { door, strokes, w } from "./doorway.test-utils"
import type { Op, StrokeOp } from "./doorway.test-utils"
import { colorRecorder, win } from "./window.test-utils"
import type { ColoredText } from "./window.test-utils"

// change add-window: подпись проёма «H=…» в рамке того же стиля, что подпись окна
// (spec doorway «Отображение проёма»; window «Подпись окна»; design D6 «Рамка у подписи проёма»).

const VIEW: View = { zoom: 1, pan: { x: -100, y: -300 } }
const K = PX_PER_CM * VIEW.zoom
const INK = LIGHT_PALETTE.ink

function draw(walls: Wall[], elements: WallElement[]): { ops: Op[]; texts: ColoredText[] } {
  const { ctx, ops, texts } = colorRecorder()
  drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [], { grid: false, doorways: elements })
  return { ops, texts }
}

const toWorld = (p: Point): Point => ({ x: p.x / K + VIEW.pan.x, y: p.y / K + VIEW.pan.y })
const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y
const cross = (p: Point, q: Point): number => p.x * q.y - p.y * q.x
const unit = (p: Point): Point => {
  const l = Math.hypot(p.x, p.y)
  return { x: p.x / l, y: p.y / l }
}

interface Frame {
  op: StrokeOp
  corners: Point[]
}

// рамки: обводки из ≥ 4 точек, четыре вершины которых окружают точку текста
function framesAround(ops: Op[], at: Point): Frame[] {
  const out: Frame[] = []
  for (const op of strokes(ops))
    for (const sp of op.subpaths) {
      if (sp.length < 4) continue
      const c = sp.slice(0, 4)
      const mid = { x: c.reduce((s, p) => s + p.x, 0) / 4, y: c.reduce((s, p) => s + p.y, 0) / 4 }
      const span = Math.max(...c.map((p) => Math.hypot(p.x - mid.x, p.y - mid.y)))
      if (span > 5 && Math.hypot(at.x - mid.x, at.y - mid.y) < 1) out.push({ op, corners: c })
    }
  return out
}

const doorText = (texts: ColoredText[]): ColoredText => {
  const found = texts.filter((t) => /^H=/.test(t.text))
  expect(found).toHaveLength(1)
  return found[0]
}

describe("подпись проёма в рамке", () => {
  it("LF-01: на горизонтальной стене — рамка с центром в подписи, над стеной вне её тела", () => {
    const W = w(0, 0, 500, 0, "W")
    const { ops, texts } = draw([W], [door("W", "a", 100)])
    const t = doorText(texts)
    const frames = framesAround(ops, t.at)
    expect(frames).toHaveLength(1)
    const { corners } = frames[0]
    // охватывает текст «H=210»: шире высоты строки, высота — около кегля
    const xs = corners.map((p) => p.x)
    const ys = corners.map((p) => p.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys))
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(SCREEN_METRICS.labelPx)
    // над стеной (слева на экране от a → b), вне тела: y < −10
    for (const p of corners) expect(toWorld(p).y).toBeLessThan(-10)
  })

  it("LF-02: рамка проёма того же стиля, что рамка окна: цвет и толщина линии, поле вокруг текста", () => {
    const W = w(0, 0, 500, 0, "W")
    const V = w(0, 200, 500, 200, "V")
    const { ops, texts } = draw([W, V], [door("W", "a", 100), win("V", "a", 100)])
    const dt = texts.find((t) => t.text === "H=210")
    const wh = texts.find((t) => t.text === "H=150")
    const ws = texts.find((t) => /^H под\./.test(t.text))
    if (!dt || !wh || !ws) throw new Error("нет подписей")
    const [doorFrame] = framesAround(ops, dt.at)
    // рамка окна — вокруг середины между частями
    const windowFrames = strokes(ops).flatMap((op) =>
      op.subpaths
        .filter((sp) => sp.length >= 4)
        .map((sp) => ({ op, corners: sp.slice(0, 4) }))
        .filter(({ corners }) => {
          const xs = corners.map((p) => p.x)
          const ys = corners.map((p) => p.y)
          return Math.min(...xs) < wh.at.x && Math.max(...xs) > ws.at.x && Math.min(...ys) < wh.at.y && Math.max(...ys) > wh.at.y
        }),
    )
    expect(doorFrame).toBeDefined()
    expect(windowFrames).toHaveLength(1)
    expect(doorFrame.op.strokeStyle).toBe(INK)
    expect(doorFrame.op.strokeStyle).toBe(windowFrames[0].op.strokeStyle)
    expect(doorFrame.op.lineWidth).toBe(windowFrames[0].op.lineWidth)
    // одинаковая высота рамки (кегль + два поля)
    const height = (c: Point[]): number => Math.max(...c.map((p) => p.y)) - Math.min(...c.map((p) => p.y))
    expect(height(doorFrame.corners)).toBeCloseTo(height(windowFrames[0].corners), 6)
  })

  it("LF-03: на наклонной стене рамка проёма повёрнута вдоль стены и лежит вне её тела", () => {
    const W = w(0, 0, 500, -100, "W")
    const { ops, texts } = draw([W], [door("W", "a", 100)])
    const [frame] = framesAround(ops, doorText(texts).at)
    expect(frame).toBeDefined()
    const u = unit({ x: 500, y: -100 })
    for (let i = 0; i < 4; i++) {
      const e = unit({ x: frame.corners[(i + 1) % 4].x - frame.corners[i].x, y: frame.corners[(i + 1) % 4].y - frame.corners[i].y })
      expect(Math.min(Math.abs(cross(e, u)), Math.abs(dot(e, u)))).toBeLessThan(1e-6)
    }
    const left = { x: u.y, y: -u.x }
    for (const p of frame.corners) {
      const q = toWorld(p)
      expect(dot(q, left)).toBeGreaterThan(10)
    }
  })

  it("LF-05: поле рамки одинаково со всех сторон и такое же, как у окна (ширина текста — оценка 0.6·кегль на символ)", () => {
    const W = w(0, 0, 500, 0, "W")
    const V = w(0, 200, 500, 200, "V")
    const { ops, texts } = draw([W, V], [door("W", "a", 100), win("V", "a", 100)])
    const dt = texts.find((t) => t.text === "H=210")
    const wh = texts.find((t) => t.text === "H=150")
    if (!dt || !wh) throw new Error("нет подписей")
    const [doorFrame] = framesAround(ops, dt.at)
    expect(doorFrame).toBeDefined()
    const size = (c: Point[]): { w: number; h: number } => ({
      w: Math.max(...c.map((p) => p.x)) - Math.min(...c.map((p) => p.x)),
      h: Math.max(...c.map((p) => p.y)) - Math.min(...c.map((p) => p.y)),
    })
    const L = SCREEN_METRICS.labelPx
    const d = size(doorFrame.corners)
    const textW = "H=210".length * 0.6 * L
    const padX = (d.w - textW) / 2
    const padY = (d.h - L) / 2
    expect(padY).toBeGreaterThan(0)
    expect(padX).toBeCloseTo(padY, 6)
    // окно: «H=150  H под.=85» — 16 символов; разность (ширина − высота) отличается на ширину лишнего текста
    const windowFrame = strokes(ops)
      .flatMap((op) => op.subpaths.filter((sp) => sp.length >= 4).map((sp) => sp.slice(0, 4)))
      .find((c) => {
        const xs = c.map((p) => p.x)
        const ys = c.map((p) => p.y)
        return Math.min(...xs) < wh.at.x && Math.max(...xs) > wh.at.x + 50 && Math.min(...ys) < wh.at.y && Math.max(...ys) > wh.at.y
      })
    if (!windowFrame) throw new Error("нет рамки окна")
    const ww = size(windowFrame)
    expect(d.w - d.h - (ww.w - ww.h)).toBeCloseTo(0.6 * L * ("H=210".length - "H=150  H под.=85".length), 6)
  })

  it("LF-06: у вертикальной стены рамка проёма вытянута вдоль стены и лежит вне её тела", () => {
    const W = w(0, 0, 0, 500, "W")
    const { ops, texts } = draw([W], [door("W", "a", 100)])
    const [frame] = framesAround(ops, doorText(texts).at)
    expect(frame).toBeDefined()
    const xs = frame.corners.map((p) => p.x)
    const ys = frame.corners.map((p) => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(Math.max(...xs) - Math.min(...xs))
    // слева на экране от a → b (вниз) — сторона x > 10
    for (const p of frame.corners) expect(toWorld(p).x).toBeGreaterThan(10)
  })

  it("LF-07: в тёмной теме рамка проёма — цветом чернил тёмной палитры, как у окна", () => {
    const W = w(0, 0, 500, 0, "W")
    const { ctx, ops, texts } = colorRecorder()
    drawScene(ctx, 1600, 1200, [W], null, "cm", VIEW, [], { grid: false, doorways: [door("W", "a", 100)], palette: DARK_PALETTE })
    const [frame] = framesAround(ops, doorText(texts).at)
    expect(frame?.op.strokeStyle).toBe(DARK_PALETTE.ink)
  })

  it("LF-04: текст проёма — одна строка «H=…» чернилами по центру рамки", () => {
    const W = w(0, 0, 500, 0, "W")
    const { ops, texts } = draw([W], [door("W", "a", 100)])
    const t = doorText(texts)
    expect(t.fillStyle).toBe(INK)
    expect(texts.filter((x) => /^H под\./.test(x.text))).toEqual([])
    const [frame] = framesAround(ops, t.at)
    const cx = frame.corners.reduce((s, p) => s + p.x, 0) / 4
    expect(Math.abs(cx - t.at.x)).toBeLessThan(0.5)
  })
})
