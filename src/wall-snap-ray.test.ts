import { describe, expect, it } from "vitest"
import { snapOnRay, snapRadiusCm, snapVertex, squareOnSide } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall } from "./types"
import {
  W,
  deepFreeze,
  expectPoint,
  maxOverlap,
  sceneL,
  sceneN,
  sceneS,
  sceneT,
  strictlyInsideAnyBody,
} from "./wall-snap.test-utils"

// change wall-relative-angle-snap (test-plan.md): конец при заданном направлении —
// на луче от начала; прилипание к стене меняет только длину (design D3, D4).

const GRID = 10
const R = (zoom: number): number => snapRadiusCm(zoom)
const RAD = Math.PI / 180
const dirDeg = (deg: number): Point => ({ x: Math.cos(deg * RAD), y: Math.sin(deg * RAD) })

const ray = (p: Point, walls: Wall[], start: Point, dir: Point, zoom = 1, t = 20): VertexSnap =>
  snapOnRay(p, walls, R(zoom), GRID, t, start, dir)

const sceneP = (): Wall[] => [W(0, 0, 100, 0), W(0, 50, 100, 50)]

function expectNormal(r: VertexSnap, nx: number, ny: number): void {
  expect(r.normal).toBeDefined()
  expectPoint(r.normal ?? { x: NaN, y: NaN }, nx, ny)
}

