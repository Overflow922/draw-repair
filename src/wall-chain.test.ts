import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import type { StartRef } from "./wall-angle"
import { snapRadiusCm, snapVertex } from "./wall-snap"
import type { Point, Wall } from "./types"
import { W, deepFreeze, expectPoint, sceneS } from "./wall-snap.test-utils"

// change wall-relative-angle-snap (design D5): единый расчёт сегмента построения —
// превью и фиксация, орто относительно стены примыкания, введённые угол и длина.

const GRID = 10
const R = snapRadiusCm(1)
const RAD = Math.PI / 180
const dirDeg = (deg: number): Point => ({ x: Math.cos(deg * RAD), y: Math.sin(deg * RAD) })
const rot = (v: Point, deg: number): Point => ({
  x: v.x * Math.cos(deg * RAD) - v.y * Math.sin(deg * RAD),
  y: v.x * Math.sin(deg * RAD) + v.y * Math.cos(deg * RAD),
})
const along = (p: Point, d: Point, s: number): Point => ({ x: p.x + d.x * s, y: p.y + d.y * s })
const unitOf = (v: Point): Point => {
  const l = Math.hypot(v.x, v.y)
  return { x: v.x / l, y: v.y / l }
}

// начало цепочки так, как его фиксирует первый клик: прилипание + опора
function startAt(cursor: Point, walls: Wall[]): { start: Point; ref: StartRef | null } {
  const snap = snapVertex(cursor, walls, R, GRID, 20)
  return { start: snap.point, ref: startRefOf(snap) }
}

function segment(over: Partial<ChainInput> & Pick<ChainInput, "start" | "ref" | "raw" | "walls">): ChainSegment {
  return chainSegment({
    radiusCm: R,
    gridStepCm: GRID,
    thicknessCm: 20,
    ortho: false,
    typedAngleDeg: null,
    typedLengthCm: null,
    ...over,
  })
}

function expectDir(actual: Point | null, expected: Point): void {
  expect(actual).not.toBeNull()
  if (!actual) return
  expect(actual.x).toBeCloseTo(expected.x, 9)
  expect(actual.y).toBeCloseTo(expected.y, 9)
}

// сцена: две параллельные стены, начало на верхней грани A в (100,10)
const twoWalls = (): Wall[] => [W(0, 0, 300, 0), W(0, 200, 300, 200)]

