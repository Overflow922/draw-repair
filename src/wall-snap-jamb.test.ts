import { describe, expect, it } from "vitest"
import { door, w } from "./doorway/doorway.test-utils"
import { win } from "./doorway/window.test-utils"
import type { Point, WallElement } from "./types"
import { chainSegment } from "./wall-chain"
import { placementSquare, snapStartVertex, snapVertex, wallClickAction } from "./wall-snap"
import { deepFreeze } from "./wall-snap.test-utils"

// change snap-wall-to-opening-jambs: линии откосов в инструменте «Стена» (spec wall-drawing
// «Привязка к плоскости откоса проёма»): приоритеты, вторая вершина, заданное направление, отрисовка.

const RADIUS = 12
const STEP = 10
const T = 20

const W0 = w(0, 0, 500, 0, "W")
const DOOR = door("W", "a", 100, 90, 210, "d1") // откосы x = 100 и 190
const V = w(-300, -400, -300, 400, "V")
const DOOR_V = door("V", "a", 200, 90, 210, "d2") // откосы y = −200 и −110

const start = (p: Point, walls = [W0], elements: WallElement[] = [DOOR]) => snapStartVertex(p, walls, RADIUS, STEP, T, elements)
const vertex = (p: Point, walls = [W0], elements: WallElement[] = [DOOR]) => snapVertex(p, walls, RADIUS, STEP, T, undefined, elements, false)

const near = (p: Point, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6)
  expect(p.y).toBeCloseTo(y, 6)
}

