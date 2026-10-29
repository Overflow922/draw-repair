import { describe, expect, it } from "vitest"
import { calloutsOf, withCallouts } from "../callout/callout-store"
import { notesOf, withNotes } from "../notes/notes-store"
import { PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "../plans"
import type { Callout, Drawing } from "../types"

// change reconstruction-plan: план «Реконструкция» в каталоге, его инструменты, выноски и примечания
// (spec drawing-plans «Каталог планов», «Инструменты плана»; reconstruction-plan «Инструменты плана «Реконструкция»»)

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Обшить ГКЛ" }

describe("каталог", () => {
  it("RC-100: «Реконструкция» (reconstruction) — пятый, последний план каталога", () => {
    // TCR (change furniture-plan-table): после «Реконструкции» добавлена «Мебель», она теперь последняя
    // TCR (change add-plumbing-plan): седьмой добавлена «Сантехника»
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling", "electrical"]) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change merge-lighting-plans): снова восемь — план «Группы включения» слит с «Потолками и освещением» // TCR (change add-electrical-plan): девять — девятый план «Электрооборудование»
    expect(PLANS[4]).toEqual({ id: "reconstruction", label: "Реконструкция" })
  })

  it("RC-100: isPlanId принимает reconstruction, но не другие написания", () => {
    expect(isPlanId("reconstruction")).toBe(true)
    expect(isPlanId("Reconstruction")).toBe(false)
    expect(isPlanId("Реконструкция")).toBe(false)
  })

  it("RC-101: activePlanOf читает сохранённый reconstruction", () => {
    expect(activePlanOf(drawing({ activePlan: "reconstruction" }))).toBe("reconstruction")
  })

  it("RC-102: ключ истории — «<id>:reconstruction», ключи других планов прежние", () => {
    expect(historyKey("a", "reconstruction")).toBe("a:reconstruction")
    expect(historyKey("a", "measure")).toBe("a")
    expect(historyKey("a", "rough")).toBe("a:rough")
  })
})

describe("инструменты", () => {
  it("RC-103: набор — «Гипсокартон», «Размер», «Выноска», «Линейка», «Примечания», «Ластик»; по умолчанию «Гипсокартон»", () => {
    expect(toolsOf("reconstruction")).toEqual(["drywall", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(defaultToolOf("reconstruction")).toBe("drywall")
  })

  it("RC-103: инструментов стены, проёмов, окна, батареи, коммуникаций, демонтажа, штукатурки и стяжки на плане нет", () => {
    for (const t of ["wall", "doorway", "door", "window", "battery", "riser", "duct", "demolition", "plaster", "screed"] as const)
      expect(toolsOf("reconstruction")).not.toContain(t)
  })

  it("RC-104: «Гипсокартон» есть только на плане «Реконструкция»", () => {
    for (const plan of ["measure", "demolition", "mounting", "rough"] as const) expect(toolsOf(plan)).not.toContain("drywall")
  })

  it("RC-105: наборы остальных планов не изменились", () => {
    expect(toolsOf("measure")).toEqual(["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("demolition")).toEqual(["demolition", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "notes", "eraser"])
    // change plaster-right-angle (canvas-app «Группы инструментов»): набор «Черновых работ» дополнен «Прямым углом»
    expect(toolsOf("rough")).toEqual(["plaster", "rightAngle", "screed", "callout", "ruler", "notes", "eraser"])
  })

  it("RC-106: «Выноска», «Линейка», «Примечания» и «Ластик» есть на каждом плане по одному разу", () => {
    for (const plan of PLANS)
      for (const t of ["callout", "ruler", "notes", "eraser"] as const) expect(toolsOf(plan.id).filter((x) => x === t)).toHaveLength(1)
  })
})

describe("выноски и примечания плана", () => {
  it("RC-107: выноски плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withCallouts(drawing(), "reconstruction", [callout])
    expect(calloutsOf(next, "reconstruction")).toEqual([callout])
    expect(next.reconstruction?.callouts).toEqual([callout])
    for (const plan of ["measure", "demolition", "mounting", "rough"] as const) expect(calloutsOf(next, plan)).toEqual([])
    expect(next.mounting).toBeUndefined()
    expect(next.roughCallouts).toBeUndefined()
  })

  it("RC-107: выноски других планов на плане «Реконструкция» не видны", () => {
    for (const plan of ["measure", "demolition", "mounting", "rough"] as const)
      expect(calloutsOf(withCallouts(drawing(), plan, [callout]), "reconstruction")).toEqual([])
  })

  it("RC-108: примечания плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withNotes(drawing(), "reconstruction", ["Первый", "Второй"])
    expect(notesOf(next, "reconstruction")).toEqual(["Первый", "Второй"])
    expect(next.reconstruction?.notes).toEqual(["Первый", "Второй"])
    for (const plan of ["measure", "demolition", "mounting", "rough"] as const) expect(notesOf(next, plan)).toEqual([])
  })

  it("RC-108: запись выносок и примечаний плана не стирает его стены и размеры", () => {
    const wall = { id: "g", a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thicknessCm: 10, type: "gkl", heightCm: 250 }
    const base = drawing({ reconstruction: { walls: [wall], dimensions: [] } })
    expect(withCallouts(base, "reconstruction", [callout]).reconstruction?.walls).toEqual([wall])
    expect(withNotes(base, "reconstruction", ["x"]).reconstruction?.walls).toEqual([wall])
  })
})
