import { describe, expect, it } from "vitest"
import { contourSegments, displayPolygons, hitWall } from "./wall-geometry"
import { dot, len, sub, unitOf, userWalls, byId, wall } from "./move-joints.test-utils"
import { moveWalls } from "./geometry"
import type { Material, Point, Wall } from "./types"

// change fix-wall-move-joints, wall-joints «Почти коллинеарный стык» (design D3).
// Эталон: торцы обеих стен лежат на биссектрисе угла между осями через вершину стыка
// (конец ранней стены); формы — полосы граней своих стен по свою сторону биссектрисы.

const H = 10
const rad = (deg: number): number => (deg * Math.PI) / 180

function inPoly(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y
    const yj = poly[j].y
    if (yi > p.y !== yj > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - yi)) / (yj - yi) + poly[i].x) inside = !inside
  }
  return inside
}

const owners = (p: Point, scene: Wall[]): Wall[] => scene.filter((w) => displayPolygons(w, scene).some((pc) => inPoly(p, pc)))
const points = (w: Wall, scene: Wall[]): Point[] => displayPolygons(w, scene).flat()

interface Joint {
  A: Wall // ранняя, уходит от вершины влево
  B: Wall // поздняя
  V: Point // вершина стыка
  uA: Point // направление тела A от вершины
  uB: Point // направление тела B от её конца
  nCut: Point // нормаль биссектрисы, в сторону тела B
}

// A (−200,0)–(0,0); B начинается в (start, 0) и отклонена от коллинеарного продолжения на θ
function joint(deg: number, start = 0, typeA: Material = "brick", typeB: Material = "brick"): Joint {
  const t = rad(deg)
  const A = wall(-200, 0, 0, 0, "A", 20, typeA)
  const B = wall(start, 0, start + 200 * Math.cos(t), 200 * Math.sin(t), "B", 20, typeB)
  const uA = { x: -1, y: 0 }
  const uB = { x: Math.cos(t), y: Math.sin(t) }
  return { A, B, V: { x: 0, y: 0 }, uA, uB, nCut: unitOf(sub(uB, uA)) }
}

const lat = (p: Point, o: Point, u: Point): number => dot(sub(p, o), { x: -u.y, y: u.x })
const along = (p: Point, o: Point, u: Point): number => dot(sub(p, o), u)

// эталонный владелец точки у вершины: полоса своей стены по свою сторону биссектрисы
function expectedOwner(j: Joint, p: Point): "A" | "B" | null {
  const side = dot(sub(p, j.V), j.nCut)
  if (side < 0 && Math.abs(lat(p, j.A.a, { x: 1, y: 0 })) <= H) return "A"
  if (side > 0 && Math.abs(lat(p, j.B.a, j.uB)) <= H) return "B"
  return null
}

const nearBoundary = (j: Joint, p: Point): boolean =>
  Math.abs(dot(sub(p, j.V), j.nCut)) < 0.05 ||
  Math.abs(Math.abs(lat(p, j.A.a, { x: 1, y: 0 })) - H) < 0.05 ||
  Math.abs(Math.abs(lat(p, j.B.a, j.uB)) - H) < 0.05

function probes(center: Point, r: number): Point[] {
  const out: Point[] = []
  for (let x = -r; x <= r; x += 0.5)
    for (let y = -r; y <= r; y += 0.5) {
      const p = { x: center.x + x + 0.013, y: center.y + y + 0.007 }
      if (len(sub(p, center)) <= r) out.push(p)
    }
  return out
}

// мелкие пробы вдоль шва: по обе стороны биссектрисы на 0.06…0.15 см, по всей ширине стен —
// ловят щели и наложения шириной в доли миллиметра у углов торцов
function seamProbes(j: Joint): Point[] {
  const t = { x: -j.nCut.y, y: j.nCut.x }
  const out: Point[] = []
  for (let s = -12; s <= 12; s += 0.1)
    for (const k of [-0.15, -0.1, -0.06, 0.06, 0.1, 0.15])
      out.push({ x: j.V.x + t.x * s + j.nCut.x * k + 1e-4, y: j.V.y + t.y * s + j.nCut.y * k + 2e-4 })
  return out
}

function expectNoGapNoOverlap(j: Joint, scene: Wall[]): void {
  const polys = scene.map((w) => ({ id: w.id, pcs: displayPolygons(w, scene) }))
  const got = (p: Point): string[] => polys.filter(({ pcs }) => pcs.some((pc) => inPoly(p, pc))).map(({ id }) => id)
  for (const p of [...probes(j.V, 15), ...seamProbes(j)]) {
    if (Math.abs(dot(sub(p, j.V), j.nCut)) < 0.05) continue
    if (Math.abs(Math.abs(lat(p, j.A.a, { x: 1, y: 0 })) - H) < 0.05) continue
    if (Math.abs(Math.abs(lat(p, j.B.a, j.uB)) - H) < 0.05) continue
    const exp = expectedOwner(j, p)
    expect(got(p), `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`).toEqual(exp ? [exp] : [])
  }
}

