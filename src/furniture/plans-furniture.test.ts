import { describe, expect, it } from "vitest"
import { calloutsOf, withCallouts } from "../callout/callout-store"
import { notesOf, withNotes } from "../notes/notes-store"
import { PLANS, activePlanOf, defaultToolOf, historyKey, isPlanId, toolsOf } from "../plans"
import type { Callout, Drawing, FurnitureItem } from "../types"

// change furniture-plan-table: план «Мебель» в каталоге, его инструменты, выноски и примечания
// (spec drawing-plans «Каталог планов», «Инструменты плана»; furniture-plan «Инструменты плана «Мебель»»)
// TCR (change furniture-items-catalog): стол стал предметом мебели (Table → FurnitureItem, tables → items, table*.ts → item*.ts) с видом «table»; меняются только имена и вид в данных, утверждения о поведении не менялись

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Стол у окна" }
const table: FurnitureItem = { id: "t", kind: "table", x: 0, y: 0, widthCm: 80, lengthCm: 160, angleDeg: 0 }

describe("каталог", () => {
  it("FP-200: «Мебель» (furniture) — шестой, последний план каталога", () => {
    // TCR (change add-plumbing-plan): после «Мебели» добавлена «Сантехника», она теперь последняя
    expect(PLANS.map((p) => p.id)).toEqual(["measure", "demolition", "mounting", "rough", "reconstruction", "furniture", "plumbing", "ceiling"]) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение»
    expect(PLANS[5]).toEqual({ id: "furniture", label: "Мебель" })
  })

  it("FP-200: isPlanId принимает furniture, но не другие написания", () => {
    expect(isPlanId("furniture")).toBe(true)
    expect(isPlanId("Furniture")).toBe(false)
    expect(isPlanId("Мебель")).toBe(false)
  })

  it("FP-201: activePlanOf читает сохранённый furniture", () => {
    expect(activePlanOf(drawing({ activePlan: "furniture" }))).toBe("furniture")
  })

  it("FP-202: ключ истории — «<id>:furniture», ключи других планов прежние", () => {
    expect(historyKey("a", "furniture")).toBe("a:furniture")
    expect(historyKey("a", "measure")).toBe("a")
    expect(historyKey("a", "reconstruction")).toBe("a:reconstruction")
  })
})

describe("инструменты", () => {
  it("FP-203: набор — «Стол» (группа «Мебель»), «Размер», «Выноска», «Линейка», «Примечания», «Ластик»; по умолчанию «Стол»", () => {
    expect(toolsOf("furniture")).toEqual(["furniture", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(defaultToolOf("furniture")).toBe("furniture")
  })

  it("FP-203: инструментов других планов на плане нет", () => {
    for (const t of ["wall", "doorway", "door", "window", "battery", "riser", "duct", "demolition", "plaster", "rightAngle", "screed", "drywall"] as const)
      expect(toolsOf("furniture")).not.toContain(t)
  })

  it("FP-204: «Стол» есть только на плане «Мебель»", () => {
    for (const plan of ["measure", "demolition", "mounting", "rough", "reconstruction"] as const) expect(toolsOf(plan)).not.toContain("furniture")
  })

  it("FP-205: наборы остальных планов не изменились", () => {
    expect(toolsOf("measure")).toEqual(["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("demolition")).toEqual(["demolition", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("rough")).toEqual(["plaster", "rightAngle", "screed", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("reconstruction")).toEqual(["drywall", "dimension", "callout", "ruler", "notes", "eraser"])
  })

  it("FP-206: «Выноска», «Линейка», «Примечания» и «Ластик» есть на каждом плане по одному разу", () => {
    for (const plan of PLANS)
      for (const t of ["callout", "ruler", "notes", "eraser"] as const) expect(toolsOf(plan.id).filter((x) => x === t)).toHaveLength(1)
  })
})

describe("выноски и примечания плана", () => {
  it("FP-207: выноски плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withCallouts(drawing(), "furniture", [callout])
    expect(calloutsOf(next, "furniture")).toEqual([callout])
    expect(next.furniture?.callouts).toEqual([callout])
    for (const plan of ["measure", "demolition", "mounting", "rough", "reconstruction"] as const) expect(calloutsOf(next, plan)).toEqual([])
    expect(next.reconstruction).toBeUndefined()
    expect(next.mounting).toBeUndefined()
  })

  it("FP-207: выноски других планов на плане «Мебель» не видны", () => {
    for (const plan of ["measure", "demolition", "mounting", "rough", "reconstruction"] as const)
      expect(calloutsOf(withCallouts(drawing(), plan, [callout]), "furniture")).toEqual([])
  })

  it("FP-208: примечания плана лежат в своём списке и не попадают на другие планы", () => {
    const next = withNotes(drawing(), "furniture", ["Первый", "Второй"])
    expect(notesOf(next, "furniture")).toEqual(["Первый", "Второй"])
    expect(next.furniture?.notes).toEqual(["Первый", "Второй"])
    for (const plan of ["measure", "demolition", "mounting", "rough", "reconstruction"] as const) expect(notesOf(next, plan)).toEqual([])
  })

  it("FP-208: запись выносок и примечаний плана не стирает его столы и размеры", () => {
    const base = drawing({ furniture: { items: [table], dimensions: [] } })
    expect(withCallouts(base, "furniture", [callout]).furniture?.items).toEqual([table])
    expect(withNotes(base, "furniture", ["x"]).furniture?.items).toEqual([table])
  })
})
