import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { snapRadiusCm } from "./wall-snap"
import { edgeLengthCm } from "./wall-length"
import { mergeContinuation } from "./wall-merge"
import { displayPolygons } from "./wall-geometry"
import type { Scene } from "./history"
import type { Wall } from "./types"
import { CAP_REF, E, expectPoint, wall } from "./wall-length.test-utils"

// change collinear-axes-meet (spec wall-drawing «Оси коллинеарного продолжения сходятся», length-input
// «Длина стены от кромки до кромки»): ось стены, продолжающей свободный торец, сходится с осью ранней стены.
// Числа — из сценариев спецификации.

function segment(over: Partial<ChainInput> & Pick<ChainInput, "start" | "ref" | "raw" | "walls">): ChainSegment {
  return chainSegment({
    radiusCm: snapRadiusCm(1),
    gridStepCm: 10,
    thicknessCm: 20,
    ortho: false,
    typedAngleDeg: null,
    typedLengthCm: null,
    ...over,
  })
}

// первый клик у центра торца E (x = 500): вершина в центре квадрата (510, 0)
const CENTER = { x: 510, y: 0 }

// наименьшая и наибольшая координата тела стены вдоль оси x
const bodyX = (w: Wall, walls: Wall[]): [number, number] => {
  const xs = displayPolygons(w, walls).flatMap((poly) => poly.map((p) => p.x))
  return [Math.min(...xs), Math.max(...xs)]
}

describe("начало оси сегмента вдоль оси торца", () => {
  it("CM-1: заданное направление (орто) — ось от (500, 0), а не из центра квадрата", () => {
    const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 700, y: 4 }, walls: [E()], ortho: true })
    expectPoint(seg.start, 500, 0)
    expectPoint(seg.end, 700, 0)
  })

  it("CM-2: направление не задано, курсор на оси — ось от (500, 0)", () => {
    const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 700, y: 0 }, walls: [E()] })
    expectPoint(seg.start, 500, 0)
    expectPoint(seg.end, 700, 0)
  })

  it("CM-3: введённая длина 4000 мм — ось от (500, 0) до (900, 0), длина оси равна введённой", () => {
    const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 700, y: 3 }, walls: [E()], ortho: true, typedLengthCm: 400 })
    expectPoint(seg.start, 500, 0)
    expectPoint(seg.end, 900, 0)
  })

  it("CM-4: другая толщина (10 см), ввод 150 — ось (500, 0)–(650, 0), тело x ∈ [500, 650], y ∈ [−5, 5]", () => {
    const seg = segment({ start: { x: 505, y: 0 }, ref: CAP_REF, raw: { x: 700, y: 2 }, walls: [E()], ortho: true, thicknessCm: 10, typedLengthCm: 150 })
    expectPoint(seg.start, 500, 0)
    expectPoint(seg.end, 650, 0)
    const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 10, "blocks")
    const pts = displayPolygons(n, [E(), n]).flat()
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(500, 6)
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(650, 6)
    expect(Math.max(...pts.map((p) => Math.abs(p.y)))).toBeCloseTo(5, 6)
  })

  it("CM-5: заподлицо с гранью — ось (0, 10)–(110, 10), тело x ∈ [0, 110], длина кромка-кромка равна оси", () => {
    const early = wall("A", -100, 0, 0, 0, 40)
    const ref = { kind: "cap" as const, normal: { x: 1, y: 0 }, anchor: { x: 0, y: 10 } }
    const seg = segment({ start: { x: 10, y: 10 }, ref, raw: { x: 100, y: 10 }, walls: [early], ortho: true, typedLengthCm: 110 })
    expectPoint(seg.start, 0, 10)
    expectPoint(seg.end, 110, 10)
    const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 20, "blocks")
    const walls = [early, n]
    const [lo, hi] = bodyX(n, walls)
    expect(lo).toBeCloseTo(0, 6)
    expect(hi).toBeCloseTo(110, 6)
    expect(edgeLengthCm(n, walls)).toBeCloseTo(110, 6)
  })

  it("CM-6: стена, построенная по сегменту, имеет тело от плоскости торца до конца и длину кромка-кромка = оси", () => {
    for (const typed of [10.5, 55.5, 151.2, 400, 1234.5]) {
      const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 700, y: 3 }, walls: [E()], ortho: true, typedLengthCm: typed })
      const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 20, "blocks")
      const walls = [E(), n]
      const [lo, hi] = bodyX(n, walls)
      expect(lo, `typed ${typed}`).toBeCloseTo(500, 6)
      expect(hi - lo, `typed ${typed}`).toBeCloseTo(typed, 6)
      expect(edgeLengthCm(n, walls), `typed ${typed}`).toBeCloseTo(typed, 6)
    }
  })

  it("CM-7: введено 10 (прежний выступ) — ввод применяется как есть: конец в (510, 0)", () => {
    const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 700, y: 3 }, walls: [E()], ortho: true, typedLengthCm: 10 })
    expectPoint(seg.end, 510, 0)
  })

  it("CM-8: слияние с E того же материала при введённых 400 — E удлиняется до (900, 0) ровно на 400", () => {
    const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 700, y: 3 }, walls: [E()], ortho: true, typedLengthCm: 400 })
    const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 20, "brick")
    const scene: Scene = { walls: [E()], dimensions: [] }
    const r = mergeContinuation(scene, n)
    expect(r.kind).toBe("merged")
    if (r.kind !== "merged") return
    expectPoint(r.scene.walls[0].a, 0, 0)
    expectPoint(r.scene.walls[0].b, 900, 0)
    expect(r.scene.walls).toHaveLength(1)
  })
})

