import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WallElement } from "../types"
import { createElementTool, createSelectionEditing } from "./doorway-tool"
import { jambsT } from "./doorway-faces"
import { D0, door, sceneF, sceneR } from "./doorway.test-utils"
import { WN, win } from "./window.test-utils"
import { byId, fakeHost, stubEditorDom } from "./selection-editing.test-utils"
import type { EditorInput } from "./selection-editing.test-utils"

// change add-window: адаптер инструмента передаёт соседей во все операции и параметризуется видом
// (spec doorway «Инвариант размещения проёма», «Перемещение проёма», «Ввод чисел размеров проёма»;
// window «Инструмент «Окно» и параметры новых окон»; design D3, D4 «Контракт адаптера»).
// Поля панели окна сняты в change popups-buttons-only: их замены — selection-editing.test.ts.
// Хост — заглушка; единица — см.

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
    const doorTool = createElementTool("doorway", host)
    doorTool.hover({ x: 250, y: 0 })
    const g = doorTool.ghost()
    expect(g).not.toBeNull()
    if (g) expect(jambsT(g, W)).toEqual([190, 280])
    const windowTool = createElementTool("window", host)
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
    const tool = createElementTool("doorway", host)
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
    const tool = createElementTool("doorway", host)
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
    const tool = createElementTool("doorway", host)
    tool.nudge({ x: 1, y: 0 }, 10)
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, offsetCm: 100 })
    expect(byId(host.state.elements, "x")).toEqual(x)
  })

  let editors: EditorInput[] = []
  beforeEach(() => {
    editors = stubEditorDom()
  })

  // число цепочки выноса: 1.2 · 14 px экрана = 8.4 см при зуме 1 (PX_PER_CM = 2) от грани y = +10
  const NUMBER_Y = 10 + (14 * 1.2) / 2

  it("WTL-09: число «90» до окна находится и редактируется; 0 ставит проём вплотную к окну", () => {
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()], [d])
    expect(createSelectionEditing(host).pressNumber({ x: 235, y: NUMBER_Y })).toBe(true)
    expect(editors).toHaveLength(1)
    expect(editors[0].value).toBe("90")
    editors[0].value = "0"
    editors[0].key("Enter")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, anchor: "b", offsetCm: 220 })
  })

  it("WTL-10: введённое расстояние, наезжающее на окно, ограничивается касанием", () => {
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()], [d])
    expect(createSelectionEditing(host).pressNumber({ x: 55, y: NUMBER_Y })).toBe(true)
    editors[0].value = "400"
    editors[0].key("Enter")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, anchor: "a", offsetCm: 190 })
  })

  it("WTL-10b: введённая ширина, наезжающая на окно, ограничивается касанием", () => {
    const { walls } = sceneR()
    const d = D0()
    const host = fakeHost(walls, [d, WN()], [d])
    expect(createSelectionEditing(host).pressNumber({ x: 145, y: NUMBER_Y })).toBe(true)
    editors[0].value = "200"
    editors[0].key("Enter")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, widthCm: 180 })
  })
})

describe("установка", () => {
  it("WTL-07: инструмент «Проём» ставит проём без вида с параметрами 90/210", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    const tool = createElementTool("doorway", host)
    tool.place({ x: 250, y: 0 })
    const placed: WallElement | undefined = host.state.added[0]
    expect(placed).toMatchObject({ wallId: "W", widthCm: 90, heightCm: 210, offsetCm: 205 })
    expect(placed && "kind" in placed).toBe(false)
  })
})
