import { describe, expect, it } from "vitest"
import { applyStretch, planOrthoStretch } from "./ortho-stretch"
import type { StretchSeed } from "./ortho-stretch"
import type { Point, Wall } from "./types"

// change ortho-stretch-move, wall-selection «Орто-растяжение связанных стен» (design D2):
// связанные стены сохраняют направление — параллельные вектору растягиваются, остальные
// смещаются целиком и передают правило дальше; каждая стена смещается не более одного раза.

const W = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const P = (x: number, y: number): Point => ({ x, y })
const byId = (walls: Wall[], id: string): Wall => {
  const w = walls.find((x) => x.id === id)
  if (!w) throw new Error(`no wall ${id}`)
  return w
}
const ends = (w: Wall): [Point, Point] => [w.a, w.b]
const dirDeg = (w: Wall): number => (Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180) / Math.PI

// stretched — стены, которые по сценарию растягиваются, будучи не строго параллельны v (в пределах
// допуска растяжения 5°): их направление меняется на доли градуса и из проверки INV-DIR исключается
function run(walls: Wall[], seed: StretchSeed, v: Point, stretched: string[] = []): Map<string, [Point, Point]> {
  const before = new Map(walls.map((w) => [w.id, [{ ...w.a }, { ...w.b }] as [Point, Point]]))
  const dirs = new Map(walls.map((w) => [w.id, dirDeg(w)]))
  applyStretch(planOrthoStretch(walls, seed, v), v)
  // INV-DIR: направление каждой стены сохранено
  for (const w of walls)
    if (!stretched.includes(w.id)) expect(dirDeg(w), `направление ${w.id}`).toBeCloseTo(dirs.get(w.id) ?? NaN, 9)
  // INV-ONCE: каждый конец смещён ровно на v или не смещён
  for (const w of walls) {
    const [a0, b0] = before.get(w.id) ?? [w.a, w.b]
    for (const [p0, p1] of [
      [a0, w.a],
      [b0, w.b],
    ] as const) {
      const d = { x: p1.x - p0.x, y: p1.y - p0.y }
      const still = Math.hypot(d.x, d.y) < 1e-9
      const byV = Math.hypot(d.x - v.x, d.y - v.y) < 1e-9
      expect(still || byV, `конец ${w.id} смещён на ${JSON.stringify(d)}`).toBe(true)
    }
  }
  return before
}

// комната с общими вершинами осей
const roomV = (): Wall[] => [
  W("top", 0, 0, 300, 0),
  W("right", 300, 0, 300, 200),
  W("bottom", 300, 200, 0, 200),
  W("left", 0, 200, 0, 0),
]

// комната, нарисованная прилипанием: угловые стыки на грани
const roomF = (): Wall[] => [
  W("top", 0, 0, 300, 0),
  W("right", 290, 10, 290, 300),
  W("bottom", 280, 290, 0, 290),
  W("left", 10, 280, 10, 10),
]

const walls = (ws: Wall[], ids: string[]): StretchSeed => ({ kind: "walls", walls: ids.map((id) => byId(ws, id)) })

