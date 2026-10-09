import { describe, expect, it } from "vitest"
import type { DemolitionMark, Point, Wall, WallElement } from "../types"
import { W, deepFreeze, door_, idGen, mk, wall } from "./demolition.test-utils"
import { createDemolitionTool } from "./demolition-tool"
import type { DemolitionToolHost } from "./demolition-tool"

// change demolition-plan: жесты инструмента «Демонтаж», выделение и правка чисел через подставной хост
// (spec demolition-plan «Инструмент «Демонтаж»», «Выделение пометки и правка чисел на месте»; design D10).
// Масштаб экрана 2 px на см (zoom 1): экранная точка — мировая точка × 2. Стена W — (0,0)-(500,0), кирпич, 20 см.

const K = 2
const px = (p: Point): Point => ({ x: p.x * K, y: p.y * K })

interface Setup {
  tool: ReturnType<typeof createDemolitionTool>
  marks: () => DemolitionMark[]
  log: { record: number; set: number; changed: number; redraw: number; order: string[]; recordSaw: DemolitionMark[][]; changedSaw: DemolitionMark[][] }
  host: DemolitionToolHost
}

function setup(opts: { walls?: readonly Wall[]; elements?: readonly WallElement[]; marks?: DemolitionMark[]; radius?: number } = {}): Setup {
  let marks: DemolitionMark[] = opts.marks ?? []
  const walls = opts.walls ?? [W()]
  const elements = opts.elements ?? []
  const log = { record: 0, set: 0, changed: 0, redraw: 0, order: [] as string[], recordSaw: [] as DemolitionMark[][], changedSaw: [] as DemolitionMark[][] }
  const host: DemolitionToolHost = {
    walls: () => walls,
    elements: () => elements,
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
    // changed() сохраняет чертёж: к этому моменту хост уже должен видеть новые пометки
    changed: () => {
      log.changed++
      log.changedSaw.push(structuredClone(marks))
    },
    redraw: () => {
      log.redraw++
    },
    radiusCm: () => opts.radius ?? 6,
    newId: idGen(),
  }
  return { tool: createDemolitionTool(host), marks: () => marks, log, host }
}

const click = (s: Setup, p: Point): void => {
  s.tool.down(p, px(p))
  s.tool.up(p, px(p))
}