function expectBisector(j: Joint, scene: Wall[]): void {
  for (const p of points(j.A, scene)) expect(dot(sub(p, j.V), j.nCut)).toBeLessThanOrEqual(1e-6)
  for (const p of points(j.B, scene)) expect(dot(sub(p, j.V), j.nCut)).toBeGreaterThanOrEqual(-1e-6)
}

const maxBeyond = (w: Wall, scene: Wall[], V: Point, uIn: Point): number =>
  Math.max(...points(w, scene).map((p) => -along(p, V, uIn)))

describe("Почти коллинеарный стык: торцы по биссектрисе", () => {
  it("NC-1: 2.4° — ни одна точка не выступает за вершину дальше полутолщины (шипа нет)", () => {
    const j = joint(2.4)
    const scene = [j.A, j.B]
    expect(maxBeyond(j.A, scene, j.V, j.uA)).toBeLessThanOrEqual(H + 1e-6)
    expect(maxBeyond(j.B, scene, j.V, j.uB)).toBeLessThanOrEqual(H + 1e-6)
  })

  it("NC-2: 2.4° — обе стены по свою сторону биссектрисы и доведены до неё", () => {
    const j = joint(2.4)
    const scene = [j.A, j.B]
    expectBisector(j, scene)
    const k = H * Math.tan(rad(2.4) / 2)
    expect(maxBeyond(j.A, scene, j.V, j.uA)).toBeCloseTo(k, 6)
    expect(maxBeyond(j.B, scene, j.V, j.uB)).toBeCloseTo(k, 6)
  })

  it("NC-3: 2.4° — у вершины нет щелей и наложений, при любом порядке стен", () => {
    const j = joint(2.4)
    expectNoGapNoOverlap(j, [j.A, j.B])
    expectNoGapNoOverlap(j, [j.B, j.A])
  })

  it("NC-4: 0.3° (в допуске коллинеарности) — прямоугольники, торцы в вершине", () => {
    const j = joint(0.3)
    const scene = [j.A, j.B]
    expect(maxBeyond(j.A, scene, j.V, j.uA)).toBeLessThanOrEqual(1e-6)
    expect(maxBeyond(j.B, scene, j.V, j.uB)).toBeLessThanOrEqual(1e-6)
  })

  it("NC-4b: 0.7° (за допуском коллинеарности) — торцы по биссектрисе", () => {
    const j = joint(0.7)
    const scene = [j.A, j.B]
    expectBisector(j, scene)
    expect(maxBeyond(j.A, scene, j.V, j.uA)).toBeCloseTo(H * Math.tan(rad(0.35)), 6)
  })

  it("NC-5: 14.9° — биссектриса; ровно 15°, 15.1° и 20° — прежнее правило, ранняя стена прямоугольником", () => {
    const j149 = joint(14.9)
    const s149 = [j149.A, j149.B]
    expectBisector(j149, s149)
    expect(maxBeyond(j149.A, s149, j149.V, j149.uA)).toBeCloseTo(H * Math.tan(rad(7.45)), 6)
    for (const deg of [15, 15.1, 20]) {
      const j = joint(deg)
      expect(maxBeyond(j.A, [j.A, j.B], j.V, j.uA)).toBeLessThanOrEqual(1e-6)
    }
  })

  it("NC-6: поздняя начинается на полтолщины за концом ранней и повёрнута на 5° — биссектриса через конец ранней", () => {
    const j = joint(5, 10)
    const scene = [j.A, j.B]
    expectBisector(j, scene)
    expect(Math.min(...points(j.B, scene).map((p) => dot(sub(p, j.V), j.nCut)))).toBeCloseTo(0, 6)
    expect(maxBeyond(j.A, scene, j.V, j.uA)).toBeCloseTo(H * Math.tan(rad(2.5)), 6)
    expectNoGapNoOverlap(j, scene)
  })

  it("NC-7: один материал — внутри стыка нет линий контура", () => {
    const j = joint(2.4)
    const scene = [j.A, j.B]
    for (const w of scene)
      for (const s of contourSegments(w, scene))
        for (let i = 0; i <= 20; i++) {
          const p = { x: s.p1.x + ((s.p2.x - s.p1.x) * i) / 20, y: s.p1.y + ((s.p2.y - s.p1.y) * i) / 20 }
          const inside =
            len(p) < 15 && Math.abs(lat(p, j.A.a, { x: 1, y: 0 })) < H - 0.1 && Math.abs(lat(p, j.B.a, j.uB)) < H - 0.1
          expect(inside, `${w.id}: (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`).toBe(false)
        }
  })

  it("NC-8: разные материалы — шов отображается отрезком по биссектрисе на всю ширину", () => {
    const j = joint(2.4, 0, "brick", "concrete")
    const scene = [j.A, j.B]
    const onCut = (p: Point): boolean => Math.abs(dot(sub(p, j.V), j.nCut)) < 1e-6
    const seam = scene
      .flatMap((w) => contourSegments(w, scene))
      .filter((s) => onCut(s.p1) && onCut(s.p2))
      .reduce((acc, s) => acc + len(sub(s.p2, s.p1)), 0)
    expect(seam).toBeGreaterThanOrEqual(19.99)
  })

  it("NC-9: попадание и подсветка не переходят биссектрису", () => {
    const j = joint(2.4)
    const scene = [j.A, j.B]
    const pB = { x: 0.5 * j.nCut.x, y: 0.5 * j.nCut.y }
    const pA = { x: -0.5 * j.nCut.x, y: -0.5 * j.nCut.y }
    expect(hitWall(pB, scene, 0.1)).toBe(j.B)
    expect(hitWall(pA, scene, 0.1)).toBe(j.A)
    // подсветка ранней — её форма, без точек по ту сторону биссектрисы
    for (const p of points(j.A, scene)) expect(dot(p, j.nCut)).toBeLessThanOrEqual(1e-6)
  })

  it("NC-10: порядок стен в массиве не меняет объединения форм", () => {
    const j = joint(6)
    const ab = [j.A, j.B]
    const ba = [j.B, j.A]
    for (const p of probes(j.V, 15)) {
      if (nearBoundary(j, p)) continue
      expect(owners(p, ab).length > 0).toBe(owners(p, ba).length > 0)
    }
  })

  it("NC-11: третий конец в вершине — плоские торцы, биссектриса не применяется", () => {
    const j = joint(2.4)
    const C = wall(0, 0, 0, -200, "C")
    const scene = [j.A, j.B, C]
    expect(maxBeyond(j.A, scene, j.V, j.uA)).toBeLessThanOrEqual(1e-6)
    expect(maxBeyond(j.B, scene, j.V, j.uB)).toBeLessThanOrEqual(1e-6)
  })

  it("NC-15: разные толщины (20 и 10 см), 2.4° — каждая стена в полосе своих граней, вынос по своей полутолщине", () => {
    const t = rad(2.4)
    const A = wall(-200, 0, 0, 0, "A", 20)
    const B = wall(0, 0, 200 * Math.cos(t), 200 * Math.sin(t), "B", 10)
    const scene = [A, B]
    const uB = { x: Math.cos(t), y: Math.sin(t) }
    const V = { x: 0, y: 0 }
    for (const p of points(A, scene)) expect(Math.abs(lat(p, A.a, { x: 1, y: 0 }))).toBeLessThanOrEqual(10 + 1e-6)
    for (const p of points(B, scene)) expect(Math.abs(lat(p, B.a, uB))).toBeLessThanOrEqual(5 + 1e-6)
    expect(maxBeyond(B, scene, V, uB)).toBeCloseTo(5 * Math.tan(t / 2), 6)
    expect(maxBeyond(A, scene, V, { x: -1, y: 0 })).toBeCloseTo(10 * Math.tan(t / 2), 6)
  })

  it("NC-13: разворот «шпилькой» (стены уходят от общего конца почти в одну сторону) — биссектриса не применяется", () => {
    const t = rad(3)
    const A = wall(-200, 0, 0, 0, "A")
    const B = wall(0, 0, -200 * Math.cos(t), 200 * Math.sin(t), "B")
    expect(maxBeyond(A, [A, B], { x: 0, y: 0 }, { x: -1, y: 0 })).toBeLessThanOrEqual(1e-6)
  })

  it("NC-14: почти коллинеарные стены без общего конца (концы в 12 см > полутолщины) — правило не применяется", () => {
    const t = rad(2.4)
    const A = wall(-200, 0, 0, 0, "A")
    const B = wall(12, 0, 12 + 200 * Math.cos(t), 200 * Math.sin(t), "B")
    const scene = [A, B]
    expect(maxBeyond(A, scene, { x: 0, y: 0 }, { x: -1, y: 0 })).toBeLessThanOrEqual(1e-6)
    expect(maxBeyond(B, scene, B.a, { x: Math.cos(t), y: Math.sin(t) })).toBeLessThanOrEqual(1e-6)
  })

  it("NC-12: построение формы не изменяет данные стен", () => {
    const j = joint(2.4)
    const scene = [j.A, j.B]
    const snapshot = JSON.parse(JSON.stringify(scene)) as Wall[]
    displayPolygons(j.A, scene)
    displayPolygons(j.B, scene)
    contourSegments(j.A, scene)
    expect(scene).toEqual(snapshot)
  })
})

describe("регрессия: шип после перемещения верхней стены чертежа пользователя", () => {
  it("REG-3: продолжение 32488 и повернувшаяся 5912b не выступают за вершину (910, 320) дальше 10 см", () => {
    const walls = userWalls()
    moveWalls(walls, [byId(walls, "b9433dfb")], { x: 10, y: 0 })
    const R = byId(walls, "5912b043")
    const R2 = byId(walls, "32488b56")
    const V = { x: 910, y: 320 }
    expect(R.b).toEqual(V)
    expect(maxBeyond(R2, walls, V, unitOf(sub(R2.b, R2.a)))).toBeLessThanOrEqual(H + 1e-6)
    expect(maxBeyond(R, walls, V, unitOf(sub(R.a, R.b)))).toBeLessThanOrEqual(H + 1e-6)
  })
})
