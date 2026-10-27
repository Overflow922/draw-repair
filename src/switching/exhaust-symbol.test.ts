import { describe, expect, it } from "vitest"
import { LIGHT_SYMBOL_PX_PER_MM } from "../ceiling/light-symbol"
import { LIGHT_PALETTE } from "../theme"
import { drawExhaust, exhaustHitRadiusPx, exhaustSegments } from "./exhaust-symbol"

// change add-exhaust-fan: знак вытяжки (spec exhaust-fan «Знак вытяжки»)

describe("exhaustSegments", () => {
  it("сторона квадрата 3,5 мм в единицах носителя, центр в центре", () => {
    const { square } = exhaustSegments({ x: 100, y: 50 }, 1)
    expect(square).toEqual([
      { x: 98.25, y: 48.25 },
      { x: 101.75, y: 48.25 },
      { x: 101.75, y: 51.75 },
      { x: 98.25, y: 51.75 },
    ])
  })
  it("на холсте сторона 14 px", () => {
    const { square } = exhaustSegments({ x: 0, y: 0 }, LIGHT_SYMBOL_PX_PER_MM)
    expect((square[1]?.x ?? 0) - (square[0]?.x ?? 0)).toBeCloseTo(14)
  })
  it("три отрезка от центра: к двум верхним углам и к середине нижней стороны", () => {
    const { spokes } = exhaustSegments({ x: 0, y: 0 }, 2)
    expect(spokes).toEqual([
      [{ x: 0, y: 0 }, { x: -3.5, y: -3.5 }],
      [{ x: 0, y: 0 }, { x: 3.5, y: -3.5 }],
      [{ x: 0, y: 0 }, { x: 0, y: 3.5 }],
    ])
  })
})

describe("exhaustHitRadiusPx", () => {
  it("не меньше 8 px", () => {
    expect(exhaustHitRadiusPx()).toBeGreaterThanOrEqual(8)
  })
})

describe("drawExhaust", () => {
  const calls: string[] = []
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, name: string) => (...args: unknown[]) => {
      calls.push(`${name}:${args.join(",")}`)
    },
    set: (_t, name: string, value: unknown) => {
      calls.push(`${name}=${String(value)}`)
      return true
    },
  })
  it("рисует красным цветом освещения, без заливки; выделение перекрашивает", () => {
    calls.length = 0
    drawExhaust(ctx, { x: 0, y: 0 }, 1, LIGHT_PALETTE)
    expect(calls).toContain(`strokeStyle=${LIGHT_PALETTE.lightingRed}`)
    expect(calls.some((c) => c.startsWith("fill"))).toBe(false)
    calls.length = 0
    drawExhaust(ctx, { x: 0, y: 0 }, 1, LIGHT_PALETTE, "#123456")
    expect(calls).toContain("strokeStyle=#123456")
  })
})
