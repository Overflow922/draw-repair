import { describe, expect, it } from "vitest"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "./wall-edit"
import { FREE, ORTHO, expectPoint, expectWall, restore, sceneTS, scenePP, snapshot, unchanged, w } from "./wall-edit.test-utils"

// change wall-move-bounds: wall-selection «Границы перемещения примкнутой стены» и изменённое
// «Изменение длины выделенной стены с клавиатуры» (test-plan TB-*, LI-*; API — design D1).

describe("границы примкнутой стены: перемещение", () => {
  it("TB-1: жест от опорной стены — ножка не отрывается, опорная на месте", () => {
    const { walls, H, S } = sceneTS()
    const v = moveWallsBounded(walls, [S], { x: 50, y: 0 }, FREE)
    expectPoint(v, 0, 0)
    expectWall(S, 10, 200, 110, 200)
    expectWall(H, 0, 0, 0, 400)
  })

  it("TB-2: жест в опорную стену — ножка не вдавливается", () => {
    const { walls, S } = sceneTS()
    const v = moveWallsBounded(walls, [S], { x: -50, y: 0 }, FREE)
    expectPoint(v, 0, 0)
    expectWall(S, 10, 200, 110, 200)
  })

  it("TB-3: косой жест — применена только составляющая вдоль опорной, длина и направление те же", () => {
    const { walls, S } = sceneTS()
    const v = moveWallsBounded(walls, [S], { x: 30, y: 40 }, FREE)
    expectPoint(v, 0, 40)
    expectWall(S, 10, 240, 110, 240)
  })

  it("TB-4: граница у свободного торца опорной — тело ножки прилегает всей толщиной (y = 395)", () => {
    const { walls, S } = sceneTS()
    const v = moveWallsBounded(walls, [S], { x: 0, y: 300 }, FREE)
    expectPoint(v, 0, 195)
    expectWall(S, 10, 395, 110, 395)
  })

  it("TB-4a: граница у торца a опорной (y = 5)", () => {
    const { walls, S } = sceneTS()
    const v = moveWallsBounded(walls, [S], { x: 0, y: -300 }, FREE)
    expectPoint(v, 0, -195)
    expectWall(S, 10, 5, 110, 5)
  })

  it("TB-5: от границы стена сразу следует за указателем (повтор от снимка жеста)", () => {
    const { walls, S } = sceneTS()
    const snap = snapshot(walls)
    moveWallsBounded(walls, [S], { x: 0, y: 300 }, FREE)
    restore(walls, snap)
    const v = moveWallsBounded(walls, [S], { x: 0, y: 100 }, FREE)
    expectPoint(v, 0, 100)
    expectWall(S, 10, 300, 110, 300)
  })

  it("TB-6: внутренний угол — ножка останавливается в касании с угловой стеной (y = 15)", () => {
    const { walls, S } = sceneTS()
    const T = w(0, 0, 300, 0, "T", 20)
    walls.push(T)
    const v = moveWallsBounded(walls, [S], { x: 0, y: -300 }, FREE)
    expectPoint(v, 0, -185)
    expectWall(S, 10, 15, 110, 15)
    expectWall(T, 0, 0, 300, 0)
  })

  it("TB-7: наружный угол — грань продолжается до наружного угла (y = -5)", () => {
    const { walls, S } = sceneTS()
    walls.push(w(0, 0, -300, 0, "T", 20))
    const v = moveWallsBounded(walls, [S], { x: 0, y: -300 }, FREE)
    expectPoint(v, 0, -205)
    expectWall(S, 10, -5, 110, -5)
  })

  it("TB-8: перегородка между параллельными стенами скользит вдоль них", () => {
    const { walls, P } = scenePP()
    const v = moveWallsBounded(walls, [P], { x: 30, y: 40 }, FREE)
    expectPoint(v, 30, 0)
    expectWall(P, 180, 10, 180, 290)
  })

  it("TB-20: перегородка между стенами разной длины — диапазон пересекается по более короткой", () => {
    const top = w(0, 0, 300, 0, "top", 20)
    const bottom = w(0, 300, 200, 300, "bottom", 20)
    const P = w(150, 10, 150, 290, "P", 10)
    const v = moveWallsBounded([top, bottom, P], [P], { x: 100, y: 0 }, FREE)
    expectPoint(v, 45, 0)
    expectWall(P, 195, 10, 195, 290)
  })

  it("TB-20a: зеркально — короче верхняя опорная, диапазон по ней", () => {
    const top = w(0, 0, 200, 0, "top", 20)
    const bottom = w(0, 300, 300, 300, "bottom", 20)
    const P = w(150, 10, 150, 290, "P", 10)
    const v = moveWallsBounded([top, bottom, P], [P], { x: 100, y: 0 }, FREE)
    expectPoint(v, 45, 0)
    expectWall(P, 195, 10, 195, 290)
  })

  it("TB-9: перегородка между непараллельными стенами неподвижна", () => {
    const H1 = w(0, 0, 0, 400, "H1", 20)
    const H2 = w(400, 0, 0, 400, "H2", 20)
    const P = w(10, 200, 200, 200, "P", 10)
    const walls = [H1, H2, P]
    const snap = snapshot(walls)
    expectPoint(moveWallsBounded(walls, [P], { x: 0, y: 30 }, FREE), 0, 0)
    expect(unchanged(walls, snap)).toBe(true)
    expectPoint(moveWallsBounded(walls, [P], { x: 30, y: 0 }, FREE), 0, 0)
    expect(unchanged(walls, snap)).toBe(true)
  })

  it("TB-10: группа без опорной стены ограничивается целиком", () => {
    const { walls, S } = sceneTS()
    const N = w(300, 500, 400, 500, "N", 10)
    walls.push(N)
    const v = moveWallsBounded(walls, [S, N], { x: 50, y: 40 }, FREE)
    expectPoint(v, 0, 40)
    expectWall(S, 10, 240, 110, 240)
    expectWall(N, 300, 540, 400, 540)
  })

  it("TB-11: опорная стена в той же группе — правка не ограничивается", () => {
    const { walls, H, S } = sceneTS()
    const v = moveWallsBounded(walls, [S, H], { x: 50, y: 40 }, FREE)
    expectPoint(v, 50, 40)
    expectWall(S, 60, 240, 160, 240)
    expectWall(H, 50, 40, 50, 440)
  })

  it("TB-12: стрелки — вправо не сдвигает, вниз сдвигает на шаг вдоль опорной", () => {
    const { walls, S } = sceneTS()
    expectPoint(moveWallsBounded(walls, [S], { x: 10, y: 0 }, FREE), 0, 0)
    expectWall(S, 10, 200, 110, 200)
    expectPoint(moveWallsBounded(walls, [S], { x: 0, y: 10 }, FREE), 0, 10)
    expectWall(S, 10, 210, 110, 210)
  })

  it("TB-16: орто — жест от опорной не сдвигает ножку", () => {
    const { walls, S } = sceneTS()
    expectPoint(moveWallsBounded(walls, [S], { x: 50, y: 2 }, ORTHO), 0, 0)
    expectWall(S, 10, 200, 110, 200)
  })

  it("TB-16a: орто — жест вдоль опорной применяется", () => {
    const { walls, S } = sceneTS()
    expectPoint(moveWallsBounded(walls, [S], { x: 0, y: 50 }, ORTHO), 0, 50)
    expectWall(S, 10, 250, 110, 250)
  })

  it("TB-17: никакой вектор не уводит конец с грани и за диапазон (без орто и с орто)", () => {
    const lengths = [5, 20, 60, 200, 500]
    for (const mode of [FREE, ORTHO])
      for (let k = 0; k < 8; k++)
        for (const l of lengths) {
          const { walls, S } = sceneTS()
          const ang = (k * Math.PI) / 4 + 0.1
          moveWallsBounded(walls, [S], { x: Math.cos(ang) * l, y: Math.sin(ang) * l }, mode)
          expect(Math.abs(S.a.x - 10)).toBeLessThanOrEqual(1e-6)
          expect(S.a.y).toBeGreaterThanOrEqual(5 - 1e-6)
          expect(S.a.y).toBeLessThanOrEqual(395 + 1e-6)
          expect(S.b.y).toBeCloseTo(S.a.y, 6)
          expect(S.b.x - S.a.x).toBeCloseTo(100, 6)
        }
  })

  it("TB-18: ножка на оси опорной — скользит вдоль оси, граница по следу на грани (y = 395)", () => {
    const H = w(0, 0, 0, 400, "H", 20)
    const S = w(0, 200, 100, 200, "S", 10)
    const v = moveWallsBounded([H, S], [S], { x: 0, y: 300 }, FREE)
    expectPoint(v, 0, 195)
    expectWall(S, 0, 395, 100, 395)
  })

  it("нулевой вектор ничего не меняет", () => {
    const { walls, S } = sceneTS()
    const snap = snapshot(walls)
    expectPoint(moveWallsBounded(walls, [S], { x: 0, y: 0 }, FREE), 0, 0)
    expect(unchanged(walls, snap)).toBe(true)
  })
})

