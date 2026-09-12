import { describe, expect, it } from "vitest"
import { dimensionOffsetAt, dimGeometry, lockedDirection, dimHitDistance, dimLevelSnap, dimPointPoint, endpointAt, handleAt, hitWall, jointedWalls, moveEndpoint, moveWall, moveWalls, nearestEdgeIntersection, pointInConvex, pointOn, pointsEqual, sameTypeJoint, segmentIntersectsRect, snap, snapVertex, subtractCovered, visibleWorld, wallDisplayPolys, wallShape, zoomAt } from "./geometry"
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

const rect = { min: { x: 0, y: 0 }, max: { x: 100, y: 50 } }

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

describe("moveWalls", () => {
  it("смещает группу одним вектором, чужие стены не трогает", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const g2 = wall(0, 40, 80, 40, "g2")
    const far = wall(300, 0, 300, 100, "far")
    moveWalls([g1, g2, far], [g1, g2], { x: 10, y: 5 })
    expect(g1.a).toEqual({ x: 10, y: 5 })
    expect(g2.b).toEqual({ x: 90, y: 45 })
    expect(far.a).toEqual({ x: 300, y: 0 })
    expect(far.b).toEqual({ x: 300, y: 100 })
  })

  it("приваривает стыковой конец соседа к точному новому концу группы", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const n = wall(105, 0, 105, 80, "n")
    moveWalls([g1, n], [g1], { x: 10, y: 0 })
    expect(n.a).toEqual({ x: 110, y: 0 })
    expect(n.b).toEqual({ x: 105, y: 80 })
  })

  it("T-примыкание к двум выделенным сдвигается ровно один вектор", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const g2 = wall(0, 60, 100, 60, "g2")
    const t = wall(50, 0, 50, 60, "t")
    moveWalls([g1, g2, t], [g1, g2], { x: 10, y: 0 })
    expect(t.a).toEqual({ x: 60, y: 0 })
    expect(t.b).toEqual({ x: 60, y: 60 })
  })

  it("стена между концами двух стен группы растягивается между ними", () => {
    const g1 = wall(0, 0, 100, 0, "g1")
    const g2 = wall(110, 40, 210, 40, "g2")
    const span = wall(100, 0, 110, 40, "span")
    moveWalls([g1, g2, span], [g1, g2], { x: 0, y: 20 })
    expect(span.a).toEqual({ x: 100, y: 20 })
    expect(span.b).toEqual({ x: 110, y: 60 })
  })
})

describe("jointedWalls", () => {
  it("точное совпадение и допуск — да, разрыв — нет", () => {
    expect(jointedWalls(wall(0, 0, 100, 0), wall(100, 0, 100, 80))).toBe(true)
    expect(jointedWalls(wall(0, 0, 100, 0), wall(90, 0, 90, 80))).toBe(true)
    expect(jointedWalls(wall(0, 0, 100, 0), wall(130, 0, 130, 80))).toBe(false)
  })
})

describe("segmentIntersectsRect", () => {
  it("отрезок целиком внутри прямоугольника", () => {
    expect(segmentIntersectsRect({ x: 20, y: 10 }, { x: 80, y: 40 }, rect.min, rect.max)).toBe(true)
  })

  it("отрезок пересекает границу прямоугольника", () => {
    expect(segmentIntersectsRect({ x: -50, y: 25 }, { x: 50, y: 25 }, rect.min, rect.max)).toBe(true)
    expect(segmentIntersectsRect({ x: 50, y: -30 }, { x: 50, y: 80 }, rect.min, rect.max)).toBe(true)
    expect(segmentIntersectsRect({ x: -40, y: -40 }, { x: 140, y: 90 }, rect.min, rect.max)).toBe(true)
  })

  it("касание границы — пересечение", () => {
    expect(segmentIntersectsRect({ x: -50, y: 25 }, { x: 0, y: 25 }, rect.min, rect.max)).toBe(true)
  })

  it("отрезок вне прямоугольника", () => {
    expect(segmentIntersectsRect({ x: -50, y: 25 }, { x: -10, y: 25 }, rect.min, rect.max)).toBe(false)
    expect(segmentIntersectsRect({ x: -40, y: 60 }, { x: 140, y: 60 }, rect.min, rect.max)).toBe(false)
    expect(segmentIntersectsRect({ x: 150, y: 10 }, { x: 160, y: 40 }, rect.min, rect.max)).toBe(false)
  })

  it("нулевая длина — попадание точки", () => {
    expect(segmentIntersectsRect({ x: 50, y: 25 }, { x: 50, y: 25 }, rect.min, rect.max)).toBe(true)
    expect(segmentIntersectsRect({ x: -50, y: 25 }, { x: -50, y: 25 }, rect.min, rect.max)).toBe(false)
  })

  it("запас (полутолщина стены) расширяет прямоугольник", () => {
    expect(segmentIntersectsRect({ x: 50, y: -8 }, { x: 50, y: -8 }, rect.min, rect.max, 10)).toBe(true)
    expect(segmentIntersectsRect({ x: 50, y: -12 }, { x: 50, y: -12 }, rect.min, rect.max, 10)).toBe(false)
    expect(segmentIntersectsRect({ x: -8, y: 25 }, { x: -8, y: 25 }, rect.min, rect.max, 10)).toBe(true)
  })
})

