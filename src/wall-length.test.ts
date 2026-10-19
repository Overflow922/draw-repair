import { describe, expect, it } from "vitest"
import { axisLengthForEdgeCm, edgeLengthCm, endOverhangCm } from "./wall-length"
import { resizeWallBounded } from "./wall-edit"
import { FREE } from "./wall-edit.test-utils"
import type { Wall } from "./types"
import { E, N, bodyExtentAlongAxis, expectPoint, wall } from "./wall-length.test-utils"

// change fix-collinear-edge-to-edge-length (specs length-input «Длина стены от кромки до кромки»,
// design D1, D2, D5): выступ торца, длина кромка-кромка, ввод длины выделенной стены — для стен сохранённых
// чертежей с зазором осей. Новые стены выступа не имеют (change collinear-axes-meet, wall-chain-axes-meet.test.ts).

const rad = (deg: number): number => (deg * Math.PI) / 180

describe("выступ торца и длина стены от кромки до кромки", () => {
  it("OH-1: у поздней стены коллинеарного продолжения выступ начала — расстояние от вершины до конца оси ранней", () => {
    const walls = [E(), N()]
    expect(endOverhangCm(walls[1], "a", walls)).toBeCloseTo(10, 6)
    expect(endOverhangCm(walls[1], "b", walls)).toBe(0)
  })

  it("OH-2: у ранней стены выступа нет ни на одном конце", () => {
    const walls = [E(), N()]
    expect(endOverhangCm(walls[0], "a", walls)).toBe(0)
    expect(endOverhangCm(walls[0], "b", walls)).toBe(0)
  })

  it("OH-3: длина = ось + выступы: N — 400, E — 500", () => {
    const walls = [E(), N()]
    expect(edgeLengthCm(walls[1], walls)).toBeCloseTo(400, 6)
    expect(edgeLengthCm(walls[0], walls)).toBeCloseTo(500, 6)
  })

  it("OH-4: стена построена в обратном направлении — выступ на конце b", () => {
    const rev = wall("N", 900, 0, 510, 0, 20, "blocks")
    const walls = [E(), rev]
    expect(endOverhangCm(rev, "a", walls)).toBe(0)
    expect(endOverhangCm(rev, "b", walls)).toBeCloseTo(10, 6)
    expect(edgeLengthCm(rev, walls)).toBeCloseTo(400, 6)
  })

  it("OH-5: угловой стык — выступа нет, длина по оси", () => {
    const c = wall("C", 500, 0, 500, 300)
    const walls = [E(), c]
    for (const w of walls) for (const end of ["a", "b"] as const) expect(endOverhangCm(w, end, walls)).toBe(0)
    expect(edgeLengthCm(c, walls)).toBeCloseTo(300, 6)
    expect(edgeLengthCm(walls[0], walls)).toBeCloseTo(500, 6)
  })

  it("OH-6: T-примыкание — выступа нет, длина по оси", () => {
    const stem = wall("V", 250, 10, 250, 300)
    const through = wall("H", 0, 0, 500, 0)
    const walls = [through, stem]
    for (const w of walls) for (const end of ["a", "b"] as const) expect(endOverhangCm(w, end, walls)).toBe(0)
    expect(edgeLengthCm(stem, walls)).toBeCloseTo(290, 6)
  })

  it("OH-7: одиночная стена — выступа нет", () => {
    const only = wall("S", 0, 0, 420, 0)
    expect(endOverhangCm(only, "a", [only])).toBe(0)
    expect(endOverhangCm(only, "b", [only])).toBe(0)
    expect(edgeLengthCm(only, [only])).toBeCloseTo(420, 6)
  })

  it("OH-8: выступ принадлежит стене, стоящей позже в массиве — так же, как достраивается тело", () => {
    const walls = [N(), E()]
    expect(endOverhangCm(walls[1], "b", walls)).toBeCloseTo(10, 6)
    expect(endOverhangCm(walls[0], "a", walls)).toBe(0)
    expect(edgeLengthCm(walls[1], walls)).toBeCloseTo(510, 6)
  })

  it("OH-9: длина равна протяжённости отображаемого тела вдоль оси", () => {
    for (const walls of [[E(), N()], [N(), E()]]) {
      for (const w of walls) expect(edgeLengthCm(w, walls)).toBeCloseTo(bodyExtentAlongAxis(w, walls), 4)
    }
  })

  it("OH-10: зазор на пороге jointTol (10 см при толщине 20) — выступ 10", () => {
    const n = wall("N", 510, 0, 900, 0, 20, "blocks")
    expect(endOverhangCm(n, "a", [E(), n])).toBeCloseTo(10, 6)
  })

  it("OH-11: зазор за порогом (10.5 см) — свободный конец, выступа нет, длина по оси", () => {
    const n = wall("N", 510.5, 0, 900, 0, 20, "blocks")
    const walls = [E(), n]
    expect(endOverhangCm(n, "a", walls)).toBe(0)
    expect(edgeLengthCm(n, walls)).toBeCloseTo(389.5, 6)
  })

  it("OH-12: почти коллинеарный стык (3°) — выступа нет", () => {
    const len = 390
    const n = wall("N", 510, 0, 510 + len * Math.cos(rad(3)), len * Math.sin(rad(3)), 20, "blocks")
    const walls = [E(), n]
    expect(endOverhangCm(n, "a", walls)).toBe(0)
    expect(edgeLengthCm(n, walls)).toBeCloseTo(len, 6)
  })

  it("OH-13: в вершине сходятся концы трёх стен — плоские торцы, выступа нет", () => {
    const q = wall("Q", 500, 0, 500, 200)
    const walls = [E(), q, N()]
    expect(endOverhangCm(walls[2], "a", walls)).toBe(0)
    expect(edgeLengthCm(walls[2], walls)).toBeCloseTo(390, 6)
  })

  it("OH-14: длина не меньше длины оси у любой стены сцены", () => {
    const walls: Wall[] = [E(), N(), wall("C", 900, 0, 900, 300), wall("T", 100, 10, 100, 200)]
    for (const w of walls) expect(edgeLengthCm(w, walls)).toBeGreaterThanOrEqual(Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) - 1e-9)
  })

  it("OH-15: выступ — расстояние до конца оси ранней, а не полтолщины: зазор 4 при толщине 20", () => {
    const n = wall("N", 504, 0, 900, 0, 20, "blocks")
    const walls = [E(), n]
    expect(endOverhangCm(n, "a", walls)).toBeCloseTo(4, 6)
    expect(edgeLengthCm(n, walls)).toBeCloseTo(400, 6)
    expect(bodyExtentAlongAxis(n, walls)).toBeCloseTo(400, 4)
  })

  it("OH-16: стены разной толщины (30 и 10), зазор 12 — выступ 12, длина равна телу", () => {
    const early = wall("E", 0, 0, 500, 0, 30)
    const n = wall("N", 512, 0, 900, 0, 10, "blocks")
    const walls = [early, n]
    expect(endOverhangCm(n, "a", walls)).toBeCloseTo(12, 6)
    expect(edgeLengthCm(n, walls)).toBeCloseTo(400, 6)
    expect(bodyExtentAlongAxis(n, walls)).toBeCloseTo(400, 4)
  })

  it("OH-17: перпендикулярный стык с зазором 6 — выступа нет, длина по оси", () => {
    const c = wall("C", 500, 6, 500, 300)
    const walls = [E(), c]
    expect(endOverhangCm(c, "a", walls)).toBe(0)
    expect(edgeLengthCm(c, walls)).toBeCloseTo(294, 6)
  })

  it("OH-18: косой стык (45°) с малым зазором — выступа нет, длина по оси", () => {
    const c = wall("C", 503, 4, 603, 104)
    const walls = [E(), c]
    expect(endOverhangCm(c, "a", walls)).toBe(0)
    expect(edgeLengthCm(c, walls)).toBeCloseTo(Math.hypot(100, 100), 6)
  })
})

