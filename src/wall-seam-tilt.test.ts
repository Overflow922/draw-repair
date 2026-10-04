import { describe, expect, it } from "vitest"
import { moveEndpoint, moveWalls } from "./geometry"
import { contourSegments, outlineSegments } from "./wall-geometry"
import type { Material, Point, Wall } from "./types"

// change seamless-same-material-joints: почти совпадающие участки слегка повёрнутых стен
// (test-plan.md, «Слегка повёрнутые стыки»). Сцены получены так же, как у пользователя:
// ортогональная раскладка, затем перемещение продакшн-функциями moveWalls / moveEndpoint.

interface Seg {
  p1: Point
  p2: Point
}

let seq = 0
const W = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Material = "brick"): Wall => ({
  id: `t${++seq}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y })
const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y
const cross = (p: Point, q: Point): number => p.x * q.y - p.y * q.x
const len = (p: Point): number => Math.hypot(p.x, p.y)
const tan = (deg: number): number => Math.tan((deg * Math.PI) / 180)

function distToSeg(p: Point, s: Seg): number {
  const d = sub(s.p2, s.p1)
  const l2 = dot(d, d)
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, s.p1), d) / l2))
  return len(sub(p, { x: s.p1.x + d.x * t, y: s.p1.y + d.y * t }))
}
const onSegs = (p: Point, segs: Seg[]): boolean => segs.some((s) => distToSeg(p, s) <= 1e-6)

// линия касания: от o вдоль единичного dir, пролёт [0, span]
interface Contact {
  o: Point
  dir: Point
  span: number
}

const BAND = 0.6
const SHRINK = 0.5

// длина частей контура в полосе линии касания, почти параллельных ей (угол ≤ 1°)
function seamLength(segs: Seg[], c: Contact): number {
  const n = { x: -c.dir.y, y: c.dir.x }
  const lo = SHRINK
  const hi = c.span - SHRINK
  const ivs: [number, number][] = []
  for (const s of segs) {
    const d = sub(s.p2, s.p1)
    const L = len(d)
    if (L < 1e-9) continue
    if (Math.abs(cross(d, c.dir)) / L > Math.sin((1 * Math.PI) / 180)) continue
    const lat1 = dot(sub(s.p1, c.o), n)
    const lat2 = dot(sub(s.p2, c.o), n)
    if (Math.abs(lat1) > BAND || Math.abs(lat2) > BAND) continue
    const t1 = dot(sub(s.p1, c.o), c.dir)
    const t2 = dot(sub(s.p2, c.o), c.dir)
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

// точка в полосе касания (с запасом 1 см у концов пролёта)
function inBand(p: Point, c: Contact): boolean {
  const n = { x: -c.dir.y, y: c.dir.x }
  const t = dot(sub(p, c.o), c.dir)
  return Math.abs(dot(sub(p, c.o), n)) <= BAND + 1e-9 && t >= -1 && t <= c.span + 1
}

// точки внешней границы формы вне полосы, не попавшие в контур
function missingOuter(scene: Wall[], c: Contact): Point[] {
  const missing: Point[] = []
  for (const w of scene) {
    const contour = contourSegments(w, scene)
    for (const s of outlineSegments(w, scene)) {
      const d = sub(s.p2, s.p1)
      const L = len(d)
      for (let t = 0.25; t < L; t += 0.5) {
        const p = { x: s.p1.x + (d.x * t) / L, y: s.p1.y + (d.y * t) / L }
        if (!inBand(p, c) && !onSegs(p, contour)) missing.push(p)
      }
    }
  }
  return missing
}

const allContour = (scene: Wall[]): Seg[] => scene.flatMap((w) => contourSegments(w, scene))

interface TiltScene {
  walls: [Wall, Wall]
  contact: Contact
}

type Builder = (deg: number, sign: 1 | -1, mat: Material) => TiltScene

// угловой стык на грани (скриншот): v поворачивается вокруг дальнего конца при перемещении h
const FC: Builder = (deg, sign, mat) => {
  const h = W(0, 0, 190, 0)
  const v = W(200, 10, 200, -200, 20, mat)
  const walls: [Wall, Wall] = [h, v]
  moveWalls(walls, [h], { x: sign * 210 * tan(deg), y: 0 })
  return { walls, contact: { o: { x: h.b.x, y: -10 }, dir: { x: 0, y: 1 }, span: 20 } }
}

// прямой угол прилипанием: B поворачивается при перемещении A
const Lm: Builder = (deg, sign, mat) => {
  const A = W(0, 0, 200, 0)
  const B = W(190, 10, 190, 200, 20, mat)
  const walls: [Wall, Wall] = [A, B]
  moveWalls(walls, [A], { x: sign * 190 * tan(deg), y: 0 })
  return { walls, contact: { o: { x: A.b.x - 20, y: 10 }, dir: { x: 1, y: 0 }, span: 20 } }
}

// Т-стык: B поворачивается вокруг конца на грани при перетаскивании дальнего конца
const Tm: Builder = (deg, sign, mat) => {
  const A = W(0, 0, 200, 0)
  const B = W(100, 10, 100, 200, 20, mat)
  const walls: [Wall, Wall] = [A, B]
  moveEndpoint(walls, B, "b", { x: 100 + sign * 190 * tan(deg), y: 200 })
  return { walls, contact: { o: { x: 90, y: 10 }, dir: { x: 1, y: 0 }, span: 20 } }
}

// коллинеарно: B поворачивается вокруг общего конца
const Cm: Builder = (deg, sign, mat) => {
  const A = W(0, 0, 200, 0)
  const B = W(200, 0, 400, 0, 20, mat)
  const walls: [Wall, Wall] = [A, B]
  moveEndpoint(walls, B, "b", { x: 400, y: sign * 200 * tan(deg) })
  return { walls, contact: { o: { x: 200, y: -10 }, dir: { x: 0, y: 1 }, span: 20 } }
}

const BUILDERS: [string, Builder][] = [
  ["FC", FC],
  ["Lm", Lm],
  ["Tm", Tm],
  ["Cm", Cm],
]
const ANGLES = [0.01, 0.1, 0.25, 0.45]
const SIGNS = [1, -1] as const

const variants = (make: Builder, mat: Material): { label: string; scene: Wall[]; contact: Contact }[] =>
  ANGLES.flatMap((deg) =>
    SIGNS.flatMap((sign) => {
      const { walls, contact } = make(deg, sign, mat)
      return [
        { label: `${deg}° ${sign > 0 ? "+" : "−"} [A,B]`, scene: [walls[0], walls[1]], contact },
        { label: `${deg}° ${sign > 0 ? "+" : "−"} [B,A]`, scene: [walls[1], walls[0]], contact },
      ]
    }),
  )

describe("Слегка повёрнутые стыки: шов одного материала", () => {
  it("ST-0: сцены действительно повёрнуты (угол второй стены отличается от прямого)", () => {
    const angleOff = (w: Wall): number => {
      const a = (Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180) / Math.PI
      const r = ((a % 90) + 90) % 90
      return Math.min(r, 90 - r)
    }
    for (const [, make] of BUILDERS)
      for (const deg of ANGLES) expect(angleOff(make(deg, 1, "brick").walls[1])).toBeCloseTo(deg, 6)
  })

  it.each(BUILDERS)("ST-1 %s: один материал — линия касания не отображается ни частично, ни целиком", (_, make) => {
    const bad = variants(make, "brick")
      .map(({ label, scene, contact }) => ({ label, seam: seamLength(allContour(scene), contact) }))
      .filter((r) => r.seam > 1e-6)
    expect(bad).toEqual([])
  })

  it.each(BUILDERS)("ST-2 %s: разные материалы — линия касания отображается целиком", (_, make) => {
    const bad = variants(make, "concrete")
      .map(({ label, scene, contact }) => ({ label, seam: seamLength(allContour(scene), contact), need: contact.span - 2 * SHRINK }))
      .filter((r) => r.seam < r.need - 1e-6)
    expect(bad).toEqual([])
  })

  it.each(BUILDERS)("ST-3 %s: внешняя граница вне зоны касания отображается полностью", (_, make) => {
    for (const mat of ["brick", "concrete"] as const) {
      const bad = variants(make, mat)
        .map(({ label, scene, contact }) => ({ label, missing: missingOuter(scene, contact).length }))
        .filter((r) => r.missing > 0)
      expect(bad).toEqual([])
    }
  })
})

describe("Почти совпадающие участки: границы правила", () => {
  // B касается грани A (y = 10) в точке (0, 10) и расходится вверх под углом deg; толщина 20
  const fan = (deg: number, length: number): Wall[] => {
    const r = (deg * Math.PI) / 180
    const u = { x: Math.cos(r), y: Math.sin(r) }
    const n = { x: -u.y, y: u.x } // внутрь B (вниз по экрану — к большим y)
    const a = { x: 0 + n.x * 10, y: 10 + n.y * 10 }
    return [W(0, 0, 200, 0), W(a.x, a.y, a.x + u.x * length, a.y + u.y * length)]
  }
  const faceOfB = (B: Wall): Seg => {
    const d = sub(B.b, B.a)
    const L = len(d)
    const n = { x: -d.y / L, y: d.x / L }
    return { p1: { x: B.a.x - n.x * 10, y: B.a.y - n.y * 10 }, p2: { x: B.b.x - n.x * 10, y: B.b.y - n.y * 10 } }
  }
  // длина контура на отрезке s (с допуском 1e-6)
  const drawnOn = (segs: Seg[], s: Seg): number => {
    const d = sub(s.p2, s.p1)
    const L = len(d)
    let drawn = 0
    for (let t = 0.25; t < L; t += 0.5) if (onSegs({ x: s.p1.x + (d.x * t) / L, y: s.p1.y + (d.y * t) / L }, segs)) drawn += 0.5
    return drawn
  }

  it("ST-4: касание в точке, 0.3°, расхождение 1.05 см (> 0.5 см) — обе грани отображаются целиком", () => {
    const [A, B] = fan(0.3, 200)
    for (const scene of [
      [A, B],
      [B, A],
    ]) {
      const segs = allContour(scene)
      expect(drawnOn(segs, { p1: { x: 0, y: 10 }, p2: { x: 200, y: 10 } })).toBeCloseTo(200, 6)
      expect(drawnOn(segs, faceOfB(B))).toBeCloseTo(200, 6)
    }
  })

  it("ST-5: касание в точке, 0.1°, расхождение 0.35 см (≤ 0.5 см) — грань A и грань B на общем протяжении не отображаются", () => {
    const [A, B] = fan(0.1, 200)
    const f = faceOfB(B)
    const d = sub(f.p2, f.p1)
    const L = len(d)
    const inner = { p1: { x: f.p1.x + (d.x * 0.5) / L, y: f.p1.y + (d.y * 0.5) / L }, p2: { x: f.p2.x - (d.x * 0.5) / L, y: f.p2.y - (d.y * 0.5) / L } }
    for (const scene of [
      [A, B],
      [B, A],
    ]) {
      const segs = allContour(scene)
      expect(drawnOn(segs, { p1: { x: 0.5, y: 10 }, p2: { x: 199.5, y: 10 } })).toBe(0)
      expect(drawnOn(segs, inner)).toBe(0)
    }
  })

  it("ST-7: касание в точке под 0.7° (между допуском 0.5° и 1°), расхождение 0.24 см — обе грани отображаются целиком", () => {
    const [A, B] = fan(0.7, 20)
    for (const scene of [
      [A, B],
      [B, A],
    ]) {
      const segs = allContour(scene)
      expect(drawnOn(segs, { p1: { x: 0, y: 10 }, p2: { x: 200, y: 10 } })).toBeCloseTo(200, 6)
      expect(drawnOn(segs, faceOfB(B))).toBeCloseTo(20, 6)
    }
  })

  it("ST-6: касание в точке под 1° (больше допуска), расхождение 0.35 см — обе грани отображаются целиком", () => {
    const [A, B] = fan(1, 20)
    for (const scene of [
      [A, B],
      [B, A],
    ]) {
      const segs = allContour(scene)
      expect(drawnOn(segs, { p1: { x: 0, y: 10 }, p2: { x: 200, y: 10 } })).toBeCloseTo(200, 6)
      expect(drawnOn(segs, faceOfB(B))).toBeCloseTo(20, 6)
    }
  })
})
