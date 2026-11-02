import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Point, SectionLine, SectionShape, SectionsState } from "../types"
import { shapesOfLines } from "./section-shape"
import { createSectionShapeTool } from "./section-shape-tool"
import type { SectionShapeHost } from "./section-shape-tool"

// change add-section-shapes: адаптер инструмента «Деталь разреза» с подставным хостом (spec section-view «Инструмент «Деталь
// разреза» и размещение детали», «Выделение, перемещение и правка детали разреза»)
//
//   стена W (100,0)-(300,0) толщиной 10 высотой 250; линия A: x = 200 от y = -100 до y = 100, взгляд right
//   фигура: x 400..600 (s = x - 400, ширина 200), пол y = 100 (z = 100 - y), высота 250, сечения стен s 0..10, 95..105 и 190..200     схематично
const LINE: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const SHELF: SectionShape = { id: "p1", lineId: "L1", s0: 10, s1: 90, z0: 120, z1: 130 }

interface Harness {
  tool: ReturnType<typeof createSectionShapeTool>
  shapes: () => SectionShape[]
  history: SectionsState[]
  selectedCalls: () => number
  bursts: () => number
}

function harness(initial: SectionShape[] = []): Harness {
  let shapes = initial
  const history: SectionsState[] = []
  let selectedCalls = 0
  let burst = false
  let bursts = 0
  const entries = () =>
    reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250), drywall("E1", 100, -95, 300, -95, 10, 250), drywall("E2", 100, 95, 300, 95, 10, 250)], dimensions: [], sections: [LINE], sectionShapes: shapes } })).sections
  const host: SectionShapeHost = {
    lines: () => [LINE],
    shapes: () => shapes,
    entries,
    setShapes: (next) => {
      shapes = next
    },
    recordBefore: (before) => {
      history.push({ sections: [...before.sections], shapes: [...before.shapes] })
      burst = false
    },
    inBurst: () => burst,
    startBurst: () => {
      if (!burst) bursts++
      burst = true
    },
    radiusCm: () => 3,
    newId: () => `id${history.length + 1}`,
    selected: () => {
      selectedCalls++
    },
    changed: () => {},
    redraw: () => {},
  }
  return { tool: createSectionShapeTool(host), shapes: () => shapes, history, selectedCalls: () => selectedCalls, bursts: () => bursts }
}

const world = (s: number, z: number): Point => ({ x: 400 + s, y: 100 - z })

describe("размещение", () => {
  it("SH-700: два клика создают деталь s 10…190, z 120…130; она выделена; один шаг истории", () => {
    const h = harness()
    expect(h.tool.click(world(10, 120))).toBe(true)
    expect(h.tool.hasDraft()).toBe(true)
    expect(h.tool.click(world(190, 130))).toBe(true)
    expect(h.shapes()).toEqual([{ id: "id1", lineId: "L1", s0: 10, s1: 190, z0: 120, z1: 130 }])
    expect(h.tool.selectedId()).toBe("id1")
    expect(h.history).toEqual([{ sections: [LINE], shapes: [] }])
    expect(h.tool.hasDraft()).toBe(false)
    expect(h.selectedCalls()).toBe(1)
  })

  it("SH-701: клик вне фигуры точку не задаёт и шага нет", () => {
    const h = harness()
    expect(h.tool.click({ x: 0, y: 0 })).toBe(false)
    expect(h.tool.hasDraft()).toBe(false)
    expect(h.history).toEqual([])
  })

  it("SH-702: нулевая высота — размещение остаётся на втором шаге", () => {
    const h = harness()
    h.tool.click(world(10, 120))
    expect(h.tool.click(world(190, 120))).toBe(false)
    expect(h.tool.hasDraft()).toBe(true)
    expect(h.shapes()).toEqual([])
  })

  it("SH-703: Esc отменяет: детали нет, шага истории нет", () => {
    const h = harness()
    h.tool.click(world(10, 120))
    h.tool.cancelDraft()
    expect(h.tool.hasDraft()).toBe(false)
    expect(h.shapes()).toEqual([])
    expect(h.history).toEqual([])
  })

  it("SH-704: резинка: прямоугольник до курсора и первый угол", () => {
    const h = harness()
    h.tool.click(world(10, 120))
    h.tool.hover(world(60, 160))
    const preview = h.tool.preview()
    expect(preview?.first).toEqual({ s: 10, z: 120 })
    expect(preview?.shape).toMatchObject({ s0: 10, s1: 60, z0: 120, z1: 160 })
  })
})

describe("выделение и удаление", () => {
  it("SH-710: нажатие по детали выделяет её; мимо — нет", () => {
    const h = harness([SHELF])
    expect(h.tool.press(world(50, 125))).toBe(true)
    expect(h.tool.selectedId()).toBe("p1")
    expect(h.tool.press(world(50, 220))).toBe(false)
  })

  it("SH-711: Delete удаляет выделенную одним шагом; линия и фигура остаются", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    expect(h.tool.deleteSelected()).toBe(true)
    expect(h.shapes()).toEqual([])
    expect(h.history).toEqual([{ sections: [LINE], shapes: [SHELF] }])
    expect(h.tool.selectedId()).toBeNull()
  })

  it("SH-712: ластик удаляет деталь под курсором одним шагом", () => {
    const h = harness([SHELF])
    expect(h.tool.eraseAt(world(50, 125))).toBe(true)
    expect(h.shapes()).toEqual([])
    expect(h.history).toHaveLength(1)
    expect(h.tool.eraseAt(world(50, 125))).toBe(false)
  })

  it("SH-713: Delete без выделения ничего не делает", () => {
    const h = harness([SHELF])
    expect(h.tool.deleteSelected()).toBe(false)
    expect(h.history).toEqual([])
  })
})

