import { describe, expect, it } from "vitest"
import { wallsBBox } from "../export/pdf"
import { SCREEN_METRICS, drawScene } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Point, View, Wall, WallElement } from "../types"
import { PX_PER_CM } from "../types"
import { door, recorder, strokes, w } from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"
import { win } from "./window.test-utils"

// change add-window: подписи проёма и окна параллельны стене и не переворачиваются
// (spec doorway «Отображение проёма»; window «Подпись окна»; pdf-export «Окна в PDF»; design D6 «Ориентация подписи»).
// Направление базовой линии текста измеряется по текущему преобразованию контекста: обёртка
// записывает точку (x, y) и (x + 1, y) в системе текста и берёт разность в экранных координатах.

const VIEW: View = { zoom: 1, pan: { x: -300, y: -400 } }
const K = PX_PER_CM * VIEW.zoom
const INK = LIGHT_PALETTE.ink

interface LabelText {
  text: string
  at: Point
  dir: Point // единичное направление базовой линии на экране
}

function draw(walls: Wall[], elements: WallElement[]): { ops: Op[]; texts: LabelText[] } {
  const { ctx, ops } = recorder()
  const texts: LabelText[] = []
  const target = ctx as unknown as Record<string | symbol, unknown>
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop === "fillText")
        return (text: string, x: number, y: number): void => {
          const i = ops.length
          ctx.fillText(text, x, y)
          ctx.fillText(text, x + 1, y)
          const a = ops[i]
          const b = ops[i + 1]
          ops.splice(i + 1, 1)
          if (a?.kind !== "text" || b?.kind !== "text") throw new Error("нет текста")
          const dx = b.at.x - a.at.x
          const dy = b.at.y - a.at.y
          const len = Math.hypot(dx, dy)
          texts.push({ text, at: a.at, dir: { x: dx / len, y: dy / len } })
        }
      if (prop === "roundRect") return (x: number, y: number, rw: number, rh: number): void => ctx.rect(x, y, rw, rh)
      return t[prop]
    },
    set(t, prop, value) {
      t[prop] = value
      return true
    },
  })
  drawScene(proxy as unknown as CanvasRenderingContext2D, 1600, 1600, walls, null, "cm", VIEW, [], { grid: false, doorways: elements })
  return { ops, texts }
}

const unit = (p: Point): Point => {
  const l = Math.hypot(p.x, p.y)
  return { x: p.x / l, y: p.y / l }
}
const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y
const cross = (p: Point, q: Point): number => p.x * q.y - p.y * q.x
const toWorld = (p: Point): Point => ({ x: p.x / K + VIEW.pan.x, y: p.y / K + VIEW.pan.y })

// направление совпадает с ожидаемым (сонаправлено)
function expectDir(actual: Point, expected: Point): void {
  const e = unit(expected)
  expect(Math.abs(cross(actual, e))).toBeLessThan(1e-6)
  expect(dot(actual, e)).toBeGreaterThan(0)
}

const label = (texts: LabelText[], re: RegExp): LabelText => {
  const found = texts.filter((t) => re.test(t.text))
  expect(found).toHaveLength(1)
  return found[0]
}

// рамка подписи окна: тонкая обводка чернилами из ≥ 4 точек, вершины которой окружают обе части подписи
function frameOf(ops: Op[], h: LabelText, sill: LabelText): Point[] {
  const thin = strokes(ops).filter((o) => o.strokeStyle === INK && o.lineWidth < SCREEN_METRICS.contourPx)
  for (const o of thin)
    for (const sp of o.subpaths) {
      if (sp.length < 4) continue
      const c = sp.slice(0, 4)
      const mid = { x: c.reduce((s, p) => s + p.x, 0) / 4, y: c.reduce((s, p) => s + p.y, 0) / 4 }
      const span = Math.max(...c.map((p) => Math.hypot(p.x - mid.x, p.y - mid.y)))
      const near = (p: Point): boolean => Math.hypot(p.x - mid.x, p.y - mid.y) < span
      if (near(h.at) && near(sill.at) && span > 10) return c
    }
  throw new Error("рамка не найдена")
}

// сторона подписи от оси стены (в мировых координатах), со знаком по нормали n
const lateral = (wall: Wall, n: Point, p: Point): number => dot({ x: p.x - wall.a.x, y: p.y - wall.a.y }, n)

