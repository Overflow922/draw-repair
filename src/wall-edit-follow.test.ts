import { describe, expect, it } from "vitest"
import { byId, userWalls } from "./move-joints.test-utils"
import type { Point, Wall } from "./types"
import { moveEndpointBounded, moveWallsBounded } from "./wall-edit"
import { FREE, ORTHO, attachmentHolds, attachments, body, expectPoint, expectWall, overlapDepth, w } from "./wall-edit.test-utils"

// change wall-move-bounds: wall-selection «Границы перемещения примкнутой стены» — примкнутый
// конец следует за изменённой опорной стеной (test-plan HF-*; design D2a).

// точка на линии поперечного смещения lat опорной host на расстоянии dist вдоль оси от её конца from
function onHost(host: Wall, from: "a" | "b", dist: number, lat: number): Point {
  const len = Math.hypot(host.b.x - host.a.x, host.b.y - host.a.y)
  const d = { x: (host.b.x - host.a.x) / len, y: (host.b.y - host.a.y) / len }
  const along = from === "a" ? dist : len - dist
  // поперечное смещение в смысле cross(d, p − a): нормаль (−d.y, d.x)
  return { x: host.a.x + d.x * along - d.y * lat, y: host.a.y + d.y * along + d.x * lat }
}

const corner = (): { walls: Wall[]; T: Wall; H: Wall; S: Wall } => {
  const T = w(0, 0, 300, 0, "T", 20)
  const H = w(0, 0, 0, 400, "H", 20)
  const S = w(10, 200, 110, 200, "S", 10)
  return { walls: [T, H, S], T, H, S }
}

describe("ножка следует за изменённой опорной", () => {
  it("HF-1: опорная поворачивается вслед за стыком — ножка со свободным концом следует целиком, правка не блокируется", () => {
    const { walls, T, H, S } = corner()
    const v = moveWallsBounded(walls, [T], { x: 40, y: 0 }, FREE)
    expectPoint(v, 40, 0, 6)
    expectWall(T, 40, 0, 340, 0, 6)
    expectWall(H, 40, 0, 0, 400, 6)
    // исходно: поперечное смещение −10 (правая грань), 200 см от нижнего (неподвижного) конца H
    const p = onHost(H, "b", 200, -10)
    expectPoint(S.a, p.x, p.y, 6)
    expect(S.b.x - S.a.x).toBeCloseTo(100, 9)
    expect(S.b.y - S.a.y).toBeCloseTo(0, 9)
  })

  it("HF-2: ножка с занятым вторым концом поворачивается, второй конец остаётся на грани", () => {
    const { walls, T, H, S } = corner()
    const K = w(120, 100, 120, 400, "K", 20)
    walls.push(K)
    const v = moveWallsBounded(walls, [T], { x: 40, y: 0 }, FREE)
    expectPoint(v, 40, 0, 6)
    const p = onHost(H, "b", 200, -10)
    expectPoint(S.a, p.x, p.y, 6)
    expectPoint(S.b, 110, 200, 9)
    expectWall(K, 120, 100, 120, 400, 9)
  })

  it("HF-3: укорочение опорной из-под ножки останавливается на границе диапазона (y = 195)", () => {
    const H = w(0, 0, 0, 400, "H", 20)
    const S = w(10, 200, 110, 200, "S", 10)
    const p = moveEndpointBounded([H, S], H, "a", { x: 0, y: 300 }, FREE)
    expect(Math.abs(p.x)).toBeLessThanOrEqual(1e-9)
    expect(Math.abs(p.y - 195)).toBeLessThanOrEqual(1e-3)
    expectWall(S, 10, 200, 110, 200, 9)
  })

  it("HF-3a: укорочение опорной в пределах диапазона — ножка на месте", () => {
    const H = w(0, 0, 0, 400, "H", 20)
    const S = w(10, 200, 110, 200, "S", 10)
    expectPoint(moveEndpointBounded([H, S], H, "a", { x: 0, y: 100 }, FREE), 0, 100, 9)
    expectWall(S, 10, 200, 110, 200, 9)
  })

  it("HF-4: орто — растяжение опорной не сдвигает ножку", () => {
    const { walls, T, H, S } = corner()
    expectPoint(moveWallsBounded(walls, [T], { x: 0, y: -40 }, ORTHO), 0, -40, 9)
    expectWall(H, 0, -40, 0, 400, 9)
    expectWall(S, 10, 200, 110, 200, 9)
  })

  it("HF-5: поворот опорной перетаскиванием её конца — ножка следует от неподвижного конца", () => {
    const H = w(0, 0, 0, 400, "H", 20)
    const S = w(10, 200, 110, 200, "S", 10)
    expectPoint(moveEndpointBounded([H, S], H, "a", { x: 100, y: 0 }, FREE), 100, 0, 6)
    const p = onHost(H, "b", 200, -10)
    expectPoint(S.a, p.x, p.y, 6)
    expect(S.b.x - S.a.x).toBeCloseTo(100, 9)
    expect(S.b.y - S.a.y).toBeCloseTo(0, 9)
  })

  it("HF-7: следование распространяется на ножку ножки (R примкнута к S, S сдвинута следованием)", () => {
    const { walls, T, S } = corner()
    // R.a на нижней грани S (y = 205) в 50 см от S.a, второй конец R свободен
    const R = w(60, 205, 60, 300, "R", 10)
    walls.push(R)
    const v = moveWallsBounded(walls, [T], { x: 40, y: 0 }, FREE)
    expectPoint(v, 40, 0, 6)
    // S сдвинута целиком (оба её конца смещены одинаково) — R.a на том же месте относительно S
    expect(R.a.x - S.a.x).toBeCloseTo(50, 9)
    expect(R.a.y - S.a.y).toBeCloseTo(5, 9)
    expect(R.b.x - R.a.x).toBeCloseTo(0, 9)
    expect(R.b.y - R.a.y).toBeCloseTo(95, 9)
    expect(S.a.x).toBeGreaterThan(10.5)
  })

  it("HF-8: стена, сдвигаемая следованием, не проходит сквозь препятствие — правка ограничивается", () => {
    const { walls, T, S } = corner()
    // препятствие справа от S, не связано ни с одной стеной; зазор 10 см до торца S
    const X = w(125, 100, 125, 400, "X", 10)
    walls.push(X)
    const before = walls.map((x) => ({ ...x, a: { ...x.a }, b: { ...x.b } }))
    const v = moveWallsBounded(walls, [T], { x: 40, y: 0 }, FREE)
    expect(v.x).toBeGreaterThan(0)
    expect(v.x).toBeLessThan(40)
    expect(overlapDepth(body(S), body(X))).toBeLessThanOrEqual(0.01)
    expectWall(X, 125, 100, 125, 400, 9)
    for (const a of attachments(before)) expect(attachmentHolds(a, before, walls)).toBe(true)
  })

  it("HF-6: чертёж пользователя — сдвиг верхней стены на 10 см без орто применяется, примыкания сохранены", () => {
    const before = userWalls()
    const walls = userWalls()
    const v = moveWallsBounded(walls, [byId(walls, "b9433dfb")], { x: 10, y: 0 }, FREE)
    expectPoint(v, 10, 0, 6)
    for (const a of attachments(before)) expect(attachmentHolds(a, before, walls)).toBe(true)
  })
})
