import { expect } from "vitest"
import { colorRecorder } from "../doorway/window.test-utils"
import type { ColoredText } from "../doorway/window.test-utils"
import type { Op } from "../doorway/doorway.test-utils"
import type { Duct, Point, Riser, Wall } from "../types"

// change add-communications: сцены и независимые эталоны для тестов коммуникаций (test-plan.md «Сцены»).
// Эталоны выводятся из спецификации и геометрии сцен, а не из продакшн-модулей коммуникаций.

export const w = (ax: number, ay: number, bx: number, by: number, id: string, thicknessCm = 20): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

export const riser = (x: number, y: number, diameterCm = 10, id = "r0"): Riser => ({ kind: "riser", id, x, y, diameterCm })
export const duct = (x: number, y: number, widthCm = 30, depthCm = 20, id = "d0"): Duct => ({ kind: "duct", id, x, y, widthCm, depthCm })

export interface Room {
  walls: Wall[]
  T: Wall
  B: Wall
  L: Wall
  R: Wall
}

// «Комната»: T (0,0)-(300,0), B (0,400)-(300,400), L (0,0)-(0,400), R (300,0)-(300,400), толщина 20;
// внутренность x ∈ [10, 290], y ∈ [10, 390]
export const room = (): Room => {
  const T = w(0, 0, 300, 0, "T")
  const B = w(0, 400, 300, 400, "B")
  const L = w(0, 0, 0, 400, "L")
  const R = w(300, 0, 300, 400, "R")
  return { walls: [T, B, L, R], T, B, L, R }
}

export const expectPoint = (p: Point, x: number, y: number, digits = 3): void => {
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

// записывающий контекст с дугами и эллипсами, развёрнутыми в ломаные (в экранных координатах, с учётом преобразований)
export function circleRecorder(): { ctx: CanvasRenderingContext2D; ops: Op[]; texts: ColoredText[] } {
  const { ctx, ops, texts } = colorRecorder()
  const target = ctx as unknown as Record<string | symbol, unknown>
  const STEPS = 72
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(t, prop) {
      if (prop === "arc")
        return (x: number, y: number, r: number, a0: number, a1: number): void => {
          const span = a1 - a0
          const steps = Math.max(8, Math.round((Math.abs(span) / (2 * Math.PI)) * STEPS))
          ctx.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0))
          for (let i = 1; i <= steps; i++) {
            const a = a0 + (span * i) / steps
            ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
          }
        }
      if (prop === "ellipse")
        return (x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void => {
          const span = a1 - a0
          const steps = Math.max(8, Math.round((Math.abs(span) / (2 * Math.PI)) * STEPS))
          for (let i = 0; i <= steps; i++) {
            const a = a0 + (span * i) / steps
            const px = rx * Math.cos(a)
            const py = ry * Math.sin(a)
            const X = x + px * Math.cos(rot) - py * Math.sin(rot)
            const Y = y + px * Math.sin(rot) + py * Math.cos(rot)
            if (i === 0) ctx.moveTo(X, Y)
            else ctx.lineTo(X, Y)
          }
        }
      const v: unknown = Reflect.get(t, prop)
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(ctx) : v
    },
    set(t, prop, value) {
      Reflect.set(t, prop, value)
      return true
    },
  }
  return { ctx: new Proxy(target, handler) as unknown as CanvasRenderingContext2D, ops, texts }
}
