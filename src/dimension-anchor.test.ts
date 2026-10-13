import { describe, expect, it } from "vitest"
import { dimGeometry, dimHitDistance, dimPointPoint, nearestEdgeIntersection } from "./geometry"
import type { DimPoint, Dimension, WallElement } from "./types"
import {
  expectAt,
  jambDimension,
  jambPoint,
  lengthBetween,
  sceneF2,
  sceneFB,
  sceneFC,
  sceneFD,
  sceneR2,
  w,
  win,
  door,
} from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: позиция точки замера на откосе элемента стены
// (spec dimension-tool «Точки замера на откосах элементов стены», «Привязка размеров к стенам»; design D2, D3, D8).
// Ожидания — ручные эталоны сцен (test-plan.md «Сцены»); координаты откоса в размере не хранятся.

describe("позиция откоса", () => {
  it("DA-1: расстояние между окнами e1.b и e2.a — 80 по обеим граням", () => {
    const { walls, elements } = sceneF2()
    for (const face of [1, -1] as const) {
      const p = dimPointPoint(jambPoint("e1", "b", face), walls, elements)
      const q = dimPointPoint(jambPoint("e2", "a", face), walls, elements)
      expectAt(p, 220, face * 10)
      expectAt(q, 300, face * 10)
      if (p && q) expect(lengthBetween(p, q)).toBeCloseTo(80, 3)
    }
  })

  it("DA-1b: окна в разных стенах комнаты разрешаются каждое в своей стене", () => {
    const { walls, elements } = sceneR2()
    // W (0,0)→(500,0): нормаль (0,1); B (500,400)→(0,400): нормаль (0,−1), откос a при t = 100 стоит на x = 400
    expectAt(dimPointPoint(jambPoint("e1", "b", 1), walls, elements), 220, 10)
    expectAt(dimPointPoint(jambPoint("e3", "a", 1), walls, elements), 400, 390)
    expectAt(dimPointPoint(jambPoint("e3", "a", -1), walls, elements), 400, 410)
    expectAt(dimPointPoint(jambPoint("e3", "b", 1), walls, elements), 280, 390)
  })

  it("DA-2: четыре откосных угла каждого окна — обе грани, оба откоса", () => {
    const { walls, elements } = sceneF2()
    const expected: [string, "a" | "b", 1 | -1, number, number][] = [
      ["e1", "a", 1, 100, 10],
      ["e1", "a", -1, 100, -10],
      ["e1", "b", 1, 220, 10],
      ["e1", "b", -1, 220, -10],
      ["e2", "a", 1, 300, 10],
      ["e2", "a", -1, 300, -10],
      ["e2", "b", 1, 420, 10],
      ["e2", "b", -1, 420, -10],
    ]
    for (const [id, jamb, face, x, y] of expected) expectAt(dimPointPoint(jambPoint(id, jamb, face), walls, elements), x, y)
  })

  it("DA-2b: две грани одного откоса отстоят на толщину стены", () => {
    const { walls, elements } = sceneF2()
    const p = dimPointPoint(jambPoint("e1", "a", 1), walls, elements)
    const q = dimPointPoint(jambPoint("e1", "a", -1), walls, elements)
    expect(p && q ? lengthBetween(p, q) : NaN).toBeCloseTo(20, 3)
  })

  it("DA-2c: толщина стены 40 — откосные грани на y = ±20", () => {
    const W = w(0, 0, 500, 0, "W", 40)
    const e1 = win("W", "a", 100, 120, 150, 85, "e1")
    expectAt(dimPointPoint(jambPoint("e1", "b", 1), [W], [e1]), 220, 20)
    expectAt(dimPointPoint(jambPoint("e1", "b", -1), [W], [e1]), 220, -20)
  })

  it("DA-3: откос двери и угол стены в одном размере — длина 100", () => {
    const { walls, elements } = sceneFB()
    // дверь привязка b, 100, ширина 90: t 310…400; угол конца b на грани +1 — (500, 10)
    const corner = nearestEdgeIntersection({ x: 500, y: 10 }, walls, 2)
    expect(corner).not.toBeNull()
    if (!corner) return
    const cornerPoint: DimPoint = { a: corner.a, b: corner.b }
    const jamb = dimPointPoint(jambPoint("d1", "b", 1), walls, elements)
    const edge = dimPointPoint(cornerPoint, walls, elements)
    expectAt(jamb, 400, 10)
    expectAt(edge, 500, 10)
    expect(jamb && edge ? lengthBetween(jamb, edge) : NaN).toBeCloseTo(100, 3)
  })

  it("DA-3c: привязка b не меняет смысл откосов — a меньшая координата вдоль оси", () => {
    const { walls, elements } = sceneFB()
    expectAt(dimPointPoint(jambPoint("d1", "a", 1), walls, elements), 310, 10)
    expectAt(dimPointPoint(jambPoint("d1", "b", -1), walls, elements), 400, -10)
  })
})

