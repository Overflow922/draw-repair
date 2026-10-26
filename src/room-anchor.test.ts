import { describe, expect, it } from "vitest"
import { activeAnchored, canAnchor, roomAt } from "./room-anchor"
import { findRooms } from "./room-area"
import { reconcileRooms } from "./room-explication"
import { deepFreeze, rectWalls } from "./rough/rough.test-utils"
import type { Wall } from "./types"

// change add-ceiling-plan, design D3: общая привязка объекта к помещению экспликации опорной точкой — правила стяжки и
// натяжного потолка (spec ceiling-plan «Натяжной потолок помещения», rough-works-plan «Помещение со стяжкой»)

interface Obj {
  id: string
  at: { x: number; y: number }
}

const obj = (id: string, x: number, y: number): Obj => ({ id, at: { x, y } })

// комната K: внутренняя область [10,410]×[10,310]
const roomItems = (walls: Wall[] = rectWalls("k", 0, 0, 420, 320)) => reconcileRooms(findRooms(walls), [])
const partition: Wall = { id: "p", a: { x: 200, y: 0 }, b: { x: 200, y: 320 }, thicknessCm: 20, type: "brick" }

describe("roomAt", () => {
  it("CP-1: точка в помещении — это помещение; вне помещений и в теле стены — null", () => {
    const items = roomItems()
    expect(roomAt({ x: 200, y: 160 }, items)).toBe(items[0])
    expect(roomAt({ x: 600, y: 160 }, items)).toBeNull()
    expect(roomAt({ x: 5, y: 160 }, items)).toBeNull()
  })

  it("CP-2: точка в острове внутри помещения — null", () => {
    const items = roomItems([...rectWalls("k", 0, 0, 420, 320), ...rectWalls("i", 150, 100, 250, 200, 20)])
    expect(roomAt({ x: 200, y: 150 }, items)).toBeNull()
    expect(roomAt({ x: 60, y: 60 }, items)).not.toBeNull()
  })
})

describe("activeAnchored", () => {
  it("CP-3: объект с точкой в помещении действует и привязан к нему; объект вне помещений спит", () => {
    const items = roomItems()
    const active = activeAnchored(items, [obj("a", 200, 160), obj("out", 600, 160)])
    expect(active.map((a) => a.object.id)).toEqual(["a"])
    expect(active[0]?.item).toBe(items[0])
  })

  it("CP-4: два объекта в одном помещении — действует первый в списке", () => {
    expect(activeAnchored(roomItems(), [obj("early", 100, 100), obj("late", 300, 200)]).map((a) => a.object.id)).toEqual(["early"])
  })

  it("CP-5: помещение разделено — объект у части со своей точкой, другая часть пуста; порядок — как в списке", () => {
    const items = roomItems([...rectWalls("k", 0, 0, 420, 320), partition])
    expect(items).toHaveLength(2)
    const one = activeAnchored(items, [obj("a", 100, 160)])
    expect(one).toHaveLength(1)
    expect(one[0]?.item.room.outline.every((p) => p.x <= 200)).toBe(true)
    expect(activeAnchored(items, [obj("b", 300, 160), obj("a", 100, 160)]).map((a) => a.object.id)).toEqual(["b", "a"])
  })

  it("CP-6: помещение исчезло — объект спит; вернулось — снова действует с теми же данными", () => {
    const list = [obj("a", 200, 160)]
    const open = rectWalls("k", 0, 0, 420, 320).slice(0, 3)
    expect(activeAnchored(roomItems(open), list)).toEqual([])
    const back = activeAnchored(roomItems(), list)
    expect(back[0]?.object).toBe(list[0])
  })

  it("CP-7: малое помещение (меньше 1 м²) не принимает объект", () => {
    expect(activeAnchored(roomItems(rectWalls("s", 0, 0, 110, 110)), [obj("a", 55, 55)])).toEqual([])
  })

  it("CP-8: вход не мутируется", () => {
    const items = deepFreeze(roomItems())
    const list = deepFreeze([obj("a", 100, 100), obj("b", 300, 200)])
    expect(() => activeAnchored(items, list)).not.toThrow()
  })
})

describe("canAnchor", () => {
  it("CP-9: помещение без действующего объекта — это помещение; с действующим — null", () => {
    const items = roomItems([...rectWalls("k", 0, 0, 420, 320), partition])
    const list = [obj("a", 100, 160)]
    expect(canAnchor(items, list, { x: 120, y: 100 })).toBeNull()
    const right = canAnchor(items, list, { x: 300, y: 100 })
    expect(right?.room.outline.every((p) => p.x >= 200)).toBe(true)
  })

  it("CP-10: точка вне помещений — null; спящий объект помещение не занимает", () => {
    const items = roomItems()
    expect(canAnchor(items, [], { x: 600, y: 100 })).toBeNull()
    expect(canAnchor(items, [obj("sleeping", 600, 160)], { x: 100, y: 100 })).toBe(items[0])
  })
})
