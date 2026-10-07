import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Scene } from "../history"
import type { View, Wall, WallElement } from "../types"
import { createElementTool } from "./doorway-tool"
import type { ElementPanel, ElementToolHost } from "./doorway-tool"
import { jambsT } from "./doorway-faces"
import { D0, sceneF } from "./doorway.test-utils"
import { win } from "./window.test-utils"
import { DR, dr } from "./door.test-utils"

// change add-door: инструмент «Дверь» через адаптер createElementTool — призрак с направлением, установка,
// кнопка «Повернуть» с выделенной дверью и без неё, поля выделенной двери
// (spec door «Инструмент «Дверь»», «Поворот двери», «Панель выделенной двери»; design D5).
// Хост, поля и кнопка — заглушки; единица — см.

interface Fake {
  value: string
  fire(type: string): void
}

function fakeControl(): Fake & HTMLInputElement & HTMLButtonElement {
  const handlers = new Map<string, ((e: { key: string }) => void)[]>()
  const control = {
    value: "",
    addEventListener(type: string, fn: (e: { key: string }) => void): void {
      handlers.set(type, [...(handlers.get(type) ?? []), fn])
    },
    blur(): void {},
    fire(type: string): void {
      for (const fn of handlers.get(type) ?? []) fn({ key: "" })
    },
  }
  return control as unknown as Fake & HTMLInputElement & HTMLButtonElement
}

type FakePanel = ElementPanel & { width: Fake & HTMLInputElement; height: Fake & HTMLInputElement; rotate: Fake & HTMLButtonElement }

function fakePanel(): FakePanel {
  const root = { classList: { toggle(): void {} }, querySelectorAll: (): never[] => [] } as unknown as HTMLElement
  return { root, width: fakeControl(), height: fakeControl(), rotate: fakeControl() }
}

function plainPanel(): ElementPanel & { width: Fake & HTMLInputElement; height: Fake & HTMLInputElement } {
  const root = { classList: { toggle(): void {} }, querySelectorAll: (): never[] => [] } as unknown as HTMLElement
  return { root, width: fakeControl(), height: fakeControl() }
}

interface FakeHost extends ElementToolHost {
  state: { elements: WallElement[]; selected: WallElement[]; added: WallElement[]; records: number }
}

function fakeHost(walls: Wall[], elements: WallElement[], selected: WallElement[] = []): FakeHost {
  const state = { elements: [...elements], selected: [...selected], added: [] as WallElement[], records: 0 }
  const view: View = { zoom: 1, pan: { x: 0, y: 0 } }
  const snapshot = (): Scene => ({ walls, dimensions: [], doorways: [...state.elements] })
  return {
    state,
    walls: () => walls,
    elements: () => state.elements,
    selectedElements: () => state.selected,
    othersSelected: () => false,
    view: () => view,
    radiusCm: () => 3,
    formatCm: (cm: number) => String(cm),
    parseCm: (text: string) => (text.trim() === "" ? Number.NaN : Number(text)),
    unitLabel: () => "см",
    editorParent: {} as HTMLElement,
    snapshot,
    record: () => {
      state.records++
    },
    recordSnapshot: () => {
      state.records++
    },
    recordNudge: () => {
      state.records++
    },
    add: (e: WallElement) => {
      state.elements = [...state.elements, e]
      state.added.push(e)
    },
    replace: (prev: WallElement, next: WallElement) => {
      state.elements = state.elements.map((e) => (e === prev ? next : e))
      state.selected = state.selected.map((e) => (e === prev ? next : e))
    },
    select: (e: WallElement) => {
      state.selected = [e]
    },
    clearSelection: () => {
      state.selected = []
    },
    changed: () => {},
    redraw: () => {},
  }
}

const byId = (list: readonly WallElement[], id: string): WallElement => {
  const e = list.find((x) => x.id === id)
  if (!e) throw new Error(`нет элемента ${id}`)
  return e
}

beforeEach(() => {
  vi.stubGlobal("document", { activeElement: null })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("призрак и установка", () => {
  it("DT-01: призрак двери — 90 см, петли у a, открывание left; после «Повернуть» — петли у b", () => {
    const { walls, W } = sceneF()
    const host = fakeHost(walls, [])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    tool.hover({ x: 250, y: 0 })
    const g = tool.ghost()
    expect(g).toMatchObject({ kind: "door", widthCm: 90, heightCm: 210, hinge: "a", swing: "left" })
    if (g) expect(jambsT(g, W)).toEqual([205, 295])
    panel.rotate.fire("click")
    tool.hover({ x: 250, y: 0 })
    expect(tool.ghost()).toMatchObject({ kind: "door", hinge: "b", swing: "left" })
  })

  it("DT-02: клик ставит дверь с параметрами панели, выделяет её; одна запись истории", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    panel.width.value = "80"
    panel.width.fire("change")
    panel.height.value = "200"
    panel.height.fire("change")
    tool.place({ x: 250, y: 0 })
    expect(host.state.added).toHaveLength(1)
    expect(host.state.added[0]).toMatchObject({ kind: "door", wallId: "W", widthCm: 80, heightCm: 200, hinge: "a", swing: "left", offsetCm: 210 })
    expect(host.state.selected).toEqual([host.state.added[0]])
    expect(host.state.records).toBe(1)
  })

  it("DT-02b: неверная ширина не применяется — новые двери с прежней шириной", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    for (const bad of ["0", "-5", "abc"]) {
      panel.width.value = bad
      panel.width.fire("change")
    }
    tool.place({ x: 250, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", widthCm: 90 })
  })

  it("DT-03: клик по окну в инструменте «Дверь» выделяет окно, новая дверь не ставится", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 250)
    const host = fakeHost(walls, [x])
    const tool = createElementTool("door", host, fakePanel())
    tool.hover({ x: 300, y: 0 })
    expect(tool.ghost()).toBeNull()
    expect(tool.pressDoorway({ x: 300, y: 0 })).toBe(true)
    expect(host.state.selected).toEqual([x])
    tool.endDrag()
    tool.place({ x: 300, y: 0 })
    expect(host.state.added).toEqual([])
  })

  it("DT-04: поля двери не меняют параметры проёма", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    const doorPanel = fakePanel()
    const doorTool = createElementTool("door", host, doorPanel)
    const doorwayTool = createElementTool("doorway", host, plainPanel())
    doorPanel.width.value = "80"
    doorPanel.width.fire("change")
    doorwayTool.hover({ x: 250, y: 0 })
    expect(doorwayTool.ghost()?.widthCm).toBe(90)
    doorTool.hover({ x: 250, y: 0 })
    expect(doorTool.ghost()?.widthCm).toBe(80)
  })
})

