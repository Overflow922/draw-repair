import { describe, expect, it } from "vitest"
import { moveWalls } from "./geometry"
import { applyStretch, planOrthoStretch } from "./ortho-stretch"
import { DIAG20, TOL20, byId, dot, len, sub, unitOf, userWalls, wall } from "./move-joints.test-utils"
import type { Point, Wall } from "./types"

// change fix-wall-move-joints: следование примкнутых стен без орто (design D2),
// порог углового стыка с запасом 1 см при перемещении (D1), регрессия на чертеже пользователя.

const D: Point = { x: 7, y: 3 }

// PT: сквозная g, ножка V примкнута к нижней грани g, второй конец V — угловой стык на грани H
const pt = (): { g: Wall; V: Wall; H: Wall } => ({
  g: wall(0, 0, 200, 0, "g"),
  V: wall(100, 10, 100, 150, "V"),
  H: wall(90, 160, 0, 160, "H"),
})

describe("moveWalls без орто: примкнутая стена с занятым вторым концом растягивается", () => {
  it("TS-1: сдвиг поперёк — примкнутый конец следует, второй остаётся в стыке с H", () => {
    const { g, V, H } = pt()
    moveWalls([g, V, H], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(H.a).toEqual({ x: 90, y: 160 })
    expect(H.b).toEqual({ x: 0, y: 160 })
  })

  it("TS-1b: второй конец примкнут к грани третьей стены (T) — тоже занят", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    const K = wall(0, 160, 200, 160, "K") // V.b на верхней грани K в середине
    moveWalls([g, V, K], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(K.a).toEqual({ x: 0, y: 160 })
  })

  it("TS-1c: второй конец состыкован с концом третьей стены точным совпадением — занят", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    const X = wall(100, 150, 300, 150, "X")
    moveWalls([g, V, X], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(X.a).toEqual({ x: 100, y: 150 })
  })

  it("TS-2: сдвиг вдоль сквозной — ножка наклоняется, примкнутый конец остаётся на грани", () => {
    const { g, V, H } = pt()
    moveWalls([g, V, H], [g], { x: 30, y: 0 })
    expect(V.a).toEqual({ x: 130, y: 10 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(H.a).toEqual({ x: 90, y: 160 })
    // конец на грани g: поперечное расстояние до оси g ровно полутолщина
    const n = { x: 0, y: 1 }
    expect(dot(sub(V.a, g.a), n)).toBe(10)
  })

  it("TS-3: перегородка между верхней и нижней стенами удлиняется, нижняя на месте", () => {
    const g = wall(0, 0, 300, 0, "g")
    const b = wall(0, 200, 300, 200, "b")
    const P = wall(150, 10, 150, 190, "P")
    moveWalls([g, b, P], [g], { x: 0, y: -40 })
    expect(P.a).toEqual({ x: 150, y: -30 })
    expect(P.b).toEqual({ x: 150, y: 190 })
    expect(b.a).toEqual({ x: 0, y: 200 })
    expect(b.b).toEqual({ x: 300, y: 200 })
    expect(len(sub(P.b, P.a))).toBe(220)
  })

  it("TS-4: один конец примкнут к грани, второй в стыке с концом перемещаемой — стена целиком ровно один раз", () => {
    const g = wall(0, 0, 200, 0, "g")
    const W = wall(100, 10, 214, 0, "W") // W.b на оси g в 14 см за торцом — стык с g.b
    const v = { x: 0, y: -20 }
    moveWalls([g, W], [g], v)
    expect(W.a).toEqual({ x: 100, y: -10 })
    expect(W.b).toEqual({ x: 214, y: -20 })
  })

  it("TS-4b: оба конца примкнуты к граням перемещаемой — целиком ровно один раз", () => {
    const g = wall(0, 0, 200, 0, "g")
    const W = wall(40, 10, 160, 10, "W")
    moveWalls([g, W], [g], D)
    expect(W.a).toEqual({ x: 47, y: 13 })
    expect(W.b).toEqual({ x: 167, y: 13 })
  })

  it("TS-5: второй конец свободен — ножка смещается целиком", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    moveWalls([g, V], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 130 })
  })

  it("TS-6: протяжка десятью шагами совпадает с одним шагом на суммарный вектор", () => {
    const one = pt()
    moveWalls([one.g, one.V, one.H], [one.g], { x: 30, y: -20 })
    const many = pt()
    for (let i = 0; i < 10; i++) moveWalls([many.g, many.V, many.H], [many.g], { x: 3, y: -2 })
    expect(one.V.a).toEqual({ x: 130, y: -10 })
    expect(one.V.b).toEqual({ x: 100, y: 150 })
    for (const k of ["g", "V", "H"] as const) {
      expect(many[k].a.x).toBeCloseTo(one[k].a.x, 9)
      expect(many[k].a.y).toBeCloseTo(one[k].a.y, 9)
      expect(many[k].b.x).toBeCloseTo(one[k].b.x, 9)
      expect(many[k].b.y).toBeCloseTo(one[k].b.y, 9)
    }
  })

  it("TS-7: занятость — по положению до перемещения: стена группы, подошедшая ко второму концу, его не занимает", () => {
    const g = wall(0, 0, 200, 0, "g")
    // g2 в группе: до сдвига её конец в ≈36 см от V.b, после сдвига на (−20,−10) — в 14.1 см (угловая точка)
    const g2 = wall(130, 170, 300, 170, "g2")
    const V = wall(100, 10, 100, 150, "V")
    moveWalls([g, g2, V], [g, g2], { x: -20, y: -10 })
    expect(V.a).toEqual({ x: 80, y: 0 })
    expect(V.b).toEqual({ x: 80, y: 140 })
  })

  it("TS-7c: занятость — по положению до перемещения: сосед, уже сдвинутый стыковым концом, второй конец не занимает", () => {
    const g = wall(0, 0, 200, 0, "g")
    const X = wall(200, 0, 400, 0, "X") // X.a в стыке с g.b — следует концом, обрабатывается раньше V
    const V = wall(150, -10, 190, -50, "V") // V.a на верхней грани g; V.b до сдвига в ≈51 см от X.a
    moveWalls([g, X, V], [g], { x: 0, y: -40 })
    expect(X.a).toEqual({ x: 200, y: -40 })
    expect(X.b).toEqual({ x: 400, y: 0 })
    expect(V.a).toEqual({ x: 150, y: -50 })
    expect(V.b).toEqual({ x: 190, y: -90 })
  })

  it("TS-7b: занятость — по положению до перемещения: неподвижная стена далеко от второго конца его не занимает", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    const K = wall(110, 120, 300, 120, "K")
    moveWalls([g, V, K], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 130 })
    expect(K.a).toEqual({ x: 110, y: 120 })
  })

  it("TS-13: ножка примкнута концом b, конец a занят — смещается только b", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 150, 100, 10, "V") // V.b на нижней грани g, V.a — угловой стык с H
    const H = wall(90, 160, 0, 160, "H")
    moveWalls([g, V, H], [g], { x: 0, y: -20 })
    expect(V.b).toEqual({ x: 100, y: -10 })
    expect(V.a).toEqual({ x: 100, y: 150 })
    expect(H.a).toEqual({ x: 90, y: 160 })
  })

  it("TS-1e: второй конец в стыке с концом b третьей стены — занят", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    const H = wall(0, 160, 90, 160, "H") // угловой стык образует H.b
    moveWalls([g, V, H], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(H.a).toEqual({ x: 0, y: 160 })
    expect(H.b).toEqual({ x: 90, y: 160 })
  })

  it("TS-14: второй конец занят стеной, которая сама следует за перемещаемой концом — занят, при любом порядке", () => {
    const run = (order: "XV" | "VX"): { X: Wall; V: Wall } => {
      const g = wall(0, 0, 200, 0, "g")
      const X = wall(200, 0, 100, 150, "X") // X.a в стыке с g.b, X.b совпадает с V.b
      const V = wall(100, 10, 100, 150, "V")
      moveWalls(order === "XV" ? [g, X, V] : [g, V, X], [g], { x: 0, y: -20 })
      return { X, V }
    }
    for (const order of ["XV", "VX"] as const) {
      const { X, V } = run(order)
      expect(X.a, order).toEqual({ x: 200, y: -20 })
      expect(X.b, order).toEqual({ x: 100, y: 150 })
      expect(V.a, order).toEqual({ x: 100, y: -10 })
      expect(V.b, order).toEqual({ x: 100, y: 150 })
    }
  })

  it("TS-15: две ножки, сходящиеся вторыми концами, занимают их друг другу — обе растягиваются", () => {
    const g = wall(0, 0, 300, 0, "g")
    const V1 = wall(100, 10, 150, 100, "V1")
    const V2 = wall(200, 10, 150, 100, "V2")
    moveWalls([g, V1, V2], [g], { x: 0, y: -20 })
    expect(V1.a).toEqual({ x: 100, y: -10 })
    expect(V2.a).toEqual({ x: 200, y: -10 })
    expect(V1.b).toEqual({ x: 150, y: 100 })
    expect(V2.b).toEqual({ x: 150, y: 100 })
  })

  it("TS-1d: второй конец примкнут к оси третьей стены (T к оси) — занят", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 160, "V")
    const K = wall(0, 160, 200, 160, "K") // V.b на оси K в середине
    moveWalls([g, V, K], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 160 })
    expect(K.a).toEqual({ x: 0, y: 160 })
  })

  it("TS-11: ножка примкнута к оси перемещаемой стены, второй конец занят — растягивается", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 0, 100, 150, "V") // V.a на оси g в середине
    const H = wall(90, 160, 0, 160, "H")
    moveWalls([g, V, H], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -20 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(H.a).toEqual({ x: 90, y: 160 })
    expect(H.b).toEqual({ x: 0, y: 160 })
  })

  it("TS-12: растяжение до нулевой длины — правило без исключений, концы по правилу", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 30, "V")
    const H = wall(90, 40, 0, 40, "H") // угловой стык на грани у V.b
    moveWalls([g, V, H], [g], { x: 0, y: 20 })
    expect(V.a).toEqual({ x: 100, y: 30 })
    expect(V.b).toEqual({ x: 100, y: 30 })
    expect(H.a).toEqual({ x: 90, y: 40 })
  })
})

