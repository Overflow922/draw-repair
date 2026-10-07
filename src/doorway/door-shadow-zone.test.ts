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
  it("DZ-1: клик по штриховому полотну (вне прямоугольника и сектора) задаёт направление", () => {
    expect(at({ x: 197, y: 50 })).toEqual({ hinge: "b", swing: "right" })
  })

  it("DZ-2: сектор вне прямоугольника, левее откоса — направление сектора", () => {
    expect(at({ x: 97, y: -70 })).toEqual({ hinge: "a", swing: "left" })
    expect(at({ x: 97, y: 70 })).toEqual({ hinge: "a", swing: "right" })
  })

  it("DZ-3: за радиусом w, за 95° и вне полотна, за откосом у дальней петли — нет зоны", () => {
    expect(at({ x: 97, y: 101 })).toBeNull()
    expect(at({ x: 85, y: -50 })).toBeNull()
    expect(at({ x: 195, y: 15 })).toBeNull()
  })

  it("DZ-3b: радиус сектора — ровно w: точка на 89 см внутри, на 91 см снаружи", () => {
    // сектор a/right: петля (100, 10), угол 93° от оси (за откос), радиус r
    const rad = (93 * Math.PI) / 180
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
    // вдоль оси t = 97 (левее откоса), на 70 см в сторону left (x > 0) — сектор a/left
    expect(doorZoneAt({ x: 70, y: 97 }, d, [V])).toEqual({ hinge: "a", swing: "left" })
    expect(doorZoneAt({ x: -70, y: 97 }, d, [V])).toEqual({ hinge: "a", swing: "right" })
  })

  it("DZ-7: петли у b — зеркально: сектор за дальним откосом", () => {
    // откос b — x = 190; сектор b/left: за откосом, x > 190, выше грани y = −10
    expect(at({ x: 193, y: -70 }, "b", "left")).toEqual({ hinge: "b", swing: "left" })
    expect(at({ x: 193, y: 70 }, "b", "left")).toEqual({ hinge: "b", swing: "right" })
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
