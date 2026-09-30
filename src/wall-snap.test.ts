import { describe, expect, it } from "vitest"
import { placementSquare, snapVertex, wallClickAction } from "./wall-snap"
import { snapRadiusCm } from "./wall-geometry"
import type { VertexSnap } from "./wall-snap"
import type { Point } from "./types"
import { W, deepFreeze, expectPoint, expectSameVertices, maxOverlap, sceneL, sceneS } from "./wall-snap.test-utils"

// change fix-wall-snap-overlap: форма квадрата установки (design D6) и решение
// «выделить или рисовать» по клику (design D7).

const GRID = 10

describe("placementSquare", () => {
  it("SQ-FACE-1: прилипание к грани — сторона на грани, квадрат наружу", () => {
    const r = snapVertex({ x: 50, y: 14 }, sceneS(), snapRadiusCm(1), GRID, 20)
    expectSameVertices(placementSquare(r, 20), [
      { x: 40, y: 10 },
      { x: 60, y: 10 },
      { x: 60, y: 30 },
      { x: 40, y: 30 },
    ])
  })

  it("SQ-CAP-1: свободный торец — квадрат снаружи плоскости торца, продолжает полосу", () => {
    const r = snapVertex({ x: 106, y: 3 }, sceneS(), snapRadiusCm(1), GRID, 20)
    expectSameVertices(placementSquare(r, 20), [
      { x: 100, y: -10 },
      { x: 100, y: 10 },
      { x: 120, y: 10 },
      { x: 120, y: -10 },
    ])
  })

  it("SQ-FREE-1: без прилипания — квадрат по осям экрана с центром в вершине", () => {
    const free: VertexSnap = { point: { x: 0, y: 0 }, source: "grid" }
    expectSameVertices(placementSquare(free, 20), [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
    ])
  })

  it("SQ-SIZE-1: сторона квадрата равна переданной толщине", () => {
    const r = snapVertex({ x: 50, y: 14 }, sceneS(), snapRadiusCm(1), GRID, 30)
    expectSameVertices(placementSquare(r, 30), [
      { x: 35, y: 10 },
      { x: 65, y: 10 },
      { x: 65, y: 40 },
      { x: 35, y: 40 },
    ])
  })

  it("SQ-DIAG-1: диагональная стена — квадрат повёрнут по грани и не налагается", () => {
    const walls = [W(0, 0, 100, 100)]
    const n = { x: -Math.SQRT1_2, y: Math.SQRT1_2 } // наружная нормаль грани с этой стороны
    const u = { x: Math.SQRT1_2, y: Math.SQRT1_2 }
    const cursor = { x: 50 + n.x * 13, y: 50 + n.y * 13 } // 3 см снаружи грани
    const r = snapVertex(cursor, walls, snapRadiusCm(1), GRID, 20)
    expect(r.source).toBe("wall")
    const onFace = { x: 50 + n.x * 10, y: 50 + n.y * 10 }
    expectPoint(r.point, onFace.x, onFace.y)
    const at = (k: number, m: number): Point => ({
      x: onFace.x + u.x * k + n.x * m,
      y: onFace.y + u.y * k + n.y * m,
    })
    const sq = placementSquare(r, 20)
    expectSameVertices(sq, [at(-10, 0), at(10, 0), at(10, 20), at(-10, 20)])
    expect(maxOverlap(sq, walls)).toBeLessThanOrEqual(1e-6)
  })

  it("SQ-PURE-1: вход не мутируется", () => {
    const r = deepFreeze(snapVertex({ x: 50, y: 14 }, sceneS(), snapRadiusCm(1), GRID, 20))
    if (r.normal) Object.freeze(r.normal) // неперечислимое поле deepFreeze не обходит
    expect(() => placementSquare(r, 20)).not.toThrow()
  })
})

describe("wallClickAction", () => {
  const tol1 = snapRadiusCm(1)

  it("CLICK-BODY-1: клик в тело у торца выделяет стену", () => {
    const walls = sceneS()
    const raw = { x: 98, y: 0 }
    const r = snapVertex(raw, walls, tol1, GRID, 20)
    expect(wallClickAction(raw, r, walls, tol1)).toEqual({ kind: "select", wall: walls[0] })
  })

  it("CLICK-JOINT-1: клик в ядро стыка выделяет стену, а не начинает цепочку", () => {
    const walls = sceneL()
    const raw = { x: 2, y: 2 }
    const r = snapVertex(raw, walls, tol1, GRID, 20)
    // ядро стыка принадлежит ранней стене A (поздняя не отображается внутри тела ранней)
    expect(wallClickAction(raw, r, walls, tol1)).toEqual({ kind: "select", wall: walls[0] })
    // угловой кусок поздней B у наружного угла
    const corner = { x: -5, y: -5 }
    const rc = snapVertex(corner, walls, tol1, GRID, 20)
    expect(wallClickAction(corner, rc, walls, tol1)).toEqual({ kind: "select", wall: walls[1] })
  })

  it("CLICK-SQ-1: клик по прилипшему квадрату продолжения при отдалённом виде рисует", () => {
    const walls = sceneS()
    const tol = snapRadiusCm(0.5) // 12 см: полосный допуск накрыл бы (106,3)
    const raw = { x: 106, y: 3 }
    const r = snapVertex(raw, walls, tol, GRID, 20)
    expect(r.source).toBe("wall")
    expect(wallClickAction(raw, r, walls, tol)).toEqual({ kind: "draw" })
  })

  it("CLICK-SQ-2: клик по квадрату у наружного угла рисует", () => {
    const walls = sceneL()
    const raw = { x: -15, y: -5 }
    const r = snapVertex(raw, walls, tol1, GRID, 20)
    expect(wallClickAction(raw, r, walls, tol1)).toEqual({ kind: "draw" })
  })

  it("CLICK-EMPTY-1: клик по пустому месту рисует", () => {
    const walls = sceneS()
    const raw = { x: 500, y: 500 }
    const r = snapVertex(raw, walls, tol1, GRID, 20)
    expect(wallClickAction(raw, r, walls, tol1)).toEqual({ kind: "draw" })
  })

  it("CLICK-BAND-1: привязка не прилипла — полосный допуск тонкой стены выделяет", () => {
    const thin = W(0, 0, 100, 0, 2)
    const raw = { x: 50, y: 4 }
    const grid: VertexSnap = { point: { x: 50, y: 0 }, source: "grid" }
    expect(wallClickAction(raw, grid, [thin], 6)).toEqual({ kind: "select", wall: thin })
  })

  it("CLICK-PURE-1: вход не мутируется", () => {
    const walls = deepFreeze(sceneL())
    const raw = deepFreeze({ x: 2, y: 2 })
    const r = deepFreeze(snapVertex({ x: 2, y: 2 }, sceneL(), tol1, GRID, 20))
    if (r.normal) Object.freeze(r.normal)
    expect(() => wallClickAction(raw, r, walls, tol1)).not.toThrow()
  })
})
