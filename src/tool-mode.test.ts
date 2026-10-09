import { describe, expect, it } from "vitest"
import type { GroupState, Tool } from "./doorway/openings-group"
import { afterPlace, escapeAction, selectionAllowed } from "./tool-mode"
import type { EscapeAction, EscapeState } from "./tool-mode"

// change select-only-without-tool: выделять и править существующие объекты можно только без инструмента;
// Esc снимает любой активный инструмент; инструменты установки после установки элемента деактивируются
// (spec canvas-app «Выделение и правка только без инструмента», «Esc снимает активный инструмент»,
// «Панель группы «Проёмы»»; doorway «Установка проёма»; design D1, D2, D5, D8; test-plan TM-*).
// Форма состояния Esc зафиксирована этими тестами: { tool, gestureActive, dimensionDraft, hasSelection }.

const PLACING = ["doorway", "door", "window"] as const
const ACTIVE_TOOLS = ["wall", "dimension", "doorway", "door", "window", "eraser", "ruler"] as const satisfies readonly Tool[]

const idle = (tool: Tool): EscapeState => ({ tool, gestureActive: false, dimensionDraft: false, hasSelection: false })

const groups = (active: GroupState["active"]): GroupState[] =>
  (["doorway", "door"] as const).flatMap((current) => [true, false].map((panelOpen) => ({ current, active, panelOpen })))

// применяет результат Esc к состоянию так, как это делает main.ts (для проверки последовательностей Esc)
function applyEscape(s: EscapeState, action: EscapeAction): EscapeState {
  switch (action) {
    case "end-gesture":
      return { ...s, gestureActive: false }
    case "cancel-dimension-draft":
      return { ...s, dimensionDraft: false }
    case "clear-selection":
      return { ...s, hasSelection: false }
    case "deactivate-tool":
      return { ...s, tool: "none" }
    case "none":
      return s
  }
}

describe("выделение допустимо только без инструмента", () => {
  // каждый инструмент проверяется отдельным тестом, чтобы мутант «список исключений» не прошёл общим every
  it.each(ACTIVE_TOOLS)("TM-SEL-1: при инструменте «%s» выделение недопустимо", (tool) => {
    expect(selectionAllowed(tool)).toBe(false)
  })

  it("TM-SEL-2: без инструмента выделение допустимо", () => {
    expect(selectionAllowed("none")).toBe(true)
  })

  it("TM-SEL-3: инвариант — допустимо ровно для состояния «Без инструмента»", () => {
    const all: Tool[] = [...ACTIVE_TOOLS, "none"]
    expect(all.filter(selectionAllowed)).toEqual(["none"])
  })
})

