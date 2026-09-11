import { describe, expect, it } from "vitest"
import { dimensionOffsetAt, dimGeometry, dimHitDistance, dimLevelSnap, dimPointPoint, endpointAt, handleAt, healJoints, hitWall, jointPullback, jointedWalls, moveEndpoint, moveWall, nearestEdgeIntersection, pointOn, pointsEqual, sameTypeJoint, snap, visibleWorld, wallShape, zoomAt } from "./geometry"
import type { Dimension, Point, Wall } from "./types"

const GRID = 10
const RADIUS = 6

const wall = (ax: number, ay: number, bx: number, by: number, id = "w"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

describe("snap", () => {
  it("привязывается к концу стены в пределах радиуса", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: -4, y: 3 }, walls, GRID, RADIUS)).toEqual({ x: 0, y: 0 })
  })

  it("T-образный стык: привязывается к линии стены", () => {
    const walls = [wall(0, 0, 100, 0)]
    const p = snap({ x: 55, y: 5 }, walls, GRID, RADIUS)
    expect(p.x).toBeCloseTo(55)
    expect(p.y).toBeCloseTo(0)
  })

  it("стена имеет приоритет над узлом сетки", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: 9, y: 3 }, walls, GRID, RADIUS)).toEqual({ x: 9, y: 0 })
  })

  it("за пределами радиуса стены привязывается к узлу сетки", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: 55, y: 7 }, walls, GRID, RADIUS)).toEqual({ x: 60, y: 10 })
  })

  it("без стен рядом привязывается к ближайшему узлу сетки", () => {
    expect(snap({ x: 53, y: 57 }, [wall(0, 200, 100, 200)], GRID, RADIUS)).toEqual({ x: 50, y: 60 })
  })

  it("выбирает ближайшего кандидата среди стен", () => {
    const walls = [wall(0, 0, 100, 0), wall(0, 0, 0, 100)]
    expect(snap({ x: 2, y: 4 }, walls, GRID, RADIUS)).toEqual({ x: 0, y: 4 })
  })
})

describe("snap с орто-привязкой 90°", () => {
  const from: Point = { x: 0, y: 50 }

  it("почти горизонтальное направление притягивается к горизонтали", () => {
    expect(snap({ x: 50.4, y: 51 }, [], GRID, RADIUS, from)).toEqual({ x: 50, y: 50 })
  })

  it("почти вертикальное направление притягивается к вертикали", () => {
    expect(snap({ x: 1, y: 41 }, [], GRID, RADIUS, from)).toEqual({ x: 0, y: 40 })
  })

  it("диагональ не притягивается", () => {
    expect(snap({ x: 33, y: 81 }, [], GRID, RADIUS, from)).toEqual({ x: 30, y: 80 })
  })

  it("привязка к стенам имеет приоритет над орто", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: 45, y: 1 }, walls, GRID, RADIUS, from)).toEqual({ x: 45, y: 0 })
  })

  it("без орто-точки привязка к сетке как раньше", () => {
    expect(snap({ x: 45.4, y: 46 }, [], GRID, RADIUS)).toEqual({ x: 50, y: 50 })
  })
})

describe("snap к продолжению линии за концом стены", () => {
  it("тянет к продолжению линии за концом, если конец вне радиуса", () => {
    expect(snap({ x: 356, y: 98 }, [wall(100, 100, 300, 100)], GRID, RADIUS)).toEqual({ x: 356, y: 100 })
  })

  it("конец стены в радиусе приоритетнее продолжения линии", () => {
    expect(snap({ x: 103, y: 3 }, [wall(0, 0, 100, 0)], GRID, RADIUS)).toEqual({ x: 100, y: 0 })
  })
})