describe("следование за элементом", () => {
  const at = (elements: WallElement[], jamb: "a" | "b", face: 1 | -1, walls = sceneF2().walls): ReturnType<typeof dimPointPoint> =>
    dimPointPoint(jambPoint("e1", jamb, face), walls, elements)

  it("DA-9: сдвиг окна вдоль стены сдвигает откосы", () => {
    const { elements } = sceneF2()
    const moved = [win("W", "a", 130, 120, 150, 85, "e1"), elements[1]]
    expectAt(at(moved, "a", 1), 130, 10)
    expectAt(at(moved, "b", 1), 250, 10)
  })

  it("DA-10: изменение ширины двигает только откос b", () => {
    const { elements } = sceneF2()
    const wider = [win("W", "a", 100, 200, 150, 85, "e1"), elements[1]]
    expectAt(at(wider, "a", 1), 100, 10)
    expectAt(at(wider, "b", 1), 300, 10)
  })

  it("DA-10b: ширина 1 см — откосы различимы, a левее b на 1 см", () => {
    const { elements } = sceneF2()
    const thin = [win("W", "a", 100, 1, 150, 85, "e1"), elements[1]]
    const a = at(thin, "a", 1)
    const b = at(thin, "b", 1)
    expectAt(a, 100, 10)
    expectAt(b, 101, 10)
  })

  it("DA-11: смена привязки при той же геометрии — откос a остаётся откосом a", () => {
    const { elements } = sceneF2()
    // длина 500: привязка b, 280, ширина 120 → t 100…220, как привязка a, 100
    const flipped = [win("W", "b", 280, 120, 150, 85, "e1"), elements[1]]
    expectAt(at(flipped, "a", 1), 100, 10)
    expectAt(at(flipped, "b", 1), 220, 10)
    expectAt(at(flipped, "a", -1), 100, -10)
  })

  it("DA-11b: инвариант — откос a левее откоса b для обеих привязок и граней", () => {
    const { walls } = sceneF2()
    for (const anchor of ["a", "b"] as const)
      for (const face of [1, -1] as const) {
        const e = [win("W", anchor, 60, 90, 150, 85, "e1")]
        const pa = dimPointPoint(jambPoint("e1", "a", face), walls, e)
        const pb = dimPointPoint(jambPoint("e1", "b", face), walls, e)
        expect(pa && pb ? pb.x - pa.x : NaN).toBeCloseTo(90, 3)
      }
  })
})

describe("следование за опорной стеной", () => {
  it("DA-12: перенос стены сдвигает откосы вместе с ней", () => {
    const { elements } = sceneF2()
    const moved = [w(50, 30, 550, 30, "W")]
    expectAt(dimPointPoint(jambPoint("e1", "b", 1), moved, elements), 270, 40)
    expectAt(dimPointPoint(jambPoint("e2", "a", -1), moved, elements), 350, 20)
  })

  it("DA-13: удлинение конца b — окна с привязкой a на месте, с привязкой b уезжают", () => {
    const { elements } = sceneF2()
    const byB = win("W", "b", 100, 120, 150, 85, "e3")
    const longer = [w(0, 0, 700, 0, "W")]
    expectAt(dimPointPoint(jambPoint("e1", "b", 1), longer, elements), 220, 10)
    expectAt(dimPointPoint(jambPoint("e3", "a", 1), longer, [...elements, byB]), 480, 10)
    expectAt(dimPointPoint(jambPoint("e3", "b", 1), longer, [...elements, byB]), 600, 10)
  })

  it("DA-15: удлинение конца a — окно с привязкой b остаётся на месте, с привязкой a уезжает", () => {
    const byA = win("W", "a", 100, 120, 150, 85, "e1")
    const byB = win("W", "b", 100, 120, 150, 85, "e3")
    const longer = [w(-200, 0, 500, 0, "W")]
    expectAt(dimPointPoint(jambPoint("e1", "a", 1), longer, [byA, byB]), -100, 10)
    expectAt(dimPointPoint(jambPoint("e3", "a", 1), longer, [byA, byB]), 280, 10)
  })

  it("DA-14: диагональная стена — эталоны точек с нормалью (−0.8, 0.6)", () => {
    const { walls, elements } = sceneFD()
    expectAt(dimPointPoint(jambPoint("p1", "a", 1), walls, elements), 52, 86)
    expectAt(dimPointPoint(jambPoint("p1", "b", 1), walls, elements), 106, 158)
    expectAt(dimPointPoint(jambPoint("p1", "a", -1), walls, elements), 68, 74)
    expectAt(dimPointPoint(jambPoint("p1", "b", -1), walls, elements), 122, 146)
    const a = dimPointPoint(jambPoint("p1", "a", 1), walls, elements)
    const b = dimPointPoint(jambPoint("p1", "b", 1), walls, elements)
    expect(a && b ? lengthBetween(a, b) : NaN).toBeCloseTo(90, 3)
  })

  it("DA-14b: поворот диагональной стены — точки остаются на откосах новой оси", () => {
    const { elements } = sceneFD()
    // (0,0)-(400,300): d = (0.8, 0.6), нормаль (−0.6, 0.8)
    const rotated = [w(0, 0, 400, 300, "W")]
    expectAt(dimPointPoint(jambPoint("p1", "a", 1), rotated, elements), 74, 68)
    expectAt(dimPointPoint(jambPoint("p1", "b", 1), rotated, elements), 146, 122)
  })

  it("DA-16: составная стена — расстояние между окнами двух участков 150 вдоль грани", () => {
    const { walls, elements } = sceneFC()
    const p = dimPointPoint(jambPoint("e1", "b", 1), walls, elements)
    const q = dimPointPoint(jambPoint("e2", "a", 1), walls, elements)
    expectAt(p, 200, 10)
    expectAt(q, 350, 10)
    expect(p && q ? lengthBetween(p, q) : NaN).toBeCloseTo(150, 3)
  })

  it("DA-16b: удлинение первого участка сдвигает окно первого участка, окно второго остаётся", () => {
    const { elements } = sceneFC()
    const walls = [w(-100, 0, 300, 0, "W1"), w(300, 0, 600, 0, "W2")]
    const p = dimPointPoint(jambPoint("e1", "b", 1), walls, elements)
    const q = dimPointPoint(jambPoint("e2", "a", 1), walls, elements)
    expectAt(p, 100, 10)
    expectAt(q, 350, 10)
    expect(p && q ? lengthBetween(p, q) : NaN).toBeCloseTo(250, 3)
  })
})