describe("moveWalls без орто: отрицательные случаи занятости второго конца", () => {
  it("TS-N1: второй конец в 1 см от грани третьей стены (не стык, не примыкание) — свободен", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    const K = wall(0, 161, 200, 161, "K") // верхняя грань K на y = 151
    moveWalls([g, V, K], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 130 })
  })

  it("TS-N2: вырожденная стена нулевой длины у второго конца не делает его занятым", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    const Z = wall(100, 150, 100, 150, "Z")
    moveWalls([g, V, Z], [g], { x: 0, y: -20 })
    expect(V.b).toEqual({ x: 100, y: 130 })
    expect(Z.a).toEqual({ x: 100, y: 150 })
  })

  it("TS-N4: второй конец на продолжении грани третьей стены за её торцом (дальше порога) — свободен", () => {
    const g = wall(0, 0, 200, 0, "g")
    const V = wall(100, 10, 100, 150, "V")
    const K = wall(120, 160, 300, 160, "K") // линия грани K проходит через V.b, но V.b за торцом K в ≈22.4 см
    moveWalls([g, V, K], [g], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 130 })
  })

  it("TS-N3: нулевой вектор ничего не меняет", () => {
    const { g, V, H } = pt()
    moveWalls([g, V, H], [g], { x: 0, y: 0 })
    expect(V.a).toEqual({ x: 100, y: 10 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(g.a).toEqual({ x: 0, y: 0 })
  })
})

