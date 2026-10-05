import { describe, expect, it } from "vitest"
import { sceneR, sceneR2, sceneU } from "./ortho-axis.test-utils"
import type { Point, Wall } from "./types"
import { moveEndpointBounded, moveWallsBounded } from "./wall-edit"
import { ORTHO, expectPoint, expectWall, sceneTS, snapshot, w } from "./wall-edit.test-utils"
import type { Snapshot } from "./wall-edit.test-utils"

// change ortho-axis-lock, wall-selection «Орто без боковой составляющей» (design D5): при орто
// вектор правки, к которому применяются правила следования и ограничения, всегда лежит на оси
// большей составляющей — диагональный вектор не доходит до «Орто-растяжения связанных стен».

// стена совпадает со снимком точно (координаты не тронуты)
function untouched(wall: Wall, walls: readonly Wall[], snap: Snapshot): void {
  const c = snap.coords[walls.indexOf(wall)]
  expect(wall.a).toEqual(c.a)
  expect(wall.b).toEqual(c.b)
}

describe("перемещение при орто: вектор на оси", () => {
  it("WE-1: диагональ (30, −40) у комнаты — вектор (0, −40), нижняя стена не сдвинута", () => {
    const { walls, top, right, bottom, left } = sceneR()
    const snap = snapshot(walls)
    expectPoint(moveWallsBounded(walls, [top], { x: 30, y: -40 }, ORTHO), 0, -40, 6)
    expectWall(top, 0, -40, 400, -40, 6)
    expectWall(right, 400, -40, 400, 300, 6)
    expectWall(left, 0, 300, 0, -40, 6)
    untouched(bottom, walls, snap)
  })

  it("WE-2: ровно 45° (30, −30) — горизонталь: комната сместилась на 30 вправо по правилу растяжения, без вертикальной составляющей", () => {
    const { walls, top, right, bottom, left } = sceneR()
    expectPoint(moveWallsBounded(walls, [top], { x: 30, y: -30 }, ORTHO), 30, 0, 6)
    expectWall(top, 30, 0, 430, 0, 6)
    expectWall(right, 430, 0, 430, 300, 6)
    expectWall(bottom, 430, 300, 30, 300, 6)
    expectWall(left, 30, 300, 30, 0, 6)
  })

  it("WE-U: раскладка пользователя, диагональ (30, −40) — двигаются только S и концы её соседей", () => {
    const { walls, S, L, M1, M2, V } = sceneU()
    const snap = snapshot(walls)
    expectPoint(moveWallsBounded(walls, [S], { x: 30, y: -40 }, ORTHO), 0, -40, 6)
    expectWall(S, 0, 130, 240, 130, 6)
    expectWall(L, 0, 0, 0, 130, 6)
    expectWall(M1, 250, 0, 250, 130, 6)
    expectWall(M2, 250, 130, 250, 300, 6)
    expectWall(V, 100, 140, 100, 310, 6)
    for (const x of walls) if (![S, L, M1, M2, V].includes(x)) untouched(x, walls, snap)
  })

  it("WE-R2: две комнаты, диагональ (40, −40.5) у T1 — вертикаль; нижняя стена B не сдвинута", () => {
    const { walls, T1, T2, R, B, L, P } = sceneR2()
    const snap = snapshot(walls)
    expectPoint(moveWallsBounded(walls, [T1], { x: 40, y: -40.5 }, ORTHO), 0, -40.5, 6)
    expectWall(T1, 0, -40.5, 400, -40.5, 6)
    expectWall(T2, 400, -40.5, 800, -40.5, 6)
    expectWall(R, 800, -40.5, 800, 300, 6)
    expectWall(L, 0, 300, 0, -40.5, 6)
    expectWall(P, 400, -40.5, 400, 300, 6)
    untouched(B, walls, snap)
  })
})

describe("перемещение при орто: ограничение пересечений с вектором на оси", () => {
  it("WC-1: диагональ (30, −100) к стене над комнатой — вертикаль до касания (0, −30); стена O и нижняя не тронуты", () => {
    const { walls: room, top, right, bottom, left } = sceneR()
    const O = w(-50, -50, 450, -50, "O", 20)
    const walls = [...room, O]
    const snap = snapshot(walls)
    const r = moveWallsBounded(walls, [top], { x: 30, y: -100 }, ORTHO)
    expect(Math.abs(r.x)).toBe(0)
    expect(r.y).toBeCloseTo(-30, 3)
    expectWall(top, 0, -30, 400, -30, 3)
    expectWall(right, 400, -30, 400, 300, 3)
    expectWall(left, 0, 300, 0, -30, 3)
    untouched(bottom, walls, snap)
    untouched(O, walls, snap)
  })
})

