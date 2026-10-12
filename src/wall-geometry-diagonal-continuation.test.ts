import { describe, expect, it } from "vitest"
import { displayPolygons } from "./wall-geometry"
import { snapRadiusCm, snapStartVertex } from "./wall-snap"
import { W, clipConvex, deepFreeze, polygonArea } from "./wall-snap.test-utils"
import type { Point, Wall } from "./types"

// change fix-diagonal-corner-block-snap-and-dimensions (test-plan.md, BJ-*): конец продолжения за блоком
// диагонального углового стыка не отменяет заливку (wall-joints, «Диагональный угловой стык»).
// Эталон закрытой формы задан независимо от продакшн-кода: объединение прямоугольников, посчитанных здесь
// из осей и толщин; сравнение — выборкой центров клеток 1 × 1 см и попарной проверкой наложений кусков.
//
// Сцена: A (−100,0)→(0,0) t20, B (10,10)→(10,110) t20; блок x ∈ [0,20], y ∈ [−10,10]; центр дальней
// стороны блока для B — F = (10,−10), для A — (20,0).

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

const A = (): Wall => W(-100, 0, 0, 0)
const B = (): Wall => W(10, 10, 10, 110)

const inRect = (p: Point, r: Rect): boolean => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1

function inPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

const pieces = (walls: Wall[]): Point[][] => walls.flatMap((w) => displayPolygons(w, walls))
const covered = (p: Point, walls: Wall[]): boolean => pieces(walls).some((pc) => inPolygon(p, pc))

// расхождение закрашенной области и эталона: центры клеток 1 × 1 см
function mismatches(walls: Wall[], expected: Rect[], area: Rect): Point[] {
  const bad: Point[] = []
  for (let x = area.x0 + 0.5; x < area.x1; x++)
    for (let y = area.y0 + 0.5; y < area.y1; y++) {
      const p = { x, y }
      if (covered(p, walls) !== expected.some((r) => inRect(p, r))) bad.push(p)
    }
  return bad
}

// наибольшая площадь наложения отображаемых кусков разных стен
function worstOverlap(walls: Wall[]): number {
  let worst = 0
  walls.forEach((w, i) =>
    walls.slice(i + 1).forEach((v) => {
      for (const p of displayPolygons(w, walls))
        for (const q of displayPolygons(v, walls)) {
          const inter = clipConvex(p, q)
          if (inter.length >= 3) worst = Math.max(worst, Math.abs(polygonArea(inter)))
        }
    }),
  )
  return worst
}

const BLOCK: Rect = { x0: 0, y0: -10, x1: 20, y1: 10 }
const AREA: Rect = { x0: -110, y0: -130, x1: 140, y1: 130 }
const A_BODY: Rect = { x0: -100, y0: -10, x1: 0, y1: 10 }

// все клетки блока закрашены
const blockFilled = (walls: Wall[]): boolean => {
  for (let x = 0.5; x < 20; x++) for (let y = -9.5; y < 10; y++) if (!covered({ x, y }, walls)) return false
  return true
}

describe("продолжение стены B за блок", () => {
  it("BJ-1: C (10,−10)→(10,−110) вплотную к блоку — блок залит, полоса x ∈ [0,20], y ∈ [−110,110] без просвета", () => {
    const walls = deepFreeze([A(), B(), W(10, -10, 10, -110)])
    expect(mismatches(walls, [A_BODY, { x0: 0, y0: -110, x1: 20, y1: 110 }], AREA)).toEqual([])
  })

  it("BJ-1a: те же стены — отображаемые куски не налагаются друг на друга", () => {
    expect(worstOverlap([A(), B(), W(10, -10, 10, -110)])).toBeLessThanOrEqual(1e-6)
  })

  it("BJ-1b: оси и длины A, B, C прежние (данные стен не меняются)", () => {
    const walls = deepFreeze([A(), B(), W(10, -10, 10, -110)])
    const before = JSON.stringify(walls)
    pieces(walls)
    expect(JSON.stringify(walls)).toBe(before)
  })

  it("BJ-1c: C раньше B в массиве (порядок C, A, B) — форма та же", () => {
    const walls = [W(10, -10, 10, -110), A(), B()]
    expect(mismatches(walls, [A_BODY, { x0: 0, y0: -110, x1: 20, y1: 110 }], AREA)).toEqual([])
  })

  it("BJ-1d: C толщиной 40 см от конца в F — блок залит (допуск не зависит от толщины C)", () => {
    expect(blockFilled([A(), B(), W(10, -10, 10, -110, 40)])).toBe(true)
  })

  it("BJ-2: A, B и D (20,0)→(120,0) — блок залит, тела покрывают полосу y ∈ [−10,10], x ∈ [−100,120] и B выше", () => {
    const walls = [A(), B(), W(20, 0, 120, 0)]
    expect(mismatches(walls, [{ x0: -100, y0: -10, x1: 120, y1: 10 }, { x0: 0, y0: 10, x1: 20, y1: 110 }], AREA)).toEqual([])
    expect(worstOverlap(walls)).toBeLessThanOrEqual(1e-6)
  })
})