describe("chainSegment: орто относительно стены примыкания", () => {
  it("CH-SLANT-1: перпендикуляр к наклонной стене — превью и угол ровно 90", () => {
    const u = dirDeg(30)
    const n = { x: -u.y, y: u.x }
    const walls = [W(0, 0, 100 * u.x, 100 * u.y)]
    const { start, ref } = startAt({ x: 50 * u.x + 14 * n.x, y: 50 * u.y + 14 * n.y }, walls)
    expect(ref?.kind).toBe("face")
    const seg = segment({ start, ref, walls, raw: along(start, rot(n, 10), 150), ortho: true })
    expectDir(seg.dir, n)
    expect(seg.angleDeg).toBeCloseTo(90, 9)
    // конец на луче перпендикуляра
    const rel = { x: seg.end.x - start.x, y: seg.end.y - start.y }
    expect(Math.abs(rel.x * n.y - rel.y * n.x)).toBeLessThanOrEqual(1e-9)
  })

  it("CH-CAP-1: от торца — продолжение 180 и поворот 90 в сторону курсора", () => {
    const walls = sceneS()
    const { start, ref } = startAt({ x: 106, y: 0 }, walls)
    expect(ref?.kind).toBe("cap")
    const straight = segment({ start, ref, walls, raw: { x: 250, y: 20 }, ortho: true })
    expectDir(straight.dir, { x: 1, y: 0 })
    expect(straight.angleDeg).toBeCloseTo(180, 9)
    expectPoint(straight.end, 250, 0)
    const down = segment({ start, ref, walls, raw: { x: 120, y: 150 }, ortho: true })
    expectDir(down.dir, { x: 0, y: 1 })
    expect(down.angleDeg).toBeCloseTo(90, 9)
    const up = segment({ start, ref, walls, raw: { x: 120, y: -150 }, ortho: true })
    expectDir(up.dir, { x: 0, y: -1 })
    expect(up.angleDeg).toBeCloseTo(90, 9)
  })

  it("CH-FREE-1: свободное начало — оси экрана, наклонная стена рядом не используется", () => {
    const u = dirDeg(30)
    const walls = [W(0, 0, 100 * u.x, 100 * u.y)]
    const start = { x: 0, y: 300 }
    const seg = segment({ start, ref: null, walls, raw: along(start, dirDeg(8), 120), ortho: true })
    expectDir(seg.dir, { x: 1, y: 0 })
    expectPoint(seg.end, 120, 300)
    expect(seg.angleDeg).toBeNull()
  })

  it("CH-FREE-2: свободное начало — введённый угол не применяется, угла нет", () => {
    const start = { x: 0, y: 0 }
    const seg = segment({ start, ref: null, walls: [], raw: { x: 100, y: 37 }, typedAngleDeg: 60 })
    expectPoint(seg.end, 100, 40)
    expectDir(seg.dir, unitOf({ x: 100, y: 40 }))
    expect(seg.angleDeg).toBeNull()
    expect(seg.refRay).toBeNull()
  })

  it("CH-OFF-1: орто выключено — направление свободное, угол показывается фактический", () => {
    const walls = sceneS()
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    expectPoint(start, 50, 10)
    const seg = segment({ start, ref, walls, raw: { x: 110, y: 210 } })
    expectPoint(seg.end, 110, 210)
    expectDir(seg.dir, unitOf({ x: 60, y: 200 }))
    const expected = 90 - Math.atan2(60, 200) / RAD
    expect(seg.angleDeg).toBeCloseTo(expected, 9)
    expect(Math.round(seg.angleDeg ?? NaN)).toBe(73)
    // контроль: при включённом орто курсор в пределах 15° от нормали даёт перпендикуляр
    const on = segment({ start, ref, walls, raw: { x: 90, y: 210 }, ortho: true })
    expectDir(on.dir, { x: 0, y: 1 })
    const off = segment({ start, ref, walls, raw: { x: 90, y: 210 } })
    expectDir(off.dir, unitOf({ x: 40, y: 200 }))
  })
})

describe("chainSegment: точная длина", () => {
  const walls = sceneS()
  const raw5 = { x: 50 + 200 * Math.sin(5 * RAD), y: 10 + 200 * Math.cos(5 * RAD) } // сетка → (70,210)

  it("CH-LEN-1: орто выключено — точная длина вдоль превью, без фиксации перпендикуляра", () => {
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    const preview = segment({ start, ref, walls, raw: raw5 })
    expectPoint(preview.end, 70, 210)
    const typed = segment({ start, ref, walls, raw: raw5, typedLengthCm: 300 })
    const d = unitOf({ x: 20, y: 200 })
    expectDir(typed.dir, d)
    expectPoint(typed.end, 50 + 300 * d.x, 10 + 300 * d.y)
    expect(typed.angleDeg).not.toBeCloseTo(90, 3)
  })

  it("CH-LEN-2: орто включено — точная длина строго по опорному направлению", () => {
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    const seg = segment({ start, ref, walls, raw: raw5, ortho: true, typedLengthCm: 300 })
    expectPoint(seg.end, 50, 310)
    expect(seg.angleDeg).toBeCloseTo(90, 9)
  })

  it("CH-LEN-3: угол и длина — стена введённой длины под введённым углом", () => {
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    const seg = segment({ start, ref, walls, raw: raw5, typedAngleDeg: 90, typedLengthCm: 300 })
    expectPoint(seg.end, 50, 310)
    const slanted = segment({ start, ref, walls, raw: raw5, typedAngleDeg: 60, typedLengthCm: 200 })
    expectPoint(slanted.end, 50 + 200 * Math.cos(60 * RAD), 10 + 200 * Math.sin(60 * RAD))
    expect(slanted.angleDeg).toBeCloseTo(60, 9)
  })

  it("CH-COMMIT-1: превью и фиксация — один расчёт, одинаковый конец при одинаковых входах", () => {
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    const input: ChainInput = {
      start,
      ref,
      raw: raw5,
      walls,
      radiusCm: R,
      gridStepCm: GRID,
      thicknessCm: 20,
      ortho: true,
      typedAngleDeg: null,
      typedLengthCm: 300,
    }
    const preview = chainSegment(input)
    const commit = chainSegment(input)
    expect(commit.end).toEqual(preview.end)
    expect(commit.dir).toEqual(preview.dir)
  })
})

