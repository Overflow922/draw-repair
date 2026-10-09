import { describe, expect, it } from "vitest"
import type { WallDoor, WallElement, WallWindow } from "../types"
import { createElementTool, createSelectionEditing } from "./doorway-tool"
import type { ElementKind } from "./element-kind"
import { groupButtonActive, groupButtonClick } from "./openings-group"
import type { GroupState } from "./openings-group"
import { afterPlace } from "../tool-mode"
import { door as doorwayOf, sceneF } from "./doorway.test-utils"
import { DR } from "./door.test-utils"
import { byId, fakeHost } from "./selection-editing.test-utils"

// change deselect-tool-on-element-select, пересмотрено в change select-only-without-tool (test-change-request):
// выделение существующего элемента кликом при инструменте установки больше не выводит из установки — при
// инструменте элементы не выделяются вовсе; инструмент установки снимает сама установка (чистое правило
// afterPlace, тесты TM-PLACE-* в tool-mode.test.ts). Здесь остались проверки ElementTool без инструмента
// (выделение, зоны направления, сброс призрака — design D3 прежнего change). Раскладка pointerdown в main.ts
// здесь не проверяется (test-plan «Out of Scope»).

const win: WallWindow = { kind: "window", id: "x0", wallId: "W", anchor: "a", offsetCm: 300, widthCm: 120, heightCm: 150, sillCm: 85 }

describe("группа после установки элемента", () => {
  it("DS-5: группа результата — кнопка не активна, клик возвращает текущий инструмент и открывает панель; вход не мутируется", () => {
    const group: GroupState = { current: "door", active: "door", panelOpen: true }
    const copy = { ...group }
    const r = afterPlace("door", group)
    expect(group).toEqual(copy)
    expect(groupButtonActive(r.group)).toBe(false)
    expect(groupButtonClick(r.group)).toEqual({ current: "door", active: "door", panelOpen: true })
  })
})

describe("выделение элемента без инструмента: правка направления двери", () => {
  const setup = (): { host: ReturnType<typeof fakeHost>; tool: ReturnType<typeof createElementTool>; editing: ReturnType<typeof createSelectionEditing> } => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [DR("a", "left"), win])
    return { host, tool: createElementTool("door", host), editing: createSelectionEditing(host) }
  }

  it("DS-6: нажатие по двери выделяет её, клик в зону b/right меняет направление одной записью, дверь остаётся выделенной", () => {
    const { host, tool, editing } = setup()
    expect(tool.pressDoorway({ x: 145, y: 0 })).toBe(true)
    expect(host.state.selected.map((e) => e.id)).toEqual(["dr0"])
    tool.endDrag()
    expect(host.state.records).toBe(0)
    expect(editing.pressZone({ x: 170, y: 40 })).toBe(true)
    const d = byId(host.state.elements, "dr0") as WallDoor
    expect([d.hinge, d.swing]).toEqual(["b", "right"])
    expect(host.state.selected).toEqual([d])
    expect(host.state.records).toBe(1)
    expect(host.state.inherited).toEqual([d])
  })

  it("DS-6b: клик в зону текущего направления ничего не меняет и записи не создаёт", () => {
    const { host, tool, editing } = setup()
    tool.pressDoorway({ x: 145, y: 0 })
    tool.endDrag()
    expect(editing.pressZone({ x: 120, y: -60 })).toBe(true)
    const d = byId(host.state.elements, "dr0") as WallDoor
    expect([d.hinge, d.swing]).toEqual(["a", "left"])
    expect(host.state.records).toBe(0)
  })

  it("DS-6c: клик вне зон при выделенной двери зону не поглощает и направление не меняет", () => {
    const { host, tool, editing } = setup()
    tool.pressDoorway({ x: 145, y: 0 })
    tool.endDrag()
    expect(editing.pressZone({ x: 170, y: 120 })).toBe(false)
    const d = byId(host.state.elements, "dr0") as WallDoor
    expect([d.hinge, d.swing]).toEqual(["a", "left"])
    expect(host.state.records).toBe(0)
  })

  it("DS-6d: окно выделяется без инструмента, зоны направления у окна нет", () => {
    const { host, tool, editing } = setup()
    expect(tool.pressDoorway({ x: 360, y: 0 })).toBe(true)
    tool.endDrag()
    expect(host.state.selected.map((e) => e.id)).toEqual(["x0"])
    expect(editing.pressZone({ x: 170, y: 40 })).toBe(false)
    expect(host.state.records).toBe(0)
  })
})