describe("zoomAt", () => {
  it("сохраняет мировую точку под курсором", () => {
    const view = { zoom: 1, pan: { x: 100, y: 50 } }
    const anchor = { x: 80, y: 60 }
    const next = zoomAt(view, 1.1, anchor, 2)
    expect(next.pan.x + anchor.x / (2 * next.zoom)).toBeCloseTo(view.pan.x + anchor.x / 2)
    expect(next.pan.y + anchor.y / (2 * next.zoom)).toBeCloseTo(view.pan.y + anchor.y / 2)
  })

  it("ограничивает масштаб сверху", () => {
    expect(zoomAt({ zoom: 10, pan: { x: 0, y: 0 } }, 1.1, { x: 40, y: 40 }, 2).zoom).toBe(10)
  })

  it("ограничивает масштаб снизу", () => {
    expect(zoomAt({ zoom: 0.1, pan: { x: 0, y: 0 } }, 0.9, { x: 40, y: 40 }, 2).zoom).toBe(0.1)
  })
})

describe("visibleWorld", () => {
  it("возвращает видимый мировой прямоугольник", () => {
    expect(visibleWorld({ zoom: 2, pan: { x: 100, y: 50 } }, 800, 600, 2)).toEqual({
      min: { x: 100, y: 50 },
      max: { x: 300, y: 200 },
    })
  })
})

describe("pointsEqual", () => {
  it("фильтрует совпадающие точки и пропускает различные", () => {
    const p: Point = { x: 5, y: 5 }
    expect(pointsEqual(p, { x: 5, y: 5 })).toBe(true)
    expect(pointsEqual(p, { x: 5.1, y: 5 })).toBe(false)
  })
})

describe("hitWall", () => {
  it("попадает в тонкую стену только в пределах допуска", () => {
    const w = wall(0, 0, 100, 0)
    expect(hitWall({ x: 50, y: 9 }, [w], 10)).toBe(w)
    expect(hitWall({ x: 50, y: 11 }, [w], 10)).toBeNull()
  })

  it("попадает в толстую стену по полосе даже вне допуска", () => {
    const w = wall(0, 0, 100, 0)
    w.thicknessCm = 40
    expect(hitWall({ x: 50, y: 19 }, [w], 5)).toBe(w)
    expect(hitWall({ x: 50, y: 21 }, [w], 5)).toBeNull()
  })

  it("выбирает ближайшую из перекрывающихся стен", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(50, 0, 50, 100)
    expect(hitWall({ x: 40, y: 6 }, [w1, w2], 10)).toBe(w1)
    expect(hitWall({ x: 40, y: 14 }, [w1, w2], 10)).toBe(w2)
  })
})

describe("endpointAt", () => {
  it("попадает в концы стены", () => {
    const w = wall(0, 0, 100, 0)
    expect(endpointAt({ x: 3, y: 4 }, w, 6)).toBe("a")
    expect(endpointAt({ x: 97, y: -4 }, w, 6)).toBe("b")
  })

  it("не попадает в середину стены", () => {
    expect(endpointAt({ x: 50, y: 0 }, wall(0, 0, 100, 0), 6)).toBeNull()
  })
})

describe("handleAt", () => {
  it("попадает в середину стены", () => {
    expect(handleAt({ x: 52, y: 3 }, wall(0, 0, 100, 0), 6)).toBe("mid")
  })

  it("конец имеет приоритет над серединой на короткой стене", () => {
    expect(handleAt({ x: 6, y: 0 }, wall(0, 0, 10, 0), 6)).toBe("a")
  })

  it("не попадает вне радиуса", () => {
    expect(handleAt({ x: 50, y: 8 }, wall(0, 0, 100, 0), 6)).toBeNull()
  })
})