// протяжка: нажатие в a, ходы к b (экранный сдвиг больше мёртвой зоны), отпускание в b
const drag = (s: Setup, a: Point, b: Point): void => {
  s.tool.down(a, px(a))
  s.tool.move({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, px({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }))
  s.tool.move(b, px(b))
  s.tool.up(b, px(b))
}

describe("клик: пометка и снятие пометки", () => {
  it("TL-01: клик по телу стены помечает её целиком: 0–500, одна запись истории, один шаг сохранения", () => {
    const s = setup()
    click(s, { x: 250, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
    expect(s.log.record).toBe(1)
    expect(s.log.set).toBe(1)
    expect(s.log.changed).toBeGreaterThanOrEqual(1)
  })

  it("TL-01: запись истории идёт до замены пометок", () => {
    const s = setup()
    click(s, { x: 250, y: 0 })
    expect(s.log.order).toEqual(["record", "set"])
  })

  it("TL-01: запись истории видит прежние пометки, а changed() (сохранение чертежа) — уже новые", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)] })
    click(s, { x: 400, y: 0 }) // вся стена поглощает m1
    expect(s.log.recordSaw).toEqual([[mk("m1", "W", "a", 100, 190)]])
    expect(s.log.changedSaw).toEqual([[mk("m1", "W", "a", 0, 500)]])
  })

  it("TL-01: после изменения вызывается перерисовка", () => {
    const s = setup()
    click(s, { x: 250, y: 0 })
    expect(s.log.redraw).toBeGreaterThanOrEqual(1)
  })

  it("TL-01: клик рядом с телом стены (в радиусе привязки, 3 см от грани) тоже помечает", () => {
    const s = setup()
    click(s, { x: 250, y: 13 })
    expect(s.marks()).toHaveLength(1)
  })

  // TCR-5 (change demolition-doorway-sizes): клик по снесённой области больше не снимает пометку (снимает «Ластик»)
  it("TL-02: повторный клик по снесённой области ничего не меняет: пометки те же, шага истории нет", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190), mk("m2", "W", "a", 300, 400)] })
    click(s, { x: 150, y: 0 })
    expect(s.marks()).toEqual([mk("m1", "W", "a", 100, 190), mk("m2", "W", "a", 300, 400)])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-02: клик по неснесённой части стены с другими пометками помечает всю стену и поглощает их", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)] })
    click(s, { x: 400, y: 0 })
    expect(s.marks()).toEqual([mk("m1", "W", "a", 0, 500)])
    expect(s.log.record).toBe(1)
  })

  it("TL-08: клик мимо стен и областей ничего не меняет и не пишет историю", () => {
    const s = setup()
    click(s, { x: 250, y: 200 })
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-08: нажатие мимо стены и движение/отпускание не создают пометку", () => {
    const s = setup()
    s.tool.down({ x: 250, y: 200 }, px({ x: 250, y: 200 }))
    s.tool.move({ x: 350, y: 200 }, px({ x: 350, y: 200 }))
    s.tool.up({ x: 350, y: 200 }, px({ x: 350, y: 200 }))
    expect(s.marks()).toEqual([])
    expect(s.tool.ghost()).toBeNull()
    expect(s.log.record).toBe(0)
  })

  it("TL-08: отпускание без нажатия ничего не делает", () => {
    const s = setup()
    expect(() => s.tool.up({ x: 100, y: 0 }, px({ x: 100, y: 0 }))).not.toThrow()
    expect(s.log.record).toBe(0)
  })

  it("TL-09: железобетонная стена не помечается кликом: ничего не меняется, шага нет", () => {
    const s = setup({ walls: [W("reinforced")] })
    click(s, { x: 250, y: 0 })
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-09: железобетонная стена не помечается протяжкой", () => {
    const s = setup({ walls: [W("reinforced")] })
    drag(s, { x: 100, y: 0 }, { x: 190, y: 0 })
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })
})

