import { describe, expect, it } from "vitest"
import { LIGHT_SYMBOL_PX_PER_MM } from "../ceiling/light-symbol"
import type { Shape } from "../communications/shape"
import { reachBodies } from "../furniture/item-wall-reach"
import { openingBodies } from "./switch-reach"
import { openingOn, rectWalls } from "../rough/rough.test-utils"
import type { LightSwitch, Point, View } from "../types"
import { PX_PER_CM } from "../types"
import { newSwitch } from "./light-switch"
import { keyGeometry } from "./switch-symbol"
import { createSwitchTool } from "./switch-tool"
import type { SwitchToolHost } from "./switch-tool"

// change add-light-switch: инструмент «Выключатель» — постановка с призраком, выделение, правка, перетаскивание, удаление
// (spec light-switch «Инструмент «Выключатель»», «Выделение, перемещение, правка линий и удаление выключателя»; switching-plan
// «Ластик на плане «Группы включения»»). Помещение — внутренние грани x = 0, 400, y = 0, 300; стены толщиной 20 см.

const VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } }
const ROOM = rectWalls("w", -10, -10, 410, 310)
const BODIES: Shape[] = reachBodies(ROOM)
const NEAR_CM = 20 / PX_PER_CM // 20 px от грани

const swAt = (id: string, x: number, y: number, angle: number, keys: string[][] = [[]]): LightSwitch => ({ id, at: { x, y }, angle, keys: keys.map((lines) => ({ lines })) })

// точка чертежа (см) части знака: g — положение в px при центре блока в px чертежа
const cmOf = (p: Point): Point => ({ x: p.x / PX_PER_CM, y: p.y / PX_PER_CM })
const keyPoint = (s: LightSwitch, index: number, part: "circle" | "label" | "dash"): Point => {
  const g = keyGeometry(s, index, { x: s.at.x * PX_PER_CM, y: s.at.y * PX_PER_CM }, LIGHT_SYMBOL_PX_PER_MM)
  return cmOf(part === "circle" ? g.circle.c : part === "label" ? g.label : g.dash[1])
}

function setup(initial: LightSwitch[] = [], keyCount = 1, openings: Shape[] = []) {
  let switches = initial
  let n = 0
  const log = { records: 0, changes: 0 }
  const host: SwitchToolHost = {
    bodies: () => BODIES,
    openings: () => openings,
    switches: () => switches,
    setSwitches: (next) => {
      switches = next
    },
    record: () => {
      log.records++
    },
    changed: () => {
      log.changes++
    },
    redraw: () => {},
    newId: () => "id" + String(++n),
    keyCount: () => keyCount,
    view: () => VIEW,
    unitsPerMm: LIGHT_SYMBOL_PX_PER_MM,
  }
  return { tool: createSwitchTool(host), log, switches: () => switches }
}

