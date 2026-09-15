import { describe, expect, it } from "vitest"
import { displayPolygons, hitWall, snapRadiusCm, snapVertex } from "./wall-geometry"
import type { Point, Wall } from "./types"

// Тестовые утилиты для change stable-wall-drawing.
// Контракт API зафиксирован в design.md (D1) и test-plan.md.
// Раунд 2: правки по test-validation.md (VERDICT: FAIL, проблемы №1–№14).

let seq = 0
const W = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type = "brick"): Wall => ({
  id: `w${++seq}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: type as Wall["type"],
})

const R = snapRadiusCm(1) // радиус привязки в тестах: 12 экранных px при масштабе 1
const GRID = 10 // шаг сетки, см

const round = (v: number): number => Math.round(v * 1e6) / 1e6
const pts = (polys: Point[][]): number[][] => polys.flatMap((poly) => poly.map((p) => [round(p.x), round(p.y)]))
const sortedPts = (polys: Point[][]): number[][] => pts(polys).sort((p, q) => p[0] - q[0] || p[1] - q[1])

function inPoly(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y
    const yj = poly[j].y
    if (yi > p.y !== yj > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - yi)) / (yj - yi) + poly[i].x)
      inside = !inside
  }
  return inside
}

const inPolys = (p: Point, polys: Point[][]): boolean => polys.some((poly) => inPoly(p, poly))

function polyArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

function axisDist(p: Point, w: Wall): number {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return Math.hypot(p.x - w.a.x, p.y - w.a.y)
  const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2))
  return Math.hypot(p.x - (w.a.x + t * dx), p.y - (w.a.y + t * dy))
}

// поперечное расстояние до полосы граней (без ограничения по торцам)
function lateralDist(p: Point, w: Wall): number {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len = Math.hypot(dx, dy)
  return Math.abs((dx * (p.y - w.a.y) - dy * (p.x - w.a.x)) / len)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

describe("snapRadiusCm: пересчёт экранных пикселей", () => {
  it("SNAP-RADIUS-PX-1: 12 px пересчитываются по масштабу", () => {
    expect(snapRadiusCm(1)).toBeCloseTo(6, 9) // 12 / (2 * 1)
    expect(snapRadiusCm(2)).toBeCloseTo(3, 9) // приближение — радиус меньше в мире
    expect(snapRadiusCm(0.5)).toBeCloseTo(12, 9) // отдаление — больше в мире
  })
})

describe("snapVertex: привязка к сетке", () => {
  it("SNAP-GRID-1: вторая вершина цепочки прилипает к сетке", () => {
    const walls = [W(1000, 1000, 1100, 1000)]
    const r = snapVertex({ x: 23, y: 7 }, walls, R, GRID, 20)
    expect(r.point).toEqual({ x: 20, y: 10 })
    expect(r.source).toBe("grid")
  })
})

describe("snapVertex: привязка к граням и торцам", () => {
  it("SNAP-FACE-1: прилипание длинной стороной к грани (T-примыкание), с обеих сторон", () => {
    const walls = [W(0, 0, 100, 0)]
    const top = snapVertex({ x: 50, y: 8 }, walls, R, GRID, 20)
    expect(top.point).toEqual({ x: 50, y: 10 }) // вершина на ближней грани (полтолщины от оси)
    expect(top.source).toBe("wall")
    const bottom = snapVertex({ x: 50, y: -8 }, walls, R, GRID, 20)
    expect(bottom.point).toEqual({ x: 50, y: -10 }) // нормаль другого знака — другая грань
    expect(bottom.source).toBe("wall")
  })

  it("SNAP-FACE-2: граница зоны грани (радиус или край квадрата) — внутри прилипает, снаружи нет", () => {
    const walls = [W(0, 0, 100, 0)]
    const inside = snapVertex({ x: 50, y: 15.9 }, walls, R, GRID, 20) // 5.9 см от грани < R
    expect(inside.point).toEqual({ x: 50, y: 10 })
    expect(inside.source).toBe("wall")
    const withinReach = snapVertex({ x: 50, y: 19.9 }, walls, R, GRID, 20) // 9.9 см: край квадрата (10) достиг грани
    expect(withinReach.point).toEqual({ x: 50, y: 10 })
    const outside = snapVertex({ x: 50, y: 20.1 }, walls, R, GRID, 20) // 10.1 см: за краем квадрата
    expect(outside).toEqual({ point: { x: 50, y: 20 }, source: "grid" })
  })

  it("SNAP-END-1: короткой стороной к торцу — угловое примыкание заподлицо", () => {
    const walls = [W(0, 0, 100, 0)]
    const below = snapVertex({ x: 98, y: -16 }, walls, R, GRID, 20)
    expect(below.point).toEqual({ x: 90, y: -10 }) // полутолщина НОВОЙ стены от торца
    expect(below.source).toBe("wall")
    const above = snapVertex({ x: 98, y: 16 }, walls, R, GRID, 20)
    expect(above.point).toEqual({ x: 90, y: 10 })
  })

  it("SNAP-END-4: при разной толщине вершина на полутолщине новой стены (заподлицо)", () => {
    const thick = W(0, 0, 100, 0, 40) // грань y=-20, торец x=100
    const thinNew = snapVertex({ x: 98, y: -24 }, [thick], R, GRID, 10) // 4 см от грани < R
    expect(thinNew.point).toEqual({ x: 95, y: -20 }) // 100 - 10/2
    const fatNew = snapVertex({ x: 75, y: -24 }, [thick], R, GRID, 60) // 4 см от грани < R
    expect(fatNew.point).toEqual({ x: 70, y: -20 }) // 100 - 60/2, проекция 75 клампится к 70
  })

  it("SNAP-END-2: коллинеарное продолжение — вершина в плоскости торца на оси", () => {
    const walls = [W(0, 0, 100, 0)]
    const r = snapVertex({ x: 106, y: 3 }, walls, R, GRID, 20)
    expect(r.point).toEqual({ x: 100, y: 0 })
    expect(r.source).toBe("wall")
  })

  it("SNAP-END-3: зоны конца стены — граница полосы строго различает угол и торец", () => {
    const walls = [W(0, 0, 100, 0)]
    const outsideBand = snapVertex({ x: 104, y: -14 }, walls, R, GRID, 20)
    expect(outsideBand.point).toEqual({ x: 90, y: -10 })
    const insideBand = snapVertex({ x: 104, y: 6 }, walls, R, GRID, 20)
    expect(insideBand.point).toEqual({ x: 100, y: 0 })
    // |d| = полутолщина ровно: курсор в пределах полосы -> торец (продолжение)
    const onBandEdge = snapVertex({ x: 104, y: -10 }, walls, R, GRID, 20)
    expect(onBandEdge.point).toEqual({ x: 100, y: 0 })
    // на 0.001 за полосой -> уже угол
    const justOutside = snapVertex({ x: 104, y: -10.001 }, walls, R, GRID, 20)
    expect(justOutside.point).toEqual({ x: 90, y: -10 })
  })

  it("SNAP-CONT-1: продолжение полосы за торцом, торец вне радиуса", () => {
    const walls = [W(0, 0, 100, 0)]
    const r = snapVertex({ x: 110, y: 5 }, walls, R, GRID, 20) // до торца 11.2 > R, lateral 5 <= R
    expect(r.point).toEqual({ x: 100, y: 0 })
    expect(r.source).toBe("wall")
  })
})

describe("snapVertex: приоритеты и радиус", () => {
  it("SNAP-PRIO-1: стена приоритетнее узла сетки", () => {
    const walls = [W(0, 0, 100, 0)]
    const r = snapVertex({ x: 49, y: 12.5 }, walls, R, GRID, 20) // сетка дала бы (50,10)
    expect(r.point).toEqual({ x: 49, y: 10 })
    expect(r.source).toBe("wall")
  })

  it("SNAP-PRIO-2: стена приоритетнее орто-оси — точки результатов различны", () => {
    const walls = [W(0, 0, 100, 0)]
    // орто+сетка от (0,0) дали бы (50,0); стена даёт (49,10)
    const r = snapVertex({ x: 49, y: 12.5 }, walls, R, GRID, 20, { x: 0, y: 0 })
    expect(r.point).toEqual({ x: 49, y: 10 })
    expect(r.source).toBe("wall")
  })

  it("SNAP-RADIUS-1: зона привязки не зависит от толщины существующей стены", () => {
    const thick = W(0, 0, 100, 0, 40) // грань y=20
    const thin = W(200, 0, 300, 0, 10) // грань y=5
    expect(snapVertex({ x: 50, y: 25 }, [thick], R, GRID, 20).source).toBe("wall") // 5 см от грани
    expect(snapVertex({ x: 250, y: 10 }, [thin], R, GRID, 20).source).toBe("wall") // те же 5 см
    // 7 см от грани: край квадрата (10 см) дотягивается — прилипание к обеим толщинам одинаково
    expect(snapVertex({ x: 50, y: 27 }, [thick], R, GRID, 20)).toEqual({ point: { x: 50, y: 20 }, source: "wall" })
    expect(snapVertex({ x: 250, y: 12 }, [thin], R, GRID, 20)).toEqual({ point: { x: 250, y: 5 }, source: "wall" })
    // за краем квадрата (11 см > 10) — прилипания нет у обеих толщин
    expect(snapVertex({ x: 50, y: 31 }, [thick], R, GRID, 20)).toEqual({ point: { x: 50, y: 30 }, source: "grid" })
    expect(snapVertex({ x: 250, y: 16 }, [thin], R, GRID, 20)).toEqual({ point: { x: 250, y: 20 }, source: "grid" })
  })

  it("SNAP-RADIUS-2: вне радиуса и края квадрата прилипания к стенам нет", () => {
    const walls = [W(0, 0, 100, 0)]
    const withinReach = snapVertex({ x: 50, y: 18 }, walls, R, GRID, 20) // 8 см: край квадрата дотягивается
    expect(withinReach).toEqual({ point: { x: 50, y: 10 }, source: "wall" })
    const r = snapVertex({ x: 50, y: 21 }, walls, R, GRID, 20) // 11 см от грани > 10
    expect(r).toEqual({ point: { x: 50, y: 20 }, source: "grid" })
  })
})

describe("snapVertex: орто-привязка", () => {
  it("SNAP-ORTHO-1: почти горизонтальное направление притягивается к горизонтали", () => {
    const r = snapVertex({ x: 100, y: 7 }, [], R, GRID, 20, { x: 0, y: 0 }) // 4°
    expect(r.point).toEqual({ x: 100, y: 0 })
    expect(r.source).toBe("grid")
  })

  it("SNAP-ORTHO-VERT-1: почти вертикальное направление притягивается к вертикали", () => {
    const r = snapVertex({ x: 7, y: 103 }, [], R, GRID, 20, { x: 0, y: 0 }) // ~3.9° от вертикали
    expect(r.point).toEqual({ x: 0, y: 100 })
    expect(r.source).toBe("grid")
  })

  it("SNAP-ORTHO-FIXED-1: неподвижная координата сохраняется точно, гридится только подвижная", () => {
    // старт вне сетки (например, вершина на грани стены толщиной 30: y=15)
    const horizontal = snapVertex({ x: 103, y: 27 }, [], R, GRID, 20, { x: 3, y: 23 })
    expect(horizontal.point).toEqual({ x: 100, y: 23 }) // y = 23 точно, x гридится
    const vertical = snapVertex({ x: 30, y: 103 }, [], R, GRID, 20, { x: 23, y: 3 })
    expect(vertical.point).toEqual({ x: 23, y: 100 }) // x = 23 точно, y гридится
  })

  it("SNAP-ORTHO-2: диагональ не притягивается, конец на сетке (в т.ч. вне узла)", () => {
    const onNode = snapVertex({ x: 100, y: 40 }, [], R, GRID, 20, { x: 0, y: 0 }) // ~21.8°
    expect(onNode.point).toEqual({ x: 100, y: 40 })
    const offNode = snapVertex({ x: 103, y: 41 }, [], R, GRID, 20, { x: 0, y: 0 })
    expect(offNode.point).toEqual({ x: 100, y: 40 }) // свободная диагональ всё равно гридится
  })

  it("SNAP-ORTHO-3: орто сохраняет привязку к сетке вдоль оси", () => {
    const r = snapVertex({ x: 103, y: 7 }, [], R, GRID, 20, { x: 0, y: 0 })
    expect(r.point).toEqual({ x: 100, y: 0 })
  })

  it("SNAP-ORTHO-4: выключенный орто не притягивает", () => {
    const r = snapVertex({ x: 103, y: 7 }, [], R, GRID, 20)
    expect(r.point).toEqual({ x: 100, y: 10 })
  })

  it("SNAP-ORTHO-5: ровно 15° включительно притягивается, за пределами — нет", () => {
    const y15 = 100 * Math.tan((15 * Math.PI) / 180)
    const exact = snapVertex({ x: 100, y: y15 }, [], R, GRID, 20, { x: 0, y: 0 })
    expect(exact.point).toEqual({ x: 100, y: 0 }) // «не более чем на 15°» — включительно
    const beyond = snapVertex({ x: 100, y: y15 + 0.1 }, [], R, GRID, 20, { x: 0, y: 0 })
    expect(beyond.point).toEqual({ x: 100, y: 30 })
  })
})

describe("snapVertex: детерминированность", () => {
  it("SNAP-DET-1: повторный проход через ту же точку даёт тот же результат", () => {
    const walls = [W(0, 0, 100, 0)]
    const p = { x: 49, y: 12.5 }
    const first = snapVertex(p, walls, R, GRID, 20)
    snapVertex({ x: 75, y: 40 }, walls, R, GRID, 20) // курсор ушёл в сторону
    expect(snapVertex(p, walls, R, GRID, 20)).toEqual(first)
    expect(snapVertex(p, walls, R, GRID, 20)).toEqual(first)
  })

  it("SNAP-DET-2: равные расстояния — стена раньше в массиве, в обоих порядках", () => {
    const first = W(0, 0, 100, 0) // грань сверху y=10
    const second = W(0, 24, 100, 24) // грань снизу y=14
    const p = { x: 50, y: 12 } // ровно по 2 см до обеих граней
    expect(snapVertex(p, [first, second], R, GRID, 20)).toEqual({ point: { x: 50, y: 10 }, source: "wall" })
    expect(snapVertex(p, [second, first], R, GRID, 20)).toEqual({ point: { x: 50, y: 14 }, source: "wall" })
  })
})

describe("displayPolygons: свободные торцы и прямые углы", () => {
  it("JOINT-FREE-1: одиночная стена — прямоугольник с плоскими торцами", () => {
    const w = W(0, 0, 100, 0)
    const polys = displayPolygons(w, [w])
    expect(polys).toHaveLength(1)
    expect(sortedPts(polys)).toEqual([
      [0, -10],
      [0, 10],
      [100, -10],
      [100, 10],
    ])
    expect(polyArea(polys[0])).toBeCloseTo(2000, 6)
  })

  it("JOINT-RIGHT-1: угловое примыкание 90° — оба прямоугольники, наружный угол закрыт, ранняя нетронута", () => {
    const early = W(0, 0, 100, 0)
    const late = W(90, -10, 90, -110)
    const scene = [early, late]
    const earlyPolys = displayPolygons(early, scene)
    expect(earlyPolys).toHaveLength(1)
    expect(polyArea(earlyPolys[0])).toBeCloseTo(2000, 6)
    const latePolys = displayPolygons(late, scene)
    expect(latePolys).toHaveLength(1)
    expect(polyArea(latePolys[0])).toBeCloseTo(2000, 6)
    // стык граней непрерывен: под нижней гранью ранней стены лежит тело поздней
    expect(inPolys({ x: 99.5, y: -9.5 }, earlyPolys)).toBe(true)
    expect(inPolys({ x: 99.5, y: -10.5 }, latePolys)).toBe(true)
    // наложения нет: поздняя не заходит в полосу ранней
    expect(inPolys({ x: 99.5, y: -9.5 }, latePolys)).toBe(false)
  })

  it("JOINT-RIGHT-2: наклон 90.3° в пределах допуска — рендер как прямой угол, без клина", () => {
    const early = W(0, 0, 100, 0)
    const dir = { x: Math.cos((-89.7 * Math.PI) / 180), y: Math.sin((-89.7 * Math.PI) / 180) }
    const late = W(90, -10, 90 + 100 * dir.x, -10 + 100 * dir.y)
    const polys = displayPolygons(late, [early, late])
    expect(polys.length).toBeGreaterThanOrEqual(1) // защита от пустого результата
    for (const poly of polys)
      // габарит по спеке — полоса между линиями граней (ось ± полтолщины);
      // вершина пересечения граней допускает выступ за торцовую плоскость
      for (const p of poly) expect(lateralDist(p, late)).toBeLessThanOrEqual(10 + 1e-6)
  })

  it("JOINT-RIGHT-3: габарит в пределах граней на прямом угле", () => {
    const early = W(0, 0, 100, 0)
    const late = W(90, -10, 90, -110)
    for (const w of [early, late]) {
      const polys = displayPolygons(w, [early, late])
      expect(polys.length).toBeGreaterThanOrEqual(1)
      for (const poly of polys)
        for (const p of poly) expect(axisDist(p, w)).toBeLessThanOrEqual(w.thicknessCm / 2 + 1e-6)
    }
  })
})

describe("displayPolygons: непрямые углы, клинья, коллинеарность", () => {
  // T-примыкание под углом thetaDeg от оси ранней стены (90 = перпендикуляр):
  // ось поздней выходит из (50,10) — точки на верхней грани ранней
  const tScene = (thetaDeg: number, len = 60): [Wall, Wall] => {
    const early = W(0, 0, 100, 0)
    const rad = (thetaDeg * Math.PI) / 180
    const d = { x: Math.cos(rad), y: Math.sin(rad) }
    const late = W(50, 10, 50 + len * d.x, 10 + len * d.y)
    return [early, late]
  }

  it("JOINT-OBLIQUE-1: T под 60° — торец косой (вершина над гранью), зазор над гранью залит", () => {
    const [early, late] = tScene(60)
    const scene = [early, late]
    const latePolys = displayPolygons(late, scene)
    // косой торец: у полигона поздней есть вершина в зоне стыка НАД гранью
    const nearJointAboveFace = latePolys.flat().filter((p) => Math.abs(p.x - 50) <= 15 && p.y > 10.05 && p.y < 16)
    expect(nearJointAboveFace.length).toBeGreaterThan(0)
    expect(inPolys({ x: 43.3, y: 11.7 }, latePolys)).toBe(true) // зона клина покрыта
    expect(inPolys({ x: 43.3, y: 11.7 }, displayPolygons(early, scene))).toBe(false)
  })

  it("JOINT-91-1: T под 91° — классифицирован как косой (торец косой), а не как прямой", () => {
    const [early, late] = tScene(91)
    const scene = [early, late]
    const latePolys = displayPolygons(late, scene)
    expect(latePolys.length).toBeGreaterThanOrEqual(1)
    // при «прямоугольной» трактовке торец срезался бы заподлицо с гранью (y=10):
    // косая трактовка оставляет вершину торца над гранью (~10.17).
    // Фильтр строго по зоне стыка — дальний торец стены (y≈70) не считается
    const jointZoneAboveFace = latePolys.flat().filter((p) => Math.abs(p.x - 50) <= 15 && p.y > 10.1 && p.y < 16)
    expect(jointZoneAboveFace.length).toBeGreaterThan(0)
  })

  it("JOINT-OBLIQUE-2: владелец зоны стыка определяется порядком в массиве", () => {
    const [a, b] = tScene(60)
    // a раньше: тело a нетронуто, поздняя b внутри него обрезана,
    // зона над гранью у стыка (клин) принадлежит b
    expect(inPolys({ x: 58, y: 8 }, displayPolygons(a, [a, b]))).toBe(true)
    expect(inPolys({ x: 58, y: 8 }, displayPolygons(b, [a, b]))).toBe(false)
    expect(inPolys({ x: 42, y: 14.5 }, displayPolygons(b, [a, b]))).toBe(true)
    expect(inPolys({ x: 42, y: 14.5 }, displayPolygons(a, [a, b]))).toBe(false)
    // реверс: b раньше — своё тело показывает целиком; поздняя a обрезана внутри тела b
    const bRect = displayPolygons(b, [b, a])
    expect(bRect).toHaveLength(1)
    expect(inPolys({ x: 58, y: 8 }, bRect)).toBe(true)
    expect(inPolys({ x: 58, y: 8 }, displayPolygons(a, [b, a]))).toBe(false) // a (поздняя) обрезана внутри тела ранней b
    expect(inPolys({ x: 42, y: 14.5 }, bRect)).toBe(false) // за собственным торцом b не рисует
    expect(inPolys({ x: 42, y: 14.5 }, displayPolygons(a, [b, a]))).toBe(false)
  })

  it("JOINT-OBLIQUE-3: залив ограничен гранью ранней стены и телом поздней", () => {
    const [early, late] = tScene(60)
    const scene = [early, late]
    const latePolys = displayPolygons(late, scene)
    expect(inPolys({ x: 45, y: 9 }, latePolys)).toBe(false) // ниже грани ранней — залива нет
    expect(inPolys({ x: 37, y: 11.5 }, latePolys)).toBe(false) // левее полосы поздней — открытое пространство
    expect(inPolys({ x: 44, y: 11 }, latePolys)).toBe(true)
  })

  it("JOINT-OVERLAP-1: наложение не отображается — вершин полигонов поздней внутри полосы ранней нет", () => {
    const [early, late] = tScene(60)
    const latePolys = displayPolygons(late, [early, late])
    expect(latePolys.length).toBeGreaterThanOrEqual(1)
    for (const poly of latePolys)
      for (const p of poly) expect(axisDist(p, early)).toBeGreaterThanOrEqual(10 - 1e-6)
  })

  it("JOINT-OBLIQUE-4: угловое примыкание под 45° — угол закрыт, владелец по порядку массива", () => {
    const early = W(0, 0, 100, 0)
    const d45 = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }
    const late = W(90, -10, 90 + 60 * d45.x, -10 + 60 * d45.y)
    const forward = [early, late]
    // полоса под нижней гранью ранней (справа от торца и слева) сплошная — выемки нет
    expect(inPolys({ x: 101, y: -10.2 }, displayPolygons(late, forward))).toBe(true)
    expect(inPolys({ x: 99, y: -10.2 }, displayPolygons(late, forward))).toBe(true)
    // реверс: 45°-стена раньше в массиве — нетронута; горизонтальная (поздняя) обрезана внутри её тела
    const reversed = [late, early]
    expect(inPolys({ x: 95, y: -9.5 }, displayPolygons(early, reversed))).toBe(false) // поздняя обрезана внутри тела 45°-стены
    expect(inPolys({ x: 95, y: -9.5 }, displayPolygons(late, reversed))).toBe(true) // ранняя 45°-стена нетронута
    expect(inPolys({ x: 101, y: -10.2 }, displayPolygons(late, reversed))).toBe(true) // снаружи тела поздней — видна
  })

  it("JOINT-COLLIN-1: коллинеарные стены — прямоугольники, зазор в пороге сведён", () => {
    const early = W(0, 0, 100, 0)
    const late = W(100.5, 0, 200, 0)
    const scene = [early, late]
    const earlyPolys = displayPolygons(early, scene)
    expect(earlyPolys).toHaveLength(1)
    expect(polyArea(earlyPolys[0])).toBeCloseTo(2000, 6) // ранняя нетронута
    const latePolys = displayPolygons(late, scene)
    expect(latePolys.length).toBeGreaterThanOrEqual(1)
    expect(inPolys({ x: 100.2, y: 5 }, latePolys)).toBe(true) // зазор закрыт поздней
    for (const poly of latePolys)
      for (const p of poly) expect(lateralDist(p, late)).toBeLessThanOrEqual(10 + 1e-6) // в полосе граней
  })

  it("JOINT-MULTI-1: три конца в пороге друг от друга — плоские торцы у всех", () => {
    const a = W(0, 0, 100, 0)
    const b = W(102, 0, 202, 0)
    const c = W(100, 80, 100, 8)
    const scene = [a, b, c]
    for (const w of scene) {
      const polys = displayPolygons(w, scene)
      expect(polys.length).toBeGreaterThanOrEqual(1)
      for (const poly of polys)
        for (const p of poly) expect(axisDist(p, w)).toBeLessThanOrEqual(w.thicknessCm / 2 + 1e-6)
    }
    // плоские торцы в собственных вершинах всех трёх стен
    expect(sortedPts(displayPolygons(a, scene))).toContainEqual([100, -10])
    expect(sortedPts(displayPolygons(a, scene))).toContainEqual([100, 10])
    expect(sortedPts(displayPolygons(b, scene))).toContainEqual([102, -10])
    expect(sortedPts(displayPolygons(b, scene))).toContainEqual([102, 10])
    expect(sortedPts(displayPolygons(c, scene))).toContainEqual([90, 8])
    expect(sortedPts(displayPolygons(c, scene))).toContainEqual([110, 8])
  })
})

describe("displayPolygons: легаси и превью", () => {
  it("JOINT-LEGACY-1: легаси-оси в общей вершине — поздняя доведена до дальней грани, ранняя нетронута", () => {
    const early = W(0, 0, 100, 0)
    const late = W(100, 0, 100, -100)
    const scene = [early, late]
    const latePolys = displayPolygons(late, scene)
    expect(inPolys({ x: 105, y: 5 }, latePolys)).toBe(true) // зона выше оси поздней: доведена до грани y=10
    expect(inPolys({ x: 105, y: 9 }, latePolys)).toBe(true)
    expect(inPolys({ x: 105, y: 11 }, latePolys)).toBe(false) // дальше дальней грани — нет
    const earlyPolys = displayPolygons(early, scene)
    expect(earlyPolys).toHaveLength(1)
    expect(polyArea(earlyPolys[0])).toBeCloseTo(2000, 6)
  })

  it("JOINT-PREVIEW-1: превью даёт те же полигоны, что и зафиксированная стена", () => {
    const early = W(0, 0, 100, 0)
    const scenes: Wall[][] = [
      [early, W(50, 10, 50, 70)], // перпендикулярное T
      [early, W(50, 10, 80, 10 + 30 * Math.sqrt(3))], // T под 60°
      [early, W(90, -10, 90, -110)], // угловое
    ]
    for (const scene of scenes) {
      const attached = scene[1]
      const asPreview = displayPolygons(attached, [scene[0], attached])
      const committed = { ...attached, id: "committed" }
      const asCommitted = displayPolygons(committed, [scene[0], committed])
      expect(pts(asPreview)).toEqual(pts(asCommitted))
    }
  })

  it("BOUND-DEGENERATE-1: вырожденная стена игнорируется без ошибок", () => {
    const degenerate = W(5, 5, 5, 5)
    const normal = W(0, 0, 100, 0)
    expect(snapVertex({ x: 23, y: 7 }, [degenerate], R, GRID, 20).point).toEqual({ x: 20, y: 10 })
    expect(displayPolygons(degenerate, [degenerate])).toEqual([])
    expect(hitWall({ x: 5, y: 5 }, [degenerate, normal], R)).toBe(normal)
  })
})

describe("hitWall: попадание по отображаемой форме", () => {
  it("HIT-WEDGE-1: клик в зону стыка над гранью выделяет позднюю стену", () => {
    const early = W(0, 0, 100, 0)
    const d = { x: 0.5, y: Math.sqrt(3) / 2 }
    const late = W(50, 10, 50 + 60 * d.x, 10 + 60 * d.y)
    expect(hitWall({ x: 43.3, y: 11.7 }, [early, late], R)).toBe(late)
  })

  it("HIT-COVER-1: точка под телом ранней стены не выделяет позднюю", () => {
    const early = W(0, 0, 100, 0)
    const late = W(100, 0, 100, -100) // легаси: сырая полоса поздней пересекает раннюю
    expect(hitWall({ x: 95, y: 5 }, [early, late], R)).toBe(early)
  })

  it("HIT-EMPTY-1: вне отображаемых стен попадания нет", () => {
    const w = W(0, 0, 100, 0)
    expect(hitWall({ x: 50, y: 50 }, [w], R)).toBeNull()
  })

  it("HIT-BAND-1: полосный допуск для тонкой стены сохранён", () => {
    const thin = W(0, 0, 100, 0, 4)
    expect(hitWall({ x: 50, y: 4 }, [thin], 6)).toBe(thin) // 4 см от оси: вне полосы, в допуске
  })

  it("HIT-CONS-1: попадание согласовано с полигонами на сетке точек стыка", () => {
    const early = W(0, 0, 100, 0)
    const late = W(100, 0, 100, -100)
    const scene = [early, late]
    const polysOf = new Map<Wall, Point[][]>(scene.map((w) => [w, displayPolygons(w, scene)]))
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 15; j++) {
        const p = { x: 81 + i * 4, y: -28 + j * 4 }
        const covered = scene.filter((w) => inPolys(p, polysOf.get(w)!))
        expect(covered.length).toBeLessThanOrEqual(1) // отображаемые полигоны не накладываются
        const hit = hitWall(p, scene, 0.1)
        if (covered.length === 1) expect(hit).toBe(covered[0])
        else expect(hit).toBeNull()
      }
  })
})

describe("инварианты: данные не мутируют", () => {
  it("INV-PURE-1: API не меняет стены", () => {
    const scene = [W(0, 0, 100, 0), W(50, 10, 80, 10 + 30 * Math.sqrt(3))]
    const snapshot = JSON.parse(JSON.stringify(scene))
    snapVertex({ x: 49, y: 12.5 }, scene, R, GRID, 20)
    snapVertex({ x: 103, y: 7 }, scene, R, GRID, 20, { x: 0, y: 0 })
    displayPolygons(scene[0], scene)
    displayPolygons(scene[1], scene)
    hitWall({ x: 43.3, y: 11.7 }, scene, R)
    expect(scene).toEqual(snapshot)
    // замороженная сцена: любая попытка мутации уронит тест в strict mode
    const frozen = deepFreeze(scene)
    snapVertex({ x: 49, y: 12.5 }, frozen, R, GRID, 20)
    displayPolygons(frozen[0], frozen)
    hitWall({ x: 95, y: 5 }, frozen, R)
    expect(frozen).toEqual(snapshot)
  })
})