describe("moveWalls без орто: групповое перетаскивание", () => {
  it("TS-8: примыкание к группе с занятым вторым концом — стена вне группы на месте", () => {
    const { g, V, H } = pt()
    const g2 = wall(400, 0, 600, 0, "g2")
    moveWalls([g, V, H, g2], [g, g2], { x: 0, y: -20 })
    expect(V.a).toEqual({ x: 100, y: -10 })
    expect(V.b).toEqual({ x: 100, y: 150 })
    expect(H.a).toEqual({ x: 90, y: 160 })
    expect(g2.a).toEqual({ x: 400, y: -20 })
  })

  it("TS-9: ножка между гранями двух стен группы смещается ровно на один вектор", () => {
    const g1 = wall(0, 0, 200, 0, "g1")
    const g2 = wall(0, 200, 200, 200, "g2")
    const V = wall(100, 10, 100, 190, "V")
    moveWalls([g1, g2, V], [g1, g2], D)
    expect(V.a).toEqual({ x: 107, y: 13 })
    expect(V.b).toEqual({ x: 107, y: 193 })
  })

  it("TS-10: один конец примкнут к грани g1, второй — угловой стык с концом g2 из группы — целиком", () => {
    const g1 = wall(0, 0, 200, 0, "g1")
    const g2 = wall(110, 160, 300, 160, "g2")
    const V = wall(100, 10, 100, 150, "V")
    moveWalls([g1, g2, V], [g1, g2], D)
    expect(V.a).toEqual({ x: 107, y: 13 })
    expect(V.b).toEqual({ x: 107, y: 153 })
  })
})

