import { describe, expect, it } from "vitest"
import { deleteObjects } from "./doorway/doorway-scene"
import { moveWalls } from "./geometry"
import { startRefOf } from "./wall-angle"
import { chainSegment } from "./wall-chain"
import { contourSegments, displayPolygons } from "./wall-geometry"
import { moveEndpointBounded, resizeWallBounded } from "./wall-edit"
import { snapRadiusCm, snapStartVertex, wallClickAction } from "./wall-snap"
import { FREE } from "./wall-edit.test-utils"
import { deepFreeze } from "./wall-snap.test-utils"
import type { Material, Point, Wall } from "./types"

// change diagonal-corner-snap (test-plan.md, DJ-*, IC-*): диагональный угловой стык (wall-joints).
// Эталон закрытого угла задан независимо от продакшн-кода: объединение прямоугольников стен и блока
// угла, посчитанных здесь из осей и толщин; сравнение — выборкой центров клеток 1 × 1 см.
//
// Сцена: A (−100,0)→(0,0) t20, свободный торец E = (0,0). B от S = (10,10) вниз: S = E + out·hB + n·hA,
// блок угла — x ∈ [0, 20], y ∈ [−10, 10]; пробная точка блока PB = (10, −5).

let seq = 0
const W = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Material = "brick"): Wall => ({
  id: `dj${++seq}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

const PB: Point = { x: 10, y: -5 }

const convexContains = (poly: Point[], p: Point): boolean => {
  if (poly.length < 3) return false
  let area = 0
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    area += a.x * b.y - b.x * a.y
  })
  const orient = Math.sign(area)
  if (orient === 0) return false
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length]
    return orient * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) >= -1e-9
  })
}

const wallCovers = (w: Wall, walls: Wall[], p: Point): boolean => displayPolygons(w, walls).some((poly) => convexContains(poly, p))
const unionCovers = (walls: Wall[], p: Point): boolean => walls.some((w) => wallCovers(w, walls, p))
const rectPoly = (r: Rect): Point[] => [
  { x: r.x0, y: r.y0 },
  { x: r.x1, y: r.y0 },
  { x: r.x1, y: r.y1 },
  { x: r.x0, y: r.y1 },
]

// отображаемые формы считаются один раз на сцену, а не на каждую клетку выборки
const shapesOf = (walls: Wall[]): Point[][][] => walls.map((w) => displayPolygons(w, walls))
const coveredBy = (shape: Point[][], p: Point): boolean => shape.some((poly) => convexContains(poly, p))

function cells(box: Rect): Point[] {
  const out: Point[] = []
  for (let x = box.x0; x < box.x1; x++) for (let y = box.y0; y < box.y1; y++) out.push({ x: x + 0.5, y: y + 0.5 })
  return out
}

// клетки в рамке box, где отображаемая область стен и эталонные многоугольники расходятся
function polyMismatches(walls: Wall[], polys: Point[][], box: Rect): Point[] {
  const shapes = shapesOf(walls)
  return cells(box).filter((p) => shapes.some((s) => coveredBy(s, p)) !== polys.some((poly) => convexContains(poly, p)))
}

const mismatches = (walls: Wall[], rects: Rect[], box: Rect): Point[] =>
  polyMismatches(
    walls,
    rects.map(rectPoly),
    box,
  )

// ни одна точка не отображается двумя стенами сразу: в наложении побеждает ранняя
function overlapCells(walls: Wall[], box: Rect): Point[] {
  const shapes = shapesOf(walls)
  return cells(box).filter((p) => shapes.filter((s) => coveredBy(s, p)).length > 1)
}
const BOX: Rect = { x0: -130, y0: -40, x1: 60, y1: 190 }

// эталон сцены: A, B вниз от S и блок угла
const closedL = (): Rect[] => [
  { x0: -100, y0: -10, x1: 0, y1: 10 }, // A
  { x0: 0, y0: 10, x1: 20, y1: 110 }, // B
  { x0: 0, y0: -10, x1: 20, y1: 10 }, // блок угла
]

const AB = (): { a: Wall; b: Wall } => ({ a: W(-100, 0, 0, 0, 20), b: W(10, 10, 10, 110, 20) })

const segsOn = (segs: { p1: Point; p2: Point }[], fixed: "x" | "y", at: number, lo: number, hi: number): number =>
  segs
    .filter((s) => Math.abs(s.p1[fixed] - at) < 1e-6 && Math.abs(s.p2[fixed] - at) < 1e-6)
    .reduce((sum, s) => {
      const k = fixed === "x" ? "y" : "x"
      const a = Math.max(lo, Math.min(s.p1[k], s.p2[k]))
      const b = Math.min(hi, Math.max(s.p1[k], s.p2[k]))
      return sum + Math.max(0, b - a)
    }, 0)

describe("DJ: диагональный угловой стык — закрытый угол", () => {
  it("DJ-1: угол закрыт — нет выемки снаружи и просвета внутри, наружный угол (20, −10)", () => {
    const { a, b } = AB()
    const walls = [a, b]
    expect(mismatches(walls, closedL(), BOX)).toEqual([])
    expect(unionCovers(walls, { x: 19.5, y: -9.5 })).toBe(true)
    expect(unionCovers(walls, { x: 20.5, y: -9.5 })).toBe(false)
    expect(unionCovers(walls, { x: 19.5, y: -10.5 })).toBe(false)
    expect(unionCovers(walls, PB)).toBe(true)
    // INV-5: тела не налагаются
    expect(overlapCells(walls, BOX)).toEqual([])
  })

  it("DJ-2: разная толщина — B толще: блок x ∈ [0, 40], y ∈ [−10, 10]", () => {
    const a = W(-100, 0, 0, 0, 20)
    const b = W(20, 10, 20, 110, 40)
    const rects: Rect[] = [
      { x0: -100, y0: -10, x1: 0, y1: 10 },
      { x0: 0, y0: 10, x1: 40, y1: 110 },
      { x0: 0, y0: -10, x1: 40, y1: 10 },
    ]
    expect(mismatches([a, b], rects, BOX)).toEqual([])
    expect(overlapCells([a, b], BOX)).toEqual([])
  })

  it("DJ-2b: разная толщина — A толще: блок x ∈ [0, 20], y ∈ [−20, 20]", () => {
    const a = W(-100, 0, 0, 0, 40)
    const b = W(10, 20, 10, 120, 20)
    const rects: Rect[] = [
      { x0: -100, y0: -20, x1: 0, y1: 20 },
      { x0: 0, y0: 20, x1: 20, y1: 120 },
      { x0: 0, y0: -20, x1: 20, y1: 20 },
    ]
    expect(mismatches([a, b], rects, BOX)).toEqual([])
    expect(overlapCells([a, b], BOX)).toEqual([])
  })

  it("DJ-3: блок принадлежит поздней стене B; объединение то же в обратном порядке (DJ-4)", () => {
    const { a, b } = AB()
    // порядок A, B: поздняя B
    expect(wallCovers(b, [a, b], PB)).toBe(true)
    expect(wallCovers(a, [a, b], PB)).toBe(false)
    expect(mismatches([a, b], closedL(), BOX)).toEqual([])
    // порядок B, A: поздняя A — блок у неё (DJ-4)
    expect(wallCovers(a, [b, a], PB)).toBe(true)
    expect(wallCovers(b, [b, a], PB)).toBe(false)
    expect(mismatches([b, a], closedL(), BOX)).toEqual([])
    expect(overlapCells([b, a], BOX)).toEqual([])
  })

  it("DJ-5: разные материалы — блок штрихуется материалом поздней, шов с торцом ранней — прямая линия", () => {
    const a = W(-100, 0, 0, 0, 20, "brick")
    const b = W(10, 10, 10, 110, 20, "concrete")
    const walls = [a, b]
    expect(wallCovers(b, walls, PB)).toBe(true) // блок у concrete-стены
    // торец A на x = 0 виден целиком (y ∈ [−10, 10])
    expect(segsOn(contourSegments(a, walls), "x", 0, -10, 10)).toBeCloseTo(20, 6)
    // блок — часть контура B: его левая кромка (шов с торцом A — прямая линия), верхняя и правая грани
    const own = contourSegments(b, walls)
    expect(segsOn(own, "x", 0, -10, 10)).toBeCloseTo(20, 6)
    expect(segsOn(own, "y", -10, 0, 20)).toBeCloseTo(20, 6)
    expect(segsOn(own, "x", 20, -10, 10)).toBeCloseTo(20, 6)
    // граница тела B и её блока — внутри одной стены, в контур не входит
    expect(segsOn(own, "y", 10, 0, 20)).toBeCloseTo(0, 6)
  })

  it("DJ-5b: один материал — шов не рисуется, граница тела и блока внутри стены B не входит в контур", () => {
    const { a, b } = AB()
    const walls = [a, b]
    expect(segsOn(contourSegments(a, walls), "x", 0, -10, 10)).toBeCloseTo(0, 6)
    expect(segsOn(contourSegments(b, walls), "y", 10, 0, 20)).toBeCloseTo(0, 6)
    // внешний контур на месте: верхняя грань y = −10 идёт непрерывно по A и блоку B
    expect(segsOn(contourSegments(b, walls), "y", -10, 0, 20)).toBeCloseTo(20, 6)
    expect(segsOn(contourSegments(b, walls), "x", 20, -10, 10)).toBeCloseTo(20, 6)
  })

  it("DJ-5c: порядок B, A (блок у поздней A), один материал — шов скрыт, внешний контур непрерывен", () => {
    const { a, b } = AB()
    const walls = [b, a] // поздняя A владеет блоком
    const own = contourSegments(a, walls)
    expect(segsOn(own, "y", -10, 0, 20)).toBeCloseTo(20, 6) // верхняя грань блока
    expect(segsOn(own, "x", 20, -10, 10)).toBeCloseTo(20, 6) // правая грань блока
    expect(segsOn(own, "x", 0, -10, 10)).toBeCloseTo(0, 6) // граница тела A и блока внутри стены
    // шов блока и тела B (y = 10) скрыт у обеих стен: материал один
    expect(segsOn(own, "y", 10, 0, 20) + segsOn(contourSegments(b, walls), "y", 10, 0, 20)).toBeCloseTo(0, 6)
  })

  it("DJ-5d: порядок B, A, разные материалы — шов блока и тела B прямая линия, блок в контуре A", () => {
    const a = W(-100, 0, 0, 0, 20, "brick")
    const b = W(10, 10, 10, 110, 20, "concrete")
    const walls = [b, a]
    expect(wallCovers(a, walls, PB)).toBe(true) // блок у brick-стены A
    const own = contourSegments(a, walls)
    expect(segsOn(own, "y", -10, 0, 20)).toBeCloseTo(20, 6)
    expect(segsOn(own, "x", 20, -10, 10)).toBeCloseTo(20, 6)
    expect(segsOn(own, "x", 0, -10, 10)).toBeCloseTo(0, 6)
    // шов блока с телом B (y = 10, x ∈ [0, 20]) виден хотя бы у одной из стен целиком
    const seam = segsOn(own, "y", 10, 0, 20) + segsOn(contourSegments(b, walls), "y", 10, 0, 20)
    expect(seam).toBeGreaterThanOrEqual(20 - 1e-6)
  })
})

describe("DJ: диагональный угловой стык — не фиксируется", () => {
  const tilted = (deg: number): Wall => {
    const r = (deg * Math.PI) / 180
    return W(10, 10, 10 - 100 * Math.sin(r), 10 + 100 * Math.cos(r), 20)
  }

  it("DJ-6: непрямой угол (45°, 1°) — блок не заливается; в пределах допуска (0.3°) — заливается", () => {
    for (const deg of [45, 1, -1]) {
      const walls = [W(-100, 0, 0, 0, 20), tilted(deg)]
      expect(unionCovers(walls, PB), `${deg}°`).toBe(false)
    }
    for (const deg of [0.3, -0.3]) {
      const walls = [W(-100, 0, 0, 0, 20), tilted(deg)]
      expect(unionCovers(walls, PB), `${deg}°`).toBe(true)
    }
  })

  it("DJ-7: параллельные стены на диагонали — блок не заливается", () => {
    const walls = [W(-100, 0, 0, 0, 20), W(10, 10, 110, 10, 20)]
    expect(unionCovers(walls, PB)).toBe(false)
  })

  it("DJ-8: стена идёт от начала к оси A — заливки нет, области как у двух прямоугольников", () => {
    const a = W(-100, 0, 0, 0, 20)
    const b = W(10, 10, 10, -90, 20)
    const rects: Rect[] = [
      { x0: -100, y0: -10, x1: 0, y1: 10 },
      { x0: 0, y0: -90, x1: 20, y1: 10 },
    ]
    expect(mismatches([a, b], rects, BOX)).toEqual([])
  })

  it("DJ-9: третий конец в пороге — блок не заливается, построение не падает при любом порядке", () => {
    const a = W(-100, 0, 0, 0, 20)
    const b = W(10, 10, 10, 110, 20)
    const c = W(10, 10, 110, 10, 20) // конец c совпадает с S: у A два кандидата-соседа
    const orders = [
      [a, b, c],
      [a, c, b],
      [b, a, c],
      [b, c, a],
      [c, a, b],
      [c, b, a],
    ]
    for (const walls of orders) {
      deepFreeze(walls)
      expect(() => walls.forEach((w) => displayPolygons(w, walls))).not.toThrow()
      expect(unionCovers(walls, PB)).toBe(false)
    }
  })

  it("DJ-9c: третий конец только у конца A (не в пороге S) — блок не заливается, любой порядок", () => {
    // c1 заканчивается в (−5, −5), в 7 см от E; c2 — в (0, −12), в 12 см от E; от S обе дальше порога
    const variants: [Wall, Point][] = [
      [W(-5, -5, -5, -105, 20), PB],
      [W(0, -12, 0, -112, 20), { x: 15, y: -5 }],
    ]
    for (const [c, probe] of variants) {
      const a = W(-100, 0, 0, 0, 20)
      const b = W(10, 10, 10, 110, 20)
      const orders = [
        [a, b, c],
        [a, c, b],
        [b, a, c],
        [b, c, a],
        [c, a, b],
        [c, b, a],
      ]
      for (const walls of orders) {
        deepFreeze(walls)
        expect(() => walls.forEach((w) => displayPolygons(w, walls))).not.toThrow()
        expect(unionCovers(walls, probe), `${c.a.x},${c.a.y}`).toBe(false)
      }
    }
  })

  it("DJ-9d: третий конец в 12 см от S (в пороге у конца B), далеко от E — блок не заливается, любой порядок", () => {
    const variants: Wall[] = [W(22, 10, 22, 110, 20), W(10, 22, 110, 22, 20)]
    for (const c of variants) {
      const a = W(-100, 0, 0, 0, 20)
      const b = W(10, 10, 10, 110, 20)
      const orders = [
        [a, b, c],
        [a, c, b],
        [b, a, c],
        [b, c, a],
        [c, a, b],
        [c, b, a],
      ]
      for (const walls of orders) {
        deepFreeze(walls)
        expect(() => walls.forEach((w) => displayPolygons(w, walls))).not.toThrow()
        expect(unionCovers(walls, PB), `${c.a.x},${c.a.y}`).toBe(false)
      }
    }
  })
  it("DJ-18: перпендикулярная пара на диагональном расстоянии, но с другим разложением — не угол, блок не заливается", () => {
    // |S − E| = √200, как у диагонального угла, но точка пересечения осей I не на hB от E и не на hA от S
    const h = Math.sqrt(175)
    const everywhere: Rect = { x0: -130, y0: -150, x1: 60, y1: 190 }
    const cases: [string, Wall, Rect][] = [
      ["S = (5, √175), ниже", W(5, h, 5, h + 100, 20), { x0: -5, y0: h, x1: 15, y1: h + 100 }],
      ["S = (5, −√175), выше", W(5, -h, 5, -h - 100, 20), { x0: -5, y0: -h - 100, x1: 15, y1: -h }],
      ["S = (√175, 5), боковое смещение внутри полосы A", W(h, 5, h, 105, 20), { x0: h - 10, y0: 5, x1: h + 10, y1: 105 }],
    ]
    for (const [name, b, plain] of cases) {
      const a = W(-100, 0, 0, 0, 20)
      const rects: Rect[] = [{ x0: -100, y0: -10, x1: 0, y1: 10 }, plain]
      expect(mismatches([a, b], rects, everywhere), name).toEqual([])
    }
  })
})

describe("DJ: допуск смещения", () => {
  // B целиком смещена на (dx, dy) от точки S = (10, 10): dx — вдоль оси A, dy — вдоль оси B
  const shifted = (dx: number, dy: number): Wall[] => [W(-100, 0, 0, 0, 20), W(10 + dx, 10 + dy, 10 + dx, 110 + dy, 20)]

  it("DJ-10: смещение до 1.00 см включительно вдоль оси A, вдоль оси B и по обеим осям, в обе стороны — стык остаётся диагональным", () => {
    const closed: [number, number][] = [
      [0.18, 0],
      [0.99, 0],
      [-0.18, 0],
      [-0.99, 0],
      [0, 0.18],
      [0, 0.99],
      [0, -0.18],
      [0, -0.99],
      [0.9, 0.9],
      [-0.9, -0.9],
      [0.9, -0.9],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    for (const [dx, dy] of closed) expect(unionCovers(shifted(dx, dy), PB), `shift ${dx}, ${dy}`).toBe(true)
  })

  it("DJ-11: смещение 1.01 см и больше за допуском в любую сторону — блок не заливается, построение завершается", () => {
    const open: [number, number][] = [
      [1.01, 0],
      [-1.01, 0],
      [0, 1.01],
      [0, -1.01],
      [1.5, 0],
      [-1.5, 0],
      [0, 1.5],
      [0, -1.5],
    ]
    for (const [dx, dy] of open) {
      const walls = deepFreeze(shifted(dx, dy))
      expect(() => walls.forEach((w) => displayPolygons(w, walls))).not.toThrow()
      expect(unionCovers(walls, PB), `shift ${dx}, ${dy}`).toBe(false)
    }
  })
})
describe("DJ: правка стен", () => {
  const shiftRects = (rects: Rect[], dx: number, dy: number): Rect[] =>
    rects.map((r) => ({ x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy }))

  it("DJ-12a: перенос обеих стен вместе — угол остаётся закрытым", () => {
    const { a, b } = AB()
    const walls = [a, b]
    moveWalls(walls, [a, b], { x: 30, y: -20 })
    expect(mismatches(walls, shiftRects(closedL(), 30, -20), BOX)).toEqual([])
  })

  it("DJ-12c: ввод длины B (100 → 150) — блок на месте, ось соседней стены прежняя", () => {
    const { a, b } = AB()
    const walls = [a, b]
    const res = resizeWallBounded(walls, b, 150, FREE)
    expect(res.kind).toBe("applied")
    expect(b.a).toEqual({ x: 10, y: 10 })
    expect(b.b.x).toBeCloseTo(10, 6)
    expect(b.b.y).toBeCloseTo(160, 6)
    expect(a.a).toEqual({ x: -100, y: 0 })
    expect(a.b).toEqual({ x: 0, y: 0 })
    const rects = closedL()
    rects[1] = { x0: 0, y0: 10, x1: 20, y1: 160 }
    expect(mismatches(walls, rects, BOX)).toEqual([])
  })

  it("DJ-12d: растяжение A за дальний конец вдоль оси — блок на месте", () => {
    const { a, b } = AB()
    const walls = [a, b]
    moveEndpointBounded(walls, a, "a", { x: -200, y: 0 }, FREE)
    expect(a.a.x).toBeCloseTo(-200, 6)
    expect(a.b).toEqual({ x: 0, y: 0 })
    expect(b.a).toEqual({ x: 10, y: 10 })
    const rects = closedL()
    rects[0] = { x0: -200, y0: -10, x1: 0, y1: 10 }
    expect(mismatches(walls, rects, { ...BOX, x0: -230 })).toEqual([])
  })
})

describe("DJ: превью, установка, выбор, удаление", () => {
  it("DJ-13: превью (стена вне массива) показывает тот же закрытый угол, что установленная стена", () => {
    const a = W(-100, 0, 0, 0, 20)
    const placed = W(10, 10, 10, 110, 20)
    const preview = W(10, 10, 10, 110, 20)
    const previewShape = displayPolygons(preview, [a])
    const placedShape = displayPolygons(placed, [a, placed])
    const aAlone = displayPolygons(a, [a])
    const aWithPlaced = displayPolygons(a, [a, placed])
    for (const p of cells(BOX)) {
      expect(coveredBy(previewShape, p), `превью ${p.x},${p.y}`).toBe(coveredBy(placedShape, p))
      // у ранней стены превью не отнимает область
      expect(coveredBy(aWithPlaced, p)).toBe(coveredBy(aAlone, p))
    }
  })

  it("DJ-14: прилипание → сегмент по орто → установка даёт закрытый угол без вспомогательной стены", () => {
    const a = W(-100, 0, 0, 0, 20)
    const snap = snapStartVertex({ x: 8, y: 18 }, [a], snapRadiusCm(1), 10, 20)
    const ref = startRefOf(snap)
    expect(ref?.kind).toBe("face")
    const seg = chainSegment({
      start: snap.point,
      ref,
      raw: { x: 12, y: 90 },
      walls: [a],
      radiusCm: snapRadiusCm(1),
      gridStepCm: 10,
      thicknessCm: 20,
      ortho: true,
      typedAngleDeg: null,
      typedLengthCm: 100,
    })
    const b = W(snap.point.x, snap.point.y, seg.end.x, seg.end.y, 20)
    expect(b.a.x).toBeCloseTo(10, 6)
    expect(b.a.y).toBeCloseTo(10, 6)
    expect(b.b.x).toBeCloseTo(10, 6)
    expect(b.b.y).toBeCloseTo(110, 6)
    expect(mismatches([a, b], closedL(), BOX)).toEqual([])
  })

  it("DJ-15 / INV-1: данные стен не меняются отображением и выбором", () => {
    const { a, b } = AB()
    const walls = deepFreeze([a, b])
    const before = structuredClone(walls)
    walls.forEach((w) => {
      displayPolygons(w, walls)
      contourSegments(w, walls)
    })
    wallClickAction(PB, { point: PB, source: "grid" }, walls, 0)
    expect(walls).toEqual(before)
  })

  it("IC-4: клик в блоке выделяет владельца блока — позднюю стену; вне контура угла — рисует", () => {
    const { a, b } = AB()
    const inBlock = wallClickAction(PB, { point: PB, source: "grid" }, [a, b], 0)
    expect(inBlock).toEqual({ kind: "select", wall: b })
    const reversed = wallClickAction(PB, { point: PB, source: "grid" }, [b, a], 0)
    expect(reversed).toEqual({ kind: "select", wall: a })
    const outside = { x: 30, y: -5 }
    expect(wallClickAction(outside, { point: outside, source: "grid" }, [a, b], 0)).toEqual({ kind: "draw" })
  })

  it("IC-5: удаление стены штатным путём — блок удаляется вместе с владельцем, форма другой стены прежняя", () => {
    for (const order of ["ab", "ba"] as const) {
      for (const removed of ["a", "b"] as const) {
        const { a, b } = AB()
        const walls = order === "ab" ? [a, b] : [b, a]
        // контроль: до удаления угол закрыт — без этого проверка ниже вырождается
        expect(unionCovers(walls, PB), `${order}: до удаления`).toBe(true)
        const victim = removed === "a" ? a : b
        const left = deleteObjects({ walls, dimensions: [] }, { walls: [victim], dimensions: [], doorways: [] }).walls
        expect(left).toHaveLength(1)
        const kept = left[0]
        expect(kept).toBe(removed === "a" ? b : a)
        expect(unionCovers(left, PB), `${order}, удалена ${removed}`).toBe(false)
        const plain: Rect = removed === "a" ? { x0: 0, y0: 10, x1: 20, y1: 110 } : { x0: -100, y0: -10, x1: 0, y1: 10 }
        expect(mismatches(left, [plain], BOX), `${order}, удалена ${removed}`).toEqual([])
      }
    }
  })
  it("IC-6: цели прилипания считаются по контуру с блоком — наружная грань идёт до края блока", () => {
    const { a, b } = AB()
    const r = snapStartVertex({ x: 5, y: -14 }, [a, b], snapRadiusCm(1), 10, 20)
    expect(r.source).toBe("wall")
    expect(r.target).toBe("face")
    // без блока грань y = −10 кончалась бы на x = 0 и квадрат встал бы заподлицо с торцом (x = −10)
    expect(r.point.x).toBeCloseTo(5, 6)
    expect(r.point.y).toBeCloseTo(-10, 6)
  })
})

describe("DJ: независимость от ориентации (INV-8)", () => {
  const rot90 = (p: Point): Point => ({ x: -p.y, y: p.x })
  const turn =
    (deg: number) =>
    (p: Point): Point => {
      const c = Math.cos((deg * Math.PI) / 180)
      const s = Math.sin((deg * Math.PI) / 180)
      return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
    }
  const transforms: [string, (p: Point) => Point][] = [
    ["rot90", rot90],
    ["rot180", (p) => rot90(rot90(p))],
    ["rot270", (p) => rot90(rot90(rot90(p)))],
    ["mirror-x", (p) => ({ x: -p.x, y: p.y })],
    ["mirror-y", (p) => ({ x: p.x, y: -p.y })],
    // углы без совпадений центров клеток с рёбрами (тангенсы иррациональны)
    ["rot30", turn(30)],
    ["rot60", turn(60)],
  ]

  const polyOf = (r: Rect, tf: (p: Point) => Point): Point[] =>
    [
      { x: r.x0, y: r.y0 },
      { x: r.x1, y: r.y0 },
      { x: r.x1, y: r.y1 },
      { x: r.x0, y: r.y1 },
    ].map(tf)

  it("DJ-16: тот же угол, повёрнутый (в том числе на 30° и 60°) и отражённый, закрыт так же", () => {
    for (const [name, tf] of transforms) {
      const wallT = (ax: number, ay: number, bx: number, by: number): Wall => {
        const p = tf({ x: ax, y: ay })
        const q = tf({ x: bx, y: by })
        return W(p.x, p.y, q.x, q.y, 20)
      }
      const walls = [wallT(-100, 0, 0, 0), wallT(10, 10, 10, 110)]
      const polys = closedL().map((r) => polyOf(r, tf))
      const box: Rect = { x0: -125, y0: -125, x1: 125, y1: 125 }
      expect(polyMismatches(walls, polys, box), name).toEqual([])
      expect(overlapCells(walls, box), name).toEqual([])
    }
  })

  it("DJ-16b: допуск 1 см считается в системе стены, а не по осям мира — при повороте на 30° и 60°", () => {
    for (const [name, tf] of transforms.filter(([n]) => n === "rot30" || n === "rot60")) {
      for (const [dx, dy, closed] of [
        [0.99, 0, true],
        [-0.99, 0, true],
        [0, 0.99, true],
        [1.01, 0, false],
        [-1.01, 0, false],
        [0, 1.01, false],
        [0, -1.01, false],
      ] as const) {
        const e0 = tf({ x: -100, y: 0 })
        const e1 = tf({ x: 0, y: 0 })
        const b0 = tf({ x: 10 + dx, y: 10 + dy })
        const b1 = tf({ x: 10 + dx, y: 110 + dy })
        const walls = [W(e0.x, e0.y, e1.x, e1.y, 20), W(b0.x, b0.y, b1.x, b1.y, 20)]
        expect(unionCovers(walls, tf(PB)), `${name} shift ${dx}, ${dy}`).toBe(closed)
      }
    }
  })

  it("DJ-17: стены заданы в обратном направлении (концы a/b поменяны) — угол закрыт", () => {
    const walls = [W(0, 0, -100, 0, 20), W(10, 110, 10, 10, 20)]
    expect(mismatches(walls, closedL(), BOX)).toEqual([])
  })
})