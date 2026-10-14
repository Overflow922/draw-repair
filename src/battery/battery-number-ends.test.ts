import { describe, expect, it } from "vitest"
import { doorwayDistances } from "../doorway/doorway-faces"
import { batteryNumbers, setBatteryDistance } from "./battery-edit"
import { batteryNumberLayout } from "./battery-numbers"
import { batteryRect } from "./battery-geometry"
import type { Wall } from "../types"
import { applied, bat, boxOf, ctxOf, w, windowAt } from "./battery.test-utils"

// change fix-battery-centering-and-numbers: концы грани для чисел и ввода расстояния — как у проёмов (spec battery «Числа
// выделенной батареи», «Правка чисел батареи»; design D3). Раскладки без продолжения стены — в battery-edit.test.ts.

const material = (wall: Wall, type: Wall["type"]): Wall => ({ ...wall, type })
const c = ctxOf({ snapCm: 0 })
const numberOf = (b: ReturnType<typeof bat>, walls: readonly Wall[], field: "toA" | "toB") =>
  batteryNumberLayout(b, walls, "cm", 1, 14).find((n) => n.field === field)

describe("конец грани у стены другого материала", () => {
  // W кирпич (0,0)-(800,0), за ней бетон (800,0)-(1000,0)
  const W = material(w(0, 0, 800, 0, "W"), "brick")
  const C = material(w(800, 0, 1000, 0, "C"), "concrete")
  const walls = [W, C]
  const B = bat("W", "a", 630) // [630,700]

  it("число справа — до границы материалов (x = 800): 100", () => {
    expect(batteryNumbers(B, walls).toB).toBe(100)
  })

  it("размерная линия правого числа заканчивается на границе материалов, а не за ней", () => {
    const n = numberOf(B, walls, "toB")
    expect(n?.valueCm).toBe(100)
    const geom = n?.geom
    expect(geom).toBeTruthy()
    if (!geom) return
    expect(Math.max(geom.p1.x, geom.p2.x)).toBeCloseTo(800, 3)
    expect(Math.min(geom.p1.x, geom.p2.x)).toBeCloseTo(700, 3)
  })

  it("ввод 100 в число справа ставит торец на x = 700 (отсчёт от границы материалов)", () => {
    const start = bat("W", "a", 600) // [600,670]
    const b = applied(setBatteryDistance(start, walls, "b", 100, c))
    expect(boxOf(batteryRect(b, W)).maxX).toBeCloseTo(700, 4)
    expect(batteryNumbers(b, walls).toB).toBeCloseTo(100, 4)
  })
})

describe("число не бывает отрицательным", () => {
  // W кирпич (0,0)-(500,0), за ней бетон (500,0)-(800,0): граница материалов на x = 500; пределы размещения допускают
  // батарею на припуске за границей, поэтому торец может лежать правее границы
  const W = material(w(0, 0, 500, 0, "W"), "brick")
  const C = material(w(500, 0, 800, 0, "C"), "concrete")
  const walls = [W, C]

  it("торец на x = 510 за границей материалов (x = 500): число справа «0», слева 440", () => {
    const b = bat("W", "a", 440) // [440,510]
    expect(batteryNumbers(b, walls)).toMatchObject({ toA: 440, toB: 0 })
  })

  it("число справа у батареи вплотную к границе материалов — «0»", () => {
    expect(batteryNumbers(bat("W", "a", 430), walls).toB).toBe(0)
  })
})

describe("конец грани сквозь стену того же материала", () => {
  // W кирпич (0,0)-(500,0), продолжение W2 кирпич (500,0)-(900,0) со свободным торцом
  const W = material(w(0, 0, 500, 0, "W"), "brick")
  const W2 = material(w(500, 0, 900, 0, "W2"), "brick")
  const walls = [W, W2]

  it("торец батареи на x = 400: число справа 500 (до свободного торца x = 900)", () => {
    expect(batteryNumbers(bat("W", "a", 330), walls).toB).toBe(500)
  })

  it("число слева считается от начала грани (x = 0)", () => {
    expect(batteryNumbers(bat("W", "a", 330), walls).toA).toBe(330)
  })
})

describe("числа батареи и окна отсчитываются от одних и тех же концов", () => {
  const F = w(0, 0, 1000, 0, "F")
  const win = windowAt("F", "a", 200, 600) // откосы [200,800]
  const centred = bat("F", "a", 350, { lengthCm: 300 }) // [350,650], центр над окном

  it("батарея 350 / 350, окно 200 / 200 — края грани общие", () => {
    expect(batteryNumbers(centred, [F])).toMatchObject({ toA: 350, toB: 350 })
    const d = doorwayDistances(win, [F])
    expect(d?.plus).toEqual({ a: 200, b: 200 })
  })
})
