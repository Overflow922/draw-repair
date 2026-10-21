import { describe, expect, it } from "vitest"
import type { CornerRef, EndPlasterMark, Point, Wall } from "../types"
import { cornerKey, plasterCorners } from "./plaster-corner"
import type { PlasterCorner } from "./plaster-corner"
import type { PlasterPiece } from "./plaster"
import { roughScene } from "./rough-scene"
import { demolitionMark, drawing, plaster, rectWalls, reveal, wall, windowOn } from "./rough.test-utils"
import type { RoughParts } from "./rough.test-utils"

// change plaster-right-angle: углы контура штукатурки (spec rough-works-plan «Угол контура штукатурки»; design D1–D3).
// Ожидаемые числа выведены вручную из геометрии спеки, а не из продакшн-модуля.

const cornersOf = (parts: RoughParts): PlasterCorner[] => {
  const scene = roughScene(drawing(parts))
  return plasterCorners(scene.pieces, scene.base.walls)
}

const near = (a: Point, x: number, y: number): void => {
  expect(a.x).toBeCloseTo(x, 6)
  expect(a.y).toBeCloseTo(y, 6)
}

const at = (corners: PlasterCorner[], x: number, y: number): PlasterCorner => {
  const found = corners.find((c) => Math.hypot(c.point.x - x, c.point.y - y) < 1e-6)
  if (!found) throw new Error(`нет угла в (${x}; ${y}), есть: ${corners.map((c) => `(${c.point.x}; ${c.point.y})`).join(", ")}`)
  return found
}

const armsOf = (c: PlasterCorner): string[] => c.arms.map((a) => `${Math.round(a.x * 1000) / 1000},${Math.round(a.y * 1000) / 1000}`).sort()

const refs = (...pairs: [string, CornerRef["at"]][]): CornerRef[] => pairs.map(([markId, position]) => ({ markId, at: position }))

const A = (): Wall => wall("A", 0, 0, 500, 0)
const B = (): Wall => wall("B", 500, 0, 500, 400)

