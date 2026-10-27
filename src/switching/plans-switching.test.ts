import { describe, expect, it } from "vitest"
import { calloutsOf, withCallouts } from "../callout/callout-store"
import { notesOf, withNotes } from "../notes/notes-store"
import { PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "../plans"
import type { Callout, Drawing } from "../types"

// change add-switching-plan: план «Группы включения» в каталоге, его инструменты, выноски и примечания
// (spec drawing-plans «Каталог планов», «Инструменты плана»; canvas-app «Группы инструментов»;
// switching-plan «Инструменты плана «Группы включения»»)

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Выключатель у двери" }
const OTHER_PLANS = ["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling"] as const

describe("каталог", () => {
  it("SW-01: «Группы включения» (switching) — девятый, последний план каталога, после «Потолков и освещения»", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling", "switching"])
    expect(PLANS[8]).toEqual({ id: "switching", label: "Группы включения" })
  })

  it("SW-02: isPlanId принимает switching; activePlanOf читает сохранённый switching", () => {
    expect(isPlanId("switching")).toBe(true)
    expect(isPlanId("Switching")).toBe(false)
    expect(activePlanOf(drawing({ activePlan: "switching" }))).toBe("switching")
  })

  it("SW-03: ключ истории — «<id>:switching», ключи других планов прежние", () => {
    expect(historyKey("a", "switching")).toBe("a:switching")
    expect(historyKey("a", "ceiling")).toBe("a:ceiling")
    expect(historyKey("a", "measure")).toBe("a")
  })
})

describe("инструменты", () => {
  it("SW-04: набор — «Выноска», «Линейка», «Примечания», «Ластик»; по умолчанию «Выноска»", () => {
    expect(toolsOf("switching")).toEqual(["callout", "ruler", "notes", "eraser"])
    expect(defaultToolOf("switching")).toBe("callout")
  })

  it("SW-05: инструментов других планов, в том числе «Освещение» и «Натяжной потолок», на плане нет", () => {
    for (const t of ["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "demolition", "plaster", "rightAngle", "screed", "drywall", "furniture", "stretchCeiling", "light"] as const)
      expect(toolsOf("switching")).not.toContain(t)
  })
})

describe("выноски и примечания плана", () => {
  it("SW-06: выноски плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withCallouts(drawing(), "switching", [callout])
    expect(calloutsOf(next, "switching")).toEqual([callout])
    expect(next.switching?.callouts).toEqual([callout])
    for (const plan of OTHER_PLANS) expect(calloutsOf(next, plan)).toEqual([])
    for (const plan of OTHER_PLANS) expect(calloutsOf(withCallouts(drawing(), plan, [callout]), "switching")).toEqual([])
  })

  it("SW-07: примечания плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withNotes(drawing(), "switching", ["Первый"])
    expect(notesOf(next, "switching")).toEqual(["Первый"])
    expect(next.switching?.notes).toEqual(["Первый"])
    for (const plan of OTHER_PLANS) expect(notesOf(next, plan)).toEqual([])
  })

  it("SW-08: запись выносок и примечаний плана не трогает освещение «Потолков и освещения»", () => {
    const lights = [{ id: "l", kind: "spot" as const, x: 10, y: 20 }]
    const base = drawing({ ceiling: { ceilings: [], lights } })
    expect(withCallouts(base, "switching", [callout]).ceiling?.lights).toEqual(lights)
    expect(withNotes(base, "switching", ["x"]).ceiling?.lights).toEqual(lights)
  })
})
