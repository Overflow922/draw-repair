import { describe, expect, it } from "vitest"
import { deleteObjects } from "./doorway/doorway-scene"
import { cloneScene, record, redoEntry, undoEntry } from "./history"
import type { DrawingHistory, Scene } from "./history"
import { nearestEdgeIntersection } from "./geometry"
import type { Dimension, WallElement } from "./types"
import { jambDimension, jambPoint, sceneF2, sceneR2, win } from "./dimension-anchor.test-utils"

// change add-opening-dimension-anchors: удаление элемента удаляет размеры на его откосах, одна запись истории
// (spec dimension-tool «Удаление элемента удаляет размеры на его откосах»; design D6, D8).

const between = (a: string, ja: "a" | "b", b: string, jb: "a" | "b", offset = 30): Dimension =>
  jambDimension(jambPoint(a, ja, 1), jambPoint(b, jb, 1), offset)

function cornerDimension(walls: Scene["walls"]): Dimension {
  const from = nearestEdgeIntersection({ x: 10, y: 10 }, walls, 2)
  const to = nearestEdgeIntersection({ x: 490, y: 10 }, walls, 2)
  if (!from || !to) throw new Error("предусловие: углы комнаты")
  return { from: { a: from.a, b: from.b }, to: { a: to.a, b: to.b }, offset: -5 }
}

const none = { walls: [], dimensions: [], doorways: [] }

describe("удаление элемента вычищает размеры на его откосах", () => {
  it("DA-23: размер между окнами уходит с удалённым окном, второе окно остаётся", () => {
    const { walls, e1, e2, elements } = sceneF2()
    const shared = between("e1", "b", "e2", "a")
    const scene: Scene = { walls, dimensions: [shared], doorways: elements }
    const after = deleteObjects(scene, { ...none, doorways: [e1] })
    expect(after.doorways).toEqual([e2])
    expect(after.dimensions).toEqual([])
    expect(after.walls).toEqual(walls)
  })

  it("DA-23b: порядок не важен — удаляется окно, на чьём откосе лежит вторая точка размера", () => {
    const { walls, e2, e1, elements } = sceneF2()
    const shared = between("e1", "b", "e2", "a")
    const after = deleteObjects({ walls, dimensions: [shared], doorways: elements }, { ...none, doorways: [e2] })
    expect(after.doorways).toEqual([e1])
    expect(after.dimensions).toEqual([])
  })

  it("DA-23c: откос и вершина контура в одном размере — размер уходит с элементом", () => {
    const { walls, e1, elements } = sceneR2()
    const corner = cornerDimension(walls)
    const mixed: Dimension = { from: jambPoint("e1", "a", 1), to: corner.from, offset: 20 }
    const after = deleteObjects({ walls, dimensions: [mixed, corner], doorways: elements }, { ...none, doorways: [e1] })
    expect(after.dimensions).toEqual([corner])
  })

  it("DA-26: размеры между углами стен и к откосам другого элемента остаются", () => {
    const { walls, e1, elements } = sceneR2()
    const e3 = elements[1]
    const corner = cornerDimension(walls)
    const own = between("e3", "a", "e3", "b")
    const shared = between("e1", "b", "e3", "a")
    const after = deleteObjects({ walls, dimensions: [corner, own, shared], doorways: elements }, { ...none, doorways: [e1] })
    expect(after.dimensions).toEqual([corner, own])
    expect(after.doorways).toEqual([e3])
  })

  it("DA-26b: удаление элемента без размеров не трогает список размеров", () => {
    const { walls, e1, elements } = sceneF2()
    const other = between("e2", "a", "e2", "b")
    const after = deleteObjects({ walls, dimensions: [other], doorways: elements }, { ...none, doorways: [e1] })
    expect(after.dimensions).toEqual([other])
  })

  it("DA-26c: размер с откосом удаляемого элемента не задевает размеры оставшихся стен", () => {
    const { walls, e1, elements } = sceneR2()
    const corner = cornerDimension(walls)
    const after = deleteObjects({ walls, dimensions: [corner], doorways: elements }, { ...none, doorways: [e1] })
    expect(after.dimensions).toEqual([corner])
  })
})

