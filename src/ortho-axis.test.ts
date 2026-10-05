import { describe, expect, it } from "vitest"
import { dominantAxis, latchAxis, onAxis } from "./ortho-axis"

// change ortho-axis-lock, wall-selection «Орто без боковой составляющей» (design D1): ось жеста —
// горизонталь, если |x| ≥ |y| направляющего вектора, иначе вертикаль; выбранная ось не меняется.

describe("dominantAxis: ось по большей составляющей", () => {
  it("AX-1: первое смещение (3, 1) — горизонталь; (1, 3) — вертикаль; знак не важен", () => {
    expect(dominantAxis({ x: 3, y: 1 })).toBe("x")
    expect(dominantAxis({ x: -3, y: 1 })).toBe("x")
    expect(dominantAxis({ x: 1, y: 3 })).toBe("y")
    expect(dominantAxis({ x: 1, y: -3 })).toBe("y")
  })

  it("AX-2: равные составляющие (−2, 2) — горизонталь", () => {
    expect(dominantAxis({ x: -2, y: 2 })).toBe("x")
  })

  it("AX-3: равные составляющие (3, −3) — горизонталь", () => {
    expect(dominantAxis({ x: 3, y: -3 })).toBe("x")
  })

  it("AX-6: вертикальная составляющая чуть больше — вертикаль (порога нет)", () => {
    expect(dominantAxis({ x: 1, y: 1.000001 })).toBe("y")
    expect(dominantAxis({ x: 1.000001, y: 1 })).toBe("x")
  })

  it("AX-6b: составляющая по одной оси — эта ось; угол 30° и 60° не «вне орто»", () => {
    expect(dominantAxis({ x: 0, y: -5 })).toBe("y")
    expect(dominantAxis({ x: 7, y: 0 })).toBe("x")
    expect(dominantAxis({ x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) })).toBe("x")
    expect(dominantAxis({ x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) })).toBe("y")
  })

  it("AX-7: нулевой вектор — оси нет", () => {
    expect(dominantAxis({ x: 0, y: 0 })).toBeNull()
  })
})

describe("latchAxis: ось выбирается один раз", () => {
  it("AX-7b: до выбора нулевое смещение оставляет ось невыбранной", () => {
    expect(latchAxis(null, { x: 0, y: 0 })).toBeNull()
  })

  it("AX-8: первое ненулевое смещение выбирает ось", () => {
    expect(latchAxis(null, { x: 0, y: -20 })).toBe("y")
    expect(latchAxis(null, { x: 10, y: -10 })).toBe("x")
  })

  it("AX-4: выбранная ось не меняется при любом дальнейшем направлении", () => {
    expect(latchAxis("x", { x: 1, y: 100 })).toBe("x")
    expect(latchAxis("x", { x: 0, y: -80 })).toBe("x")
    expect(latchAxis("y", { x: 100, y: 0 })).toBe("y")
    expect(latchAxis("y", { x: -60, y: 1 })).toBe("y")
  })

  it("AX-5: возврат указателя в точку нажатия не сбрасывает ось", () => {
    expect(latchAxis("x", { x: 0, y: 0 })).toBe("x")
    expect(latchAxis("y", { x: 0, y: 0 })).toBe("y")
  })
})

describe("onAxis: проекция вектора на ось", () => {
  it("AX-10: составляющая поперёк оси обнуляется, вдоль — сохраняется", () => {
    expect(onAxis({ x: 3, y: 4 }, "x")).toEqual({ x: 3, y: 0 })
    expect(onAxis({ x: 3, y: 4 }, "y")).toEqual({ x: 0, y: 4 })
    expect(onAxis({ x: -30, y: 40 }, "x")).toEqual({ x: -30, y: 0 })
    expect(onAxis({ x: -30, y: 40 }, "y")).toEqual({ x: 0, y: 40 })
  })
})
