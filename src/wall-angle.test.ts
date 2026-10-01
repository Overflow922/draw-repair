import { describe, expect, it } from "vitest"
import {
  angleReferenceRay,
  orthoDirection,
  parseAngleDeg,
  startRefOf,
  typedDirection,
  wallAngleDeg,
} from "./wall-angle"
import type { StartRef } from "./wall-angle"
import { snapRadiusCm, snapVertex } from "./wall-snap"
import type { Point } from "./types"
import { W, expectPoint, sceneL, sceneS } from "./wall-snap.test-utils"

// change wall-relative-angle-snap (test-plan.md): опора начала, наименьший угол к стене
// примыкания, орто-направления относительно опоры, введённый угол.

const GRID = 10
const R = snapRadiusCm(1)
const RAD = Math.PI / 180

const dirDeg = (deg: number): Point => ({ x: Math.cos(deg * RAD), y: Math.sin(deg * RAD) })
// поворот в мировых координатах (математический угол)
const rot = (v: Point, deg: number): Point => ({
  x: v.x * Math.cos(deg * RAD) - v.y * Math.sin(deg * RAD),
  y: v.x * Math.sin(deg * RAD) + v.y * Math.cos(deg * RAD),
})

const FACE_DOWN: StartRef = { kind: "face", normal: { x: 0, y: 1 } }
const CAP_RIGHT: StartRef = { kind: "cap", normal: { x: 1, y: 0 } }
// нормаль грани стены G30 (ось под 30° к экрану)
const N30: Point = { x: -Math.sin(30 * RAD), y: Math.cos(30 * RAD) }
const FACE_30: StartRef = { kind: "face", normal: N30 }

function expectDir(actual: Point | null, expected: Point): void {
  expect(actual).not.toBeNull()
  if (!actual) return
  expect(actual.x).toBeCloseTo(expected.x, 9)
  expect(actual.y).toBeCloseTo(expected.y, 9)
}

describe("startRefOf: стена примыкания из прилипания начала", () => {
  it("REF-FACE-1: начало у грани — вид «грань», нормаль наружу", () => {
    const ref = startRefOf(snapVertex({ x: 50, y: 14 }, sceneS(), R, GRID, 20))
    expect(ref?.kind).toBe("face")
    expectDir(ref?.normal ?? null, { x: 0, y: 1 })
  })

  it("REF-CAP-1: начало у свободного торца — вид «торец», нормаль вдоль оси наружу", () => {
    const ref = startRefOf(snapVertex({ x: 106, y: 0 }, sceneS(), R, GRID, 20))
    expect(ref?.kind).toBe("cap")
    expectDir(ref?.normal ?? null, { x: 1, y: 0 })
  })

  it("REF-CORNER-1: внутренний угол — опора по прилипанию, не по порядку стен", () => {
    const [a, b] = sceneL()
    for (const walls of [
      [a, b],
      [b, a],
    ]) {
      const snap = snapVertex({ x: 18, y: 12 }, walls, R, GRID, 20)
      expectPoint(snap.point, 20, 10) // квадрат на грани A вплотную к B
      const ref = startRefOf(snap)
      expect(ref?.kind).toBe("face")
      expectDir(ref?.normal ?? null, { x: 0, y: 1 })
    }
  })

  it("REF-GRID-1: свободное начало — стены примыкания нет", () => {
    const snap = snapVertex({ x: 500, y: 500 }, sceneS(), R, GRID, 20)
    expect(snap.source).toBe("grid")
    expect(startRefOf(snap)).toBeNull()
  })

  it("REF-SHAPE-1: вид примыкания — неперечислимое поле target, контракт {point, source} сохранён", () => {
    const face = snapVertex({ x: 50, y: 14 }, sceneS(), R, GRID, 20)
    expect(Object.keys(face).sort()).toEqual(["point", "source"])
    expect(face.target).toBe("face")
    const cap = snapVertex({ x: 106, y: 0 }, sceneS(), R, GRID, 20)
    expect(Object.keys(cap).sort()).toEqual(["point", "source"])
    expect(cap.target).toBe("cap")
  })
})