describe("каскад удаления опорной стены", () => {
  it("DA-25: удаление стены удаляет её окна и размеры к откосам этих окон, включая вторую точку на другой стене", () => {
    const { walls, W, e3, elements } = sceneR2()
    const crossWalls = between("e1", "b", "e3", "a")
    const onlyB = between("e3", "a", "e3", "b")
    const onlyW = between("e1", "a", "e1", "b")
    const after = deleteObjects({ walls, dimensions: [crossWalls, onlyB, onlyW], doorways: elements }, { ...none, walls: [W] })
    expect(after.walls).not.toContain(W)
    expect(after.doorways).toEqual([e3])
    expect(after.dimensions).toEqual([onlyB])
  })

  it("DA-25b: удаление стены каскадом убирает и граневые размеры стены, и размеры к её откосам", () => {
    const { walls, W, elements } = sceneR2()
    const corner = cornerDimension(walls)
    const jambs = between("e1", "a", "e1", "b")
    const after = deleteObjects({ walls, dimensions: [corner, jambs], doorways: elements }, { ...none, walls: [W] })
    expect(after.dimensions).toEqual([])
  })

  it("DA-25c: размер к откосу окна на удаляемой стене и граневая вершина другой стены — уходит", () => {
    const { walls, B, elements } = sceneR2()
    const corner = cornerDimension(walls)
    const mixed: Dimension = { from: jambPoint("e3", "a", 1), to: corner.to, offset: 10 }
    const after = deleteObjects({ walls, dimensions: [mixed], doorways: elements }, { ...none, walls: [B] })
    expect(after.dimensions).toEqual([])
  })
})

describe("множественное удаление", () => {
  it("DA-27: рамкой выбраны оба окна и их общий размер — размер удалён один раз, чужие целы", () => {
    const { walls, e1, e2, elements } = sceneF2()
    const shared = between("e1", "b", "e2", "a")
    const onE1 = jambDimension(jambPoint("e1", "a", -1), jambPoint("e1", "b", -1), 15)
    // onE1 ссылается на удаляемый e1 — уходит; stays — на e3 вне выбора
    const e3 = win("W", "a", 450, 40, 150, 85, "e3")
    const stays = between("e3", "a", "e3", "b")
    const after = deleteObjects(
      { walls, dimensions: [shared, onE1, stays], doorways: [...elements, e3] },
      { ...none, dimensions: [shared], doorways: [e1, e2] },
    )
    expect(after.dimensions).toEqual([stays])
    expect(after.doorways).toEqual([e3])
  })
})

describe("история удаления", () => {
  const prepare = (): { scene: Scene; after: Scene; shared: Dimension; e1: WallElement } => {
    const { walls, e1, elements } = sceneF2()
    const shared = jambDimension(jambPoint("e1", "b", 1), jambPoint("e2", "a", -1), 42)
    const scene: Scene = { walls, dimensions: [shared], doorways: elements }
    return { scene, after: deleteObjects(scene, { walls: [], dimensions: [], doorways: [e1] }), shared, e1 }
  }

  it("DA-24: «Отменить» возвращает окно и размер с прежними откосами и смещением одной записью", () => {
    const { scene, after, shared, e1 } = prepare()
    const h: DrawingHistory = { past: [], future: [] }
    record(h, cloneScene(scene))
    expect(after.dimensions).toEqual([])
    const undone = undoEntry(h, after)
    expect(undone?.kind).toBe("walls")
    if (undone?.kind !== "walls") return
    expect(undone.dimensions).toEqual([shared])
    expect(undone.doorways).toContainEqual(e1)
    expect(h.past).toHaveLength(0)
  })

  it("DA-17: cloneScene копирует точки-откосы без потерь и без общих ссылок", () => {
    const { scene } = prepare()
    const copy = cloneScene(scene)
    expect(copy.dimensions).toEqual(scene.dimensions)
    expect(copy.dimensions[0]).not.toBe(scene.dimensions[0])
    expect(copy.dimensions[0].from).not.toBe(scene.dimensions[0].from)
    expect(copy.dimensions[0].to).not.toBe(scene.dimensions[0].to)
  })

  it("DA-17b: отмена и повтор — размер с откосами исчезает и возвращается с теми же откосами и смещением", () => {
    const { scene, after, shared } = prepare()
    const h: DrawingHistory = { past: [], future: [] }
    record(h, cloneScene(after))
    const undone = undoEntry(h, scene)
    expect(undone?.kind === "walls" ? undone.dimensions : null).toEqual([])
    const redone = redoEntry(h, after)
    expect(redone?.kind === "walls" ? redone.dimensions : null).toEqual([shared])
    expect(h.past).toHaveLength(1)
    const again = undoEntry(h, scene)
    expect(again?.kind === "walls" ? again.dimensions : null).toEqual([])
  })

  it("DA-17c: откос не теряет поля при записи в историю, а запись остаётся независимой от сцены", () => {
    const { scene, shared } = prepare()
    const h: DrawingHistory = { past: [], future: [] }
    record(h, cloneScene(scene))
    scene.dimensions[0] = { ...shared, offset: 999 }
    const undone = undoEntry(h, scene)
    expect(undone?.kind === "walls" ? undone.dimensions : null).toEqual([shared])
  })
})
