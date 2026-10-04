import { describe, expect, it } from "vitest"
import { rulerReading } from "./ruler"
import type { Point, Wall } from "./types"

// ruler-tool, «Углы помещения»: свободный конец — конец оси, не состыкованный ни с одной стеной.
// Угловой стык на грани — стык, даже если поворот соседа на сотые доли градуса выводит конец
// оси из его формы. Сцена — комната с чертежа пользователя (4.62 м²).

const W = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const room = (): Wall[] => [
  W("left", 900, 90, 900, 360),
  W("top", 910, 80, 1130.1665011712832, 80),
  W("right", 1130.1665011712832, 80, 1130, 330), // повёрнута на 0.038°
  W("bottom", 1120, 320, 910, 319.6500000000001), // угловой стык на грани правой у её торца
]

const near = (p: Point, q: Point): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= 0.1

describe("Линейка: углы комнаты со слегка повёрнутыми стенами", () => {
  it("RUL-TILT-1: угол у углового стыка на грани повёрнутой стены подписан — все четыре угла", () => {
    const r = rulerReading({ x: 1015, y: 200 }, room())
    expect(r.kind).toBe("space")
    if (r.kind !== "space") return
    const corners = [
      { x: 910, y: 90 },
      { x: 1120.16, y: 90 },
      { x: 1120.01, y: 310 },
      { x: 910, y: 309.65 },
    ]
    for (const c of corners) expect(r.angles.filter((a) => near(a.at, c))).toHaveLength(1)
    expect(r.angles).toHaveLength(4)
    for (const a of r.angles) expect(Math.abs(a.deg - 90)).toBeLessThan(0.2)
  })

  it("RUL-TILT-2: торец действительно свободной перегородки по-прежнему не подписывается", () => {
    // перегородка от левой стены внутрь комнаты, второй конец свободен (дальше допуска стыка от всех стен)
    const walls = [...room(), W("part", 910, 200, 1000, 200)]
    const r = rulerReading({ x: 1060, y: 250 }, walls)
    expect(r.kind).toBe("space")
    if (r.kind !== "space") return
    expect(r.angles.filter((a) => Math.abs(a.at.x - 1000) < 0.1)).toEqual([])
  })
})
