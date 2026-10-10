import { describe, expect, it } from "vitest"
import { DEFAULT_PLAN, PLANS, activePlanOf, historyKey, isPlanId } from "./plans"
import type { Drawing } from "./types"

// change drawing-plans: каталог планов, нормализация активного плана и ключ истории
// (spec drawing-plans «Каталог планов», «Активный план чертежа»; design D2).

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100, ...extra }) as Drawing

describe("каталог планов", () => {
  // TCR-1 (change demolition-plan): каталог содержит два плана; прежнее ожидание — единственный план measure
  // TCR-1 (change mounting-plan): каталог содержит три плана — «Монтаж» добавлен третьим (drawing-plans «Каталог планов»)
  it("PL-01: каталог содержит «Обмерочный план» (measure), «Демонтаж» (demolition) и «Монтаж» (mounting) в этом порядке", () => {
    expect(PLANS).toEqual([
      { id: "measure", label: "Обмерочный план" },
      { id: "demolition", label: "Демонтаж" },
      { id: "mounting", label: "Монтаж" },
    ])
  })

  it("PL-02: план по умолчанию — measure и он первый в каталоге", () => {
    expect(DEFAULT_PLAN).toBe("measure")
    expect(PLANS[0]?.id).toBe(DEFAULT_PLAN)
  })

  it("PL-02: идентификаторы каталога уникальны, подписи непусты, каждый идентификатор признаётся isPlanId", () => {
    const ids = PLANS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of PLANS) {
      expect(p.label.trim()).not.toBe("")
      expect(isPlanId(p.id)).toBe(true)
    }
  })
})

describe("isPlanId", () => {
  it("PL-03: принимает идентификатор каталога", () => {
    expect(isPlanId("measure")).toBe(true)
  })

  it.each([
    ["неизвестный идентификатор", "unknown-plan"],
    ["пустая строка", ""],
    ["другой регистр", "Measure"],
    ["пробел в начале", " measure"],
    ["название вместо идентификатора", "Обмерочный план"],
    ["число", 5],
    ["null", null],
    ["undefined", undefined],
    ["true", true],
    ["объект", {}],
    ["массив", ["measure"]],
  ])("PL-03: отвергает значение, не являющееся идентификатором плана (%s)", (_name, value) => {
    expect(isPlanId(value)).toBe(false)
  })
})

describe("activePlanOf", () => {
  it("PL-04: чертёж без поля активного плана — measure", () => {
    expect(activePlanOf(drawing())).toBe("measure")
  })

  it("PL-04: сохранённый идентификатор каталога возвращается как есть", () => {
    expect(activePlanOf(drawing({ activePlan: "measure" }))).toBe("measure")
  })

  it.each([
    ["неизвестный идентификатор", "unknown-plan"],
    ["пустая строка", ""],
    ["число", 5],
    ["null", null],
    ["объект", {}],
  ])("PL-04: недопустимое значение поля читается как measure (%s)", (_name, value) => {
    expect(activePlanOf(drawing({ activePlan: value }))).toBe("measure")
  })

  it("PL-04: результат всегда идентификатор каталога", () => {
    for (const value of [undefined, "measure", "x", 1, null, {}]) {
      expect(isPlanId(activePlanOf(drawing({ activePlan: value })))).toBe(true)
    }
  })

  it("PL-04: функция не меняет чертёж", () => {
    const d = drawing({ activePlan: "unknown-plan" })
    const before = structuredClone(d)
    activePlanOf(d)
    expect(d).toEqual(before)
  })
})

describe("historyKey", () => {
  it("PL-05: для обмерочного плана ключ — идентификатор чертежа без суффикса", () => {
    expect(historyKey("a", "measure")).toBe("a")
    expect(historyKey("3f2c9a52-0c6e-4a33-9d3b-6a1b6f4c8e11", "measure")).toBe("3f2c9a52-0c6e-4a33-9d3b-6a1b6f4c8e11")
  })

  it("PL-05: пустой идентификатор чертежа даёт пустой ключ (без суффикса)", () => {
    expect(historyKey("", "measure")).toBe("")
  })

  it("PL-06: разные чертежи дают разные ключи", () => {
    expect(historyKey("a", "measure")).not.toBe(historyKey("b", "measure"))
  })
})
