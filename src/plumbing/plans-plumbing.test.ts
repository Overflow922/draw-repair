import { describe, expect, it } from "vitest"
import { calloutsOf, withCallouts } from "../callout/callout-store"
import { notesOf, withNotes } from "../notes/notes-store"
import { PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "../plans"
import type { Callout, Drawing } from "../types"

// change add-plumbing-plan: план «Сантехника» в каталоге, его инструменты, выноски и примечания
// (spec drawing-plans «Каталог планов», «Инструменты плана»; canvas-app «Группы инструментов»;
// plumbing-plan «Инструменты плана «Сантехника»»)

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Раковина: ХВС, ГВС, К, h=500" }
const OTHER_PLANS = ["measure", "demolition", "mounting", "rough", "reconstruction", "furniture"] as const

describe("каталог", () => {
  it("PL-01: «Сантехника» (plumbing) — седьмой, последний план каталога, после «Мебели»", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling", "switching"]) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения»
    expect(PLANS[6]).toEqual({ id: "plumbing", label: "Сантехника" })
  })

  it("PL-02: isPlanId принимает plumbing, но не другие написания", () => {
    expect(isPlanId("plumbing")).toBe(true)
    expect(isPlanId("Plumbing")).toBe(false)
    expect(isPlanId("Сантехника")).toBe(false)
  })

  it("PL-03: activePlanOf читает сохранённый plumbing", () => {
    expect(activePlanOf(drawing({ activePlan: "plumbing" }))).toBe("plumbing")
  })

  it("PL-04: ключ истории — «<id>:plumbing», ключи других планов прежние", () => {
    expect(historyKey("a", "plumbing")).toBe("a:plumbing")
    expect(historyKey("a", "furniture")).toBe("a:furniture")
    expect(historyKey("a", "measure")).toBe("a")
  })
})

describe("инструменты", () => {
  it("PL-05: набор — «Размер», «Выноска», «Линейка», «Примечания», «Ластик» в этом порядке; по умолчанию «Размер»", () => {
    expect(toolsOf("plumbing")).toEqual(["dimension", "callout", "ruler", "notes", "eraser"])
    expect(defaultToolOf("plumbing")).toBe("dimension")
  })

  it("PL-06: инструментов других планов, в том числе «Мебели», на плане нет", () => {
    for (const t of ["wall", "doorway", "door", "window", "battery", "riser", "duct", "demolition", "plaster", "rightAngle", "screed", "drywall", "furniture"] as const)
      expect(toolsOf("plumbing")).not.toContain(t)
  })

  it("PL-07: наборы остальных планов не изменились", () => {
    expect(toolsOf("measure")).toEqual(["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("demolition")).toEqual(["demolition", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("rough")).toEqual(["plaster", "rightAngle", "screed", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("reconstruction")).toEqual(["drywall", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("furniture")).toEqual(["furniture", "dimension", "callout", "ruler", "notes", "eraser"])
  })
})

describe("выноски и примечания плана", () => {
  it("PL-08: выноски плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withCallouts(drawing(), "plumbing", [callout])
    expect(calloutsOf(next, "plumbing")).toEqual([callout])
    expect(next.plumbing?.callouts).toEqual([callout])
    for (const plan of OTHER_PLANS) expect(calloutsOf(next, plan)).toEqual([])
    expect(next.furniture).toBeUndefined()
  })

  it("PL-08: выноски других планов на плане «Сантехника» не видны", () => {
    for (const plan of OTHER_PLANS) expect(calloutsOf(withCallouts(drawing(), plan, [callout]), "plumbing")).toEqual([])
  })

  it("PL-09: примечания плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withNotes(drawing(), "plumbing", ["Первый"])
    expect(notesOf(next, "plumbing")).toEqual(["Первый"])
    expect(next.plumbing?.notes).toEqual(["Первый"])
    for (const plan of OTHER_PLANS) expect(notesOf(next, plan)).toEqual([])
  })

  it("PL-09: запись выносок и примечаний плана не стирает его размеры", () => {
    const dim = { from: { a: { wallId: "w", edge: 1 }, b: { wallId: "v", edge: 1 } }, to: { a: { wallId: "w", edge: -1 }, b: { wallId: "v", edge: -1 } }, offset: 20 }
    const base = drawing({ plumbing: { dimensions: [dim] } })
    expect(withCallouts(base, "plumbing", [callout]).plumbing?.dimensions).toEqual([dim])
    expect(withNotes(base, "plumbing", ["x"]).plumbing?.dimensions).toEqual([dim])
  })
})
