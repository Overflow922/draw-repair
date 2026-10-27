import { describe, expect, it } from "vitest"
import { reachBodies } from "../furniture/item-wall-reach"
import { idGen, rectWalls } from "../rough/rough.test-utils"
import type { LightFixture, LightKind, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { createLightTool } from "./light-tool"
import type { LightToolHost } from "./light-tool"

// change add-ceiling-lighting: инструмент «Освещение» — постановка, призрак, выделение, перемещение, Delete, ластик, ввод числа
// (spec ceiling-lighting «Группа «Освещение» и постановка», «Выделение, перемещение и удаление объектов освещения», «Правка
// расстояний освещения на месте»; ceiling-plan «Ластик на плане «Потолки и освещение»»). Помещение — внутренние грани x = 0,
// x = 400, y = 0, y = 300; масштаб просмотра 1 — PX_PER_CM пикселей на см.

const VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } }
const K = PX_PER_CM
const ROOM = (): Wall[] => rectWalls("w", -10, -10, 410, 310)
const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })

function setup(initial: LightFixture[] = [], kind: LightKind = "spot", walls: Wall[] = ROOM()) {
  let lights = initial
  let current = kind
  const log = { records: 0, changed: 0 }
  const placed: LightFixture[] = []
  const host: LightToolHost = {
    bodies: () => reachBodies(walls),
    lights: () => lights,
    setLights: (next) => {
      lights = next
    },
    record: () => {
      log.records++
    },
    changed: () => {
      log.changed++
    },
    redraw: () => {},
    placed: (light) => {
      placed.push(light)
    },
    newId: idGen(),
    kind: () => current,
    view: () => VIEW,
    unit: () => "cm",
    metrics: { labelPx: 14, dimTextGapPx: 1.5 },
  }
  return {
    tool: createLightTool(host),
    log,
    placed,
    lights: () => lights,
    setKind: (k: LightKind) => {
      current = k
    },
  }
}

describe("постановка", () => {
  it("CL-T1: клик ставит светильник с центром, округлённым до целого сантиметра; один шаг истории", () => {
    const s = setup()
    expect(s.tool.place({ x: 100.4, y: 79.6 })).toBe(true)
    expect(s.lights()).toEqual([spot("n1", 100, 80)])
    expect(s.log.records).toBe(1)
  })

  it("CL-T2: серия постановок — три объекта, три шага", () => {
    const s = setup()
    s.tool.place({ x: 50, y: 50 })
    s.tool.place({ x: 150, y: 50 })
    s.tool.place({ x: 250, y: 50 })
    expect(s.lights()).toHaveLength(3)
    expect(s.log.records).toBe(3)
  })

  it("CL-T3: клик по телу стены ничего не ставит; призрака нет", () => {
    const s = setup([], "chandelier")
    expect(s.tool.ghost({ x: -5, y: 150 })).toBeNull()
    expect(s.tool.place({ x: -5, y: 150 })).toBe(false)
    expect(s.log.records).toBe(0)
    expect(s.placed).toEqual([])
  })

  // change line-dropdown (spec light-lines «Линия при постановке»): метку ставит вызывающий, инструмент сообщает о постановке
  it("CL-T3a: после постановки хост получает поставленный светильник; шаг истории при этом один", () => {
    const s = setup()
    s.tool.place({ x: 100, y: 80 })
    expect(s.placed).toEqual([spot("n1", 100, 80)])
    expect(s.log.records).toBe(1)
  })

  it("CL-T4: призрак — объект текущего вида в округлённой точке курсора", () => {
    const s = setup()
    expect(s.tool.ghost({ x: 100.2, y: 80.4 })).toMatchObject({ kind: "spot", x: 100, y: 80 })
  })

  it("CL-T5: бра прилипает к грани в пределах 40 px и не ставится дальше", () => {
    const s = setup([], "sconce")
    const near = { x: 120, y: 20 / K } // 20 px от грани y = 0
    expect(s.tool.ghost(near)).toMatchObject({ kind: "sconce", x: 120, y: 0 })
    expect(s.tool.place(near)).toBe(true)
    expect(s.lights()[0]).toMatchObject({ kind: "sconce", x: 120, y: 0 })
    const placed = s.lights()[0]
    expect(placed?.kind === "sconce" ? placed.angleDeg : null).toBeCloseTo(90, 6)
    expect(s.tool.ghost({ x: 200, y: 150 })).toBeNull()
    expect(s.tool.place({ x: 200, y: 150 })).toBe(false)
  })

  it("CL-T6: клик поверх другого светильника ставит новый", () => {
    const s = setup([spot("a", 100, 80)])
    expect(s.tool.place({ x: 100, y: 80 })).toBe(true)
    expect(s.lights()).toHaveLength(2)
  })
})

