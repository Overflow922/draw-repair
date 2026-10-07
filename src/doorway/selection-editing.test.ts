import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Point, WallElement } from "../types"
import { PX_PER_CM } from "../types"
import { createElementTool, createSelectionEditing } from "./doorway-tool"
import { doorZoneAt } from "./doorway-layout"
import { jambsT } from "./doorway-faces"
import { D0, door, sceneF, w } from "./doorway.test-utils"
import { DR, dr } from "./door.test-utils"
import { win } from "./window.test-utils"
import {
  INITIAL,
  byId,
  chainOffsetCm,
  fakeHost,
  labelGapCm,
  numberOffsetPx,
  stubEditorDom,
  withDoorHinge,
} from "./selection-editing.test-utils"
import type { EditorInput } from "./selection-editing.test-utils"

// change popups-buttons-only: правка на месте чисел выделенного элемента, зоны направления выделенной двери и
// установка с параметрами новых элементов через адаптеры createSelectionEditing / createElementTool
// (spec doorway «Ввод чисел размеров проёма», «Инструмент «Проём» и параметры новых проёмов»; door «Инструмент
// «Дверь» и параметры новых дверей», «Направление выделенной двери»; window «Правка подписи окна», «Инструмент
// «Окно» и параметры новых окон»; drawing-history «Отменяемые действия»; design D3–D6, D9).
// Хост — заглушка с независимым эталоном наследования; сцена F (свободная стена W вдоль x), зум 1, подпись над
// стеной (y < −10), числа цепочки на выносе 8.4 см от граней.

const K = PX_PER_CM
const LABEL_Y = -10 - labelGapCm()
const PLUS_Y = 10 + chainOffsetCm()
const MINUS_Y = -10 - chainOffsetCm()
// центр числа высоты в подписи «H=…» проёма или двери с серединой mid
const hAt = (mid: number, label: string): Point => ({ x: mid + numberOffsetPx([label], 0, 2) / K, y: LABEL_Y })

