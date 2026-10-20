import { describe, expect, it } from "vitest"
import { door } from "../doorway/doorway.test-utils"
import type { Drawing, PlasterMark, Point } from "../types"
import { plasterRunDimensions } from "./plaster-dimensions"
import { createPlasterTool } from "./plaster-tool"
import type { PlasterToolHost } from "./plaster-tool"
import { roughScene } from "./rough-scene"
import { demolitionMark, drawing, idGen, plaster, wall } from "./rough.test-utils"

// change add-rough-works-plan, plaster-click-whole-face: инструмент «Штукатурка» — наведение и клик по грани, выделение, числа, ластик
// (spec rough-works-plan «Постановка штукатурки кликом по грани», «Выделение штукатурки и правка на месте», «Ластик на плане «Черновые работы»»)

const NONE: PlasterMark[] = []

function setup(initial: Drawing, thicknessMm = 20) {
  let d = initial
  const log = { records: 0, changes: 0, redraws: 0 }
  const host: PlasterToolHost = {
    drawing: () => d,
    scene: () => roughScene(d),
    marks: () => d.roughPlaster ?? NONE,
    setMarks: (next) => {
      d = { ...d, roughPlaster: next }
    },
    record: () => {
      log.records++
    },
    changed: () => {
      log.changes++
    },
    redraw: () => {
      log.redraws++
    },
    radiusCm: () => 5,
    newId: idGen(),
    newThicknessMm: () => thicknessMm,
  }
  return { tool: createPlasterTool(host), log, marks: () => d.roughPlaster ?? [], drawing: () => d }
}

type Setup = ReturnType<typeof setup>

const px = (x: number, y = 0): Point => ({ x, y })
// клик по миру в (x, y): нажатие и отпускание в одной экранной точке
const click = (s: Setup, x: number, y = 5): string | null => {
  s.tool.down(px(0))
  return s.tool.up(px(x, y), px(1))
}

