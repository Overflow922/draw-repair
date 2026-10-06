import { describe, expect, it } from "vitest"
import { nearestEdgeIntersection } from "../geometry"
import type { Dimension, Doorway, Wall } from "../types"
import { deleteObjects, doorwaysInRect, erasePick, hitDoorway, wallsInRect } from "./doorway-scene"
import { D0, door, sceneR } from "./doorway.test-utils"

// change add-doorway: попадание, рамка, приоритет ластика и каскад удаления
// (spec doorway «Выделение проёма», «Удаление проёма»; wall-deletion; multi-selection «Рамка выделения»;
// design D2, D8). Решения выбора и удаления — чистые функции, main.ts только маршрутизирует события.

// размер между внутренними углами W: (10,10) — (490,10); вынос −5 кладёт размерную линию на y = 5
function innerDimension(walls: Wall[], offset: number): Dimension {
  const from = nearestEdgeIntersection({ x: 10, y: 10 }, walls, 2)
  const to = nearestEdgeIntersection({ x: 490, y: 10 }, walls, 2)
  if (!from || !to) throw new Error("no corner")
  return { from: { a: from.a, b: from.b }, to: { a: to.a, b: to.b }, offset }
}

// размер вдоль B: внутренние углы (10,390) — (490,390); ссылается на B, L, R, но не на W
function dimensionOnB(walls: Wall[]): Dimension {
  const from = nearestEdgeIntersection({ x: 10, y: 390 }, walls, 2)
  const to = nearestEdgeIntersection({ x: 490, y: 390 }, walls, 2)
  if (!from || !to) throw new Error("no corner")
  return { from: { a: from.a, b: from.b }, to: { a: to.a, b: to.b }, offset: 30 }
}

describe("попадание в проём", () => {
  it("DX-01: клик внутри участка проёма — проём", () => {
    const { walls } = sceneR()
    const d = D0()
    expect(hitDoorway({ x: 145, y: 5 }, walls, [d], 3)).toBe(d)
    expect(hitDoorway({ x: 101, y: -9 }, walls, [d], 3)).toBe(d)
  })

  it("DX-01b: в радиусе привязки от участка — проём; дальше — нет", () => {
    const { walls } = sceneR()
    const d = D0()
    expect(hitDoorway({ x: 145, y: 12 }, walls, [d], 3)).toBe(d)
    expect(hitDoorway({ x: 145, y: 14 }, walls, [d], 3)).toBeNull()
  })

  it("DX-02: клик по стене вне проёма — не проём", () => {
    const { walls } = sceneR()
    expect(hitDoorway({ x: 50, y: 0 }, walls, [D0()], 3)).toBeNull()
    expect(hitDoorway({ x: 250, y: 0 }, walls, [D0()], 3)).toBeNull()
  })

  it("DX-02b: проём на отсутствующей стене не попадается", () => {
    const { walls } = sceneR()
    expect(hitDoorway({ x: 145, y: 0 }, walls, [door("nope", "a", 100)], 3)).toBeNull()
  })

  it("DX-02c: из нескольких проёмов — тот, в который попал клик", () => {
    const { walls } = sceneR()
    const d1 = D0()
    const d2 = door("W", "a", 300, 90, 210, "d2")
    expect(hitDoorway({ x: 340, y: 0 }, walls, [d1, d2], 3)).toBe(d2)
  })
})

describe("ластик: приоритет размер → проём → стена", () => {
  it("DX-03: размер над проёмом выигрывает, без размера — проём, вне проёма — стена", () => {
    const { walls, W } = sceneR()
    const d = D0()
    const dim = innerDimension(walls, -5)
    expect(erasePick({ x: 145, y: 5 }, { walls, dimensions: [dim], doorways: [d] }, 3, 1)).toEqual({ kind: "dimension", dimension: dim })
    expect(erasePick({ x: 145, y: 0 }, { walls, dimensions: [], doorways: [d] }, 3, 1)).toEqual({ kind: "doorway", doorway: d })
    expect(erasePick({ x: 50, y: 0 }, { walls, dimensions: [], doorways: [d] }, 3, 1)).toEqual({ kind: "wall", wall: W })
    expect(erasePick({ x: 250, y: 200 }, { walls, dimensions: [], doorways: [d] }, 3, 1)).toBeNull()
  })
})

describe("рамка выделяет проёмы по участку оси между откосами", () => {
  it("DX-07: рамка пересекает ось между откосами — проём", () => {
    const { walls } = sceneR()
    const d = D0()
    expect(doorwaysInRect({ x: 120, y: -30 }, { x: 170, y: 30 }, walls, [d])).toEqual([d])
    expect(doorwaysInRect({ x: 90, y: -5 }, { x: 200, y: 5 }, walls, [d])).toEqual([d])
    // граница рамки заходит на участок проёма лишь краем
    expect(doorwaysInRect({ x: 185, y: -30 }, { x: 260, y: 30 }, walls, [d])).toEqual([d])
  })

  it("DX-08: рамка не задела участок оси проёма — проём не выделен", () => {
    const { walls } = sceneR()
    const d = D0()
    expect(doorwaysInRect({ x: 20, y: -30 }, { x: 80, y: 30 }, walls, [d])).toEqual([])
    expect(doorwaysInRect({ x: 120, y: 3 }, { x: 170, y: 30 }, walls, [d])).toEqual([])
    expect(doorwaysInRect({ x: 195, y: -30 }, { x: 260, y: 30 }, walls, [d])).toEqual([])
  })
})