describe("подпись проёма параллельна стене", () => {
  it("LO-01: горизонтальная стена — текст слева направо", () => {
    const W = w(0, 0, 500, 0, "W")
    expectDir(label(draw([W], [door("W", "a", 100)]).texts, /^H=/).dir, { x: 1, y: 0 })
  })

  it("LO-02: наклонная стена (0,0)→(500,−100) — текст вдоль стены слева направо", () => {
    const W = w(0, 0, 500, -100, "W")
    expectDir(label(draw([W], [door("W", "a", 100)]).texts, /^H=/).dir, { x: 500, y: -100 })
  })

  it("LO-03: стена справа налево (500,−100)→(0,0) — текст не переворачивается", () => {
    const W = w(500, -100, 0, 0, "W")
    expectDir(label(draw([W], [door("W", "a", 100)]).texts, /^H=/).dir, { x: 500, y: -100 })
  })

  it("LO-04: вертикальная стена в обе стороны и с отклонением 0.23° — снизу вверх", () => {
    for (const W of [w(0, 0, 0, 500, "W"), w(0, 500, 0, 0, "W"), w(0, 0, 2, 500, "W"), w(2, 500, 0, 0, "W")]) {
      const d = { x: W.b.x - W.a.x, y: W.b.y - W.a.y }
      // вдоль стены, на экране вверх
      const up = d.y > 0 ? { x: -d.x, y: -d.y } : d
      expectDir(label(draw([W], [door("W", "a", 100)]).texts, /^H=/).dir, up)
    }
  })

  it("LO-04b: стена круче допуска (отклонение 1°) направлена по знаку x", () => {
    const dx = Math.tan((1 * Math.PI) / 180) * 500
    const W = w(0, 0, dx, 500, "W")
    expectDir(label(draw([W], [door("W", "a", 100)]).texts, /^H=/).dir, { x: dx, y: 500 })
  })

  it("LO-05: подпись проёма на наклонной стене лежит со своей стороны вне тела стены", () => {
    const W = w(0, 0, 500, -100, "W")
    const t = label(draw([W], [door("W", "a", 100)]).texts, /^H=/)
    const d = unit({ x: 500, y: -100 })
    const left = { x: d.y, y: -d.x } // слева на экране от a → b
    expect(lateral(W, left, toWorld(t.at))).toBeGreaterThan(10)
  })
})

describe("габариты PDF с повёрнутой подписью окна", () => {
  it("LO-09: у вертикальной стены подпись окна вытягивает габариты вдоль стены, а поперёк — только на свою высоту", () => {
    const V = w(0, 0, 0, 200, "V")
    const x = win("V", "a", 40) // центр окна y = 100
    const plain = wallsBBox([V], [], 0)
    const withWindow = wallsBBox([V], [], 0, [x])
    // длина подписи на листе 1:100 — десятки мм, т.е. сотни см чертежа: выходит за концы стены 0…200
    expect(withWindow.minY).toBeLessThan(plain.minY)
    expect(withWindow.maxY).toBeGreaterThan(plain.maxY)
    // поперёк стены — отступ и высота подписи с рамкой, меньше длины подписи
    const across = withWindow.maxX - plain.maxX
    const along = withWindow.maxY - withWindow.minY
    expect(across).toBeGreaterThan(0)
    expect(across).toBeLessThan(along / 3)
    expect(withWindow.minX).toBe(plain.minX)
  })
})

describe("подпись окна параллельна стене", () => {
  it("LO-06: наклонная стена — части идут вдоль стены, рамка повёрнута, стороны параллельны и перпендикулярны стене", () => {
    const W = w(0, 0, 500, -100, "W")
    const { ops, texts } = draw([W], [win("W", "a", 100)])
    const h = label(texts, /^H=/)
    const sill = label(texts, /^H под\./)
    const u = unit({ x: 500, y: -100 })
    expectDir(h.dir, u)
    expectDir(sill.dir, u)
    expectDir({ x: sill.at.x - h.at.x, y: sill.at.y - h.at.y }, u)
    const frame = frameOf(ops, h, sill)
    for (let i = 0; i < 4; i++) {
      const e = unit({ x: frame[(i + 1) % 4].x - frame[i].x, y: frame[(i + 1) % 4].y - frame[i].y })
      expect(Math.min(Math.abs(cross(e, u)), Math.abs(dot(e, u)))).toBeLessThan(1e-6)
    }
    // рамка целиком вне тела стены, со стороны «слева на экране»
    const left = { x: u.y, y: -u.x }
    for (const p of frame) expect(lateral(W, left, toWorld(p))).toBeGreaterThan(10)
  })

  it("LO-07: стена справа налево — части окна по-прежнему слева направо", () => {
    const W = w(500, -100, 0, 0, "W")
    const { texts } = draw([W], [win("W", "a", 100)])
    const h = label(texts, /^H=/)
    const sill = label(texts, /^H под\./)
    expectDir(h.dir, { x: 500, y: -100 })
    expectDir({ x: sill.at.x - h.at.x, y: sill.at.y - h.at.y }, { x: 500, y: -100 })
  })

  it("LO-08: вертикальная стена — подпись снизу вверх, «H под.» выше «H=», рамка вытянута вдоль стены", () => {
    const W = w(0, 0, 0, 200, "W")
    const { ops, texts } = draw([W], [win("W", "a", 40)])
    const h = label(texts, /^H=/)
    const sill = label(texts, /^H под\./)
    expectDir(h.dir, { x: 0, y: -1 })
    expect(sill.at.y).toBeLessThan(h.at.y)
    expect(Math.abs(sill.at.x - h.at.x)).toBeLessThan(0.01)
    const frame = frameOf(ops, h, sill)
    const xs = frame.map((p) => p.x)
    const ys = frame.map((p) => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(Math.max(...xs) - Math.min(...xs))
    // со стороны «слева на экране» от a → b (вниз): x > 10, вне тела стены
    for (const p of frame) expect(toWorld(p).x).toBeGreaterThan(10)
  })
})
