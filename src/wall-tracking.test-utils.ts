import { expect } from "vitest"
import type { Point } from "./types"
import { recordingContext } from "./room-area.test-utils"

// Тестовые утилиты change wall-axis-tracking-snap.

export interface Track {
  from: Point
  to: Point
}

const key = (t: Track): string => [t.from.x, t.from.y, t.to.x, t.to.y].map((v) => (Math.round(v * 1e6) / 1e6 + 0).toFixed(6)).join(",")

// набор линий трекинга без учёта порядка; линия — от узла (from) до конца (to)
export function expectTracks(actual: readonly Track[] | undefined, expected: Track[]): void {
  expect(actual).toBeDefined()
  if (!actual) return
  expect(actual).toHaveLength(expected.length)
  expect(actual.map(key).sort()).toEqual(expected.map(key).sort())
}

export interface StrokeRecord {
  strokeStyle: string
  widthPx: number // толщина линии в пикселях устройства (с учётом текущего масштаба трансформации)
  dashPx: number[] // шаблон пунктира в пикселях устройства; [] — сплошная
  subpaths: Point[][] // в координатах устройства
}

// Обёртка над записывающим контекстом room-area.test-utils: дополнительно фиксирует
// пунктир и толщину каждой обводки в пикселях устройства — независимо от того,
// рисует ли продакшн-код в экранных координатах или через ctx.scale.
export function strokeRecorder(): { ctx: CanvasRenderingContext2D; strokes: StrokeRecord[] } {
  const { ctx: inner, ops } = recordingContext()
  const strokes: StrokeRecord[] = []
  let k = 1
  let dash: number[] = []
  const stack: { k: number; dash: number[] }[] = []
  const overrides = new Map<string | symbol, unknown>([
    [
      "save",
      (): void => {
        stack.push({ k, dash: [...dash] })
        inner.save()
      },
    ],
    [
      "restore",
      (): void => {
        const s = stack.pop()
        if (s) {
          k = s.k
          dash = s.dash
        }
        inner.restore()
      },
    ],
    [
      "setTransform",
      (a: number, b: number, c: number, d: number, e: number, f: number): void => {
        k = Math.sqrt(Math.abs(a * d - b * c))
        inner.setTransform(a, b, c, d, e, f)
      },
    ],
    [
      "scale",
      (x: number, y: number): void => {
        k *= Math.sqrt(Math.abs(x * y))
        inner.scale(x, y)
      },
    ],
    [
      "setLineDash",
      (segments: number[]): void => {
        dash = [...segments]
      },
    ],
    ["getLineDash", (): number[] => [...dash]],
    [
      "stroke",
      (): void => {
        inner.stroke()
        const op = ops[ops.length - 1]
        if (op?.kind !== "stroke") return
        strokes.push({
          strokeStyle: op.strokeStyle,
          widthPx: inner.lineWidth * k,
          dashPx: dash.map((v) => v * k),
          subpaths: op.subpaths,
        })
      },
    ],
  ])
  const ctx = new Proxy(inner, {
    get(target, prop) {
      if (overrides.has(prop)) return overrides.get(prop)
      const value: unknown = Reflect.get(target, prop, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
  return { ctx, strokes }
}

// цвет CSS в форматах #rgb, #rrggbb, rgb()/rgba() → компоненты 0..255; иначе null
export function parseColor(style: string): [number, number, number] | null {
  const s = style.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1]
    const byte = (i: number): number => parseInt(h.slice(i, i + 2), 16)
    return [byte(0), byte(2), byte(4)]
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s)
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null
}

// контраст по WCAG 2.x относительно белого фона холста
export function contrastOnWhite([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return 1.05 / (lum + 0.05)
}

const near = (p: Point, q: Point, tol: number): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= tol

// обводки, содержащие отрезок a–b (в любом направлении) как отдельный подпуть из двух точек
export function strokesAlong(strokes: StrokeRecord[], a: Point, b: Point, tol = 0.5): StrokeRecord[] {
  return strokes.filter((s) =>
    s.subpaths.some((sp) => sp.length === 2 && ((near(sp[0], a, tol) && near(sp[1], b, tol)) || (near(sp[0], b, tol) && near(sp[1], a, tol)))),
  )
}