let editors: EditorInput[] = []
beforeEach(() => {
  editors = stubEditorDom()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ввод в открытое поле и Enter
function enter(value: string): void {
  const e = editors[editors.length - 1]
  e.value = value
  e.key("Enter")
}

describe("правка числа подписи", () => {
  it("PB-ED-01: клик по «210» открывает поле с числом; 200 + Enter — высота 200, остальное прежнее, одна запись", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d])
    const editing = createSelectionEditing(host)
    expect(editing.pressNumber(hAt(145, "H=210"))).toBe(true)
    expect(editors).toHaveLength(1)
    expect(editors[0].value).toBe("210")
    enter("200")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, heightCm: 200 })
    expect(host.state.records).toBe(1)
    expect(host.state.calls).toEqual(["record", "replace"])
    expect(host.state.inherited).toEqual([{ ...d, heightCm: 200 }])
  })

  it("PB-ED-02: единица мм — в поле «2100» без «H=»", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d], { unit: "mm" })
    expect(createSelectionEditing(host).pressNumber(hAt(145, "H=2100"))).toBe(true)
    expect(editors[0].value).toBe("2100")
  })

  it("PB-ED-03: высота 0, −5 и нечисловое значение не применяются — без записи и наследования", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d])
    const editing = createSelectionEditing(host)
    for (const bad of ["0", "-5", "x"]) {
      expect(editing.pressNumber(hAt(145, "H=210"))).toBe(true)
      enter(bad)
    }
    expect(host.state.elements).toEqual([d])
    expect(host.state.records).toBe(0)
    expect(host.state.inherited).toEqual([])
  })

  it("PB-ED-04: мультивыделение и выделение с объектами других типов — число не правится", () => {
    const { walls } = sceneF()
    const p = door("W", "a", 50, 90, 210, "p")
    const q = door("W", "a", 300, 90, 210, "q")
    const two = fakeHost(walls, [p, q], [p, q])
    expect(createSelectionEditing(two).pressNumber(hAt(95, "H=210"))).toBe(false)
    const mixed = fakeHost(walls, [p], [p], { othersSelected: true })
    expect(createSelectionEditing(mixed).pressNumber(hAt(95, "H=210"))).toBe(false)
    const none = fakeHost(walls, [p], [])
    expect(createSelectionEditing(none).pressNumber(hAt(95, "H=210"))).toBe(false)
    expect(editors).toHaveLength(0)
  })

  it("PB-ED-20: выделен размер (элементы не выделены) — числа не правятся, поле не открывается", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [], { othersSelected: true })
    const editing = createSelectionEditing(host)
    for (const p of [hAt(145, "H=210"), { x: 145, y: PLUS_Y }, { x: 50, y: MINUS_Y }]) expect(editing.pressNumber(p), `${p.x},${p.y}`).toBe(false)
    expect(editors).toHaveLength(0)
  })

  it("PB-ED-04b: подпись невыделенного элемента не правится, даже если другой элемент выделен", () => {
    const { walls } = sceneF()
    const p = door("W", "a", 50, 90, 210, "p")
    const q = door("W", "a", 300, 90, 210, "q")
    const host = fakeHost(walls, [p, q], [p])
    expect(createSelectionEditing(host).pressNumber(hAt(345, "H=210"))).toBe(false)
  })

  it("PB-ED-06: подоконник окна правится в подписи — 90, высота прежняя, одна запись", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100)
    const host = fakeHost(walls, [x], [x])
    const parts = ["H=150", "H под.=85"]
    expect(createSelectionEditing(host).pressNumber({ x: 160 + numberOffsetPx(parts, 1, 7) / K, y: LABEL_Y })).toBe(true)
    expect(editors[0].value).toBe("85")
    enter("90")
    expect(byId(host.state.elements, "w0")).toEqual({ ...x, sillCm: 90 })
    expect(host.state.records).toBe(1)
    expect(host.state.inherited).toEqual([{ ...x, sillCm: 90 }])
  })

  it("PB-ED-14: высота окна в мм — поле «1500», 1400 + Enter — высота 140 см, подоконник прежний", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100)
    const host = fakeHost(walls, [x], [x], { unit: "mm" })
    const parts = ["H=1500", "H под.=850"]
    expect(createSelectionEditing(host).pressNumber({ x: 160 + numberOffsetPx(parts, 0, 2) / K, y: LABEL_Y })).toBe(true)
    expect(editors[0].value).toBe("1500")
    enter("1400")
    expect(byId(host.state.elements, "w0")).toEqual({ ...x, heightCm: 140 })
  })

  it("PB-ED-15: подоконник 0 применяется одной записью", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100)
    const host = fakeHost(walls, [x], [x])
    createSelectionEditing(host).pressNumber({ x: 160 + numberOffsetPx(["H=150", "H под.=85"], 1, 7) / K, y: LABEL_Y })
    enter("0")
    expect(byId(host.state.elements, "w0")).toEqual({ ...x, sillCm: 0 })
    expect(host.state.records).toBe(1)
  })

  it("PB-ED-16: подоконник −10 и нечисловой не применяются", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100)
    const host = fakeHost(walls, [x], [x])
    const editing = createSelectionEditing(host)
    const at = { x: 160 + numberOffsetPx(["H=150", "H под.=85"], 1, 7) / K, y: LABEL_Y }
    for (const bad of ["-10", "abc"]) {
      expect(editing.pressNumber(at)).toBe(true)
      enter(bad)
    }
    expect(host.state.elements).toEqual([x])
    expect(host.state.records).toBe(0)
    expect(host.state.inherited).toEqual([])
  })

  it("PB-ED-17: Esc и потеря фокуса закрывают поле без изменений", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d])
    const editing = createSelectionEditing(host)
    editing.pressNumber(hAt(145, "H=210"))
    editors[0].value = "150"
    editors[0].key("Escape")
    editing.pressNumber(hAt(145, "H=210"))
    editors[1].value = "150"
    editors[1].blur()
    expect(host.state.elements).toEqual([d])
    expect(host.state.records).toBe(0)
    expect(host.state.inherited).toEqual([])
  })

  it("PB-ED-18: то же значение — без записи и без наследования", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d])
    createSelectionEditing(host).pressNumber(hAt(145, "H=210"))
    enter("210")
    expect(host.state.records).toBe(0)
    expect(host.state.inherited).toEqual([])
  })

  it("PB-ED-19: запятая равнозначна точке — «2,5» м — высота 250 см", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d], { unit: "m" })
    expect(createSelectionEditing(host).pressNumber(hAt(145, "H=2,1"))).toBe(true)
    expect(editors[0].value).toBe("2.1")
    enter("2,5")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, heightCm: 250 })
  })
})

