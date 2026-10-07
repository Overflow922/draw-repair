import { describe, expect, it } from "vitest"
import type { Point, Wall } from "../types"
import { ghostSwing, setDirection } from "./doorway-edit"
import { doorZoneAt, doorZones } from "./doorway-layout"
import { sceneF, w } from "./doorway.test-utils"
import { DR, dr } from "./door.test-utils"
import type { Hinge, Swing } from "./door.test-utils"

// change popups-buttons-only: сторона открывания призрака по курсору с мёртвой зоной и зоны направления
// выделенной двери (spec door «Инструмент «Дверь» и параметры новых дверей», «Направление выделенной двери»;
// design D5, D6). Эталоны — по формулам спецификации: left — сторона нормали (d.y, −d.x).

describe("сторона открывания призрака", () => {
  const { W } = sceneF()

  it("PB-SW-01: курсор над стеной — сторона по курсору: y < 0 — left, y > 0 — right", () => {
    expect(ghostSwing({ x: 200, y: -8 }, W, "right", 2)).toBe("left")
    expect(ghostSwing({ x: 200, y: 8 }, W, "left", 2)).toBe("right")
  })

  it("PB-SW-01b: сторона задаётся нормалью оси, а не экранным «верх/низ»", () => {
    // ось (0,0) → (0,500): d = (0, 1), left — (1, 0), то есть x > 0
    const V = w(0, 0, 0, 500, "V")
    expect(ghostSwing({ x: 8, y: 200 }, V, "right", 2)).toBe("left")
    expect(ghostSwing({ x: -8, y: 200 }, V, "left", 2)).toBe("right")
    // ось (500,0) → (0,0): d = (−1, 0), left — (0, 1), то есть y > 0
    const Rev = w(500, 0, 0, 0, "Rev")
    expect(ghostSwing({ x: 200, y: 8 }, Rev, "right", 2)).toBe("left")
    expect(ghostSwing({ x: 200, y: -8 }, Rev, "left", 2)).toBe("right")
  })

  it("PB-SW-02: в мёртвой зоне у оси сохраняется прежняя сторона — для обоих прежних значений", () => {
    for (const prev of ["left", "right"] as const)
      for (const y of [0, 1, -1, 1.99, -1.99]) expect(ghostSwing({ x: 200, y }, W, prev, 2), `${prev} ${y}`).toBe(prev)
  })

  it("PB-SW-03: граница мёртвой зоны включительно; сразу за ней — по стороне", () => {
    expect(ghostSwing({ x: 200, y: 2 }, W, "left", 2)).toBe("left")
    expect(ghostSwing({ x: 200, y: -2 }, W, "right", 2)).toBe("right")
    expect(ghostSwing({ x: 200, y: 2.01 }, W, "left", 2)).toBe("right")
    expect(ghostSwing({ x: 200, y: -2.01 }, W, "right", 2)).toBe("left")
  })

  it("PB-SW-03b: ширина мёртвой зоны — параметр: та же точка в 1.5 см от оси держит сторону при 2 и меняет при 1", () => {
    expect(ghostSwing({ x: 200, y: 1.5 }, W, "left", 2)).toBe("left")
    expect(ghostSwing({ x: 200, y: 1.5 }, W, "left", 1)).toBe("right")
  })

  it("PB-SW-03c: положение вдоль оси не влияет на сторону", () => {
    for (const x of [-50, 0, 10, 499, 600]) expect(ghostSwing({ x, y: -8 }, W, "right", 2), `${x}`).toBe("left")
  })
})

// дверь DR на W (ось x, толщина 20): участок x 100…190, середина 145, ширина 90 — зоны до |y| = 10 + 90
type Dir = { hinge: Hinge; swing: Swing }
const ZONE_BOX: Record<string, { x: [number, number]; y: [number, number] }> = {
  "a/left": { x: [100, 145], y: [-100, -10] },
  "b/left": { x: [145, 190], y: [-100, -10] },
  "a/right": { x: [100, 145], y: [10, 100] },
  "b/right": { x: [145, 190], y: [10, 100] },
}
const key = (d: Dir): string => `${d.hinge}/${d.swing}`

function bbox(poly: Point[]): { x: [number, number]; y: [number, number] } {
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  return { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] }
}