describe("Esc снимает активный инструмент", () => {
  it.each(ACTIVE_TOOLS)("TM-ESC-1: при инструменте «%s» без незавершённых действий Esc снимает инструмент", (tool) => {
    expect(escapeAction(idle(tool))).toBe("deactivate-tool")
  })

  it("TM-ESC-2: в «Стена» с незавершённым жестом первый Esc отменяет жест, второй снимает инструмент", () => {
    const s0: EscapeState = { ...idle("wall"), gestureActive: true }
    const a1 = escapeAction(s0)
    expect(a1).toBe("end-gesture")
    const s1 = applyEscape(s0, a1)
    expect(s1.tool).toBe("wall")
    expect(escapeAction(s1)).toBe("deactivate-tool")
  })

  it("TM-ESC-2b: в «Размер» с начатым размещением первый Esc сбрасывает черновик, второй снимает инструмент", () => {
    const s0: EscapeState = { ...idle("dimension"), dimensionDraft: true }
    const a1 = escapeAction(s0)
    expect(a1).toBe("cancel-dimension-draft")
    const s1 = applyEscape(s0, a1)
    expect(s1.tool).toBe("dimension")
    expect(escapeAction(s1)).toBe("deactivate-tool")
  })

  it("TM-ESC-2c: если идут и жест, и черновик, жест отменяется первым", () => {
    expect(escapeAction({ ...idle("wall"), gestureActive: true, dimensionDraft: true })).toBe("end-gesture")
  })

  it("TM-ESC-3: после снятия инструмента выделение допустимо", () => {
    const s = applyEscape(idle("wall"), escapeAction(idle("wall")))
    expect(selectionAllowed(s.tool)).toBe(true)
  })

  it("TM-ESC-4: без инструмента Esc снимает выделение", () => {
    expect(escapeAction({ ...idle("none"), hasSelection: true })).toBe("clear-selection")
  })

  it("TM-ESC-4b: без инструмента и без выделения Esc ничего не делает", () => {
    expect(escapeAction(idle("none"))).toBe("none")
  })

  it("TM-ESC-5: инструмент группы «Проёмы» снимается Esc (группа обрабатывается вызывающим кодом)", () => {
    expect(escapeAction(idle("door"))).toBe("deactivate-tool")
    expect(escapeAction(idle("doorway"))).toBe("deactivate-tool")
  })

  it("TM-ESC-6: при активном инструменте выделение Esc не снимает — снимается инструмент, а не «clear-selection»", () => {
    for (const tool of ACTIVE_TOOLS) {
      expect(escapeAction({ ...idle(tool), hasSelection: true }), tool).toBe("deactivate-tool")
    }
  })

  it("TM-ESC-7: инвариант — из любого инструмента с одним незавершённым действием два Esc приводят к «Без инструмента»", () => {
    for (const tool of ACTIVE_TOOLS) {
      for (const pending of [{}, { gestureActive: true }, { dimensionDraft: true }] as const) {
        let s: EscapeState = { ...idle(tool), ...pending }
        s = applyEscape(s, escapeAction(s))
        s = applyEscape(s, escapeAction(s))
        expect(s.tool, `${tool} ${JSON.stringify(pending)}`).toBe("none")
      }
    }
  })

  it("TM-ESC-8: Esc не зависит от инструмента при отсутствии действий — одно и то же действие для всех семи инструментов", () => {
    expect(new Set(ACTIVE_TOOLS.map((t) => escapeAction(idle(t))))).toEqual(new Set(["deactivate-tool"]))
  })
})

describe("переход после установки элемента", () => {
  it.each(PLACING)("TM-PLACE-1: после установки инструментом «%s» нет инструмента, группа закрыта и не активна", (tool) => {
    const active: GroupState["active"] = tool === "window" ? "other" : tool
    for (const group of groups(active)) {
      const r = afterPlace(tool, group)
      const label = `${tool} current=${group.current} panel=${group.panelOpen}`
      expect(r.tool, label).toBe("none")
      expect(r.group.panelOpen, label).toBe(false)
      expect(r.group.active, label).toBe("other")
    }
  })

  it("TM-PLACE-2: текущий инструмент группы после установки сохраняется", () => {
    const door: GroupState = { current: "door", active: "door", panelOpen: true }
    expect(afterPlace("door", door).group.current).toBe("door")
    const doorway: GroupState = { current: "doorway", active: "doorway", panelOpen: true }
    expect(afterPlace("doorway", doorway).group.current).toBe("doorway")
    // окно ставится при чужом текущем инструменте группы — тот не меняется
    const other: GroupState = { current: "door", active: "other", panelOpen: false }
    expect(afterPlace("window", other).group.current).toBe("door")
  })

  it.each(["wall", "dimension", "eraser", "ruler", "none"] as const)(
    "TM-PLACE-3: установка при «%s» не меняет ни инструмент, ни группу",
    (tool) => {
      for (const group of [...groups("other"), ...groups("door")]) {
        const r = afterPlace(tool, group)
        expect(r.tool, tool).toBe(tool)
        expect(r.group, tool).toEqual(group)
      }
    },
  )

  it("TM-PLACE-4: повторное применение к результату ничего не меняет", () => {
    for (const tool of PLACING) {
      const group: GroupState = { current: "door", active: tool === "window" ? "other" : tool, panelOpen: true }
      const once = afterPlace(tool, group)
      expect(afterPlace(once.tool, once.group)).toEqual(once)
    }
  })
})
