import { describe, expect, it } from "vitest"
import { drawing, idGen, rectWalls } from "../rough/rough.test-utils"
import type { Drawing, FurnitureItem, StretchCeiling } from "../types"
import { ceilingScene } from "./ceiling-scene"
import { createCeilingTool } from "./ceiling-tool"
import type { CeilingToolHost } from "./ceiling-tool"

// change add-ceiling-plan: инструмент «Натяжной потолок» — клик в помещении, выделение по подписи, опускание, ластик
// (spec ceiling-plan «Инструмент «Натяжной потолок»», «Подпись натяжного потолка и правка на месте», «Ластик на плане»)

const NONE: StretchCeiling[] = []
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const ceiling = (id: string, x: number, y: number, dropMm = 50): StretchCeiling => ({ id, at: { x, y }, dropMm })
const table: FurnitureItem = { id: "t", kind: "table", x: 100, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 0 }

function setup(initial: Drawing, dropMm = 50, view = VIEW) {
  let d = initial
  const log = { records: 0 }
  const host: CeilingToolHost = {
    scene: () => ceilingScene(d),
    ceilings: () => d.ceiling?.ceilings ?? NONE,
    setCeilings: (next) => {
      d = { ...d, ceiling: { ...(d.ceiling ?? {}), ceilings: next } }
    },
    record: () => {
      log.records++
    },
    changed: () => {},
    redraw: () => {},
    newId: idGen(),
    newDropMm: () => dropMm,
    view: () => view,
    labelPx: 14,
  }
  return { tool: createCeilingTool(host), log, ceilings: () => d.ceiling?.ceilings ?? [], drawing: () => d }
}

// комната 4×5 м: внутренняя область [10,410]×[10,510]
const ONE = (extra: Partial<Drawing> = {}): Drawing => ({ ...drawing({ walls: rectWalls("k", 0, 0, 420, 520) }), ...extra })
const withCeiling = (dropMm = 50, view = VIEW) =>
  setup(ONE({ ceiling: { ceilings: [ceiling("c", 200, 260, dropMm)] }, furniture: { items: [table], dimensions: [] } }), 50, view)