describe("зоны направления", () => {
  const { walls } = sceneF()

  it("PB-ZN-00: четыре зоны — по одной на направление, прямоугольники по спецификации", () => {
    const zones = doorZones(DR("a", "left"), walls)
    expect(zones).toHaveLength(4)
    expect(new Set(zones.map(key))).toEqual(new Set(Object.keys(ZONE_BOX)))
    for (const z of zones) {
      expect(z.poly).toHaveLength(4)
      const b = bbox(z.poly)
      const e = ZONE_BOX[key(z)]
      expect(b.x[0], key(z)).toBeCloseTo(e.x[0], 6)
      expect(b.x[1], key(z)).toBeCloseTo(e.x[1], 6)
      expect(b.y[0], key(z)).toBeCloseTo(e.y[0], 6)
      expect(b.y[1], key(z)).toBeCloseTo(e.y[1], 6)
    }
  })

  it("PB-ZN-01: точка в зоне даёт направление зоны", () => {
    const d = DR("a", "left")
    expect(doorZoneAt({ x: 170, y: 40 }, d, walls)).toEqual({ hinge: "b", swing: "right" })
    expect(doorZoneAt({ x: 120, y: 40 }, d, walls)).toEqual({ hinge: "a", swing: "right" })
    expect(doorZoneAt({ x: 170, y: -60 }, d, walls)).toEqual({ hinge: "b", swing: "left" })
    expect(doorZoneAt({ x: 120, y: -60 }, d, walls)).toEqual({ hinge: "a", swing: "left" })
  })

  it("PB-ZN-02: границы зон — внутри у краёв, снаружи сразу за ними", () => {
    const d = DR("a", "left")
    const inside: [Point, string][] = [
      [{ x: 100.5, y: 10.5 }, "a/right"],
      [{ x: 189.5, y: 99.5 }, "b/right"],
      [{ x: 100.5, y: -99.5 }, "a/left"],
      [{ x: 189.5, y: -10.5 }, "b/left"],
    ]
    for (const [p, k] of inside) {
      const z = doorZoneAt(p, d, walls)
      expect(z && key(z), `${p.x},${p.y}`).toBe(k)
    }
    // середина двери: принадлежит какой-то половине, сторона — по грани
    expect(doorZoneAt({ x: 145, y: 50 }, d, walls)?.swing).toBe("right")
    expect(doorZoneAt({ x: 145, y: -50 }, d, walls)?.swing).toBe("left")
    const outside: Point[] = [
      { x: 170, y: 100.5 },
      { x: 170, y: -100.5 },
      { x: 85, y: 50 }, // за откосом и за тенью (change deselect-tool-on-element-select, test-change-request 2)
      { x: 205, y: 50 },
      { x: 170, y: 9.5 },
      { x: 145, y: 0 }, // внутри тела стены
      { x: 170, y: 120 },
    ]
    for (const p of outside) expect(doorZoneAt(p, d, walls), `${p.x},${p.y}`).toBeNull()
  })

  it("PB-ZN-02b: зоны не зависят от текущего направления и стороны привязки двери", () => {
    for (const d of [DR("b", "right"), DR("a", "right"), dr("W", "b", 310, "b", "left")]) {
      expect(doorZoneAt({ x: 170, y: 40 }, d, walls)).toEqual({ hinge: "b", swing: "right" })
      expect(doorZoneAt({ x: 120, y: -60 }, d, walls)).toEqual({ hinge: "a", swing: "left" })
    }
  })

  it("PB-ZN-02c: обратная ось — петли a у откоса со стороны конца a, left — сторона (d.y, −d.x)", () => {
    // ось (500,0) → (0,0); дверь от b на 100 — участок x 100…190; конец a — x = 500, left — y > 0
    const Rev: Wall = w(500, 0, 0, 0, "W")
    const d = dr("W", "b", 100, "a", "left")
    expect(doorZoneAt({ x: 170, y: 40 }, d, [Rev])).toEqual({ hinge: "a", swing: "left" })
    expect(doorZoneAt({ x: 120, y: 40 }, d, [Rev])).toEqual({ hinge: "b", swing: "left" })
    expect(doorZoneAt({ x: 120, y: -40 }, d, [Rev])).toEqual({ hinge: "b", swing: "right" })
  })

  it("PB-ZN-02d: глубина зоны — ширина двери: у двери 60 см зона кончается на |y| = 70", () => {
    const d = dr("W", "a", 100, "a", "left", 60)
    expect(doorZoneAt({ x: 110, y: 69.5 }, d, walls)).toEqual({ hinge: "a", swing: "right" })
    expect(doorZoneAt({ x: 110, y: 70.5 }, d, walls)).toBeNull()
    expect(doorZoneAt({ x: 155, y: 50 }, d, walls)?.hinge).toBe("b")
  })
})

describe("смена направления", () => {
  it("PB-ZN-08: setDirection задаёт направление, положение и размеры прежние, вход не мутирован", () => {
    const d = DR("a", "left")
    const copy = { ...d }
    const r = setDirection(d, "b", "right")
    expect(r).toEqual({ kind: "applied", doorway: { ...d, hinge: "b", swing: "right" } })
    expect(d).toEqual(copy)
  })

  it("PB-ZN-08b: то же направление — без изменения", () => {
    expect(setDirection(DR("b", "left"), "b", "left")).toEqual({ kind: "rejected", reason: "no-change" })
  })

  it("PB-ZN-08c: меняется только изменённая часть направления", () => {
    expect(setDirection(DR("a", "left"), "a", "right")).toEqual({ kind: "applied", doorway: DR("a", "right") })
    expect(setDirection(DR("a", "left"), "b", "left")).toEqual({ kind: "applied", doorway: DR("b", "left") })
  })
})
