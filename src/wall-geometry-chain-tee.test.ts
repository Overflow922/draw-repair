import { describe, expect, it } from "vitest"
import { displayPolygons, hitWall } from "./wall-geometry"
import type { Point, Wall } from "./types"

// Тесты change fix-tee-at-chain-corner (spec wall-joints: «Допуск вершины стыка»,
// «Особые конфигурации вершин»). ID — по test-plan.md.

const W = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm = 20): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

const round = (v: number): number => Math.round(v * 1e6) / 1e6
const sortedPts = (polys: Point[][]): number[][] =>
  polys.flatMap((poly) => poly.map((p) => [round(p.x), round(p.y)])).sort((p, q) => p[0] - q[0] || p[1] - q[1])
const allPts = (polys: Point[][]): Point[] => polys.flat()
const minX = (polys: Point[][]): number => round(Math.min(...allPts(polys).map((p) => p.x)))
const maxX = (polys: Point[][]): number => round(Math.max(...allPts(polys).map((p) => p.x)))
const minY = (polys: Point[][]): number => round(Math.min(...allPts(polys).map((p) => p.y)))
const maxY = (polys: Point[][]): number => round(Math.max(...allPts(polys).map((p) => p.y)))
const hasVertex = (polys: Point[][], q: Point): boolean =>
  allPts(polys).some((p) => round(p.x) === round(q.x) && round(p.y) === round(q.y))

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

// угол цепочки (старая модель): V, затем H из вершины на оси V; новая U — вверх от верхней грани H
const chain = (): { V: Wall; H: Wall; U: Wall } => ({
  V: W("V", 110, 300, 110, 210),
  H: W("H", 110, 200, 340, 200),
  U: W("U", 110, 190, 110, 80),
})

describe("Новая стена у угла цепочки с противоположной грани", () => {
  it("TC-1: H доведена до дальней грани V, U и V упираются в грани H", () => {
    const { V, H, U } = chain()
    const walls = [V, H, U]
    const h = displayPolygons(H, walls)
    expect(minX(h)).toBe(100)
    expect(maxX(h)).toBe(340)
    expect(minY(h)).toBe(190)
    expect(maxY(h)).toBe(210)
    const u = displayPolygons(U, walls)
    expect([minX(u), maxX(u), minY(u), maxY(u)]).toEqual([100, 120, 80, 190])
    const v = displayPolygons(V, walls)
    expect([minX(v), maxX(v), minY(v), maxY(v)]).toEqual([100, 120, 210, 300])
  })

  it("TC-2: квадрат узла 100…120 × 190…210 целиком покрыт телами стен — выемки нет", () => {
    const { V, H, U } = chain()
    const walls = [V, H, U]
    const pieces = walls.flatMap((w) => displayPolygons(w, walls))
    const holes: Point[] = []
    for (let x = 100.5; x < 120; x += 1)
      for (let y = 190.5; y < 210; y += 1) if (!inPolys({ x, y }, pieces)) holes.push({ x, y })
    expect(holes).toEqual([])
  })

  it("TC-3: установка U не меняет многоугольники V и H (порядок V, H)", () => {
    const { V, H, U } = chain()
    const before = [V, H]
    const after = [V, H, U]
    expect(sortedPts(displayPolygons(V, after))).toEqual(sortedPts(displayPolygons(V, before)))
    expect(sortedPts(displayPolygons(H, after))).toEqual(sortedPts(displayPolygons(H, before)))
  })

  it("TC-3: установка U не меняет многоугольники V и H (порядок H, V)", () => {
    const { V, H, U } = chain()
    const before = [H, V]
    const after = [H, V, U]
    expect(sortedPts(displayPolygons(V, after))).toEqual(sortedPts(displayPolygons(V, before)))
    expect(sortedPts(displayPolygons(H, after))).toEqual(sortedPts(displayPolygons(H, before)))
  })
})

describe("Два соседа с противоположных граней — стык с ранней из соседних", () => {
  // V толщиной 30 (дальняя грань x = 95), U толщиной 20 (дальняя грань x = 100)
  const setup = (): { V: Wall; H: Wall; U: Wall } => ({
    V: W("V", 110, 300, 110, 210, 30),
    H: W("H", 110, 200, 340, 200),
    U: W("U", 110, 190, 110, 80),
  })

  it("TC-4: ранняя V — H доведена до дальней грани V (x = 95)", () => {
    const { V, H, U } = setup()
    expect(minX(displayPolygons(H, [V, U, H]))).toBe(95)
  })

  it("TC-4: ранняя U — H доведена до дальней грани U (x = 100)", () => {
    const { V, H, U } = setup()
    expect(minX(displayPolygons(H, [U, V, H]))).toBe(100)
  })

  it("TC-11: ранняя V дальше от конца H, чем поздняя U, — выбор по порядку, не по расстоянию (x = 95)", () => {
    const V = W("V", 110, 300, 110, 210, 30) // 10 см от конца H
    const H = W("H", 110, 200, 340, 200)
    const U = W("U", 110, 191, 110, 80) // 9 см от конца H
    expect(minX(displayPolygons(H, [V, U, H]))).toBe(95)
  })
})