describe("протяжка", () => {
  it("TL-03: нажатие в x = 100 и отпускание в x = 190 помечает участок 100–190 (ширина 90)", () => {
    const s = setup({ radius: 1 })
    drag(s, { x: 100, y: 0 }, { x: 190, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 190)])
    expect(s.log.record).toBe(1)
  })

  it("TL-03: протяжка справа налево даёт тот же участок", () => {
    const s = setup({ radius: 1 })
    drag(s, { x: 190, y: 0 }, { x: 100, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 190)])
  })

  it("TL-04: протяжка вне оси проецируется на ось нажатой стены: (100, 5) → (190, 80) даёт 100–190", () => {
    const s = setup({ radius: 1 })
    drag(s, { x: 100, y: 5 }, { x: 190, y: 80 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 190)])
  })

  it("TL-05: протяжка за конец стены обрезается: 400 → 700 даёт 400–500", () => {
    const s = setup({ radius: 1 })
    drag(s, { x: 400, y: 0 }, { x: 700, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "b", 0, 100)])
  })

  it("TL-05: протяжка за начало стены обрезается: 100 → −300 даёт 0–100", () => {
    const s = setup({ radius: 1 })
    drag(s, { x: 100, y: 0 }, { x: -300, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 100)])
  })

  it("TL-10: превью во время протяжки — участок от конца a по возрастанию, после отпускания превью нет", () => {
    const s = setup({ radius: 1 })
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.ghost()).toBeNull()
    s.tool.down({ x: 190, y: 0 }, px({ x: 190, y: 0 }))
    expect(s.tool.ghost()).toBeNull()
    s.tool.move({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    expect(s.tool.dragging()).toBe(true)
    expect(s.tool.ghost()).toEqual({ wallId: "W", from: 100, to: 190 })
    s.tool.up({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.ghost()).toBeNull()
  })

  it("TL-10: превью обновляется при движении", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.move({ x: 150, y: 0 }, px({ x: 150, y: 0 }))
    expect(s.tool.ghost()).toEqual({ wallId: "W", from: 100, to: 150 })
    s.tool.move({ x: 210, y: 0 }, px({ x: 210, y: 0 }))
    expect(s.tool.ghost()).toEqual({ wallId: "W", from: 100, to: 210 })
  })

  it("TL-10: движение за мёртвую зону перерисовывает холст (превью); движение внутри мёртвой зоны — нет необходимости", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
    const before = s.log.redraw
    s.tool.move({ x: 105, y: 0 }, { x: 205, y: 0 })
    expect(s.log.redraw).toBeGreaterThan(before)
  })

  it("TL-07: Escape во время протяжки перерисовывает холст (превью исчезает)", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
    s.tool.move({ x: 190, y: 0 }, { x: 380, y: 0 })
    const before = s.log.redraw
    s.tool.cancel()
    expect(s.log.redraw).toBeGreaterThan(before)
  })

  it("TL-10: превью без изменения данных: пока протяжка не завершена, пометки и история не затронуты", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.move({ x: 190, y: 0 }, px({ x: 190, y: 0 }))
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-07: Escape во время протяжки отменяет её: превью нет, отпускание ничего не создаёт", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.move({ x: 190, y: 0 }, px({ x: 190, y: 0 }))
    s.tool.cancel()
    expect(s.tool.ghost()).toBeNull()
    expect(s.tool.dragging()).toBe(false)
    s.tool.up({ x: 190, y: 0 }, px({ x: 190, y: 0 }))
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-07: после Escape новый жест работает как обычно", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.move({ x: 190, y: 0 }, px({ x: 190, y: 0 }))
    s.tool.cancel()
    drag(s, { x: 300, y: 0 }, { x: 350, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "b", 150, 200)])
  })

  it("TL-07: Escape без жеста безвреден", () => {
    const s = setup()
    expect(() => s.tool.cancel()).not.toThrow()
    expect(s.log.record).toBe(0)
  })

  it("TL-21: протяжка, начатая внутри снесённой области, расширяет пометку, а не снимает её", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)], radius: 1 })
    drag(s, { x: 150, y: 0 }, { x: 300, y: 0 })
    expect(s.marks()).toEqual([mk("m1", "W", "a", 100, 300)])
    expect(s.log.record).toBe(1)
  })

  it("TL-11: протяжка внутри уже снесённого участка ничего не меняет: ни записи истории, ни замены пометок", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 300)], radius: 1 })
    drag(s, { x: 150, y: 0 }, { x: 200, y: 0 })
    expect(s.marks()).toEqual([mk("m1", "W", "a", 100, 300)])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-11: каждая операция — ровно одна запись истории: пометка, снятие (ластик), протяжка", () => {
    const s = setup({ radius: 1 })
    click(s, { x: 250, y: 0 })
    expect(s.log.record).toBe(1)
    s.tool.erase({ x: 250, y: 0 })
    expect(s.log.record).toBe(2)
    drag(s, { x: 100, y: 0 }, { x: 190, y: 0 })
    expect(s.log.record).toBe(3)
    expect(s.log.set).toBe(3)
    expect(s.log.order).toEqual(["record", "set", "record", "set", "record", "set"])
  })

  it("TL-12: стены и элементы обмерочного плана не меняются: заморожены, жесты не бросают", () => {
    const walls = deepFreeze([W(), wall(0, 300, 500, 300, "V")])
    const elements = deepFreeze([door_("W", "a", 300)])
    const s = setup({ walls, elements, radius: 1 })
    expect(() => {
      click(s, { x: 250, y: 0 })
      drag(s, { x: 100, y: 300 }, { x: 190, y: 300 })
      click(s, { x: 250, y: 0 })
    }).not.toThrow()
  })
})

