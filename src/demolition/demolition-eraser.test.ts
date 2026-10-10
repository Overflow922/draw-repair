import { describe, expect, it } from "vitest"
import type { DemolitionMark, Point, Wall } from "../types"
import { W, idGen, mk, wall } from "./demolition.test-utils"
import { createDemolitionTool } from "./demolition-tool"
import type { DemolitionToolHost } from "./demolition-tool"

// change demolition-doorway-sizes: клик по снесённой области инструментом «Демонтаж» ничего не меняет, а «Ластик»
// плана «Демонтаж» снимает пометки (spec demolition-plan «Инструмент «Демонтаж»», «Ластик на плане «Демонтаж»»;
// design D5). Хост подставной; масштаб экрана 2 px на см. Стена W — (0,0)-(500,0), кирпич, 20 см.

const K = 2
const px = (p: Point): Point => ({ x: p.x * K, y: p.y * K })

interface Setup {
  tool: ReturnType<typeof createDemolitionTool>
  marks: () => DemolitionMark[]
  log: { record: number; set: number; changed: number; redraw: number; order: string[]; recordSaw: DemolitionMark[][] }
}

function setup(opts: { walls?: readonly Wall[]; marks?: DemolitionMark[] } = {}): Setup {
  let marks: DemolitionMark[] = opts.marks ?? []
  const walls = opts.walls ?? [W()]
  const log = { record: 0, set: 0, changed: 0, redraw: 0, order: [] as string[], recordSaw: [] as DemolitionMark[][] }
  const host: DemolitionToolHost = {
    walls: () => walls,
    elements: () => [],
    marks: () => marks,
    setMarks: (next) => {
      marks = next
      log.set++
      log.order.push("set")
    },
    record: () => {
      log.record++
      log.order.push("record")
      log.recordSaw.push(structuredClone(marks))
    },
    changed: () => {
      log.changed++
    },
    redraw: () => {
      log.redraw++
    },
    radiusCm: () => 6,
    newId: idGen(),
  }
  return { tool: createDemolitionTool(host), marks: () => marks, log }
}

const m1 = mk("m1", "W", "a", 100, 190)
const m2 = mk("m2", "W", "a", 300, 400)

describe("клик инструментом «Демонтаж» по снесённой области", () => {
  it("SZ-40: клик по снесённой области ничего не меняет: пометки те же, шага истории нет, up возвращает null", () => {
    const s = setup({ marks: [m1, m2] })
    const p = { x: 150, y: 0 }
    s.tool.down(p, px(p))
    expect(s.tool.up(p, px(p))).toBeNull()
    expect(s.marks()).toEqual([m1, m2])
    expect(s.log).toMatchObject({ record: 0, set: 0, changed: 0 })
  })

  it("SZ-40: клик по снесённой области не меняет выделение: выделенная другая пометка остаётся выделенной", () => {
    const s = setup({ marks: [m1, m2] })
    s.tool.select({ x: 350, y: 0 })
    expect(s.tool.selectedId()).toBe("m2")
    const p = { x: 150, y: 0 }
    s.tool.down(p, px(p))
    s.tool.up(p, px(p))
    expect(s.tool.selectedId()).toBe("m2")
  })

  it("SZ-40: клик по выделенной снесённой области: пометка остаётся и остаётся выделенной", () => {
    const s = setup({ marks: [m1] })
    s.tool.select({ x: 150, y: 0 })
    const p = { x: 150, y: 0 }
    s.tool.down(p, px(p))
    expect(s.tool.up(p, px(p))).toBeNull()
    expect(s.marks()).toEqual([m1])
    expect(s.tool.selectedId()).toBe("m1")
  })

  // TCR-1 (change demolition-drag-only): клик по неснесённой части больше ничего не помечает
  it("SZ-41: клик по неснесённой части стены с пометкой ничего не меняет: пометка m1 та же, шага истории нет", () => {
    const s = setup({ marks: [m1] })
    const p = { x: 400, y: 0 }
    s.tool.down(p, px(p))
    expect(s.tool.up(p, px(p))).toBeNull()
    expect(s.marks()).toEqual([m1])
    expect(s.tool.selectedId()).toBeNull()
    expect(s.log.record).toBe(0)
  })

  it("SZ-40: протяжка внутри снесённой области ничего не меняет (слияние без изменений)", () => {
    const s = setup({ marks: [m1] })
    s.tool.down({ x: 120, y: 0 }, px({ x: 120, y: 0 }))
    s.tool.move({ x: 150, y: 0 }, px({ x: 150, y: 0 }))
    expect(s.tool.up({ x: 170, y: 0 }, px({ x: 170, y: 0 }))).toBeNull()
    expect(s.marks()).toEqual([m1])
    expect(s.log.record).toBe(0)
  })
})

