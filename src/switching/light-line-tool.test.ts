import { describe, expect, it } from "vitest"
import { LIGHT_SYMBOL_PX_PER_MM } from "../ceiling/light-symbol"
import type { LightFixture, LightLine, View } from "../types"
import { PX_PER_CM } from "../types"
import { lineLabelBox } from "./light-line-label"
import { createLightLineTool } from "./light-line-tool"
import type { LightLineToolHost } from "./light-line-tool"

// change add-light-lines: инструмент «Линия освещения» — постановка, выделение по тексту, правка, удаление
// (spec light-lines «Инструмент «Линия освещения»», «Панель инструмента «Линия освещения»», «Выделение, правка и удаление метки»;
// switching-plan «Ластик на плане «Группы включения»»)

const VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } }
const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })
const LIGHTS: LightFixture[] = [spot("a", 100, 80), spot("b", 200, 80), { id: "ds", kind: "smoke-detector", x: 300, y: 80 }, { id: "x", kind: "chandelier", x: 100, y: 200 }]

// центр текста метки светильника в точке (x, y) см при zoom 1
const textPoint = (x: number, y: number, name = "L3") => {
  const box = lineLabelBox({ x: x * PX_PER_CM, y: y * PX_PER_CM }, name, LIGHT_SYMBOL_PX_PER_MM)
  return { x: (box.x + box.w / 2) / PX_PER_CM, y: (box.y + box.h / 2) / PX_PER_CM }
}

function setup(initial: LightLine[] = [], name = "L3", lights: LightFixture[] = LIGHTS) {
  let lines = initial
  let n = 0
  const log = { records: 0, changes: 0 }
  const host: LightLineToolHost = {
    lines: () => lines,
    lights: () => lights,
    setLines: (next) => {
      lines = next
    },
    record: () => {
      log.records++
    },
    changed: () => {
      log.changes++
    },
    redraw: () => {},
    newId: () => "id" + String(++n),
    newName: () => name,
    view: () => VIEW,
    unitsPerMm: LIGHT_SYMBOL_PX_PER_MM,
  }
  return { tool: createLightLineTool(host), log, lines: () => lines }
}

const line = (id: string, targetId: string, name = "L3"): LightLine => ({ id, targetId, name })

describe("постановка метки", () => {
  it("LL-50: клик по светильнику ставит метку с именем из панели, один шаг истории", () => {
    const s = setup([], "L4")
    expect(s.tool.place({ x: 100, y: 80 })).toBe(true)
    expect(s.lines()).toEqual([line("id1", "a", "L4")])
    expect(s.log.records).toBe(1)
    expect(s.log.changes).toBe(1)
  })

  it("LL-51: серия — пять светильников, пять шагов, поставленная метка не выделяется", () => {
    const five = ["a", "b", "c", "d", "e"].map((id, i) => spot(id, 50 + i * 40, 300))
    const s = setup([], "L3", five)
    for (const l of five) s.tool.place({ x: l.x, y: l.y })
    expect(s.lines().map((l) => l.name)).toEqual(["L3", "L3", "L3", "L3", "L3"])
    expect(s.log.records).toBe(5)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("LL-52: замена имени — метка одна, шаг один", () => {
    const s = setup([line("m", "a", "L3")], "L5")
    expect(s.tool.place({ x: 100, y: 80 })).toBe(true)
    expect(s.lines()).toEqual([line("m", "a", "L5")])
    expect(s.log.records).toBe(1)
  })

  it("LL-53: повторный клик с тем же именем шага не создаёт", () => {
    const s = setup([line("m", "a", "L3")], "L3")
    expect(s.tool.place({ x: 100, y: 80 })).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("LL-54: клик по датчику и по пустому месту ничего не ставит", () => {
    const s = setup()
    expect(s.tool.place({ x: 300, y: 80 })).toBe(false)
    expect(s.tool.place({ x: 600, y: 600 })).toBe(false)
    expect(s.lines()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("LL-55: при совпадении зон побеждает позже поставленный светильник", () => {
    const s = setup([], "L3", [spot("old", 100, 80), spot("new", 101, 80)])
    s.tool.place({ x: 100, y: 80 })
    expect(s.lines()[0]?.targetId).toBe("new")
  })

  it("LL-56: наведение подсвечивает светильник, который несёт метку", () => {
    const s = setup()
    expect(s.tool.hoverTarget({ x: 100, y: 80 })).toBe("a")
    expect(s.tool.hoverTarget({ x: 300, y: 80 })).toBeNull()
    expect(s.tool.hoverTarget({ x: 600, y: 600 })).toBeNull()
  })
})

describe("выделение и правка", () => {
  it("LL-60: клик по тексту выделяет метку, клик по знаку — нет", () => {
    const s = setup([line("m", "a")])
    expect(s.tool.select({ x: 100, y: 80 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
    expect(s.tool.select(textPoint(100, 80))).toBe(true)
    expect(s.tool.selectedId()).toBe("m")
    expect(s.tool.selected()?.name).toBe("L3")
  })

  it("LL-61: клик по пустому месту снимает выделение", () => {
    const s = setup([line("m", "a")])
    s.tool.select(textPoint(100, 80))
    expect(s.tool.select({ x: 600, y: 600 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("LL-62: правка в панели меняет имя выделенной метки одним шагом", () => {
    const s = setup([line("m", "a")])
    s.tool.select(textPoint(100, 80))
    expect(s.tool.setSelectedName("L9")).toBe(true)
    expect(s.lines()).toEqual([line("m", "a", "L9")])
    expect(s.log.records).toBe(1)
  })

  it("LL-63: то же имя — шага нет; без выделения правка ничего не делает", () => {
    const s = setup([line("m", "a")])
    expect(s.tool.setSelectedName("L9")).toBe(false)
    s.tool.select(textPoint(100, 80))
    expect(s.tool.setSelectedName("L3")).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("LL-64: правка на месте по id", () => {
    const s = setup([line("m", "a")])
    expect(s.tool.setNameOf("m", "L8")).toBe(true)
    expect(s.lines()[0]?.name).toBe("L8")
    expect(s.log.records).toBe(1)
  })

  it("LL-65: Delete удаляет выделенную метку одним шагом, светильник остаётся", () => {
    const s = setup([line("m", "a"), line("n", "b")])
    s.tool.select(textPoint(100, 80))
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.lines()).toEqual([line("n", "b")])
    expect(s.tool.selectedId()).toBeNull()
    expect(s.log.records).toBe(1)
    expect(s.tool.deleteSelected()).toBe(false)
  })

  it("LL-66: метки светильника, которого нет, не выделяются", () => {
    const s = setup([line("m", "gone")])
    expect(s.tool.select(textPoint(100, 80))).toBe(false)
  })
})

describe("ластик", () => {
  it("LL-70: удаляет метку под текстом, светильник остаётся", () => {
    const s = setup([line("m", "a")])
    expect(s.tool.eraseTarget(textPoint(100, 80))).toBe("m")
    expect(s.tool.erase(textPoint(100, 80))).toBe(true)
    expect(s.lines()).toEqual([])
    expect(s.log.records).toBe(1)
  })

  it("LL-71: клик по знаку и по пустому месту ничего не удаляет", () => {
    const s = setup([line("m", "a")])
    expect(s.tool.erase({ x: 100, y: 80 })).toBe(false)
    expect(s.tool.erase({ x: 600, y: 600 })).toBe(false)
    expect(s.tool.eraseTarget({ x: 100, y: 80 })).toBeNull()
    expect(s.lines()).toHaveLength(1)
  })
})
