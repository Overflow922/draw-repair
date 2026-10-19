import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { mergeContinuation } from "./wall-merge"
import { rulerReading } from "./ruler"
import type { RulerReading } from "./ruler"
import { snapRadiusCm } from "./wall-snap"
import { edgeLengthCm } from "./wall-length"
import type { Scene } from "./history"
import type { Point, Wall } from "./types"
import { CAP_REF, E, FACE_REF, bodyExtentAlongAxis, expectPoint, wall } from "./wall-length.test-utils"

// change fix-collinear-edge-to-edge-length (specs length-input «Фиксация вершины по введённой длине»,
// ruler-tool «Замер стены по оси»): введённая длина — от кромки до кромки; слияние, видимое тело и линейка
// согласованы с ней. Числа выведены из спецификации и геометрии сцен.

const START: Point = { x: 510, y: 0 }

function segment(over: Partial<ChainInput> & Pick<ChainInput, "start" | "ref" | "raw" | "walls">): ChainSegment {
  return chainSegment({
    radiusCm: snapRadiusCm(1),
    gridStepCm: 10,
    thicknessCm: 20,
    ortho: true,
    typedAngleDeg: null,
    typedLengthCm: null,
    ...over,
  })
}

// конец сегмента от торца E вдоль оси с введённой длиной typed (см)
const alongAxis = (typed: number | null, thicknessCm = 20, start = START): ChainSegment =>
  segment({ start, ref: CAP_REF, raw: { x: start.x + 190, y: 5 }, walls: [E()], thicknessCm, typedLengthCm: typed })

const asWall = (r: RulerReading) => {
  if (r.kind !== "wall") throw new Error(`ожидался замер стены, получен ${r.kind}`)
  return r
}

describe("введённая длина при рисовании — от плоскости торца", () => {
  it("TL-1: 4000 мм вдоль оси от торца E — конец в (900, 0), ось 400", () => {
    const seg = alongAxis(400)
    expectPoint(seg.end, 900, 0)
  })

  it("TL-1a: введённое значение даёт длину кромка-кромка новой стены ровно L (круговое свойство)", () => {
    for (const typed of [10.5, 55.5, 151.2, 400, 1234.5]) {
      const seg = alongAxis(typed)
      const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 20, "blocks")
      expect(edgeLengthCm(n, [E(), n]), `typed ${typed}`).toBeCloseTo(typed, 6)
    }
  })

  it("TL-2: поперёк оси от торца — длина по оси, как прежде", () => {
    const seg = segment({ start: START, ref: CAP_REF, raw: { x: 505, y: 200 }, walls: [E()], typedLengthCm: 300 })
    expectPoint(seg.end, 510, 300)
  })

  it("TL-3: введено 10 — ось от плоскости торца, конец в (510, 0): ввод применяется как есть", () => {
    expectPoint(alongAxis(10).end, 510, 0)
  })

  it("TL-3a: введено 5 — конец в (505, 0)", () => {
    expectPoint(alongAxis(5).end, 505, 0)
  })

  it("TL-3b: введено 10.01 — конец в (510.01, 0)", () => {
    expectPoint(alongAxis(10.01).end, 510.01, 0)
  })

  it("TL-4: свободное начало без опоры — длина по оси от начала", () => {
    const seg = segment({ start: { x: 0, y: 300 }, ref: null, raw: { x: 50, y: 302 }, walls: [E()], typedLengthCm: 400 })
    expectPoint(seg.end, 400, 300)
  })

  it("TL-4a: начало у грани (опора — грань) — длина по оси от начала", () => {
    const seg = segment({ start: { x: 250, y: 10 }, ref: FACE_REF, raw: { x: 252, y: 150 }, walls: [E()], typedLengthCm: 100 })
    expectPoint(seg.end, 250, 110)
  })

  it("TL-5: толщина 195 мм, ввод 1512 мм — конец на 1512 мм от плоскости торца", () => {
    const seg = alongAxis(151.2, 19.5, { x: 509.75, y: 0 })
    expectPoint(seg.end, 651.2, 0)
  })

  it("TL-6: без введённой длины сегмент следует за курсором, а не за выступом", () => {
    const seg = alongAxis(null)
    expect(seg.end.y).toBeCloseTo(0, 6)
    expect(seg.end.x).toBeGreaterThan(START.x + 100)
  })
})