describe("постановка", () => {
  it("SW-T1: три клавиши у внешней грани над x = 120 — выключатель на грани, один шаг истории, не выделен", () => {
    const s = setup([], 3)
    expect(s.tool.place({ x: 120, y: -20 - NEAR_CM })).toBe(true)
    expect(s.switches()).toEqual([newSwitch("id1", { at: { x: 120, y: -20 }, angle: -90 }, 3)])
    expect(s.log.records).toBe(1)
    expect(s.log.changes).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("SW-T2: призрак — тот же выключатель с числом клавиш из панели", () => {
    const ghost = setup([], 2).tool.ghost({ x: 120, y: -20 - NEAR_CM })
    expect(ghost?.keys).toHaveLength(2)
    expect(ghost?.at).toEqual({ x: 120, y: -20 })
  })

  it("SW-T3: далеко от стены — призрака нет, клик ничего не ставит и шага не создаёт", () => {
    const s = setup()
    expect(s.tool.ghost({ x: 200, y: 150 })).toBeNull()
    expect(s.tool.place({ x: 200, y: 150 })).toBe(false)
    expect(s.switches()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("SW-T4: серия — три клика у граней, три выключателя и три шага", () => {
    const s = setup()
    s.tool.place({ x: 100, y: -20 - NEAR_CM })
    s.tool.place({ x: 100, y: NEAR_CM })
    s.tool.place({ x: 400 - NEAR_CM, y: 150 })
    expect(s.switches()).toHaveLength(3)
    expect(s.log.records).toBe(3)
  })

  it("SW-T5: проём — призрака в нём нет", () => {
    const s = setup([], 1, openingBodies(ROOM, [openingOn("o", "w1", 100, 90)]))
    expect(s.tool.ghost({ x: 120, y: -20 - NEAR_CM })).toBeNull()
    expect(s.tool.place({ x: 200, y: -20 - NEAR_CM })).toBe(true)
  })
})

describe("выделение", () => {
  const one = swAt("a", 120, -20, -90, [["L2"], ["L3"]])

  it("SW-T10: клик по штриху клавиши выделяет выключатель", () => {
    const s = setup([one])
    const hit = s.tool.press(keyPoint(one, 1, "dash"))
    expect(hit?.switch.id).toBe("a")
    expect(s.tool.selectedId()).toBe("a")
  })

  it("SW-T11: повторный клик по уже выделенному сообщает wasSelected, часть и номер клавиши", () => {
    const s = setup([one])
    s.tool.press(keyPoint(one, 0, "circle"))
    const again = s.tool.press(keyPoint(one, 1, "label"))
    expect(again).toMatchObject({ wasSelected: true, hit: { keyIndex: 1, part: "label" } })
  })

  it("SW-T12: клик по пустому месту снимает выделение", () => {
    const s = setup([one])
    s.tool.press(keyPoint(one, 0, "circle"))
    expect(s.tool.press({ x: 300, y: 200 })).toBeNull()
    expect(s.tool.selectedId()).toBeNull()
  })

  it("SW-T13: из совпавших побеждает позже поставленный", () => {
    const upper = swAt("b", 120, -20, -90)
    const s = setup([one, upper])
    expect(s.tool.press(keyPoint(upper, 0, "circle"))?.switch.id).toBe("b")
  })

})

describe("правка", () => {
  it("SW-T20: список линий клавиши — один шаг истории, подпись из имён", () => {
    const s = setup([swAt("a", 120, -20, -90, [["L1"], ["L2"]])])
    expect(s.tool.setKeyLines("a", 1, ["L3", "LV1"])).toBe(true)
    expect(s.switches()[0]?.keys[1]?.lines).toEqual(["L3", "LV1"])
    expect(s.log.records).toBe(1)
  })

  it("SW-T21: тот же список — ничего не меняется, шага нет", () => {
    const s = setup([swAt("a", 120, -20, -90, [["L1"]])])
    expect(s.tool.setKeyLines("a", 0, ["L1"])).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("SW-T22: число клавиш выделенного — один шаг; недопустимое не применяется", () => {
    const one = swAt("a", 120, -20, -90, [["L1"], ["L2"]])
    const s = setup([one])
    s.tool.press(keyPoint(one, 0, "circle"))
    expect(s.tool.setSelectedKeyCount(3)).toBe(true)
    expect(s.switches()[0]?.keys).toHaveLength(3)
    expect(s.log.records).toBe(1)
    expect(s.tool.setSelectedKeyCount(7)).toBe(false)
    expect(s.tool.setSelectedKeyCount(0)).toBe(false)
    expect(s.log.records).toBe(1)
  })

  it("SW-T23: число клавиш без выделения — ничего", () => {
    const s = setup([swAt("a", 120, -20, -90)])
    expect(s.tool.setSelectedKeyCount(2)).toBe(false)
  })
})

describe("перетаскивание", () => {
  it("SW-T30: перенос к грани восточной стены — выключатель там, нормаль повернулась, один шаг", () => {
    const one = swAt("a", 120, -20, -90)
    const s = setup([one])
    expect(s.tool.beginDrag(keyPoint(one, 0, "circle"))).toBe(true)
    s.tool.dragTo({ x: 420 + NEAR_CM, y: 150 })
    expect(s.tool.dragging()).toBe(true)
    expect(s.tool.displayed()[0]?.angle).toBeCloseTo(0, 9)
    expect(s.tool.endDrag()).toBe(true)
    expect(s.switches()[0]?.at.x).toBe(420)
    expect(s.switches()[0]?.at.y).toBe(Math.round(150 + 6 / PX_PER_CM)) // курсор взят за кружок, на 6 px выше центра блока
    expect(s.switches()[0]?.angle).toBeCloseTo(0, 9)
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBe("a")
  })

  it("SW-T31: отпускание там, где призрака нет, ничего не меняет", () => {
    const one = swAt("a", 120, -20, -90)
    const s = setup([one])
    s.tool.beginDrag(keyPoint(one, 0, "circle"))
    s.tool.dragTo({ x: 200, y: 150 })
    expect(s.tool.endDrag()).toBe(false)
    expect(s.switches()).toEqual([one])
    expect(s.log.records).toBe(0)
  })

  it("SW-T32: отпускание без сдвига шага не создаёт", () => {
    const one = swAt("a", 120, -20, -90)
    const s = setup([one])
    const p = keyPoint(one, 0, "circle")
    s.tool.beginDrag(p)
    s.tool.dragTo(p)
    expect(s.tool.endDrag()).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("SW-T33: начать перетаскивание можно только со знака", () => {
    const s = setup([swAt("a", 120, -20, -90)])
    expect(s.tool.beginDrag({ x: 300, y: 200 })).toBe(false)
  })
})

describe("удаление", () => {
  const one = swAt("a", 120, -20, -90)

  it("SW-T40: Delete удаляет выделенный одним шагом", () => {
    const s = setup([one, swAt("b", 300, -20, -90)])
    s.tool.press(keyPoint(one, 0, "circle"))
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.switches().map((x) => x.id)).toEqual(["b"])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("SW-T41: Delete без выделения ничего не удаляет", () => {
    const s = setup([one])
    expect(s.tool.deleteSelected()).toBe(false)
  })

  it("SW-T42: ластик стирает выключатель по знаку, цель подсветки — тот же выключатель", () => {
    const s = setup([one])
    const p = keyPoint(one, 0, "dash")
    expect(s.tool.eraseTarget(p)).toBe("a")
    expect(s.tool.erase(p)).toBe(true)
    expect(s.switches()).toEqual([])
    expect(s.log.records).toBe(1)
  })

  it("SW-T43: ластик по пустому месту ничего не стирает", () => {
    const s = setup([one])
    expect(s.tool.erase({ x: 300, y: 200 })).toBe(false)
    expect(s.tool.eraseTarget({ x: 300, y: 200 })).toBeNull()
  })

  it("SW-T44: сброс выделения", () => {
    const s = setup([one])
    s.tool.press(keyPoint(one, 0, "circle"))
    s.tool.clearSelection()
    expect(s.tool.selectedId()).toBeNull()
  })
})