describe("moveEndpoint", () => {
  it("перемещает конец стены", () => {
    const w = wall(0, 0, 100, 0)
    moveEndpoint([w], w, "b", { x: 150, y: 0 })
    expect(w.b).toEqual({ x: 150, y: 0 })
    expect(w.a).toEqual({ x: 0, y: 0 })
  })

  it("тянет совпавшие концы соседних стен", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(100, 0, 100, 100)
    const w3 = wall(200, 0, 200, 100)
    moveEndpoint([w1, w2, w3], w1, "b", { x: 120, y: 0 })
    expect(w2.a).toEqual({ x: 120, y: 0 })
    expect(w3.a).toEqual({ x: 200, y: 0 })
  })

  it("приваривает конец соседа в допуске вершины стыка", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(90, 0, 90, 80)
    moveEndpoint([w1, w2], w1, "b", { x: 120, y: 0 })
    expect(w1.b).toEqual({ x: 120, y: 0 })
    expect(w2.a).toEqual({ x: 120, y: 0 })
    expect(w2.b).toEqual({ x: 90, y: 80 })
  })

  it("приваривает обе стены одной вершины", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(90, 0, 90, 80)
    const w3 = wall(110, 0, 110, 80)
    moveEndpoint([w1, w2, w3], w1, "b", { x: 120, y: 0 })
    expect(w2.a).toEqual({ x: 120, y: 0 })
    expect(w3.a).toEqual({ x: 120, y: 0 })
  })

  it("тянет конец примыкающей — сквозная приваривается к новой позиции", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(100, 0, 100, 80)
    moveEndpoint([w1, w2], w2, "a", { x: 110, y: 0 })
    expect(w2.a).toEqual({ x: 110, y: 0 })
    expect(w1.b).toEqual({ x: 110, y: 0 })
  })
})

describe("moveWall", () => {
  it("смещает оба конца на вектор", () => {
    const w = wall(0, 0, 100, 0)
    moveWall([w], w, { x: 10, y: 20 })
    expect(w.a).toEqual({ x: 10, y: 20 })
    expect(w.b).toEqual({ x: 110, y: 20 })
  })

  it("тянет приваренные концы соседних стен", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(100, 0, 100, 100)
    const w3 = wall(200, 0, 200, 100)
    moveWall([w1, w2, w3], w1, { x: 10, y: 0 })
    expect(w2.a).toEqual({ x: 110, y: 0 })
    expect(w2.b).toEqual({ x: 100, y: 100 })
    expect(w3.a).toEqual({ x: 200, y: 0 })
  })

  it("не изменяет несвязанные стены", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(200, 0, 200, 100)
    moveWall([w1, w2], w1, { x: 10, y: 0 })
    expect(w2.a).toEqual({ x: 200, y: 0 })
    expect(w2.b).toEqual({ x: 200, y: 100 })
  })

  it("приваривает соседа в допуске вершины стыка", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(90, 0, 90, 80)
    moveWall([w1, w2], w1, { x: 10, y: 0 })
    expect(w2.a).toEqual({ x: 110, y: 0 })
    expect(w2.b).toEqual({ x: 90, y: 80 })
  })

  it("T-примыкание следует целиком", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(50, 0, 50, 60)
    moveWall([w1, w2], w1, { x: 10, y: 0 })
    expect(w2.a).toEqual({ x: 60, y: 0 })
    expect(w2.b).toEqual({ x: 60, y: 60 })
  })
})

describe("jointedWalls", () => {
  it("точное совпадение и допуск — да, разрыв — нет", () => {
    expect(jointedWalls(wall(0, 0, 100, 0), wall(100, 0, 100, 80))).toBe(true)
    expect(jointedWalls(wall(0, 0, 100, 0), wall(90, 0, 90, 80))).toBe(true)
    expect(jointedWalls(wall(0, 0, 100, 0), wall(130, 0, 130, 80))).toBe(false)
  })
})

describe("healJoints", () => {
  it("сваривает концы в пределах полутора допусков", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(111, 0, 111, 80)
    expect(healJoints([w1, w2])).toBe(true)
    expect(w2.a).toEqual({ x: 100, y: 0 })
  })

  it("совпавшие и далёкие концы не трогает", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(100, 0, 100, 80)
    const w3 = wall(200, 0, 200, 80)
    expect(healJoints([w1, w2, w3])).toBe(false)
    expect(w2.a).toEqual({ x: 100, y: 0 })
    expect(w3.a).toEqual({ x: 200, y: 0 })
  })

  it("тянет цепочку транзитивно", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(105, 0, 200, 0)
    const w3 = wall(205, 0, 300, 0)
    healJoints([w1, w2, w3])
    expect(w2.a).toEqual({ x: 100, y: 0 })
    expect(w3.a).toEqual({ x: 200, y: 0 })
  })
})

