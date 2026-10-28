import { describe, expect, it } from "vitest"
import type { Point, Wall } from "../types"
import { doorZoneAt } from "./doorway-layout"
import { w } from "./doorway.test-utils"
import { dr } from "./door.test-utils"
import type { Hinge, Swing } from "./door.test-utils"

// change deselect-tool-on-element-select: зона направления выделенной двери — прямоугольник ∪ сектор тени
// (spec door «Направление выделенной двери»; design D6). Эталоны — точки из сценариев спецификации.

type Dir = { hinge: Hinge; swing: Swing }
const W = w(0, 0, 500, 0, "W")
// выделена дверь a/left: участок x 100…190, петля текущего направления (100, −10)
const door = (hinge: Hinge = "a", swing: Swing = "left") => dr("W", "a", 100, hinge, swing)
const at = (p: Point, hinge: Hinge = "a", swing: Swing = "left", wall: Wall = W): Dir | null => doorZoneAt(p, door(hinge, swing), [wall])

describe("тень направления: полотно и сектор", () => {
  it("DZ-1: клик по штриховому полотну (x 186…190, вплотную к откосу петель b) задаёт направление", () => {
    expect(at({ x: 188, y: 50 })).toEqual({ hinge: "b", swing: "right" })
  })

  it("DZ-1b: правее полотна, за 90° — не сектор и не полотно, зоны нет", () => {
    expect(at({ x: 192, y: 50 })).toBeNull()
    expect(at({ x: 197, y: 50 })).toBeNull()
  })

  it("DZ-2: левее откоса петель a, за 90° — зоны нет", () => {
    expect(at({ x: 99.5, y: -70 })).toBeNull()
    expect(at({ x: 99.5, y: 70 })).toBeNull()
  })

  it("DZ-3: за радиусом w, за 90° и вне полотна, за откосом у дальней петли — нет зоны", () => {
    expect(at({ x: 97, y: 101 })).toBeNull()
    expect(at({ x: 85, y: -50 })).toBeNull()
    expect(at({ x: 195, y: 15 })).toBeNull()
  })

  it("DZ-3b: радиус сектора — ровно w: точка на 89 см внутри, на 91 см снаружи", () => {
    // сектор a/right: петля (100, 10), угол 88° от оси (внутри сектора), радиус r
    const rad = (88 * Math.PI) / 180
    const p = (r: number): Point => ({ x: 100 + r * Math.cos(rad), y: 10 + r * Math.sin(rad) })
    expect(at(p(89))).toEqual({ hinge: "a", swing: "right" })
    expect(at(p(91))).toBeNull()
  })

  it("DZ-4: пересечение секторов — ближняя петля; для точек в половине двери — прежнее правило", () => {
    expect(at({ x: 150, y: 40 })).toEqual({ hinge: "b", swing: "right" })
    expect(at({ x: 140, y: 40 })).toEqual({ hinge: "a", swing: "right" })
  })

  it("DZ-5: не зависит от положения стены: вертикальная стена, left — сторона x > 0", () => {
    const V = w(0, 0, 0, 500, "V")
    const d = dr("V", "a", 100, "a", "right")
    // вдоль оси t = 103 (правее откоса петель), на 70 см в сторону left (x > 0) — a/left
    expect(doorZoneAt({ x: 70, y: 103 }, d, [V])).toEqual({ hinge: "a", swing: "left" })
    expect(doorZoneAt({ x: -70, y: 103 }, d, [V])).toEqual({ hinge: "a", swing: "right" })
    // левее откоса (t = 97) за 90° зоны нет
    expect(doorZoneAt({ x: 70, y: 97 }, d, [V])).toBeNull()
  })

  it("DZ-7: петли у b — зеркально: за дальним откосом зоны нет", () => {
    // откос b — x = 190; сектор b/left не выходит за откос (x ≤ 190), выше грани y = −10
    expect(at({ x: 187, y: -70 }, "b", "left")).toEqual({ hinge: "b", swing: "left" })
    expect(at({ x: 187, y: 70 }, "b", "left")).toEqual({ hinge: "b", swing: "right" })
    expect(at({ x: 193, y: -70 }, "b", "left")).toBeNull()
    expect(at({ x: 193, y: 70 }, "b", "left")).toBeNull()
  })
})

describe("прежние зоны не изменились", () => {
  it("DZ-6: точки сценариев спецификации", () => {
    expect(at({ x: 170, y: 40 })).toEqual({ hinge: "b", swing: "right" })
    expect(at({ x: 120, y: -60 })).toEqual({ hinge: "a", swing: "left" })
    expect(at({ x: 170, y: 120 })).toBeNull()
  })

  it("DZ-6b: тело стены и середина двери между гранями — не зона", () => {
    expect(at({ x: 145, y: 0 })).toBeNull()
    expect(at({ x: 145, y: 9 })).toBeNull()
  })

  it("DZ-8: чистая функция — дверь и стена не меняются", () => {
    const d = door()
    const dCopy = { ...d }
    const wCopy = JSON.parse(JSON.stringify(W)) as Wall
    doorZoneAt({ x: 97, y: -70 }, d, [W])
    expect(d).toEqual(dCopy)
    expect(W).toEqual(wCopy)
  })
})
