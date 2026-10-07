import type { Point, WallElement, WallWindow } from "../types"
import { D0, door, recorder, sceneF, sceneR } from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"

// change add-window: сцены и записывающий контекст для тестов окон (test-plan.md «Сцены»).
// Эталоны выводятся из спецификации и геометрии сцен, а не из продакшн-модулей.

export const win = (
  wallId: string,
  anchor: "a" | "b",
  offsetCm: number,
  widthCm = 120,
  heightCm = 150,
  sillCm = 85,
  id = "w0",
): WallWindow => ({ kind: "window", id, wallId, anchor, offsetCm, widthCm, heightCm, sillCm })

// WN — окно на W: привязка b, 100 см, ширина 120 (участок x 280…400 при длине 500)
export const WN = (): WallWindow => win("W", "b", 100)
// WA — окно на W: привязка a, 100 см, ширина 120 (участок x 100…220)
export const WA = (): WallWindow => win("W", "a", 100)

// RN — комната R с проёмом D0 (100…190) и окном WN (280…400) на W
export const sceneRN = () => {
  const r = sceneR()
  const d = D0()
  const wn = WN()
  const elements: WallElement[] = [d, wn]
  return { ...r, d, wn, elements }
}

// FN — свободная стена W с теми же элементами
export const sceneFN = () => {
  const f = sceneF()
  const d = D0()
  const wn = WN()
  const elements: WallElement[] = [d, wn]
  return { ...f, d, wn, elements }
}

// FO — свободная стена W, проём 100…190 и окно 170…290: наложение 20 см (документ)
export const sceneFO = () => {
  const f = sceneF()
  const d = D0()
  const wo = win("W", "a", 170)
  const elements: WallElement[] = [d, wo]
  return { ...f, d, wo, elements }
}

export { door }

// записывающий контекст + цвет заливки каждого fillText; roundRect/arcTo/кривые — как отрезки пути
export interface ColoredText {
  text: string
  at: Point
  fillStyle: string
}

export function colorRecorder(): { ctx: CanvasRenderingContext2D; ops: Op[]; texts: ColoredText[] } {
  const { ctx, ops } = recorder()
  const texts: ColoredText[] = []
  const target = ctx as unknown as Record<string | symbol, unknown>
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(t, prop) {
      if (prop === "fillText")
        return (text: string, x: number, y: number): void => {
          const before = ops.length
          ctx.fillText(text, x, y)
          const op = ops[before]
          const at = op && op.kind === "text" ? op.at : { x, y }
          texts.push({ text, at, fillStyle: String(t.fillStyle) })
        }
      if (prop === "roundRect")
        return (x: number, y: number, w: number, h: number): void => ctx.rect(x, y, w, h)
      if (prop === "arcTo") return (x1: number, y1: number): void => ctx.lineTo(x1, y1)
      if (prop === "quadraticCurveTo") return (_cx: number, _cy: number, x: number, y: number): void => ctx.lineTo(x, y)
      if (prop === "bezierCurveTo")
        return (_a: number, _b: number, _c: number, _d: number, x: number, y: number): void => ctx.lineTo(x, y)
      if (prop === "strokeRect")
        return (x: number, y: number, w: number, h: number): void => {
          ctx.beginPath()
          ctx.rect(x, y, w, h)
          ctx.stroke()
        }
      return t[prop]
    },
    set(t, prop, value) {
      t[prop] = value
      return true
    },
  }
  return { ctx: new Proxy(target, handler) as unknown as CanvasRenderingContext2D, ops, texts }
}
