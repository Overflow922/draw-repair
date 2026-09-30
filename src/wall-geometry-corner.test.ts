import { describe, expect, it } from "vitest"
import { contourSegments, displayPolygons, hitWall } from "./wall-geometry"
import { moveWalls } from "./geometry"
import type { Material, Point, Wall } from "./types"

// change corner-joint-face-caps: замыкание углового стыка по граням после поворота стены.
// Эталон «закрытого угла» (test-plan.md, Scope) задаётся независимо от реализации
// через полосы граней, сырые торцы и целевые линии граней.

let seq = 0
const W = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Material = "brick"): Wall => ({
  id: `c${++seq}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

type End = "a" | "b"

const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y })
const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y
const cross = (p: Point, q: Point): number => p.x * q.y - p.y * q.x

interface Frame {
  o: Point
  u: Point
  n: Point
  len: number
  h: number
}

function frame(w: Wall): Frame {
  const d = sub(w.b, w.a)
  const len = Math.hypot(d.x, d.y)
  const u = { x: d.x / len, y: d.y / len }
  return { o: w.a, u, n: { x: -u.y, y: u.x }, len, h: w.thicknessCm / 2 }
}

const lat = (p: Point, f: Frame): number => dot(sub(p, f.o), f.n)
const alg = (p: Point, f: Frame): number => dot(sub(p, f.o), f.u)
const inStrip = (p: Point, f: Frame, e: number): boolean => Math.abs(lat(p, f)) <= f.h + e
const inRaw = (p: Point, f: Frame, e: number): boolean => inStrip(p, f, e) && alg(p, f) >= -e && alg(p, f) <= f.len + e
// за сырым торцом конца end (наружу от тела)
const beyondCap = (p: Point, f: Frame, end: End, e: number): boolean => (end === "a" ? alg(p, f) <= e : alg(p, f) >= f.len - e)
const sign = (v: number): number => (v > 0 ? 1 : -1)
const otherEnd = (end: End): End => (end === "a" ? "b" : "a")

// Эталон стыка двух стен: у каждой стены своё тело (у сквозной срезанное) и своё продолжение
// торца до целевой линии. Владелец точки: формы обеих стен — ранняя (наложение),
// иначе стена, чьей форме точка принадлежит; иначе никто.
interface Parts {
  a: Wall
  b: Wall
  rawA: (p: Point, e: number) => boolean
  rawB: (p: Point, e: number) => boolean
  extA: (p: Point, e: number) => boolean
  extB: (p: Point, e: number) => boolean
}

const never = (): boolean => false

// угловой стык на грани: S — сквозная (конец sEnd), U — упёртая (конец uEnd).
// Тело S срезано по линии наружной грани U; продолжения торцов — до своих целевых линий
function faceParts(S: Wall, sEnd: End, U: Wall, uEnd: End): Parts {
  const fS = frame(S)
  const fU = frame(U)
  const inS = sEnd === "a" ? fS.u : { x: -fS.u.x, y: -fS.u.y } // тело S уходит от торца
  const inU = uEnd === "a" ? fU.u : { x: -fU.u.x, y: -fU.u.y }
  const sO = -sign(dot(fU.n, inS)) // наружная грань U — обращена от тела S
  const sI = sign(dot(fS.n, inU)) // внутренняя грань S — обращена к телу U
  const insideOuterU = (p: Point, e: number): boolean => lat(p, fU) * sO <= fU.h + e
  return {
    a: S,
    b: U,
    rawA: (p, e) => inRaw(p, fS, e) && insideOuterU(p, e),
    rawB: (p, e) => inRaw(p, fU, e),
    extA: (p, e) => inStrip(p, fS, e) && beyondCap(p, fS, sEnd, e) && insideOuterU(p, e),
    extB: (p, e) => inStrip(p, fU, e) && beyondCap(p, fU, uEnd, e) && lat(p, fS) * sI >= fS.h - e,
  }
}

// знак наружной грани U относительно её оси (грань обращена от тела S, торец S — конец a)
const outerSign = (S: Wall, U: Wall): number => -sign(dot(frame(U).n, frame(S).u))

// общая вершина осей: поздняя доведена каждым углом до линии дальней грани ранней
function vertexParts(early: Wall, late: Wall, lEnd: End): Parts {
  const fE = frame(early)
  const fL = frame(late)
  const sFar = -sign(lat(late[otherEnd(lEnd)], fE))
  return {
    a: early,
    b: late,
    rawA: (p, e) => inRaw(p, fE, e),
    // тело поздней за дальней гранью ранней не отображается (торец целиком на её линии)
    rawB: (p, e) => inRaw(p, fL, e) && lat(p, fE) * sFar <= fE.h + e,
    extA: never,
    extB: (p, e) => inStrip(p, fL, e) && beyondCap(p, fL, lEnd, e) && lat(p, fE) * sFar <= fE.h + e,
  }
}

const inA = (parts: Parts, p: Point, e: number): boolean => parts.rawA(p, e) || parts.extA(p, e)
const inB = (parts: Parts, p: Point, e: number): boolean => parts.rawB(p, e) || parts.extB(p, e)

function expectedOwner(parts: Parts, scene: Wall[], p: Point): Wall | null {
  const earlier = scene.indexOf(parts.a) < scene.indexOf(parts.b) ? parts.a : parts.b
  const a = inA(parts, p, 0)
  const b = inB(parts, p, 0)
  if (a && b) return earlier
  if (a) return parts.a
  return b ? parts.b : null
}

// точка далеко от всех границ эталона: принадлежность не меняется при сдвиге границ на ±MARGIN
const stable = (parts: Parts, p: Point): boolean =>
  [parts.rawA, parts.rawB, parts.extA, parts.extB].every((f) => f(p, -MARGIN) === f(p, MARGIN))
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

const polysOf = (scene: Wall[]): Map<Wall, Point[][]> => new Map(scene.map((w) => [w, displayPolygons(w, scene)]))
const owners = (p: Point, polys: Map<Wall, Point[][]>): Wall[] =>
  [...polys].filter(([, ps]) => ps.some((pp) => inPoly(p, pp))).map(([w]) => w)

const MARGIN = 0.05
const OFFSET = 0.0137 // сдвиг сетки: точки выборки не попадают на осевые швы

function* grid(center: Point, half: number, step: number): Generator<Point> {
  for (let x = center.x - half + OFFSET; x <= center.x + half; x += step)
    for (let y = center.y - half + OFFSET; y <= center.y + half; y += step) yield { x, y }
}

// выборка вокруг стыка: точка покрыта ровно ожидаемым владельцем (или никем вне эталона);
// кусков в точке не больше одного (нет двойной заливки/штриховки)
function jointErrors(scene: Wall[], parts: Parts, center: Point, half = 25, step = 0.25): string[] {
  const polys = polysOf(scene)
  const errors: string[] = []
  for (const p of grid(center, half, step)) {
    if (!stable(parts, p)) continue
    const expected = expectedOwner(parts, scene, p)
    let pieces = 0
    const got: Wall[] = []
    for (const [w, ps] of polys) {
      const k = ps.filter((pp) => inPoly(p, pp)).length
      pieces += k
      if (k) got.push(w)
    }
    const ok = expected ? got.length === 1 && got[0] === expected && pieces === 1 : got.length === 0
    if (!ok)
      errors.push(
        `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}): покрыто [${got.map((w) => w.id).join(",")}], кусков ${pieces}, ожидалось ${expected?.id ?? "—"}`,
      )
  }
  return errors
}

// точки, лежащие только в заливке угла (не в теле ни одной стены)
function extOnlyPoints(parts: Parts, center: Point, half = 25, step = 0.25): Point[] {
  return [...grid(center, half, step)].filter(
    (p) => (parts.extA(p, -MARGIN) || parts.extB(p, -MARGIN)) && !parts.rawA(p, MARGIN) && !parts.rawB(p, MARGIN),
  )
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6
const sortedPts = (polys: Point[][]): number[][] =>
  polys.flatMap((poly) => poly.map((p) => [round(p.x), round(p.y)])).sort((p, q) => p[0] - q[0] || p[1] - q[1])

function rawCorners(w: Wall): number[][] {
  const f = frame(w)
  const off = { x: f.n.x * f.h, y: f.n.y * f.h }
  return sortedPts([
    [
      { x: w.a.x + off.x, y: w.a.y + off.y },
      { x: w.b.x + off.x, y: w.b.y + off.y },
      { x: w.b.x - off.x, y: w.b.y - off.y },
      { x: w.a.x - off.x, y: w.a.y - off.y },
    ],
  ])
}

// ранняя стена отображается ровно своим прямоугольником
function expectRaw(w: Wall, scene: Wall[]): void {
  const polys = displayPolygons(w, scene)
  expect(polys).toHaveLength(1)
  expect(sortedPts(polys)).toEqual(rawCorners(w))
}

function polyArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) s += cross(poly[i], poly[(i + 1) % poly.length])
  return Math.abs(s) / 2
}

// поздняя стена без доращиваний: куски (вычитание может резать прямоугольник) лежат
// в её сыром прямоугольнике и вместе покрывают его целиком
function expectCoversRaw(w: Wall, scene: Wall[]): void {
  const f = frame(w)
  const polys = displayPolygons(w, scene)
  for (const v of polys.flat()) expect(inRaw(v, f, 1e-6)).toBe(true)
  expect(polys.reduce((acc, p) => acc + polyArea(p), 0)).toBeCloseTo(f.len * w.thicknessCm, 6)
}

// суммарная длина отрезков контура на прямой (origin, dir) в интервале параметра [lo, hi]
function coveredOnLine(segs: { p1: Point; p2: Point }[], origin: Point, dir: Point, lo: number, hi: number): number {
  const ivs: [number, number][] = []
  for (const { p1, p2 } of segs) {
    if (Math.abs(cross(dir, sub(p1, origin))) > 1e-6 || Math.abs(cross(dir, sub(p2, origin))) > 1e-6) continue
    const t1 = dot(sub(p1, origin), dir)
    const t2 = dot(sub(p2, origin), dir)
    const a = Math.max(lo, Math.min(t1, t2))
    const b = Math.min(hi, Math.max(t1, t2))
    if (b > a) ivs.push([a, b])
  }
  ivs.sort((x, y) => x[0] - y[0])
  let total = 0
  let cursor = -Infinity
  for (const [a, b] of ivs) {
    const from = Math.max(a, cursor)
    if (b > from) total += b - from
    cursor = Math.max(cursor, b)
  }
  return total
}

// Базовый угловой стык на грани: сквозная S = (0,0)-(200,0), упёртая U = (10,10)-(10,200),
// конец U на верхней грани S в 10 от торца; концы осей на диагонали угла 10√2.
// R+: S повернута к (200,60) — снаружи выемка у нижнего угла торца S, верхний угол выступает за x = 0.
// R−: S повернута к (200,−60) — просвет под торцом U, выемка у верхнего угла торца S, нижний выступает.
const rPlus = (): { S: Wall; U: Wall } => ({ S: W(0, 0, 200, 60), U: W(10, 10, 10, 200) })
const rMinus = (): { S: Wall; U: Wall } => ({ S: W(0, 0, 200, -60), U: W(10, 10, 10, 200) })

const ORIGIN: Point = { x: 0, y: 0 }

describe("Замыкание углового стыка на грани: прямой угол", () => {
  it("CJ-1: прямой угол не меняется — оба прямоугольника ровно как нарисованы, в обоих порядках", () => {
    const S = W(0, 0, 200, 0)
    const U = W(10, 10, 10, 200)
    const stray = W(500, 500, 500, 500) // вырожденная стена в сцене не мешает
    // ранняя — ровно свой прямоугольник, поздняя покрывает ровно свой
    expect(sortedPts(displayPolygons(S, [S, U, stray]))).toEqual([
      [0, -10],
      [0, 10],
      [200, -10],
      [200, 10],
    ])
    expectCoversRaw(U, [S, U, stray])
    expect(sortedPts(displayPolygons(U, [U, S, stray]))).toEqual([
      [0, 10],
      [0, 200],
      [20, 10],
      [20, 200],
    ])
    expectCoversRaw(S, [U, S, stray])
  })

  it.each([0.3, 0.4])("CJ-14: наклон %s° в пределах допуска прямого угла — прямоугольники без доращиваний", (deg) => {
    const S = W(0, 0, 200, -200 * Math.tan((deg * Math.PI) / 180))
    const U = W(10, 10, 10, 200)
    expectRaw(S, [S, U])
    expectCoversRaw(U, [S, U])
    expectRaw(U, [U, S])
    expectCoversRaw(S, [U, S])
  })
})

describe("Замыкание углового стыка на грани: сразу за допуском прямого угла", () => {
  // сразу за границей 0.5° (0.6°) и при типичном малом переносе (1.5°); площади аналитические,
  // без малых треугольников ~2e-4 см² у торца, которые поглощает допуск 0.05
  it.each([0.6, 1.5])("CJ-14b: поворот %s° — срез и продолжения уже работают (площади)", (deg) => {
    const a = (deg * Math.PI) / 180
    const S = W(0, 0, 200, -200 * Math.tan(a))
    const U = W(10, 10, 10, 200)
    const area = (w: Wall, scene: Wall[]): number => displayPolygons(w, scene).reduce((acc, p) => acc + polyArea(p), 0)
    const sRaw = 20 * (200 / Math.cos(a))
    const uRaw = 20 * 190
    // треугольники у торца S: срезаемый зуб и своё продолжение — оба 50·tan a
    const tri = 50 * Math.tan(a)
    // продолжение U: между y = 10, гранью x = 20 и верхней гранью S
    const x0 = 10 * Math.tan(a / 2)
    const y20 = (10 - 20 * Math.sin(a)) / Math.cos(a)
    const uExt = 0.5 * (20 - x0) * (10 - y20)
    // каждая стена — своё тело с продолжением при любом порядке
    // (наложения тел в зоне стыка ~2e-4 см² поглощает допуск 0.05)
    for (const scene of [[S, U], [U, S]]) {
      expect(area(S, scene)).toBeCloseTo(sRaw - tri + tri, 1)
      expect(area(U, scene)).toBeCloseTo(uRaw + uExt, 1)
    }
    // S без продолжения была бы на tri меньше: проверяем, что зуб срезан, а продолжение есть
    const v = displayPolygons(S, [S, U]).flat()
    // наружный угол — пересечение наружных граней: вершина (0, −10/cos a) у S
    expect(v.some((q) => Math.abs(q.x) < 1e-6 && Math.abs(q.y + 10 / Math.cos(a)) < 1e-6)).toBe(true)
    // продолжение S до x = 0 по её внутренней грани: вершина (0, 10/cos a)
    expect(v.some((q) => Math.abs(q.x) < 1e-6 && Math.abs(q.y - 10 / Math.cos(a)) < 1e-6)).toBe(true)
  })
})

describe("Замыкание углового стыка на грани: сквозная повернулась", () => {
  it("CJ-2: R+ — выемка снаружи у угла торца сквозной закрыта продолжением сквозной, при любом порядке", () => {
    const { S, U } = rPlus()
    const notch = { x: 0.8, y: -6 } // между сырым торцом S, её нижней гранью и линией x = 0
    for (const scene of [[S, U], [U, S]]) {
      expect(owners(notch, polysOf(scene))).toEqual([S])
      expect(hitWall(notch, scene, 0.1)).toBe(S)
    }
  })

  it("CJ-3: R− — просвет внутри угла под торцом упёртой закрыт продолжением упёртой, при любом порядке", () => {
    const { S, U } = rMinus()
    const gap = { x: 15, y: 8 } // под торцом U, над линией внутренней грани S
    for (const scene of [[S, U], [U, S]]) {
      expect(owners(gap, polysOf(scene))).toEqual([U])
      expect(hitWall(gap, scene, 0.1)).toBe(U)
    }
  })

  it("CJ-2/3 выборка: R+ и R− закрыты по эталону — без щелей, выступов, наложений, с верной принадлежностью, в обоих порядках", () => {
    for (const make of [rPlus, rMinus]) {
      const { S, U } = make()
      const parts = faceParts(S, "a", U, "a")
      expect(extOnlyPoints(parts, ORIGIN).length).toBeGreaterThan(20) // эталон не пуст
      expect(jointErrors([S, U], parts, ORIGIN)).toEqual([])
      expect(jointErrors([U, S], parts, ORIGIN)).toEqual([])
    }
  })

  it("CJ-12: где тело U заходит в продолжение S, ровно один кусок — у ранней из пары", () => {
    const { S, U } = rMinus()
    const p = { x: 0.3, y: 10.2 } // за сырым торцом S, в полосе S, внутри сырого тела U
    const parts = faceParts(S, "a", U, "a")
    for (const [scene, early] of [
      [[S, U], S],
      [[U, S], U],
    ] as const) {
      expect(stable(parts, p)).toBe(true)
      expect(expectedOwner(parts, [...scene], p)).toBe(early)
      const polys = polysOf([...scene])
      expect(owners(p, polys)).toEqual([early])
      const pieces = [...polys.values()].flat().filter((pp) => inPoly(p, pp)).length
      expect(pieces).toBe(1)
    }
  })

  it("CJ-4: выступающий угол торца сквозной срезан по линии наружной грани упёртой при любом порядке", () => {
    for (const make of [rPlus, rMinus]) {
      const { S, U } = make()
      const fS = frame(S)
      const fU = frame(U)
      const sO = outerSign(S, U)
      // точки сырого тела S за линией наружной грани U (x < 0): у S до среза, срезаны
      const tooth = [...grid(ORIGIN, 15, 0.25)].filter((p) => inRaw(p, fS, -MARGIN) && lat(p, fU) * sO > fU.h + MARGIN)
      expect(tooth.length).toBeGreaterThan(20)
      for (const scene of [[S, U], [U, S]]) {
        const polys = polysOf(scene)
        expect(tooth.filter((p) => owners(p, polys).length > 0)).toEqual([])
      }
    }
  })

  it("CJ-5: продолжение торца — у своей стены при любом порядке; тела стен в полосах своих граней", () => {
    const { S, U } = rMinus()
    const own: [Point, Wall][] = [
      [{ x: 0.8, y: 6 }, S], // продолжение S до наружной грани U
      [{ x: 15, y: 8 }, U], // продолжение U до внутренней грани S
      [{ x: 100, y: -30 }, S],
      [{ x: 10, y: 100 }, U],
    ]
    const fS = frame(S)
    const fU = frame(U)
    for (const scene of [[S, U], [U, S]]) {
      // каждая стена — в полосе своих граней; сквозная срезана по линии x = 0
      for (const v of displayPolygons(S, scene).flat()) {
        expect(inStrip(v, fS, 1e-6)).toBe(true)
        expect(v.x).toBeGreaterThanOrEqual(-1e-6)
      }
      for (const v of displayPolygons(U, scene).flat()) expect(inStrip(v, fU, 1e-6)).toBe(true)
      for (const [p, w] of own) {
        expect(owners(p, polysOf(scene))).toEqual([w])
        expect(hitWall(p, scene, 0.1)).toBe(w)
      }
    }
  })

  it("CJ-5o: посторонние стены в массиве: продолжения у своих стен, наложение — у ранней из пары", () => {
    for (const make of [rPlus, rMinus]) {
      const { S, U } = make()
      const X = W(500, 500, 700, 500) // посторонняя стена далеко от стыка
      const Y = W(500, 600, 700, 600)
      const parts = faceParts(S, "a", U, "a")
      for (const scene of [
        [S, U, X],
        [U, S, X],
        [S, X, U, Y],
        [X, U, Y, S],
      ])
        expect(jointErrors(scene, parts, ORIGIN)).toEqual([])
    }
    const { S, U } = rMinus()
    const X = W(500, 500, 700, 500)
    for (const scene of [
      [S, U, X],
      [U, S, X],
      [X, U, S],
    ]) {
      expect(hitWall({ x: 0.8, y: 6 }, scene, 0.1)).toBe(S)
      expect(hitWall({ x: 15, y: 8 }, scene, 0.1)).toBe(U)
    }
    // наложение: тело U внутри продолжения S — у ранней из пары, даже если поздняя не последняя
    expect(hitWall({ x: 0.3, y: 10.2 }, [S, U, X], 0.1)).toBe(S)
    expect(hitWall({ x: 0.3, y: 10.2 }, [U, X, S], 0.1)).toBe(U)
  })
  it("CJ-5b: упёртая с угловыми стыками на обоих концах стоит между партнёрами — наложение решается для каждой пары", () => {
    const S1 = W(0, 0, 200, -60)
    const U = W(10, 10, 10, 290)
    const S2 = W(0, 300, 200, 360) // зеркало S1 относительно y = 150
    const p1 = faceParts(S1, "a", U, "a")
    const p2 = faceParts(S2, "a", U, "b")
    for (const scene of [
      [S1, U, S2],
      [S2, U, S1],
    ]) {
      expect(jointErrors(scene, p1, ORIGIN)).toEqual([])
      expect(jointErrors(scene, p2, { x: 0, y: 300 })).toEqual([])
      // точки наложения тела U и продолжения сквозной: один кусок, у ранней из пары
      for (const [p, S] of [
        [{ x: 0.3, y: 10.2 }, S1],
        [{ x: 0.3, y: 289.8 }, S2],
      ] as const) {
        const early = scene.indexOf(S) < scene.indexOf(U) ? S : U
        const polys = polysOf(scene)
        expect(owners(p, polys)).toEqual([early])
        expect([...polys.values()].flat().filter((pp) => inPoly(p, pp)).length).toBe(1)
        expect(hitWall(p, scene, 0.1)).toBe(early)
      }
    }
  })
  it("CJ-5h: попадание в сырое тело ранней выделяет раннюю", () => {
    const { S, U } = rMinus()
    expect(hitWall({ x: 100, y: -30 }, [S, U], 0.1)).toBe(S)
    expect(hitWall({ x: 10, y: 100 }, [U, S], 0.1)).toBe(U)
  })

  it("CJ-5s: превью упёртой и сквозной даёт ту же форму, что и зафиксированная стена", () => {
    const { S, U } = rMinus()
    const previewU = { ...U, id: "" }
    expect(sortedPts(displayPolygons(previewU, [S]))).toEqual(sortedPts(displayPolygons(U, [S, U])))
    const previewS = { ...S, id: "" }
    expect(sortedPts(displayPolygons(previewS, [U]))).toEqual(sortedPts(displayPolygons(S, [U, S])))
  })

  it("CJ-6: роли не зависят от порядка — объединение областей одинаково", () => {
    for (const make of [rPlus, rMinus]) {
      const { S, U } = make()
      const fwd = polysOf([S, U])
      const rev = polysOf([U, S])
      const diff: string[] = []
      for (const p of grid(ORIGIN, 25, 0.5)) {
        const a = owners(p, fwd).length > 0
        const b = owners(p, rev).length > 0
        if (a !== b) diff.push(`(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`)
      }
      expect(diff).toEqual([])
    }
  })

  it("CJ-10: габарит — вершины в полосах граней S или U и не за линией наружной грани U", () => {
    for (const make of [rPlus, rMinus]) {
      const { S, U } = make()
      const fS = frame(S)
      const fU = frame(U)
      const sO = outerSign(S, U)
      for (const scene of [[S, U], [U, S]])
        for (const w of [S, U])
          for (const v of displayPolygons(w, scene).flat()) {
            expect(inStrip(v, fS, 1e-6) || inStrip(v, fU, 1e-6)).toBe(true)
            expect(lat(v, fU) * sO).toBeLessThanOrEqual(fU.h + 1e-6)
          }
    }
  })
})

describe("Замыкание углового стыка на грани: упёртая повернулась", () => {
  it("CJ-3b: упёртая повёрнута вокруг своего конца на грани — угол закрыт по эталону", () => {
    const S = W(0, 0, 200, 0)
    const U = W(10, 10, 60, 200)
    const parts = faceParts(S, "a", U, "a")
    expect(extOnlyPoints(parts, ORIGIN).length).toBeGreaterThan(20)
    expect(jointErrors([S, U], parts, ORIGIN)).toEqual([])
    expect(jointErrors([U, S], parts, ORIGIN)).toEqual([])
  })
})

describe("Замыкание углового стыка на грани: распознавание", () => {
  it("CJ-B1: разные толщины, концы ровно на допуске 1.25·max(h) — стык распознан и закрыт", () => {
    // S t=40 (h=20), U t=10 (h=5): допуск max(25, √(400+25)) = 25; конец U в (15, 20) от конца S
    const S = W(0, 0, 200, -60, 40)
    const U = W(15, 20, 15, 200, 10)
    const parts = faceParts(S, "a", U, "a")
    expect(extOnlyPoints(parts, ORIGIN).length).toBeGreaterThan(20)
    expect(jointErrors([S, U], parts, ORIGIN)).toEqual([])
  })

  it("CJ-B2: концы чуть дальше допуска — не угловой стык, зона замыкания не залита", () => {
    const S = W(0, 0, 200, -60, 40)
    const U = W(15.05, 20, 15.05, 200, 10) // 25.03 > 25
    const parts = faceParts(S, "a", U, "a")
    const probes = extOnlyPoints(parts, ORIGIN)
    expect(probes.length).toBeGreaterThan(20)
    const polys = polysOf([S, U])
    expect(probes.filter((p) => owners(p, polys).length > 0)).toEqual([])
  })

  it("CJ-B2b: равные толщины, конец U чуть дальше диагонали — просвет и выемка не залиты", () => {
    const S = W(0, 0, 200, -60)
    const U = W(10, 10.6, 10, 200) // √(100 + 112.36) ≈ 14.57 > 10√2
    const polys = polysOf([S, U])
    expect(owners({ x: 15, y: 8 }, polys)).toEqual([])
    expect(owners({ x: 0.8, y: 6 }, polys)).toEqual([])
  })

  it("CJ-B3: порог 15° — при 15.1° зона замыкания залита, при 14.9° нет, при любых направлениях осей", () => {
    // S вдоль x с торцом в (0,0); конец U на 0.5 над гранью S (просвет), U под углом θ к S.
    // Оси задаются в обоих направлениях: угол между осями тогда близок то к θ, то к 180° − θ
    const sceneFor = (deg: number, sRev: boolean, uRev: boolean) => {
      const t = (deg * Math.PI) / 180
      const E = { x: 9, y: 10.5 }
      const F = { x: E.x + 200 * Math.cos(t), y: E.y + 200 * Math.sin(t) }
      const S = sRev ? W(200, 0, 0, 0) : W(0, 0, 200, 0)
      const U = uRev ? W(F.x, F.y, E.x, E.y) : W(E.x, E.y, F.x, F.y)
      const parts = faceParts(S, sRev ? "b" : "a", U, uRev ? "b" : "a")
      const pts = extOnlyPoints(parts, { x: 0, y: 10 }, 40, 0.5)
      expect(pts.length).toBeGreaterThan(20)
      // точка зоны замыкания под торцом U, над гранью S
      const probe = pts.reduce((best, p) => (Math.hypot(p.x - E.x, p.y - 10.2) < Math.hypot(best.x - E.x, best.y - 10.2) ? p : best))
      return { S, U, probe }
    }
    for (const sRev of [false, true])
      for (const uRev of [false, true]) {
        const at16 = sceneFor(15.1, sRev, uRev)
        expect(owners(at16.probe, polysOf([at16.S, at16.U]))).toEqual([at16.U])
        for (const w of [at16.S, at16.U])
          for (const v of displayPolygons(w, [at16.S, at16.U]).flat()) {
            expect(Number.isFinite(v.x)).toBe(true)
            expect(Number.isFinite(v.y)).toBe(true)
          }
        const at14 = sceneFor(14.9, sRev, uRev)
        expect(owners(at14.probe, polysOf([at14.S, at14.U]))).toEqual([])
      }
  })

  it("CJ-A: острый угол 30° — торец сквозной на грани упёртой, обращённой от тела сквозной; тело сквозной не срезано", () => {
    const t = (30 * Math.PI) / 180
    const S = W(0, 0, 200, 0)
    const U = W(10, 10, 10 + 200 * Math.cos(t), 10 + 200 * Math.sin(t))
    const parts = faceParts(S, "a", U, "a")
    expect(extOnlyPoints(parts, { x: -15, y: 0 }, 35).length).toBeGreaterThan(20)
    expect(jointErrors([S, U], parts, { x: -15, y: 0 }, 35)).toEqual([])
    expect(jointErrors([U, S], parts, { x: -15, y: 0 }, 35)).toEqual([])
    for (const scene of [[S, U], [U, S]]) expect(owners({ x: 100, y: -5 }, polysOf(scene))).toEqual([S])
  })
  it("CJ-8: почти параллельные стены (10°) — не угловой стык, построение завершено, площади конечны", () => {
    const t = (10 * Math.PI) / 180
    const S = W(0, 0, 200, 0)
    const U = W(9, 10.5, 9 + 200 * Math.cos(t), 10.5 + 200 * Math.sin(t))
    const parts = faceParts(S, "a", U, "a")
    const polys = polysOf([S, U])
    const probes = extOnlyPoints(parts, { x: 0, y: 10 }, 40, 0.5)
    expect(probes.filter((p) => owners(p, polys).length > 0)).toEqual([])
    for (const w of [S, U]) {
      for (const v of displayPolygons(w, [S, U]).flat()) {
        expect(Number.isFinite(v.x)).toBe(true)
        expect(Number.isFinite(v.y)).toBe(true)
      }
      expect(contourSegments(w, [S, U]).length).toBeGreaterThan(0)
    }
  })

  it("CJ-N1: ни одна стена не упёртая — стык не угловой, обе прямоугольники", () => {
    const S = W(0, 0, -200, -60) // конец S (0,0) за концом U, конец U (10,10) за началом S; тела не пересекаются
    const U = W(10, 10, 10, 200)
    expectRaw(S, [S, U])
    expectCoversRaw(U, [S, U])
    expectRaw(U, [U, S])
    expectCoversRaw(S, [U, S])
  })

  it("CJ-N3: обе стены упёртые — стык не угловой: ранняя точно свой прямоугольник, поздняя — свой без дыр", () => {
    const S = W(0, 0, 200, 0)
    const d = { x: -0.894, y: 0.447 }
    for (const [U, clean] of [
      [W(10, 10, -150, -150), true], // проекции обоих концов внутри длины соседа
      // тупой угол ≈153°: по прежним правилам (T к грани) у поздней законен клин за торцом
      [W(10, 10, 10 + 200 * d.x, 10 + 200 * d.y), false],
    ] as const)
      for (const [early, late] of [
        [S, U],
        [U, S],
      ]) {
        const scene = [early, late]
        expectRaw(early, scene)
        const fE = frame(early)
        const fL = frame(late)
        const polys = displayPolygons(late, scene)
        if (clean) for (const v of polys.flat()) expect(inRaw(v, fL, 1e-6)).toBe(true)
        // поздняя покрывает свой прямоугольник вне тела ранней — без дыр
        const holes = [...grid(ORIGIN, 40, 0.5)].filter(
          (p) => inRaw(p, fL, -MARGIN) && !inRaw(p, fE, MARGIN) && !polys.some((pp) => inPoly(p, pp)),
        )
        expect(holes).toEqual([])
      }
  })
  it("CJ-N2: третий конец в пороге у любого из концов пары — угловой стык не строится, при любом порядке", () => {
    const { S, U } = rMinus()
    const nearS = W(5, -12, 5, -200) // конец в 13 от конца S, в 22.6 от конца U
    const nearU = W(21, 14, 200, 14) // конец в 11.7 от конца U, в 25.2 от конца S
    for (const third of [nearS, nearU])
      for (const scene of [
        [S, U, third],
        [third, S, U],
        [U, S, third],
      ]) {
        const polys = polysOf(scene)
        expect(owners({ x: 0.8, y: 6 }, polys)).toEqual([]) // выемка не залита
        expect(owners({ x: 15, y: 8 }, polys)).toEqual([]) // просвет не залит
        expect(owners({ x: -1.5, y: -6 }, polys)).toEqual([S]) // торец S не срезан
      }
  })
})
describe("Замыкание углового стыка на грани: третий конец в пределах jointTol", () => {
  // тонкие третьи стены (t = 4): конец пары лежит вне их полосы, поэтому сами по себе
  // они не меняют форму S и U — проверяется только, что угловой стык пары не строится
  const nearS = (): Wall => W(-5, -8, -5, -200, 4) // 9.4 от конца S, 23.4 от конца U
  const nearU = (): Wall => W(17, 16, 200, 16, 4) // 9.2 от конца U, 23.3 от конца S

  for (const [name, make] of [
    ["у конца сквозной", nearS],
    ["у конца упёртой", nearU],
  ] as const)
    it(`CJ-N2b: третий конец ${name} ближе jointTol — стык не строится, при любом порядке`, () => {
      const { S, U } = rMinus()
      const third = make()
      for (const scene of [
        [S, U, third],
        [third, S, U],
        [U, S, third],
      ]) {
        const sPolys = displayPolygons(S, scene)
        const uPolys = displayPolygons(U, scene)
        const inAny = (p: Point, polys: Point[][]): boolean => polys.some((pp) => inPoly(p, pp))
        expect(inAny({ x: -1.5, y: -6 }, sPolys)).toBe(true) // торец S не срезан
        for (const p of [
          { x: 0.8, y: 6 }, // выемка у торца S
          { x: 15, y: 8 }, // просвет под торцом U
        ]) {
          expect(inAny(p, sPolys)).toBe(false)
          expect(inAny(p, uPolys)).toBe(false)
        }
      }
    })
})
describe("Легаси-стыки совпадающих осей: доведение по углам торца", () => {
  it("CJ-9: ранняя повернута — торец поздней лежит на линии дальней грани без выемки и выступа", () => {
    const E = W(0, 0, 400, 60)
    const L = W(400, 60, 400, 360)
    const V = { x: 400, y: 60 }
    const parts = vertexParts(E, L, "a")
    expect(jointErrors([E, L], parts, V)).toEqual([])
    expectRaw(E, [E, L])
    // вершины поздней у дальней грани ранней лежат ровно на её линии; наружный угол — на грани x = 410
    const fE = frame(E)
    const nearJoint = displayPolygons(L, [E, L])
      .flat()
      .filter((v) => lat(v, fE) < -9.9)
    expect(nearJoint.map((v) => round(v.x))).toContain(410)
    for (const v of nearJoint) expect(lat(v, fE)).toBeCloseTo(-10, 6)
  })

  it("CJ-9b: поздняя повернута — оба угла её торца на дальней грани ранней", () => {
    const E = W(0, 0, 400, 0)
    const L = W(400, 0, 430, 300)
    const parts = vertexParts(E, L, "a")
    expect(jointErrors([E, L], parts, { x: 400, y: 0 })).toEqual([])
    expectRaw(E, [E, L])
    const near = displayPolygons(L, [E, L])
      .flat()
      .filter((v) => v.y < -9)
    expect(near.length).toBeGreaterThanOrEqual(2)
    for (const v of near) expect(v.y).toBeCloseTo(-10, 6)
  })

  // концы ближе jointTol, но не совпадают: это вершина стыка (легаси), а не угловой стык на грани
  it.each([
    [6, "≈8.49"],
    [7, "≈9.90, у границы jointTol"],
  ])("CJ-9n: непрямой угол, концы в %s (d %s) — правила общей вершины, в обоих порядках", (k) => {
    const S = W(0, 0, 200, -60)
    const U = W(k, k, k, 200)
    for (const [early, late] of [
      [S, U],
      [U, S],
    ]) {
      const scene = [early, late]
      expect(jointErrors(scene, vertexParts(early, late, "a"), ORIGIN)).toEqual([])
      expectRaw(early, scene)
    }
  })

  it("CJ-9m: разные толщины, концы ближе jointTol = max(t)/2 — правила общей вершины, в обоих порядках", () => {
    const S = W(0, 0, 200, -60, 10)
    const U = W(3.8, 3.8, 3.8, 200, 20) // d ≈ 5.37: больше min(h) = 5, меньше jointTol = 10
    for (const [early, late] of [
      [S, U],
      [U, S],
    ]) {
      const scene = [early, late]
      expect(jointErrors(scene, vertexParts(early, late, "a"), ORIGIN)).toEqual([])
      expectRaw(early, scene)
    }
  })

  // выступающий угол торца поздней срезается по дальней грани ранней, а не только недоходящий доращивается
  it.each([
    ["t 10 / 40, 45°", W(0, 0, 400, 0, 10), 400, 0, 40],
    ["t 20 / 20, 45°, конец в 6 от вершины", W(0, 0, 400, 0, 20), 400, -6, 20],
  ] as const)("CJ-9p: общая вершина (%s) — торец поздней не выступает за дальнюю грань ранней", (_, E, lx, ly, lt) => {
    const d = Math.SQRT1_2
    const L = W(lx, ly, lx + 200 * d, ly + 200 * d, lt)
    const scene = [E, L]
    expectRaw(E, scene)
    const fE = frame(E)
    const vs = displayPolygons(L, scene).flat()
    for (const v of vs) expect(lat(v, fE)).toBeGreaterThanOrEqual(-fE.h - 1e-6) // дальняя грань — со стороны против тела L
    expect(vs.some((v) => Math.abs(lat(v, fE) + fE.h) < 1e-6)).toBe(true)
  })
  // поздняя приходит к вершине концом b (например, замыкающая стена цепочки)
  describe("CJ-9e: поздняя стена приходит к вершине концом b", () => {
    const check = (E: Wall, L: Wall, V: Point): void => {
      const scene = [E, L]
      expectRaw(E, scene)
      expect(jointErrors(scene, vertexParts(E, L, "b"), V)).toEqual([])
      const fE = frame(E)
      const sFar = -sign(lat(L.a, fE)) // дальняя грань ранней — против тела поздней
      const vs = displayPolygons(L, scene).flat()
      for (const v of vs) expect(lat(v, fE) * sFar).toBeLessThanOrEqual(fE.h + 1e-6)
      expect(vs.filter((v) => Math.abs(lat(v, fE) * sFar - fE.h) < 1e-6).length).toBeGreaterThanOrEqual(2)
    }

    it("CJ-9e: прямой угол — торец поздней на дальней грани ранней", () => {
      check(W(0, 0, 100, 0), W(100, -100, 100, 0), { x: 100, y: 0 })
    })

    it("CJ-9e: поздняя повернута (ось CJ-9b в обратную сторону)", () => {
      check(W(0, 0, 400, 0), W(430, 300, 400, 0), { x: 400, y: 0 })
    })

    it("CJ-9e: ранняя повернута (ось поздней CJ-9 в обратную сторону)", () => {
      check(W(0, 0, 400, 60), W(400, 360, 400, 60), { x: 400, y: 60 })
    })

    it.each([
      ["t 10 / 40, 45°", 10, 400, 0, 40],
      ["t 20 / 20, 45°, конец в 6 от вершины", 20, 400, -6, 20],
    ] as const)("CJ-9e: %s (CJ-9p с обратной осью) — без выступа за дальнюю грань", (_, et, lx, ly, lt) => {
      const d = Math.SQRT1_2
      check(W(0, 0, 400, 0, et), W(lx + 200 * d, ly + 200 * d, lx, ly, lt), { x: 400, y: 0 })
    })
  })

  it("CJ-9r: прямой легаси-угол — прежние вершины торца поздней на дальней грани", () => {
    const E = W(0, 0, 100, 0)
    const L = W(100, 0, 100, -100)
    // наружный угол торца поздней — на дальней грани; часть в теле ранней вычтена
    const pts = sortedPts(displayPolygons(L, [E, L]))
    expect(pts).toContainEqual([110, 10])
    expect(pts).toContainEqual([100, 10])
    expect(pts.filter(([, y]) => y > 10)).toEqual([])
    expectRaw(E, [E, L])
  })
})

describe("Замкнутый контур после перемещения стены", () => {
  // прямоугольник 400×300: углы w1/w2 и w2/w3 — общая вершина осей,
  // w4 — упёртая обоими концами в грани w3 и w1 у их торцов
  const loop = (): Wall[] => [W(0, 0, 400, 0), W(400, 0, 400, 300), W(400, 300, 0, 300), W(10, 290, 10, 10)]

  const cornerChecks = (w: Wall[]): { parts: Parts; center: Point }[] => [
    { parts: faceParts(w[0], "a", w[3], "b"), center: w[0].a },
    { parts: vertexParts(w[0], w[1], "a"), center: w[0].b },
    { parts: vertexParts(w[1], w[2], "a"), center: w[1].b },
    { parts: faceParts(w[2], "b", w[3], "a"), center: w[2].b },
  ]

  const moves: [number, Point][] = [
    [0, { x: 40, y: 0 }],
    [1, { x: 0, y: 40 }],
    [2, { x: -40, y: 0 }],
    [3, { x: 0, y: -40 }],
  ]

  for (const [i, delta] of moves)
    it(`CJ-7: перенос w${i + 1} вдоль направления — все четыре угла закрыты`, () => {
      const walls = loop()
      moveWalls(walls, [walls[i]], delta)
      // соседи повернулись: перенос действительно создал непрямые углы
      const turned = walls.filter((w) => Math.abs(w.a.x - w.b.x) > 1e-9 && Math.abs(w.a.y - w.b.y) > 1e-9)
      expect(turned.length).toBe(2)
      const errors = cornerChecks(walls).flatMap(({ parts, center }, k) =>
        jointErrors(walls, parts, center, 20, 0.25).map((e) => `угол ${k + 1}: ${e}`),
      )
      expect(errors).toEqual([])
    })

  it("CJ-16b: перенос упёртой поворачивает сквозную, и стык остаётся закрытым", () => {
    const S = W(0, 0, 200, 0)
    const U = W(10, 10, 10, 200)
    moveWalls([S, U], [U], { x: 0, y: 60 })
    expect(S.a).toEqual({ x: 0, y: 60 }) // конец сквозной последовал
    expect(S.b).toEqual({ x: 200, y: 0 })
    const parts = faceParts(S, "a", U, "a")
    expect(extOnlyPoints(parts, S.a).length).toBeGreaterThan(20)
    expect(jointErrors([S, U], parts, S.a)).toEqual([])
  })
})

describe("Нарисованный косой угол на грани", () => {
  // торец горизонтальной (сквозной) срезан по наружной грани косой; в обратном порядке
  // (косая раньше) сейчас клин не рисуется вовсе — спека отдаёт его поздней горизонтальной
  it("CJ-11: угол под 45° (фикстура JOINT-OBLIQUE-4) — срез сквозной и заливка по эталону в обоих порядках", () => {
    const H = W(0, 0, 100, 0)
    const d = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }
    const D = W(90, -10, 90 + 60 * d.x, -10 + 60 * d.y)
    const parts = faceParts(H, "b", D, "a")
    expect(jointErrors([H, D], parts, { x: 95, y: -5 })).toEqual([])
    expect(jointErrors([D, H], parts, { x: 95, y: -5 })).toEqual([])
    // срезанный угол сквозной (100, 10) за наружной гранью косой не отображается
    for (const scene of [[H, D], [D, H]]) expect(owners({ x: 99, y: 9 }, polysOf(scene))).toEqual([])
  })
})

describe("Шов у доращивания", () => {
  const capCoverage = (scene: Wall[], S: Wall, U: Wall): { sCap: number; uCap: number } => {
    const segs = [...contourSegments(S, scene), ...contourSegments(U, scene)]
    const fS = frame(S)
    const fU = frame(U)
    return {
      // сырой торец S (через S.a, вдоль нормали S): часть, граничащая с доращиванием S
      sCap: coveredOnLine(segs, S.a, fS.n, 0.1, 9.9),
      // сырой торец U (через U.a, вдоль нормали U) на всём протяжении, x ∈ [0.1, 19.9]:
      // над доращиванием U и над телом S
      uCap: coveredOnLine(segs, U.a, fU.n, -9.9, 9.9),
    }
  }

  it("CJ-13: стены одного типа — линия касания у доращиваний не отображается, в обоих порядках", () => {
    const { S, U } = rMinus()
    for (const scene of [[S, U], [U, S]]) {
      const c = capCoverage(scene, S, U)
      expect(c.sCap).toBeLessThan(1e-6)
      expect(c.uCap).toBeLessThan(1e-6)
    }
  })

  it.each([
    ["R+", rPlus],
    ["R−", rMinus],
  ] as const)("CJ-13c: %s — контур стыка на месте: наружный угол, наружные и внутренние грани", (_, make) => {
    for (const uType of ["brick", "concrete"] as const) {
      const { S, U: U0 } = make()
      const U = { ...U0, type: uType }
      const fS = frame(S)
      const oOut = { x: S.a.x - fS.n.x * 10, y: S.a.y - fS.n.y * 10 } // наружная грань S (от тела U)
      const oIn = { x: S.a.x + fS.n.x * 10, y: S.a.y + fS.n.y * 10 } // внутренняя грань S
      const yCorner = oOut.y + ((0 - oOut.x) / fS.u.x) * fS.u.y // наружный угол на x = 0
      const tCorner = (0 - oOut.x) / fS.u.x
      const tAt = (x: number): number => (x - oIn.x) / fS.u.x // параметр точки внутренней грани S с данным x
      const yMeet = oIn.y + tAt(20) * fS.u.y // внутренняя грань S встречает грань U x = 20
      for (const scene of [[S, U], [U, S]]) {
        const segs = [...contourSegments(S, scene), ...contourSegments(U, scene)]
        // наружная грань U (x = 0) — от наружного угла до дальнего конца U
        expect(coveredOnLine(segs, ORIGIN, { x: 0, y: 1 }, yCorner + 0.1, 199.9)).toBeGreaterThan(199.8 - yCorner - 0.01)
        // наружная грань S — от наружного угла до дальнего конца S
        expect(coveredOnLine(segs, oOut, fS.u, tCorner + 0.1, fS.len - 0.1)).toBeGreaterThan(fS.len - tCorner - 0.21)
        // внутренняя грань U (x = 20) — от внутренней грани S до дальнего конца U
        expect(coveredOnLine(segs, { x: 20, y: 0 }, { x: 0, y: 1 }, yMeet + 0.1, 199.9)).toBeGreaterThan(199.8 - yMeet - 0.01)
        // внутренняя грань S — от x = 20 до дальнего конца S
        expect(coveredOnLine(segs, oIn, fS.u, tAt(20) + 0.1, fS.len - 0.1)).toBeGreaterThan(fS.len - tAt(20) - 0.21)
      }
      if (uType === "concrete" && make === rMinus) {
        // разные типы, S ранняя: шов по внутренней грани S под доращиванием U — от сырого угла
        // торца S (t = 0) до x = 20; левее угла по обе стороны грани заливки одной стены U, шва нет
        const segs = [...contourSegments(S, [S, U]), ...contourSegments(U, [S, U])]
        expect(coveredOnLine(segs, oIn, fS.u, 0.1, tAt(19.9))).toBeGreaterThan(tAt(19.9) - 0.11)
      }
    }
  })

  // зона наложения: тело упёртой заходит в продолжение сквозной (x от 0 до ≈1.47 при R−);
  // при ранней U граница между ними — сырой торец U (y = 10), это шов пары по линии торца (D5)
  it("CJ-13t: один материал, разная толщина — это разные типы, шов по торцу U в зоне наложения отображается", () => {
    const S = W(0, 0, 200, -60, 20, "brick")
    const U = W(5, 10, 5, 200, 10, "brick") // концы в 11.18: дальше jointTol 10, в пределах faceCornerTol 12.5
    const fU = frame(U)
    const segs = [...contourSegments(S, [U, S]), ...contourSegments(U, [U, S])]
    // параметр на линии торца U: t = 5 − x; зона наложения x ∈ [0.1, 1.4]
    expect(coveredOnLine(segs, U.a, fU.n, 3.6, 4.9)).toBeGreaterThan(1.25)
  })

  it("CJ-13d: стены разных типов — швы между стенами в зоне стыка отображаются", () => {
    const S = W(0, 0, 200, -60, 20, "brick")
    const U = W(10, 10, 10, 200, 20, "concrete")
    const fS = frame(S)
    const fU = frame(U)
    const oIn = { x: S.a.x + fS.n.x * 10, y: S.a.y + fS.n.y * 10 } // внутренняя грань S
    const tAt = (x: number): number => (x - oIn.x) / fS.u.x
    for (const scene of [[S, U], [U, S]]) {
      const segs = [...contourSegments(S, scene), ...contourSegments(U, scene)]
      // внутренняя грань S под продолжением U (x от 1.6 до 19.9): граница S и U
      expect(coveredOnLine(segs, oIn, fS.u, tAt(1.6), tAt(19.9))).toBeGreaterThan(tAt(19.9) - tAt(1.6) - 0.01)
    }
    // U ранняя: в зоне наложения граница с продолжением S — по сырому торцу U (t = 10 − x, x ∈ [0.1, 1.4])
    const segsU = [...contourSegments(S, [U, S]), ...contourSegments(U, [U, S])]
    expect(coveredOnLine(segsU, U.a, fU.n, 8.6, 9.9)).toBeGreaterThan(1.25)
    // сырой торец S граничит только с продолжением самой S — шва по нему нет ни при каком порядке
    for (const scene of [[S, U], [U, S]]) expect(capCoverage(scene, S, U).sCap).toBeLessThan(1e-6)
  })
})
describe("Инварианты", () => {
  it("CJ-15: построение не мутирует стены (замороженные входы)", () => {
    const { S, U } = rMinus()
    const scene = [S, U]
    const snapshot = JSON.parse(JSON.stringify(scene))
    for (const w of scene) {
      Object.freeze(w.a)
      Object.freeze(w.b)
      Object.freeze(w)
    }
    Object.freeze(scene)
    displayPolygons(S, scene)
    displayPolygons(U, scene)
    contourSegments(S, scene)
    contourSegments(U, scene)
    hitWall({ x: 15, y: 8 }, scene, 0.1)
    expect(scene).toEqual(snapshot)
  })
})