describe("мёртвая зона и минимальная ширина", () => {
  it("TL-06: нажатие в x = 100 и отпускание в 100,5 — клик: помечена вся стена", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.up({ x: 100.5, y: 0 }, px({ x: 100.5, y: 0 }))
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
  })

  it("TL-06: экранный сдвиг ровно 4 px — ещё клик, превью нет", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
    s.tool.move({ x: 102, y: 0 }, { x: 204, y: 0 })
    expect(s.tool.ghost()).toBeNull()
    expect(s.tool.dragging()).toBe(false)
    s.tool.up({ x: 102, y: 0 }, { x: 204, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
  })

  it("TL-06: экранный сдвиг больше 4 px — протяжка: превью есть", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
    s.tool.move({ x: 105, y: 0 }, { x: 205, y: 0 })
    expect(s.tool.dragging()).toBe(true)
    expect(s.tool.ghost()).not.toBeNull()
  })

  it("TL-06: широкий экранный сдвиг, но ширина после привязки 0 (100 → 100,4 округляются в 100) — клик: вся стена", () => {
    const a = setup({ radius: 0 })
    a.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
    a.tool.move({ x: 100.4, y: 0 }, { x: 260, y: 0 })
    a.tool.up({ x: 100.4, y: 0 }, { x: 260, y: 0 })
    expect(a.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
  })

  it("TL-06: ширина после привязки ровно 1 см — участок: 100 → 101 и 100 → 100,6 (округляется в 101)", () => {
    for (const end of [101, 100.6]) {
      const b = setup({ radius: 0 })
      b.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
      b.tool.move({ x: end, y: 0 }, { x: 260, y: 0 })
      b.tool.up({ x: end, y: 0 }, { x: 260, y: 0 })
      expect(b.marks()).toEqual([mk("n1", "W", "a", 100, 101)])
    }
  })

  it("TL-06: ширина после привязки меньше 1 см (узлы 200 и 200,5 на стене; 200 → 200,5) — клик", () => {
    // два элемента с откосами в 200 и 200,5: обе границы привязаны к узлам, ширина 0,5 см
    const s = setup({ radius: 0.3, elements: [door_("W", "a", 200, 90, "d1"), door_("W", "a", 200.5, 10, "d2")] })
    s.tool.down({ x: 200, y: 0 }, { x: 400, y: 0 })
    s.tool.move({ x: 200.5, y: 0 }, { x: 460, y: 0 })
    s.tool.up({ x: 200.5, y: 0 }, { x: 460, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
  })
})

describe("привязка границ протяжки", () => {
  const door = door_("W", "a", 200, 90) // откосы 200–290

  it("TL-13: граница у конца стены привязывается: 100 → 497 даёт 100–500", () => {
    const s = setup({ radius: 6 })
    drag(s, { x: 100, y: 0 }, { x: 497, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "b", 0, 400)])
  })

  it("TL-13: граница у откоса проёма привязывается: 100 → 288 даёт 100–290", () => {
    const s = setup({ radius: 6, elements: [door] })
    drag(s, { x: 100, y: 0 }, { x: 288, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 290)])
  })

  it("TL-13: граница у грани примыкающей стены привязывается", () => {
    const s = setup({ radius: 6, walls: [W(), wall(300, 300, 300, 10, "P")] })
    drag(s, { x: 100, y: 0 }, { x: 292, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 290)])
  })

  it("TL-13: без узла в радиусе граница округляется до сантиметра: 100,4 → 123,4 даёт 100–123", () => {
    const s = setup({ radius: 1 })
    drag(s, { x: 100.4, y: 0 }, { x: 123.4, y: 0 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 123)])
  })

  it("TL-13: превью использует привязанные границы", () => {
    const s = setup({ radius: 6, elements: [door] })
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.move({ x: 288, y: 0 }, px({ x: 288, y: 0 }))
    expect(s.tool.ghost()).toEqual({ wallId: "W", from: 100, to: 290 })
  })
})