describe("snapOnRay: прилипание по пересечению луча", () => {
  it("RAY-FACE-1: луч упирается в грань — конец в пересечении, не в проекции курсора", () => {
    const r = ray({ x: 53, y: -13 }, sceneS(), { x: 50, y: -100 }, { x: 0, y: 1 })
    expect(r).toEqual({ point: { x: 50, y: -10 }, source: "wall" })
    expectNormal(r, 0, -1)
    expect(r.target).toBe("face")
  })

  it("RAY-CAP-1: луч упирается в свободный торец", () => {
    const r = ray({ x: 106, y: 5 }, sceneS(), { x: 200, y: 5 }, { x: -1, y: 0 })
    expect(r).toEqual({ point: { x: 100, y: 5 }, source: "wall" })
    expectNormal(r, 1, 0)
    expect(r.target).toBe("cap")
  })

  it("RAY-SLANT-WALL-1: наклонный луч — пересечение с гранью, направление сохранено", () => {
    const start = { x: 0, y: -100 }
    const d = dirDeg(60)
    const s = 90 / d.y // до грани y = −10
    const hit = { x: start.x + d.x * s, y: -10 }
    const r = ray({ x: hit.x + 4, y: -14 }, [W(0, 0, 200, 0)], start, d)
    expect(r.source).toBe("wall")
    expectPoint(r.point, hit.x, hit.y)
  })

  it("RAY-FACE-BEYOND-1: луч пересекает линию грани за концом стены — без прилипания", () => {
    // x = 130 — продолжение линии грани y = −10 за торцом S (x ≤ 100)
    const r = ray({ x: 130, y: -13 }, sceneS(), { x: 130, y: -100 }, { x: 0, y: 1 })
    expect(r).toEqual({ point: { x: 130, y: -10 }, source: "grid" })
  })

  it("RAY-CAP-LATERAL-1: луч пересекает плоскость торца вне его отрезка — без прилипания", () => {
    // торец S x = 100 занимает y ∈ [−10, 10]; луч y = 15 проходит мимо
    const r = ray({ x: 106, y: 15 }, sceneS(), { x: 200, y: 15 }, { x: -1, y: 0 })
    expect(r).toEqual({ point: { x: 110, y: 15 }, source: "grid" })
  })

  it("RAY-CAP-CLOSED-1: торец, частично закрытый примыкающей стеной, — не цель", () => {
    // толстая стена (торец x = 100, y ∈ [−50, 50]); тонкая стена начинается на плоскости
    // торца, её отображаемое тело сходится клином к точкам (100, ±5) — участок торца
    // y ∈ [−5, 5] закрыт. Луч y = −30 проходит мимо тела тонкой стены, квадрат у торца
    // ни на что не налагается: отсекает только требование свободного торца
    const walls = [W(0, 0, 100, 0, 100), W(100, 45, 300, 45, 10)]
    const r = ray({ x: 106, y: -30 }, walls, { x: 200, y: -30 }, { x: -1, y: 0 })
    expect(r).toEqual({ point: { x: 110, y: -30 }, source: "grid" })
    // контроль: та же стена без закрывающей — торец свободен, прилипание есть
    const free = ray({ x: 106, y: -30 }, [walls[0]], { x: 200, y: -30 }, { x: -1, y: 0 })
    expect(free).toEqual({ point: { x: 100, y: -30 }, source: "wall" })
  })

  it("RAY-FACE-CORNER-1: открытый участок грани — по отображаемому контуру, а не по длине оси", () => {
    // сцена L: нижняя грань A (y = −10) продолжается угловым куском B до x = −10;
    // x = −5 лежит вне [0, 300] по оси A, но на открытом участке контура
    const r = ray({ x: -5, y: -13 }, sceneL(), { x: -5, y: -100 }, { x: 0, y: 1 })
    expect(r).toEqual({ point: { x: -5, y: -10 }, source: "wall" })
    expectNormal(r, 0, -1)
  })

  it("RAY-CLOSED-1: пересечение на закрытом участке грани — без прилипания", () => {
    const r = ray({ x: 150, y: 16 }, sceneT(), { x: 150, y: 300 }, { x: 0, y: -1 })
    expect(r).toEqual({ point: { x: 150, y: 20 }, source: "grid" })
  })

  it("RAY-NOROOM-1: квадрат в пересечении налагается на соседние стены — без прилипания", () => {
    const r = ray({ x: 112, y: 16 }, sceneN(), { x: 112, y: 100 }, { x: 0, y: -1 })
    expect(r).toEqual({ point: { x: 112, y: 20 }, source: "grid" })
  })

  it("RAY-REACH-1: пересечение дальше зоны прилипания от курсора — сетка на луче", () => {
    const r = ray({ x: 53, y: -24 }, sceneS(), { x: 50, y: -100 }, { x: 0, y: 1 })
    expect(r).toEqual({ point: { x: 50, y: -20 }, source: "grid" })
  })

  it("RAY-REACH-EQ-1: ровно на границе зоны — прилипает, чуть дальше — нет", () => {
    const at = ray({ x: 50, y: -20 }, sceneS(), { x: 50, y: -100 }, { x: 0, y: 1 })
    expect(at).toEqual({ point: { x: 50, y: -10 }, source: "wall" })
    const beyond = ray({ x: 50, y: -20.01 }, sceneS(), { x: 50, y: -100 }, { x: 0, y: 1 })
    expect(beyond).toEqual({ point: { x: 50, y: -20 }, source: "grid" })
  })

  it("RAY-REACH-ZOOM-1: зона — больший из радиуса привязки и полутолщины новой стены", () => {
    // z = 0.2: радиус 30 см > полутолщины 10
    const far = ray({ x: 50, y: -38 }, sceneS(), { x: 50, y: -100 }, { x: 0, y: 1 }, 0.2)
    expect(far).toEqual({ point: { x: 50, y: -10 }, source: "wall" })
    // z = 1, новая стена 40: зона 20 см
    const thick = ray({ x: 50, y: -29 }, sceneS(), { x: 50, y: -100 }, { x: 0, y: 1 }, 1, 40)
    expect(thick).toEqual({ point: { x: 50, y: -10 }, source: "wall" })
  })

  it("RAY-NEAREST-1: из пересечений выбирается ближайшее к курсору", () => {
    // до (50,−10) — 28 см, до (50,40) — 22 см, обе в зоне 30 см; луч раньше пересекает A
    const r = ray({ x: 50, y: 18 }, sceneP(), { x: 50, y: -100 }, { x: 0, y: 1 }, 0.2)
    expect(r).toEqual({ point: { x: 50, y: 40 }, source: "wall" })
    expectNormal(r, 0, -1)
  })

  it("RAY-TIE-1: равные расстояния — стена раньше в массиве", () => {
    const [a, b] = sceneP()
    const ab = ray({ x: 50, y: 15 }, [a, b], { x: 50, y: -100 }, { x: 0, y: 1 }, 0.2)
    expect(ab).toEqual({ point: { x: 50, y: -10 }, source: "wall" })
    const ba = ray({ x: 50, y: 15 }, [b, a], { x: 50, y: -100 }, { x: 0, y: 1 }, 0.2)
    expect(ba).toEqual({ point: { x: 50, y: 40 }, source: "wall" })
  })

  it("RAY-EXIT-1: грань, через которую луч выходит из тела, не цель", () => {
    // начало на грани y = 10, луч (0,−1) проходит сквозь тело S и выходит через грань
    // y = −10; курсор в 4 см от неё — но это грань выхода, прилипания нет
    const r = ray({ x: 50, y: -14 }, sceneS(), { x: 50, y: 10 }, { x: 0, y: -1 })
    expect(r).toEqual({ point: { x: 50, y: -10 }, source: "grid" })
  })
})

