import { describe, expect, it } from "vitest"
import type { DemolitionMark, Point, Wall, WallElement } from "../types"
import { door } from "../doorway/doorway.test-utils"
import { W, door_, idGen, mk, wall, window_ } from "./demolition.test-utils"
import { createDemolitionTool } from "./demolition-tool"
import type { DemolitionToolHost } from "./demolition-tool"
import { span } from "./marks"

// change demolition-window-sections: инструмент «Демонтаж» на стене с окном и перегородкой (spec demolition-plan «Что
// сносится и что нет», «Инструмент «Демонтаж»»; design D3). Стена W (0,0)–(500,0), перегородка P (300,10)–(300,400)
// толщиной 10; окно слева (откосы 100–190): участок окна [0, 295], чистый участок [295, 500]. Масштаб экрана 2 px/см.

const K = 2
const px = (p: Point): Point => ({ x: p.x * K, y: p.y * K })

function setup(opts: { walls?: readonly Wall[]; elements?: WallElement[]; marks?: DemolitionMark[] } = {}) {
  let marks: DemolitionMark[] = opts.marks ?? []
  const walls = opts.walls ?? [W(), wall(300, 10, 300, 400, "P", "brick", 10)]
  const elements: WallElement[] = opts.elements ?? [window_("W", "a", 100, 90, "wl")]
  const log = { record: 0, set: 0 }
  const host: DemolitionToolHost = {
    walls: () => walls,
    elements: () => elements,
    marks: () => marks,
    setMarks: (next) => {
      marks = next
      log.set++
    },
    record: () => {
      log.record++
    },
    changed: () => {},
    redraw: () => {},
    radiusCm: () => 1,
    newId: idGen(),
  }
  return { tool: createDemolitionTool(host), marks: () => marks, elements, walls, log }
}
type Setup = ReturnType<typeof setup>

const click = (s: Setup, p: Point): string | null => {
  s.tool.down(p, px(p))
  return s.tool.up(p, px(p))
}
const dragTo = (s: Setup, a: Point, b: Point): string | null => {
  s.tool.down(a, px(a))
  s.tool.move({ x: (a.x + b.x) / 2, y: 0 }, px({ x: (a.x + b.x) / 2, y: 0 }))
  s.tool.move(b, px(b))
  return s.tool.up(b, px(b))
}
const wallW = (s: Setup): Wall => {
  const w = s.walls.find((x) => x.id === "W")
  if (!w) throw new Error("нет стены W")
  return w
}
const spans = (s: Setup): [number, number][] => s.marks().map((m) => span(m, wallW(s)))