describe("sameTypeJoint", () => {
  it("одинаковые стены под 90°: торцы рисуются — ребро внешней границы", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    expect(sameTypeJoint(a, a.b, [a, b])).toBe(false)
    expect(sameTypeJoint(b, b.a, [a, b])).toBe(false)
  })

  it("разный материал — стык рисуется", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    b.type = "concrete"
    expect(sameTypeJoint(a, a.b, [a, b])).toBe(false)
  })

  it("разная толщина — стык рисуется", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    b.thicknessCm = 40
    expect(sameTypeJoint(a, a.b, [a, b])).toBe(false)
  })

  it("Т-стык одного типа слияется, у сквозной соседа на конце нет", () => {
    const through = wall(0, 0, 100, 0)
    const incoming = wall(50, 0, 50, -40)
    expect(sameTypeJoint(incoming, incoming.a, [through, incoming])).toBe(true)
    expect(sameTypeJoint(through, through.a, [through, incoming])).toBe(false)
    expect(sameTypeJoint(through, through.b, [through, incoming])).toBe(false)
  })

  it("острый угол 20°: торцы рисуются даже у одного типа", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(0, 0, 100 * Math.cos((20 * Math.PI) / 180), 100 * Math.sin((20 * Math.PI) / 180))
    expect(sameTypeJoint(a, a.a, [a, b])).toBe(false)
    expect(sameTypeJoint(b, b.a, [a, b])).toBe(false)
  })

  it("коллинеарные одного типа сливаются", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 60, 0)
    expect(sameTypeJoint(a, a.b, [a, b])).toBe(true)
  })

  it("три стены в одной вершине — без слияния", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    const c = wall(100, 0, 170.71, 70.71)
    expect(sameTypeJoint(a, a.b, [a, b, c])).toBe(false)
  })

  it("свободный конец — без слияния", () => {
    const a = wall(0, 0, 100, 0)
    expect(sameTypeJoint(a, a.a, [a])).toBe(false)
    expect(sameTypeJoint(a, a.b, [a])).toBe(false)
  })
})

describe("pointOn", () => {
  it("pointOn интерполирует точку вдоль оси", () => {
    const w = wall(0, 0, 100, 40)
    expect(pointOn(w, 0)).toEqual({ x: 0, y: 0 })
    expect(pointOn(w, 0.5)).toEqual({ x: 50, y: 20 })
    expect(pointOn(w, 1)).toEqual({ x: 100, y: 40 })
  })
})

describe("jointPullback", () => {
  it("утапливает начало новой стены в тело сквозной на полтолщины", () => {
    const through = wall(0, 0, 0, 100)
    expect(jointPullback({ x: 0, y: 100 }, [through], 10, { x: 1, y: 0 })).toEqual({ x: 0, y: 90 })
  })

  it("коллинеарное продолжение — без утапливания", () => {
    const through = wall(0, 0, 100, 0)
    expect(jointPullback({ x: 100, y: 0 }, [through], 10, { x: 1, y: 0 })).toEqual({ x: 100, y: 0 })
  })

  it("свободная точка — без изменений", () => {
    expect(jointPullback({ x: 50, y: 50 }, [wall(0, 0, 100, 0)], 10, { x: 1, y: 0 })).toEqual({ x: 50, y: 50 })
  })
})