describe("допуск конца продолжения", () => {
  const shifted = [
    ["вдоль оси B на +0.99", 10, -10 + 0.99],
    ["вдоль оси B на −0.99", 10, -10 - 0.99],
    ["поперёк оси B на +0.99", 10 + 0.99, -10],
    ["поперёк оси B на −0.99", 10 - 0.99, -10],
  ] as const

  it.each(shifted)("BJ-3: конец C смещён %s — блок остаётся залитым", (_name, x, y) => {
    expect(blockFilled([A(), B(), W(x, y, x, y - 100)])).toBe(true)
  })

  const beyond = [
    ["вдоль оси B на +1.01", 10, -10 + 1.01],
    ["вдоль оси B на −1.01", 10, -10 - 1.01],
    ["поперёк оси B на +1.01", 10 + 1.01, -10],
    ["поперёк оси B на −1.01", 10 - 1.01, -10],
  ] as const

  it.each(beyond)("BJ-4: конец C смещён %s — блок не заливается (прежнее правило)", (_name, x, y) => {
    expect(blockFilled([A(), B(), W(x, y, x, y - 100)])).toBe(false)
  })
})

describe("конец, не являющийся продолжением", () => {
  it("BJ-5: стена от F перпендикулярно B, (10,−10)→(110,−10) — блок не заливается", () => {
    expect(blockFilled([A(), B(), W(10, -10, 110, -10)])).toBe(false)
  })

  it("BJ-5a: стена от F в сторону блока, (10,−10)→(10,−1) — блок не заливается", () => {
    expect(blockFilled([A(), B(), W(10, -10, 10, -1)])).toBe(false)
  })

  it("BJ-5b: два конца продолжения у дальней стороны блока (C и C′ на расстоянии 0.5 см) — блок не заливается", () => {
    expect(blockFilled([A(), B(), W(10, -10, 10, -110), W(10.5, -10, 10.5, -110)])).toBe(false)
  })

  it("BJ-5c: чужой конец вдали от F, но в пороге (−5,−14) — блок не заливается", () => {
    expect(blockFilled([A(), B(), W(-5, -14, -5, -110)])).toBe(false)
  })

  it("BJ-5d: без третьей стены блок по-прежнему залит (регрессия)", () => {
    expect(blockFilled([A(), B()])).toBe(true)
  })
})

describe("интеграция с привязкой", () => {
  it("BJ-6: C от вершины прилипания (курсор (15,−15)) вниз на 100 см — полоса x ∈ [0,20], y ∈ [−110,110] закрыта без просвета", () => {
    const base = [A(), B()]
    const snap = snapStartVertex({ x: 15, y: -15 }, base, snapRadiusCm(1), 10, 20)
    expect(snap.source).toBe("wall")
    const walls = [...base, W(snap.point.x, snap.point.y, snap.point.x, snap.point.y - 100)]
    expect(mismatches(walls, [A_BODY, { x0: 0, y0: -110, x1: 20, y1: 110 }], AREA)).toEqual([])
    expect(worstOverlap(walls)).toBeLessThanOrEqual(1e-6)
  })
})

export { BLOCK }