describe("клик", () => {
  it("SW-21: клик по чистому участку (x = 400) помечает участок 295–500, а не всю стену; одна запись истории", () => {
    const s = setup()
    expect(click(s, { x: 400, y: 0 })).toBe("n1")
    expect(spans(s)).toEqual([[295, 500]])
    expect(s.log).toMatchObject({ record: 1, set: 1 })
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("SW-21: клик в разрыве грани (x = 300, под перегородкой) относится к соседнему чистому участку: 295–500", () => {
    const s = setup()
    expect(click(s, { x: 300, y: 0 })).toBe("n1")
    expect(spans(s)).toEqual([[295, 500]])
  })

  it("SW-22: клик по участку окна (x = 50 и на самом окне x = 150) ничего не меняет", () => {
    const s = setup()
    expect(click(s, { x: 50, y: 0 })).toBeNull()
    expect(click(s, { x: 150, y: 0 })).toBeNull()
    expect(click(s, { x: 250, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("SW-21: окно справа — чистый участок слева: клик в x = 50 помечает 0–305", () => {
    const s = setup({ elements: [window_("W", "a", 350, 90, "wr")] })
    expect(click(s, { x: 50, y: 0 })).toBe("n1")
    expect(spans(s)).toEqual([[0, 305]])
    expect(click(s, { x: 400, y: 0 })).toBeNull()
  })

  it("SW-21: клик по чистому участку, где уже есть пометка, сливает её в весь чистый участок", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 320, 400)] })
    expect(click(s, { x: 450, y: 0 })).toBe("m1")
    expect(spans(s)).toEqual([[295, 500]])
  })

  it("SW-21: клик по снесённой области чистого участка по-прежнему ничего не меняет", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 320, 400)] })
    expect(click(s, { x: 350, y: 0 })).toBeNull()
    expect(s.log.record).toBe(0)
  })

  it("SW-20: свободная стена с окном: чистых участков нет — клик ничего не меняет", () => {
    const s = setup({ walls: [W()], elements: [window_("W", "a", 210, 90, "w1")] })
    expect(click(s, { x: 50, y: 0 })).toBeNull()
    expect(click(s, { x: 450, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
  })

  it("SW-20: без окна клик помечает всю стену, как раньше (перегородка стену не делит)", () => {
    const s = setup({ elements: [] })
    expect(click(s, { x: 400, y: 0 })).toBe("n1")
    expect(spans(s)).toEqual([[0, 500]])
  })

  it("SW-20: окно на перегородке (другой стене) и проём с дверью на W не блокируют: клик помечает всю стену", () => {
    for (const elements of [[window_("P", "a", 100, 90, "wp")], [door("W", "a", 100, 90, 210, "p"), door_("W", "b", 100, 90, "dr")]]) {
      const s = setup({ elements })
      expect(click(s, { x: 50, y: 0 })).toBe("n1")
      expect(spans(s)).toEqual([[0, 500]])
    }
  })
})

describe("протяжка", () => {
  it("SW-23: протяжка, начатая на чистом участке (x = 400) и ушедшая на участок окна (x = 150), обрезается по границе 295: 295–400", () => {
    const s = setup()
    expect(dragTo(s, { x: 400, y: 0 }, { x: 150, y: 0 })).toBe("n1")
    expect(spans(s)).toEqual([[295, 400]])
  })

  it("SW-23: превью во время такой протяжки обрезано по границе участка", () => {
    const s = setup()
    s.tool.down({ x: 400, y: 0 }, px({ x: 400, y: 0 }))
    s.tool.move({ x: 150, y: 0 }, px({ x: 150, y: 0 }))
    expect(s.tool.ghost()).toEqual({ wallId: "W", from: 295, to: 400 })
    s.tool.cancel()
  })

  it("SW-24: протяжка, начатая на участке окна (x = 150), ничего не создаёт и превью не показывает", () => {
    const s = setup()
    s.tool.down({ x: 150, y: 0 }, px({ x: 150, y: 0 }))
    s.tool.move({ x: 400, y: 0 }, px({ x: 400, y: 0 }))
    expect(s.tool.ghost()).toBeNull()
    expect(s.tool.up({ x: 400, y: 0 }, px({ x: 400, y: 0 }))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.record).toBe(0)
  })

  it("SW-23: окно справа (чистый участок [0, 305]): протяжка от x = 50 до x = 400 обрезается по правой границе: 50–305, превью то же", () => {
    const s = setup({ elements: [window_("W", "a", 350, 90, "wr")] })
    s.tool.down({ x: 50, y: 0 }, px({ x: 50, y: 0 }))
    s.tool.move({ x: 400, y: 0 }, px({ x: 400, y: 0 }))
    expect(s.tool.ghost()).toEqual({ wallId: "W", from: 50, to: 305 })
    expect(s.tool.up({ x: 400, y: 0 }, px({ x: 400, y: 0 }))).toBe("n1")
    expect(spans(s)).toEqual([[50, 305]])
  })

  it("SW-25: протяжка внутри чистого участка: 350–450 — как обычно", () => {
    const s = setup()
    expect(dragTo(s, { x: 350, y: 0 }, { x: 450, y: 0 })).toBe("n1")
    expect(spans(s)).toEqual([[350, 450]])
  })

  it("SW-25: протяжка за конец стены обрезается по её длине: 450–700 → 450–500", () => {
    const s = setup()
    expect(dragTo(s, { x: 450, y: 0 }, { x: 700, y: 0 })).toBe("n1")
    expect(spans(s)).toEqual([[450, 500]])
  })
})

describe("скрытые пометки на участке окна", () => {
  it("SW-30: пометка через участок окна (200–400) не выбирается, не стирается и не подсвечивается", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 200, 400)] })
    expect(s.tool.select({ x: 350, y: 0 })).toBe(false)
    expect(s.tool.erase({ x: 350, y: 0 })).toBe(false)
    expect(s.tool.eraseTarget({ x: 350, y: 0 })).toBeNull()
    expect(s.marks()).toHaveLength(1)
    expect(s.log.record).toBe(0)
  })

  it("SW-31: клик по чистому участку, где лежит скрытая пометка (200–400), ставит новую 295–500 и не сливает скрытую", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 200, 400)] })
    expect(click(s, { x: 350, y: 0 })).toBe("n1")
    expect(s.tool.selectedId()).toBe("n1")
    expect(s.marks().find((m) => m.id === "m1")).toEqual(mk("m1", "W", "a", 200, 400))
    expect(s.marks().filter((m) => m.id !== "m1").map((m) => span(m, wallW(s)))).toEqual([[295, 500]])
    expect(s.marks()).toHaveLength(2)
  })

  it("SW-31: протяжка по месту скрытой пометки тоже не сливается с ней", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 200, 400)] })
    expect(dragTo(s, { x: 350, y: 0 }, { x: 450, y: 0 })).toBe("n1")
    expect(s.marks().find((m) => m.id === "m1")).toEqual(mk("m1", "W", "a", 200, 400))
    expect(s.marks().filter((m) => m.id !== "m1").map((m) => span(m, wallW(s)))).toEqual([[350, 450]])
  })

  it("SW-32: пометка на чистом участке выбирается и подсвечивается ластиком", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 320, 400)] })
    expect(s.tool.select({ x: 350, y: 0 })).toBe(true)
    expect(s.tool.eraseTarget({ x: 350, y: 0 })).toBe("m1")
  })

  it("SW-32: окно удалено — скрытая пометка снова выбирается", () => {
    const s = setup({ marks: [mk("m1", "W", "a", 200, 400)] })
    expect(s.tool.select({ x: 350, y: 0 })).toBe(false)
    s.elements.length = 0
    expect(s.tool.select({ x: 350, y: 0 })).toBe(true)
  })
})