describe("Порог попарной проверки — своей пары", () => {
  it("TC-12: соседи 30 и 20 см в 12 см друг от друга (порог пары 15) — одна вершина, торец H плоский", () => {
    const H = W("H", 0, 0, 200, 0)
    const V = W("V", 0, 7, 0, 100, 30)
    const U = W("U", 0, -5, 0, -100)
    expect(minX(displayPolygons(H, [V, U, H]))).toBe(0)
  })

  it("TC-13: H толще соседей (30 см), соседи 20 см в 12 см друг от друга (порог пары 10) — не одна вершина, H до дальней грани V", () => {
    const H = W("H", 0, 0, 200, 0, 30)
    const V = W("V", 0, 6, 0, 100)
    const U = W("U", 0, -6, 0, -100)
    expect(minX(displayPolygons(H, [V, U, H]))).toBe(-10)
  })

  it("TC-14: три соседа — первый близок к обоим, но двое других в 10.01 друг от друга — не одна вершина, торец H не плоский", () => {
    const X = W("X", 0, 0, -100, -100)
    const V = W("V", 0, 5, 0, 100)
    const U = W("U", 0, -5.01, 0, -100)
    const H = W("H", 0, 0, 200, 0)
    expect(minX(displayPolygons(H, [X, V, U, H]))).toBeLessThan(-1)
  })
})

describe("Одна вершина — концы попарно в пороге", () => {
  it("TC-5: три стены с общим концом — плоские торцы в вершине", () => {
    const a = W("a", 0, 0, 100, 0)
    const b = W("b", 0, 0, 0, 80)
    const c = W("c", 0, 0, -80, 0)
    const walls = [a, b, c]
    const pa = displayPolygons(a, walls)
    const pb = displayPolygons(b, walls)
    const pc = displayPolygons(c, walls)
    expect(minX(pa)).toBe(0)
    expect(hasVertex(pa, { x: 0, y: 10 }) && hasVertex(pa, { x: 0, y: -10 })).toBe(true)
    expect(minY(pb)).toBe(0)
    expect(hasVertex(pb, { x: 10, y: 0 }) && hasVertex(pb, { x: -10, y: 0 })).toBe(true)
    expect(maxX(pc)).toBe(0)
    expect(hasVertex(pc, { x: 0, y: 10 }) && hasVertex(pc, { x: 0, y: -10 })).toBe(true)
  })

  it("TC-6: попарное расстояние ровно равно порогу (10) — торец H плоский", () => {
    const H = W("H", 0, 0, 200, 0)
    const V = W("V", 0, 5, 0, 100)
    const U = W("U", 0, -5, 0, -100)
    const h = displayPolygons(H, [V, U, H])
    expect(minX(h)).toBe(0)
  })

  it("TC-7: попарное расстояние чуть больше порога (10.01) — стык с ранней V, H до дальней грани V", () => {
    const H = W("H", 0, 0, 200, 0)
    const V = W("V", 0, 5, 0, 100)
    const U = W("U", 0, -5.01, 0, -100)
    const h = displayPolygons(H, [V, U, H])
    expect(minX(h)).toBe(-10)
    expect(inPolys({ x: -5, y: 0 }, h)).toBe(true)
  })
})

describe("Ранняя соседняя почти коллинеарна", () => {
  it("TC-8: непопарный набор, ранняя под 5° к продолжению — торец H плоский", () => {
    const H = W("H", 0, 0, 200, 0)
    const V = W("V", -200, 10 - 200 * Math.tan((5 * Math.PI) / 180), 0, 10)
    const U = W("U", 0, -10, 0, -100)
    const h = displayPolygons(H, [V, U, H])
    expect(minX(h)).toBe(0)
    expect(hasVertex(h, { x: 0, y: -10 })).toBe(true)
    // тело ранней V вычитается из H: точка в теле V не принадлежит H
    expect(inPolys({ x: 0.3, y: 0.5 }, displayPolygons(V, [V, U, H]))).toBe(true)
    expect(inPolys({ x: 0.3, y: 0.5 }, h)).toBe(false)
  })
})

describe("Каноническая форма у узла цепочки", () => {
  it("TC-9: попадание курсора в бывшую выемку (105, 200) — стена H", () => {
    const { V, H, U } = chain()
    expect(hitWall({ x: 105, y: 200 }, [V, H, U], 0)?.id).toBe("H")
  })

  it("TC-10: превью U (не в массиве) совпадает с зафиксированной U", () => {
    const { V, H, U } = chain()
    expect(sortedPts(displayPolygons(U, [V, H]))).toEqual(sortedPts(displayPolygons(U, [V, H, U])))
  })
})