describe("snapVertex", () => {
  const w40 = (ax: number, ay: number, bx: number, by: number, id = "w40"): Wall => ({
    ...wall(ax, ay, bx, by, id),
    thicknessCm: 40,
  })

  it("T-контакт: конец стены поднимается заподлицо с гранью", () => {
    const a = w40(0, 0, 200, 0)
    // курсор чуть ниже нижней грани a
    expect(snapVertex({ x: 100, y: 26 }, [a], 10, 20)).toEqual({ x: 100, y: 20 })
  })

  it("T-контакт с другой стороны — верхняя грань", () => {
    const a = w40(0, 0, 200, 0)
    expect(snapVertex({ x: 100, y: -26 }, [a], 10, 20)).toEqual({ x: 100, y: -20 })
  })

  it("угловой контакт: старт у торца смещает ось на грань с совмещением наружных граней", () => {
    const a = w40(200, 200, 350, 200)
    // клик чуть ниже и правее конца стены A, у её грани
    expect(snapVertex({ x: 355, y: 230 }, [a], 10, 20)).toEqual({ x: 330, y: 220 })
  })

  it("коллинеарное продолжение: вершина в плоскости торца на оси", () => {
    const a = w40(0, 0, 250, 0)
    expect(snapVertex({ x: 250, y: 0 }, [a], 10, 20)).toEqual({ x: 250, y: 0 })
  })

  it("конец у торца: продолжение по оси, дальше — свободная установка", () => {
    const a = w40(0, 0, 250, 0)
    expect(snapVertex({ x: 260, y: -10 }, [a], 10, 20)).toEqual({ x: 250, y: 0 })
    expect(snapVertex({ x: 300, y: -10 }, [a], 10, 20)).toEqual({ x: 300, y: -10 })
  })

  it("старт в середине стены прилипает к её грани (T-старт)", () => {
    const a = w40(0, 0, 200, 0)
    expect(snapVertex({ x: 100, y: 0 }, [a], 10, 20)).toEqual({ x: 100, y: 20 })
  })

  it("контакт побеждает сетку у курсора на оси", () => {
    const a = w40(0, 0, 200, 0)
    const r = snapVertex({ x: 100, y: 4 }, [a], 10, 20)
    expect(r).toEqual({ x: 100, y: 20 })
  })

  it("вне радиуса — привязка к сетке", () => {
    expect(snapVertex({ x: 303, y: 296 }, [w40(0, 0, 200, 0)], 10, 20)).toEqual({ x: 300, y: 300 })
  })

  it("без направления квадрат липнет к грани у торца", () => {
    // клик на осевой линии у торца — продолжение
    expect(snapVertex({ x: 248, y: 2 }, [w40(0, 0, 250, 0)], 10, 20)).toEqual({ x: 250, y: 0 })
  })

  it("старт рядом со стеной липнет к её грани — без зазора в полтолщины", () => {
    const a = wall(200, 200, 350, 200)
    // клик в 7.5 см ниже конца стены: вне радиуса от оси, но квадрат краем касается грани
    expect(snapVertex({ x: 351, y: 217.5 }, [a], 10, 10)).toEqual({ x: 340, y: 210 })
  })

  it("без направления в середине стены квадрат прилипает к ближайшей грани", () => {
    expect(snapVertex({ x: 125, y: 5 }, [w40(0, 0, 250, 0)], 10, 20)).toEqual({ x: 125, y: 20 })
  })

  it("кейс из хранилища: клик в узел сетки в полтолщины от грани — прилипание к грани", () => {
    // стена пользователя: (-260,-80)->(60,-80), толщина 20, грань y=-70
    const a = wall(-260, -80, 60, -80, "a")
    // клик в узел сетки (-50,-60): квадрат коснулся грани краем — ось встаёт НА грань
    expect(snapVertex({ x: -50, y: -60 }, [a], 10, 10)).toEqual({ x: -50, y: -70 })
  })

  it("направление от грани фиксируется точно перпендикулярно", () => {
    const a = w40(200, 200, 350, 200)
    // жест почти вертикальный (5° наклона) — фиксируется в ровный перпендикуляр
    const locked = lockedDirection({ x: 340, y: 210 }, { x: 0.085, y: 0.996 }, [a])
    expect(locked?.x).toBeCloseTo(0)
    expect(locked?.y).toBe(1)
    // дальняя от стены точка не фиксирует направление
    expect(lockedDirection({ x: 340, y: 400 }, { x: 0.085, y: 0.996 }, [a])).toBeNull()
  })

  it("старт на грани при тяге к стене не перепрыгивает на другую грань", () => {
    const a = w40(200, 200, 350, 200)
    expect(snapVertex({ x: 275, y: 220 }, [a], 10, 20)).toEqual({ x: 275, y: 220 })
  })

  it("коллинейная тяга: курсор на оси у торца — ось стартует в плоскости торца", () => {
    const a = w40(200, 200, 350, 200)
    expect(snapVertex({ x: 350, y: 200 }, [a], 10, 20)).toEqual({ x: 350, y: 200 })
  })
})