describe("chainSegment: введённый угол", () => {
  it("CH-TYPED-1: введённый угол приоритетнее орто", () => {
    const walls = sceneS()
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    const seg = segment({ start, ref, walls, raw: { x: 55, y: 210 }, ortho: true, typedAngleDeg: 80 })
    expectDir(seg.dir, { x: Math.sin(10 * RAD), y: Math.cos(10 * RAD) })
    expect(seg.angleDeg).toBeCloseTo(80, 9)
  })

  it("CH-TYPED-2: угол вне диапазона или 0 не применяется — работает орто", () => {
    const walls = sceneS()
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    for (const typed of [120, 0, -5]) {
      const seg = segment({ start, ref, walls, raw: { x: 67, y: 209 }, ortho: true, typedAngleDeg: typed })
      expectDir(seg.dir, { x: 0, y: 1 })
    }
    // без орто — направление курсора
    const free = segment({ start, ref, walls, raw: { x: 70, y: 210 }, typedAngleDeg: 120 })
    expectDir(free.dir, unitOf({ x: 20, y: 200 }))
  })

  it("CH-TYPED-3: луч введённого угла упирается в грань — конец в пересечении, угол сохранён", () => {
    const walls = twoWalls()
    const { start, ref } = startAt({ x: 100, y: 14 }, walls)
    expectPoint(start, 100, 10)
    const hitX = 100 + 180 / Math.tan(60 * RAD)
    const seg = segment({ start, ref, walls, raw: { x: hitX + 3, y: 187 }, typedAngleDeg: 60 })
    expect(seg.snap.source).toBe("wall")
    expectPoint(seg.end, hitX, 190)
    expect(seg.angleDeg).toBeCloseTo(60, 9)
    expectDir(seg.refRay, { x: 1, y: 0 })
  })
})

describe("chainSegment: конец у стены при заданном направлении", () => {
  it("CH-END-1: перпендикуляр от стены до противоположной — конец в пересечении, 90 ровно", () => {
    const walls = twoWalls()
    const { start, ref } = startAt({ x: 100, y: 14 }, walls)
    const seg = segment({ start, ref, walls, raw: { x: 104, y: 186 }, ortho: true })
    expect(seg.snap.source).toBe("wall")
    expectPoint(seg.end, 100, 190)
    expect(seg.angleDeg).toBeCloseTo(90, 9)
  })

  it("CH-END-2: без заданного направления — прежнее прилипание по курсору", () => {
    const walls = twoWalls()
    const { start, ref } = startAt({ x: 100, y: 14 }, walls)
    const seg = segment({ start, ref, walls, raw: { x: 104, y: 186 } })
    expect(seg.snap.source).toBe("wall")
    expectPoint(seg.end, 104, 190)
  })
})

describe("chainSegment: граничные случаи и чистота", () => {
  it("CH-ZERO-1: курсор в начале — нет направления и угла", () => {
    const walls = sceneS()
    const { start, ref } = startAt({ x: 50, y: 14 }, walls)
    const seg = segment({ start, ref, walls, raw: start, ortho: true })
    expect(seg.dir).toBeNull()
    expect(seg.angleDeg).toBeNull()
    expectPoint(seg.end, start.x, start.y)
  })

  it("CH-DET-1: входы не мутируются, результат повторяем", () => {
    const walls = deepFreeze(twoWalls())
    const start = deepFreeze({ x: 100, y: 10 })
    const ref = deepFreeze<StartRef>({ kind: "face", normal: { x: 0, y: 1 } })
    const raw = deepFreeze({ x: 104, y: 186 })
    const a = segment({ start, ref, walls, raw, ortho: true, typedLengthCm: 120 })
    const b = segment({ start, ref, walls, raw, ortho: true, typedLengthCm: 120 })
    expect(b.end).toEqual(a.end)
    expect(b.angleDeg).toBe(a.angleDeg)
    expectPoint(a.end, 100, 130)
  })
})
