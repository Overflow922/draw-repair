import { describe, expect, it } from "vitest"
import { nearestEdgeIntersection } from "../geometry"
import type { Dimension, Point, Wall, WallElement } from "../types"
import { moveWallsBounded } from "../wall-edit"
import { doorwayHolds } from "./doorway-faces"
import { slideDoorway } from "./doorway-edit"
import { pressPick } from "./doorway-scene"
import type { PressOptions } from "./doorway-scene"
import { door, sceneF, sceneR, w } from "./doorway.test-utils"
import { win } from "./window.test-utils"

// change fix-midpoint-marker-priority: цель нажатия левой кнопки (spec wall-selection «Приоритет маркеров
// выделенной стены», doorway «Перемещение проёма»; design D1). Маркеры одиночной выделенной стены главнее
// размера, элемента стены и тела стены; порядок — конец a, конец b, середина, размер, элемент, стена.

const TOL = 6 // радиус привязки при масштабе 1: 12 px / 2 px на см
const TEXT = 2 // множитель текста размера, как в main.ts

const ALL: PressOptions = { selectedWall: null, middleMarker: true, dimensions: true, elements: true }
const opts = (patch: Partial<PressOptions>): PressOptions => ({ ...ALL, ...patch })

// размер между внутренними углами W комнаты R: (10,10) — (490,10); вынос −5 — линия на y = 5, 90 — на y = 100
function innerDimension(walls: Wall[], offset: number): Dimension {
  const from = nearestEdgeIntersection({ x: 10, y: 10 }, walls, 2)
  const to = nearestEdgeIntersection({ x: 490, y: 10 }, walls, 2)
  if (!from || !to) throw new Error("no corner")
  return { from: { a: from.a, b: from.b }, to: { a: to.a, b: to.b }, offset }
}

// DC — свободная W (0,0)-(500,0) t20 с проёмом 205…295: середина W (250,0) внутри участка проёма
function sceneDC(): { walls: Wall[]; W: Wall; d: WallElement } {
  const { walls, W } = sceneF()
  return { walls, W, d: door("W", "a", 205) }
}

const pick = (p: Point, walls: Wall[], doorways: WallElement[], options: PressOptions, dimensions: Dimension[] = [], tol = TOL) =>
  pressPick(p, { walls, dimensions, doorways }, tol, TEXT, options)

describe("маркеры выделенной стены главнее элементов стены", () => {
  it("PP-01: средний маркер над проёмом — перемещение стены, а не проём", () => {
    const { walls, W, d } = sceneDC()
    const r = pick({ x: 250, y: 0 }, walls, [d], opts({ selectedWall: W }))
    expect(r).toEqual({ kind: "middle", wall: W })
    expect(r?.kind === "middle" && r.wall).toBe(W)
  })

  it("PP-02: средний маркер над окном — перемещение стены", () => {
    const { walls, W } = sceneF()
    const wn = win("W", "a", 190) // участок 190…310
    const r = pick({ x: 250, y: 0 }, walls, [wn], opts({ selectedWall: W }))
    expect(r).toEqual({ kind: "middle", wall: W })
    expect(r?.kind === "middle" && r.wall).toBe(W)
  })

  it("PP-03: нажатие на проём дальше радиуса от маркеров — проём", () => {
    const { walls, W, d } = sceneDC()
    const r = pick({ x: 220, y: 0 }, walls, [d], opts({ selectedWall: W }))
    expect(r).toEqual({ kind: "doorway", doorway: d })
    expect(r?.kind === "doorway" && r.doorway).toBe(d)
  })

  it("PP-06: маркер конца над проёмом — перетаскивание конца", () => {
    const { walls, W } = sceneF()
    const d = door("W", "a", 0) // участок 0…90 накрывает конец a
    expect(pick({ x: 0, y: 0 }, walls, [d], opts({}))).toEqual({ kind: "doorway", doorway: d })
    const r = pick({ x: 0, y: 0 }, walls, [d], opts({ selectedWall: W }))
    expect(r).toEqual({ kind: "end", wall: W, end: "a" })
    expect(r?.kind === "end" && r.wall).toBe(W)
  })
})

describe("маркеры выделенной стены главнее размеров", () => {
  it("PP-04: средний маркер над размерной линией — перемещение стены", () => {
    const { walls, W } = sceneR()
    const dim = innerDimension(walls, -5)
    // контроль: без выделенной стены та же точка попадает в размер
    expect(pick({ x: 250, y: 0 }, walls, [], opts({}), [dim])).toEqual({ kind: "dimension", dimension: dim })
    const r = pick({ x: 250, y: 0 }, walls, [], opts({ selectedWall: W }), [dim])
    expect(r).toEqual({ kind: "middle", wall: W })
    expect(r?.kind === "middle" && r.wall).toBe(W)
  })

  it("PP-05: маркер конца над размером — перетаскивание конца", () => {
    const { walls, W } = sceneR()
    const dim = innerDimension(walls, -5)
    const p = { x: 497, y: 2 }
    expect(pick(p, walls, [], opts({}), [dim], 12)).toEqual({ kind: "dimension", dimension: dim })
    const r = pick(p, walls, [], opts({ selectedWall: W }), [dim], 12)
    expect(r).toEqual({ kind: "end", wall: W, end: "b" })
    expect(r?.kind === "end" && r.wall).toBe(W)
  })
})