describe("dimGeometry", () => {
  it("линия смещения перпендикулярна оси, offset со знаком", () => {
    const g = dimGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 30)
    expect(g?.nx).toBeCloseTo(0)
    expect(g?.ny).toBeCloseTo(1)
    expect(g?.p1).toEqual({ x: 0, y: 30 })
    expect(g?.p2).toEqual({ x: 100, y: 30 })
    expect(dimGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, -30)?.p1).toEqual({ x: 0, y: -30 })
  })

  it("наклонная ось: единичная нормаль", () => {
    const g = dimGeometry({ x: 0, y: 0 }, { x: 30, y: 40 }, 0)
    expect(g?.nx).toBeCloseTo(-0.8)
    expect(g?.ny).toBeCloseTo(0.6)
  })

  it("вырожденный отрезок даёт null", () => {
    expect(dimGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toBeNull()
  })
})

describe("dimPointPoint", () => {
  it("пересечение граней двух стен — угол чертежа", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(100, 0, 100, 80, "w2")
    expect(dimPointPoint({ a: { wallId: "w1", edge: 0 }, b: { wallId: "w2", edge: 0 } }, [a, b])).toEqual({ x: 90, y: 10 })
  })

  it("угол одной стены — вершина её контура", () => {
    expect(dimPointPoint({ a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } }, [wall(0, 0, 100, 0, "w1")])).toEqual({ x: 0, y: 10 })
  })

  it("митра: точка на срезе, а не в сыром углу", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(100, 0, 100 + 100 * Math.SQRT1_2, 100 * Math.SQRT1_2, "w2")
    const p = dimPointPoint({ a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } }, [a, b])!
    expect(p.x).toBeCloseTo(95.8579, 3)
    expect(p.y).toBeCloseTo(10, 6)
  })

  it("T-примыкание: торец подрезан по грани сквозной", () => {
    const u = wall(0, 0, 100, 0, "u")
    const v = wall(50, 0, 50, 60, "v")
    expect(dimPointPoint({ a: { wallId: "v", edge: 2 }, b: { wallId: "v", edge: 0 } }, [u, v])).toEqual({ x: 40, y: 10 })
    expect(dimPointPoint({ a: { wallId: "v", edge: 2 }, b: { wallId: "u", edge: 0 } }, [u, v])).toEqual({ x: 60, y: 10 })
  })

  it("три стены в одной вершине — плоские торцы, угол своей стены", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(0, 0, 0, 80, "w2")
    const c = wall(0, 0, -80, 0, "w3")
    expect(dimPointPoint({ a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } }, [a, b, c])).toEqual({ x: 0, y: 10 })
  })

  it("разошедшийся стык — прилипание к ближней вершине", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(150, 0, 150, 80, "w2")
    expect(dimPointPoint({ a: { wallId: "w1", edge: 3 }, b: { wallId: "w2", edge: 0 } }, [a, b])).toEqual({ x: 100, y: 10 })
  })

  it("параллельные грани — прилипание к вершине, битая ссылка — null", () => {
    const a = wall(0, 0, 100, 0, "w1")
    expect(dimPointPoint({ a: { wallId: "w1", edge: 0 }, b: { wallId: "w1", edge: 1 } }, [a])).toEqual({ x: 0, y: 10 })
    expect(dimPointPoint({ a: { wallId: "нет", edge: 0 }, b: { wallId: "w1", edge: 0 } }, [a])).toBeNull()
  })

  it("поворот стены: свой угол следует жёстко, чужая грань не тянет точку", () => {
    const a = wall(0, 0, 100 * Math.cos(Math.PI / 6), 100 * Math.sin(Math.PI / 6), "w1")
    const b = wall(100, 0, 100, 80, "w2")
    const own = dimPointPoint({ a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } }, [a, b])!
    expect(own.x).toBeCloseTo(-5, 6)
    expect(own.y).toBeCloseTo(8.6603, 4)
    const cross = dimPointPoint({ a: { wallId: "w1", edge: 0 }, b: { wallId: "w2", edge: 0 } }, [a, b])!
    expect(cross.x).toBeCloseTo(81.6025, 3)
    expect(cross.y).toBeCloseTo(58.6603, 3)
  })
})