describe("moveWalls: порог углового стыка с запасом 1 см", () => {
  it("FM-2: конец на расстоянии диагональ + 0.99 следует, диагональ + 1.01 — нет", () => {
    const inside = DIAG20 + 0.99
    const g1 = wall(0, 0, 100, 0, "g1")
    const n1 = wall(100 + inside, 0, 100 + inside, 80, "n1")
    moveWalls([g1, n1], [g1], D)
    expect(n1.a).toEqual({ x: 100 + inside + 7, y: 3 })
    expect(n1.b).toEqual({ x: 100 + inside, y: 80 })
    const outside = DIAG20 + 1.01
    const g2 = wall(0, 0, 100, 0, "g2")
    const n2 = wall(100 + outside, 0, 100 + outside, 80, "n2")
    moveWalls([g2, n2], [g2], D)
    expect(n2.a).toEqual({ x: 100 + outside, y: 0 })
    expect(n2.b).toEqual({ x: 100 + outside, y: 80 })
  })

  it("FM-3: дрейф 0.18 см — угловой стык: следует только стыковой конец, второй остаётся в стыке", () => {
    const g = wall(0, 0, 300, 0, "g")
    const L = wall(10.18, 10, 10, 200, "L") // 14.27 от g.a > диагонали 14.14
    const B = wall(0, 210, 300, 210, "B") // L.b — угловой стык на верхней грани B у торца
    moveWalls([g, L, B], [g], { x: 10, y: 0 })
    expect(L.a.x).toBeCloseTo(20.18, 9)
    expect(L.a.y).toBe(10)
    expect(L.b).toEqual({ x: 10, y: 200 })
    expect(B.a).toEqual({ x: 0, y: 210 })
  })

  it("FM-3b: дрейф 0.18 см — протяжка десятью шагами совпадает с одним шагом", () => {
    const scene = (): Wall[] => [wall(0, 0, 300, 0, "g"), wall(10.18, 10, 10, 200, "L"), wall(0, 210, 300, 210, "B")]
    const one = scene()
    moveWalls(one, [one[0]], { x: 10, y: 0 })
    const many = scene()
    for (let i = 0; i < 10; i++) moveWalls(many, [many[0]], { x: 1, y: 0 })
    expect(one[1].a.x).toBeCloseTo(20.18, 9)
    expect(one[1].b).toEqual({ x: 10, y: 200 })
    for (let i = 0; i < 3; i++) {
      expect(many[i].a.x).toBeCloseTo(one[i].a.x, 9)
      expect(many[i].a.y).toBeCloseTo(one[i].a.y, 9)
      expect(many[i].b.x).toBeCloseTo(one[i].b.x, 9)
      expect(many[i].b.y).toBeCloseTo(one[i].b.y, 9)
    }
  })

  it("FM-4: конец на грани дальше диагонали + 1 см, второй свободен — T-примыкание, целиком", () => {
    const g = wall(0, 0, 200, 0, "g")
    const n = wall(11.6, 10, 11.6, 90, "n") // √(11.6² + 10²) ≈ 15.32 > 15.14
    moveWalls([g, n], [g], D)
    expect(n.a).toEqual({ x: 18.6, y: 13 })
    expect(n.b).toEqual({ x: 18.6, y: 93 })
  })

  it("FM-5: конец за торцом дальше диагонали + 1 см (не грань, не ось) — сосед не смещается", () => {
    const g = wall(0, 0, 200, 0, "g")
    const n = wall(-11.6, 10, -11.6, 90, "n")
    moveWalls([g, n], [g], D)
    expect(n.a).toEqual({ x: -11.6, y: 10 })
    expect(n.b).toEqual({ x: -11.6, y: 90 })
  })

  it("FM-6: группа — угловой стык на диагональ + 0.5 следует концом", () => {
    const x = Math.sqrt((DIAG20 + 0.5) ** 2 - 100)
    const g = wall(0, 0, 200, 0, "g")
    const g2 = wall(400, 0, 600, 0, "g2")
    const n = wall(x, 10, x, 90, "n")
    moveWalls([g, g2, n], [g, g2], D)
    expect(n.a).toEqual({ x: x + 7, y: 13 })
    expect(n.b).toEqual({ x, y: 90 })
  })

  it("FM-9: орто использует тот же порог — конец в 14.27 за торцом связан, в 15.3 нет", () => {
    const run = (d: number): Wall => {
      const g = wall(0, 0, 300, 0, "g")
      const n = wall(300 + d, 0, 300 + d, 200, "n")
      const v = { x: 0, y: -20 }
      applyStretch(planOrthoStretch([g, n], { kind: "walls", walls: [g] }, v), v)
      return n
    }
    const near = run(14.27)
    expect(near.a).toEqual({ x: 314.27, y: -20 })
    expect(near.b).toEqual({ x: 314.27, y: 200 })
    const far = run(15.3)
    expect(far.a).toEqual({ x: 315.3, y: 0 })
    expect(far.b).toEqual({ x: 315.3, y: 200 })
  })
})

