import { describe, expect, it } from "vitest"
import { calloutsOf, withCallouts } from "../callout/callout-store"
import { notesOf, withNotes } from "../notes/notes-store"
import { PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "../plans"
import type { Callout, Drawing } from "../types"

// change add-ceiling-plan: план «Потолки и освещение» в каталоге, его инструменты, выноски и примечания
// (spec drawing-plans «Каталог планов», «Инструменты плана»; canvas-app «Группы инструментов»;
// ceiling-plan «Инструменты плана «Потолки и освещение»»)

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Светильник над столом" }
const OTHER_PLANS = ["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing"] as const

describe("каталог", () => {
  it("CP-20: «Потолки и освещение» (ceiling) — восьмой, последний план каталога, после «Сантехники»", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling"])
    expect(PLANS[7]).toEqual({ id: "ceiling", label: "Потолки и освещение" })
  })

  it("CP-21: isPlanId принимает ceiling; activePlanOf читает сохранённый ceiling", () => {
    expect(isPlanId("ceiling")).toBe(true)
    expect(isPlanId("Ceiling")).toBe(false)
    expect(activePlanOf(drawing({ activePlan: "ceiling" }))).toBe("ceiling")
  })

  it("CP-22: ключ истории — «<id>:ceiling», ключи других планов прежние", () => {
    expect(historyKey("a", "ceiling")).toBe("a:ceiling")
    expect(historyKey("a", "plumbing")).toBe("a:plumbing")
    expect(historyKey("a", "measure")).toBe("a")
  })
})

describe("инструменты", () => {
  it("CP-23: набор — «Натяжной потолок», «Выноска», «Линейка», «Примечания», «Ластик»; по умолчанию «Натяжной потолок»", () => {
    expect(toolsOf("ceiling")).toEqual(["stretchCeiling", "callout", "ruler", "notes", "eraser"])
    expect(defaultToolOf("ceiling")).toBe("stretchCeiling")
  })

  it("CP-24: инструментов других планов, в том числе «Размер», «Стяжка» и «Мебель», на плане нет", () => {
    for (const t of ["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "demolition", "plaster", "rightAngle", "screed", "drywall", "furniture"] as const)
      expect(toolsOf("ceiling")).not.toContain(t)
  })

  it("CP-25: «Натяжной потолок» есть только на своём плане", () => {
    for (const plan of OTHER_PLANS) expect(toolsOf(plan)).not.toContain("stretchCeiling")
  })
})

describe("выноски и примечания плана", () => {
  it("CP-26: выноски плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withCallouts(drawing(), "ceiling", [callout])
    expect(calloutsOf(next, "ceiling")).toEqual([callout])
    expect(next.ceiling?.callouts).toEqual([callout])
    for (const plan of OTHER_PLANS) expect(calloutsOf(next, plan)).toEqual([])
    for (const plan of OTHER_PLANS) expect(calloutsOf(withCallouts(drawing(), plan, [callout]), "ceiling")).toEqual([])
  })

  it("CP-27: примечания плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withNotes(drawing(), "ceiling", ["Первый"])
    expect(notesOf(next, "ceiling")).toEqual(["Первый"])
    expect(next.ceiling?.notes).toEqual(["Первый"])
    for (const plan of OTHER_PLANS) expect(notesOf(next, plan)).toEqual([])
  })

  it("CP-28: запись выносок и примечаний плана не стирает его потолки", () => {
    const ceilings = [{ id: "s", at: { x: 1, y: 2 }, dropMm: 50 }]
    const base = drawing({ ceiling: { ceilings } })
    expect(withCallouts(base, "ceiling", [callout]).ceiling?.ceilings).toEqual(ceilings)
    expect(withNotes(base, "ceiling", ["x"]).ceiling?.ceilings).toEqual(ceilings)
  })
})
