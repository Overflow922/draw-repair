import { describe, expect, it } from "vitest"
import { DEFAULT_PLAN, PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "./plans"
import type { Drawing } from "./types"

// change mounting-plan: план «Монтаж» в каталоге (spec drawing-plans «Каталог планов», «Инструменты плана»,
// «Переключатель планов»; design D4–D6).

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

describe("каталог планов с планом «Монтаж»", () => {
  // TCR (change add-rough-works-plan): «Монтаж» остаётся третьим, но уже не последним — каталог пополнен планом «Черновые работы»
  it("MP-50: «Монтаж» (mounting) — третий план каталога", () => {
    expect(PLANS).toHaveLength(4)
    expect(PLANS[2]).toEqual({ id: "mounting", label: "Монтаж" })
  })

  it("MP-50: порядок каталога — обмер, демонтаж, монтаж, черновые работы", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting", "rough"])
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
  // change add-communications (drawing-plans «Инструменты плана»): как у обмерочного плана, кроме группы «Коммуникации»
  it("MP-51: набор и порядок инструментов — как у обмерочного плана, кроме «Стояк» и «Воздуховод»", () => {
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("mounting")).toEqual(toolsOf("measure").filter((t) => t !== "riser" && t !== "duct"))
  })

  it("MP-51: «Демонтаж» среди инструментов монтажа нет", () => {
    expect(toolsOf("mounting")).not.toContain("demolition")
  })

  it("MP-52: инструмент по умолчанию — «Стена»", () => {
    expect(defaultToolOf("mounting")).toBe("wall")
    expect(toolsOf("mounting")).toContain(defaultToolOf("mounting"))
  })

  it("MP-52: инструменты других планов не изменились", () => {
    expect(toolsOf("demolition")).toEqual(["demolition", "callout", "ruler", "notes", "eraser"])
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

  // TCR (change add-rough-works-plan): планов четыре
  it("MP-53: ключи планов одного чертежа различны, а у разных чертежей — тоже", () => {
    const keys = PLANS.map((p) => historyKey("a", p.id))
    expect(new Set(keys).size).toBe(4)
    expect(historyKey("a", "mounting")).not.toBe(historyKey("b", "mounting"))
  })
})