describe("слияние, видимое тело и линейка согласованы с введённой длиной", () => {
  it("MG-1: слияние с E того же материала удлиняет её ровно на введённые 400 см", () => {
    const seg = alongAxis(400)
    const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 20, "brick")
    const scene: Scene = { walls: [E()], dimensions: [] }
    const before = edgeLengthCm(scene.walls[0], scene.walls)
    const r = mergeContinuation(scene, n)
    expect(r.kind).toBe("merged")
    if (r.kind !== "merged") return
    const merged = r.scene.walls[0]
    expectPoint(merged.a, 0, 0)
    expectPoint(merged.b, 900, 0)
    expect(edgeLengthCm(merged, r.scene.walls) - before).toBeCloseTo(400, 6)
    expect(r.scene.walls).toHaveLength(1)
  })

  it("BE-1: тело новой стены после ввода 4000 мм занимает ровно 400 см вдоль оси — размер между углами", () => {
    const seg = alongAxis(400)
    const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 20, "blocks")
    const walls = [E(), n]
    expect(bodyExtentAlongAxis(n, walls)).toBeCloseTo(400, 4)
    expect(edgeLengthCm(n, walls)).toBeCloseTo(400, 6)
  })

  it("BE-2: сцена из обращения — стена 19.5 см, ввод 1512 мм: тело и линейка показывают 151.2", () => {
    const early = wall("E", 0, 0, 500, 0, 19.5)
    const start = { x: 509.75, y: 0 }
    const seg = segment({ start, ref: CAP_REF, raw: { x: 700, y: 3 }, walls: [early], thicknessCm: 19.5, typedLengthCm: 151.2 })
    const n = wall("N", seg.start.x, seg.start.y, seg.end.x, seg.end.y, 19.5, "blocks")
    const walls = [early, n]
    expect(bodyExtentAlongAxis(n, walls)).toBeCloseTo(151.2, 4)
    const r = asWall(rulerReading({ x: 600, y: 0 }, walls))
    expect(r.lengthCm).toBeCloseTo(151.2, 6)
  })

  it("RL-1: линейка над N идёт от кромки (500, 0) до (900, 0) и показывает 400", () => {
    const n = wall("N", 510, 0, 900, 0, 20, "blocks")
    const r = asWall(rulerReading({ x: 700, y: 0 }, [E(), n]))
    expect(r.wall).toBe(n)
    expectPoint(r.from, 500, 0, 5)
    expectPoint(r.to, 900, 0, 5)
    expect(r.lengthCm).toBeCloseTo(400, 6)
  })

  it("RL-1a: стена построена в обратном направлении — линия от (900, 0) до кромки (500, 0)", () => {
    const rev = wall("N", 900, 0, 510, 0, 20, "blocks")
    const r = asWall(rulerReading({ x: 700, y: 0 }, [E(), rev]))
    expectPoint(r.from, 900, 0, 5)
    expectPoint(r.to, 500, 0, 5)
    expect(r.lengthCm).toBeCloseTo(400, 6)
  })

  it("RL-2: линейка над ранней стеной E не меняется — (0, 0)–(500, 0), 500", () => {
    const n = wall("N", 510, 0, 900, 0, 20, "blocks")
    const walls = [E(), n]
    const r = asWall(rulerReading({ x: 200, y: 0 }, walls))
    expect(r.wall).toBe(walls[0])
    expectPoint(r.from, 0, 0, 5)
    expectPoint(r.to, 500, 0, 5)
    expect(r.lengthCm).toBeCloseTo(500, 6)
  })

  it("RL-3: угловой стык — линейка по оси, как прежде", () => {
    const c: Wall = wall("C", 500, 0, 500, 300)
    const r = asWall(rulerReading({ x: 500, y: 200 }, [E(), c]))
    expect(r.wall).toBe(c)
    expectPoint(r.from, 500, 0, 5)
    expectPoint(r.to, 500, 300, 5)
    expect(r.lengthCm).toBeCloseTo(300, 6)
  })

  it("RL-4: одиночная стена — линия по оси и длина оси", () => {
    const only = wall("S", 0, 0, 420, 0)
    const r = asWall(rulerReading({ x: 200, y: 0 }, [only]))
    expectPoint(r.from, 0, 0, 5)
    expectPoint(r.to, 420, 0, 5)
    expect(r.lengthCm).toBeCloseTo(420, 6)
  })
})