describe("ось по длине кромка-кромка и ввод длины выделенной стены", () => {
  it("RS-0: ось = введённая длина − выступы; у стены без выступов — введённая длина", () => {
    const walls = [E(), N()]
    expect(axisLengthForEdgeCm(walls[1], walls, 450)).toBeCloseTo(440, 6)
    expect(axisLengthForEdgeCm(walls[0], walls, 500)).toBeCloseTo(500, 6)
  })

  it("RS-0a: введено не больше выступа — ось не определена", () => {
    const walls = [E(), N()]
    expect(axisLengthForEdgeCm(walls[1], walls, 10)).toBeNull()
    expect(axisLengthForEdgeCm(walls[1], walls, 5)).toBeNull()
    expect(axisLengthForEdgeCm(walls[1], walls, 10.01)).toBeCloseTo(0.01, 6)
  })

  it("RS-1: ввод 450 для выделенной N сдвигает свободный конец b в (950, 0); длина 450, ось 440", () => {
    const walls = [E(), N()]
    const target = walls[1]
    const axis = axisLengthForEdgeCm(target, walls, 450)
    expect(axis).not.toBeNull()
    const result = resizeWallBounded(walls, target, axis ?? 0, FREE)
    expect(result.kind).toBe("applied")
    expectPoint(target.a, 510, 0)
    expectPoint(target.b, 950, 0)
    expect(edgeLengthCm(target, walls)).toBeCloseTo(450, 6)
    expect(Math.hypot(target.b.x - target.a.x, target.b.y - target.a.y)).toBeCloseTo(440, 6)
  })
})