describe("регрессия: чертёж пользователя, верхняя стена на 10 см вправо", () => {
  const MOVED = "b9433dfb"
  const v = { x: 10, y: 0 }

  it("REG-1: итоговые координаты по правилам спецификации", () => {
    const walls = userWalls()
    const before = userWalls()
    moveWalls(walls, [byId(walls, MOVED)], v)
    const expected: Record<string, { a: Point; b: Point }> = {
      b9433dfb: { a: { x: 580, y: 70 }, b: { x: 930, y: 70 } },
      "93ed4f96": { a: { x: 580, y: 300 }, b: { x: 590.18, y: 80 } },
      "20d54b0d": { a: { x: 845.49, y: 80 }, b: { x: 835.49, y: 240 } },
      "5912b043": { a: { x: 920, y: 80 }, b: { x: 910, y: 320 } },
      e7b0bec4: { a: { x: 930, y: 70 }, b: { x: 1140, y: 70 } },
    }
    for (const w of walls) {
      const exp = expected[w.id] ?? byId(before, w.id)
      expect(w.a.x, `${w.id}.a.x`).toBeCloseTo(exp.a.x, 9)
      expect(w.a.y, `${w.id}.a.y`).toBeCloseTo(exp.a.y, 9)
      expect(w.b.x, `${w.id}.b.x`).toBeCloseTo(exp.b.x, 9)
      expect(w.b.y, `${w.id}.b.y`).toBeCloseTo(exp.b.y, 9)
    }
  })

  it("REG-2: ни один стык и ни одно примыкание к сдвинутой целиком или неподвижной стене не рвётся", () => {
    const walls = userWalls()
    const before = userWalls()
    moveWalls(walls, [byId(walls, MOVED)], v)
    const ends = ["a", "b"] as const
    // стыки: пары концов в пределах порога до перемещения сохраняют взаимное смещение
    for (let i = 0; i < before.length; i++)
      for (let j = i + 1; j < before.length; j++)
        for (const e of ends)
          for (const f of ends) {
            const d0 = sub(before[i][e], before[j][f])
            if (len(d0) > TOL20) continue
            const d1 = sub(byId(walls, before[i].id)[e], byId(walls, before[j].id)[f])
            expect(d1.x, `${before[i].id}.${e}–${before[j].id}.${f}`).toBeCloseTo(d0.x, 9)
            expect(d1.y, `${before[i].id}.${e}–${before[j].id}.${f}`).toBeCloseTo(d0.y, 9)
          }
    // примыкания к стене, которая не повернулась: положение конца относительно её оси сохраняется
    const rigid = (w0: Wall, w1: Wall): boolean => {
      const da = sub(w1.a, w0.a)
      const db = sub(w1.b, w0.b)
      return Math.abs(da.x - db.x) < 1e-9 && Math.abs(da.y - db.y) < 1e-9
    }
    for (const t0 of before)
      for (const s0 of before) {
        if (t0 === s0) continue
        const s1 = byId(walls, s0.id)
        if (!rigid(s0, s1)) continue
        const u = unitOf(sub(s0.b, s0.a))
        const n = { x: -u.y, y: u.x }
        const L = len(sub(s0.b, s0.a))
        for (const e of ends) {
          const rel0 = sub(t0[e], s0.a)
          const along = dot(rel0, u)
          const lat = Math.abs(dot(rel0, n))
          const onAxisOrFace = Math.abs(lat) < 1e-6 || Math.abs(lat - s0.thicknessCm / 2) < 1e-6
          const nearEnd = [s0.a, s0.b].some((q) => len(sub(t0[e], q)) <= TOL20)
          if (!onAxisOrFace || along <= 0 || along >= L || nearEnd) continue
          const rel1 = sub(byId(walls, t0.id)[e], s1.a)
          expect(dot(rel1, u), `${t0.id}.${e} вдоль ${s0.id}`).toBeCloseTo(along, 9)
          expect(Math.abs(dot(rel1, n)), `${t0.id}.${e} поперёк ${s0.id}`).toBeCloseTo(lat, 9)
        }
      }
  })
})
