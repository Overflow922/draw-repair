import { describe, expect, it } from "vitest"
import type { Drawing, Screed } from "../types"
import { createScreedTool } from "./screed-tool"
import type { ScreedToolHost } from "./screed-tool"
import { roughScene } from "./rough-scene"
import { drawing, idGen, rectWalls, screed } from "./rough.test-utils"

// change add-rough-works-plan: инструмент «Стяжка» — клик в помещении, выделение по подписи, толщина, ластик
// (spec rough-works-plan «Инструмент «Стяжка»», «Подпись стяжки и правка на месте», «Ластик на плане «Черновые работы»»)

const NONE: Screed[] = []
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }

function setup(initial: Drawing, thicknessMm = 65) {
  let d = initial
  const log = { records: 0 }
  const host: ScreedToolHost = {
    scene: () => roughScene(d),
    screeds: () => d.roughScreeds ?? NONE,
    setScreeds: (next) => {
      d = { ...d, roughScreeds: next }
    },
    record: () => {
      log.records++
    },
    changed: () => {},
    redraw: () => {},
    newId: idGen(),
    newThicknessMm: () => thicknessMm,
    view: () => VIEW,
    labelPx: 14,
  }
  return { tool: createScreedTool(host), log, screeds: () => d.roughScreeds ?? [] }
}

// комната 4×5 м: внутренняя область [10,410]×[10,510]; две комнаты — перегородка по x = 200 у комнаты 420×320
const ONE = (): Drawing => drawing({ walls: rectWalls("k", 0, 0, 420, 520) })

describe("постановка кликом", () => {
  it("RW-180: клик в помещении ставит стяжку в точке клика с толщиной из панели; один шаг истории", () => {
    const s = setup(ONE())
    expect(s.tool.place({ x: 210, y: 270 })).toBe(true)
    expect(s.screeds()).toEqual([screed("n1", 210, 270, 65)])
    expect(s.log.records).toBe(1)
  })

  it("RW-181: повторный клик в помещении с действующей стяжкой ничего не меняет", () => {
    const s = setup(drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughScreeds: [screed("s", 200, 260)] }))
    expect(s.tool.place({ x: 100, y: 100 })).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("RW-182: клик вне помещений и по телу стены ничего не меняет", () => {
    const s = setup(ONE())
    expect(s.tool.place({ x: 700, y: 270 })).toBe(false)
    expect(s.tool.place({ x: 5, y: 270 })).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("RW-183: серия постановок: две стяжки в двух помещениях, два шага истории", () => {
    const d = drawing({ walls: [...rectWalls("k", 0, 0, 420, 320), { id: "p", a: { x: 200, y: 0 }, b: { x: 200, y: 320 }, thicknessCm: 20, type: "brick" }] })
    const s = setup(d)
    expect(s.tool.place({ x: 100, y: 160 })).toBe(true)
    expect(s.tool.place({ x: 300, y: 160 })).toBe(true)
    expect(s.screeds()).toHaveLength(2)
    expect(s.log.records).toBe(2)
  })

  it("RW-184: поставленная стяжка не выделяется автоматически", () => {
    const s = setup(ONE())
    s.tool.place({ x: 210, y: 270 })
    expect(s.tool.selectedId()).toBeNull()
  })
})

describe("выделение по подписи и правка", () => {
  const withScreed = () => setup(drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughScreeds: [screed("s", 200, 260, 65)] }))

  it("RW-190: клик по подписи выделяет стяжку; клик по штриховке помещения вдали от подписи — нет", () => {
    const s = withScreed()
    expect(s.tool.labelAt({ x: 200, y: 260 })?.id).toBe("s")
    expect(s.tool.select({ x: 100, y: 100 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
    expect(s.tool.select({ x: 200, y: 260 })).toBe(true)
    expect(s.tool.selectedId()).toBe("s")
  })

  it("RW-191: подпись — область постоянного экранного размера: при другом масштабе просмотра попадание считается в пикселях", () => {
    const s = withScreed()
    // рамка подписи шириной около 80 px при zoom 1 (k = 2 px/см): за 60 см от центра по x — вне рамки
    expect(s.tool.labelAt({ x: 260, y: 260 })).toBeNull()
  })

  it("RW-192: правка толщины по месту — один шаг, отмена возможна через историю; то же значение шага не создаёт", () => {
    const s = withScreed()
    expect(s.tool.setThicknessOf("s", 80)).toBe(true)
    expect(s.screeds()[0]?.thicknessMm).toBe(80)
    expect(s.log.records).toBe(1)
    expect(s.tool.setThicknessOf("s", 80)).toBe(false)
    expect(s.log.records).toBe(1)
  })

  it("RW-193: правка толщины выделенной стяжки в панели — один шаг", () => {
    const s = withScreed()
    s.tool.select({ x: 200, y: 260 })
    expect(s.tool.setSelectedThickness(70)).toBe(true)
    expect(s.screeds()[0]?.thicknessMm).toBe(70)
    expect(s.log.records).toBe(1)
  })

  it("RW-194: Delete удаляет выделенную стяжку одним шагом; без выделения — ничего", () => {
    const s = withScreed()
    expect(s.tool.deleteSelected()).toBe(false)
    s.tool.select({ x: 200, y: 260 })
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.screeds()).toEqual([])
    expect(s.log.records).toBe(1)
  })
})

describe("ластик", () => {
  const withScreed = () => setup(drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughScreeds: [screed("s", 200, 260, 65)] }))

  it("RW-200: ластик стирает стяжку по подписи и по штриховке помещения", () => {
    const byLabel = withScreed()
    expect(byLabel.tool.eraseTarget({ x: 200, y: 260 })).toBe("s")
    expect(byLabel.tool.erase({ x: 200, y: 260 })).toBe(true)
    const byHatch = withScreed()
    expect(byHatch.tool.erase({ x: 100, y: 100 })).toBe(true)
    expect(byHatch.screeds()).toEqual([])
    expect(byHatch.log.records).toBe(1)
  })

  it("RW-201: ластик по телу стены и вне помещений ничего не стирает", () => {
    const s = withScreed()
    expect(s.tool.erase({ x: 5, y: 270 })).toBe(false)
    expect(s.tool.erase({ x: 700, y: 270 })).toBe(false)
    expect(s.screeds()).toHaveLength(1)
    expect(s.log.records).toBe(0)
  })
})
