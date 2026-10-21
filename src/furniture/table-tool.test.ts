import { describe, expect, it } from "vitest"
import type { Table } from "../types"
import { createTableTool } from "./table-tool"
import type { TableToolHost } from "./table-tool"
import { TABLE_DEFAULTS } from "./table-params"
import type { TableParams } from "./table-params"

// change furniture-plan-table: жесты инструмента «Стол» (spec furniture-plan «Постановка стола», «Выделение, перемещение и правка столов»)

const table = (id: string, x: number, y: number): Table => ({ id, x, y, widthCm: 80, lengthCm: 160, angleDeg: 0 })

function setup(initial: Table[] = [], params: TableParams = TABLE_DEFAULTS) {
  const state = { tables: initial, history: [] as Table[][], selectedCalls: 0, changed: 0, nextId: 0 }
  const host: TableToolHost = {
    tables: () => state.tables,
    setTables: (next) => {
      state.tables = next
    },
    params: () => params,
    record: (before) => {
      state.history.push(before.map((t) => ({ ...t })))
    },
    changed: () => {
      state.changed++
    },
    redraw: () => undefined,
    selected: () => {
      state.selectedCalls++
    },
    newId: () => `t${++state.nextId}`,
  }
  return { state, tool: createTableTool(host) }
}

describe("постановка", () => {
  it("FP-340: клик ставит стол с центром в точке и значениями панели, выделяет его, один шаг истории", () => {
    const { state, tool } = setup([], { widthCm: 100, lengthCm: 200, angleDeg: 45 })
    tool.place({ x: 300, y: 200 })
    expect(state.tables).toEqual([{ id: "t1", x: 300, y: 200, widthCm: 100, lengthCm: 200, angleDeg: 45 }])
    expect([...tool.selectedIds()]).toEqual(["t1"])
    expect(state.history).toEqual([[]])
    expect(state.selectedCalls).toBe(1)
  })

  it("FP-341: стол ставится и на занятое место: поверх старого, старый не выделен", () => {
    const { state, tool } = setup([table("a", 300, 200)])
    tool.place({ x: 300, y: 200 })
    expect(state.tables.map((t) => t.id)).toEqual(["a", "t1"])
    expect([...tool.selectedIds()]).toEqual(["t1"])
  })

  it("FP-342: призрак — стол со значениями панели под указателем; без указателя его нет", () => {
    const { tool } = setup([], { widthCm: 90, lengthCm: 120, angleDeg: 30 })
    expect(tool.ghost()).toBeNull()
    tool.hover({ x: 10, y: 20 })
    expect(tool.ghost()).toEqual({ id: "", x: 10, y: 20, widthCm: 90, lengthCm: 120, angleDeg: 30 })
    tool.hover(null)
    expect(tool.ghost()).toBeNull()
  })
})

describe("выделение и перетаскивание", () => {
  it("FP-343: нажатие по телу выделяет стол; мимо — нет", () => {
    const { state, tool } = setup([table("a", 200, 100)])
    expect(tool.press({ x: 500, y: 500 })).toBe(false)
    expect(tool.hasSelection()).toBe(false)
    expect(tool.press({ x: 200, y: 100 })).toBe(true)
    expect(tool.selectedTable()?.id).toBe("a")
    expect(state.selectedCalls).toBe(1)
  })

  it("FP-344: перетаскивание свободное, одним шагом истории с позицией до жеста", () => {
    const { state, tool } = setup([table("a", 200, 100)])
    tool.press({ x: 200, y: 100 })
    tool.dragTo({ x: 260, y: 130 })
    tool.dragTo({ x: 350, y: 100 })
    expect(state.tables[0]).toMatchObject({ x: 350, y: 100 })
    expect(state.history).toEqual([])
    tool.endDrag()
    expect(state.history).toEqual([[table("a", 200, 100)]])
    expect(tool.dragging()).toBe(false)
  })

  it("FP-345: перетаскивание, не сдвинувшее стол (или вернувшее на место), шага истории не создаёт", () => {
    const { state, tool } = setup([table("a", 200, 100)])
    tool.press({ x: 200, y: 100 })
    tool.dragTo({ x: 250, y: 100 })
    tool.dragTo({ x: 200, y: 100 })
    tool.endDrag()
    expect(state.history).toEqual([])
    expect(state.tables[0]).toMatchObject({ x: 200, y: 100 })
  })

  it("FP-346: вместе с нажатым двигаются все выделенные столы; нажатие по невыделенному заменяет выделение", () => {
    const { state, tool } = setup([table("a", 200, 100), table("b", 600, 100)])
    tool.select(["a", "b"])
    tool.press({ x: 200, y: 100 })
    tool.dragTo({ x: 210, y: 110 })
    tool.endDrag()
    expect(state.tables.map((t) => [t.x, t.y])).toEqual([[210, 110], [610, 110]])
    tool.press({ x: 610, y: 110 })
    expect([...tool.selectedIds()]).toEqual(["a", "b"])
    tool.endDrag()
    tool.clearSelection()
    tool.press({ x: 610, y: 110 })
    expect([...tool.selectedIds()]).toEqual(["b"])
  })

  it("FP-347: при наложении столов нажатие берёт поставленный позже", () => {
    const { tool } = setup([table("a", 200, 100), table("b", 200, 100)])
    tool.press({ x: 200, y: 100 })
    expect([...tool.selectedIds()]).toEqual(["b"])
  })
})