describe("привязка вершины к плоскости откоса", () => {
  it("WJ-1: начальная вершина — квадрат справа от линии x = 100: вершина (110, −60), линия от (100, −10) до (100, −70)", () => {
    const r = start({ x: 104, y: -60 })
    expect(r.source).toBe("jamb")
    near(r.point, 110, -60)
    const sq = placementSquare(r, T)
    expect(Math.min(...sq.map((q) => q.x))).toBeCloseTo(100, 6)
    expect(Math.max(...sq.map((q) => q.x))).toBeCloseTo(120, 6)
    expect(Math.min(...sq.map((q) => q.y))).toBeCloseTo(-70, 6)
    expect(Math.max(...sq.map((q) => q.y))).toBeCloseTo(-50, 6)
    expect(r.tracks).toHaveLength(1)
    near(r.tracks![0].from, 100, -10)
    near(r.tracks![0].to, 100, -70)
  })

  it("WJ-2: слева от линии — вершина (90, −60)", () => {
    near(start({ x: 96, y: -60 }).point, 90, -60)
  })

  it("WJ-3: вне радиуса — сетка, без линий", () => {
    const r = start({ x: 130, y: -60 })
    expect(r.source).toBe("grid")
    near(r.point, 130, -60)
    expect(r.tracks).toBeUndefined()
  })

  it("WJ-4: окно — те же линии", () => {
    const r = start({ x: 104, y: -60 }, [W0], [win("W", "a", 100, 90)])
    expect(r.source).toBe("jamb")
    near(r.point, 110, -60)
  })

  it("WJ-5: дверь — тоже элемент стены, её откосы — линии", () => {
    const r = start({ x: 104, y: -60 }, [W0], [door("W", "a", 100, 90, 210, "dd")])
    expect(r.source).toBe("jamb")
  })

  it("WJ-6: две линии по двум стенам — вершина (110, −210), две линии", () => {
    const r = start({ x: 104, y: -204 }, [W0, V], [DOOR, DOOR_V])
    expect(r.source).toBe("jamb")
    near(r.point, 110, -210)
    expect(r.tracks).toHaveLength(2)
  })

  it("WJ-7: тела стен приоритетнее линии поперёк грани, вдоль грани квадрат идёт к линии: (84, −14) → (90, −10)", () => {
    // квадрат x ∈ [74, 94] у грани y = −10; сторона x = 94 — в 6 см от линии x = 100: сдвиг на 6 см вдоль грани
    for (const r of [start({ x: 84, y: -14 }), vertex({ x: 84, y: -14 })]) {
      expect(r.source).toBe("wall")
      near(r.point, 90, -10)
      expect(r.tracks).toHaveLength(1)
    }
  })

  it("WJ-17: у грани свободной стены F квадрат подтягивается к линии откоса W: (104, −122) → (110, −110), пунктир (100, −10)–(100, −130)", () => {
    const f = w(0, -100, 500, -100, "F")
    const r = start({ x: 104, y: -122 }, [W0, f])
    expect(r.source).toBe("wall")
    near(r.point, 110, -110)
    const sq = placementSquare(r, T)
    expect(Math.min(...sq.map((q) => q.x))).toBeCloseTo(100, 6)
    expect(Math.max(...sq.map((q) => q.x))).toBeCloseTo(120, 6)
    expect(Math.min(...sq.map((q) => q.y))).toBeCloseTo(-130, 6)
    expect(Math.max(...sq.map((q) => q.y))).toBeCloseTo(-110, 6)
    near(r.tracks![0].from, 100, -10)
    near(r.tracks![0].to, 100, -130)
  })

  it("WJ-18: без проёмов прилипание к грани прежнее: (104, −122) → (104, −110), линий нет", () => {
    const f = w(0, -100, 500, -100, "F")
    const r = start({ x: 104, y: -122 }, [W0, f], [])
    expect(r.source).toBe("wall")
    near(r.point, 104, -110)
    expect(r.tracks).toBeUndefined()
  })

  it("WJ-19: сдвиг не отрывает квадрат от стены — тонкая стена (10 см) у короткой F (до x = 179): квадрат остаётся у грани без линии", () => {
    // квадрат [169, 179] у конца F; сдвиг на линию x = 190 (на 11 см) дал бы [180, 190], не касающийся F
    const f = w(0, -100, 179, -100, "F")
    const r = snapStartVertex({ x: 179, y: -122 }, [W0, f], RADIUS, STEP, 10, [DOOR])
    expect(r.source).toBe("wall")
    near(r.point, 174, -110)
    expect(r.tracks).toBeUndefined()
  })

  it("WJ-19b: тот же сдвиг у F подлиннее (до x = 185) допустим: квадрат остаётся касающимся стены", () => {
    const f = w(0, -100, 185, -100, "F")
    const r = snapStartVertex({ x: 185, y: -122 }, [W0, f], RADIUS, STEP, 10, [DOOR])
    expect(r.source).toBe("wall")
    expect(r.tracks).toHaveLength(1)
    expect(Math.max(...placementSquare(r, 10).map((q) => q.x))).toBeCloseTo(190, 6)
  })

  it("WJ-22: сдвиг, при котором квадрат налагался бы на тело другой стены, не выполняется", () => {
    // G (тело x ∈ [117, 137]) мешает квадрату [100, 120] у линии x = 100; квадрат у грани [94, 114] свободен
    const g = w(127, -200, 127, -125, "G")
    const r = start({ x: 104, y: -122 }, [W0, w(0, -100, 500, -100, "F"), g])
    expect(r.source).toBe("wall")
    near(r.point, 104, -110)
    expect(r.tracks).toBeUndefined()
  })

  it("WJ-23: у торца свободной стены линия откоса квадрат не сдвигает: цель прилипания — торец, а не грань", () => {
    const v = w(300, 0, 300, 500, "V")
    const dv = door("V", "a", 100, 90, 210, "dv") // откосы y = 100 и 190: линии горизонтальны
    const f = w(0, 110, 250, 110, "F") // свободный торец на x = 250, квадрат у торца лежит на y ∈ [100, 120]
    const r = start({ x: 252, y: 112 }, [v, f], [dv])
    expect(r.source).toBe("wall")
    expect(r.tracks).toBeUndefined()
  })
  it("WJ-20: вторая вершина цепочки у грани F тоже подтягивается к линии откоса", () => {
    const f = w(0, -100, 500, -100, "F")
    const seg = chainSegment({
      start: { x: 400, y: -300 },
      ref: null,
      raw: { x: 104, y: -122 },
      walls: [W0, f],
      radiusCm: RADIUS,
      gridStepCm: STEP,
      thicknessCm: T,
      ortho: false,
      typedAngleDeg: null,
      typedLengthCm: null,
      doorways: [DOOR],
    })
    expect(seg.snap.source).toBe("wall")
    near(seg.snap.point, 110, -110)
    expect(seg.snap.tracks).toHaveLength(1)
  })

  it("WJ-21: линия, параллельная грани, квадрат у грани не сдвигает: вертикальная стена с проёмом, свободная горизонтальная стена", () => {
    const v = w(300, 0, 300, 500, "V")
    const dv = door("V", "a", 100, 90, 210, "dv") // откосы y = 100, 190: линии горизонтальны
    const f = w(0, 140, 250, 140, "F") // грань y = 130 сверху, горизонтальна — параллельна линиям
    const r = start({ x: 104, y: 126 }, [v, f], [dv])
    expect(r.source).toBe("wall")
    near(r.point, 104, 130)
    expect(r.tracks).toBeUndefined()
  })

  it("WJ-8: позиция, квадрат которой налагался бы на тело, не предлагается", () => {
    const x = w(125, -100, 125, -20, "X") // тело x ∈ [115, 135] налагается на квадрат x ∈ [100, 120]
    const r = start({ x: 104, y: -60 }, [W0, x])
    expect(r.source).not.toBe("jamb")
  })

  it("WJ-9: вторая вершина цепочки без направления — та же привязка", () => {
    const seg = chainSegment({
      start: { x: 400, y: -300 },
      ref: null,
      raw: { x: 104, y: -260 },
      walls: [W0],
      radiusCm: RADIUS,
      gridStepCm: STEP,
      thicknessCm: T,
      ortho: false,
      typedAngleDeg: null,
      typedLengthCm: null,
      doorways: [DOOR],
    })
    expect(seg.snap.source).toBe("jamb")
    near(seg.end, 110, -260)
  })

  it("WJ-10: заданное направление — линия откоса не меняет направление и длину", () => {
    const seg = chainSegment({
      start: { x: 110, y: -300 },
      ref: null,
      raw: { x: 104, y: -260 },
      walls: [W0],
      radiusCm: RADIUS,
      gridStepCm: STEP,
      thicknessCm: T,
      ortho: true,
      typedAngleDeg: null,
      typedLengthCm: null,
      doorways: [DOOR],
    })
    expect(seg.snap.source).not.toBe("jamb")
    expect(seg.end.x).toBeCloseTo(110, 6)
  })

  it("WJ-11: конец оси стены без проёмов линии не задаёт — сетка", () => {
    const r = start({ x: 506, y: -60 }, [W0], [])
    expect(r.source).toBe("grid")
    near(r.point, 510, -60)
    expect(r.tracks).toBeUndefined()
  })

  it("WJ-12: входные данные не изменяются", () => {
    const walls = deepFreeze([w(0, 0, 500, 0, "W")])
    const elements = deepFreeze([door("W", "a", 100, 90, 210, "d1")])
    expect(() => start({ x: 104, y: -60 }, walls, elements)).not.toThrow()
  })

  it("WJ-13: клик по прилипшему к линии квадрату — рисование, не выделение", () => {
    const r = start({ x: 104, y: -60 })
    expect(wallClickAction({ x: 104, y: -60 }, r, [W0], RADIUS).kind).toBe("draw")
  })

  it("WJ-16: «Гипсокартон» толщиной 10 см на плане «Реконструкция» — тот же расчёт, вершина (105, −60)", () => {
    const r = snapStartVertex({ x: 104, y: -60 }, [W0], RADIUS, STEP, 10, [DOOR])
    expect(r.source).toBe("jamb")
    near(r.point, 105, -60)
    expect(r.tracks).toHaveLength(1)
  })

  it("WJ-14: линия не нарушает существующие привязки без элементов (регрессия)", () => {
    const r = start({ x: 104, y: -60 }, [W0], [])
    expect(r.source).toBe("grid")
    near(r.point, 100, -60)
  })

  it("WJ-15: у грани над проёмом стыка нет, а позиция у линии налагалась бы на тело W — сетка", () => {
    // квадрат x ∈ [100, 120], y ∈ [−24, −4] налагается на тело W (y ∈ [−10, 10]); привязка к грани в проёме запрещена
    const r = start({ x: 104, y: -14 })
    expect(r.source).toBe("grid")
  })
})
