import { describe, expect, it } from "vitest"
import { rect, W } from "../room-area.test-utils"
import type { FurnitureItem, Wall } from "../types"
import { defaultParams } from "./item-params"
import { createItemTool } from "./item-tool"
import type { ItemToolHost } from "./item-tool"

// change furniture-center-snap: прилипание центра при постановке и перетаскивании (spec furniture-plan «Постановка стола»,
// «Выделение, перемещение и правка столов», «Центровка предметов», «Риска центровки мебели»)

const chair = (id: string, x: number, y: number): FurnitureItem => ({ id, kind: "chair", x, y, widthCm: 45, lengthCm: 45, angleDeg: 0 })
const room = (): Wall[] => rect(-10, -10, 410, 310) // внутренний контур [0, 400] x [0, 300]
const twoRooms = (): Wall[] => [...rect(-10, 0, 810, 310), W(310, 0, 310, 310)] // помещения x 0..300 и 320..800

function setup(initial: FurnitureItem[], walls: Wall[] = [], pxPerCm = 2) {
  const state = { items: initial, history: [] as FurnitureItem[][], nextId: 0 }
  const host: ItemToolHost = {
    items: () => state.items,
    setItems: (next) => {
      state.items = next
    },
    kind: () => "chair",
    params: () => defaultParams("chair"),
    record: (before) => {
      state.history.push(before.map((t) => ({ ...t })))
    },
    changed: () => undefined,
    redraw: () => undefined,
    selected: () => undefined,
    newId: () => `n${++state.nextId}`,
    walls: () => walls,
    pxPerCm: () => pxPerCm,
  }
  return { state, tool: createItemTool(host) }
}

const centerOf = (items: readonly FurnitureItem[], id: string): { x: number; y: number } | undefined => {
  const t = items.find((i) => i.id === id)
  return t && { x: t.x, y: t.y }
}

describe("постановка с притяжением", () => {
  it("FCS-100: клик рядом с центром другого стула ставит напротив него", () => {
    const { state, tool } = setup([chair("a", 100, 50)])
    tool.place({ x: 103, y: 250 })
    expect(centerOf(state.items, "n1")).toEqual({ x: 100, y: 250 })
  })

  it("FCS-101: призрак стоит там, где встанет предмет", () => {
    const { tool } = setup([chair("a", 100, 50)])
    tool.hover({ x: 103, y: 250 })
    expect(tool.ghost()).toMatchObject({ x: 100, y: 250 })
  })

  it("FCS-102: по центру стороны своего помещения", () => {
    const { state, tool } = setup([], room())
    tool.place({ x: 193, y: 80 })
    expect(centerOf(state.items, "n1")).toEqual({ x: 200, y: 80 })
  })

  it("FCS-104: середина длинной стены другого помещения не тянет", () => {
    const { state, tool } = setup([], twoRooms())
    tool.place({ x: 156, y: 100 })
    expect(centerOf(state.items, "n1")).toEqual({ x: 150, y: 100 })
  })

  it("FCS-105: вне помещения линий стен нет", () => {
    const { state, tool } = setup([], room())
    tool.place({ x: 493, y: 80 })
    expect(centerOf(state.items, "n1")).toEqual({ x: 493, y: 80 })
  })

  it("FCS-103: вне радиуса предмет стоит в точке клика", () => {
    const { state, tool } = setup([chair("a", 100, 50)])
    tool.place({ x: 130, y: 250 })
    expect(centerOf(state.items, "n1")).toEqual({ x: 130, y: 250 })
  })
})

describe("радиус центровки мебели 17,5 px", () => {
  it("FCS-106: масштаб 1 (2 px/см): 8 см прилипает, 10 см нет", () => {
    const near = setup([chair("a", 100, 50)])
    near.tool.place({ x: 108, y: 250 })
    expect(centerOf(near.state.items, "n1")).toEqual({ x: 100, y: 250 })
    const far = setup([chair("a", 100, 50)])
    far.tool.place({ x: 110, y: 250 })
    expect(centerOf(far.state.items, "n1")).toEqual({ x: 110, y: 250 })
  })

  it("FCS-107: масштаб 0,25 (0,5 px/см): радиус 35 см, 30 см прилипает", () => {
    const { state, tool } = setup([chair("a", 100, 50)], [], 0.5)
    tool.place({ x: 130, y: 250 })
    expect(centerOf(state.items, "n1")).toEqual({ x: 100, y: 250 })
  })
})

describe("перетаскивание с притяжением", () => {
  it("FCS-110: захваченный предмет липнет к линии, один шаг истории", () => {
    const { state, tool } = setup([chair("a", 100, 50), chair("b", 100, 250)])
    expect(tool.press({ x: 100, y: 250 })).toBe(true)
    tool.dragTo({ x: 104, y: 252 })
    tool.endDrag()
    expect(centerOf(state.items, "b")).toEqual({ x: 100, y: 252 })
    expect(state.history).toHaveLength(1)
  })

  it("FCS-111: остальные выделенные едут на тот же вектор и линий не создают", () => {
    const { state, tool } = setup([chair("a", 100, 250), chair("b", 160, 250), chair("c", 100, 50)])
    tool.select(["a", "b"])
    tool.press({ x: 100, y: 250 })
    tool.dragTo({ x: 163, y: 300 })
    expect(centerOf(state.items, "a")).toEqual({ x: 163, y: 300 })
    expect(centerOf(state.items, "b")).toEqual({ x: 223, y: 300 })
  })

  it("FCS-112: единственный предмет сам к себе не липнет", () => {
    const { state, tool } = setup([chair("a", 100, 250)])
    tool.press({ x: 100, y: 250 })
    tool.dragTo({ x: 103, y: 252 })
    expect(centerOf(state.items, "a")).toEqual({ x: 103, y: 252 })
  })

  it("FCS-113: стрелки не прилипают", () => {
    const { state, tool } = setup([chair("a", 200, 100), chair("b", 212, 400)])
    tool.select(["a"])
    tool.nudge("right", false)
    expect(centerOf(state.items, "a")).toEqual({ x: 210, y: 100 })
  })
})

describe("риски", () => {
  it("FCS-120: у призрака риска по линии, без прилипания её нет", () => {
    const { tool } = setup([chair("a", 100, 50)])
    tool.hover({ x: 103, y: 250 })
    expect(tool.guides()).toHaveLength(1)
    tool.hover({ x: 160, y: 250 })
    expect(tool.guides()).toEqual([])
  })

  it("FCS-121: при перетаскивании риска есть, после жеста нет", () => {
    const { tool } = setup([chair("a", 100, 50), chair("b", 100, 250)])
    tool.press({ x: 100, y: 250 })
    tool.dragTo({ x: 104, y: 252 })
    expect(tool.guides()).toHaveLength(1)
    tool.endDrag()
    expect(tool.guides()).toEqual([])
  })
})