describe("snapOnRay: сетка на луче", () => {
  it("RAY-AXIS-1: осевой луч — неподвижная координата точно, подвижная по сетке", () => {
    expect(ray({ x: 103, y: 27 }, [], { x: 3, y: 23 }, { x: 1, y: 0 })).toEqual({
      point: { x: 100, y: 23 },
      source: "grid",
    })
    expect(ray({ x: 30, y: 103 }, [], { x: 23, y: 3 }, { x: 0, y: 1 })).toEqual({
      point: { x: 23, y: 100 },
      source: "grid",
    })
  })

  it("RAY-SLANT-1: наклонный луч — длина кратна шагу сетки", () => {
    const d = dirDeg(30)
    const n = { x: -d.y, y: d.x }
    const r = ray({ x: 47 * d.x + 3 * n.x, y: 47 * d.y + 3 * n.y }, [], { x: 0, y: 0 }, d)
    expect(r.source).toBe("grid")
    expectPoint(r.point, 50 * d.x, 50 * d.y)
    const r2 = ray({ x: 44 * d.x, y: 44 * d.y }, [], { x: 0, y: 0 }, d)
    expectPoint(r2.point, 40 * d.x, 40 * d.y)
    // длина от начала вне сетки, а не координаты узлов
    const r3 = ray({ x: 3 + 47 * d.x, y: 7 + 47 * d.y }, [], { x: 3, y: 7 }, d)
    expectPoint(r3.point, 3 + 50 * d.x, 7 + 50 * d.y)
  })

  it("RAY-BEHIND-1: курсор позади начала — нулевая длина", () => {
    const r = ray({ x: -20, y: -5 }, [], { x: 0, y: 0 }, dirDeg(30))
    expectPoint(r.point, 0, 0)
    expect(r.source).toBe("grid")
  })

  it("RAY-AXIS-BEHIND-1: осевой луч, курсор позади начала — конец в начале", () => {
    expect(ray({ x: -20, y: 3 }, [], { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({
      point: { x: 0, y: 0 },
      source: "grid",
    })
  })

  it("RAY-AXIS-OFFGRID-1: начало вне сетки, ближайший узел позади начала — конец в начале", () => {
    // ближайшее кратное к x = 4 — 0, это позади начала x = 3
    expect(ray({ x: 4, y: 23 }, [], { x: 3, y: 23 }, { x: 1, y: 0 })).toEqual({
      point: { x: 3, y: 23 },
      source: "grid",
    })
    // ближайшее кратное впереди — конец по сетке
    expect(ray({ x: 9, y: 23 }, [], { x: 3, y: 23 }, { x: 1, y: 0 })).toEqual({
      point: { x: 10, y: 23 },
      source: "grid",
    })
  })
})

describe("snapVertex: орто по осям экрана через луч", () => {
  it("SNAP-ORTHO-WALL-1: сработавшее орто — конец на пересечении луча с гранью", () => {
    const r = snapVertex({ x: 53, y: -14 }, sceneS(), R(1), GRID, 20, { x: 50, y: -100 })
    expect(r).toEqual({ point: { x: 50, y: -10 }, source: "wall" })
    expectNormal(r, 0, -1)
  })

  it("SNAP-ORTHO-WALL-2: орто не сработало (диагональ) — прежнее прилипание по курсору", () => {
    const r = snapVertex({ x: 53, y: -14 }, sceneS(), R(1), GRID, 20, { x: 0, y: -60 })
    expect(r).toEqual({ point: { x: 53, y: -10 }, source: "wall" })
  })
})

describe("Инварианты конца на луче", () => {
  const scenes: [string, Wall[]][] = [
    ["S", sceneS()],
    ["L", sceneL()],
    ["T", sceneT()],
    ["N", sceneN()],
  ]
  const starts: Point[] = [
    { x: -60, y: -70 },
    { x: 150, y: 120 },
    { x: 360, y: 40 },
    { x: 60, y: 250 },
  ]
  const dirs = [0, 30, 60, 90, 135, 180, 225, 270, 315].map(dirDeg)

  for (const [name, walls] of scenes)
    it(`INV-RAY-1/2: сцена ${name} — конец на луче, прилипший квадрат без наложения`, () => {
      let stuck = 0
      for (const start of starts)
        for (const d of dirs)
          for (let x = -40; x <= 340; x += 20)
            for (let y = -40; y <= 260; y += 20) {
              const r = ray({ x, y }, walls, start, d)
              const rel = { x: r.point.x - start.x, y: r.point.y - start.y }
              expect(Math.abs(rel.x * d.y - rel.y * d.x)).toBeLessThanOrEqual(1e-6)
              expect(rel.x * d.x + rel.y * d.y).toBeGreaterThanOrEqual(-1e-9)
              if (r.source !== "wall") continue
              stuck++
              expect(r.normal).toBeDefined()
              if (!r.normal) continue
              expect(maxOverlap(squareOnSide(r.point, r.normal, 20), walls)).toBeLessThanOrEqual(1e-6)
              expect(strictlyInsideAnyBody(r.point, walls)).toBe(false)
            }
      // защита от «никогда не прилипать»
      expect(stuck).toBeGreaterThan(0)
    }, 120_000)

  it("RAY-PURE-1: сцены не мутируются, результат повторяем", () => {
    const t = deepFreeze(sceneT())
    const first = ray({ x: 150, y: 16 }, t, { x: 150, y: 300 }, { x: 0, y: -1 })
    const again = ray({ x: 150, y: 16 }, t, { x: 150, y: 300 }, { x: 0, y: -1 })
    expect(again).toEqual(first)
    const s = deepFreeze(sceneS())
    const a = ray({ x: 53, y: -13 }, s, { x: 50, y: -100 }, { x: 0, y: 1 })
    const b = ray({ x: 53, y: -13 }, s, { x: 50, y: -100 }, { x: 0, y: 1 })
    expect(b).toEqual(a)
    expect(b.normal).toEqual(a.normal)
  })
})