describe("wallAngleDeg: наименьший угол к стене примыкания", () => {
  it("ANG-FACE-1: перпендикуляр к грани — 90", () => {
    expect(wallAngleDeg(FACE_DOWN, { x: 0, y: 1 })).toBeCloseTo(90, 9)
  })

  it("ANG-FACE-2: у грани — меньший из двух углов к лучам грани", () => {
    expect(wallAngleDeg(FACE_DOWN, dirDeg(60))).toBeCloseTo(60, 9)
    expect(wallAngleDeg(FACE_DOWN, dirDeg(120))).toBeCloseTo(60, 9)
    expect(wallAngleDeg(FACE_DOWN, dirDeg(30))).toBeCloseTo(30, 9)
    expect(wallAngleDeg(FACE_DOWN, dirDeg(150))).toBeCloseTo(30, 9)
  })

  it("ANG-CAP-1: продолжение торца — 180", () => {
    expect(wallAngleDeg(CAP_RIGHT, { x: 1, y: 0 })).toBeCloseTo(180, 9)
  })

  it("ANG-CAP-2: поворот от торца в любую сторону — одинаковое значение", () => {
    expect(wallAngleDeg(CAP_RIGHT, { x: 0, y: 1 })).toBeCloseTo(90, 9)
    expect(wallAngleDeg(CAP_RIGHT, { x: 0, y: -1 })).toBeCloseTo(90, 9)
    expect(wallAngleDeg(CAP_RIGHT, dirDeg(45))).toBeCloseTo(135, 9)
    expect(wallAngleDeg(CAP_RIGHT, dirDeg(-45))).toBeCloseTo(135, 9)
    expect(wallAngleDeg(CAP_RIGHT, dirDeg(150))).toBeCloseTo(30, 9)
  })

  it("ANG-RAY-1: луч отсчёта — со стороны наименьшего угла; у торца — внутрь стены", () => {
    expectDir(angleReferenceRay(FACE_DOWN, dirDeg(60)), { x: 1, y: 0 })
    expectDir(angleReferenceRay(FACE_DOWN, dirDeg(120)), { x: -1, y: 0 })
    expectDir(angleReferenceRay(CAP_RIGHT, { x: 0, y: 1 }), { x: -1, y: 0 })
    expectDir(angleReferenceRay(CAP_RIGHT, dirDeg(30)), { x: -1, y: 0 })
  })

  it("INV-ANG-1: диапазоны — грань 0..90, торец 0..180; грань = min к двум лучам", () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const d = dirDeg(deg)
      const face = wallAngleDeg(FACE_DOWN, d)
      expect(face).toBeGreaterThanOrEqual(0)
      expect(face).toBeLessThanOrEqual(90 + 1e-9)
      const toRight = Math.acos(Math.max(-1, Math.min(1, d.x))) / RAD
      expect(face).toBeCloseTo(Math.min(toRight, 180 - toRight), 9)
      const cap = wallAngleDeg(CAP_RIGHT, d)
      expect(cap).toBeGreaterThanOrEqual(0)
      expect(cap).toBeLessThanOrEqual(180 + 1e-9)
      expect(cap).toBeCloseTo(180 - toRight, 9)
    }
  })
})