describe("установка по пустому месту", () => {
  it("DS-7: клик по свободному месту стены ставит элемент и выделяет его; существующие не затронуты", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [DR("a", "left")])
    const tool = createElementTool("door", host)
    tool.place({ x: 350, y: -8 })
    expect(host.state.added).toHaveLength(1)
    expect(host.state.records).toBe(1)
    expect(host.state.selected).toEqual(host.state.added)
    expect(byId(host.state.elements, "dr0")).toEqual(DR("a", "left"))
  })
})

describe("сброс призрака при выходе из установки", () => {
  const KINDS: ElementKind[] = ["doorway", "door", "window"]

  it("DS-3b: clearGhost убирает призрак каждого инструмента установки", () => {
    for (const kind of KINDS) {
      const { walls } = sceneF()
      const host = fakeHost(walls, [])
      const tool = createElementTool(kind, host)
      tool.hover({ x: 300, y: 0 })
      expect(tool.ghost(), kind).not.toBeNull()
      tool.clearGhost()
      expect(tool.ghost(), kind).toBeNull()
    }
  })

  it("DS-8: перетаскивание, начатое нажатием по элементу, переживает clearGhost и пишет одну запись", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [DR("a", "left")])
    const tool = createElementTool("door", host)
    tool.hover({ x: 300, y: 0 })
    expect(tool.pressDoorway({ x: 145, y: 0 })).toBe(true)
    tool.clearGhost()
    expect(tool.ghost()).toBeNull()
    expect(tool.dragging()).toBe(true)
    tool.dragTo({ x: 165, y: 0 })
    tool.endDrag()
    const moved = byId(host.state.elements, "dr0") as WallDoor
    expect(moved.offsetCm).toBe(120)
    expect(host.state.records).toBe(1)
    expect(host.state.selected).toEqual([moved])
  })

  it("DS-8b: без сдвига перетаскивание записи в историю не создаёт", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [DR("a", "left")])
    const tool = createElementTool("door", host)
    tool.pressDoorway({ x: 145, y: 0 })
    tool.clearGhost()
    tool.endDrag()
    expect(host.state.records).toBe(0)
    expect(byId(host.state.elements, "dr0")).toEqual(DR("a", "left"))
  })

  it("DS-8c: reset по-прежнему сбрасывает и призрак, и перетаскивание (используется при смене инструмента)", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [DR("a", "left")])
    const tool = createElementTool("door", host)
    tool.hover({ x: 300, y: 0 })
    tool.pressDoorway({ x: 145, y: 0 })
    tool.reset()
    expect(tool.ghost()).toBeNull()
    expect(tool.dragging()).toBe(false)
  })

  it("DS-9: clearGhost не вызывает inherit, не пишет историю и не меняет выделение и элементы", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [DR("a", "left"), doorwayOf("W", "a", 10)] as WallElement[])
    const tool = createElementTool("door", host)
    tool.hover({ x: 300, y: 0 })
    tool.pressDoorway({ x: 145, y: 0 })
    const selected = [...host.state.selected]
    const elements = [...host.state.elements]
    tool.clearGhost()
    tool.endDrag()
    expect(host.state.inherited).toEqual([])
    expect(host.state.records).toBe(0)
    expect(host.state.selected).toEqual(selected)
    expect(host.state.elements).toEqual(elements)
  })
})
