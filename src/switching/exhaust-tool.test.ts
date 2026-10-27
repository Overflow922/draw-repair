import { describe, expect, it } from "vitest"
import type { Shape } from "../communications/shape"
import type { ExhaustFan, ExhaustState, LightLine, View } from "../types"
import { createExhaustTool } from "./exhaust-tool"

// change add-exhaust-fan: инструмент «Вытяжка» — постановка, выделение, перетаскивание, удаление с меткой, ластик
// (spec exhaust-fan «Инструмент «Вытяжка»», «Выделение, перемещение и удаление вытяжки»)

const VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } }
// тело стены: полоса y от 200 до 220
const WALL: Shape = { kind: "poly", pts: [{ x: 0, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 220 }, { x: 0, y: 220 }] }
const fan = (id: string, x: number, y: number): ExhaustFan => ({ id, x, y })
const mark: LightLine = { id: "m1", targetId: "f1", name: "LV1" }

function setup(initial: ExhaustState = { exhausts: [], lines: [] }, lineNumber = 1) {
  let state = initial
  let n = 0
  const log = { records: 0, changes: 0 }
  const tool = createExhaustTool({
    bodies: () => [WALL],
    state: () => state,
    setState: (next) => {
      state = next
    },
    record: () => {
      log.records++
    },
    changed: () => {
      log.changes++
    },
    redraw: () => {},
    newId: () => "id" + String(++n),
    lineNumber: () => lineNumber,
    view: () => VIEW,
  })
  return { tool, log, state: () => state }
}

describe("постановка", () => {
  it("центр округляется, один шаг истории", () => {
    const s = setup()
    expect(s.tool.place({ x: 100.4, y: 79.6 })).toBe(true)
    expect(s.state().exhausts).toEqual([fan("id1", 100, 80)])
    expect(s.log).toEqual({ records: 1, changes: 1 })
  })
  // change line-dropdown (spec light-lines «Линия при постановке»): вытяжка сразу получает метку L<n> текущей линии, как светильник
  it("вытяжка ставится с меткой L1 в том же шаге истории", () => {
    const s = setup()
    s.tool.place({ x: 100, y: 80 })
    expect(s.state().lines).toEqual([{ id: "id2", targetId: "id1", name: "L1" }])
    expect(s.log.records).toBe(1)
  })
  it("номер метки — текущая линия: 3 → L3", () => {
    const s = setup({ exhausts: [], lines: [] }, 3)
    s.tool.place({ x: 100, y: 80 })
    expect(s.state().lines.map((l) => l.name)).toEqual(["L3"])
  })
  it("отказ в постановке метку не добавляет", () => {
    const s = setup()
    s.tool.place({ x: 100, y: 210 })
    expect(s.state().lines).toEqual([])
  })
  it("серия постановок — по шагу на каждую, вытяжка не выделяется", () => {
    const s = setup()
    s.tool.place({ x: 10, y: 10 })
    s.tool.place({ x: 50, y: 10 })
    s.tool.place({ x: 90, y: 10 })
    expect(s.state().exhausts).toHaveLength(3)
    expect(s.log.records).toBe(3)
    expect(s.tool.selectedId()).toBeNull()
  })
  it("в теле стены вытяжка не ставится и призрака нет", () => {
    const s = setup()
    expect(s.tool.ghost({ x: 100, y: 210 })).toBeNull()
    expect(s.tool.place({ x: 100, y: 210 })).toBe(false)
    expect(s.state().exhausts).toEqual([])
    expect(s.log.records).toBe(0)
  })
  it("призрак — в округлённой точке", () => {
    expect(setup().tool.ghost({ x: 100.4, y: 79.6 })).toMatchObject({ x: 100, y: 80 })
  })
  it("ставится поверх другой вытяжки в той же точке (они постановке не мешают)", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [] })
    expect(s.tool.place({ x: 100, y: 80 })).toBe(true)
    expect(s.state().exhausts).toHaveLength(2)
  })
})

describe("выделение", () => {
  it("клик по знаку выделяет, клик по пустому месту снимает", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [] })
    expect(s.tool.press({ x: 103, y: 80 })?.id).toBe("f1")
    expect(s.tool.selectedId()).toBe("f1")
    expect(s.tool.press({ x: 300, y: 80 })).toBeNull()
    expect(s.tool.selectedId()).toBeNull()
  })
  it("зона клика не меньше 8 px", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [] })
    expect(s.tool.hitAt({ x: 100 + 7 / 2, y: 80 })).not.toBeNull()
    expect(s.tool.hitAt({ x: 100 + 9 / 2, y: 80 })).toBeNull()
  })
  it("побеждает позже поставленная", () => {
    const s = setup({ exhausts: [fan("a", 100, 80), fan("b", 101, 80)], lines: [] })
    expect(s.tool.hitAt({ x: 100, y: 80 })?.id).toBe("b")
  })
})

describe("перетаскивание", () => {
  it("перенос — один шаг; метка остаётся привязанной к той же вытяжке", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [mark] })
    expect(s.tool.beginDrag({ x: 100, y: 80 })).toBe(true)
    s.tool.dragTo({ x: 150, y: 80 })
    expect(s.tool.displayed()[0]).toMatchObject({ id: "f1", x: 150, y: 80 })
    expect(s.tool.endDrag()).toBe(true)
    expect(s.state().exhausts).toEqual([fan("f1", 150, 80)])
    expect(s.state().lines).toEqual([mark])
    expect(s.log.records).toBe(1)
  })
  it("отпускание над телом стены — на прежнем месте, шага нет", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [] })
    s.tool.beginDrag({ x: 100, y: 80 })
    s.tool.dragTo({ x: 100, y: 210 })
    expect(s.tool.endDrag()).toBe(false)
    expect(s.state().exhausts).toEqual([fan("f1", 100, 80)])
    expect(s.log.records).toBe(0)
  })
  it("отпускание без сдвига шага не создаёт", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [] })
    s.tool.beginDrag({ x: 100, y: 80 })
    expect(s.tool.endDrag()).toBe(false)
    expect(s.log.records).toBe(0)
  })
  it("пустое место не перетаскивается", () => {
    expect(setup().tool.beginDrag({ x: 1, y: 1 })).toBe(false)
  })
})

describe("удаление", () => {
  it("Delete удаляет выделенную вытяжку вместе с меткой одним шагом", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [mark] })
    s.tool.press({ x: 100, y: 80 })
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.state()).toEqual({ exhausts: [], lines: [] })
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })
  it("Delete без выделения ничего не делает", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [] })
    expect(s.tool.deleteSelected()).toBe(false)
    expect(s.log.records).toBe(0)
  })
  it("ластик удаляет вытяжку с меткой одним шагом, пустое место — нет", () => {
    const s = setup({ exhausts: [fan("f1", 100, 80)], lines: [mark] })
    expect(s.tool.eraseTarget({ x: 100, y: 80 })).toBe("f1")
    expect(s.tool.erase({ x: 400, y: 80 })).toBe(false)
    expect(s.tool.erase({ x: 100, y: 80 })).toBe(true)
    expect(s.state()).toEqual({ exhausts: [], lines: [] })
    expect(s.log.records).toBe(1)
  })
})
