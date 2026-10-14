import { describe, expect, it } from "vitest"
import { batteryHolds, batteryRect } from "./battery-geometry"
import { setBatteryDistance, setBatteryGap, setBatteryLength, setBatteryThickness } from "./battery-edit"
import type { BatteryEdit } from "./battery-place"
import { arrowSlideBattery, slideBattery } from "./battery-place"
import { bat, ctxOf, duct, riser, w, windowAt } from "./battery.test-utils"
import type { Battery } from "./battery.test-utils"

// change add-battery: свойства над сериями операций (test-plan «Invariants» I1–I4; B-INV-1…4).
// Детерминированный генератор (LCG) — результат воспроизводим. Сцена: стена W (0,0)-(1000,0) t20, перегородка P (500,10)-(500,300) t10,
// стояк Ø10 в (600,30), воздуховод 20×20 в (900,30), окно [300,420] на W; три батареи на грани y = 10, свободные места между объектами.

const W = w(0, 0, 1000, 0, "W")
const P = w(500, 10, 500, 300, "P", 10)
const walls = [W, P]
const R = riser(600, 30, 10)
const D = duct(900, 30, 20, 20)
const WIN = windowAt("W", "a", 300, 120)

const initial = (): Battery[] => [bat("W", "a", 20, { id: "b1" }), bat("W", "a", 200, { id: "b2" }), bat("W", "a", 700, { id: "b3" })]

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const scene = (batteries: Battery[]) => ({ walls, batteries, communications: [R, D] })
const othersCtx = (all: Battery[], self: Battery) => ctxOf({ batteries: all.filter((b) => b.id !== self.id), communications: [R, D], elements: [WIN] })

function apply(kind: number, b: Battery, all: Battery[], rnd: () => number): { edit: BatteryEdit; geometric: boolean } {
  const ctx = othersCtx(all, b)
  const amount = Math.round((rnd() - 0.5) * 400)
  switch (kind) {
    case 0:
      return { edit: slideBattery(b, walls, { x: amount, y: Math.round((rnd() - 0.5) * 100) }, ctx), geometric: true }
    case 1:
      return { edit: arrowSlideBattery(b, walls, rnd() < 0.5 ? { x: 1, y: 0 } : { x: -1, y: 0 }, rnd() < 0.5 ? 10 : 1, ctx), geometric: true }
    case 2:
      return { edit: setBatteryLength(b, walls, 20 + Math.round(rnd() * 200), ctx), geometric: false }
    case 3:
      return { edit: setBatteryThickness(b, walls, 3 + Math.round(rnd() * 40), ctx), geometric: false }
    case 4:
      return { edit: setBatteryGap(b, walls, Math.round(rnd() * 25), ctx), geometric: false }
    default:
      return { edit: setBatteryDistance(b, walls, rnd() < 0.5 ? "a" : "b", Math.round(rnd() * 300), ctx), geometric: false }
  }
}

describe("B-INV-1: батареи не пересекаются с другими объектами после любой серии операций", () => {
  it.each([1, 7, 42, 2026])("B-INV-1: seed %i: 300 случайных операций — все батареи допустимы, неудачные операции состояния не меняют", (seed) => {
    const rnd = lcg(seed)
    let state = initial()
    for (const b of state) expect(batteryHolds(b, scene(state))).toBe(true)
    for (let i = 0; i < 300; i++) {
      const index = Math.floor(rnd() * state.length)
      const target = state[index]
      const { edit } = apply(Math.floor(rnd() * 6), target, state, rnd)
      if (edit.kind === "applied") state = state.map((b, j) => (j === index ? edit.battery : b))
      for (const b of state) expect(batteryHolds(b, scene(state))).toBe(true)
    }
  })
})

describe("B-INV-3 / B-INV-4: неизменные поля", () => {
  it.each([3, 11, 99])("B-INV-3: seed %i: стена, грань и идентификатор не меняются никакой операцией; перемещение не меняет длину, толщину и отступ", (seed) => {
    const rnd = lcg(seed)
    let state = initial()
    for (let i = 0; i < 200; i++) {
      const index = Math.floor(rnd() * state.length)
      const target = state[index]
      const { edit, geometric } = apply(Math.floor(rnd() * 6), target, state, rnd)
      if (edit.kind !== "applied") continue
      expect(edit.battery.id).toBe(target.id)
      expect(edit.battery.wallId).toBe("W")
      expect(edit.battery.face).toBe(1)
      if (geometric) {
        expect(edit.battery.anchor).toBe(target.anchor)
        expect(edit.battery.lengthCm).toBe(target.lengthCm)
        expect(edit.battery.thicknessCm).toBe(target.thicknessCm)
        expect(edit.battery.gapCm).toBe(target.gapCm)
      }
      state = state.map((b, j) => (j === index ? edit.battery : b))
    }
  })

  it("B-INV-4b: ограничения применяются и к отклонённым операциям: отказ не возвращает изменённую батарею", () => {
    const b = initial()[0]
    const r = setBatteryLength(b, walls, Number.NaN, ctxOf())
    expect(r.kind).toBe("rejected")
  })
})

describe("B-INV-2: параллельность стене при любом повороте", () => {
  it.each(Array.from({ length: 24 }, (_, i) => i * 15))("B-INV-2: поворот стены на %i°: стороны батареи параллельны оси и перпендикулярны ей", (deg) => {
    const rad = (deg * Math.PI) / 180
    const len = 500
    const wall = w(0, 0, Math.cos(rad) * len, Math.sin(rad) * len, "D")
    const r = batteryRect(bat("D", "a", 100), wall)
    expect(r).toHaveLength(4)
    const axis = { x: Math.cos(rad), y: Math.sin(rad) }
    const edges = r.map((p, i) => ({ x: r[(i + 1) % 4].x - p.x, y: r[(i + 1) % 4].y - p.y }))
    for (const e of edges) {
      const l = Math.hypot(e.x, e.y)
      const cross = Math.abs((e.x * axis.y - e.y * axis.x) / l)
      const dot = Math.abs((e.x * axis.x + e.y * axis.y) / l)
      expect(Math.min(cross, dot)).toBeLessThan(1e-9) // сторона параллельна или перпендикулярна оси
    }
    const lengths = edges.map((e) => Math.hypot(e.x, e.y)).sort((a, b) => a - b)
    expect(lengths[0]).toBeCloseTo(10, 6)
    expect(lengths[3]).toBeCloseTo(70, 6)
  })
})
