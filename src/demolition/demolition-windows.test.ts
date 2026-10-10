import { describe, expect, it } from "vitest"
import { door } from "../doorway/doorway.test-utils"
import type { DemolitionMark, Point, Wall, WallElement } from "../types"
import { W, door_, idGen, mk, wall, window_ } from "./demolition.test-utils"
import { createDemolitionTool } from "./demolition-tool"
import type { DemolitionToolHost } from "./demolition-tool"

// change demolition-no-window-walls: инструмент «Демонтаж» и стены с окнами (spec demolition-plan «Что сносится и что
// нет», «Инструмент «Демонтаж»»; design D2). Хост подставной; элементы можно менять между операциями, как на
// обмерочном плане. Масштаб экрана 2 px на см. Стена W — (0,0)-(500,0), кирпич, 20 см.

const K = 2
const px = (p: Point): Point => ({ x: p.x * K, y: p.y * K })

function setup(opts: { walls?: readonly Wall[]; elements?: WallElement[]; marks?: DemolitionMark[] } = {}) {
  let marks: DemolitionMark[] = opts.marks ?? []
  const walls = opts.walls ?? [W()]
  const elements: WallElement[] = opts.elements ?? []
  const log = { record: 0, set: 0, changed: 0 }
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
    changed: () => {
      log.changed++
    },
    redraw: () => {},
    radiusCm: () => 1,
    newId: idGen(),
  }
  return { tool: createDemolitionTool(host), marks: () => marks, elements, log }
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

const win = (id = "w1"): WallElement => window_("W", "a", 210, 90, id)
const m1 = mk("m1", "W", "a", 100, 190)

describe("стена с окном не помечается", () => {
  it("NW-10: клик по телу стены с окном ничего не меняет: пометки нет, up возвращает null, шага истории нет", () => {
    const s = setup({ elements: [win()] })
    expect(click(s, { x: 50, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log).toMatchObject({ record: 0, set: 0, changed: 0 })
  })

  it("NW-10: клик по участку самого окна и рядом с ним — то же", () => {
    const s = setup({ elements: [win()] })
    expect(click(s, { x: 250, y: 0 })).toBeNull()
    expect(click(s, { x: 450, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
  })

  it("NW-11: протяжка вдоль стены с окном: пометки нет, превью не показывается, шага истории нет", () => {
    const s = setup({ elements: [win()] })
    s.tool.down({ x: 20, y: 0 }, px({ x: 20, y: 0 }))
    s.tool.move({ x: 120, y: 0 }, px({ x: 120, y: 0 }))
    expect(s.tool.ghost()).toBeNull()
    expect(s.tool.dragging()).toBe(false)
    expect(s.tool.up({ x: 120, y: 0 }, px({ x: 120, y: 0 }))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.record).toBe(0)
  })

  it("NW-11: протяжка, пересекающая окно, тоже ничего не создаёт", () => {
    const s = setup({ elements: [win()] })
    expect(drag(s, { x: 150, y: 0 }, { x: 400, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
  })

  it("NW-15: железобетонная стена по-прежнему не помечается", () => {
    const s = setup({ walls: [W("reinforced")] })
    expect(click(s, { x: 250, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([])
  })
})

describe("проёмы, двери и окна других стен не мешают", () => {
  // TCR-1 (change demolition-drag-only): стену целиком помечает протяжка от конца до конца, клик ничего не ставит
  it("NW-12: стена с проёмом помечается целиком протяжкой: 0–500, пометка выделена, возвращён идентификатор", () => {
    const s = setup({ elements: [door("W", "a", 210, 90, 210, "p")] })
    expect(drag(s, { x: 0, y: 0 }, { x: 500, y: 0 })).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
    expect(s.tool.selectedId()).toBe("n1")
  })

  it("NW-12: стена с дверью помечается целиком, протяжка через дверь даёт участок", () => {
    const s = setup({ elements: [door_("W", "a", 210, 90, "dr")] })
    expect(drag(s, { x: 50, y: 0 }, { x: 300, y: 0 })).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "W", "a", 50, 300)])
  })

  it("NW-12: стена с проёмом и дверью — протяжка поверх проёма помечает стену (проём в области сноса)", () => {
    const s = setup({ elements: [door("W", "a", 100, 90, 210, "p"), door_("W", "b", 100, 90, "dr")] })
    expect(drag(s, { x: 0, y: 0 }, { x: 500, y: 0 })).toBe("n1")
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
  })

  it("NW-13: окно на другой стене не мешает пометить W", () => {
    const two = [W(), wall(0, 300, 500, 300, "V")]
    const s = setup({ walls: two, elements: [window_("V", "a", 210, 90, "w1")] })
    expect(drag(s, { x: 0, y: 0 }, { x: 500, y: 0 })).toBe("n1")
    expect(drag(s, { x: 0, y: 300 }, { x: 500, y: 300 })).toBeNull()
    expect(s.marks()).toEqual([mk("n1", "W", "a", 0, 500)])
  })
})

describe("пометка стены, на которой появилось окно", () => {
  it("NW-14: пометка остаётся в списке, но не выбирается (select → false) и не подсвечивается ластиком", () => {
    const s = setup({ marks: [m1] })
    expect(s.tool.select({ x: 150, y: 0 })).toBe(true)
    s.tool.clearSelection()
    s.elements.push(win())
    expect(s.tool.select({ x: 150, y: 0 })).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
    expect(s.tool.eraseTarget({ x: 150, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([m1])
  })

  it("NW-16: ластик не удаляет скрытую пометку и не пишет историю", () => {
    const s = setup({ marks: [m1], elements: [win()] })
    expect(s.tool.erase({ x: 150, y: 0 })).toBe(false)
    expect(s.marks()).toEqual([m1])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })

  it("NW-17: скрытую пометку выделить нельзя, поэтому Delete ничего не удаляет", () => {
    const s = setup({ marks: [m1], elements: [win()] })
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.deleteSelected()).toBe(false)
    expect(s.marks()).toEqual([m1])
  })

  it("NW-18: числа выделенной пометки пропадают, если на её стене появилось окно (numberAt → null)", () => {
    const s = setup({ marks: [m1] })
    s.tool.select({ x: 150, y: 0 })
    expect(s.tool.numberAt({ x: 145, y: 14.15 }, "cm", K, 14, 1)).not.toBeNull()
    s.elements.push(win())
    expect(s.tool.numberAt({ x: 145, y: 14.15 }, "cm", K, 14, 1)).toBeNull()
  })

  it("NW-19: окно удалено — пометка снова выбирается и подсвечивается ластиком", () => {
    const s = setup({ marks: [m1], elements: [win()] })
    expect(s.tool.select({ x: 150, y: 0 })).toBe(false)
    s.elements.length = 0
    expect(s.tool.select({ x: 150, y: 0 })).toBe(true)
    expect(s.tool.eraseTarget({ x: 150, y: 0 })).toBe("m1")
  })

  it("NW-20: клик инструментом по стене с окном, на которой есть скрытая пометка, ничего не меняет и не снимает её", () => {
    const s = setup({ marks: [m1], elements: [win()] })
    expect(click(s, { x: 150, y: 0 })).toBeNull()
    expect(click(s, { x: 400, y: 0 })).toBeNull()
    expect(s.marks()).toEqual([m1])
    expect(s.log).toMatchObject({ record: 0, set: 0 })
  })
})