describe("кнопка «Повернуть»", () => {
  it("DT-05: выделенная дверь поворачивается, одна запись за нажатие; положение и размеры прежние", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const host = fakeHost(walls, [d], [d])
    const panel = fakePanel()
    createElementTool("door", host, panel)
    panel.rotate.fire("click")
    expect(byId(host.state.elements, "dr0")).toEqual({ ...d, hinge: "b", swing: "left" })
    expect(host.state.records).toBe(1)
    panel.rotate.fire("click")
    expect(byId(host.state.elements, "dr0")).toEqual({ ...d, hinge: "b", swing: "right" })
    expect(host.state.records).toBe(2)
    expect(host.state.selected).toEqual([byId(host.state.elements, "dr0")])
  })

  it("DT-06: без выделения — меняется направление новых дверей, без записи, поставленные двери не меняются", () => {
    const { walls } = sceneF()
    const placed = dr("W", "a", 300, "a", "left", 90, 210, "p")
    const host = fakeHost(walls, [placed])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    panel.rotate.fire("click")
    expect(host.state.records).toBe(0)
    expect(host.state.elements).toEqual([placed])
    tool.place({ x: 100, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", hinge: "b", swing: "left" })
  })

  it("DT-07: поворот выделенной двери не меняет направление новых дверей", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const host = fakeHost(walls, [d], [d])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    panel.rotate.fire("click")
    host.state.selected = []
    tool.place({ x: 400, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", hinge: "a", swing: "left" })
  })

  it("DT-08: выделен проём — «Повернуть» не меняет его и не пишет историю, задаёт новые двери", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    panel.rotate.fire("click")
    expect(host.state.elements).toEqual([d])
    expect(host.state.records).toBe(0)
    host.state.selected = []
    tool.place({ x: 400, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", hinge: "b", swing: "left" })
  })

  it("DT-08b: выделены две двери — ни одна не поворачивается, записи нет", () => {
    const { walls } = sceneF()
    const p = dr("W", "a", 50, "a", "left", 90, 210, "p")
    const q = dr("W", "a", 300, "a", "left", 90, 210, "q")
    const host = fakeHost(walls, [p, q], [p, q])
    const panel = fakePanel()
    createElementTool("door", host, panel)
    panel.rotate.fire("click")
    expect(host.state.elements).toEqual([p, q])
    expect(host.state.records).toBe(0)
  })
})

describe("панель выделенной двери", () => {
  it("DT-09: поля показывают ширину и высоту выделенной двери", () => {
    const { walls } = sceneF()
    const d = dr("W", "a", 100, "a", "left", 80, 200)
    const host = fakeHost(walls, [d], [d])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    tool.syncPanel()
    expect(panel.width.value).toBe("80")
    expect(panel.height.value).toBe("200")
  })

  it("DT-09b: без выделения поля показывают параметры новых дверей", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    tool.syncPanel()
    expect(panel.width.value).toBe("90")
    expect(panel.height.value).toBe("210")
  })

  it("DT-10: поле «H» меняет выделенную дверь одной записью; то же значение и 0 — без записи", () => {
    const { walls } = sceneF()
    const d = DR()
    const host = fakeHost(walls, [d], [d])
    const panel = fakePanel()
    createElementTool("door", host, panel)
    panel.height.value = "200"
    panel.height.fire("change")
    expect(byId(host.state.elements, "dr0")).toEqual({ ...d, heightCm: 200 })
    expect(host.state.records).toBe(1)
    panel.height.value = "200"
    panel.height.fire("change")
    expect(host.state.records).toBe(1)
    panel.height.value = "0"
    panel.height.fire("change")
    expect(byId(host.state.elements, "dr0")).toEqual({ ...d, heightCm: 200 })
    expect(host.state.records).toBe(1)
  })

  it("DT-11: поля выделенной двери не меняют параметры новых дверей", () => {
    const { walls } = sceneF()
    const d = DR()
    const host = fakeHost(walls, [d], [d])
    const panel = fakePanel()
    const tool = createElementTool("door", host, panel)
    panel.height.value = "200"
    panel.height.fire("change")
    panel.width.value = "70"
    panel.width.fire("change")
    host.state.selected = []
    tool.place({ x: 400, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", widthCm: 90, heightCm: 210 })
  })

  it("DT-12: поля выделенной двери в инструменте «Проём» не меняют дверь (панель своего вида)", () => {
    const { walls } = sceneF()
    const d = DR()
    const host = fakeHost(walls, [d], [d])
    const panel = plainPanel()
    createElementTool("doorway", host, panel)
    panel.height.value = "200"
    panel.height.fire("change")
    expect(byId(host.state.elements, "dr0")).toEqual(d)
    expect(host.state.records).toBe(0)
  })
})
