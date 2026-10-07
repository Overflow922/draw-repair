import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Scene } from "../history"
import type { View, Wall, WallElement } from "../types"
import { createElementTool } from "./doorway-tool"
import type { ElementPanel, ElementToolHost } from "./doorway-tool"
import { jambsT } from "./doorway-faces"
import { D0, door, sceneF, sceneR } from "./doorway.test-utils"
import { WN, win } from "./window.test-utils"

// change add-window: адаптер инструмента передаёт соседей во все операции и параметризуется видом
// (spec doorway «Инвариант размещения проёма», «Перемещение проёма», «Выделение проёма»;
// window «Инструмент «Окно»», «Панель выделенного окна»; design D3, D4 «Контракт адаптера»).
// Хост и поля панели — заглушки; единица — см (formatCm/parseCm без пересчёта).

interface FakeInput {
  value: string
  fire(type: string): void
}

function fakeInput(): FakeInput & HTMLInputElement {
  const handlers = new Map<string, ((e: { key: string }) => void)[]>()
  const input = {
    value: "",
    addEventListener(type: string, fn: (e: { key: string }) => void): void {
      handlers.set(type, [...(handlers.get(type) ?? []), fn])
    },
    blur(): void {},
    fire(type: string): void {
      for (const fn of handlers.get(type) ?? []) fn({ key: "" })
    },
  }
  return input as unknown as FakeInput & HTMLInputElement
}

function fakePanel(withSill: boolean): ElementPanel & { width: FakeInput & HTMLInputElement; height: FakeInput & HTMLInputElement; sill?: FakeInput & HTMLInputElement } {
  const root = { classList: { toggle(): void {} }, querySelectorAll: (): never[] => [] } as unknown as HTMLElement
  return { root, width: fakeInput(), height: fakeInput(), ...(withSill ? { sill: fakeInput() } : {}) }
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

describe("призрак учитывает соседей", () => {
  it("WTL-01: призрак проёма в RN встаёт в промежуток 190…280; окну 120 места нет", () => {
    const { walls, W } = sceneR()
    const host = fakeHost(walls, [D0(), WN()])
    const doorTool = createElementTool("doorway", host, fakePanel(false))
    doorTool.hover({ x: 250, y: 0 })
    const g = doorTool.ghost()
    expect(g).not.toBeNull()
    if (g) expect(jambsT(g, W)).toEqual([190, 280])
    const windowTool = createElementTool("window", host, fakePanel(true))
    windowTool.hover({ x: 235, y: 0 })
    expect(windowTool.ghost()).toBeNull()
    windowTool.place({ x: 235, y: 0 })
    expect(host.state.added).toEqual([])
  })
})

describe("перетаскивание и стрелки учитывают соседей", () => {
  it("WTL-02: перетаскивание проёма останавливается у окна (offset 190), одна запись истории", () => {
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()])
    const tool = createElementTool("doorway", host, fakePanel(false))
    expect(tool.pressDoorway({ x: 145, y: 0 })).toBe(true)
    tool.dragTo({ x: 345, y: 0 })
    tool.endDrag()
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, offsetCm: 190 })
    expect(host.state.records).toBe(1)
  })

  it("WTL-03: стрелка сдвигает пару в касании вместе (110 / 200)", () => {
    const { walls } = sceneF()
    const d = D0()
    const x = win("W", "a", 190, 120, 150, 85, "x")
    const host = fakeHost(walls, [d, x], [d, x])
    const tool = createElementTool("doorway", host, fakePanel(false))
    expect(tool.nudge({ x: 1, y: 0 }, 10)).toBe(true)
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, offsetCm: 110 })
    expect(byId(host.state.elements, "x")).toEqual({ ...x, offsetCm: 200 })
  })
})