describe("пограничные и негативные случаи позиции", () => {
  it("DA-21: две точки на одном откосе совпадают — размер нулевой длины, геометрии нет", () => {
    const { walls, elements } = sceneF2()
    const p = dimPointPoint(jambPoint("e1", "a", 1), walls, elements)
    const q = dimPointPoint(jambPoint("e1", "a", 1), walls, elements)
    expect(p).not.toBeNull()
    expect(q).not.toBeNull()
    if (p && q) expect(dimGeometry(p, q, 0)).toBeNull()
  })

  it("DA-22: без списка элементов и с ним граневая точка разрешается как прежде", () => {
    const { walls, elements } = sceneR2()
    const hit = nearestEdgeIntersection({ x: 10, y: 10 }, walls, 2)
    expect(hit).not.toBeNull()
    if (!hit) return
    const point: DimPoint = { a: hit.a, b: hit.b }
    expectAt(dimPointPoint(point, walls), 10, 10)
    expectAt(dimPointPoint(point, walls, []), 10, 10)
    expectAt(dimPointPoint(point, walls, elements), 10, 10)
  })

  it("DA-32: ссылка на отсутствующий элемент — точка не разрешается", () => {
    const { walls, elements } = sceneF2()
    expect(dimPointPoint(jambPoint("nope", "a", 1), walls, elements)).toBeNull()
  })

  it("DA-32b: пустой список элементов — точка-откос не разрешается, граневые точки живы", () => {
    const { walls } = sceneF2()
    expect(dimPointPoint(jambPoint("e1", "a", 1), walls, [])).toBeNull()
    expect(dimPointPoint(jambPoint("e1", "a", 1), walls)).toBeNull()
  })

  it("DA-37b: элемент есть, опорной стены нет — точка не разрешается", () => {
    const { elements } = sceneF2()
    expect(dimPointPoint(jambPoint("e1", "a", 1), [w(0, 100, 500, 100, "other")], elements)).toBeNull()
  })

  it("DA-39: вырожденная опорная стена — точка не разрешается, без NaN", () => {
    const degenerate = [w(0, 0, 0, 0, "W")]
    const e = [door("W", "a", 0, 90, 210, "e1")]
    expect(dimPointPoint(jambPoint("e1", "a", 1), degenerate, e)).toBeNull()
  })
})

describe("попадание в размер с откосами", () => {
  const dim = (): Dimension => jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", 1), 30)

  it("DA-38: курсор на размерной линии — расстояние ≈ 0 при переданных элементах", () => {
    const { walls, elements } = sceneF2()
    // размерная линия на y = 10 + 30 = 40 между x = 220 и x = 300
    const d = dimHitDistance({ x: 260, y: 40 }, dim(), walls, 1, elements)
    expect(d).not.toBeNull()
    expect(d ?? Infinity).toBeLessThan(0.5)
  })

  it("DA-38b: курсор в 10 см от линии — расстояние ≈ 10", () => {
    const { walls, elements } = sceneF2()
    const d = dimHitDistance({ x: 260, y: 50 }, dim(), walls, 1, elements)
    expect(d ?? NaN).toBeCloseTo(10, 1)
  })

  it("DA-38c: элементы не переданы — размер с откосом не находится (null)", () => {
    const { walls } = sceneF2()
    expect(dimHitDistance({ x: 260, y: 40 }, dim(), walls, 1)).toBeNull()
  })
})
