import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElementTool } from "./doorway-tool"
import { sceneF } from "./doorway.test-utils"
import { win } from "./window.test-utils"
import { fakeHost } from "./selection-editing.test-utils"

// change add-door: инструмент «Дверь» через адаптер createElementTool (spec door «Инструмент «Дверь» и параметры
// новых дверей»; design D5). Призрак, установка, поворот и поля выделенной двери проверяются в
// selection-editing.test.ts и door-direction.test.ts (change popups-buttons-only): кнопка «Повернуть» и поля
// панели сняты. Хост — заглушка; единица — см.

beforeEach(() => {
  vi.stubGlobal("document", { activeElement: null })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("призрак и установка", () => {
  it("DT-03: клик по окну в инструменте «Дверь» выделяет окно, новая дверь не ставится", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 250)
    const host = fakeHost(walls, [x])
    const tool = createElementTool("door", host)
    tool.hover({ x: 300, y: 0 })
    expect(tool.ghost()).toBeNull()
    expect(tool.pressDoorway({ x: 300, y: 0 })).toBe(true)
    expect(host.state.selected).toEqual([x])
    tool.endDrag()
    tool.place({ x: 300, y: 0 })
    expect(host.state.added).toEqual([])
  })
})
