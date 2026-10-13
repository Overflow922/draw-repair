import { describe, expect, it } from "vitest"
import { duct, riser } from "../communications/communications.test-utils"
import { nearestEdgeIntersection } from "../geometry"
import type { Communication, Dimension, Point, Wall, WallElement } from "../types"
import { erasePick, pressPick } from "./doorway-scene"
import type { PressOptions } from "./doorway-scene"
import { door, sceneR } from "./doorway.test-utils"

// change fix-dimension-press-priority (design D1, D2): цель нажатия без инструмента — размер главнее тела
// коммуникации. Порядок: маркеры выделенной стены → размер → коммуникация → проём → стена.
// Контракт, который задают тесты: pressPick принимает шестым аргументом { items, tolCm } — коммуникации и допуск
// попадания по телу (он отдельный от радиуса привязки); без аргумента коммуникации не цель (планы «Демонтаж»,
// «Монтаж»); результат-коммуникация — { kind: "communication", communication }.

const TOL = 6 // радиус привязки при масштабе 1
const BODY_TOL = 2 // допуск по телу коммуникации (пара пикселей)
const TEXT = 2
const ALL: PressOptions = { selectedWall: null, middleMarker: true, dimensions: true, elements: true }
const opts = (patch: Partial<PressOptions>): PressOptions => ({ ...ALL, ...patch })

// размер между внутренними углами комнаты R: (10,10) — (490,10); линия на y = 10 + offset
function innerDimension(walls: Wall[], offset: number): Dimension {
  const from = nearestEdgeIntersection({ x: 10, y: 10 }, walls, 2)
  const to = nearestEdgeIntersection({ x: 490, y: 10 }, walls, 2)
  if (!from || !to) throw new Error("no corner")
  return { from: { a: from.a, b: from.b }, to: { a: to.a, b: to.b }, offset }
}

const LINE_Y = 200 // линия размера с выносом 190

function pick(
  p: Point,
  walls: Wall[],
  dimensions: Dimension[],
  communications: Communication[] | null,
  options: PressOptions = ALL,
  doorways: WallElement[] = [],
) {
  const comm = communications ? { items: communications, tolCm: BODY_TOL } : undefined
  return pressPick(p, { walls, dimensions, doorways }, TOL, TEXT, options, comm)
}

describe("размер главнее тела коммуникации", () => {
  it("DP-01: размерная линия внутри тела воздуховода — размер, а не воздуховод", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    const d = duct(250, LINE_Y, 200, 40)
    // контроль: без размера та же точка — воздуховод
    expect(pick({ x: 170, y: LINE_Y }, walls, [], [d])).toEqual({ kind: "communication", communication: d })
    expect(pick({ x: 170, y: LINE_Y }, walls, [dim], [d])).toEqual({ kind: "dimension", dimension: dim })
  })

  it("DP-02: размер поверх стояка — размер, в центре и рядом с линией", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    const r = riser(250, LINE_Y, 30)
    expect(pick({ x: 250, y: LINE_Y }, walls, [], [r])).toEqual({ kind: "communication", communication: r })
    expect(pick({ x: 250, y: LINE_Y }, walls, [dim], [r])).toEqual({ kind: "dimension", dimension: dim })
    expect(pick({ x: 255, y: LINE_Y + 3 }, walls, [dim], [r])).toEqual({ kind: "dimension", dimension: dim })
  })

  it("DP-04: тело воздуховода дальше допуска размера — воздуховод; рядом с линией — размер", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    const d = duct(250, LINE_Y, 200, 40) // тело y 180…220
    expect(pick({ x: 170, y: 185 }, walls, [dim], [d])).toEqual({ kind: "communication", communication: d })
    expect(pick({ x: 170, y: 215 }, walls, [dim], [d])).toEqual({ kind: "communication", communication: d })
    expect(pick({ x: 170, y: 195 }, walls, [dim], [d])).toEqual({ kind: "dimension", dimension: dim })
  })

  it("DP-09: граница допуска размера внутри тела — на допуске размер, чуть дальше воздуховод", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    const d = duct(250, LINE_Y, 200, 40)
    expect(pick({ x: 170, y: LINE_Y + TOL }, walls, [dim], [d])).toEqual({ kind: "dimension", dimension: dim })
    expect(pick({ x: 170, y: LINE_Y + TOL + 0.5 }, walls, [dim], [d])).toEqual({ kind: "communication", communication: d })
  })

  it("DP-12: результат не зависит от порядка коммуникаций в списке", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    const d = duct(250, LINE_Y, 200, 40)
    const r = riser(170, LINE_Y, 20)
    for (const list of [[d, r], [r, d]]) {
      expect(pick({ x: 170, y: LINE_Y }, walls, [dim], list)).toEqual({ kind: "dimension", dimension: dim })
      // без размера в списке обе коммуникации на расстоянии 0 от точки: при равенстве побеждает первая в списке
      expect(pick({ x: 170, y: LINE_Y }, walls, [], list)).toEqual({ kind: "communication", communication: list[0] })
    }
  })
})