describe("границы примкнутой стены: перетаскивание конца", () => {
  it("TB-13: примкнутый конец скользит по грани опорной, второй конец на месте", () => {
    const { walls, S } = sceneTS()
    const p = moveEndpointBounded(walls, S, "a", { x: 60, y: 100 }, FREE)
    expectPoint(p, 10, 100)
    expectWall(S, 10, 100, 110, 200)
  })

  it("TB-14: за границей диапазона конец останавливается так, что след тела у торца опорной", () => {
    const { walls, S } = sceneTS()
    const p = moveEndpointBounded(walls, S, "a", { x: 10, y: 500 }, FREE)
    expect(Math.abs(p.x - 10)).toBeLessThanOrEqual(1e-6)
    expect(p.y).toBeLessThan(400)
    const len = Math.hypot(S.b.x - S.a.x, S.b.y - S.a.y)
    // след косой ножки на грани: h_S / |sin θ| = 5 · len / 100
    expect(Math.abs(p.y + (5 * len) / 100 - 400)).toBeLessThanOrEqual(1e-3)
    expectPoint(S.b, 110, 200)
  })

  it("TB-15: свободный конец не ограничен примыканием", () => {
    const { walls, S } = sceneTS()
    const p = moveEndpointBounded(walls, S, "b", { x: 110, y: 260 }, FREE)
    expectPoint(p, 110, 260)
    expectWall(S, 10, 200, 110, 260)
  })

  it("TB-19: орто — ось через второй конец не даёт положения на грани кроме исходного", () => {
    for (const target of [{ x: 105, y: 100 }, { x: 20, y: 205 }]) {
      const { walls, S } = sceneTS()
      const p = moveEndpointBounded(walls, S, "a", target, ORTHO)
      expectPoint(p, 10, 200)
      expectWall(S, 10, 200, 110, 200)
    }
  })

  it("TB-19a: орто не сработало (> 15°) — проекция как без орто", () => {
    const { walls, S } = sceneTS()
    const p = moveEndpointBounded(walls, S, "a", { x: 60, y: 100 }, ORTHO)
    expectPoint(p, 10, 100)
    expectPoint(S.b, 110, 200)
  })
})

