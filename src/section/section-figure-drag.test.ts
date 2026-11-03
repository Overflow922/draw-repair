import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Point, SectionLine } from "../types"
import { boxPolygon } from "./section-figure-obstacles"
import { createSectionTool } from "./section-tool"
import type { SectionToolHost } from "./section-tool"

// change move-section-figure: жест перемещения фигуры через адаптер инструмента «Разрез»
// (spec section-view «Перемещение фигуры разреза»)

const A: SectionLine = { id: "A1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const P = (x: number, y: number): Point => ({ x, y })

// стена W (100,0)-(300,0) высотой 250: фигура A справа, левая точка пола (400, 5), ширина 200, высота 250; название над ней
const ON_FIGURE = P(450, -100)
const TITLE = { width: 30, height: 14 }

function harness(obstacles: Point[][] = []) {
  let lines: SectionLine[] = [A]
  const history: SectionLine[][] = []
  let changed = 0
  const host: SectionToolHost = {
    lines: () => lines,
    entries: () =>
      reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: lines } })).sections,
    setLines: (next) => {
      lines = next
    },
    recordBefore: (before) => history.push([...before]),
    snap: (p) => p,
    radiusCm: () => 5,
    newId: () => "n",
    selected: () => {},
    changed: () => {
      changed++
    },
    redraw: () => {},
  }
  const tool = createSectionTool(host, () => ({ plan: obstacles, title: TITLE }))
  return { tool, lines: () => lines, history, changed: () => changed }
}

describe("перемещение фигуры жестом", () => {
  it("MSF-50: выделенная фигура уходит за курсором; один шаг истории с исходным списком", () => {
    const h = harness()
    h.tool.select("A1")
    expect(h.tool.beginDrag(ON_FIGURE)).toBe(true)
    h.tool.dragTo(P(450 + 100, -100 + 30))
    h.tool.dragTo(P(450 + 300, -100 + 40))
    h.tool.endDrag()
    expect(h.lines()[0].figureAt).toEqual({ x: 700, y: 45 })
    expect(h.lines()[0].points).toEqual(A.points)
    expect(h.history).toEqual([[A]])
    expect(h.changed()).toBe(1)
    expect(h.tool.isDragging()).toBe(false)
  })

  it("MSF-51: невыделенная фигура не двигается", () => {
    const h = harness()
    expect(h.tool.beginDrag(ON_FIGURE)).toBe(false)
  })

  it("MSF-52: нажатие вне фигуры жест не начинает", () => {
    const h = harness()
    h.tool.select("A1")
    expect(h.tool.beginDrag(P(1000, 1000))).toBe(false)
  })

  it("MSF-53: название тоже даёт начало жеста", () => {
    const h = harness()
    h.tool.select("A1")
    expect(h.tool.beginDrag(P(450, 5 - 250 - 7))).toBe(true)
  })

  it("MSF-54: жест без сдвига не оставляет ни поля позиции, ни шага истории", () => {
    const h = harness()
    h.tool.select("A1")
    h.tool.beginDrag(ON_FIGURE)
    h.tool.endDrag()
    expect(h.lines()).toEqual([A])
    expect(h.history).toEqual([])
    expect(h.changed()).toBe(0)
  })

  it("MSF-55: сдвиг туда и обратно в исходную точку — как без жеста", () => {
    const h = harness()
    h.tool.select("A1")
    h.tool.beginDrag(ON_FIGURE)
    h.tool.dragTo(P(650, -100))
    h.tool.dragTo(ON_FIGURE)
    h.tool.endDrag()
    expect(h.lines()).toEqual([A])
    expect(h.history).toEqual([])
  })

  it("MSF-56: фигура упирается в объект плана и останавливается у его границы", () => {
    const wall = boxPolygon({ minX: 800, minY: -500, maxX: 820, maxY: 500 })
    const h = harness([wall])
    h.tool.select("A1")
    h.tool.beginDrag(ON_FIGURE)
    h.tool.dragTo(P(450 + 1000, -100))
    h.tool.endDrag()
    // фигура шириной 200 справа граничит с x = 800: левая точка пола 600
    expect(h.lines()[0].figureAt?.x).toBe(600)
  })
})
