import { describe, expect, it } from "vitest"
import { findRooms } from "../room-area"
import type { Wall } from "../types"
import { displayPolygons, polygonArea } from "../wall-geometry"
import { W, axisOf, drawing, idsOf, mark, wall } from "./mounting.test-utils"
import { mountingScene } from "./mounting-scene"

// change mounting-plan: остатки — живая производная, стыки собственных стен с остатками (spec mounting-plan «Остатки —
// живая производная», «Стыки новых стен с остатками»; design D1, D5). Площади контуров проверены независимо от
// продакшн-модулей монтажа: используется существующая геометрия стен на сцене «остатки + собственные».

const totalArea = (walls: Wall[]): number => walls.reduce((sum, w) => sum + displayPolygons(w, walls).reduce((s, p) => s + Math.abs(polygonArea(p)), 0), 0)
const eachArea = (walls: Wall[]): number[] => walls.map((w) => displayPolygons(w, walls).reduce((s, p) => s + Math.abs(polygonArea(p)), 0))

describe("правки обмера и демонтажа отражаются сразу", () => {
  const marked = (walls: Wall[], marks = [mark("m", "W", "a", 100, 190)]) => mountingScene(drawing({ walls, demolition: marks }))

  it("MP-30: стена обмера перенесена на (0, 100) — остатки на новом месте", () => {
    const moved = wall("W", 0, 100, 500, 100)
    expect(marked([W()]).remnants.map(axisOf)).toEqual([
      [0, 0, 100, 0],
      [190, 0, 500, 0],
    ])
    expect(marked([moved]).remnants.map(axisOf)).toEqual([
      [0, 100, 100, 100],
      [190, 100, 500, 100],
    ])
  })

  it("MP-30: перемещение конца привязки сдвигает участок вместе с ним", () => {
    // конец a перетащен в (−50, 0): участок a 100–190 лежит теперь на x ∈ [50, 140]
    const out = marked([wall("W", -50, 0, 500, 0)]).remnants
    expect(out.map(axisOf)).toEqual([
      [-50, 0, 50, 0],
      [140, 0, 500, 0],
    ])
  })

  it("MP-31: смена материала и толщины стены обмера видна в остатках", () => {
    const out = marked([wall("W", 0, 0, 500, 0, 30, "concrete")]).remnants
    expect(out.map((r) => [r.thicknessCm, r.type])).toEqual([
      [30, "concrete"],
      [30, "concrete"],
    ])
  })

  it("MP-31: смена материала на железобетон возвращает стену целиком (пометка не действует)", () => {
    const out = marked([W("reinforced")]).remnants
    expect(idsOf(out)).toEqual(["W~0"])
  })

  it("MP-32: снятие пометки возвращает стену целиком, постановка — вычитает участок", () => {
    expect(idsOf(marked([W()], []).remnants)).toEqual(["W~0"])
    expect(idsOf(marked([W()], [mark("m", "W", "a", 100, 190)]).remnants)).toEqual(["W~0", "W~1900"])
  })

  it("MP-32: правка чисел пометки (участок 100–220) меняет остатки", () => {
    const out = marked([W()], [mark("m", "W", "a", 100, 220)]).remnants
    expect(out.map(axisOf)).toEqual([
      [0, 0, 100, 0],
      [220, 0, 500, 0],
    ])
  })

  it("MP-32: пометка, появившаяся на второй стене, не затрагивает остатки первой", () => {
    const walls = [W(), wall("V", 0, 100, 500, 100)]
    const before = mountingScene(drawing({ walls, demolition: [] })).remnants.filter((r) => r.id.startsWith("W"))
    const after = mountingScene(drawing({ walls, demolition: [mark("m", "V", "a", 100, 190)] })).remnants.filter((r) => r.id.startsWith("W"))
    expect(after).toEqual(before)
  })

  it("MP-37: после переноса стены обмера собственные стены остаются на месте, остатки — на новом месте", () => {
    const own = wall("N", 100, 0, 190, 0)
    const s = mountingScene(drawing({ walls: [wall("W", 0, 50, 500, 50)], demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: [own], dimensions: [] } }))
    expect(s.own).toEqual([own])
    expect(s.remnants.map(axisOf)).toEqual([
      [0, 50, 100, 50],
      [190, 50, 500, 50],
    ])
  })
})

describe("стыки новых стен с остатками (существующая геометрия стен)", () => {
  it("MP-33: стена по оси W на месте сноса 100–190 стыкуется торцами с обоими остатками: суммарная форма — 500×20 = 10 000 см²", () => {
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: [wall("N", 100, 0, 190, 0)], dimensions: [] } }))
    expect(eachArea(s.walls)).toEqual([2000, 6200, 1800])
    expect(totalArea(s.walls)).toBe(10000)
  })

  it("MP-34: без достройки между остатками остаётся разрыв: суммарная форма 8200 см²", () => {
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)] }))
    expect(eachArea(s.walls)).toEqual([2000, 6200])
    expect(totalArea(s.walls)).toBe(8200)
  })

  it("MP-35: перегородка, примкнутая торцом к грани остатка, образует Т-примыкание: остаток цел, перегородка не заходит в тело", () => {
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: [wall("N", 300, 10, 300, 200)], dimensions: [] } }))
    expect(eachArea(s.walls)).toEqual([2000, 6200, 3800])
  })

  it("MP-36: остатки и собственные стены замыкают помещение — найдена комната площадью 480 × 280 = 134 400 см²", () => {
    const own: Wall[] = [wall("N", 100, 0, 190, 0), wall("R", 500, 0, 500, 300), wall("B", 500, 300, 0, 300), wall("L", 0, 300, 0, 0)]
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: own, dimensions: [] } }))
    expect(findRooms(s.walls).map((r) => r.areaCm2)).toEqual([134400])
  })

  it("MP-36: пока в сносе остаётся разрыв, помещения нет", () => {
    const own: Wall[] = [wall("R", 500, 0, 500, 300), wall("B", 500, 300, 0, 300), wall("L", 0, 300, 0, 0)]
    const s = mountingScene(drawing({ demolition: [mark("m", "W", "a", 100, 190)], mounting: { walls: own, dimensions: [] } }))
    expect(findRooms(s.walls)).toEqual([])
  })

  it("MP-37: после отмены сноса (пометка снята) стена N перекрывается с W: помещение остаётся замкнутым", () => {
    const own: Wall[] = [wall("R", 500, 0, 500, 300), wall("B", 500, 300, 0, 300), wall("L", 0, 300, 0, 0)]
    const s = mountingScene(drawing({ demolition: [], mounting: { walls: own, dimensions: [] } }))
    expect(findRooms(s.walls).map((r) => r.areaCm2)).toEqual([134400])
  })
})