describe("Орто-растяжение: перемещение стены", () => {
  it("ST-0: нулевой вектор ничего не меняет", () => {
    const ws = roomV()
    const snap = JSON.parse(JSON.stringify(ws))
    run(ws, walls(ws, ["top"]), P(0, 0))
    expect(ws).toEqual(snap)
  })

  it("ST-1: верхняя стена вверх на 40 — боковые удлиняются, нижняя не меняется", () => {
    const ws = roomV()
    run(ws, walls(ws, ["top"]), P(0, -40))
    expect(ends(byId(ws, "top"))).toEqual([P(0, -40), P(300, -40)])
    expect(ends(byId(ws, "right"))).toEqual([P(300, -40), P(300, 200)])
    expect(ends(byId(ws, "left"))).toEqual([P(0, 200), P(0, -40)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(300, 200), P(0, 200)])
  })

  it("ST-2: верхняя стена вправо на 30 — вся комната смещается, нижняя ровно один раз", () => {
    const ws = roomV()
    run(ws, walls(ws, ["top"]), P(30, 0))
    expect(ends(byId(ws, "top"))).toEqual([P(30, 0), P(330, 0)])
    expect(ends(byId(ws, "right"))).toEqual([P(330, 0), P(330, 200)])
    expect(ends(byId(ws, "left"))).toEqual([P(30, 200), P(30, 0)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(330, 200), P(30, 200)])
  })

  it("ST-2b: шаг стрелки (Shift) 1 см вдоль стены — соседи без поворота", () => {
    const ws = roomV()
    run(ws, walls(ws, ["top"]), P(1, 0))
    expect(ends(byId(ws, "right"))).toEqual([P(301, 0), P(301, 200)])
    expect(ends(byId(ws, "left"))).toEqual([P(1, 200), P(1, 0)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(301, 200), P(1, 200)])
  })

  it("ST-4: продолжение правой стены (параллельно вектору) укорачивается, дальний конец на месте", () => {
    const ws = [...roomV(), W("ext", 300, 200, 500, 200)]
    run(ws, walls(ws, ["top"]), P(30, 0))
    expect(ends(byId(ws, "ext"))).toEqual([P(330, 200), P(500, 200)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(330, 200), P(30, 200)])
  })

  it("ST-5: диагональный сосед смещается целиком и сохраняет 45°", () => {
    const ws = [W("A", 0, 0, 100, 0), W("D", 100, 0, 150, 50)]
    run(ws, walls(ws, ["A"]), P(0, -20))
    expect(ends(byId(ws, "D"))).toEqual([P(100, -20), P(150, 30)])
  })

  it("ST-6: присадка — конец соседа смещается ровно на v, не приваривается", () => {
    const ws = [W("A", 0, 0, 200, 0), W("B", 195, 5, 195, 200)]
    run(ws, walls(ws, ["A"]), P(0, -40))
    expect(ends(byId(ws, "B"))).toEqual([P(195, -35), P(195, 200)])
  })

  it("ST-7: перегородка, примкнутая к осям верхней и нижней, удлиняется при сдвиге верхней вверх", () => {
    const ws = [...roomV(), W("part", 150, 0, 150, 200)]
    run(ws, walls(ws, ["top"]), P(0, -40))
    expect(ends(byId(ws, "part"))).toEqual([P(150, -40), P(150, 200)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(300, 200), P(0, 200)])
  })

  it("ST-7f: перегородка, примкнутая к граням (комната прилипанием), удлиняется", () => {
    const ws = [...roomF(), W("part", 150, 10, 150, 280)]
    run(ws, walls(ws, ["top"]), P(0, -40))
    expect(ends(byId(ws, "part"))).toEqual([P(150, -30), P(150, 280)])
  })

  it("ST-8: перегородка поперёк вектора смещается целиком, основание (к которому она примкнута) не увлекается", () => {
    const ws = [W("top", 0, 0, 300, 0), W("part", 150, 0, 150, 200), W("base", 0, 200, 300, 200)]
    run(ws, walls(ws, ["top"]), P(30, 0))
    expect(ends(byId(ws, "part"))).toEqual([P(180, 0), P(180, 200)])
    expect(ends(byId(ws, "base"))).toEqual([P(0, 200), P(300, 200)])
  })

  it("ST-9: ножка T, сдвигаемая вдоль грани основания, не увлекает основание", () => {
    const ws = [W("base", 0, 0, 300, 0), W("leg", 150, 10, 150, 200)]
    run(ws, walls(ws, ["leg"]), P(30, 0))
    expect(ends(byId(ws, "base"))).toEqual([P(0, 0), P(300, 0)])
    expect(ends(byId(ws, "leg"))).toEqual([P(180, 10), P(180, 200)])
  })

  it("ST-11: допуск параллельности — 0.3° и 1° растягиваются (граница 5° — в ortho-stretch-tilt.test.ts)", () => {
    const tilted = (deg: number): Wall[] => {
      const dx = 200 * Math.tan((deg * Math.PI) / 180)
      return [W("A", 0, 0, 200, 0), W("B", 200, 0, 200 + dx, 200)]
    }
    const w03 = tilted(0.3)
    const b03 = { ...byId(w03, "B").b }
    run(w03, walls(w03, ["A"]), P(0, -40), ["B"])
    expect(byId(w03, "B").b).toEqual(b03)
    expect(byId(w03, "B").a).toEqual(P(200, -40))

    const w1 = tilted(1)
    const b1 = { ...byId(w1, "B").b }
    run(w1, walls(w1, ["A"]), P(0, -40), ["B"])
    expect(byId(w1, "B").b).toEqual(b1)
    expect(byId(w1, "B").a).toEqual(P(200, -40))
  })

  it("ST-18: стена, сдвинутая целиком через оба конца, передаёт правило примкнутым к ней стенам", () => {
    // нижняя параллельна v, но связана с обеими боковыми (сдвинуты целиком) — сдвигается целиком;
    // перегородка, примкнутая к оси нижней, поперёк v — смещается целиком вместе с ней
    const ws = [...roomV(), W("part", 150, 200, 150, 100)]
    run(ws, walls(ws, ["top"]), P(30, 0))
    expect(ends(byId(ws, "bottom"))).toEqual([P(330, 200), P(30, 200)])
    expect(ends(byId(ws, "part"))).toEqual([P(180, 200), P(180, 100)])
  })

  it("ST-19: стена, примкнутая к растягиваемой (не сдвигаемой целиком) соседней стене, не смещается", () => {
    // правая растягивается вверх (параллельна v); p примкнута к её оси — правая не сдвигается целиком
    const ws = [...roomV(), W("p", 300, 100, 400, 100)]
    run(ws, walls(ws, ["top"]), P(0, -40))
    expect(ends(byId(ws, "right"))).toEqual([P(300, -40), P(300, 200)])
    expect(ends(byId(ws, "p"))).toEqual([P(300, 100), P(400, 100)])
  })

  it("ST-15: несвязанные стены не смещаются (дальняя и с концом в 30 см)", () => {
    const ws = [...roomV(), W("far", 500, 500, 600, 500), W("near", 330, 0, 330, -150)]
    run(ws, walls(ws, ["top"]), P(0, -40))
    expect(ends(byId(ws, "far"))).toEqual([P(500, 500), P(600, 500)])
    expect(ends(byId(ws, "near"))).toEqual([P(330, 0), P(330, -150)])
  })

  it("ST-17: комната прилипанием (угловые стыки на грани) — сдвиг вправо смещает всю комнату", () => {
    const ws = roomF()
    run(ws, walls(ws, ["top"]), P(30, 0))
    expect(ends(byId(ws, "right"))).toEqual([P(320, 10), P(320, 300)])
    expect(ends(byId(ws, "left"))).toEqual([P(40, 280), P(40, 10)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(310, 290), P(30, 290)])
  })

  it("ST-17b: комната прилипанием — сдвиг вверх удлиняет боковые", () => {
    const ws = roomF()
    run(ws, walls(ws, ["top"]), P(0, -40))
    expect(ends(byId(ws, "right"))).toEqual([P(290, -30), P(290, 300)])
    expect(ends(byId(ws, "left"))).toEqual([P(10, 280), P(10, -30)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(280, 290), P(0, 290)])
  })
})