describe("nearestEdgeIntersection", () => {
  it("находит вершину стыка, привязка к своей стене", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(100, 0, 100, 80, "w2")
    const hit = nearestEdgeIntersection({ x: 92, y: 8 }, [a, b], 6)
    expect(hit?.point).toEqual({ x: 90, y: 10 })
    expect(hit?.a).toEqual({ wallId: "w2", edge: 0 })
    expect(hit?.b).toEqual({ wallId: "w2", edge: 2 })
  })

  it("угол свободного конца — пара своей стены", () => {
    const hit = nearestEdgeIntersection({ x: 3, y: 8 }, [wall(0, 0, 100, 0, "w1")], 6)
    expect(hit?.point).toEqual({ x: 0, y: 10 })
    expect(hit?.a).toEqual({ wallId: "w1", edge: 0 })
    expect(hit?.b).toEqual({ wallId: "w1", edge: 2 })
  })

  it("пересечение продолжений за торцом не находится", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(100, 0, 100, 80, "w2")
    expect(nearestEdgeIntersection({ x: 105, y: 0 }, [a, b], 6)).toBeNull()
  })

  it("вне радиуса — null", () => {
    expect(nearestEdgeIntersection({ x: 50, y: 0 }, [wall(0, 0, 100, 0)], 6)).toBeNull()
  })
})

describe("dimLevelSnap", () => {
  const walls2 = [wall(0, 0, 100, 0, "w1"), wall(100, 0, 100, 80, "w2")]
  const axis0 = dimGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)!
  const dim = (offset: number): Dimension => ({
    from: { a: { wallId: "w1", edge: 0 }, b: { wallId: "w2", edge: 0 } },
    to: { a: { wallId: "w1", edge: 0 }, b: { wallId: "w2", edge: 1 } },
    offset,
  })

  it("параллельный сосед в радиусе — снап на его уровень", () => {
    expect(dimLevelSnap({ x: 50, y: 37 }, axis0, [dim(30)], walls2, 6)).toEqual({ offset: 40, point: { x: 50, y: 40 } })
  })

  it("вне радиуса от всех уровней — null", () => {
    expect(dimLevelSnap({ x: 50, y: 50 }, axis0, [dim(30), dim(60)], walls2, 6)).toBeNull()
  })

  it("антипараллельная ось соседа — тот же уровень", () => {
    const flipped: Dimension = { from: dim(30).to, to: dim(30).from, offset: -30 }
    expect(dimLevelSnap({ x: 50, y: 37 }, axis0, [flipped], walls2, 6)).toEqual({ offset: 40, point: { x: 50, y: 40 } })
  })

  it("непараллельная ось соседа не участвует", () => {
    const vertical: Dimension = {
      from: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w2", edge: 2 } },
      to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w2", edge: 3 } },
      offset: 0,
    }
    expect(dimLevelSnap({ x: 97, y: 37 }, axis0, [vertical], walls2, 6)).toBeNull()
  })

  it("два соседа — берётся ближайший уровень", () => {
    expect(dimLevelSnap({ x: 50, y: 43 }, axis0, [dim(30), dim(38)], walls2, 6)).toEqual({ offset: 40, point: { x: 50, y: 40 } })
    expect(dimLevelSnap({ x: 50, y: 45 }, axis0, [dim(30), dim(38)], walls2, 6)).toEqual({ offset: 48, point: { x: 50, y: 48 } })
  })

  it("сосед с битой ссылкой пропускается", () => {
    const broken: Dimension = {
      from: { a: { wallId: "нет", edge: 0 }, b: { wallId: "w2", edge: 0 } },
      to: { a: { wallId: "нет", edge: 0 }, b: { wallId: "w2", edge: 3 } },
      offset: 30,
    }
    expect(dimLevelSnap({ x: 50, y: 37 }, axis0, [broken], walls2, 6)).toBeNull()
  })
})