describe("выделение без инструмента", () => {
  const marked = (): Setup => setup({ marks: [mk("m", "W", "a", 100, 190)] })

  it("TL-14: клик по области сноса выделяет пометку", () => {
    const s = marked()
    expect(s.tool.select({ x: 150, y: 0 })).toBe(true)
    expect(s.tool.selectedId()).toBe("m")
  })

  it("TL-14: клик по телу стены вне областей сноса не выделяет стену и снимает выделение", () => {
    const s = marked()
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.select({ x: 300, y: 0 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("TL-14: клик мимо стен снимает выделение", () => {
    const s = marked()
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.select({ x: 300, y: 200 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("TL-14: выделение ничего не меняет в данных и не пишет историю", () => {
    const s = marked()
    s.tool.select({ x: 150, y: 0 })
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-16: clearSelection снимает выделение", () => {
    const s = marked()
    s.tool.select({ x: 150, y: 0 })
    s.tool.clearSelection()
    expect(s.tool.selectedId()).toBeNull()
  })

  it("TL-16: выделение и снятие выделения перерисовывают холст", () => {
    const s = marked()
    const r0 = s.log.redraw
    s.tool.select({ x: 150, y: 0 })
    expect(s.log.redraw).toBeGreaterThan(r0)
    const r1 = s.log.redraw
    s.tool.clearSelection()
    expect(s.log.redraw).toBeGreaterThan(r1)
  })

  it("TL-15: Delete удаляет выделенную пометку одним шагом истории и снимает выделение", () => {
    const s = marked()
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.log.record).toBe(1)
    expect(s.log.order).toEqual(["record", "set"])
    expect(s.tool.selectedId()).toBeNull()
  })

  it("TL-15: Delete без выделения ничего не делает", () => {
    const s = marked()
    expect(s.tool.deleteSelected()).toBe(false)
    expect(s.marks()).toHaveLength(1)
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-14: выделяется ровно одна пометка: клик по другой переносит выделение", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190), mk("m2", "W", "a", 300, 400)] })
    s.tool.select({ x: 150, y: 0 })
    s.tool.select({ x: 350, y: 0 })
    expect(s.tool.selectedId()).toBe("m2")
  })

  it("TL-14: пометка на железобетоне (не действует) не выделяется", () => {
    const s = setup({ walls: [W("reinforced")], marks: [mk("m", "W", "a", 100, 190)] })
    expect(s.tool.select({ x: 150, y: 0 })).toBe(false)
  })
})

describe("правка чисел выделенной пометки", () => {
  const selected = (): Setup => {
    const s = setup({ marks: [mk("m", "W", "a", 100, 190)] })
    s.tool.select({ x: 150, y: 0 })
    return s
  }
  // центр числа ширины 90 при zoom 1: середина участка 145 по x
  const widthSpotAt = (s: Setup) => s.tool.numberAt({ x: 145, y: 14.15 }, "cm", K, 14, 1)

  it("TL-17: числа выделенной пометки находятся по точке: число ширины под центром участка", () => {
    const spot = widthSpotAt(selected())
    expect(spot?.target).toBe("width")
    expect(spot?.valueCm).toBe(90)
  })

  it("TL-17: без выделения правимых чисел нет", () => {
    const s = setup({ marks: [mk("m", "W", "a", 100, 190)] })
    expect(widthSpotAt(s)).toBeNull()
  })

  it("TL-17: мимо чисел — null", () => {
    expect(selected().tool.numberAt({ x: 145, y: 100 }, "cm", K, 14, 1)).toBeNull()
  })

  it("TL-17: applyNumber меняет участок одним шагом истории и сохраняет выделение", () => {
    const s = selected()
    expect(s.tool.applyNumber({ target: "width", side: 1 }, 200)).toBe(true)
    expect(s.marks()).toEqual([mk("m", "W", "a", 100, 300)])
    expect(s.log.order).toEqual(["record", "set"])
    expect(s.tool.selectedId()).toBe("m")
  })

  it("TL-17: слияние при правке — выделение следует за слитой пометкой", () => {
    const s = setup({ marks: [mk("m2", "W", "a", 10, 50), mk("m", "W", "a", 100, 190)] })
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.applyNumber({ target: "gapA", side: 1 }, 40)).toBe(true)
    expect(s.marks()).toHaveLength(1)
    expect(s.tool.selectedId()).toBe(s.marks()[0]?.id)
  })

  it("TL-18: недопустимый ввод ничего не меняет: false, нет записи истории", () => {
    const s = selected()
    expect(s.tool.applyNumber({ target: "width", side: 1 }, 0)).toBe(false)
    expect(s.tool.applyNumber({ target: "gapA", side: 1 }, -5)).toBe(false)
    expect(s.tool.applyNumber({ target: "width", side: 1 }, Number.NaN)).toBe(false)
    expect(s.marks()).toEqual([mk("m", "W", "a", 100, 190)])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-18: без выделения applyNumber возвращает false", () => {
    const s = setup({ marks: [mk("m", "W", "a", 100, 190)] })
    expect(s.tool.applyNumber({ target: "width", side: 1 }, 200)).toBe(false)
    expect(s.log.record).toBe(0)
  })

  it("TL-19: ввод, не меняющий участок (то же значение), — операция, ничего не изменившая: false, нет записи истории и замены", () => {
    const s = selected()
    expect(s.tool.applyNumber({ target: "width", side: 1 }, 90)).toBe(false)
    expect(s.tool.applyNumber({ target: "gapA", side: 1 }, 100)).toBe(false)
    expect(s.tool.applyNumber({ target: "gapB", side: 1 }, 310)).toBe(false)
    expect(s.marks()).toEqual([mk("m", "W", "a", 100, 190)])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
    expect(s.tool.selectedId()).toBe("m")
  })

  it("TL-19: значение за пределами, которое зажимается в прежнее состояние, тоже не меняет участок и не пишет историю", () => {
    const s = setup({ marks: [mk("m", "W", "b", 0, 400)] }) // 100–500
    s.tool.select({ x: 300, y: 0 })
    expect(s.tool.applyNumber({ target: "width", side: 1 }, 900)).toBe(false)
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })
})

describe("после постановки пометка выделена (change demolition-select-after-mark)", () => {
  // up возвращает идентификатор поставленной пометки; main.ts по нему снимает инструмент, не сбрасывая выделение
  const clickUp = (s: Setup, p: Point): string | null => {
    s.tool.down(p, px(p))
    return s.tool.up(p, px(p))
  }
  const dragUp = (s: Setup, a: Point, b: Point): string | null => {
    s.tool.down(a, px(a))
    s.tool.move(b, px(b))
    return s.tool.up(b, px(b))
  }

  it("TL-23: клик по стене создаёт пометку, up возвращает её идентификатор, она выделена", () => {
    const s = setup()
    expect(clickUp(s, { x: 250, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("TL-23: протяжка создаёт пометку: идентификатор возвращён, пометка выделена", () => {
    const s = setup({ radius: 1 })
    expect(dragUp(s, { x: 100, y: 0 }, { x: 190, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 190)])
  })

  it("TL-23: постановка переносит выделение с другой пометки на новую", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)], radius: 1 })
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.selectedId()).toBe("m1")
    expect(dragUp(s, { x: 300, y: 0 }, { x: 350, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("TL-23: первая перерисовка после замены списка пометок (и само сохранение) уже видит выделение новой пометки", () => {
    const s = setup({ radius: 1 })
    let replaced = false
    let seenOnFirstRedraw: string | null | undefined
    let seenOnChanged: string | null | undefined
    const setMarks = s.host.setMarks
    const changed = s.host.changed
    const redraw = s.host.redraw
    s.host.setMarks = (next) => {
      replaced = true
      setMarks(next)
    }
    s.host.changed = () => {
      seenOnChanged = s.tool.selectedId()
      changed()
    }
    s.host.redraw = () => {
      if (replaced && seenOnFirstRedraw === undefined) seenOnFirstRedraw = s.tool.selectedId()
      redraw()
    }
    dragUp(s, { x: 100, y: 0 }, { x: 190, y: 0 })
    expect(seenOnChanged).toBe("n1")
    expect(seenOnFirstRedraw).toBe("n1")
  })

  it("TL-28: на двух стенах выбирается пометка именно той стены, где поставлен участок (клик): у стены V уже есть пометка той же длины", () => {
    const V = wall(0, 300, 500, 300, "V")
    const s = setup({ walls: [W(), V], marks: [mk("v1", "V", "a", 0, 500)] })
    expect(clickUp(s, { x: 250, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("TL-28: на двух стенах — то же для протяжки: пометка V с тем же участком не выбирается", () => {
    const V = wall(0, 300, 500, 300, "V")
    const s = setup({ walls: [W(), V], marks: [mk("v1", "V", "a", 50, 400)], radius: 1 })
    expect(dragUp(s, { x: 100, y: 0 }, { x: 190, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("TL-28: слияние на W, пока в списке позже стоит пометка другой стены: возвращается m1, а не последняя в списке", () => {
    const V = wall(0, 300, 500, 300, "V")
    const s = setup({ walls: [W(), V], marks: [mk("m1", "W", "a", 100, 200), mk("v1", "V", "a", 0, 500)], radius: 1 })
    expect(dragUp(s, { x: 150, y: 0 }, { x: 300, y: 0 })).toBe("m1")
    expect(s.tool.selectedId()).toBe("m1")
  })

  it("TL-28: постановка до существующей пометки той же стены: выбирается новая, а не пометка, лежащая правее (100–190 при m1 300–350)", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 300, 350)], radius: 1 })
    expect(dragUp(s, { x: 100, y: 0 }, { x: 190, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("TL-28: постановка между двумя существующими пометками и левее их: выбирается новая (100–190 при m1 50–80 и m2 400–450)", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 50, 80), mk("m2", "W", "a", 400, 450)], radius: 1 })
    expect(dragUp(s, { x: 100, y: 0 }, { x: 190, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("TL-24: слияние — возвращается и выделяется слитая пометка (идентификатор первой): 100–200 + 150–300 → m1 100–300", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 200)], radius: 1 })
    expect(dragUp(s, { x: 150, y: 0 }, { x: 300, y: 0 })).toBe("m1")
    expect(s.tool.selectedId()).toBe("m1")
    expect(s.marks()).toEqual([mk("m1", "W", "a", 100, 300)])
  })

  it("TL-24: клик по неснесённой части стены с другой пометкой поглощает её: возвращается и выделяется m1", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)] })
    expect(clickUp(s, { x: 400, y: 0 })).toBe("m1")
    expect(s.tool.selectedId()).toBe("m1")
  })

  it("TL-25: клик по снесённой области — null, пометка остаётся, выделение не появляется", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)] })
    expect(clickUp(s, { x: 150, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([mk("m1", "W", "a", 100, 190)])
    expect(s.tool.selectedId()).toBeNull()
  })

  it("TL-25: клик по снесённой области не меняет выделение — ни выделенной, ни другой пометки (снятие пометки — только ластик)", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190), mk("m2", "W", "a", 300, 400)] })
    s.tool.select({ x: 350, y: 0 })
    expect(clickUp(s, { x: 150, y: 0 })).toBeNull()
    expect(s.tool.selectedId()).toBe("m2")
    expect(clickUp(s, { x: 350, y: 0 })).toBeNull()
    expect(s.tool.selectedId()).toBe("m2")
    expect(s.marks()).toHaveLength(2)
  })

  it("TL-25: железобетон, клик мимо стены и отсутствие нажатия — null, выделение не меняется", () => {
    const reinforced = setup({ walls: [W("reinforced")] })
    expect(clickUp(reinforced, { x: 250, y: 0 })).toBeNull()
    expect(reinforced.tool.selectedId()).toBeNull()
    const off = setup({ marks: [mk("m1", "W", "a", 100, 190)] })
    off.tool.select({ x: 150, y: 0 })
    expect(clickUp(off, { x: 250, y: 200 })).toBeNull()
    expect(off.tool.selectedId()).toBe("m1")
    expect(off.tool.up({ x: 100, y: 0 }, px({ x: 100, y: 0 }))).toBeNull()
  })

  it("TL-25: Escape во время протяжки — null при последующем отпускании, выделение не меняется", () => {
    const s = setup({ radius: 1 })
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.move({ x: 190, y: 0 }, px({ x: 190, y: 0 }))
    s.tool.cancel()
    expect(s.tool.up({ x: 190, y: 0 }, px({ x: 190, y: 0 }))).toBeNull()
    expect(s.tool.selectedId()).toBeNull()
  })

  it("TL-26: операция, ничего не изменившая (протяжка внутри уже снесённого участка), — null, выделение не меняется", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 300), mk("m2", "W", "a", 400, 450)], radius: 1 })
    s.tool.select({ x: 425, y: 0 })
    expect(dragUp(s, { x: 150, y: 0 }, { x: 200, y: 0 })).toBeNull()
    expect(s.tool.selectedId()).toBe("m2")
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("TL-27: сразу после протяжки число ширины находится и правится: 100–190 → ширина 120 → 100–220, пометка остаётся выделенной", () => {
    const s = setup({ radius: 1 })
    dragUp(s, { x: 100, y: 0 }, { x: 190, y: 0 })
    const spot = s.tool.numberAt({ x: 145, y: 14.15 }, "cm", K, 14, 1)
    expect(spot?.target).toBe("width")
    expect(s.tool.applyNumber({ target: "width", side: 1 }, 120)).toBe(true)
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 220)])
    expect(s.tool.selectedId()).toBe("n1")
    expect(s.log.record).toBe(2)
  })
})