describe("постановка кликом", () => {
  it("CP-80: клик в помещении ставит потолок в точке клика с опусканием из панели; один шаг истории", () => {
    const s = setup(ONE())
    expect(s.tool.place({ x: 210, y: 270 })).toBe(true)
    expect(s.ceilings()).toEqual([ceiling("n1", 210, 270, 50)])
    expect(s.log.records).toBe(1)
  })

  it("CP-81: значение из панели 450 — потолок с опусканием 450", () => {
    const s = setup(ONE(), 450)
    s.tool.place({ x: 210, y: 270 })
    expect(s.ceilings()[0]?.dropMm).toBe(450)
  })

  it("CP-82: повторный клик в помещении с действующим потолком ничего не меняет", () => {
    const s = withCeiling()
    expect(s.tool.place({ x: 100, y: 400 })).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("CP-83: клик вне помещений и по телу стены ничего не меняет", () => {
    const s = setup(ONE())
    expect(s.tool.place({ x: 700, y: 270 })).toBe(false)
    expect(s.tool.place({ x: 5, y: 270 })).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("CP-84: клик по столу в помещении без потолка ставит потолок; стол не изменён", () => {
    const s = setup(ONE({ furniture: { items: [table], dimensions: [] } }))
    expect(s.tool.place({ x: 100, y: 100 })).toBe(true)
    expect(s.ceilings()).toEqual([ceiling("n1", 100, 100, 50)])
    expect(s.drawing().furniture?.items).toEqual([table])
  })

  it("CP-85: серия постановок в двух помещениях — два шага; поставленный потолок не выделяется", () => {
    const d = drawing({ walls: [...rectWalls("k", 0, 0, 420, 320), { id: "p", a: { x: 200, y: 0 }, b: { x: 200, y: 320 }, thicknessCm: 20, type: "brick" }] })
    const s = setup(d)
    expect(s.tool.place({ x: 100, y: 160 })).toBe(true)
    expect(s.tool.place({ x: 300, y: 160 })).toBe(true)
    expect(s.ceilings()).toHaveLength(2)
    expect(s.log.records).toBe(2)
    expect(s.tool.selectedId()).toBeNull()
  })
})

describe("выделение по подписи и правка", () => {
  it("CP-86: клик по подписи выделяет потолок; клик по заливке вдали от подписи — нет", () => {
    const s = withCeiling()
    expect(s.tool.labelAt({ x: 200, y: 260 })?.id).toBe("c")
    expect(s.tool.select({ x: 300, y: 450 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
    expect(s.tool.select({ x: 200, y: 260 })).toBe(true)
    expect(s.tool.selectedId()).toBe("c")
    expect(s.tool.selected()?.dropMm).toBe(50)
  })

  it("CP-87: подпись — область постоянного экранного размера по тексту «-50мм»", () => {
    const s = withCeiling()
    // «-50мм» — 5 знаков при кегле 14: рамка шириной 5·14·0,6 + 2·0,4·14 ≈ 53 px, полуширина ≈ 27 px
    // zoom 1 (2 px/см): 5 см от центра = 10 px — внутри, 30 см = 60 px — снаружи
    expect(s.tool.labelAt({ x: 205, y: 262 })?.id).toBe("c")
    expect(s.tool.labelAt({ x: 230, y: 260 })).toBeNull()
    // zoom 4 (8 px/см): те же 5 см = 40 px — уже снаружи: размер рамки экранный, не зависит от масштаба
    expect(withCeiling(50, { zoom: 4, pan: { x: 0, y: 0 } }).tool.labelAt({ x: 205, y: 260 })).toBeNull()
    // «-450мм» шире «-50мм» (полуширина ≈ 31 px): 15 см от центра (30 px) внутри только у длинной подписи
    expect(withCeiling(450).tool.labelAt({ x: 215, y: 260 })?.id).toBe("c")
    expect(withCeiling(50).tool.labelAt({ x: 215, y: 260 })).toBeNull()
  })

  it("CP-88: правка по месту — один шаг; то же значение шага не создаёт", () => {
    const s = withCeiling()
    expect(s.tool.setDropOf("c", 80)).toBe(true)
    expect(s.ceilings()[0]?.dropMm).toBe(80)
    expect(s.log.records).toBe(1)
    expect(s.tool.setDropOf("c", 80)).toBe(false)
    expect(s.log.records).toBe(1)
  })

  it("CP-89: правка опускания выделенного потолка в панели — один шаг; без выделения — ничего", () => {
    const s = withCeiling()
    expect(s.tool.setSelectedDrop(70)).toBe(false)
    s.tool.select({ x: 200, y: 260 })
    expect(s.tool.setSelectedDrop(70)).toBe(true)
    expect(s.ceilings()[0]?.dropMm).toBe(70)
    expect(s.log.records).toBe(1)
  })

  it("CP-90: Delete удаляет выделенный потолок одним шагом; без выделения — ничего", () => {
    const s = withCeiling()
    expect(s.tool.deleteSelected()).toBe(false)
    s.tool.select({ x: 200, y: 260 })
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.ceilings()).toEqual([])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })
})

describe("ластик", () => {
  it("CP-91: ластик стирает потолок по подписи и по заливке, одним шагом", () => {
    const byLabel = withCeiling()
    expect(byLabel.tool.eraseTarget({ x: 200, y: 260 })).toBe("c")
    expect(byLabel.tool.erase({ x: 200, y: 260 })).toBe(true)
    expect(byLabel.ceilings()).toEqual([])
    const byFill = withCeiling()
    expect(byFill.tool.erase({ x: 350, y: 450 })).toBe(true)
    expect(byFill.log.records).toBe(1)
  })

  it("CP-92: ластик по столу в помещении с потолком стирает потолок, стол остаётся", () => {
    const s = withCeiling()
    expect(s.tool.erase({ x: 100, y: 100 })).toBe(true)
    expect(s.ceilings()).toEqual([])
    expect(s.drawing().furniture?.items).toEqual([table])
  })

  it("CP-93: ластик по телу стены и вне помещений ничего не стирает; спящий потолок не цель", () => {
    const s = setup(ONE({ ceiling: { ceilings: [ceiling("c", 200, 260), ceiling("out", 900, 900)] } }))
    expect(s.tool.erase({ x: 5, y: 270 })).toBe(false)
    expect(s.tool.erase({ x: 700, y: 270 })).toBe(false)
    expect(s.tool.eraseTarget({ x: 900, y: 900 })).toBeNull()
    expect(s.ceilings()).toHaveLength(2)
    expect(s.log.records).toBe(0)
  })

  it("CP-94: ластик снимает выделение стёртого потолка", () => {
    const s = withCeiling()
    s.tool.select({ x: 200, y: 260 })
    s.tool.erase({ x: 200, y: 260 })
    expect(s.tool.selectedId()).toBeNull()
  })
})