describe("dimensionOffsetAt/dimHitDistance", () => {
  it("offset — проекция курсора на нормаль оси", () => {
    const g = dimGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)!
    expect(dimensionOffsetAt({ x: 40, y: 25 }, g)).toBeCloseTo(25)
    expect(dimensionOffsetAt({ x: 40, y: -8 }, g)).toBeCloseTo(-8)
  })

  it("dimHitDistance — расстояние до линии, у текста в середине удвоенный радиус", () => {
    const w1 = wall(0, 0, 100, 0, "w1")
    const dim: Dimension = {
      from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
      to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
      offset: 20,
    }
    expect(dimHitDistance({ x: 50, y: 35 }, dim, [w1], 2)).toBeCloseTo(2.5)
    expect(dimHitDistance({ x: 50, y: 41 }, dim, [w1], 2)).toBeCloseTo(5.5)
    expect(dimHitDistance({ x: 50, y: 80 }, dim, [w1], 2)).toBeCloseTo(25)
  })
})

describe("wallShape", () => {
  const wallT = (ax: number, ay: number, bx: number, by: number, t: number): Wall => ({
    id: "wt",
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    thicknessCm: t,
    type: "brick",
  })

  it("одиночная стена — прежний прямоугольник", () => {
    expect(wallShape(wall(0, 0, 100, 0), [wall(0, 0, 100, 0)])).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ])
  })

  it("угол 90°: сквозная ровно как нарисована, примыкающая подрезана по грани", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    expect(wallShape(a, [a, b])).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ])
    expect(wallShape(b, [a, b])).toEqual([
      { x: 90, y: 10 },
      { x: 90, y: 80 },
      { x: 110, y: 80 },
      { x: 110, y: 10 },
    ])
  })

  it("поворот цепочки на 45°: срез по пересечениям граней", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100 + 70.7107, 70.7107)
    const shapeA = wallShape(a, [a, b])
    expect(shapeA[1].x).toBeCloseTo(95.858, 2)
    expect(shapeA[1].y).toBeCloseTo(10)
    expect(shapeA[2].x).toBeCloseTo(104.142, 2)
    expect(shapeA[2].y).toBeCloseTo(-10)
  })

  it("разная толщина: примыкание прямой линией, сквозная без заполнения угла", () => {
    const a = wallT(0, 0, 100, 0, 20)
    const b = wallT(100, 0, 100, 80, 40)
    expect(wallShape(a, [a, b])).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ])
    expect(wallShape(b, [a, b])).toEqual([
      { x: 80, y: 10 },
      { x: 80, y: 80 },
      { x: 120, y: 80 },
      { x: 120, y: 10 },
    ])
  })

  it("острый угол 20°: примыкание впритык, обе стены прямоугольные", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(0, 0, 100 * Math.cos((20 * Math.PI) / 180), 100 * Math.sin((20 * Math.PI) / 180))
    expect(wallShape(a, [a, b])).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ])
    const shapeB = wallShape(b, [a, b])
    expect(shapeB[0].x).toBeCloseTo(-1.763, 2)
    expect(shapeB[0].y).toBeCloseTo(10)
    expect(shapeB[3].x).toBeCloseTo(56.713, 2)
    expect(shapeB[3].y).toBeCloseTo(10)
  })

  it("излом 150°: митра с коротким срезом", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100 + 100 * Math.cos(Math.PI / 6), 100 * Math.sin(Math.PI / 6))
    const shapeA = wallShape(a, [a, b])
    expect(shapeA[1].x).toBeCloseTo(97.32, 2)
    expect(shapeA[1].y).toBeCloseTo(10)
    expect(shapeA[2].x).toBeCloseTo(102.68, 2)
    expect(shapeA[2].y).toBeCloseTo(-10)
  })

  it("лёгкий излом 170°: митра заполняет стык без щели", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100 + 100 * Math.cos((10 * Math.PI) / 180), 100 * Math.sin((10 * Math.PI) / 180))
    const shapeA = wallShape(a, [a, b])
    expect(shapeA[1].x).toBeCloseTo(99.125, 2)
    expect(shapeA[1].y).toBeCloseTo(10)
    expect(shapeA[2].x).toBeCloseTo(100.875, 2)
    expect(shapeA[2].y).toBeCloseTo(-10)
  })

  it("коллинеарные стены: плоские торцы", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 60, 0)
    const shapeA = wallShape(a, [a, b])
    expect(shapeA[1]).toEqual({ x: 100, y: 10 })
    expect(shapeA[2]).toEqual({ x: 100, y: -10 })
  })

  it("три стены в одной вершине: плоские торцы", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    const c = wall(100, 0, 170.71, 70.71)
    const shapeA = wallShape(a, [a, b, c])
    expect(shapeA[1]).toEqual({ x: 100, y: 10 })
    expect(shapeA[2]).toEqual({ x: 100, y: -10 })
  })

  it("T-стык 90°: торец заподлицо с гранью сквозной стены", () => {
    const through = wall(0, 0, 100, 0)
    const incoming = wall(50, 0, 50, -40)
    const shape = wallShape(incoming, [through, incoming])
    expect(shape[0]).toEqual({ x: 60, y: -10 })
    expect(shape[3]).toEqual({ x: 40, y: -10 })
    expect(shape[1]).toEqual({ x: 60, y: -40 })
    expect(shape[2]).toEqual({ x: 40, y: -40 })
    expect(wallShape(through, [through, incoming])).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ])
  })

  it("T-стык 30°: торец подрезан по грани сквозной", () => {
    const through = wall(0, 0, 100, 0)
    const incoming = wall(50, 0, 50 + 40 * Math.cos(Math.PI / 6), -40 * Math.sin(Math.PI / 6))
    const shape = wallShape(incoming, [through, incoming])
    expect(shape[0].x).toBeCloseTo(87.32, 2)
    expect(shape[0].y).toBeCloseTo(-10)
    expect(shape[3].x).toBeCloseTo(47.32, 2)
    expect(shape[3].y).toBeCloseTo(-10)
  })

  it("конец на оси у торца: сквозная ровно как нарисована, примыкающая подрезана", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(103, 0, 103, -80)
    expect(wallShape(a, [a, b])).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ])
    expect(wallShape(b, [a, b])).toEqual([
      { x: 113, y: -10 },
      { x: 113, y: -80 },
      { x: 93, y: -80 },
      { x: 93, y: -10 },
    ])
    expect(sameTypeJoint(a, a.b, [a, b])).toBe(false)
    expect(sameTypeJoint(b, b.a, [a, b])).toBe(false)
  })

  it("коллинеарные с зазором меньше полутолщины: торцы сведены", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(103, 0, 200, 0)
    expect(wallShape(b, [a, b])).toEqual([
      { x: 100, y: 10 },
      { x: 200, y: 10 },
      { x: 200, y: -10 },
      { x: 100, y: -10 },
    ])
  })

  it("три конца в пределах допуска: плоские торцы", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    const c = wall(103, 0, 103, -80)
    const shapeA = wallShape(a, [a, b, c])
    expect(shapeA[1]).toEqual({ x: 100, y: 10 })
    expect(shapeA[2]).toEqual({ x: 100, y: -10 })
  })

  it("полигон не выходит за полосу ось ± полтолщины при любом угле", () => {
    for (const deg of [20, 30, 45, 60, 90, 120, 135, 150, 170]) {
      const rad = (deg * Math.PI) / 180
      const a = wall(0, 0, 100, 0)
      const b = wall(100, 0, 100 + 100 * Math.cos(rad), 100 * Math.sin(rad))
      for (const [w, shape] of [
        [a, wallShape(a, [a, b])],
        [b, wallShape(b, [a, b])],
      ] as const) {
        const u = { x: w.b.x - w.a.x, y: w.b.y - w.a.y }
        const len = Math.hypot(u.x, u.y)
        for (const p of shape) {
          const rel = { x: p.x - w.a.x, y: p.y - w.a.y }
          expect(Math.abs((rel.x * -u.y + rel.y * u.x) / len)).toBeLessThanOrEqual(w.thicknessCm / 2 + 1e-6)
        }
      }
    }
  })
})
