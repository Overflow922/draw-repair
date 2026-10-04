import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { drawScene } from "./render"
import { LIGHT_PALETTE } from "./theme"
import { contourSegments, displayPolygons, outlineSegments } from "./wall-geometry"
import { strokeRecorder } from "./wall-tracking.test-utils"
import { PX_PER_CM } from "./types"
import type { Material, Point, View, Wall } from "./types"

// change seamless-same-material-joints: шов между стенами одного материала не отображается
// (толщина не важна), скрывается только совпадающий участок контура (test-plan.md).
// Эталоны — координаты сцен; оракул SM-ORACLE выводит ожидание из канонической формы
// displayPolygons, которой спецификация задаёт и контур.

interface Seg {
  p1: Point
  p2: Point
}

let seq = 0
const W = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Material = "brick"): Wall => ({
  id: `s${++seq}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y })
const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y
const cross = (p: Point, q: Point): number => p.x * q.y - p.y * q.x
const len = (p: Point): number => Math.hypot(p.x, p.y)

const allContour = (scene: Wall[]): Seg[] => scene.flatMap((w) => contourSegments(w, scene))
const totalLength = (segs: Seg[]): number => segs.reduce((acc, s) => acc + len(sub(s.p2, s.p1)), 0)

// длина отрезков на прямой origin + t·dir (dir — единичный) в пределах t ∈ [lo, hi], объединение без двойного счёта
function coveredOnLine(segs: Seg[], origin: Point, dir: Point, lo: number, hi: number): number {
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

const X_AXIS: Point = { x: 1, y: 0 }
const Y_AXIS: Point = { x: 0, y: 1 }

function distToSeg(p: Point, s: Seg): number {
  const d = sub(s.p2, s.p1)
  const l2 = dot(d, d)
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, s.p1), d) / l2))
  return len(sub(p, { x: s.p1.x + d.x * t, y: s.p1.y + d.y * t }))
}

const onSegs = (p: Point, segs: Seg[]): boolean => segs.some((s) => distToSeg(p, s) <= 1e-6)

function inPoly(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y
    const yj = poly[j].y
    if (yi > p.y !== yj > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - yi)) / (yj - yi) + poly[i].x) inside = !inside
  }
  return inside
}

const ordersOf = (scene: Wall[]): Wall[][] => [scene, [...scene].reverse()]
const withType = (w: Wall, type: Material): Wall => ({ ...w, type })

// ---------- сцены test-plan.md (вторая стена — B, материал задаётся) ----------

type Scene = (mat: Material) => Wall[]
const L: Scene = (m) => [W(0, 0, 200, 0), W(190, 10, 190, 200, 20, m)]
const T: Scene = (m) => [W(0, 0, 200, 0), W(100, 10, 100, 200, 20, m)]
const C: Scene = (m) => [W(0, 0, 200, 0), W(200, 0, 400, 0, 20, m)]
const C2010: Scene = (m) => [W(0, 0, 200, 0), W(200, 0, 400, 0, 10, m)]
const T2010: Scene = (m) => [W(0, 0, 200, 0), W(100, 10, 100, 200, 10, m)]
const L2010: Scene = (m) => [W(0, 0, 200, 0), W(195, 10, 195, 200, 10, m)]
const P: Scene = (m) => [W(0, 0, 200, 0), W(0, 20, 200, 20, 20, m)]
const Pgap: Scene = (m) => [W(0, 0, 200, 0), W(0, 20.01, 200, 20.01, 20, m)]
const Pt: Scene = (m) => [W(0, 0, 100, 0), W(100, 20, 200, 20, 20, m)]
const L03: Scene = (m) => {
  const r = (89.7 * Math.PI) / 180
  return [W(0, 0, 200, 0), W(190, 10, 190 + 190 * Math.cos(r), 10 + 190 * Math.sin(r), 20, m)]
}
// T под 60°: ось поздней выходит из точки на верхней грани ранней
const W60: Scene = (m) => {
  const r = (60 * Math.PI) / 180
  return [W(0, 0, 100, 0), W(50, 10, 50 + 60 * Math.cos(r), 10 + 60 * Math.sin(r), 20, m)]
}
// угловой стык на грани под 45° (фикстура JOINT-OBLIQUE-4 / CJ-11)
const W45: Scene = (m) => [W(0, 0, 100, 0), W(90, -10, 90 + 60 * Math.SQRT1_2, -10 - 60 * Math.SQRT1_2, 20, m)]
const Rplus: Scene = (m) => [W(0, 0, 200, 60), W(10, 10, 10, 200, 20, m)]
const Rminus: Scene = (m) => [W(0, 0, 200, -60), W(10, 10, 10, 200, 20, m)]
const CJ13t: Scene = (m) => [W(0, 0, 200, -60, 20), W(5, 10, 5, 200, 10, m)]
const V2010: Scene = (m) => [W(0, 0, 200, 0), W(200, 0, 200, 200, 10, m)]
const V45: Scene = (m) => [W(0, 0, 100, 0), W(100, 0, 100 + 60 * Math.SQRT1_2, 60 * Math.SQRT1_2, 20, m)]

// L, повёрнутый на 30° вокруг начала координат: стык не выровнен по осям чертежа
const rot30 = (p: Point): Point => {
  const c = Math.cos(Math.PI / 6)
  const s = Math.sin(Math.PI / 6)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}
const Lrot: Scene = (m) => L(m).map((w) => ({ ...w, a: rot30(w.a), b: rot30(w.b) }))

const ORACLE_SCENES: [string, Scene][] = [
  ["L 30°", Lrot],
  ["L", L],
  ["T", T],
  ["C", C],
  ["C-20/10", C2010],
  ["T-20/10", T2010],
  ["L-20/10", L2010],
  ["P", P],
  ["L 90.3°", L03],
  ["W60", W60],
  ["W45", W45],
  ["R+", Rplus],
  ["R−", Rminus],
  ["CJ-13t", CJ13t],
  ["V-20/10", V2010],
  ["V45", V45],
]

// ---------- оракул шва ----------

interface OracleResult {
  violations: string[]
  outer: number
  sameSeam: number
  diffSeam: number
}

const DELTA = 0.002

function seamOracle(scene: Wall[]): OracleResult {
  const forms = new Map(scene.map((w) => [w, displayPolygons(w, scene)]))
  const contour = new Map(scene.map((w) => [w, contourSegments(w, scene)]))
  const ownersAt = (p: Point): Wall[] => scene.filter((w) => (forms.get(w) ?? []).some((pc) => inPoly(p, pc)))
  // точки у вершин любых кусков сцены пропускаются: у острых клиньев сторона ребра там неоднозначна
  const vertices = [...forms.values()].flat(2)
  const nearVertex = (p: Point): boolean => vertices.some((v) => len(sub(p, v)) < 0.3)
  const res: OracleResult = { violations: [], outer: 0, sameSeam: 0, diffSeam: 0 }
  const fmt = (p: Point): string => `(${p.x.toFixed(2)},${p.y.toFixed(2)})`
  for (const X of scene) {
    const onX = contour.get(X) ?? []
    for (const piece of forms.get(X) ?? [])
      for (let k = 0; k < piece.length; k++) {
        const q1 = piece[k]
        const q2 = piece[(k + 1) % piece.length]
        const d = sub(q2, q1)
        const L0 = len(d)
        if (L0 < 1.2) continue
        const u = { x: d.x / L0, y: d.y / L0 }
        const n = { x: -u.y, y: u.x }
        for (let t = 0.5; t <= L0 - 0.5; t += 1) {
          const p = { x: q1.x + u.x * t, y: q1.y + u.y * t }
          if (nearVertex(p)) continue
          const s1 = ownersAt({ x: p.x + n.x * DELTA, y: p.y + n.y * DELTA })
          const s2 = ownersAt({ x: p.x - n.x * DELTA, y: p.y - n.y * DELTA })
          if (s1.length > 1 || s2.length > 1) continue
          const o1 = s1[0]
          const o2 = s2[0]
          if (o1 !== X && o2 !== X) continue
          const other = o1 === X ? o2 : o1
          if (other === undefined) {
            res.outer++
            if (!onSegs(p, onX)) res.violations.push(`${X.id} наружная граница не отображена в ${fmt(p)}`)
          } else if (other === X) {
            if (onSegs(p, onX)) res.violations.push(`${X.id} граница кусков одной стены отображена в ${fmt(p)}`)
          } else if (other.type === X.type) {
            res.sameSeam++
            if (onSegs(p, onX) || onSegs(p, contour.get(other) ?? []))
              res.violations.push(`${X.id}|${other.id} шов одного материала отображён в ${fmt(p)}`)
          } else {
            res.diffSeam++
            if (!onSegs(p, onX) && !onSegs(p, contour.get(other) ?? []))
              res.violations.push(`${X.id}|${other.id} шов разных материалов не отображён в ${fmt(p)}`)
          }
        }
      }
  }
  return res
}

// test-change-request (test-plan.md, «Changed Approved Tests»): сцена L 90.3° выведена из оракула
// одного материала. Между почти совпадающими рёбрами повёрнутой стены остаётся клин до 0.05 см.
// Оракул по пробам считает его наружной границей, а изменённая спека («почти совпадающие
// участки») требует скрыть шов. Эту геометрию проверяет ST-1 Lm (src/wall-seam-tilt.test.ts).
// Оракул разных материалов и SM-INV-1 сцену сохраняют
const SAME_ORACLE_SCENES = ORACLE_SCENES.filter(([name]) => name !== "L 90.3°")

describe("SM-ORACLE: шов по материалу во всех видах стыков", () => {
  it.each(SAME_ORACLE_SCENES)("SM-ORACLE %s: один материал — шов скрыт, наружная граница видна, в обоих порядках", (_, make) => {
    for (const scene of ordersOf(make("brick"))) {
      const r = seamOracle(scene)
      expect(r.violations).toEqual([])
      expect(r.sameSeam).toBeGreaterThan(0) // сцена действительно содержит касание
      expect(r.outer).toBeGreaterThan(0)
    }
  })

  it.each(ORACLE_SCENES)("SM-ORACLE %s: разные материалы — шов отображён, в обоих порядках", (_, make) => {
    for (const scene of ordersOf(make("concrete"))) {
      const r = seamOracle(scene)
      expect(r.violations).toEqual([])
      expect(r.diffSeam).toBeGreaterThan(0)
    }
  })
})

// ---------- точные эталоны по координатам ----------

describe("Слияние стен одного материала: прямой угол, Т-стык, коллинеарность", () => {
  it("SM-1: L одного материала — торец B на грани A не отображается, наружный угол непрерывен", () => {
    for (const scene of ordersOf(L("brick"))) {
      const segs = allContour(scene)
      // линия касания y = 10, x ∈ [180, 200]
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 180.1, 199.9)).toBeLessThan(1e-6)
      // внутренняя грань A левее примыкания отображается полностью
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 0.1, 179.9)).toBeCloseTo(179.8, 6)
      // наружная линия x = 200 непрерывна: торец A и наружная грань B
      expect(coveredOnLine(segs, { x: 200, y: 0 }, Y_AXIS, -9.9, 199.9)).toBeCloseTo(209.8, 6)
      // внутренняя грань B (x = 180) — от грани A до дальнего конца
      expect(coveredOnLine(segs, { x: 180, y: 0 }, Y_AXIS, 10.1, 199.9)).toBeCloseTo(189.8, 6)
    }
  })

  it("SM-2: Т-стык одного материала — грань сквозной скрыта только на ширине касания", () => {
    for (const scene of ordersOf(T("brick"))) {
      const segs = allContour(scene)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 90.1, 109.9)).toBeLessThan(1e-6)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 0.1, 89.9)).toBeCloseTo(89.8, 6)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 110.1, 199.9)).toBeCloseTo(89.8, 6)
      // противоположная грань сквозной не затронута
      expect(coveredOnLine(segs, { x: 0, y: -10 }, X_AXIS, 0.1, 199.9)).toBeCloseTo(199.8, 6)
    }
  })

  it("SM-3: коллинеарные стены одного материала — поперечной линии нет", () => {
    for (const scene of ordersOf(C("brick"))) {
      const segs = allContour(scene)
      expect(coveredOnLine(segs, { x: 200, y: 0 }, Y_AXIS, -9.9, 9.9)).toBeLessThan(1e-6)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 0.1, 399.9)).toBeCloseTo(399.8, 6)
      expect(coveredOnLine(segs, { x: 0, y: -10 }, X_AXIS, 0.1, 399.9)).toBeCloseTo(399.8, 6)
    }
  })
})

describe("Слияние стен одного материала: разная толщина", () => {
  it("SM-4: коллинеарно 20/10 — скрыт только участок под тонкой стеной, ступенька видна", () => {
    for (const scene of ordersOf(C2010("brick"))) {
      const segs = allContour(scene)
      expect(coveredOnLine(segs, { x: 200, y: 0 }, Y_AXIS, -4.9, 4.9)).toBeLessThan(1e-6)
      expect(coveredOnLine(segs, { x: 200, y: 0 }, Y_AXIS, -9.9, -5.1)).toBeCloseTo(4.8, 6)
      expect(coveredOnLine(segs, { x: 200, y: 0 }, Y_AXIS, 5.1, 9.9)).toBeCloseTo(4.8, 6)
    }
  })

  it("SM-5: Т-стык 20/10 — грань сквозной скрыта только на ширине тонкой стены", () => {
    for (const scene of ordersOf(T2010("brick"))) {
      const segs = allContour(scene)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 95.1, 104.9)).toBeLessThan(1e-6)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 0.1, 94.9)).toBeCloseTo(94.8, 6)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 105.1, 199.9)).toBeCloseTo(94.8, 6)
    }
  })

  it("SM-6: угол 20/10 — касание скрыто, торец толстой и грани отображаются", () => {
    for (const scene of ordersOf(L2010("brick"))) {
      const segs = allContour(scene)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 190.1, 199.9)).toBeLessThan(1e-6)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 0.1, 189.9)).toBeCloseTo(189.8, 6)
      // x = 200: торец A (y ∈ [-10, 10]) и наружная грань B (y ∈ [10, 200]) — одна линия
      expect(coveredOnLine(segs, { x: 200, y: 0 }, Y_AXIS, -9.9, 199.9)).toBeCloseTo(209.8, 6)
    }
  })
})

describe("Слияние стен одного материала: разные материалы", () => {
  const cases: [string, Scene, Point, Point, number, number][] = [
    ["L", L, { x: 0, y: 10 }, X_AXIS, 180.1, 199.9],
    ["T", T, { x: 0, y: 10 }, X_AXIS, 90.1, 109.9],
    ["C", C, { x: 200, y: 0 }, Y_AXIS, -9.9, 9.9],
    ["C-20/10", C2010, { x: 200, y: 0 }, Y_AXIS, -9.9, 9.9],
    ["T-20/10", T2010, { x: 0, y: 10 }, X_AXIS, 95.1, 104.9],
    ["L-20/10", L2010, { x: 0, y: 10 }, X_AXIS, 190.1, 199.9],
    ["P", P, { x: 0, y: 10 }, X_AXIS, 0.1, 199.9],
  ]
  it.each(cases)("SM-7 %s: разные материалы — линия касания отображается по всей длине", (_, make, o, dir, lo, hi) => {
    for (const scene of ordersOf(make("concrete"))) expect(coveredOnLine(allContour(scene), o, dir, lo, hi)).toBeCloseTo(hi - lo, 6)
  })
})

describe("Слияние стен одного материала: клин", () => {
  // точки грани ранней (y = 10), над которыми лежит форма поздней, под ними — форма ранней
  const seamPoints = (scene: Wall[], early: Wall, late: Wall): Point[] => {
    const eF = displayPolygons(early, scene)
    const lF = displayPolygons(late, scene)
    const pts: Point[] = []
    for (let x = 20; x <= 80; x += 0.25) {
      const above = { x, y: 10.05 }
      const below = { x, y: 9.95 }
      if (lF.some((pc) => inPoly(above, pc)) && eF.some((pc) => inPoly(below, pc))) pts.push({ x, y: 10 })
    }
    return pts
  }

  // новая (поздняя) стена — позже в массиве: заливка клина у неё, касание идёт по грани ранней;
  // обратный порядок покрывает SM-ORACLE W60
  it("SM-8: клин под 60° одного материала — шов между заливкой и ранней не отображается", () => {
    const [early, late] = W60("brick")
    const scene = [early, late]
    const pts = seamPoints(scene, early, late)
    expect(pts.length).toBeGreaterThanOrEqual(40) // касание по грани не короче 10 см
    const segs = allContour(scene)
    expect(pts.filter((p) => onSegs(p, segs))).toEqual([])
  })

  it("SM-8d: клин под 60° разных материалов — шов отображается во всех точках касания", () => {
    const [early, late] = W60("concrete")
    const scene = [early, late]
    const pts = seamPoints(scene, early, late)
    expect(pts.length).toBeGreaterThanOrEqual(40)
    const segs = allContour(scene)
    expect(pts.filter((p) => !onSegs(p, segs))).toEqual([])
  })
})

describe("Слияние стен одного материала: граничные случаи", () => {
  it("SM-10: касание в точке — контур каждой стены — полный периметр", () => {
    for (const scene of ordersOf(Pt("brick"))) for (const w of scene) expect(totalLength(contourSegments(w, scene))).toBeCloseTo(240, 6)
  })

  it("SM-15: параллельные стены с зазором 0.01 см — обе грани отображаются полностью", () => {
    for (const scene of ordersOf(Pgap("brick"))) {
      const segs = allContour(scene)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 0.1, 199.9)).toBeCloseTo(199.8, 6)
      expect(coveredOnLine(segs, { x: 0, y: 10.01 }, X_AXIS, 0.1, 199.9)).toBeCloseTo(199.8, 6)
    }
  })

  it("SM-16: грань-к-грани одного материала — общая грань не отображается по всей длине", () => {
    for (const scene of ordersOf(P("brick"))) {
      const segs = allContour(scene)
      expect(coveredOnLine(segs, { x: 0, y: 10 }, X_AXIS, 0.1, 199.9)).toBeLessThan(1e-6)
      expect(coveredOnLine(segs, { x: 0, y: -10 }, X_AXIS, 0.1, 199.9)).toBeCloseTo(199.8, 6)
      expect(coveredOnLine(segs, { x: 0, y: 30 }, X_AXIS, 0.1, 199.9)).toBeCloseTo(199.8, 6)
    }
  })

  it("SM-13: дерево (вдоль) сливается так же, как другие материалы", () => {
    const scene = L("wood-long").map((w) => withType(w, "wood-long"))
    for (const s of ordersOf(scene)) expect(coveredOnLine(allContour(s), { x: 0, y: 10 }, X_AXIS, 180.1, 199.9)).toBeLessThan(1e-6)
  })

  it("SM-14: легаси-вершина 20/10 одного материала — касание скрыто, ступенька и наружная грань видны", () => {
    for (const scene of ordersOf(V2010("brick"))) {
      const segs = allContour(scene)
      // торец A (x = 200) граничит с телом B на всей высоте A
      expect(coveredOnLine(segs, { x: 200, y: 0 }, Y_AXIS, -9.9, 9.9)).toBeLessThan(1e-6)
      // наружная грань B (x = 205) отображается
      expect(coveredOnLine(segs, { x: 205, y: 0 }, Y_AXIS, 10.1, 199.9)).toBeCloseTo(189.8, 6)
      // внутренняя грань B (x = 195) выше A отображается — ступенька толщин
      expect(coveredOnLine(segs, { x: 195, y: 0 }, Y_AXIS, 10.1, 199.9)).toBeCloseTo(189.8, 6)
    }
  })
})

describe("Слияние стен одного материала: подсветка и смена материала", () => {
  it("SM-11: подсветка (outlineSegments) обводит сторону касания, хотя контур её не рисует", () => {
    const scene = L("brick")
    const [, B] = scene
    const outline = outlineSegments(B, scene)
    expect(coveredOnLine(outline, { x: 0, y: 10 }, X_AXIS, 180.1, 199.9)).toBeCloseTo(19.8, 6)
    expect(coveredOnLine(contourSegments(B, scene), { x: 0, y: 10 }, X_AXIS, 180.1, 199.9)).toBeLessThan(1e-6)
  })

  it("SM-12: смена материала восстанавливает шов, возврат — снова скрывает", () => {
    const [A, B] = T("brick")
    const seam = (scene: Wall[]): number => coveredOnLine(allContour(scene), { x: 0, y: 10 }, X_AXIS, 90.1, 109.9)
    expect(seam([A, B])).toBeLessThan(1e-6)
    expect(seam([A, withType(B, "reinforced")])).toBeCloseTo(19.8, 6)
    expect(seam([A, withType(B, "brick")])).toBeLessThan(1e-6)
  })

  // через реальный рендер: и зафиксированная стена, и превью должны учитывать друг друга
  describe("SM-18: превью цепочки в drawScene", () => {
    const VIEW: View = { zoom: 1, pan: { x: -50, y: -50 } }
    const K = PX_PER_CM * VIEW.zoom
    const sx = (x: number): number => (x - VIEW.pan.x) * K
    const sy = (y: number): number => (y - VIEW.pan.y) * K
    // длина обводок цветом чернил на экранной горизонтали y = Y в пределах [x0, x1] (пиксели устройства)
    const inkOnHorizontal = (scene: { walls: Wall[]; preview: Wall }, Y: number, x0: number, x1: number): number => {
      const { ctx, strokes } = strokeRecorder()
      drawScene(ctx, 1200, 900, scene.walls, scene.preview, "mm", VIEW, [], { palette: LIGHT_PALETTE })
      const ivs: [number, number][] = []
      for (const s of strokes) {
        if (s.strokeStyle.toLowerCase() !== LIGHT_PALETTE.ink.toLowerCase()) continue
        for (const sp of s.subpaths)
          for (let i = 0; i + 1 < sp.length; i++) {
            const p = sp[i]
            const q = sp[i + 1]
            if (Math.abs(p.y - Y) > 1e-6 || Math.abs(q.y - Y) > 1e-6) continue
            const a = Math.max(x0, Math.min(p.x, q.x))
            const b = Math.min(x1, Math.max(p.x, q.x))
            if (b > a) ivs.push([a, b])
          }
      }
      ivs.sort((u, v) => u[0] - v[0])
      let total = 0
      let cursor = -Infinity
      for (const [a, b] of ivs) {
        const from = Math.max(a, cursor)
        if (b > from) total += b - from
        cursor = Math.max(cursor, b)
      }
      return total
    }
    const seamPx = (mat: Material): number => {
      const [A, B] = L(mat)
      return inkOnHorizontal({ walls: [A], preview: { ...B, id: "preview" } }, sy(10), sx(180.5), sx(199.5))
    }

    it("SM-18: превью того же материала — линия касания с зафиксированной стеной не рисуется", () => {
      expect(seamPx("brick")).toBeLessThan(1e-6)
    })

    it("SM-18d: превью другого материала — линия касания рисуется по всей ширине", () => {
      expect(seamPx("concrete")).toBeCloseTo(sx(199.5) - sx(180.5), 6)
    })
  })
})

describe("Инварианты контура", () => {
  const onSomeOutline = (s: Seg, outline: Seg[]): boolean =>
    outline.some((o) => distToSeg(s.p1, o) <= 1e-6 && distToSeg(s.p2, o) <= 1e-6)

  it.each(ORACLE_SCENES)("SM-INV-1 %s: каждый отрезок контура лежит на внешней границе формы", (_, make) => {
    for (const mat of ["brick", "concrete"] as const)
      for (const scene of ordersOf(make(mat)))
        for (const w of scene) {
          const outline = outlineSegments(w, scene)
          const bad = contourSegments(w, scene).filter((s) => !onSomeOutline(s, outline))
          expect(bad).toEqual([])
        }
  })

  it("SM-INV-2: построение контура не мутирует стены (замороженные входы)", () => {
    const scene = T2010("brick")
    const snapshot = JSON.parse(JSON.stringify(scene))
    for (const w of scene) {
      Object.freeze(w.a)
      Object.freeze(w.b)
      Object.freeze(w)
    }
    Object.freeze(scene)
    const segs = allContour(scene)
    expect(segs.length).toBeGreaterThan(0)
    expect(scene).toEqual(snapshot)
  })

  it.each([
    ["L", L],
    ["T", T],
    ["C", C],
    ["P", P],
    ["C-20/10", C2010],
    ["T-20/10", T2010],
    ["L-20/10", L2010],
  ] as const)("SM-INV-3 %s: длина контура не зависит от порядка стен", (_, make) => {
    for (const mat of ["brick", "concrete"] as const) {
      const [s1, s2] = ordersOf(make(mat))
      expect(totalLength(allContour(s1))).toBeCloseTo(totalLength(allContour(s2)), 6)
    }
  })
})

describe("Очистка: частные механизмы шва удалены (design D3)", () => {
  const SELF = "wall-seam.test.ts"
  const SRC_DIR = fileURLToPath(new URL(".", import.meta.url))
  const REMOVED = ["onSameTypeFace", "seamLines", "seamVisible", "SeamLine"]
  const tsFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name)
      if (e.isDirectory()) return tsFiles(p)
      return e.isFile() && e.name.endsWith(".ts") && e.name !== SELF ? [p] : []
    })

  it("SM-17: onSameTypeFace, seamLines, seamVisible, SeamLine нигде не остались", () => {
    const violations = tsFiles(SRC_DIR).flatMap((f) => {
      const src = readFileSync(f, "utf8")
      return REMOVED.filter((n) => new RegExp(`\\b${n}\\b`).test(src)).map((n) => `${f}: ${n}`)
    })
    expect(violations).toEqual([])
  })
})
