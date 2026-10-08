import { describe, expect, it } from "vitest"
import type { Wall } from "./types"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "./wall-edit"
import { FREE, ORTHO, expectPoint, expectWall, snapshot, w } from "./wall-edit.test-utils"

// change fix-ortho-tilted-stretch, wall-selection «Орто-растяжение связанных стен»: слегка наклонная
// стена (до 5° от вектора правки) растягивается и не тянет за собой чертёж — для перетаскивания
// конца, перемещения и ввода длины.

function untouched(wall: Wall, walls: readonly Wall[], snap: ReturnType<typeof snapshot>): void {
  const c = snap.coords[walls.indexOf(wall)]
  expect(wall.a).toEqual(c.a)
  expect(wall.b).toEqual(c.b)
}

describe("ввод длины наклонной стены", () => {
  it("TL-07: орто, S (0,0)-(300,3) +20 см — горизонтальный сосед растягивается, стены за ним на месте", () => {
    const S = w(0, 0, 300, 3, "S", 20)
    const N = w(300, 3, 500, 3, "N", 20)
    const D = w(500, 3, 500, 200, "D", 20)
    const walls = [S, N, D]
    const snap = snapshot(walls)
    const target = Math.hypot(300, 3) + 20
    const res = resizeWallBounded(walls, S, target, ORTHO)
    expect(res.kind).toBe("applied")
    const k = target / Math.hypot(300, 3)
    expectPoint(S.b, 300 * k, 3 * k, 6)
    expectPoint(N.a, 300 * k, 3 * k, 6)
    expectPoint(N.b, 500, 3, 6)
    untouched(D, walls, snap)
  })

  it("TL-08: орто, поперечный сосед при вводе длины смещается целиком", () => {
    const S = w(0, 0, 300, 3, "S", 20)
    const N = w(300, 3, 300, 200, "N", 20)
    const walls = [S, N]
    const target = Math.hypot(300, 3) + 20
    resizeWallBounded(walls, S, target, ORTHO)
    const k = target / Math.hypot(300, 3)
    const dx = 300 * k - 300
    const dy = 3 * k - 3
    expectWall(N, 300 + dx, 3 + dy, 300 + dx, 200 + dy, 6)
  })

  it("TL-09: без орто сосед приваривается к новому концу, второй конец на месте", () => {
    const S = w(0, 0, 300, 3, "S", 20)
    const N = w(300, 3, 500, 3, "N", 20)
    const walls = [S, N]
    const target = Math.hypot(300, 3) + 20
    resizeWallBounded(walls, S, target, FREE)
    expectPoint(N.a, S.b.x, S.b.y, 6)
    expectPoint(N.b, 500, 3, 6)
  })
})

describe("перетаскивание конца и перемещение с наклонной стеной", () => {
  it("TL-11: орто, угол комнаты вправо на 30, нижняя стена наклонена на 1.4° — левая стена не сдвигается", () => {
    const top = w(0, 0, 400, 0, "top", 20)
    const right = w(400, 0, 400, 300, "right", 20)
    const bottom = w(400, 300, 0, 310, "bottom", 20)
    const left = w(0, 310, 0, 0, "left", 20)
    const walls = [top, right, bottom, left]
    const snap = snapshot(walls)
    moveEndpointBounded(walls, top, "b", { x: 430, y: 0 }, ORTHO)
    expectWall(top, 0, 0, 430, 0, 6)
    expectWall(right, 430, 0, 430, 300, 6)
    expectWall(bottom, 430, 300, 0, 310, 6)
    untouched(left, walls, snap)
  })

  it("TL-12: орто, перемещение A вверх — наклонный сосед растягивается, стена за ним не сдвигается", () => {
    const A = w(0, 0, 200, 0, "A", 20)
    const B = w(200, 0, 203, 300, "B", 20)
    const C = w(203, 300, 400, 300, "C", 20)
    const walls = [A, B, C]
    const snap = snapshot(walls)
    moveWallsBounded(walls, [A], { x: 0, y: -40 }, ORTHO)
    expectWall(A, 0, -40, 200, -40, 6)
    expectWall(B, 200, -40, 203, 300, 6)
    untouched(C, walls, snap)
  })
})