describe("клик по грани", () => {
  it("RW-140: клик со стороны y > 0 ставит пометку на грани +1 на всю грань с толщиной из панели; один шаг истории", () => {
    const s = setup(drawing(), 30)
    expect(click(s, 100)).toBe("n1")
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 0, 500, 30)])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RW-141: грань определяется стороной курсора: со стороны y < 0 — грань −1", () => {
    const s = setup(drawing())
    click(s, 100, -5)
    expect(s.marks()[0]?.face).toBe(-1)
  })

  it("RW-142: клик вдали от стен ничего не меняет и шага истории не создаёт", () => {
    const s = setup(drawing())
    expect(click(s, 250, 200)).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("RW-143: перетаскивание дальше мёртвой зоны пометку не создаёт", () => {
    const s = setup(drawing())
    s.tool.down(px(0))
    expect(s.tool.up(px(300, 5), px(100))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("RW-144: отпускание без нажатия на плане пометку не создаёт", () => {
    const s = setup(drawing())
    expect(s.tool.up(px(100, 5), px(1))).toBeNull()
    expect(s.marks()).toEqual([])
  })

  it("RW-145: наведение подсвечивает всю цель с толщиной из панели; пометки и шага истории нет", () => {
    const s = setup(drawing(), 40)
    s.tool.hover(px(300, 5))
    const g = s.tool.ghost()
    expect(g?.thicknessMm).toBe(40)
    expect(g?.pieces.map((x) => [x.wall.id, x.face, x.from, x.to])).toEqual([["W~0", 1, 0, 500]]) // стена подложки — остаток W
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("RW-146: подсветка пропадает, когда курсор ушёл от стен, с плана или нажат Escape (cancel)", () => {
    const s = setup(drawing())
    s.tool.hover(px(300, 5))
    s.tool.hover(px(300, 200))
    expect(s.tool.ghost()).toBeNull()
    s.tool.hover(px(300, 5))
    s.tool.hover(null)
    expect(s.tool.ghost()).toBeNull()
    s.tool.hover(px(300, 5))
    s.tool.cancel()
    expect(s.tool.ghost()).toBeNull()
    expect(s.log.records).toBe(0)
  })

  it("RW-147: перерисовка при наведении — только при смене цели", () => {
    const s = setup(drawing())
    s.tool.hover(px(300, 5))
    const after = s.log.redraws
    s.tool.hover(px(310, 6))
    expect(s.log.redraws).toBe(after)
    s.tool.hover(px(310, -6))
    expect(s.log.redraws).toBe(after + 1)
  })

  it("RW-148: проём не прерывает цель: клик против проёма ставит сплошной участок", () => {
    const withOpening: Drawing = { ...drawing(), doorways: [door("W", "a", 200, 90)] }
    const s = setup(withOpening)
    s.tool.hover(px(245, 5))
    expect(s.tool.ghost()?.pieces.map((x) => [x.from, x.to])).toEqual([[0, 500]])
    click(s, 245)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 0, 500, 20)])
  })

  it("RW-149: клик по остатку стены даёт пометку в координатах исходной стены на весь остаток", () => {
    const s = setup(drawing({ demolition: [demolitionMark("m", "W", "a", 0, 200)] }))
    // остаток 200–500
    click(s, 350)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "b", 0, 300, 20)])
  })

  it("RW-150: цель заканчивается у края снесённого участка", () => {
    const s = setup(drawing({ demolition: [demolitionMark("m", "W", "a", 200, 300)] }))
    // остаток слева 0–200
    click(s, 100)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 0, 200, 20)])
  })

  it("RW-151: собственная стена «Монтажа» штукатурится целиком", () => {
    const own = wall("own", 0, 300, 300, 300)
    const s = setup(drawing({ mounting: { walls: [own], dimensions: [] } }))
    click(s, 150, 305)
    expect(s.marks()).toEqual([plaster("n1", "own", 1, "a", 0, 300, 20)])
  })

  it("RW-152: пересекающаяся частичная пометка сливается, слитая пометка не выделена и берёт толщину из панели", () => {
    const s = setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 200, 20)] }), 30)
    expect(click(s, 400)).toBe("p")
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 0, 500, 30)])
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RW-153: скрытая (недействующая) пометка в слиянии не участвует и остаётся без изменений", () => {
    const hidden = plaster("h", "gone", 1, "a", 100, 200)
    const s = setup(drawing({ roughPlaster: [hidden] }))
    click(s, 100)
    expect(s.marks()).toEqual([hidden, plaster("n1", "W", 1, "a", 0, 500, 20)])
  })

  it("RW-154: повторный клик по уже оштукатуренной грани ничего не меняет, даже при другой толщине в панели", () => {
    const s = setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20)] }), 30)
    expect(click(s, 100)).toBeNull()
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 0, 500, 20)])
    expect(s.log.records).toBe(0)
  })

  it("RW-155: штукатурка противоположной грани не мешает: ставится вторая пометка", () => {
    const s = setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20)] }))
    click(s, 100, -5)
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 0, 500, 20), plaster("n1", "W", -1, "a", 0, 500, 20)])
  })

  it("RW-156: примыкание режет цель: клик ставит только участок до примыкания", () => {
    const T = wall("T", 250, 0, 250, 300)
    const s = setup(drawing({ walls: [wall("W", 0, 0, 500, 0), T] }))
    click(s, 100)
    expect(s.marks()).toEqual([plaster("n1", "W", 1, "a", 0, 240, 20)])
  })

  it("RW-157: сторона из двух коллинеарных отрезков — по пометке на каждый, один шаг истории, выделена пометка под курсором", () => {
    const s = setup(drawing({ walls: [wall("W1", 0, 0, 300, 0, 20, "brick"), wall("W2", 300, 0, 600, 0, 20, "gkl")] }))
    s.tool.hover(px(450, 5))
    expect(s.tool.ghost()?.pieces).toHaveLength(2)
    expect(click(s, 450)).toBe("n2")
    expect(s.marks()).toEqual([plaster("n1", "W1", 1, "a", 0, 300, 20), plaster("n2", "W2", 1, "a", 0, 300, 20)])
    expect(s.log.records).toBe(1)
    expect(s.log.changes).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RW-158: цепочка, в которой один отрезок уже оштукатурен, добавляет только недостающий; шаг истории один", () => {
    const walls = [wall("W1", 0, 0, 300, 0), wall("W2", 300, 0, 600, 0)]
    const s = setup(drawing({ walls, roughPlaster: [plaster("p", "W1", 1, "a", 0, 300, 20)] }))
    click(s, 450)
    expect(s.marks()).toEqual([plaster("p", "W1", 1, "a", 0, 300, 20), plaster("n1", "W2", 1, "a", 0, 300, 20)])
    expect(s.log.records).toBe(1)
  })
})