describe("прилипание даёт чистые прямоугольники", () => {
  it("оси уложенных стен не совпадают, wallShape обеих — чистые прямоугольники", () => {
    const a: Wall = { ...wall(0, 0, 250, 0, "a40"), thicknessCm: 40 }
    // результат углового прилипания: ось B начинается на грани A
    const b: Wall = { ...wall(230, 20, 230, 160, "b40"), thicknessCm: 40 }
    const walls = [a, b]
    // стык не классифицируется — рендер рисует простые прямоугольники
    expect(wallShape(a, walls)).toEqual([
      { x: 0, y: 20 },
      { x: 250, y: 20 },
      { x: 250, y: -20 },
      { x: 0, y: -20 },
    ])
    expect(wallShape(b, walls)).toEqual([
      { x: 210, y: 20 },
      { x: 210, y: 160 },
      { x: 250, y: 160 },
      { x: 250, y: 20 },
    ])
  })
})

describe("sameTypeJoint", () => {
  it("одинаковые стены под 90°: сливаются, шов не рисуется", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100, 80)
    expect(sameTypeJoint(a, a.b, [a, b])).toBe(true)
    expect(sameTypeJoint(b, b.a, [a, b])).toBe(true)
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

  it("острый угол 20°: один тип сливается", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(0, 0, 100 * Math.cos((20 * Math.PI) / 180), 100 * Math.sin((20 * Math.PI) / 180))
    expect(sameTypeJoint(a, a.a, [a, b])).toBe(true)
    expect(sameTypeJoint(b, b.a, [a, b])).toBe(true)
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

describe("полигоны отрисовки и заливка клина", () => {
  it("у чисто уложенных стен — один прямоугольник без разбиения", () => {
    const a: Wall = { ...wall(0, 0, 250, 0, "a"), thicknessCm: 40 }
    const b: Wall = { ...wall(230, 20, 230, 160, "b"), thicknessCm: 40 }
    const walls = [a, b]
    expect(wallDisplayPolys(a, walls)).toEqual([wallShape(a, walls)])
    expect(wallDisplayPolys(b, walls)).toEqual([wallShape(b, walls)])
  })

  it("легаси-угол 90°: наложение вырезано, зазор и тело покрыты", () => {
    const a = wall(0, 0, 100, 0, "a")
    const b = wall(100, 0, 100, 80, "b")
    const walls = [a, b]
    const polys = wallDisplayPolys(b, walls)
    expect(polys.length).toBeGreaterThan(1)
    const inAny = (p: Point) => polys.some((poly) => pointInConvex(p, poly))
    expect(inAny({ x: 95, y: 0 })).toBe(false)
    expect(inAny({ x: 105, y: 5 })).toBe(true)
    expect(inAny({ x: 105, y: 40 })).toBe(true)
  })

  it("клин заливки попадает в позднюю стену", () => {
    const a = wall(0, 0, 100, 0, "a")
    const b = wall(100, 0, 100, 80, "b")
    expect(hitWall({ x: 109, y: -9 }, [a, b], 6)?.id).toBe("b")
  })
})

describe("subtractCovered", () => {
  it("ребро, проходящее сквозь тело соседа, рисуется кусками", () => {
    const a = wall(0, 0, 100, 0, "a")
    const b = wall(100, 0, 100, 80, "b")
    const segs = subtractCovered({ x: 90, y: -30 }, { x: 90, y: 80 }, [a, b], b, [])
    expect(segs.length).toBe(2)
    expect(segs[0][0]).toBeCloseTo(0)
    expect(segs[0][1]).toBeCloseTo(20 / 110, 3)
    expect(segs[1][0]).toBeCloseTo(40 / 110, 3)
    expect(segs[1][1]).toBeCloseTo(1)
  })

  it("шов разных типов у поздней соседки не скрывается", () => {
    const a = wall(0, 0, 100, 0, "a")
    const b: Wall = { ...wall(100, 0, 100, 80, "b"), type: "concrete" }
    const segs = subtractCovered({ x: 100, y: -10 }, { x: 100, y: 10 }, [a, b], a, [b])
    expect(segs).toEqual([[0, 1]])
  })

  it("контакт однотипных стен заподлицо не рисуется", () => {
    const v = wall(150, 100, 150, 250, "v")
    const h2 = wall(160, 240, 260, 240, "h")
    const capSegs = subtractCovered({ x: 160, y: 230 }, { x: 160, y: 250 }, [v, h2], h2, [])
    expect(capSegs).toEqual([])
    const faceSegs = subtractCovered({ x: 160, y: 100 }, { x: 160, y: 250 }, [v, h2], v, [])
    expect(faceSegs).toEqual([[0, 130 / 150]])
    const h3: Wall = { ...wall(160, 240, 260, 240, "h3"), type: "concrete" }
    expect(subtractCovered({ x: 160, y: 230 }, { x: 160, y: 250 }, [v, h3], h3, [])).toEqual([[0, 1]])
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

  it("непрямой угол: точка на пересечении граней, а не в сыром углу", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(100, 0, 100 + 100 * Math.SQRT1_2, 100 * Math.SQRT1_2, "w2")
    const p = dimPointPoint({ a: { wallId: "w1", edge: 0 }, b: { wallId: "w2", edge: 0 } }, [a, b])!
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
  it("находит внутренний угол стыка — пересечение граней", () => {
    const a = wall(0, 0, 100, 0, "w1")
    const b = wall(100, 0, 100, 80, "w2")
    const hit = nearestEdgeIntersection({ x: 92, y: 8 }, [a, b], 6)
    expect(hit?.point).toEqual({ x: 90, y: 10 })
    expect(hit?.a).toEqual({ wallId: "w1", edge: 0 })
    expect(hit?.b).toEqual({ wallId: "w2", edge: 0 })
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
      { x: 90, y: -10 },
      { x: 90, y: 80 },
      { x: 110, y: 80 },
      { x: 110, y: -10 },
    ])
  })

  it("поворот цепочки на 45°: сквозная ровно как нарисована", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100 + 70.7107, 70.7107)
    const shapeA = wallShape(a, [a, b])
    expect(shapeA[1]).toEqual({ x: 100, y: 10 })
    expect(shapeA[2]).toEqual({ x: 100, y: -10 })
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
      { x: 80, y: -10 },
      { x: 80, y: 80 },
      { x: 120, y: 80 },
      { x: 120, y: -10 },
    ])
  })

  it("острый угол 20°: сквозная прямоугольная, примыкающая доведена до дальней грани", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(0, 0, 100 * Math.cos((20 * Math.PI) / 180), 100 * Math.sin((20 * Math.PI) / 180))
    expect(wallShape(a, [a, b])).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ])
    const shapeB = wallShape(b, [a, b])
    expect(shapeB[0].x).toBeCloseTo(-56.713, 2)
    expect(shapeB[0].y).toBeCloseTo(-10)
    expect(shapeB[3].x).toBeCloseTo(1.763, 2)
    expect(shapeB[3].y).toBeCloseTo(-10)
  })

  it("излом 150°: сквозная ровно как нарисована, зазор заливается поздней", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100 + 100 * Math.cos(Math.PI / 6), 100 * Math.sin(Math.PI / 6))
    const shapeA = wallShape(a, [a, b])
    expect(shapeA[1]).toEqual({ x: 100, y: 10 })
    expect(shapeA[2]).toEqual({ x: 100, y: -10 })
  })

  it("лёгкий излом 170°: сквозная ровно как нарисована, щель заливается поздней", () => {
    const a = wall(0, 0, 100, 0)
    const b = wall(100, 0, 100 + 100 * Math.cos((10 * Math.PI) / 180), 100 * Math.sin((10 * Math.PI) / 180))
    const shapeA = wallShape(a, [a, b])
    expect(shapeA[1]).toEqual({ x: 100, y: 10 })
    expect(shapeA[2]).toEqual({ x: 100, y: -10 })
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
      { x: 113, y: 10 },
      { x: 113, y: -80 },
      { x: 93, y: -80 },
      { x: 93, y: 10 },
    ])
    expect(sameTypeJoint(a, a.b, [a, b])).toBe(true)
    expect(sameTypeJoint(b, b.a, [a, b])).toBe(true)
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