describe("протяжка по стенам не вдоль оси x", () => {
  it("TL-22: вертикальная стена (0,0)-(0,500): нажатие (5, 100), отпускание (80, 190) даёт 100–190", () => {
    const s = setup({ walls: [wall(0, 0, 0, 500, "V")], radius: 1 })
    drag(s, { x: 5, y: 100 }, { x: 80, y: 190 })
    expect(s.marks()).toEqual([mk("n1", "V", "a", 100, 190)])
  })

  it("TL-22: наклонная стена 3-4-5 (0,0)-(300,400), длина 500: нажатие на оси при t = 100, отпускание в t = 190 даёт 100–190", () => {
    const s = setup({ walls: [wall(0, 0, 300, 400, "D")], radius: 1 })
    drag(s, { x: 60, y: 80 }, { x: 114, y: 152 })
    expect(s.marks()).toEqual([mk("n1", "D", "a", 100, 190)])
  })

  it("TL-22: наклонная стена: отпускание вне оси проецируется перпендикуляром на ось", () => {
    const s = setup({ walls: [wall(0, 0, 300, 400, "D")], radius: 1 })
    // точка оси при t = 190 — (114, 152); смещение на (−8, 6) перпендикулярно оси (0,6; 0,8) → (106, 158)
    drag(s, { x: 60, y: 80 }, { x: 106, y: 158 })
    expect(s.marks()).toEqual([mk("n1", "D", "a", 100, 190)])
  })

  it("TL-22: вертикальная стена: клик по телу помечает её целиком", () => {
    const s = setup({ walls: [wall(0, 0, 0, 500, "V")] })
    click(s, { x: 0, y: 250 })
    expect(s.marks()).toEqual([mk("n1", "V", "a", 0, 500)])
  })

  it("TL-22: нажатие на стену W определяет ось: отпускание над другой стеной проецируется на ось W", () => {
    const s = setup({ walls: [W(), wall(0, 300, 500, 300, "V")], radius: 1 })
    drag(s, { x: 100, y: 0 }, { x: 190, y: 300 })
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 190)])
  })
})
