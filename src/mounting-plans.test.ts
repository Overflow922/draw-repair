import { describe, expect, it } from "vitest"
import { DEFAULT_PLAN, PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "./plans"
import type { Drawing } from "./types"

// change mounting-plan: план «Монтаж» в каталоге (spec drawing-plans «Каталог планов», «Инструменты плана»,
// «Переключатель планов»; design D4–D6).

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100, ...extra }) as Drawing

describe("каталог планов с планом «Монтаж»", () => {
  it("MP-50: «Монтаж» (mounting) — третий и последний план каталога", () => {
    expect(PLANS).toHaveLength(3)
    expect(PLANS[2]).toEqual({ id: "mounting", label: "Монтаж" })
  })

  it("MP-50: порядок каталога — обмер, демонтаж, монтаж", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting"])
  })

  it("MP-50: план по умолчанию остаётся measure", () => {
    expect(DEFAULT_PLAN).toBe("measure")
  })

  it("MP-50: isPlanId принимает mounting, но не другие написания", () => {
    expect(isPlanId("mounting")).toBe(true)
    expect(isPlanId("Mounting")).toBe(false)
    expect(isPlanId("Монтаж")).toBe(false)
  })

  it("MP-50: activePlanOf читает сохранённый mounting; без поля — measure", () => {
    expect(activePlanOf(drawing({ activePlan: "mounting" }))).toBe("mounting")
    expect(activePlanOf(drawing())).toBe("measure")
    expect(activePlanOf(drawing({ activePlan: "mounting-plan" }))).toBe("measure")
  })
})

describe("инструменты плана «Монтаж»", () => {
  it("MP-51: набор и порядок инструментов — как у обмерочного плана", () => {
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "dimension", "ruler", "eraser"])
    expect(toolsOf("mounting")).toEqual(toolsOf("measure"))
  })

  it("MP-51: «Демонтаж» среди инструментов монтажа нет", () => {
    expect(toolsOf("mounting")).not.toContain("demolition")
  })

  it("MP-52: инструмент по умолчанию — «Стена»", () => {
    expect(defaultToolOf("mounting")).toBe("wall")
    expect(toolsOf("mounting")).toContain(defaultToolOf("mounting"))
  })

  it("MP-52: инструменты других планов не изменились", () => {
    expect(toolsOf("demolition")).toEqual(["demolition", "ruler", "eraser"])
    expect(defaultToolOf("demolition")).toBe("demolition")
    expect(defaultToolOf("measure")).toBe("wall")
  })
})

describe("ключ истории плана «Монтаж»", () => {
  it("MP-53: ключ — «<id>:mounting»; ключи обмера и демонтажа прежние", () => {
    expect(historyKey("a", "mounting")).toBe("a:mounting")
    expect(historyKey("a", "measure")).toBe("a")
    expect(historyKey("a", "demolition")).toBe("a:demolition")
  })

  it("MP-53: ключи трёх планов одного чертежа различны, а у разных чертежей — тоже", () => {
    const keys = PLANS.map((p) => historyKey("a", p.id))
    expect(new Set(keys).size).toBe(3)
    expect(historyKey("a", "mounting")).not.toBe(historyKey("b", "mounting"))
  })
})
