import { describe, expect, it } from "vitest"
import { rulerReading } from "./ruler"
import type { RulerObject, RulerReading } from "./ruler"
import type { Point, Wall } from "./types"
import { W, orders, sceneR } from "./room-area.test-utils"
import { circleObject, expectPointNear, rectObject, rot, sceneRoom300 } from "./ruler.test-utils"

// Тесты change ruler-objects-span: пролёт и замер объекта с объектами плана (spec ruler-tool
// «Замер пролёта между гранями», «Замер объекта», «Замер стены по оси»). Ожидания посчитаны
// вручную по граням стен и объектов комнаты R300 (внутри x ∈ [10, 310], y ∈ [10, 290]).

type Space = Extract<RulerReading, { kind: "space" }>
type ObjectReading = Extract<RulerReading, { kind: "object" }>

const TOL = 1e-6

function asSpace(r: RulerReading): Space {
  expect(r.kind).toBe("space")
  if (r.kind !== "space") throw new Error("ожидался замер пролёта")
  return r
}

function asObject(r: RulerReading): ObjectReading {
  expect(r.kind).toBe("object")
  if (r.kind !== "object") throw new Error("ожидался замер объекта")
  return r
}

function expectLine(line: { from: Point; to: Point; lengthCm: number } | null | undefined, from: Point, to: Point): void {
  expect(line).toBeTruthy()
  if (!line) return
  expectPointNear(line.from, from, TOL)
  expectPointNear(line.to, to, TOL)
  expect(line.lengthCm).toBeCloseTo(Math.hypot(to.x - from.x, to.y - from.y), 6)
}

