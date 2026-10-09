import { describe, expect, it } from "vitest"
import { DEFAULT_PLAN, PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "./plans"
import type { Drawing } from "./types"

// change demolition-plan: наборы инструментов планов и план «Демонтаж» в каталоге
// (spec drawing-plans «Инструменты плана», «Каталог планов»; design D1).

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100, ...extra }) as Drawing

const sorted = (xs: readonly string[]): string[] => [...xs].sort()

describe("наборы инструментов", () => {
  it("PT-02: обмерочный план — «Стена», «Проём», «Дверь», «Окно», «Размер», «Линейка», «Ластик»", () => {
    expect(sorted(toolsOf("measure"))).toEqual(sorted(["wall", "doorway", "door", "window", "dimension", "ruler", "eraser"]))
  })

  it("PT-02: план «Демонтаж» — только «Демонтаж» и «Линейка»", () => {
    expect(sorted(toolsOf("demolition"))).toEqual(sorted(["demolition", "ruler"]))
  })

  it("PT-02: инструменты планов пересекаются только по «Линейке»", () => {
    const common = toolsOf("measure").filter((t) => toolsOf("demolition").includes(t))
    expect(common).toEqual(["ruler"])
  })

  it("PT-02: в наборе плана «Демонтаж» нет инструментов правки стен", () => {
    for (const t of ["wall", "doorway", "door", "window", "dimension", "eraser"] as const) expect(toolsOf("demolition")).not.toContain(t)
  })

  it("PT-02: в наборе обмерочного плана нет инструмента «Демонтаж»", () => {
    expect(toolsOf("measure")).not.toContain("demolition")
  })

  it("PT-02: набор без дублей и непуст у каждого плана каталога", () => {
    for (const p of PLANS) {
      const tools = toolsOf(p.id)
      expect(tools.length).toBeGreaterThan(0)
      expect(new Set(tools).size).toBe(tools.length)
    }
  })
})

describe("инструмент по умолчанию", () => {
  it("PT-03: «Стена» на обмерочном плане, «Демонтаж» на плане «Демонтаж»", () => {
    expect(defaultToolOf("measure")).toBe("wall")
    expect(defaultToolOf("demolition")).toBe("demolition")
  })

  it("PT-03: инструмент по умолчанию входит в набор своего плана", () => {
    for (const p of PLANS) expect(toolsOf(p.id)).toContain(defaultToolOf(p.id))
  })
})

describe("план «Демонтаж» в каталоге", () => {
  it("PT-01: каталог — «Обмерочный план», затем «Демонтаж»", () => {
    expect(PLANS.map((p) => [p.id, p.label])).toEqual([
      ["measure", "Обмерочный план"],
      ["demolition", "Демонтаж"],
    ])
  })

  it("PT-04: isPlanId принимает demolition", () => {
    expect(isPlanId("demolition")).toBe(true)
    expect(isPlanId("Demolition")).toBe(false)
    expect(isPlanId("Демонтаж")).toBe(false)
  })

  it("PT-04: activePlanOf читает сохранённый demolition; план по умолчанию остаётся measure", () => {
    expect(activePlanOf(drawing({ activePlan: "demolition" }))).toBe("demolition")
    expect(activePlanOf(drawing())).toBe("measure")
    expect(DEFAULT_PLAN).toBe("measure")
  })

  it("PT-04: ключ истории плана «Демонтаж» — «<id>:demolition», обмерочного — «<id>»", () => {
    expect(historyKey("a", "demolition")).toBe("a:demolition")
    expect(historyKey("a", "measure")).toBe("a")
    expect(historyKey("a", "demolition")).not.toBe(historyKey("b", "demolition"))
  })

  it("PT-04: ключи всех планов одного чертежа различны", () => {
    const keys = PLANS.map((p) => historyKey("a", p.id))
    expect(new Set(keys).size).toBe(keys.length)
  })
})
