import { describe, expect, it } from "vitest"
import type { Point } from "./types"
import type { VertexSnap } from "./wall-snap"
import { endInCapPlane, startInCapPlane } from "./wall-axes-meet"
import { CAP_REF, FACE_REF, expectPoint } from "./wall-length.test-utils"
import { parseStore, serializeStore } from "./storage"
import type { DrawingStore, Wall } from "./types"
import { edgeLengthCm } from "./wall-length"
import { collinearGapCm } from "./wall-geometry"

// change collinear-axes-meet (spec wall-drawing «Оси коллинеарного продолжения сходятся», design D1–D3):
// конец оси коллинеарного продолжения переносится вдоль направления в плоскость торца.

const RAD = Math.PI / 180
const dirDeg = (deg: number): Point => ({ x: Math.cos(deg * RAD), y: Math.sin(deg * RAD) })

describe("начало оси у торца", () => {
  it("AM-1: сегмент вдоль оси от торца — начало из центра квадрата (510, 0) в плоскость торца (500, 0)", () => {
    expectPoint(startInCapPlane({ x: 510, y: 0 }, { x: 1, y: 0 }, CAP_REF), 500, 0)
  })

  it("AM-2: толщина 195 мм — центр квадрата (509.75, 0), начало в (500, 0)", () => {
    expectPoint(startInCapPlane({ x: 509.75, y: 0 }, { x: 1, y: 0 }, CAP_REF), 500, 0)
  })

  it("AM-3: заподлицо с гранью — поперечное смещение сохраняется: (10, 10) → (0, 10)", () => {
    const ref = { kind: "cap" as const, normal: { x: 1, y: 0 }, anchor: { x: 0, y: 10 } }
    expectPoint(startInCapPlane({ x: 10, y: 10 }, { x: 1, y: 0 }, ref), 0, 10)
  })

  it("AM-4: направление в допуске 0.4° — начало в плоскости торца, на линии сегмента", () => {
    const dir = dirDeg(0.4)
    const start = { x: 510, y: 0 }
    const moved = startInCapPlane(start, dir, CAP_REF)
    // на линии сегмента и в плоскости, перпендикулярной ему, через конец оси ранней стены (500, 0)
    expect((moved.x - start.x) * dir.y - (moved.y - start.y) * dir.x).toBeCloseTo(0, 9)
    expect((moved.x - 500) * dir.x + moved.y * dir.y).toBeCloseTo(0, 9)
    expect(moved.x).toBeLessThan(510)
  })

  it("AM-5: направление за допуском 0.6° — начало не меняется", () => {
    expect(startInCapPlane({ x: 510, y: 0 }, dirDeg(0.6), CAP_REF)).toEqual({ x: 510, y: 0 })
  })

  it("AM-6: поперёк оси и назад на тело ранней стены — начало не меняется", () => {
    for (const dir of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: -1, y: 0 }]) {
      expect(startInCapPlane({ x: 510, y: 0 }, dir, CAP_REF)).toEqual({ x: 510, y: 0 })
    }
  })

  it("AM-7: опора — грань, торец без конца оси или нет опоры — начало не меняется", () => {
    expect(startInCapPlane({ x: 250, y: 10 }, { x: 0, y: 1 }, FACE_REF)).toEqual({ x: 250, y: 10 })
    expect(startInCapPlane({ x: 510, y: 0 }, { x: 1, y: 0 }, { kind: "cap", normal: { x: 1, y: 0 } })).toEqual({ x: 510, y: 0 })
    expect(startInCapPlane({ x: 510, y: 0 }, { x: 1, y: 0 }, null)).toEqual({ x: 510, y: 0 })
  })

  it("AM-8: начало уже в плоскости торца — не меняется", () => {
    expect(startInCapPlane({ x: 500, y: 0 }, { x: 1, y: 0 }, CAP_REF)).toEqual({ x: 500, y: 0 })
  })
})

