import { describe, expect, it } from "vitest"
import { calloutsOf, withCallouts } from "../callout/callout-store"
import { notesOf, withNotes } from "../notes/notes-store"
import { PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "../plans"
import type { Callout, Drawing } from "../types"

// change add-rough-works-plan: план «Черновые работы» в каталоге, его инструменты, выноски и примечания
// (spec drawing-plans «Каталог планов», «Инструменты плана»; rough-works-plan «Выноски и примечания плана «Черновые работы»»)

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Грунтовка" }

describe("каталог", () => {
  // TCR (change reconstruction-plan): «Реконструкция» идёт после «Черновых работ» и становится последним планом
  it("RW-100: «Черновые работы» (rough) — четвёртый план каталога, за ним «Реконструкция»", () => {
    expect(PLANS[3]).toEqual({ id: "rough", label: "Черновые работы" })
    expect(PLANS[4]).toEqual({ id: "reconstruction", label: "Реконструкция" })
  })

  it("RW-100: isPlanId принимает rough, но не другие написания", () => {
    expect(isPlanId("rough")).toBe(true)
    expect(isPlanId("Rough")).toBe(false)
    expect(isPlanId("Черновые работы")).toBe(false)
  })

  it("RW-101: activePlanOf читает сохранённый rough", () => {
    expect(activePlanOf(drawing({ activePlan: "rough" }))).toBe("rough")
  })

  it("RW-102: ключ истории — «<id>:rough», ключи других планов прежние", () => {
    expect(historyKey("a", "rough")).toBe("a:rough")
    expect(historyKey("a", "measure")).toBe("a")
    expect(historyKey("a", "demolition")).toBe("a:demolition")
    expect(historyKey("a", "mounting")).toBe("a:mounting")
  })
})

describe("инструменты", () => {
  it("RW-103: набор — «Штукатурка», «Стяжка», «Выноска», «Линейка», «Примечания», «Ластик»; по умолчанию «Штукатурка»", () => {
    expect(toolsOf("rough")).toEqual(["plaster", "screed", "callout", "ruler", "notes", "eraser"])
    expect(defaultToolOf("rough")).toBe("plaster")
  })

  it("RW-103: инструментов правки стен, проёмов, размеров, батарей и демонтажа на плане нет", () => {
    for (const t of ["wall", "doorway", "door", "window", "dimension", "battery", "riser", "duct", "demolition"] as const) expect(toolsOf("rough")).not.toContain(t)
  })

  it("RW-104: «Штукатурка» и «Стяжка» есть только на плане «Черновые работы»", () => {
    for (const plan of ["measure", "demolition", "mounting"] as const) {
      expect(toolsOf(plan)).not.toContain("plaster")
      expect(toolsOf(plan)).not.toContain("screed")
    }
  })

  it("RW-105: наборы остальных планов не изменились", () => {
    expect(toolsOf("measure")).toEqual(["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("demolition")).toEqual(["demolition", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "notes", "eraser"])
  })

  it("RW-106: «Выноска», «Линейка», «Примечания» и «Ластик» есть на каждом плане по одному разу", () => {
    for (const plan of PLANS)
      for (const t of ["callout", "ruler", "notes", "eraser"] as const) expect(toolsOf(plan.id).filter((x) => x === t)).toHaveLength(1)
  })
})

describe("выноски и примечания плана", () => {
  it("RW-107: выноски плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withCallouts(drawing(), "rough", [callout])
    expect(calloutsOf(next, "rough")).toEqual([callout])
    for (const plan of ["measure", "demolition", "mounting"] as const) expect(calloutsOf(next, plan)).toEqual([])
    expect(next.mounting).toBeUndefined()
  })

  it("RW-107: выноски других планов на плане «Черновые работы» не видны", () => {
    for (const plan of ["measure", "demolition", "mounting"] as const) expect(calloutsOf(withCallouts(drawing(), plan, [callout]), "rough")).toEqual([])
  })

  it("RW-108: примечания плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withNotes(drawing(), "rough", ["Первый", "Второй"])
    expect(notesOf(next, "rough")).toEqual(["Первый", "Второй"])
    for (const plan of ["measure", "demolition", "mounting"] as const) expect(notesOf(next, plan)).toEqual([])
    expect(next.mounting).toBeUndefined()
  })

  it("RW-108: примечания других планов на плане «Черновые работы» не видны", () => {
    for (const plan of ["measure", "demolition", "mounting"] as const) expect(notesOf(withNotes(drawing(), plan, ["x"]), "rough")).toEqual([])
  })
})