describe("Орто-растяжение: группа", () => {
  it("ST-12: выделены верхняя и правая, сдвиг вправо — левая и нижняя смещены целиком один раз", () => {
    const ws = roomV()
    run(ws, walls(ws, ["top", "right"]), P(30, 0))
    expect(ends(byId(ws, "left"))).toEqual([P(30, 200), P(30, 0)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(330, 200), P(30, 200)])
  })
})

describe("Орто-растяжение: смещение конца", () => {
  it("ST-3: угол комнаты (конец верхней) вправо на 30 — правая смещена целиком, нижняя удлинена, левая на месте", () => {
    const ws = roomV()
    run(ws, { kind: "end", wall: byId(ws, "top"), end: "b" }, P(30, 0))
    expect(ends(byId(ws, "top"))).toEqual([P(0, 0), P(330, 0)])
    expect(ends(byId(ws, "right"))).toEqual([P(330, 0), P(330, 200)])
    expect(ends(byId(ws, "bottom"))).toEqual([P(330, 200), P(0, 200)])
    expect(ends(byId(ws, "left"))).toEqual([P(0, 200), P(0, 0)])
  })

  it("ST-13: перегородка, примкнутая к растягиваемой стене, не смещается", () => {
    const ws = [W("top", 0, 0, 300, 0), W("part", 150, 0, 150, 200), W("base", 0, 200, 300, 200)]
    run(ws, { kind: "end", wall: byId(ws, "top"), end: "b" }, P(30, 0))
    expect(ends(byId(ws, "top"))).toEqual([P(0, 0), P(330, 0)])
    expect(ends(byId(ws, "part"))).toEqual([P(150, 0), P(150, 200)])
  })

  it("ST-16: ввод длины (конец b вдоль стены на 20) — вертикальный сосед смещается целиком", () => {
    const ws = [W("A", 0, 0, 200, 0), W("B", 200, 0, 200, 150)]
    run(ws, { kind: "end", wall: byId(ws, "A"), end: "b" }, P(20, 0))
    expect(ends(byId(ws, "A"))).toEqual([P(0, 0), P(220, 0)])
    expect(ends(byId(ws, "B"))).toEqual([P(220, 0), P(220, 150)])
  })
})

describe("Орто-растяжение: чистота плана", () => {
  it("ST-14: planOrthoStretch не мутирует стены (замороженные входы)", () => {
    const ws = roomV()
    const snap = JSON.parse(JSON.stringify(ws))
    for (const w of ws) {
      Object.freeze(w.a)
      Object.freeze(w.b)
      Object.freeze(w)
    }
    Object.freeze(ws)
    const plan = planOrthoStretch(ws, walls(ws, ["top"]), P(30, 0))
    expect(plan.moved.size).toBe(4)
    expect(ws).toEqual(snap)
  })
})