describe("правка числа цепочки", () => {
  it("PB-ED-11: ширина 0, −5 и нечисловая не применяются — без записи и наследования", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d])
    const editing = createSelectionEditing(host)
    for (const bad of ["0", "-5", "abc"]) {
      expect(editing.pressNumber({ x: 145, y: PLUS_Y })).toBe(true)
      enter(bad)
    }
    expect(host.state.elements).toEqual([d])
    expect(host.state.records).toBe(0)
    expect(host.state.inherited).toEqual([])
  })

  it("PB-ED-05: число ширины выделенной двери лежит в зоне направления — открывается поле, направление прежнее", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    expect(doorZoneAt({ x: 145, y: PLUS_Y }, d, walls)).not.toBeNull()
    const host = fakeHost(walls, [d], [d])
    expect(createSelectionEditing(host).pressNumber({ x: 145, y: PLUS_Y })).toBe(true)
    expect(editors[0].value).toBe("90")
    expect(byId(host.state.elements, "dr0")).toEqual(d)
  })

  it("PB-ED-09: ширина, ограниченная соседом, наследуется фактической — 180", () => {
    const W = w(0, 0, 500, 0, "W")
    const V = w(0, 300, 500, 300, "V")
    const d = D0()
    const x = win("W", "b", 100, 120, 150, 85, "x") // участок 280…400
    const host = fakeHost([W, V], [d, x], [d])
    createSelectionEditing(host).pressNumber({ x: 145, y: PLUS_Y })
    enter("200")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, widthCm: 180 })
    expect(host.state.inherited).toEqual([{ ...d, widthCm: 180 }])
    host.state.selected = []
    createElementTool("doorway", host).place({ x: 250, y: 300 })
    expect(host.state.added[0]).toMatchObject({ wallId: "V", widthCm: 180, heightCm: 210 })
  })
})

describe("наследование параметров новых элементов", () => {
  it("PB-ED-07: правка высоты и ширины проёма — следующий проём 80×200", () => {
    const { walls } = sceneF()
    const d = D0()
    const host = fakeHost(walls, [d], [d])
    const editing = createSelectionEditing(host)
    editing.pressNumber(hAt(145, "H=210"))
    enter("200")
    editing.pressNumber({ x: 145, y: MINUS_Y })
    enter("80")
    expect(byId(host.state.elements, "d0")).toEqual({ ...d, widthCm: 80, heightCm: 200 })
    host.state.selected = []
    createElementTool("doorway", host).place({ x: 400, y: 0 })
    expect(host.state.added[0]).toMatchObject({ widthCm: 80, heightCm: 200 })
  })

  it("PB-ED-08: выделение проёма 120×250 без правки не меняет параметры новых", () => {
    const { walls } = sceneF()
    const big = door("W", "a", 50, 120, 250, "big")
    const host = fakeHost(walls, [big])
    const tool = createElementTool("doorway", host)
    // выделение кликом по проёму (нажатие без перетаскивания), затем снятие выделения
    expect(tool.pressDoorway({ x: 110, y: 0 })).toBe(true)
    tool.endDrag()
    expect(host.state.selected).toEqual([big])
    expect(host.state.records).toBe(0)
    host.state.selected = []
    tool.place({ x: 400, y: 0 })
    expect(host.state.added[0]).toMatchObject({ widthCm: 90, heightCm: 210 })
    expect(host.state.inherited).toEqual([])
  })

  it("PB-ED-10: перетаскивание, стрелки и установка не наследуют параметры", () => {
    const { walls } = sceneF()
    const d = door("W", "a", 100, 70, 190)
    const host = fakeHost(walls, [d], [d])
    const tool = createElementTool("doorway", host)
    expect(tool.pressDoorway({ x: 135, y: 0 })).toBe(true)
    tool.dragTo({ x: 165, y: 0 })
    tool.endDrag()
    tool.nudge({ x: 1, y: 0 }, 10)
    host.state.selected = []
    tool.place({ x: 400, y: 0 })
    expect(host.state.inherited).toEqual([])
    expect(host.state.added[0]).toMatchObject({ widthCm: 90, heightCm: 210 })
  })

  it("PB-ED-12: правка высоты двери меняет параметры новых дверей, а не проёмов", () => {
    const { walls } = sceneF()
    const d = DR()
    const host = fakeHost(walls, [d], [d])
    createSelectionEditing(host).pressNumber(hAt(145, "H=210"))
    enter("200")
    expect(host.state.inherited).toEqual([{ ...d, heightCm: 200 }])
    host.state.selected = []
    createElementTool("door", host).place({ x: 300, y: -8 })
    createElementTool("doorway", host).place({ x: 430, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", heightCm: 200 })
    expect(host.state.added[1]).toMatchObject({ widthCm: 90, heightCm: 210 })
    expect(host.state.added[1] && "kind" in host.state.added[1]).toBe(false)
  })

  it("PB-ED-13: подоконник 0 в подписи — следующее окно 120×150 с подоконником 0", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 50)
    const host = fakeHost(walls, [x], [x])
    createSelectionEditing(host).pressNumber({ x: 110 + numberOffsetPx(["H=150", "H под.=85"], 1, 7) / K, y: LABEL_Y })
    enter("0")
    host.state.selected = []
    createElementTool("window", host).place({ x: 380, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "window", widthCm: 120, heightCm: 150, sillCm: 0 })
  })
})