describe("перемещение при орто: инварианты", () => {
  const directions = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8 + 0.05)
  const lengths = [7, 40, 120]
  const vec = (ang: number, l: number): Point => ({ x: Math.cos(ang) * l, y: Math.sin(ang) * l })

  it("WE-INV: применённый вектор не имеет составляющей поперёк оси большей составляющей запроса", () => {
    for (const make of [() => sceneR().walls, () => sceneR2().walls])
      for (const ang of directions)
        for (const l of lengths) {
          const walls = make()
          const v = vec(ang, l)
          const r = moveWallsBounded(walls, [walls[0]], v, ORTHO)
          if (Math.abs(v.x) >= Math.abs(v.y)) expect(Math.abs(r.y)).toBe(0)
          else expect(Math.abs(r.x)).toBe(0)
        }
  })

  it("INV-NO-CASCADE: вектор с преобладающей вертикалью не сдвигает нижнюю стену комнаты (R и R2)", () => {
    for (const ang of directions)
      for (const l of lengths) {
        const v = vec(ang, l)
        if (Math.abs(v.y) <= Math.abs(v.x)) continue
        const r1 = sceneR()
        const s1 = snapshot(r1.walls)
        moveWallsBounded(r1.walls, [r1.top], v, ORTHO)
        untouched(r1.bottom, r1.walls, s1)
        const r2 = sceneR2()
        const s2 = snapshot(r2.walls)
        moveWallsBounded(r2.walls, [r2.T1], v, ORTHO)
        untouched(r2.B, r2.walls, s2)
      }
  })
})

describe("перетаскивание конца при орто: конец на оси через противоположный", () => {
  it("WE-3: цель (430, −300) (35° от горизонтали) — конец на горизонтали (430, 0); левая стена не сдвинута", () => {
    const { walls, top, right, bottom, left } = sceneR()
    const snap = snapshot(walls)
    expectPoint(moveEndpointBounded(walls, top, "b", { x: 430, y: -300 }, ORTHO), 430, 0, 6)
    expectWall(top, 0, 0, 430, 0, 6)
    expectWall(right, 430, 0, 430, 300, 6)
    expectWall(bottom, 430, 300, 0, 300, 6)
    untouched(left, walls, snap)
  })

  it("WE-4: наклонная стена (0,0)–(100,58), цель (101, 58) — стена становится горизонтальной", () => {
    const D = { id: "D", a: { x: 0, y: 0 }, b: { x: 100, y: 58 }, thicknessCm: 20, type: "brick" as const }
    expectPoint(moveEndpointBounded([D], D, "b", { x: 101, y: 58 }, ORTHO), 101, 0, 6)
    expectWall(D, 0, 0, 101, 0, 6)
  })

  it("GE-5: наклонная ножка S (10,200)–(110,260), примкнутый конец a — ось по вектору от второго конца (горизонталь y = 260)", () => {
    // (40, 260): вектор от b (−70, 0) — горизонталь; ось по вектору от самого конца (30, 60) дала бы вертикаль
    // и конец остался бы в (10, 200). (40, 230): вектор от b (−70, −30), 23° — орто всё равно действует
    for (const target of [{ x: 40, y: 260 }, { x: 40, y: 230 }]) {
      const H = w(0, 0, 0, 400, "H", 20)
      const S = w(10, 200, 110, 260, "S", 10)
      expectPoint(moveEndpointBounded([H, S], S, "a", target, ORTHO), 10, 260, 6)
      expectWall(S, 10, 260, 110, 260, 6)
      expectWall(H, 0, 0, 0, 400, 9)
    }
  })

  it("GE-4: примкнутый конец, цель (60, 100) — ось вертикаль через второй конец, положения на грани нет: стена на месте", () => {
    const { walls, S } = sceneTS()
    const p = moveEndpointBounded(walls, S, "a", { x: 60, y: 100 }, ORTHO)
    expectPoint(p, 10, 200, 6)
    expectWall(S, 10, 200, 110, 200, 6)
  })
})