describe("углы контура штукатурки", () => {
  it("RA-01: внутренний угол двух боковых полос — V (488; 12), плечи влево и вниз", () => {
    const corners = cornersOf({ walls: [A(), B()], roughPlaster: [plaster("pa", "A", 1, "a", 0, 500), plaster("pb", "B", 1, "a", 0, 400)] })
    expect(corners).toHaveLength(1)
    const c = at(corners, 488, 12)
    expect(c.kind).toBe("inner")
    expect(armsOf(c)).toEqual(["-1,0", "0,1"])
    expect(c.corner).toEqual(refs(["pa", "to"], ["pb", "from"]))
  })

  it("RA-02: внешний угол ведущей полосы и соседа — V (512; −12), плечи влево и вниз", () => {
    const corners = cornersOf({ walls: [A(), B()], roughPlaster: [plaster("pa", "A", -1, "a", 0, 500), plaster("pb", "B", -1, "a", 0, 400)] })
    expect(corners).toHaveLength(1)
    const c = at(corners, 512, -12)
    expect(c.kind).toBe("outer")
    expect(armsOf(c)).toEqual(["-1,0", "0,1"])
    expect(c.corner).toEqual(refs(["pa", "to"], ["pb", "from"]))
  })

  it("RA-03: торец и боковая полоса — один угол V (502; 6,4), у края торца без боковой полосы угла нет", () => {
    const end: EndPlasterMark = { id: "pe", wallId: "W", face: "end", anchor: "b", thicknessMm: 20 }
    const corners = cornersOf({ walls: [wall("W", 0, 0, 500, 0, 10)], roughPlaster: [end, plaster("pw", "W", 1, "a", 0, 500, 14)] })
    expect(corners).toHaveLength(1)
    const c = at(corners, 502, 6.4)
    expect(c.kind).toBe("outer")
    expect(armsOf(c)).toEqual(["-1,0", "0,-1"])
    expect(c.corner).toEqual(refs(["pe", "to"], ["pw", "to"]))
  })

  it("RA-04: внутренний угол торца и полосы соседней стены — V (502; −3,2)", () => {
    const end: EndPlasterMark = { id: "pe", wallId: "W", face: "end", anchor: "b", thicknessMm: 20 }
    const corners = cornersOf({
      walls: [wall("W", 0, 0, 500, 0, 10), wall("N", 500, -10.2, 700, -10.2, 10)],
      roughPlaster: [end, plaster("pw", "W", 1, "a", 0, 500, 14), plaster("pn", "N", 1, "a", 0, 200, 20)],
    })
    const c = at(corners, 502, -3.2)
    expect(c.kind).toBe("inner")
    expect(armsOf(c)).toEqual(["0,1", "1,0"])
    expect(c.corner).toEqual(refs(["pe", "from"], ["pn", "from"]))
    at(corners, 502, 6.4)
  })

  it("RA-05: Т-примыкание — V (238; 12), полоса стены проходит сквозь угол", () => {
    const corners = cornersOf({
      walls: [A(), wall("B", 250, 10, 250, 300)],
      roughPlaster: [plaster("pa", "A", 1, "a", 0, 500), plaster("pb", "B", 1, "a", 0, 290)],
    })
    expect(corners).toHaveLength(1)
    const c = at(corners, 238, 12)
    expect(c.kind).toBe("inner")
    expect(armsOf(c)).toEqual(["-1,0", "0,1"])
    expect(c.corner).toEqual(refs(["pa", "through"], ["pb", "from"]))
  })

  it("RA-06: штукатурка только на одной грани — угла нет", () => {
    expect(cornersOf({ walls: [A(), B()], roughPlaster: [plaster("pa", "A", 1, "a", 0, 500)] })).toEqual([])
    expect(cornersOf({ walls: [A(), B()], roughPlaster: [plaster("pb", "B", 1, "a", 0, 400)] })).toEqual([])
  })

  it("RA-06: угол стен без штукатурки — угла нет", () => {
    expect(cornersOf({ walls: [A(), B()] })).toEqual([])
  })

  it("RA-07: откос проёма углом не считается", () => {
    const corners = cornersOf({
      walls: [A()],
      doorways: [windowOn("win", "A", 200, 100)],
      roughPlaster: [plaster("pa", "A", 1, "a", 0, 500), reveal("rv", "win", "a")],
    })
    expect(corners).toEqual([])
  })

  it("RA-08: коллинеарный стык полос углом не считается", () => {
    const corners = cornersOf({
      walls: [wall("A", 0, 0, 250, 0), wall("A2", 250, 0, 500, 0)],
      roughPlaster: [plaster("p1", "A", 1, "a", 0, 250), plaster("p2", "A2", 1, "a", 0, 250)],
    })
    expect(corners).toEqual([])
  })

  it("RA-09: угол не 90° — плечи вдоль рёбер контура, сектор 135°", () => {
    // стена C идёт из (500; 0) под 45°; грань +1 обращена к грани +1 стены A (внутренний угол)
    const A1 = wall("A", 0, 0, 500, 0)
    const C = wall("C", 500, 0, 800, 300)
    const piece = (id: string, w: Wall, face: 1 | -1, from: number, to: number): PlasterPiece => ({ mark: plaster(id, w.id, face, "a", from, to), wall: w, from, to })
    // края участков на 2 см дальше вершины: дальше 1,41 см (толщина полосы / синус угла 0,707 при умножении), ближе 2,83 см
    const c = plasterCorners([piece("pa", A1, 1, 0, 497), piece("pc", C, 1, 3, 424.264)], [A1, C])
    expect(c).toHaveLength(1)
    expect(c[0]?.corner).toEqual(refs(["pa", "to"], ["pc", "from"]))
    // внешняя поверхность полосы C: (x − 500)·(−√2/2) + y·(√2/2) = 12 → при y = 12 x = 500 + 12 − 12·√2
    const corner = at(c, 500 + 12 - 12 * Math.SQRT2, 12)
    expect(corner.kind).toBe("inner")
    expect(armsOf(corner)).toEqual(["-1,0", "0.707,0.707"])
  })

  it("RA-10: смена толщины соседа сдвигает вершину внутреннего угла (37 мм → x = 486,3)", () => {
    const corners = cornersOf({ walls: [A(), B()], roughPlaster: [plaster("pa", "A", 1, "a", 0, 500), plaster("pb", "B", 1, "a", 0, 400, 37)] })
    near(at(corners, 486.3, 12).point, 486.3, 12)
  })

  it("RA-10: смена толщины соседа сдвигает вершину внешнего угла (37 мм → x = 513,7)", () => {
    const corners = cornersOf({ walls: [A(), B()], roughPlaster: [plaster("pa", "A", -1, "a", 0, 500), plaster("pb", "B", -1, "a", 0, 400, 37)] })
    near(at(corners, 513.7, -12).point, 513.7, -12)
  })

  it("RA-11: снос в середине стены не мешает углу на конце", () => {
    const corners = cornersOf({
      walls: [A(), B()],
      demolition: [demolitionMark("d1", "A", "a", 150, 250)],
      roughPlaster: [plaster("pa", "A", 1, "a", 0, 500), plaster("pb", "B", 1, "a", 0, 400)],
    })
    expect(at(corners, 488, 12).corner).toEqual(refs(["pa", "to"], ["pb", "from"]))
  })

  it("RA-12: комната из четырёх стен с штукатуркой изнутри — четыре внутренних угла", () => {
    const walls = rectWalls("r", 0, 0, 400, 300)
    const roughPlaster = [
      plaster("p1", "r1", 1, "a", 0, 400),
      plaster("p2", "r2", 1, "a", 0, 300),
      plaster("p3", "r3", 1, "a", 0, 400),
      plaster("p4", "r4", 1, "a", 0, 300),
    ]
    const corners = cornersOf({ walls, roughPlaster })
    expect(corners).toHaveLength(4)
    for (const [x, y] of [[12, 12], [388, 12], [388, 288], [12, 288]] as const) expect(at(corners, x, y).kind).toBe("inner")
  })

  it("RA-13: комната, оштукатуренная стена за стеной — углы возникают по мере появления штукатурки", () => {
    const walls = rectWalls("r", 0, 0, 400, 300)
    const p = [plaster("p1", "r1", 1, "a", 0, 400), plaster("p2", "r2", 1, "a", 0, 300), plaster("p3", "r3", 1, "a", 0, 400), plaster("p4", "r4", 1, "a", 0, 300)]
    expect(cornersOf({ walls, roughPlaster: p.slice(0, 1) })).toHaveLength(0)
    expect(cornersOf({ walls, roughPlaster: p.slice(0, 2) })).toHaveLength(1)
    expect(cornersOf({ walls, roughPlaster: p.slice(0, 3) })).toHaveLength(2)
    expect(cornersOf({ walls, roughPlaster: p })).toHaveLength(4)
  })

  it("RA-15: дрейф координат стыка на 0,005 см угол не теряет", () => {
    const drifted = wall("B", 500.005, 0.003, 500.005, 400)
    const corners = cornersOf({ walls: [A(), drifted], roughPlaster: [plaster("pa", "A", 1, "a", 0, 500), plaster("pb", "B", 1, "a", 0, 400)] })
    expect(corners).toHaveLength(1)
    expect(corners[0]?.kind).toBe("inner")
    expect(corners[0]?.point.y).toBeCloseTo(12, 2)
  })

  it("RA-16: граница to/through — полоса стены, кончающаяся у грани перегородки, даёт to; продолжающаяся за неё — through", () => {
    const stem = wall("B", 250, 10, 250, 300)
    const ending = cornersOf({ walls: [A(), stem], roughPlaster: [plaster("pa", "A", 1, "a", 0, 240), plaster("pb", "B", 1, "a", 0, 290)] })
    expect(at(ending, 238, 12).corner).toEqual(refs(["pa", "to"], ["pb", "from"]))
    // край участка дальше толщины соседней полосы (2 см) от вершины — вершина внутри участка
    const passing = cornersOf({ walls: [A(), stem], roughPlaster: [plaster("pa", "A", 1, "a", 0, 241), plaster("pb", "B", 1, "a", 0, 290)] })
    expect(at(passing, 238, 12).corner).toEqual(refs(["pa", "through"], ["pb", "from"]))
    const through = cornersOf({ walls: [A(), stem], roughPlaster: [plaster("pa", "A", 1, "a", 0, 300), plaster("pb", "B", 1, "a", 0, 290)] })
    expect(at(through, 238, 12).corner).toEqual(refs(["pa", "through"], ["pb", "from"]))
  })

  it("RA-16b: край участка в допуске 0,005 см от границы — всё ещё to", () => {
    const stem = wall("B", 250, 10, 250, 300)
    const corners = cornersOf({ walls: [A(), stem], roughPlaster: [plaster("pa", "A", 1, "a", 0, 240.005), plaster("pb", "B", 1, "a", 0, 290)] })
    expect(at(corners, 238, 12).corner).toEqual(refs(["pa", "to"], ["pb", "from"]))
  })

  it("RA-18: внешний угол, где ведущая полоса — вторая в списке пометок (стена B стоит раньше A)", () => {
    const corners = cornersOf({ walls: [B(), A()], roughPlaster: [plaster("pa", "A", -1, "a", 0, 500), plaster("pb", "B", -1, "a", 0, 400)] })
    expect(corners).toHaveLength(1)
    // спека «Внешний угол — порядок стен»: полоса B начинается на y = −12 и закрывает угол; вершина та же
    expect(at(corners, 512, -12).kind).toBe("outer")
  })

  it("RA-19: два торца углом не считаются", () => {
    const e1 = wall("E1", 0, 0, 100, 0, 10)
    const e2 = wall("E2", 102, 0, 102, 100, 10)
    const piece = (id: string, w: Wall, anchor: "a" | "b", from: number, to: number): PlasterPiece => ({
      mark: { id, wallId: w.id, face: "end", anchor, thicknessMm: 20 },
      wall: w,
      from,
      to,
    })
    // торец b стены E1 (x 100…102, y −5…5) и торец a стены E2 (y −2…0, x 97…107): полосы пересекаются, их внешние поверхности
    // x = 102 и y = −2 сходятся в точке (102; −2) — вершина контура, но торец с торцом углом не считается
    // тела стен в пробе не участвуют (их углы перекрыли бы пробу), остаются только полосы
    expect(plasterCorners([piece("e1", e1, "b", -5, 5), piece("e2", e2, "a", -5, 5)], [])).toEqual([])
  })

  it("RA-20: край внешней поверхности в допуске 0,005 см от вершины угол не теряет", () => {
    const A1 = wall("A", 0, 0, 500, 0)
    const B1 = wall("B", 500, 0, 500, 400)
    const piece = (id: string, w: Wall, from: number, to: number): PlasterPiece => ({ mark: plaster(id, w.id, 1, "a", from, to), wall: w, from, to })
    // край полосы A оканчивается на x = 487,995, вершина — на x = 488
    const corners = plasterCorners([piece("pa", A1, 0, 487.995), piece("pb", B1, 10, 400)], [A1, B1])
    expect(corners).toHaveLength(1)
    expect(corners[0]?.point.x).toBeCloseTo(488, 6)
  })

  it("RA-21: ключ угла не зависит от порядка ссылок, в том числе при равных идентификаторах", () => {
    expect(cornerKey([{ markId: "p", at: "to" }, { markId: "p", at: "from" }])).toBe(cornerKey([{ markId: "p", at: "from" }, { markId: "p", at: "to" }]))
    expect(cornerKey([{ markId: "b", at: "to" }, { markId: "a", at: "from" }])).toBe(cornerKey([{ markId: "a", at: "from" }, { markId: "b", at: "to" }]))
    expect(cornerKey([{ markId: "a", at: "to" }, { markId: "b", at: "from" }])).not.toBe(cornerKey([{ markId: "a", at: "from" }, { markId: "b", at: "to" }]))
  })

  it("RA-17: две перегородки в одну сплошную полосу — два разных угла с одной и той же сквозной полосой", () => {
    const walls = [A(), wall("B", 100, 10, 100, 300), wall("C", 300, 10, 300, 300)]
    const roughPlaster = [plaster("pa", "A", 1, "a", 0, 500), plaster("pb", "B", 1, "a", 0, 290), plaster("pc", "C", 1, "a", 0, 290)]
    const corners = cornersOf({ walls, roughPlaster })
    expect(corners).toHaveLength(2)
    expect(at(corners, 88, 12).corner).toEqual(refs(["pa", "through"], ["pb", "from"]))
    expect(at(corners, 288, 12).corner).toEqual(refs(["pa", "through"], ["pc", "from"]))
  })

  it("RA-14: каждый угол встречается один раз, порядок пометок на результат не влияет", () => {
    const marks = [plaster("pa", "A", 1, "a", 0, 500), plaster("pb", "B", 1, "a", 0, 400)]
    const forward = cornersOf({ walls: [A(), B()], roughPlaster: marks })
    const backward = cornersOf({ walls: [A(), B()], roughPlaster: [...marks].reverse() })
    expect(forward).toHaveLength(1)
    expect(backward.map((c) => c.corner)).toEqual(forward.map((c) => c.corner))
  })
})