describe("зоны направления выделенной двери", () => {
  it("PB-ZN-04: клик в зону b/right — направление двери, выделение сохраняется, одна запись до правки", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const host = fakeHost(walls, [d], [d])
    expect(createSelectionEditing(host).pressZone({ x: 170, y: 40 })).toBe(true)
    const next = { ...d, hinge: "b", swing: "right" }
    expect(byId(host.state.elements, "dr0")).toEqual(next)
    expect(host.state.selected).toEqual([next])
    expect(host.state.records).toBe(1)
    expect(host.state.calls).toEqual(["record", "replace"])
    expect(host.state.inherited).toEqual([next])
  })

  it("PB-ZN-05: клик в зону текущего направления — нажатие поглощено, без изменения и записи", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const host = fakeHost(walls, [d], [d])
    expect(createSelectionEditing(host).pressZone({ x: 120, y: -60 })).toBe(true)
    expect(host.state.elements).toEqual([d])
    expect(host.state.selected).toEqual([d])
    expect(host.state.records).toBe(0)
    expect(host.state.inherited).toEqual([])
  })

  it("PB-ZN-03: клик вне зон — не поглощён, дверь прежняя", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const host = fakeHost(walls, [d], [d])
    const editing = createSelectionEditing(host)
    for (const p of [{ x: 170, y: 120 }, { x: 60, y: 40 }, { x: 145, y: 0 }]) expect(editing.pressZone(p), `${p.x},${p.y}`).toBe(false)
    expect(host.state.elements).toEqual([d])
    expect(host.state.records).toBe(0)
  })

  it("PB-ZN-06: новая дверь наследует петли из зоны, сторона — по курсору; повтор зоны не трогает новые", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const host = fakeHost(walls, [d], [d])
    createSelectionEditing(host).pressZone({ x: 170, y: -60 }) // b/left
    expect(host.state.inherited).toEqual([{ ...d, hinge: "b", swing: "left" }])
    host.state.selected = []
    createElementTool("door", host).place({ x: 400, y: 8 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", hinge: "b", swing: "right" })
  })

  it("PB-ZN-07: зоны только у одной выделенной двери", () => {
    const { walls } = sceneF()
    const p = dr("W", "a", 100, "a", "left", 90, 210, "p")
    const q = dr("W", "a", 300, "a", "left", 90, 210, "q")
    const cases = [
      fakeHost(walls, [p, q], [p, q]),
      fakeHost(walls, [p], [p], { othersSelected: true }),
      fakeHost(walls, [D0()], [D0()]),
      fakeHost(walls, [win("W", "a", 100)], [win("W", "a", 100)]),
      fakeHost(walls, [p], []),
    ]
    for (const host of cases) {
      expect(createSelectionEditing(host).pressZone({ x: 170, y: 40 })).toBe(false)
      expect(host.state.records).toBe(0)
    }
  })
})

