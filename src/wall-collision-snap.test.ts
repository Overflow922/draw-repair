import { describe, expect, it } from "vitest"
import { moveEndpointBounded, moveWallsBounded } from "./wall-edit"
import { body, expectPoint, expectWall, overlapDepth, w } from "./wall-edit.test-utils"

// change wall-move-bounds: wall-collision — параллельная стена, привязанная к оси соседней, не
// получает исключения по привязке (T-примыкание на оси требует непараллельных осей).
// Регрессия по проверке пользователем: стена входила в параллельную соседнюю целиком.

describe("привязка к оси параллельной стены", () => {
  it("C-12g: перемещение — опорный конец привязан к оси параллельной N, стена останавливается в касании", () => {
    const N = w(0, 0, 400, 0, "N", 20)
    const W = w(100, 40, 300, 40, "W", 20)
    const v = moveWallsBounded([N, W], [W], { x: 0, y: -40 }, { ortho: false, snappedAxis: N })
    expect(Math.abs(v.x)).toBeLessThanOrEqual(1e-9)
    expect(Math.abs(v.y + 20)).toBeLessThanOrEqual(1e-4)
    expect(overlapDepth(body(W), body(N))).toBeLessThanOrEqual(1e-4)
    expectWall(N, 0, 0, 400, 0, 9)
  })

  it("C-12h: перетаскивание конца на ось коллинеарной стены — остановка у её торца", () => {
    const X = w(150, 200, 400, 200, "X", 20)
    const M = w(0, 200, 100, 200, "M", 10)
    const p = moveEndpointBounded([X, M], M, "b", { x: 200, y: 200 }, { ortho: false, snappedAxis: X })
    expect(Math.abs(p.x - 150)).toBeLessThanOrEqual(1e-4)
    expect(p.y).toBe(200)
    expect(overlapDepth(body(M), body(X))).toBeLessThanOrEqual(1e-4)
  })

  it("C-12i: непараллельная стена (перпендикулярно) — исключение по привязке сохраняется", () => {
    // контроль, что исправление не отключило исключение для настоящего T-примыкания (как C-12b)
    const X = w(200, 0, 200, 400, "X", 20)
    const M = w(300, 200, 400, 200, "M", 10)
    expectPoint(moveWallsBounded([X, M], [M], { x: -100, y: 0 }, { ortho: false, snappedAxis: X }), -100, 0, 9)
    expectWall(M, 200, 200, 300, 200, 9)
  })
})
