import { recorder } from "../doorway/doorway.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import type { Callout, Drawing, Point, View } from "../types"
import { PX_PER_CM } from "../types"

// change add-callout: сцены и конструкторы для тестов выносок (test-plan.md «Сцены»).
// Эталоны выводятся из спецификации и геометрии сцен, а не из продакшн-модулей выносок.

export const callout = (id: string, target: Point, at: Point, text: string): Callout => ({ id, target, at, text })

// A — стрелка правее текста (выравнивание вправо), две строки; B — стрелка левее текста (выравнивание влево), одна строка
export const A = (): Callout => callout("a", { x: 300, y: 100 }, { x: 100, y: 100 }, "Монтаж радиатора\nв нишу")
export const B = (): Callout => callout("b", { x: 50, y: 100 }, { x: 150, y: 200 }, "Тест")

// ширина строки — как у записывающего контекста (recorder.measureText): 7 px на символ
export const measure = (line: string): number => line.length * 7

// радиус привязки 12 px на виде масштаба 1 (2 px на см) — 6 см
export const RADIUS_CM = 6

// вид из doorway.test-utils: масштаб 1, pan (−100, −100)
export const WORLD_VIEW: View = { zoom: 1, pan: { x: -100, y: -100 } }

export const worldOf = (s: Point, view: View = WORLD_VIEW): Point => {
  const k = PX_PER_CM * view.zoom
  return { x: s.x / k + view.pan.x, y: s.y / k + view.pan.y }
}

export const make = (extra: Partial<Drawing> = {}): Drawing => ({
  id: "d",
  name: "Чертёж 1",
  walls: [{ id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }],
  dimensions: [],
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  ...extra,
})

// Записывающий контекст, который дополнительно запоминает центры дуг и углы прямоугольников: базовый recorder эту геометрию
// теряет (arc, fillRect, strokeRect), а маркер выделения может быть нарисован любым из этих способов.
export interface TextCall {
  text: string
  x: number
  y: number
  align: string
  baseline: string
  font: string
}

export interface MarkerRecording {
  ctx: CanvasRenderingContext2D
  ops: Op[]
  shapes: Point[]
  textCalls: TextCall[]
  // состояние холста, которое вызов не должен оставлять изменённым
  state(): { font: string; fillStyle: string; strokeStyle: string; lineWidth: number; textAlign: string; textBaseline: string; globalAlpha: number }
}

export function markerRecorder(): MarkerRecording {
  const { ctx, ops } = recorder()
  const shapes: Point[] = []
  const textCalls: TextCall[] = []
  const wrapped = new Proxy(ctx, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver)
      if (typeof value !== "function") return value
      if (prop === "fillText") {
        return (text: string, x: number, y: number, ...rest: unknown[]): unknown => {
          textCalls.push({ text, x, y, align: String(target.textAlign), baseline: String(target.textBaseline), font: String(target.font) })
          return Reflect.apply(value, target, [text, x, y, ...rest])
        }
      }
      if (prop === "arc") {
        return (x: number, y: number, ...rest: unknown[]): unknown => {
          shapes.push({ x, y })
          return Reflect.apply(value, target, [x, y, ...rest])
        }
      }
      if (prop === "fillRect" || prop === "strokeRect") {
        return (x: number, y: number, w: number, h: number): unknown => {
          shapes.push({ x: x + w / 2, y: y + h / 2 })
          return Reflect.apply(value, target, [x, y, w, h])
        }
      }
      return (...args: unknown[]): unknown => Reflect.apply(value, target, args)
    },
  })
  const state = () => ({
    font: ctx.font,
    fillStyle: String(ctx.fillStyle),
    strokeStyle: String(ctx.strokeStyle),
    lineWidth: ctx.lineWidth,
    textAlign: ctx.textAlign,
    textBaseline: ctx.textBaseline,
    globalAlpha: ctx.globalAlpha,
  })
  return { ctx: wrapped, ops, shapes, textCalls, state }
}

// ожидаемые координаты fillText для строки раскладки при любом выборе textAlign/textBaseline реализации:
// x — левый край строки (left/start), её центр (center) или правый край (right/end); y — нижняя кромка (alphabetic/bottom),
// середина (middle) или верх (top/hanging)
export function expectedTextPoint(call: Pick<TextCall, "align" | "baseline">, line: { x: number; y: number }, width: number, heightPx: number): Point {
  const x = call.align === "center" ? line.x + width / 2 : call.align === "right" || call.align === "end" ? line.x + width : line.x
  const y = call.baseline === "middle" ? line.y - heightPx / 2 : call.baseline === "top" || call.baseline === "hanging" ? line.y - heightPx : line.y
  return { x, y }
}

// глубокая заморозка входных данных: любая мутация в строгом режиме бросает ошибку
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}