describe("стрелки", () => {
  it("FP-348: стрелка сдвигает на 10 см, Shift — на 1 см; серия — одна запись", () => {
    const { state, tool } = setup([table("a", 200, 100)])
    tool.select(["a"])
    for (let i = 0; i < 5; i++) expect(tool.nudge("right", false)).toBe(true)
    expect(state.tables[0]).toMatchObject({ x: 250 })
    expect(state.history).toHaveLength(1)
    expect(state.history[0]?.[0]).toMatchObject({ x: 200 })
    expect(tool.nudge("down", true)).toBe(true)
    expect(state.tables[0]).toMatchObject({ x: 250, y: 101 })
  })

  it("FP-349: endBurst открывает новую запись; без выделения стрелки ничего не меняют", () => {
    const { state, tool } = setup([table("a", 200, 100)])
    expect(tool.nudge("left", false)).toBe(false)
    expect(state.history).toEqual([])
    tool.select(["a"])
    tool.nudge("left", false)
    tool.endBurst()
    tool.nudge("left", false)
    expect(state.history).toHaveLength(2)
  })
})

describe("правка, удаление, ластик", () => {
  it("FP-350: replaceSelected — один шаг истории, стол заменён", () => {
    const { state, tool } = setup([table("a", 200, 100)])
    tool.select(["a"])
    tool.replaceSelected({ ...table("a", 200, 100), widthCm: 90 })
    expect(state.tables[0]?.widthCm).toBe(90)
    expect(state.history).toEqual([[table("a", 200, 100)]])
  })

  it("FP-351: Delete удаляет выделенные столы одним шагом и снимает выделение", () => {
    const { state, tool } = setup([table("a", 200, 100), table("b", 600, 100)])
    tool.select(["a"])
    expect(tool.deleteSelected()).toBe(true)
    expect(state.tables.map((t) => t.id)).toEqual(["b"])
    expect(state.history).toHaveLength(1)
    expect(tool.hasSelection()).toBe(false)
    expect(tool.deleteSelected()).toBe(false)
  })

  it("FP-352: ластик стирает стол под точкой одним шагом; мимо — ничего, шага нет", () => {
    const { state, tool } = setup([table("a", 200, 100)])
    expect(tool.erase({ x: 900, y: 900 })).toBe(false)
    expect(state.history).toEqual([])
    expect(tool.eraseTarget({ x: 200, y: 100 })?.id).toBe("a")
    expect(tool.erase({ x: 200, y: 100 })).toBe(true)
    expect(state.tables).toEqual([])
    expect(state.history).toHaveLength(1)
  })

  it("FP-353: reset снимает выделение, призрак и жест", () => {
    const { tool } = setup([table("a", 200, 100)])
    tool.press({ x: 200, y: 100 })
    tool.hover({ x: 1, y: 1 })
    tool.reset()
    expect(tool.hasSelection()).toBe(false)
    expect(tool.ghost()).toBeNull()
    expect(tool.dragging()).toBe(false)
  })
})