describe("orthoDirection: орто относительно стены примыкания", () => {
  it("ORTHO-FACE-1: перпендикуляр к наклонной стене", () => {
    expectDir(orthoDirection(FACE_30, rot(N30, 10)), N30)
    expectDir(orthoDirection(FACE_30, rot(N30, -10)), N30)
    // неединичный вектор курсора
    const v = rot(N30, 7)
    expectDir(orthoDirection(FACE_30, { x: v.x * 250, y: v.y * 250 }), N30)
  })

  it("ORTHO-FACE-2: допуск ровно 15° включительно, за пределами — нет", () => {
    const t15 = Math.tan(15 * RAD)
    expectDir(orthoDirection(FACE_DOWN, { x: t15, y: 1 }), { x: 0, y: 1 })
    expectDir(orthoDirection(FACE_DOWN, { x: -t15, y: 1 }), { x: 0, y: 1 })
    expect(orthoDirection(FACE_DOWN, { x: t15 + 0.001, y: 1 })).toBeNull()
    expect(orthoDirection(FACE_30, rot(N30, 15.1))).toBeNull()
  })

  it("ORTHO-FACE-3: вдоль грани не притягивается", () => {
    expect(orthoDirection(FACE_DOWN, dirDeg(10))).toBeNull()
    expect(orthoDirection(FACE_DOWN, dirDeg(170))).toBeNull()
    // внутрь стены (−normal) тоже не притягивается
    expect(orthoDirection(FACE_DOWN, { x: 0.1, y: -1 })).toBeNull()
  })

  it("ORTHO-CAP-1: продолжение от торца", () => {
    expectDir(orthoDirection(CAP_RIGHT, { x: 1, y: 0.2 }), { x: 1, y: 0 })
    expectDir(orthoDirection(CAP_RIGHT, { x: 1, y: -0.2 }), { x: 1, y: 0 })
  })

  it("ORTHO-CAP-2: поворот от торца — в сторону курсора", () => {
    expectDir(orthoDirection(CAP_RIGHT, { x: 0.2, y: 1 }), { x: 0, y: 1 })
    expectDir(orthoDirection(CAP_RIGHT, { x: 0.2, y: -1 }), { x: 0, y: -1 })
    expectDir(orthoDirection(CAP_RIGHT, { x: -0.2, y: 1 }), { x: 0, y: 1 })
  })

  it("ORTHO-CAP-3: диагональ от торца не притягивается", () => {
    expect(orthoDirection(CAP_RIGHT, { x: 1, y: 1 })).toBeNull()
    expect(orthoDirection(CAP_RIGHT, { x: 1, y: -1 })).toBeNull()
    // назад вдоль оси внутрь стены (0°) — не опорное направление
    expect(orthoDirection(CAP_RIGHT, { x: -1, y: 0.1 })).toBeNull()
  })

  it("ORTHO-FREE-1: свободное начало — оси экрана", () => {
    expectDir(orthoDirection(null, { x: 1, y: 0.2 }), { x: 1, y: 0 })
    expectDir(orthoDirection(null, { x: -0.2, y: 1 }), { x: 0, y: 1 })
    expectDir(orthoDirection(null, { x: -1, y: -0.1 }), { x: -1, y: 0 })
    expectDir(orthoDirection(null, { x: 0.1, y: -1 }), { x: 0, y: -1 })
  })

  it("ORTHO-FREE-2: свободное начало — диагональ не притягивается", () => {
    expect(orthoDirection(null, dirDeg(20))).toBeNull()
    expect(orthoDirection(null, dirDeg(-70))).toBeNull()
  })

  it("ORTHO-CAP-SLANT-1: у торца наклонной стены — относительно её оси, не экрана", () => {
    const capRef: StartRef = { kind: "cap", normal: dirDeg(30) }
    expectDir(orthoDirection(capRef, dirDeg(38)), dirDeg(30))
    expectDir(orthoDirection(capRef, dirDeg(112)), dirDeg(120))
    expect(orthoDirection(capRef, dirDeg(5))).toBeNull()
  })
})