describe("пролёт: луч упирается в стену или в торец объекта", () => {
  it("RO-1: стол у левой стены — замер от грани стола до правой стены, а не «3000»", () => {
    const table = rectObject(60, 150, 80, 60) // x ∈ [20, 100], 10 см от левой грани стены
    const r = asSpace(rulerReading({ x: 160, y: 150 }, sceneRoom300(), [table]))
    expectLine(r.horizontal, { x: 100, y: 150 }, { x: 310, y: 150 })
    expect(r.horizontal?.lengthCm).toBeCloseTo(210, 6)
    // вертикаль курсора не задевает стол
    expectLine(r.vertical, { x: 160, y: 10 }, { x: 160, y: 290 })
  })

  it("RO-2: батарея слева и воздуховод справа — 257 см между их гранями", () => {
    const battery = rectObject(19, 160, 8, 80) // x ∈ [15, 23]: зазор 5 см от грани стены
    const duct = rectObject(295, 150, 30, 40) // x ∈ [280, 310]: вплотную к правой стене
    const r = asSpace(rulerReading({ x: 150, y: 150 }, sceneRoom300(), [battery, duct]))
    expectLine(r.horizontal, { x: 23, y: 150 }, { x: 280, y: 150 })
    expect(r.horizontal?.lengthCm).toBeCloseTo(257, 6)
  })

  it("RO-3: стенка стояка — точка окружности на высоте курсора", () => {
    const riser = circleObject(305, 150, 10) // x ∈ [300, 310]
    const level = asSpace(rulerReading({ x: 150, y: 150 }, sceneRoom300(), [riser]))
    expectLine(level.horizontal, { x: 10, y: 150 }, { x: 300, y: 150 })
    const off = asSpace(rulerReading({ x: 150, y: 153 }, sceneRoom300(), [riser]))
    expectLine(off.horizontal, { x: 10, y: 153 }, { x: 305 - 4, y: 153 }) // sqrt(5² − 3²) = 4
  })

  it("RO-4: луч мимо стояка (выше окружности) идёт до стены", () => {
    const riser = circleObject(305, 150, 10)
    const r = asSpace(rulerReading({ x: 150, y: 140 }, sceneRoom300(), [riser]))
    expectLine(r.horizontal, { x: 10, y: 140 }, { x: 310, y: 140 })
  })

  it("RO-5: вертикальный луч тоже упирается в объект", () => {
    const table = rectObject(160, 250, 80, 60) // y ∈ [220, 280]
    const r = asSpace(rulerReading({ x: 160, y: 100 }, sceneRoom300(), [table]))
    expectLine(r.vertical, { x: 160, y: 10 }, { x: 160, y: 220 })
  })

  it("RO-6: косая грань повёрнутого на 45° предмета — упор в точке пересечения, число вдоль луча", () => {
    const diamond = rectObject(200, 150, 40, 40, 45) // |dx| + |dy| ≤ 20·√2 по осям чертежа
    const hitX = 200 - (20 * Math.SQRT2 - 10) // луч на 10 см ниже центра
    const r = asSpace(rulerReading({ x: hitX - 100, y: 160 }, sceneRoom300(), [diamond]))
    expectLine(r.horizontal, { x: 10, y: 160 }, { x: hitX, y: 160 })
    expect(r.horizontal?.lengthCm).toBeCloseTo(hitX - 10, 6)  })

  it("RO-7: стен нет, два предмета друг против друга — замер между обращёнными гранями", () => {
    const left = rectObject(0, 0, 20, 20)
    const right = rectObject(200, 0, 20, 20)
    const r = asSpace(rulerReading({ x: 100, y: 5 }, [], [left, right]))
    expectLine(r.horizontal, { x: 10, y: 5 }, { x: 190, y: 5 })
    expect(r.vertical).toBeNull()
    expect(r.angles).toEqual([])
  })

  it("RO-8: снаружи дома — слева препятствие есть, справа нет: горизонтали нет; сверху и снизу есть: вертикаль есть", () => {
    const above = rectObject(500, 100, 40, 40)
    const below = rectObject(500, 300, 40, 40)
    const r = asSpace(rulerReading({ x: 500, y: 200 }, sceneRoom300(), [above, below]))
    expect(r.horizontal).toBeNull()
    expectLine(r.vertical, { x: 500, y: 120 }, { x: 500, y: 280 })
    const noBelow = asSpace(rulerReading({ x: 500, y: 200 }, sceneRoom300(), [above]))
    expect(noBelow.vertical).toBeNull()
  })

  it("RO-9: пустой чертёж — замеров нет", () => {
    const r = asSpace(rulerReading({ x: 50, y: 50 }, [], []))
    expect(r.horizontal).toBeNull()
    expect(r.vertical).toBeNull()
    expect(r.angles).toEqual([])
  })

  it("RO-10: комната нарисована стена за стеной — число не зависит от порядка стен", () => {
    const table = rectObject(60, 150, 80, 60)
    const walls = sceneRoom300()
    for (const order of orders(walls)) {
      // стены добавлялись по одной: каждый префикс порядка — промежуточное состояние чертежа
      const r = asSpace(rulerReading({ x: 160, y: 150 }, order, [table]))
      expect(r.horizontal?.lengthCm).toBeCloseTo(210, 6)
    }
    // по мере рисования замер между стеной и столом появляется, как только есть правая стена
    const partial = asSpace(rulerReading({ x: 160, y: 150 }, walls.slice(0, 1), [table]))
    expect(partial.horizontal).toBeNull()
  })

  it("RO-11: объекты не меняют углы помещения", () => {
    const table = rectObject(160, 150, 80, 60)
    const r = asSpace(rulerReading({ x: 50, y: 50 }, sceneR(), [table]))
    expect(r.angles).toHaveLength(4)
    expect(r.angles.every((a) => a.deg === 90)).toBe(true)
  })

  it("RO-12: входные данные не мутируются", () => {
    const walls = sceneRoom300()
    const objects: RulerObject[] = [rectObject(60, 150, 80, 60), circleObject(305, 150, 10)]
    const before = JSON.stringify([walls, objects])
    rulerReading({ x: 160, y: 150 }, walls, objects)
    expect(JSON.stringify([walls, objects])).toBe(before)
  })
})