describe("правка", () => {
  it("SH-720: ввод ширины 40 см меняет размер вокруг центра одним шагом", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    expect(h.tool.applyNumber({ kind: "size", size: "width" }, 40)).toBe(true)
    expect(h.shapes()[0]).toMatchObject({ s0: 30, s1: 70 })
    expect(h.history).toHaveLength(1)
  })

  it("SH-721: недопустимое число деталь не меняет и шага не создаёт", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    expect(h.tool.applyNumber({ kind: "size", size: "width" }, 0)).toBe(false)
    expect(h.tool.applyNumber({ kind: "size", size: "width" }, 500)).toBe(false)
    expect(h.shapes()).toEqual([SHELF])
    expect(h.history).toEqual([])
  })

  it("SH-722: ввод расстояния снизу 150 ставит низ на z = 150", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    expect(h.tool.applyNumber({ kind: "gap", side: "bottom" }, 150)).toBe(true)
    expect(h.shapes()[0]).toMatchObject({ z0: 150, z1: 160 })
  })

  it("SH-723: стрелка вверх сдвигает на 10 см, Shift — на 1 см, влево", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    expect(h.tool.nudge("ArrowUp", false)).toBe(true)
    expect(h.shapes()[0]).toMatchObject({ z0: 130, z1: 140 })
    expect(h.tool.nudge("ArrowLeft", true)).toBe(true)
    expect(h.shapes()[0]).toMatchObject({ s0: 9, s1: 89 })
  })

  it("SH-724: серия стрелок по одной детали — одна запись истории", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    for (let i = 0; i < 5; i++) h.tool.nudge("ArrowRight", false)
    expect(h.shapes()[0]).toMatchObject({ s0: 60, s1: 140 })
    expect(h.history).toEqual([{ sections: [LINE], shapes: [SHELF] }])
    expect(h.bursts()).toBe(1)
  })

  it("SH-725: сдвиг стрелкой за пределы фигуры ничего не меняет, клавиша принята", () => {
    const top: SectionShape = { ...SHELF, z0: 240, z1: 250 }
    const h = harness([top])
    h.tool.select("p1")
    expect(h.tool.nudge("ArrowUp", false)).toBe(true)
    expect(h.shapes()).toEqual([top])
    expect(h.history).toEqual([])
  })

  it("SH-726: стрелки без выделения не принимаются", () => {
    const h = harness([SHELF])
    expect(h.tool.nudge("ArrowUp", false)).toBe(false)
    expect(h.shapes()).toEqual([SHELF])
  })
})

describe("перетаскивание", () => {
  it("SH-730: жест на 50 см вправо — один шаг, деталь сдвинута", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    expect(h.tool.beginDrag(world(50, 125))).toBe(true)
    h.tool.dragTo(world(70, 125))
    h.tool.dragTo(world(100, 125))
    h.tool.endDrag()
    expect(h.shapes()[0]).toMatchObject({ s0: 60, s1: 140 })
    expect(h.history).toEqual([{ sections: [LINE], shapes: [SHELF] }])
    expect(h.tool.isDragging()).toBe(false)
  })

  it("SH-731: жест, не сдвинувший деталь, шага не создаёт", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    h.tool.beginDrag(world(50, 125))
    h.tool.dragTo(world(80, 125))
    h.tool.dragTo(world(50, 125))
    h.tool.endDrag()
    expect(h.shapes()).toEqual([SHELF])
    expect(h.history).toEqual([])
  })

  it("SH-732: тянуть можно только выделенную деталь за её тело", () => {
    const h = harness([SHELF])
    expect(h.tool.beginDrag(world(50, 125))).toBe(false)
    h.tool.select("p1")
    expect(h.tool.beginDrag(world(50, 220))).toBe(false)
  })

  it("SH-734: правый край рядом с гранью сечения притягивается к ней при перетаскивании", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    h.tool.beginDrag(world(50, 125))
    h.tool.dragTo(world(54.4, 125)) // правый край 94,4 в радиусе 3 от грани s = 95
    h.tool.endDrag()
    expect(h.shapes()[0]).toMatchObject({ s0: 15, s1: 95, z0: 120, z1: 130 })
  })

  it("SH-733: у границы фигуры деталь останавливается", () => {
    const h = harness([SHELF])
    h.tool.select("p1")
    h.tool.beginDrag(world(50, 125))
    h.tool.dragTo(world(1050, 125))
    h.tool.endDrag()
    expect(h.shapes()[0]).toMatchObject({ s0: 120, s1: 200 })
  })
})

describe("детали уходят вместе с линией", () => {
  it("SH-740: без линии детали не остаётся", () => {
    expect(shapesOfLines([SHELF, { ...SHELF, id: "p2", lineId: "OTHER" }], [LINE])).toEqual([SHELF])
    expect(shapesOfLines([SHELF], [])).toEqual([])
  })
})
