import { describe, expect, it } from "vitest"
import type { WallDoor, WallElement } from "../types"
import { moveEndpointBounded, moveWallsBounded } from "../wall-edit"
import { arrowSlide, nudgeElements, placeDoor, rotateDoor, setDistance, setHeight, setWidth, slideDoorway } from "./doorway-edit"
import { doorwayHolds, jambsT } from "./doorway-faces"
import { doorLeaf } from "./doorway-layout"
import { expectPoint, sceneF, sceneRP } from "./doorway.test-utils"
import { win } from "./window.test-utils"
import { DR, dr } from "./door.test-utils"

// change add-door: установка и правка двери — направление хранится, следует за стеной и меняется только
// поворотом (spec door «Дверь — элемент стены», «Поворот двери»; doorway «Элементы стены»; design D1, D2).

const applied = <E extends WallElement>(r: { kind: "applied"; doorway: E } | { kind: "rejected"; reason: string }): E => {
  expect(r.kind).toBe("applied")
  if (r.kind !== "applied") throw new Error(`rejected: ${r.reason}`)
  return r.doorway
}

const FREE = (doorways: WallElement[]): { ortho: false; doorways: WallElement[] } => ({ ortho: false, doorways })

describe("установка двери", () => {
  it("DE-01: дверь ставится с шириной, высотой и направлением; вид — дверь", () => {
    const { walls, W } = sceneF()
    const g = placeDoor(W, walls, { x: 203.4, y: 5 }, 80, 210, "b", "right", "n1", [])
    expect(g).toEqual({ kind: "door", id: "n1", wallId: "W", anchor: "a", offsetCm: 163, widthCm: 80, heightCm: 210, hinge: "b", swing: "right" })
  })

  it("DE-01b: дверь встаёт к соседнему окну, как проём", () => {
    const { walls, W } = sceneF()
    const x = win("W", "a", 250)
    const g = placeDoor(W, walls, { x: 260, y: 0 }, 90, 210, "a", "left", "n1", [x])
    expect(g).not.toBeNull()
    if (g) {
      expect(jambsT(g, W)).toEqual([160, 250])
      expect(doorwayHolds(g, walls, [x, g])).toBe(true)
    }
  })

  it("DE-01c: ширина или высота ≤ 0 и нехватка места — нет двери", () => {
    const { walls, W } = sceneF()
    const at = { x: 250, y: 0 }
    expect(placeDoor(W, walls, at, 0, 210, "a", "left", "z", [])).toBeNull()
    expect(placeDoor(W, walls, at, 90, 0, "a", "left", "z", [])).toBeNull()
    expect(placeDoor(W, walls, at, Number.NaN, 210, "a", "left", "z", [])).toBeNull()
    expect(placeDoor(W, walls, at, 600, 210, "a", "left", "z", [])).toBeNull()
  })
})

describe("направление не меняется правками", () => {
  it("DE-02: ввод расстояния в сторону b меняет привязку, но не петли и сторону", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const next = applied(setDistance(d, walls, 1, "b", 231, [d]))
    expect(next.anchor).toBe("b")
    expect(next).toMatchObject({ kind: "door", hinge: "a", swing: "left", widthCm: 90, heightCm: 210 })
  })

  it("DE-03: ширина, высота, перетаскивание, стрелка и сдвиг набора сохраняют вид и направление", () => {
    const { walls } = sceneF()
    const d = DR("b", "right")
    const keep = { kind: "door", hinge: "b", swing: "right" }
    expect(applied(setWidth(d, walls, 120, [d]))).toMatchObject({ ...keep, widthCm: 120 })
    expect(applied(setHeight(d, 200))).toMatchObject({ ...keep, heightCm: 200 })
    expect(applied(slideDoorway(d, walls, { x: 50, y: 0 }, [d]))).toMatchObject({ ...keep, offsetCm: 150 })
    expect(applied(arrowSlide(d, walls, { x: 1, y: 0 }, 10, [d]))).toMatchObject({ ...keep, offsetCm: 110 })
    const [moved] = nudgeElements([d], walls, [d], { x: -1, y: 0 }, 10)
    expect(moved).toMatchObject({ ...keep, offsetCm: 90 })
  })

  it("DE-04: дверь следует за концом привязки: конец a в (−50, 0) — откос в (50, 0), петля на грани у него", () => {
    const { walls, W } = sceneF()
    const d = DR("a", "left")
    moveEndpointBounded(walls, W, "a", { x: -50, y: 0 }, FREE([d]))
    expectPoint(W.a, -50, 0)
    expect(jambsT(d, W)).toEqual([100, 190])
    expect(d).toEqual(DR("a", "left"))
    const leaf = doorLeaf(d, walls)
    expect(leaf).not.toBeNull()
    if (leaf) expectPoint(leaf.hinge, 50, -10)
  })

  it("DE-05: перегородка не заходит в дверь — грань касается откоса", () => {
    const { walls, P } = sceneRP()
    const d = dr("W", "a", 100)
    moveWallsBounded(walls, [P], { x: -200, y: 0 }, FREE([d]))
    expect(P.a.x).toBeCloseTo(195, 3)
    expect(P.b.x).toBeCloseTo(195, 3)
  })

  it("DE-06: перетаскивание двери на окно останавливается в касании откосов", () => {
    const { walls } = sceneF()
    const d = DR()
    const x = win("W", "a", 250)
    const list: WallElement[] = [d, x]
    const next = applied(slideDoorway(d, walls, { x: 200, y: 0 }, list))
    expect(next).toEqual({ ...d, offsetCm: 160 })
    expect(doorwayHolds(next, walls, [next, x])).toBe(true)
  })
})

describe("поворот двери", () => {
  it("DE-07: rotateDoor даёт следующее направление, положение и размеры прежние, вход не мутирован", () => {
    const d = DR("a", "left")
    const next = applied(rotateDoor(d))
    expect(next).toEqual({ ...d, hinge: "b", swing: "left" })
    expect(d).toEqual(DR("a", "left"))
  })

  it("DE-07b: четыре поворота подряд проходят круг и возвращают исходную дверь", () => {
    let d: WallDoor = DR("a", "left")
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      d = applied(rotateDoor(d))
      seen.push(`${d.hinge}/${d.swing}`)
    }
    expect(seen).toEqual(["b/left", "b/right", "a/right", "a/left"])
    expect(d).toEqual(DR("a", "left"))
  })
})