// торец стены B на x = 500, наружная нормаль (−1, 0); центр квадрата — (490, 0), середина приставленной стороны — (500, 0)
const capSnap = (point: Point, base: Point): VertexSnap => ({ point, source: "wall", normal: { x: -1, y: 0 }, target: "cap", base })

describe("свободный конец у торца", () => {
  it("AM-9: сегмент вдоль оси к торцу — конец из центра квадрата (490, 0) в плоскость торца (500, 0)", () => {
    const snap = capSnap({ x: 490, y: 0 }, { x: 500, y: 0 })
    expectPoint(endInCapPlane(snap.point, { x: 1, y: 0 }, snap), 500, 0)
  })

  it("AM-10: заподлицо с гранью — поперечное смещение сохраняется", () => {
    const snap = capSnap({ x: 490, y: 10 }, { x: 500, y: 10 })
    expectPoint(endInCapPlane(snap.point, { x: 1, y: 0 }, snap), 500, 10)
  })

  it("AM-11: направление за допуском 0.6° — конец не меняется", () => {
    const snap = capSnap({ x: 490, y: 0 }, { x: 500, y: 0 })
    expect(endInCapPlane(snap.point, dirDeg(0.6), snap)).toEqual({ x: 490, y: 0 })
  })

  it("AM-12: конец не прилип к торцу (грань, сетка) или не совпал с точкой прилипания — не меняется", () => {
    const grid: VertexSnap = { point: { x: 490, y: 0 }, source: "grid" }
    expect(endInCapPlane(grid.point, { x: 1, y: 0 }, grid)).toEqual({ x: 490, y: 0 })
    const face: VertexSnap = { point: { x: 490, y: 0 }, source: "wall", normal: { x: 0, y: 1 }, target: "face", base: { x: 490, y: 10 } }
    expect(endInCapPlane(face.point, { x: 1, y: 0 }, face)).toEqual({ x: 490, y: 0 })
    const cap = capSnap({ x: 490, y: 0 }, { x: 500, y: 0 })
    expect(endInCapPlane({ x: 400, y: 0 }, { x: 1, y: 0 }, cap)).toEqual({ x: 400, y: 0 })
  })

  it("AM-13: при заданном направлении конец уже в плоскости — не меняется", () => {
    const snap = capSnap({ x: 500, y: 0 }, { x: 500, y: 0 })
    expect(endInCapPlane(snap.point, { x: 1, y: 0 }, snap)).toEqual({ x: 500, y: 0 })
  })
})

describe("ранее сохранённый чертёж с зазором осей", () => {
  const stored = (): DrawingStore => ({
    version: 3,
    activeId: "d",
    drawings: [
      {
        id: "d",
        name: "d",
        walls: [
          { id: "E", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "concrete" },
          { id: "N", a: { x: 510, y: 0 }, b: { x: 900, y: 0 }, thicknessCm: 20, type: "brick" },
        ],
        dimensions: [],
        view: { zoom: 1, pan: { x: 0, y: 0 } },
      },
    ],
  })

  it("AM-14: после загрузки оси идентичны сохранённым, зазор и длина кромка-кромка читаются по прежним правилам", () => {
    const loaded = parseStore(serializeStore(stored()))
    const walls: Wall[] = loaded?.store.drawings[0]?.walls ?? []
    expect(walls.map((w) => [w.a, w.b])).toEqual([
      [{ x: 0, y: 0 }, { x: 500, y: 0 }],
      [{ x: 510, y: 0 }, { x: 900, y: 0 }],
    ])
    const [early, late] = walls
    if (!early || !late) throw new Error("стены не загружены")
    expect(collinearGapCm(late, "a", walls)).toBeCloseTo(10, 6)
    expect(edgeLengthCm(late, walls)).toBeCloseTo(400, 6)
    expect(edgeLengthCm(early, walls)).toBeCloseTo(500, 6)
  })
})