describe("стрелки и ввод числа учитывают невыделенного соседа", () => {
  it("WTL-08: стрелка упирает выделенный проём в невыделенное окно (95 → 100), окно на месте", () => {
    const { walls } = sceneF()
    const d = door("W", "a", 95)
    const x = win("W", "a", 190, 120, 150, 85, "x")
    const host = fakeHost(walls, [d, x], [d])
    const tool = createElementTool("doorway", host, fakePanel(false))
    tool.nudge({ x: 1, y: 0 }, 10)
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, offsetCm: 100 })
    expect(byId(host.state.elements, "x")).toEqual(x)
  })

  // поле ввода на месте числа: document.createElement подменён, Enter — событие keydown
  interface EditorInput {
    value: string
    fire(key: string): void
  }
  const editors: EditorInput[] = []
  const stubEditorDom = (): void => {
    editors.length = 0
    vi.stubGlobal("document", {
      activeElement: null,
      createElement: (): unknown => {
        const handlers = new Map<string, ((e: { key: string; stopPropagation(): void }) => void)[]>()
        const input = {
          className: "",
          type: "",
          inputMode: "",
          value: "",
          style: {} as Record<string, string>,
          addEventListener(type: string, fn: (e: { key: string; stopPropagation(): void }) => void): void {
            handlers.set(type, [...(handlers.get(type) ?? []), fn])
          },
          remove(): void {},
          focus(): void {},
          select(): void {},
          fire(key: string): void {
            for (const fn of handlers.get("keydown") ?? []) fn({ key, stopPropagation: () => {} })
          },
        }
        editors.push(input)
        return input
      },
    })
  }
  const withEditorParent = (host: FakeHost): FakeHost => ({ ...host, editorParent: { append: () => {} } as unknown as HTMLElement })

  // число цепочки выноса: 1.2 · 14 px экрана = 8.4 см при зуме 1 (PX_PER_CM = 2) от грани y = +10
  const NUMBER_Y = 10 + (14 * 1.2) / 2

  it("WTL-09: число «90» до окна находится и редактируется; 0 ставит проём вплотную к окну", () => {
    stubEditorDom()
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()], [d])
    const tool = createElementTool("doorway", withEditorParent(host), fakePanel(false))
    expect(tool.pressNumber({ x: 235, y: NUMBER_Y })).toBe(true)
    expect(editors).toHaveLength(1)
    expect(editors[0].value).toBe("90")
    editors[0].value = "0"
    editors[0].fire("Enter")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, anchor: "b", offsetCm: 220 })
  })

  it("WTL-10: введённое расстояние, наезжающее на окно, ограничивается касанием", () => {
    stubEditorDom()
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()], [d])
    const tool = createElementTool("doorway", withEditorParent(host), fakePanel(false))
    expect(tool.pressNumber({ x: 55, y: NUMBER_Y })).toBe(true)
    editors[0].value = "400"
    editors[0].fire("Enter")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, anchor: "a", offsetCm: 190 })
  })

  it("WTL-10b: введённая ширина, наезжающая на окно, ограничивается касанием", () => {
    stubEditorDom()
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()], [d])
    const tool = createElementTool("doorway", withEditorParent(host), fakePanel(false))
    expect(tool.pressNumber({ x: 145, y: NUMBER_Y })).toBe(true)
    editors[0].value = "200"
    editors[0].fire("Enter")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, widthCm: 180 })
  })
})

describe("поля панели", () => {
  it("WTL-04: ширина 200 выделенного проёма ограничивается касанием окна — 180", () => {
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()], [d])
    const panel = fakePanel(false)
    createElementTool("doorway", host, panel)
    panel.width.value = "200"
    panel.width.fire("change")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, widthCm: 180 })
    expect(host.state.records).toBe(1)
  })

  it("WTL-05: инструмент «Окно» ставит окно 120/150/85; подоконник 0 применяется к новым, −10 — нет", () => {
    const { walls, W } = sceneF()
    const host = fakeHost(walls, [])
    const panel = fakePanel(true)
    const tool = createElementTool("window", host, panel)
    tool.place({ x: 250, y: 0 })
    expect(host.state.added).toHaveLength(1)
    const first = host.state.added[0]
    expect(first).toMatchObject({ kind: "window", wallId: "W", widthCm: 120, heightCm: 150, sillCm: 85 })
    expect(jambsT(first, W)).toEqual([190, 310])
    expect(host.state.selected).toEqual([first])

    host.state.selected = []
    const sill = panel.sill
    expect(sill).toBeDefined()
    if (!sill) return
    sill.value = "0"
    sill.fire("change")
    tool.place({ x: 100, y: 0 })
    expect(host.state.added[1]).toMatchObject({ kind: "window", sillCm: 0 })

    host.state.selected = []
    sill.value = "-10"
    sill.fire("change")
    tool.place({ x: 420, y: 0 })
    expect(host.state.added[2]).toMatchObject({ kind: "window", sillCm: 0 })
  })

  it("WTL-06: поле подоконника выделенного окна меняет окно, а не параметры новых", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100)
    const host = fakeHost(walls, [x], [x])
    const panel = fakePanel(true)
    const tool = createElementTool("window", host, panel)
    const sill = panel.sill
    if (!sill) throw new Error("нет поля подоконника")
    sill.value = "90"
    sill.fire("change")
    expect(byId(host.state.elements, "w0")).toEqual({ ...x, sillCm: 90 })
    expect(host.state.records).toBe(1)
    host.state.selected = []
    tool.place({ x: 400, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "window", sillCm: 85 })
  })

  it("WTL-07: инструмент «Проём» ставит проём без вида с параметрами 90/210", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    const tool = createElementTool("doorway", host, fakePanel(false))
    tool.place({ x: 250, y: 0 })
    const placed: WallElement | undefined = host.state.added[0]
    expect(placed).toMatchObject({ wallId: "W", widthCm: 90, heightCm: 210, offsetCm: 205 })
    expect(placed && "kind" in placed).toBe(false)
  })
})
