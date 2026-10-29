import { describe, expect, it } from "vitest"
import { calloutsOf, withCallouts } from "../callout/callout-store"
import { notesOf, withNotes } from "../notes/notes-store"
import { PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "../plans"
import type { Callout, Drawing } from "../types"

// change add-electrical-plan: план «Электрооборудование» в каталоге, его инструменты, выноски и примечания
// (spec drawing-plans «Каталог планов», «Инструменты плана»; electrical-plan «Инструменты плана «Электрооборудование»»)

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "h=900" }
const OTHER_PLANS = ["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling"] as const

describe("каталог", () => {
  it("EP-01: «Электрооборудование» (electrical) — девятый, последний план каталога, после «Потолков и освещения»", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling", "electrical"])
    expect(PLANS[8]).toEqual({ id: "electrical", label: "Электрооборудование" })
  })

  it("EP-02: isPlanId принимает electrical, но не другие написания", () => {
    expect(isPlanId("electrical")).toBe(true)
    expect(isPlanId("Electrical")).toBe(false)
    expect(isPlanId("Электрооборудование")).toBe(false)
  })

  it("EP-03: activePlanOf читает сохранённый electrical", () => {
    expect(activePlanOf(drawing({ activePlan: "electrical" }))).toBe("electrical")
  })

  it("EP-04: ключ истории — «<id>:electrical», ключи других планов прежние", () => {
    expect(historyKey("a", "electrical")).toBe("a:electrical")
    expect(historyKey("a", "ceiling")).toBe("a:ceiling")
    expect(historyKey("a", "measure")).toBe("a")
  })
})

describe("инструменты", () => {
  it("EP-05: набор — «Выноска», «Линейка», «Примечания», «Ластик» в этом порядке; по умолчанию «Выноска»", () => {
    expect(toolsOf("electrical")).toEqual(["callout", "ruler", "notes", "eraser"])
    expect(defaultToolOf("electrical")).toBe("callout")
  })

  it("EP-06: инструментов других планов, в том числе «Размера» и «Выключателя», на плане нет", () => {
    for (const t of ["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "demolition", "plaster", "rightAngle", "screed", "drywall", "furniture", "stretchCeiling", "light", "lightLine", "lightSwitch", "exhaust"] as const)
      expect(toolsOf("electrical")).not.toContain(t)
  })

  it("EP-07: наборы остальных планов не изменились", () => {
    expect(toolsOf("plumbing")).toEqual(["dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("ceiling")).toEqual(["stretchCeiling", "light", "lightLine", "lightSwitch", "exhaust", "callout", "ruler", "notes", "eraser"])
  })
})

describe("выноски и примечания плана", () => {
  it("EP-08: выноски плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withCallouts(drawing(), "electrical", [callout])
    expect(calloutsOf(next, "electrical")).toEqual([callout])
    expect(next.electrical?.callouts).toEqual([callout])
    for (const plan of OTHER_PLANS) expect(calloutsOf(next, plan)).toEqual([])
  })

  it("EP-08: выноски других планов на плане «Электрооборудование» не видны", () => {
    for (const plan of OTHER_PLANS) expect(calloutsOf(withCallouts(drawing(), plan, [callout]), "electrical")).toEqual([])
  })

  it("EP-09: примечания плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withNotes(drawing(), "electrical", ["Первый"])
    expect(notesOf(next, "electrical")).toEqual(["Первый"])
    expect(next.electrical?.notes).toEqual(["Первый"])
    for (const plan of OTHER_PLANS) expect(notesOf(next, plan)).toEqual([])
  })

  it("EP-09: запись выносок не стирает примечания плана и наоборот", () => {
    const withNote = withNotes(drawing(), "electrical", ["x"])
    expect(withCallouts(withNote, "electrical", [callout]).electrical?.notes).toEqual(["x"])
    const withCall = withCallouts(drawing(), "electrical", [callout])
    expect(withNotes(withCall, "electrical", ["y"]).electrical?.callouts).toEqual([callout])
  })
})