describe("typedDirection: введённый угол", () => {
  it("TYPED-FACE-1: угол у грани — сторона по курсору", () => {
    expectDir(typedDirection(FACE_DOWN, 60, { x: 1, y: 1 }), dirDeg(60))
    expectDir(typedDirection(FACE_DOWN, 90, { x: 1, y: 1 }), { x: 0, y: 1 })
    expectDir(typedDirection(FACE_DOWN, 90, { x: -3, y: 1 }), { x: 0, y: 1 })
    expectDir(typedDirection(FACE_DOWN, 30, { x: 5, y: 1 }), dirDeg(30))
  })

  it("TYPED-FACE-2: курсор на другой стороне перпендикуляра — зеркальное направление", () => {
    expectDir(typedDirection(FACE_DOWN, 60, { x: -1, y: 1 }), dirDeg(120))
    expectDir(typedDirection(FACE_30, 60, rot(N30, 20)), rot(N30, 30))
    expectDir(typedDirection(FACE_30, 60, rot(N30, -20)), rot(N30, -30))
  })

  it("TYPED-CAP-1: угол у торца — наименьший угол к стене, сторона по курсору", () => {
    expectDir(typedDirection(CAP_RIGHT, 180, { x: 0.5, y: 1 }), { x: 1, y: 0 })
    expectDir(typedDirection(CAP_RIGHT, 90, { x: 0.5, y: 1 }), { x: 0, y: 1 })
    expectDir(typedDirection(CAP_RIGHT, 90, { x: 0.5, y: -1 }), { x: 0, y: -1 })
    expectDir(typedDirection(CAP_RIGHT, 135, { x: 1, y: 1 }), dirDeg(45))
    expectDir(typedDirection(CAP_RIGHT, 135, { x: 1, y: -1 }), dirDeg(-45))
    expectDir(typedDirection(CAP_RIGHT, 30, { x: -1, y: 0.1 }), dirDeg(150))
  })

  it("TYPED-RANGE-1: диапазоны — грань (0, 90], торец (0, 180]", () => {
    const v = { x: 1, y: 1 }
    expect(typedDirection(FACE_DOWN, 0, v)).toBeNull()
    expect(typedDirection(FACE_DOWN, -10, v)).toBeNull()
    expect(typedDirection(FACE_DOWN, 90.0001, v)).toBeNull()
    expect(typedDirection(FACE_DOWN, 120, v)).toBeNull()
    expectDir(typedDirection(FACE_DOWN, 0.5, v), dirDeg(0.5))
    expectDir(typedDirection(FACE_DOWN, 90, v), { x: 0, y: 1 })
    expectDir(typedDirection(CAP_RIGHT, 180, v), { x: 1, y: 0 })
    expectDir(typedDirection(CAP_RIGHT, 120, v), dirDeg(60))
    expect(typedDirection(CAP_RIGHT, 180.5, v)).toBeNull()
    expect(typedDirection(CAP_RIGHT, 0, v)).toBeNull()
    expect(typedDirection(CAP_RIGHT, Number.NaN, v)).toBeNull()
  })

  it("TYPED-TIE-1: курсор на разделяющей линии — поворот против часовой на экране", () => {
    // y вниз: против часовой на экране от луча (−1,0) — к (0,1)
    expectDir(typedDirection(CAP_RIGHT, 90, { x: 1, y: 0 }), { x: 0, y: 1 })
    expectDir(typedDirection(CAP_RIGHT, 45, { x: 1, y: 0 }), { x: -Math.cos(45 * RAD), y: Math.sin(45 * RAD) })
    // у грани луч, от которого поворот против часовой проходит через свободную сторону, — (−1,0)
    expectDir(typedDirection(FACE_DOWN, 60, { x: 0, y: 1 }), dirDeg(120))
  })
})

describe("parseAngleDeg: разбор введённого угла", () => {
  it("PARSE-1: запятая и точка равнозначны, нечисловое — null", () => {
    expect(parseAngleDeg("90")).toBe(90)
    expect(parseAngleDeg("45,5")).toBe(45.5)
    expect(parseAngleDeg("45.5")).toBe(45.5)
    expect(parseAngleDeg("-10")).toBe(-10)
    expect(parseAngleDeg("")).toBeNull()
    expect(parseAngleDeg("abc")).toBeNull()
    expect(parseAngleDeg("  ")).toBeNull()
  })
})

// контроль сцены: стена G30 с гранью, нормаль которой — N30
describe("контроль фикстур", () => {
  it("нормаль грани G30 совпадает с прилипанием начала", () => {
    const g = W(0, 0, 100 * Math.cos(30 * RAD), 100 * Math.sin(30 * RAD))
    const mid = { x: 50 * Math.cos(30 * RAD) + 14 * N30.x, y: 50 * Math.sin(30 * RAD) + 14 * N30.y }
    const ref = startRefOf(snapVertex(mid, [g], R, GRID, 20))
    expect(ref?.kind).toBe("face")
    expectDir(ref?.normal ?? null, N30)
  })
})