describe("ввод длины: подвижный конец", () => {
  it("LI-1: примкнутый конец b остаётся, смещается a", () => {
    const H = w(0, 0, 0, 400, "H", 20)
    const S = w(110, 200, 10, 200, "S", 10)
    const r = resizeWallBounded([H, S], S, 150, FREE)
    expect(r).toEqual({ kind: "applied", lengthCm: 150 })
    expectWall(S, 160, 200, 10, 200)
  })

  it("LI-2: примкнутый конец a остаётся, смещается b", () => {
    const { walls, S } = sceneTS()
    const r = resizeWallBounded(walls, S, 150, FREE)
    expect(r).toEqual({ kind: "applied", lengthCm: 150 })
    expectWall(S, 10, 200, 160, 200)
  })

  it("LI-3: оба конца примкнуты — ввод отвергается, стена без изменений", () => {
    const { walls, P } = scenePP()
    const snap = snapshot(walls)
    const r = resizeWallBounded(walls, P, 350, FREE)
    expect(r).toEqual({ kind: "rejected", reason: "both-ends-attached" })
    expect(unchanged(walls, snap)).toBe(true)
  })

  it("LI-6: свободная стена — конец b вдоль направления", () => {
    const S = w(0, 0, 50, 0, "S", 10)
    const r = resizeWallBounded([S], S, 80, FREE)
    expect(r).toEqual({ kind: "applied", lengthCm: 80 })
    expectWall(S, 0, 0, 80, 0)
  })

  it("LI-7: сосед по стыку с подвижным концом a приваривается к его новой позиции", () => {
    const H = w(0, 0, 0, 400, "H", 20)
    const S = w(110, 200, 10, 200, "S", 10)
    const K = w(110, 200, 110, 300, "K", 10)
    const r = resizeWallBounded([H, S, K], S, 150, FREE)
    expect(r).toEqual({ kind: "applied", lengthCm: 150 })
    expectWall(S, 160, 200, 10, 200)
    expectWall(K, 160, 200, 110, 300)
  })

  it("LI-8: орто — сосед по стыку с b смещается целиком", () => {
    const A = w(0, 0, 100, 0, "A", 20)
    const B = w(100, 0, 100, 100, "B", 20)
    const r = resizeWallBounded([A, B], A, 120, ORTHO)
    expect(r).toEqual({ kind: "applied", lengthCm: 120 })
    expectWall(A, 0, 0, 120, 0)
    expectWall(B, 120, 0, 120, 100)
  })
})