describe("порядок маркеров: конец a, конец b, середина", () => {
  // S — короткая стена (0,0)-(8,0): оба конца и середина в радиусе привязки друг от друга
  const S = (): { walls: Wall[]; S: Wall } => {
    const s = w(0, 0, 8, 0, "S")
    return { walls: [s], S: s }
  }

  it("PP-07: ближе к a и середине — конец a", () => {
    const { walls, S: s } = S()
    expect(pick({ x: 2, y: 0 }, walls, [], opts({ selectedWall: s }))).toEqual({ kind: "end", wall: s, end: "a" })
  })

  it("PP-08: в радиусе b и середины, вне радиуса a — конец b, а не середина", () => {
    const { walls, S: s } = S()
    // до a 7, до b 1, до середины 3
    expect(pick({ x: 7, y: 0 }, walls, [], opts({ selectedWall: s }))).toEqual({ kind: "end", wall: s, end: "b" })
  })

  it("PP-09: в середине, оба конца в радиусе — конец a", () => {
    const { walls, S: s } = S()
    expect(pick({ x: 4, y: 0 }, walls, [], opts({ selectedWall: s }))).toEqual({ kind: "end", wall: s, end: "a" })
  })
})

describe("без маркеров выделенной стены — прежние правила", () => {
  it("PP-10: без выделенной стены середина над проёмом — проём", () => {
    const { walls, d } = sceneDC()
    const r = pick({ x: 250, y: 0 }, walls, [d], opts({ selectedWall: null }))
    expect(r).toEqual({ kind: "doorway", doorway: d })
    expect(r?.kind === "doorway" && r.doorway).toBe(d)
  })

  it("PP-11: средний маркер выключен (Проём/Окно) — проём под серединой", () => {
    const { walls, W, d } = sceneDC()
    expect(pick({ x: 250, y: 0 }, walls, [d], opts({ selectedWall: W, middleMarker: false }))).toEqual({ kind: "doorway", doorway: d })
  })

  it("PP-12: средний маркер выключен, элементов нет — тело стены", () => {
    const { walls, W } = sceneF()
    const r = pick({ x: 250, y: 0 }, walls, [], opts({ selectedWall: W, middleMarker: false }))
    expect(r).toEqual({ kind: "wall", wall: W })
    expect(r?.kind === "wall" && r.wall).toBe(W)
  })

  it("PP-13: пустое место — null", () => {
    const { walls, W, d } = sceneDC()
    expect(pick({ x: 250, y: 200 }, walls, [d], opts({ selectedWall: W }))).toBeNull()
  })

  it("PP-14: элементы выключены (цепочка, «Размер») — тело стены под проёмом", () => {
    const { walls, W, d } = sceneDC()
    const r = pick({ x: 220, y: 0 }, walls, [d], opts({ selectedWall: W, elements: false }))
    expect(r).toEqual({ kind: "wall", wall: W })
    expect(r?.kind === "wall" && r.wall).toBe(W)
  })

  it("PP-15: размеры выключены (ластик) — размерная линия не цель", () => {
    const { walls } = sceneR()
    const dim = innerDimension(walls, 90)
    expect(pick({ x: 250, y: 100 }, walls, [], opts({}), [dim])).toEqual({ kind: "dimension", dimension: dim })
    expect(pick({ x: 250, y: 100 }, walls, [], opts({ dimensions: false }), [dim])).toBeNull()
  })

  it("PP-16: маркеры только у выделенной стены — середина другой стены над проёмом даёт проём", () => {
    const { walls, R } = sceneR()
    const d = door("W", "a", 205)
    expect(pick({ x: 250, y: 0 }, walls, [d], opts({ selectedWall: R }))).toEqual({ kind: "doorway", doorway: d })
    // конец W (0,0) — не маркер: выделена R
    expect(pick({ x: 0, y: 0 }, walls, [], opts({ selectedWall: R }))?.kind).toBe("wall")
  })

  it("PP-17: средний маркер выключен — концевые маркеры действуют", () => {
    const { walls, W } = sceneF()
    const d = door("W", "a", 0)
    expect(pick({ x: 0, y: 0 }, walls, [d], opts({ selectedWall: W, middleMarker: false }))).toEqual({ kind: "end", wall: W, end: "a" })
    expect(pick({ x: 500, y: 0 }, walls, [], opts({ selectedWall: W, middleMarker: false, dimensions: false, elements: false }))).toEqual({
      kind: "end",
      wall: W,
      end: "b",
    })
  })
})