describe("установка с параметрами новых элементов", () => {
  it("PB-TL-01: инструмент «Проём» — 90×210 по умолчанию", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    createElementTool("doorway", host).place({ x: 250, y: 0 })
    expect(host.state.added[0]).toMatchObject({ wallId: "W", widthCm: 90, heightCm: 210, offsetCm: 205 })
  })

  it("PB-TL-02: ширина призрака и параметры установки — из параметров хоста", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [], [], { params: { ...INITIAL, doorway: { widthCm: 60, heightCm: 200 } } })
    const tool = createElementTool("doorway", host)
    tool.hover({ x: 250, y: 0 })
    expect(tool.ghost()).toMatchObject({ widthCm: 60, offsetCm: 220 })
    tool.place({ x: 250, y: 0 })
    expect(host.state.added[0]).toMatchObject({ widthCm: 60, heightCm: 200 })
  })

  it("PB-TL-03: дверь по умолчанию — 90×210, петли a; курсор над стеной со стороны y < 0 — left", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    const tool = createElementTool("door", host)
    tool.hover({ x: 200, y: -8 })
    const g = tool.ghost()
    expect(g).toMatchObject({ kind: "door", widthCm: 90, hinge: "a", swing: "left" })
    if (g) expect(jambsT(g, walls[0])).toEqual([155, 245])
    tool.place({ x: 200, y: -8 })
    expect(host.state.added[0]).toMatchObject({ kind: "door", widthCm: 90, heightCm: 210, hinge: "a", swing: "left" })
    expect(host.state.records).toBe(1)
  })

  it("PB-TL-04: призрак двери меняет сторону вслед за курсором", () => {
    const { walls } = sceneF()
    const tool = createElementTool("door", fakeHost(walls, []))
    tool.hover({ x: 200, y: 8 })
    expect(tool.ghost()).toMatchObject({ kind: "door", swing: "right" })
    tool.hover({ x: 200, y: -8 })
    expect(tool.ghost()).toMatchObject({ kind: "door", swing: "left" })
  })

  it("PB-TL-05: мёртвая зона — 4 px экрана: 2 см при зуме 1, 1 см при зуме 2", () => {
    const { walls } = sceneF()
    const t1 = createElementTool("door", fakeHost(walls, [], [], { zoom: 1 }))
    t1.hover({ x: 200, y: 8 })
    for (const y of [1.9, 0, -1.9]) {
      t1.hover({ x: 200, y })
      expect(t1.ghost(), `zoom 1, y ${y}`).toMatchObject({ kind: "door", swing: "right" })
    }
    t1.hover({ x: 200, y: -2.1 })
    expect(t1.ghost()).toMatchObject({ swing: "left" })

    const t2 = createElementTool("door", fakeHost(walls, [], [], { zoom: 2 }))
    t2.hover({ x: 200, y: 8 })
    t2.hover({ x: 200, y: -0.9 })
    expect(t2.ghost()).toMatchObject({ swing: "right" })
    t2.hover({ x: 200, y: -1.1 })
    expect(t2.ghost()).toMatchObject({ swing: "left" })
  })

  it("PB-TL-05b: до первого показа призрака у оси — left", () => {
    const { walls } = sceneF()
    const tool = createElementTool("door", fakeHost(walls, []))
    tool.hover({ x: 200, y: 0 })
    expect(tool.ghost()).toMatchObject({ kind: "door", swing: "left" })
  })

  it("PB-TL-06: клик ставит дверь с шириной, высотой и петлями из параметров и стороной призрака", () => {
    const { walls } = sceneF()
    const params = withDoorHinge({ ...INITIAL, door: { widthCm: 80, heightCm: 200, hinge: "a" } }, "b")
    const host = fakeHost(walls, [], [], { params })
    createElementTool("door", host).place({ x: 200, y: 8 })
    const placed: WallElement | undefined = host.state.added[0]
    expect(placed).toMatchObject({ kind: "door", widthCm: 80, heightCm: 200, hinge: "b", swing: "right" })
    expect(host.state.selected).toEqual([placed])
    expect(host.state.records).toBe(1)
  })

  it("PB-TL-07: окно по умолчанию — 120×150×85, поставленное окно выделено", () => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [])
    createElementTool("window", host).place({ x: 250, y: 0 })
    expect(host.state.added[0]).toMatchObject({ kind: "window", widthCm: 120, heightCm: 150, sillCm: 85 })
    expect(host.state.selected).toEqual([host.state.added[0]])
  })

  it("PB-TL-08: окно — ширина призрака, высота и подоконник из параметров хоста; выделено, одна запись", () => {
    const { walls, W } = sceneF()
    const host = fakeHost(walls, [], [], { params: { ...INITIAL, window: { widthCm: 100, heightCm: 140, sillCm: 30 } } })
    const tool = createElementTool("window", host)
    tool.hover({ x: 250, y: 0 })
    const g = tool.ghost()
    expect(g).toMatchObject({ kind: "window", widthCm: 100 })
    if (g) expect(jambsT(g, W)).toEqual([200, 300])
    tool.place({ x: 250, y: 0 })
    const placed = host.state.added[0]
    expect(placed).toMatchObject({ kind: "window", widthCm: 100, heightCm: 140, sillCm: 30 })
    expect(host.state.selected).toEqual([placed])
    expect(host.state.records).toBe(1)
  })
})