describe("выделение", () => {
  it("CL-T10: клик по знаку выделяет; по пустому месту — снимает", () => {
    const s = setup([spot("a", 100, 80)])
    expect(s.tool.select({ x: 101, y: 81 })).toBe(true)
    expect(s.tool.selectedId()).toBe("a")
    expect(s.tool.select({ x: 200, y: 200 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("CL-T11: зона клика — 8 px вокруг центра", () => {
    const s = setup([spot("a", 100, 80)])
    expect(s.tool.symbolAt({ x: 100 + 7.5 / K, y: 80 })?.id).toBe("a")
    expect(s.tool.symbolAt({ x: 100 + 9 / K, y: 80 })).toBeNull()
  })

  it("CL-T12: из совпадающих знаков выше позже поставленный", () => {
    const s = setup([spot("a", 100, 80), spot("b", 101, 80)])
    expect(s.tool.symbolAt({ x: 100.5, y: 80 })?.id).toBe("b")
  })

  it("CL-T13: клик по числу невыделенного объекта выделяет его; число — главнее знака", () => {
    const s = setup([spot("a", 100, 80)])
    const n = s.tool.numbers().find((x) => x.axis === "x")
    if (!n) throw new Error("нет числа")
    const hit = s.tool.press(n.center)
    expect(hit).toEqual({ kind: "number", number: n, wasSelected: false })
    expect(s.tool.selectedId()).toBe("a")
    expect(s.tool.press(n.center)).toMatchObject({ kind: "number", wasSelected: true })
  })

  it("CL-T14: числа у всех объектов, не только у выделенного", () => {
    const s = setup([spot("a", 100, 80), spot("b", 300, 200)])
    expect(s.tool.numbers().map((n) => n.lightId)).toEqual(["a", "a", "b", "b"])
  })
})

describe("перемещение", () => {
  it("CL-T20: перетаскивание (100, 80) → (150, 80): один шаг истории, числа следуют во время перетаскивания", () => {
    const s = setup([spot("a", 100, 80)])
    expect(s.tool.beginDrag({ x: 100, y: 80 })).toBe(true)
    s.tool.dragTo({ x: 150, y: 80 })
    expect(s.tool.displayed()).toEqual([spot("a", 150, 80)])
    expect(s.tool.numbers().find((n) => n.axis === "x")?.text).toBe("150")
    expect(s.lights()).toEqual([spot("a", 100, 80)])
    expect(s.tool.endDrag()).toBe(true)
    expect(s.lights()).toEqual([spot("a", 150, 80)])
    expect(s.log.records).toBe(1)
  })

  it("CL-T21: захват не в центре знака — объект сдвигается на смещение курсора", () => {
    const s = setup([spot("a", 100, 80)])
    s.tool.beginDrag({ x: 102, y: 80 })
    s.tool.dragTo({ x: 152, y: 90 })
    s.tool.endDrag()
    expect(s.lights()).toEqual([spot("a", 150, 90)])
  })

  it("CL-T22: отпускание над телом стены — на прежнем месте, шага нет", () => {
    const s = setup([spot("a", 100, 80)])
    s.tool.beginDrag({ x: 100, y: 80 })
    s.tool.dragTo({ x: -5, y: 80 })
    expect(s.tool.endDrag()).toBe(false)
    expect(s.lights()).toEqual([spot("a", 100, 80)])
    expect(s.log.records).toBe(0)
  })

  it("CL-T23: отпускание без сдвига — шага нет", () => {
    const s = setup([spot("a", 100, 80)])
    s.tool.beginDrag({ x: 100, y: 80 })
    s.tool.dragTo({ x: 100.3, y: 80 })
    expect(s.tool.endDrag()).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("CL-T24: бра скользит по стене: (120, 0) → x = 200", () => {
    const b: LightFixture = { id: "b", kind: "sconce", x: 120, y: 0, angleDeg: 90 }
    const s = setup([b], "spot")
    s.tool.beginDrag({ x: 120, y: 2 })
    s.tool.dragTo({ x: 200, y: 5 })
    expect(s.tool.endDrag()).toBe(true)
    expect(s.lights()[0]).toMatchObject({ x: 200, y: 0 })
    expect(s.tool.numbers()[0]?.text).toBe("200")
  })

  it("CL-T25: нажатие мимо знаков не начинает перетаскивание", () => {
    const s = setup([spot("a", 100, 80)])
    expect(s.tool.beginDrag({ x: 200, y: 200 })).toBe(false)
  })
})

describe("удаление и ввод", () => {
  it("CL-T30: Delete удаляет выделенный одним шагом", () => {
    const s = setup([spot("a", 100, 80)])
    s.tool.select({ x: 100, y: 80 })
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.lights()).toEqual([])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("CL-T31: ластик по знаку удаляет объект; по числу и по пустому месту — ничего", () => {
    const s = setup([spot("a", 100, 80)])
    const n = s.tool.numbers()[0]
    if (!n) throw new Error("нет числа")
    expect(s.tool.numberAt(n.center)).toEqual(n) // по числу ластик не стирает и потолок под ним
    expect(s.tool.eraseTarget(n.center)).toBeNull()
    expect(s.tool.erase(n.center)).toBe(false)
    expect(s.tool.erase({ x: 300, y: 250 })).toBe(false)
    expect(s.tool.eraseTarget({ x: 100, y: 80 })).toBe("a")
    expect(s.tool.erase({ x: 100, y: 80 })).toBe(true)
    expect(s.lights()).toEqual([])
    expect(s.log.records).toBe(1)
  })

  it("CL-T32: ввод расстояния 60 — центр (60, 80), один шаг; недопустимое — без шага", () => {
    const s = setup([spot("a", 100, 80)])
    expect(s.tool.setDistance("a", "x", 60)).toBe(true)
    expect(s.lights()).toEqual([spot("a", 60, 80)])
    expect(s.tool.setDistance("a", "x", -5)).toBe(false)
    expect(s.tool.setDistance("a", "x", 405)).toBe(false)
    expect(s.log.records).toBe(1)
  })
})
