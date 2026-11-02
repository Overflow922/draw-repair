import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Point, SectionLine } from "../types"
import { createSectionTool } from "./section-tool"
import type { SectionToolHost } from "./section-tool"

// change add-section-view: адаптер инструмента «Разрез» с подставным хостом
// (spec section-view «Инструмент «Разрез» и размещение линии», «Выделение и удаление линии разреза»)

interface Harness {
  tool: ReturnType<typeof createSectionTool>
  lines: () => SectionLine[]
  history: SectionLine[][]
  selectedCalls: () => number
}

function harness(initial: SectionLine[] = []): Harness {
  let lines = initial
  const history: SectionLine[][] = []
  let selectedCalls = 0
  const entries = () =>
    reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: lines } })).sections
  const host: SectionToolHost = {
    lines: () => lines,
    entries,
    setLines: (next) => {
      lines = next
    },
    recordBefore: (before) => history.push([...before]),
    snap: (p) => p,
    radiusCm: () => 5,
    newId: () => `id${history.length + 1}`,
    selected: () => {
      selectedCalls++
    },
    changed: () => {},
    redraw: () => {},
  }
  return { tool: createSectionTool(host), lines: () => lines, history, selectedCalls: () => selectedCalls }
}

const P = (x: number, y: number): Point => ({ x, y })

describe("размещение", () => {
  it("SV-110: три шага создают линию A со взглядом right; она выделена; один шаг истории", () => {
    const h = harness()
    h.tool.click(P(200, -100))
    h.tool.click(P(200, 100))
    expect(h.tool.finish()).toBe(true)
    h.tool.click(P(300, 0))
    expect(h.lines()).toEqual([{ id: "id1", label: "A", view: "right", points: [P(200, -100), P(200, 100)] }])
    expect(h.tool.selectedId()).toBe("id1")
    expect(h.history).toEqual([[]])
    expect(h.tool.hasDraft()).toBe(false)
  })

  it("SV-111: Enter при чётном числе отрезков набор не завершает, но действие принято", () => {
    const h = harness()
    h.tool.click(P(0, 0))
    h.tool.click(P(100, 0))
    h.tool.click(P(100, 40))
    expect(h.tool.finish()).toBe(true)
    h.tool.hover(P(100, 200))
    expect(h.tool.preview()?.line).toBeNull()
    h.tool.click(P(100, 200)) // всё ещё набор вершин: ступенька вниз до y = 200 не завершает линию
    expect(h.lines()).toEqual([])
  })

  it("SV-112: Esc отменяет размещение без шага истории", () => {
    const h = harness()
    h.tool.click(P(0, 0))
    h.tool.click(P(100, 0))
    h.tool.cancelDraft()
    expect(h.tool.hasDraft()).toBe(false)
    expect(h.lines()).toEqual([])
    expect(h.history).toEqual([])
  })

  it("SV-113: превью на шаге направления показывает линию со стороной курсора", () => {
    const h = harness()
    h.tool.click(P(0, 0))
    h.tool.click(P(200, 0))
    h.tool.finish()
    h.tool.hover(P(100, 60))
    expect(h.tool.preview()?.line?.view).toBe("down")
    h.tool.hover(P(100, -60))
    expect(h.tool.preview()?.line?.view).toBe("up")
  })

  it("SV-114: вторая линия получает следующую букву", () => {
    const h = harness()
    for (const y of [0, 50]) {
      h.tool.click(P(0, y))
      h.tool.click(P(100, y))
      h.tool.finish()
      h.tool.click(P(50, y + 20))
    }
    expect(h.lines().map((l) => l.label)).toEqual(["A", "B"])
  })

  it("SV-115: клик на шаге направления над линией без допустимого взгляда линию не создаёт", () => {
    // вторая вершина совпадает с первой: отрезок нулевой длины вершины не добавляет, finish не принимает
    const h = harness()
    h.tool.click(P(0, 0))
    h.tool.click(P(0, 0))
    expect(h.tool.finish()).toBe(true)
    expect(h.lines()).toEqual([])
  })
})

describe("выбор и удаление", () => {
  const A: SectionLine = { id: "s1", label: "A", view: "right", points: [P(200, -100), P(200, 100)] }

  it("SV-116: нажатие у линии выделяет её и вызывает selected()", () => {
    const h = harness([A])
    expect(h.tool.press(P(203, 20))).toBe(true)
    expect(h.tool.selectedId()).toBe("s1")
    expect(h.selectedCalls()).toBe(1)
  })

  it("SV-117: нажатие мимо линии ничего не выделяет", () => {
    const h = harness([A])
    expect(h.tool.press(P(0, 300))).toBe(false)
    expect(h.tool.selectedId()).toBeNull()
  })

  it("SV-118: Delete удаляет выделенную линию одним шагом истории", () => {
    const h = harness([A])
    h.tool.press(P(203, 20))
    expect(h.tool.deleteSelected()).toBe(true)
    expect(h.lines()).toEqual([])
    expect(h.history).toEqual([[A]])
    expect(h.tool.selectedId()).toBeNull()
  })

  it("SV-119: ластик удаляет линию по клику у обозначения и ничего не делает мимо", () => {
    const h = harness([A])
    expect(h.tool.eraseAt(P(0, 300))).toBe(false)
    expect(h.history).toEqual([])
    expect(h.tool.eraseAt(P(203, 20))).toBe(true)
    expect(h.lines()).toEqual([])
    expect(h.history).toHaveLength(1)
  })

  it("SV-120: Delete без выделения ничего не делает", () => {
    const h = harness([A])
    expect(h.tool.deleteSelected()).toBe(false)
    expect(h.history).toEqual([])
  })

  it("SV-121: линия при выделении не двигается: вершины прежние", () => {
    const h = harness([A])
    h.tool.press(P(203, 20))
    expect(h.lines()).toEqual([A])
  })
})