describe("коммуникация вне размера — прежнее поведение", () => {
  it("DP-06: нажатие по телу без размера — коммуникация; граница допуска по телу", () => {
    const { walls } = sceneR()
    const d = duct(250, LINE_Y, 200, 40) // тело x 150…350, y 180…220
    const r = riser(250, 100, 20)
    expect(pick({ x: 250, y: LINE_Y }, walls, [], [d])).toEqual({ kind: "communication", communication: d })
    expect(pick({ x: 250, y: 180 - BODY_TOL }, walls, [], [d])).toEqual({ kind: "communication", communication: d })
    expect(pick({ x: 250, y: 180 - BODY_TOL - 0.5 }, walls, [], [d])).toBeNull()
    expect(pick({ x: 250, y: 100 }, walls, [], [r])).toEqual({ kind: "communication", communication: r })
    expect(pick({ x: 250 + 10 + BODY_TOL, y: 100 }, walls, [], [r])).toEqual({ kind: "communication", communication: r })
    expect(pick({ x: 250 + 10 + BODY_TOL + 0.5, y: 100 }, walls, [], [r])).toBeNull()
  })

  it("DP-06b: допуск по телу не равен радиусу привязки — в радиусе привязки, но вне допуска тела, цели нет", () => {
    const { walls } = sceneR()
    const d = duct(250, LINE_Y, 200, 40)
    expect(pick({ x: 250, y: 180 - TOL }, walls, [], [d])).toBeNull()
  })
})

describe("порядок остальных целей", () => {
  it("DP-07: средний маркер выделенной стены главнее размера и коммуникации", () => {
    const { walls, W } = sceneR()
    const dim = innerDimension(walls, -5) // линия y = 5 через середину W (250, 0)
    const d = duct(250, 0, 100, 20)
    expect(pick({ x: 250, y: 0 }, walls, [dim], [d], opts({ selectedWall: W }))).toEqual({ kind: "middle", wall: W })
    expect(pick({ x: 250, y: 0 }, walls, [dim], [d], opts({ selectedWall: null }))).toEqual({ kind: "dimension", dimension: dim })
  })

  it("DP-07b: маркер конца выделенной стены главнее коммуникации", () => {
    const { walls, W } = sceneR()
    const d = duct(0, 0, 40, 40)
    expect(pick({ x: 0, y: 0 }, walls, [], [d], opts({ selectedWall: W }))).toEqual({ kind: "end", wall: W, end: "a" })
  })

  it("DP-08: коммуникация главнее проёма вплотную к ней", () => {
    const { walls } = sceneR()
    const dr = door("W", "a", 205)
    const d = duct(250, 25, 30, 20) // тело y 15…35; участок проёма с допуском доходит до y 16
    const p = { x: 250, y: 15.5 }
    expect(pick(p, walls, [], null, ALL, [dr])).toEqual({ kind: "doorway", doorway: dr })
    expect(pick(p, walls, [], [d], ALL, [dr])).toEqual({ kind: "communication", communication: d })
  })

  it("DP-08b: проём главнее стены остаётся, когда коммуникации рядом нет", () => {
    const { walls } = sceneR()
    const dr = door("W", "a", 205)
    const d = duct(250, 300, 30, 20)
    expect(pick({ x: 220, y: 0 }, walls, [], [d], ALL, [dr])).toEqual({ kind: "doorway", doorway: dr })
  })
})

describe("недоступные коммуникации и опции", () => {
  it("DP-10: без коммуникаций в аргументе (планы «Демонтаж»/«Монтаж») воздуховод не цель", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    expect(pick({ x: 250, y: 190 }, walls, [], null)).toBeNull()
    expect(pick({ x: 170, y: LINE_Y }, walls, [dim], null)).toEqual({ kind: "dimension", dimension: dim })
  })

  it("DP-11: размеры выключены (активен инструмент/ластик) — размерная линия не цель, коммуникация под ней — цель", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    const d = duct(250, LINE_Y, 200, 40)
    expect(pick({ x: 170, y: LINE_Y }, walls, [dim], [d], opts({ dimensions: false }))).toEqual({ kind: "communication", communication: d })
  })
})

describe("ластик", () => {
  it("DP-05: ластик в точке с размером выбирает размер (регрессия: порядок ластика не меняется)", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 190)
    expect(erasePick({ x: 170, y: LINE_Y }, { walls, dimensions: [dim], doorways: [] }, TOL, TEXT)).toEqual({ kind: "dimension", dimension: dim })
  })
})