describe("рамка: ось стены на участке проёма стену не выделяет", () => {
  it("DX-09: рамка пересекает ось W только между откосами — стена не выделена, проём выделен", () => {
    const { walls } = sceneR()
    const d = D0()
    expect(wallsInRect({ x: 120, y: -30 }, { x: 170, y: 30 }, walls, [d])).toEqual([])
    expect(doorwaysInRect({ x: 120, y: -30 }, { x: 170, y: 30 }, walls, [d])).toEqual([d])
  })

  it("DX-09b: рамка пересекает ось W вне проёма — стена выделена (и проём, если задет)", () => {
    const { walls, W } = sceneR()
    const d = D0()
    expect(wallsInRect({ x: 20, y: -30 }, { x: 80, y: 30 }, walls, [d])).toEqual([W])
    expect(wallsInRect({ x: 150, y: -30 }, { x: 260, y: 30 }, walls, [d])).toEqual([W])
    expect(doorwaysInRect({ x: 150, y: -30 }, { x: 260, y: 30 }, walls, [d])).toEqual([d])
  })

  it("DX-09c: без проёмов та же рамка выделяет стену (контроль)", () => {
    const { walls, W } = sceneR()
    expect(wallsInRect({ x: 120, y: -30 }, { x: 170, y: 30 }, walls, [])).toEqual([W])
  })

  it("DX-09d: стена целиком внутри рамки выделяется, даже если у неё проём", () => {
    const { walls, W } = sceneR()
    expect(wallsInRect({ x: -20, y: -30 }, { x: 520, y: 30 }, walls, [D0()])).toContain(W)
  })

  it("DX-09e: касание края стены без оси не выделяет (прежнее правило)", () => {
    const { walls } = sceneR()
    expect(wallsInRect({ x: 20, y: 3 }, { x: 80, y: 30 }, walls, [D0()])).toEqual([])
  })
})

describe("каскад удаления", () => {
  const scene = (): { walls: Wall[]; dimensions: Dimension[]; doorways: Doorway[]; W: Wall; L: Wall; dimW: Dimension; dimB: Dimension; d: Doorway; dl: Doorway } => {
    const r = sceneR()
    const dimW = innerDimension(r.walls, -30)
    const dimB = dimensionOnB(r.walls)
    const d = D0()
    const dl = door("L", "a", 100, 90, 210, "dl")
    return { walls: r.walls, dimensions: [dimW, dimB], doorways: [d, dl], W: r.W, L: r.L, dimW, dimB, d, dl }
  }

  it("DX-04: удаление стены удаляет её проёмы и размеры, чужие проёмы остаются", () => {
    const s = scene()
    const out = deleteObjects({ walls: s.walls, dimensions: s.dimensions, doorways: s.doorways }, { walls: [s.W], dimensions: [], doorways: [] })
    expect(out.walls.map((x) => x.id)).toEqual(["R", "B", "L"])
    expect(out.doorways).toEqual([s.dl])
    expect(out.dimensions).toEqual([s.dimB])
  })

  it("DX-05: удаление проёма не трогает стены и размеры", () => {
    const s = scene()
    const out = deleteObjects({ walls: s.walls, dimensions: s.dimensions, doorways: s.doorways }, { walls: [], dimensions: [], doorways: [s.d] })
    expect(out.walls).toEqual(s.walls)
    expect(out.dimensions).toEqual(s.dimensions)
    expect(out.doorways).toEqual([s.dl])
  })

  it("DX-06: мультивыделение — стена с каскадом и проём на невыделенной стене одним вызовом", () => {
    const s = scene()
    const out = deleteObjects({ walls: s.walls, dimensions: s.dimensions, doorways: s.doorways }, { walls: [s.L], dimensions: [], doorways: [s.d] })
    expect(out.walls.map((x) => x.id)).toEqual(["W", "R", "B"])
    expect(out.doorways).toEqual([])
    // оба размера ссылаются на L (углы с L) — удалены каскадом
    expect(out.dimensions).toEqual([])
  })

  it("DX-05b: удаление выделенного размера удаляет только его", () => {
    const s = scene()
    const out = deleteObjects({ walls: s.walls, dimensions: s.dimensions, doorways: s.doorways }, { walls: [], dimensions: [s.dimB], doorways: [] })
    expect(out.dimensions).toEqual([s.dimW])
    expect(out.walls).toEqual(s.walls)
    expect(out.doorways).toEqual(s.doorways)
  })

  it("DX-06b: исходная сцена не мутируется", () => {
    const s = scene()
    const input = { walls: s.walls, dimensions: s.dimensions, doorways: s.doorways }
    deleteObjects(input, { walls: [s.W], dimensions: [s.dimB], doorways: [s.dl] })
    expect(input.walls).toHaveLength(4)
    expect(input.doorways).toHaveLength(2)
    expect(input.dimensions).toHaveLength(2)
  })

  it("DX-06c: пустое выделение ничего не удаляет", () => {
    const s = scene()
    const out = deleteObjects({ walls: s.walls, dimensions: s.dimensions, doorways: s.doorways }, { walls: [], dimensions: [], doorways: [] })
    expect(out.walls).toEqual(s.walls)
    expect(out.dimensions).toEqual(s.dimensions)
    expect(out.doorways).toEqual(s.doorways)
  })
})