describe("начало оси — как раньше, когда продолжения нет", () => {
  it("CM-9: поворот на 90° от торца — начало в центре квадрата (510, 0)", () => {
    const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 505, y: 200 }, walls: [E()], ortho: true, typedLengthCm: 300 })
    expectPoint(seg.start, 510, 0)
    expectPoint(seg.end, 510, 300)
  })

  it("CM-10: направление 45° от торца — начало в центре квадрата", () => {
    const seg = segment({ start: CENTER, ref: CAP_REF, raw: { x: 610, y: 100 }, walls: [E()], typedAngleDeg: null, ortho: false })
    expectPoint(seg.start, 510, 0)
  })

  it("CM-11: свободное начало без опоры — ось от начала", () => {
    const seg = segment({ start: { x: 0, y: 300 }, ref: null, raw: { x: 50, y: 302 }, walls: [E()], ortho: true, typedLengthCm: 400 })
    expectPoint(seg.start, 0, 300)
    expectPoint(seg.end, 400, 300)
  })
})

describe("свободный конец у торца другой стены", () => {
  // торец B (бетон) на x = 500, ось горизонтальна; начало цепочки свободно левее
  const B = (): Wall => wall("B", 500, 0, 800, 0, 20, "concrete")

  it("CM-12: сегмент вдоль оси без заданного направления — конец в плоскости торца (500, 0)", () => {
    const seg = segment({ start: { x: 100, y: 0 }, ref: null, raw: { x: 492, y: 1 }, walls: [B()] })
    expect(seg.snap.source).toBe("wall")
    expectPoint(seg.start, 100, 0)
    expectPoint(seg.end, 500, 0)
  })

  it("CM-13: при заданном направлении (орто) конец в плоскости торца, как прежде", () => {
    const seg = segment({ start: { x: 100, y: 0 }, ref: null, raw: { x: 495, y: 2 }, walls: [B()], ortho: true })
    expectPoint(seg.end, 500, 0)
  })

  it("CM-14: тело новой стены доходит до плоскости торца B без наложения и щели", () => {
    const seg = segment({ start: { x: 100, y: 0 }, ref: null, raw: { x: 492, y: 1 }, walls: [B()] })
    const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 20, "brick")
    const walls = [n, B()]
    expect(bodyX(n, walls)[1]).toBeCloseTo(500, 6)
    expect(edgeLengthCm(n, walls)).toBeCloseTo(400, 6)
  })
})