describe("опции и стены не от начала координат", () => {
  it("PP-22: элементы выключены (цепочка, «Размер») — средний маркер над проёмом действует", () => {
    const { walls, W, d } = sceneDC()
    expect(pick({ x: 250, y: 0 }, walls, [d], opts({ selectedWall: W, elements: false }))).toEqual({ kind: "middle", wall: W })
  })

  it("PP-23: середина вертикальной стены R (500,0)-(500,400) — средний маркер", () => {
    const { walls, R } = sceneR()
    const d = door("R", "a", 155) // участок y 155…245, середина R (500,200) внутри
    const r = pick({ x: 500, y: 200 }, walls, [d], opts({ selectedWall: R }))
    expect(r).toEqual({ kind: "middle", wall: R })
    expect(r?.kind === "middle" && r.wall).toBe(R)
    // в 100 см от середины — не маркер
    expect(pick({ x: 500, y: 100 }, walls, [], opts({ selectedWall: R }))).toEqual({ kind: "wall", wall: R })
  })

  it("PP-24: без выделенной стены нажатие на тело стены — стена", () => {
    const { walls, W } = sceneF()
    const r = pick({ x: 100, y: 0 }, walls, [], opts({ selectedWall: null }))
    expect(r).toEqual({ kind: "wall", wall: W })
    expect(r?.kind === "wall" && r.wall).toBe(W)
  })

  it("PP-25: проём и стена попадаются с радиусом привязки", () => {
    const { walls, W, d } = sceneDC()
    // проём: грань W на y = 10, точка в 3 см за гранью — в радиусе 6 от участка проёма
    expect(pick({ x: 220, y: 13 }, walls, [d], opts({ selectedWall: W }))).toEqual({ kind: "doorway", doorway: d })
    // стена: радиус отсчитывается от оси; тонкая стена t4, точка в 5 см от оси — в радиусе 6
    const T = w(0, 0, 500, 0, "T", 4)
    const r = pick({ x: 100, y: 5 }, [T], [], opts({ selectedWall: null }))
    expect(r).toEqual({ kind: "wall", wall: T })
    expect(r?.kind === "wall" && r.wall).toBe(T)
  })

  it("PP-26: размер главнее проёма вне маркеров", () => {
    const { walls, W } = sceneR()
    const dim = innerDimension(walls, -5) // линия y = 5 проходит через участок проёма
    const d = door("W", "a", 205)
    expect(pick({ x: 220, y: 5 }, walls, [d], opts({ selectedWall: null }), [dim])).toEqual({ kind: "dimension", dimension: dim })
    expect(pick({ x: 220, y: 5 }, walls, [d], opts({ selectedWall: W }), [dim])).toEqual({ kind: "dimension", dimension: dim })
    // контроль: без размера та же точка — проём
    expect(pick({ x: 220, y: 5 }, walls, [d], opts({ selectedWall: W }))).toEqual({ kind: "doorway", doorway: d })
  })
})

describe("граница радиуса среднего маркера", () => {
  it("PP-18: ровно на радиусе от середины — средний маркер", () => {
    const { walls, W, d } = sceneDC()
    expect(pick({ x: 256, y: 0 }, walls, [d], opts({ selectedWall: W }))).toEqual({ kind: "middle", wall: W })
  })

  it("PP-19: чуть дальше радиуса — проём", () => {
    const { walls, W, d } = sceneDC()
    expect(pick({ x: 256.5, y: 0 }, walls, [d], opts({ selectedWall: W }))).toEqual({ kind: "doorway", doorway: d })
  })
})

describe("сценарии от нажатия до правки", () => {
  it("PP-20: стена, перемещённая за середину над проёмом, уносит проём без изменения его данных", () => {
    const { walls, W, d } = sceneDC()
    expect(pick({ x: 250, y: 0 }, walls, [d], opts({ selectedWall: W }))?.kind).toBe("middle")
    const before = { ...d }
    expect(moveWallsBounded(walls, [W], { x: 0, y: -50 }, { ortho: false, doorways: [d] })).toEqual({ x: 0, y: -50 })
    expect(W.a).toEqual({ x: 0, y: -50 })
    expect(W.b).toEqual({ x: 500, y: -50 })
    expect(d).toEqual(before)
    expect(doorwayHolds(d, walls, [d])).toBe(true)
  })

  it("PP-21: проём, нажатый вне маркеров выделенной стены, сдвигается на проекцию смещения", () => {
    const { walls, W, d } = sceneDC()
    expect(pick({ x: 220, y: 0 }, walls, [d], opts({ selectedWall: W }))?.kind).toBe("doorway")
    const r = slideDoorway(d, walls, { x: -30, y: 0 }, [d])
    expect(r).toEqual({ kind: "applied", doorway: { ...d, offsetCm: 175, anchor: "a" } })
    expect(W.a).toEqual({ x: 0, y: 0 })
    expect(W.b).toEqual({ x: 500, y: 0 })
  })
})
