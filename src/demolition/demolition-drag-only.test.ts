import { describe, expect, it } from "vitest"
import type { DemolitionMark, Point, Wall } from "../types"
import { W, idGen, mk, wall } from "./demolition.test-utils"
import { createDemolitionTool } from "./demolition-tool"
import type { DemolitionToolHost } from "./demolition-tool"

// change demolition-drag-only: участок помечается только протяжкой, клик ничего не меняет (spec demolition-plan
// «Инструмент «Демонтаж»»; design D1). Хост подставной; масштаб экрана 2 px на см. Стена W — (0,0)-(500,0), кирпич, 20 см.

const K = 2
const px = (p: Point): Point => ({ x: p.x * K, y: p.y * K })

function setup(opts: { walls?: readonly Wall[]; marks?: DemolitionMark[] } = {}) {
  let marks: DemolitionMark[] = opts.marks ?? []
  const walls = opts.walls ?? [W()]
  const log = { record: 0, set: 0, changed: 0 }
  const host: DemolitionToolHost = {
    walls: () => walls,
    elements: () => [],
    marks: () => marks,
    setMarks: (next) => {
      marks = next
      log.set++
    },
    record: () => {
      log.record++
    },
    changed: () => {
      log.changed++
    },
    redraw: () => {},
    radiusCm: () => 6,
    newId: idGen(),
  }
  return { tool: createDemolitionTool(host), marks: () => marks, log }
}
type Setup = ReturnType<typeof setup>

const click = (s: Setup, p: Point): string | null => {
  s.tool.down(p, px(p))
  return s.tool.up(p, px(p))
}
const drag = (s: Setup, a: Point, b: Point): string | null => {
  s.tool.down(a, px(a))
  s.tool.move(b, px(b))
  return s.tool.up(b, px(b))
}

describe("клик ничего не помечает", () => {
  it("DO-01: клик по телу стены: пометки нет, up возвращает null, шага истории и сохранения нет, выделения нет", () => {
    const s = setup()
    expect(click(s, { x: 250, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0, changed: 0 })
    expect(s.tool.selectedId()).toBeNull()
  })

  it("DO-01: клик у разных мест стены (у концов, у грани в радиусе привязки, в середине) — то же", () => {
    const s = setup()
    for (const p of [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 100, y: 13 }, { x: 250, y: -13 }]) expect(click(s, p)).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.record).toBe(0)
  })

  it("DO-01: клик по стене с пометками не меняет их и не добавляет новых", () => {
    const m = mk("m1", "W", "a", 100, 190)
    const s = setup({ marks: [m] })
    expect(click(s, { x: 400, y: 0 })).toBeNull()
    expect(click(s, { x: 150, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([m])
    expect(s.log.record).toBe(0)
  })

  it("DO-01: клик не меняет выделение и не выделяет", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)] })
    s.tool.select({ x: 150, y: 0 })
    click(s, { x: 400, y: 0 })
    expect(s.tool.selectedId()).toBe("m1")
  })

  it("DO-02: нажатие и отпускание в пределах мёртвой зоны 4 px (сдвиг на 2 см = 4 px) — клик: ничего не создаётся, превью нет", () => {
    const s = setup()
    s.tool.down({ x: 100, y: 0 }, px({ x: 100, y: 0 }))
    s.tool.move({ x: 102, y: 0 }, px({ x: 102, y: 0 }))
    expect(s.tool.ghost()).toBeNull()
    expect(s.tool.up({ x: 102, y: 0 }, px({ x: 102, y: 0 }))).toBeNull()
    expect(s.marks()).toEqual([])
  })

  it("DO-02: широкий экранный сдвиг, но ширина участка меньше 1 см (100 → 100,4 округляются в 100, сдвиг 60 px) — ничего не создаётся", () => {
    const s = setup()
    s.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
    s.tool.move({ x: 100.4, y: 0 }, { x: 260, y: 0 })
    expect(s.tool.up({ x: 100.4, y: 0 }, { x: 260, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.record).toBe(0)
  })

  it("DO-02: клик по железобетонной стене и мимо стены — null, ничего не меняется", () => {
    const reinforced = setup({ walls: [W("reinforced")] })
    expect(click(reinforced, { x: 250, y: 0 })).toBeNull()
    expect(click(setup(), { x: 250, y: 200 })).toBeNull()
  })
})

describe("протяжка помечает участок", () => {
  it("DO-03: протяжка от конца до конца (0 → 700) помечает стену целиком: 0–500, пометка выделена, возвращён идентификатор, одна запись истории", () => {
    const s = setup()
    expect(drag(s, { x: 0, y: 0 }, { x: 700, y: 0 })).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
    expect(s.tool.selectedId()).toBe("n1")
    expect(s.log).toMatchObject({ record: 1, set: 1 })
  })

  it("DO-03: протяжка справа налево (500 → −100) тоже помечает 0–500", () => {
    const s = setup()
    expect(drag(s, { x: 500, y: 0 }, { x: -100, y: 0 })).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
  })

  it("DO-03: протяжка шириной ровно 1 см (100 → 101) помечает участок 100–101", () => {
    const s = setup({ walls: [W()] })
    s.tool.down({ x: 100, y: 0 }, { x: 200, y: 0 })
    s.tool.move({ x: 101, y: 0 }, { x: 260, y: 0 })
    expect(s.tool.up({ x: 101, y: 0 }, { x: 260, y: 0 })).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "W", "a", 100, 101)])
  })

  it("DO-04: протяжка по стене с пометкой от конца до конца поглощает её: 0–500, идентификатор первой", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 100, 190)] })
    expect(drag(s, { x: 0, y: 0 }, { x: 700, y: 0 })).toBe("m1")
    expect(s.marks()).toEqual([mk("m1", "W", "a", 0, 500)])
  })

  it("DO-04: на нескольких стенах протяжка помечает ту, на которой нажали", () => {
    const two = [W(), wall(0, 300, 500, 300, "V")]
    const s = setup({ walls: two })
    expect(drag(s, { x: 0, y: 300 }, { x: 700, y: 300 })).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "V", "a", 0, 500)])
  })
})