describe("ластик плана «Демонтаж»: erase", () => {
  it("SZ-42: клик ластиком по области сноса удаляет её пометку: одна запись истории до замены, одно сохранение, перерисовка", () => {
    const s = setup({ marks: [m1, m2] })
    expect(s.tool.erase({ x: 150, y: 0 })).toBe(true)
    expect(s.marks()).toEqual([m2])
    expect(s.log).toMatchObject({ record: 1, set: 1 })
    expect(s.log.changed).toBeGreaterThanOrEqual(1)
    expect(s.log.redraw).toBeGreaterThanOrEqual(1)
    expect(s.log.order).toEqual(["record", "set"])
    expect(s.log.recordSaw).toEqual([[m1, m2]])
  })

  it("SZ-42: удаляется именно пометка под точкой, остальные не затронуты", () => {
    const s = setup({ marks: [m1, m2] })
    s.tool.erase({ x: 350, y: 0 })
    expect(s.marks()).toEqual([m1])
  })

  it("SZ-42: удаление последней пометки оставляет пустой список", () => {
    const s = setup({ marks: [m1] })
    expect(s.tool.erase({ x: 150, y: 5 })).toBe(true)
    expect(s.marks()).toEqual([])
  })

  it("SZ-48: серия удалений: каждая пометка — своя запись истории", () => {
    const s = setup({ marks: [m1, m2] })
    s.tool.erase({ x: 150, y: 0 })
    s.tool.erase({ x: 350, y: 0 })
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 2, set: 2 })
    expect(s.log.recordSaw).toEqual([[m1, m2], [m2]])
  })

  it("SZ-43: клик по неснесённой части стены, мимо стены и по пустому месту ничего не удаляет", () => {
    const s = setup({ marks: [m1] })
    for (const p of [{ x: 250, y: 0 }, { x: 150, y: 80 }, { x: -50, y: 0 }]) expect(s.tool.erase(p)).toBe(false)
    expect(s.marks()).toEqual([m1])
    expect(s.log).toMatchObject({ record: 0, set: 0, changed: 0 })
  })

  it("SZ-43: ластик не удаляет стены подложки: список стен не трогается, пометок нет — false", () => {
    const s = setup()
    expect(s.tool.erase({ x: 250, y: 0 })).toBe(false)
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("SZ-43: пометка на железобетонной стене не действует и не удаляется (нет области)", () => {
    const s = setup({ walls: [W("reinforced")], marks: [m1] })
    expect(s.tool.erase({ x: 150, y: 0 })).toBe(false)
    expect(s.marks()).toEqual([m1])
  })

  it("SZ-43: клик ластиком по области на другой стене удаляет пометку этой стены", () => {
    const two = [W(), wall(0, 100, 500, 100, "V")]
    const v = mk("v", "V", "a", 100, 250)
    const s = setup({ walls: two, marks: [m1, v] })
    expect(s.tool.erase({ x: 200, y: 100 })).toBe(true)
    expect(s.marks()).toEqual([m1])
  })
})

describe("ластик плана «Демонтаж»: подсветка и выделение", () => {
  it("SZ-44: eraseTarget — идентификатор пометки под точкой; вне областей сноса — null", () => {
    const s = setup({ marks: [m1, m2] })
    expect(s.tool.eraseTarget({ x: 150, y: 0 })).toBe("m1")
    expect(s.tool.eraseTarget({ x: 350, y: 5 })).toBe("m2")
    expect(s.tool.eraseTarget({ x: 250, y: 0 })).toBeNull()
    expect(s.tool.eraseTarget({ x: 150, y: 80 })).toBeNull()
  })

  it("SZ-44: eraseTarget ничего не меняет и не пишет историю", () => {
    const s = setup({ marks: [m1] })
    s.tool.eraseTarget({ x: 150, y: 0 })
    expect(s.marks()).toEqual([m1])
    expect(s.log).toMatchObject({ record: 0, set: 0, changed: 0 })
  })

  it("SZ-44: после удаления eraseTarget по тому же месту — null", () => {
    const s = setup({ marks: [m1] })
    s.tool.erase({ x: 150, y: 0 })
    expect(s.tool.eraseTarget({ x: 150, y: 0 })).toBeNull()
  })

  it("SZ-45: удаление выделенной пометки снимает выделение", () => {
    const s = setup({ marks: [m1, m2] })
    s.tool.select({ x: 150, y: 0 })
    s.tool.erase({ x: 150, y: 0 })
    expect(s.tool.selectedId()).toBeNull()
  })

  it("SZ-45: удаление другой пометки оставляет выделение", () => {
    const s = setup({ marks: [m1, m2] })
    s.tool.select({ x: 350, y: 0 })
    s.tool.erase({ x: 150, y: 0 })
    expect(s.tool.selectedId()).toBe("m2")
  })

  it("SZ-45: ластик ничего не выделяет: при удалении невыделенной пометки выделения нет", () => {
    const s = setup({ marks: [m1, m2] })
    s.tool.erase({ x: 150, y: 0 })
    expect(s.tool.selectedId()).toBeNull()
  })
})