describe("замер объекта под курсором", () => {
  it("RO-20: стол 120 × 60 — две линии через курсор, числа 120 и 60", () => {
    const table = rectObject(500, 500, 120, 60)
    const r = asObject(rulerReading({ x: 510, y: 505 }, [], [table]))
    expect(r.measures).toHaveLength(2)
    expectLine(r.measures[0], { x: 440, y: 505 }, { x: 560, y: 505 })
    expectLine(r.measures[1], { x: 510, y: 470 }, { x: 510, y: 530 })
  })

  it("RO-21: повёрнутый на 30° стол — линии вдоль его осей через курсор", () => {
    const table = rectObject(500, 500, 120, 60, 30)
    const u = rot({ x: 1, y: 0 }, 30)
    const v = rot({ x: 1, y: 0 }, 120)
    const p = { x: 500 + 10 * u.x + 5 * v.x, y: 500 + 10 * u.y + 5 * v.y } // a = 10 по ширине, b = 5 по длине
    const r = asObject(rulerReading(p, [], [table]))
    const at = (a: number, b: number): Point => ({ x: 500 + a * u.x + b * v.x, y: 500 + a * u.y + b * v.y })
    expectLine(r.measures[0], at(-60, 5), at(60, 5))
    expectLine(r.measures[1], at(10, -30), at(10, 30))
  })

  it("RO-22: точка в рамке повёрнутого стола, но вне его тела — это не замер объекта", () => {
    const diamond = rectObject(200, 150, 40, 40, 45)
    const r = rulerReading({ x: 225, y: 175 }, sceneRoom300(), [diamond]) // |dx| + |dy| = 50 > 28,3
    expect(r.kind).toBe("space")
  })

  it("RO-23: линии следуют за курсором, числа не меняются", () => {
    const table = rectObject(500, 500, 120, 60)
    const a = asObject(rulerReading({ x: 500, y: 500 }, [], [table]))
    const b = asObject(rulerReading({ x: 500, y: 510 }, [], [table]))
    expect(b.measures[0].lengthCm).toBeCloseTo(a.measures[0].lengthCm, 6)
    expect(b.measures[1].lengthCm).toBeCloseTo(a.measures[1].lengthCm, 6)
    expect(b.measures[0].from.y - a.measures[0].from.y).toBeCloseTo(10, 6)
    // подписи (середины линий) совпадают только при курсоре в центре
    const mid = (m: { from: Point; to: Point }): Point => ({ x: (m.from.x + m.to.x) / 2, y: (m.from.y + m.to.y) / 2 })
    expect(Math.hypot(mid(a.measures[0]).x - mid(a.measures[1]).x, mid(a.measures[0]).y - mid(a.measures[1]).y)).toBeLessThan(TOL)
    expect(Math.hypot(mid(b.measures[0]).x - mid(b.measures[1]).x, mid(b.measures[0]).y - mid(b.measures[1]).y)).toBeGreaterThan(5)
  })

  it("RO-24: воздуховод 40 × 30 — числа 40 и 30", () => {
    const duct = rectObject(100, 100, 40, 30)
    const r = asObject(rulerReading({ x: 100, y: 100 }, [], [duct]))
    expect(r.measures.map((m) => m.lengthCm)).toEqual([40, 30])
  })

  it("RO-25: стояк — один диаметр по горизонтали через центр, а не хорда через курсор", () => {
    const riser = circleObject(200, 150, 10)
    const r = asObject(rulerReading({ x: 202, y: 153 }, [], [riser]))
    expect(r.measures).toHaveLength(1)
    expectLine(r.measures[0], { x: 195, y: 150 }, { x: 205, y: 150 })
  })

  it("RO-26: курсор у края стояка, но вне круга (в его рамке) — не замер объекта", () => {
    const riser = circleObject(200, 150, 10)
    expect(rulerReading({ x: 204, y: 154 }, [], [riser]).kind).toBe("space") // расстояние 5,66 > 5
  })

  it("RO-27: перекрытые предметы — берётся тот, чей центр ближе к курсору", () => {
    const first = rectObject(100, 100, 100, 100) // x ∈ [50, 150]
    const second = rectObject(140, 100, 100, 100) // x ∈ [90, 190]
    const nearFirst = asObject(rulerReading({ x: 115, y: 100 }, [], [first, second]))
    expect(nearFirst.measures[0].from.x).toBeCloseTo(50, 6)
    const nearSecond = asObject(rulerReading({ x: 135, y: 100 }, [], [first, second]))
    expect(nearSecond.measures[0].from.x).toBeCloseTo(90, 6)
  })

  it("RO-28: равные расстояния до центров — предмет, стоящий раньше в списке", () => {
    const first = rectObject(100, 100, 100, 100)
    const second = rectObject(140, 100, 100, 100)
    const p = { x: 120, y: 100 }
    expect(asObject(rulerReading(p, [], [first, second])).measures[0].from.x).toBeCloseTo(50, 6)
    expect(asObject(rulerReading(p, [], [second, first])).measures[0].from.x).toBeCloseTo(90, 6)
  })

  it("RO-29: стена главнее объекта в общей области", () => {
    const wall: Wall = W(0, 0, 400, 0, 20)
    const battery = rectObject(200, 0, 100, 100)
    expect(rulerReading({ x: 200, y: 5 }, [wall], [battery]).kind).toBe("wall")
    expect(rulerReading({ x: 200, y: 30 }, [wall], [battery]).kind).toBe("object") // вне стены, внутри батареи
  })

  it("RO-30: над объектом нет пролёта и углов (вид «object» их не содержит)", () => {
    const table = rectObject(160, 150, 80, 60)
    const r = rulerReading({ x: 160, y: 150 }, sceneR(), [table])
    expect(r).not.toHaveProperty("angles")
    expect(r).not.toHaveProperty("horizontal")
  })
})