describe("выделение, толщина и снятие", () => {
  const withMark = () => setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300, 20)] }))

  it("RW-160: клик по полосе без инструмента выделяет пометку; клик мимо снимает выделение", () => {
    const s = withMark()
    expect(s.tool.select(px(200, 11))).toBe(true)
    expect(s.tool.selectedId()).toBe("p")
    expect(s.tool.select(px(450, 11))).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RW-161: правка толщины выделенной пометки — один шаг истории; то же значение шага не создаёт", () => {
    const s = withMark()
    s.tool.select(px(200, 11))
    expect(s.tool.setSelectedThickness(30)).toBe(true)
    expect(s.marks()[0]?.thicknessMm).toBe(30)
    expect(s.log.records).toBe(1)
    expect(s.tool.setSelectedThickness(30)).toBe(false)
    expect(s.log.records).toBe(1)
  })

  it("RW-162: Delete удаляет выделенную пометку одним шагом", () => {
    const s = withMark()
    s.tool.select(px(200, 11))
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RW-163: без выделения Delete и правка толщины ничего не делают", () => {
    const s = withMark()
    expect(s.tool.deleteSelected()).toBe(false)
    expect(s.tool.setSelectedThickness(30)).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("RW-164: ластик удаляет пометку под точкой одним шагом; мимо — ничего", () => {
    const s = withMark()
    expect(s.tool.eraseTarget(px(200, 11))).toBe("p")
    expect(s.tool.eraseTarget(px(450, 11))).toBeNull()
    expect(s.tool.erase(px(450, 11))).toBe(false)
    expect(s.log.records).toBe(0)
    expect(s.tool.erase(px(200, 11))).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(1)
  })

  it("RW-165: ластик не реагирует на тело стены", () => {
    const s = withMark()
    expect(s.tool.erase(px(200, 0))).toBe(false)
    expect(s.marks()).toHaveLength(1)
  })
})

describe("числа размеров не правятся", () => {
  const withMark = () => setup(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 190, 20)] }))

  it("RW-170: у выделенной пометки показана цепочка «100 | 90 | 310», невыделенные показывают тот же участок как ширину", () => {
    const s = withMark()
    s.tool.select(px(150, 11))
    const scene = roughScene(s.drawing())
    const [run] = plasterRunDimensions(scene.pieces, scene.base.walls, scene.base.doorways, "cm", 2, 14)
    expect(run?.dimensions.map((d) => [d.target, d.text])).toEqual([
      ["gapA", "100"],
      ["width", "90"],
      ["gapB", "310"],
    ])
  })

  it("RW-172: число размера выделенной пометки распознаётся как число (клик по нему выделения не снимает), невыделенной и мимо — нет", () => {
    const s = withMark()
    const scene = roughScene(s.drawing())
    const [run] = plasterRunDimensions(scene.pieces, scene.base.walls, scene.base.doorways, "cm", 2, 14)
    const width = run?.dimensions.find((d) => d.target === "width")
    const at = width?.spot.center ?? px(-1000, -1000)
    expect(s.tool.dimensionAt(at, "cm", 2, 14, 0)).toBe(false)
    s.tool.select(px(150, 11))
    expect(s.tool.dimensionAt(at, "cm", 2, 14, 0)).toBe(true)
    expect(s.tool.dimensionAt(px(450, 200), "cm", 2, 14, 0)).toBe(false)
    expect(s.tool.selectedId()).toBe("p")
    expect(s.log.records).toBe(0)
  })

  it("RW-171: у инструмента нет правки числа: выделение и клики по размерам участок и историю не меняют", () => {
    const s = withMark()
    s.tool.select(px(150, 11))
    expect(Object.keys(s.tool)).not.toContain("numberAt")
    expect(Object.keys(s.tool)).not.toContain("applyNumber")
    expect(s.marks()).toEqual([plaster("p", "W", 1, "a", 100, 190, 20)])
    expect(s.log.records).toBe(0)
    expect(s.tool.selectedId()).toBe("p")
  })
})