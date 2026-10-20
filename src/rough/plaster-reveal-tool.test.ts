import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { setup } from "./plaster-tool.test-utils"
import type { Setup } from "./plaster-tool.test-utils"
import { doorOn, drawing, openingOn, plaster, reveal, windowOn } from "./rough.test-utils"

// change plaster-opening-reveals: инструмент «Штукатурка» — наведение, клик и протяжка по откосу
// (spec rough-works-plan «Штукатурка откосов проёма»). Стена W (0,0)-(500,0), 20 см; радиус попадания в хосте — 5 см.

const at = (x: number, y: number): Point => ({ x, y })
const WIN = windowOn("win", "W", 100, 120) // откосы x = 100 и x = 220

const click = (s: Setup, p: Point): string | null => {
  s.tool.down(at(0, 0))
  return s.tool.up(p, at(1, 1))
}

describe("подсветка откоса", () => {
  it("RV-10: курсор на теле стены у откоса — подсвечивается превью откоса, пометки и записи истории нет", () => {
    const s = setup(drawing({ doorways: [WIN] }))
    s.tool.hover(at(101, 5))
    const ghost = s.tool.ghost()
    expect(ghost?.pieces.map((x) => x.face)).toEqual(["reveal"])
    expect(ghost?.thicknessMm).toBe(20)
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("RV-10: курсор ушёл — подсветка пропала", () => {
    const s = setup(drawing({ doorways: [WIN] }))
    s.tool.hover(at(101, 5))
    s.tool.hover(null)
    expect(s.tool.ghost()).toBeNull()
  })

  it("RV-11: между двумя узкими откосами цель — ближайший откос", () => {
    const s = setup(drawing({ doorways: [openingOn("op", "W", 100, 8)] })) // откосы x = 100 и x = 108
    s.tool.hover(at(105, 0))
    s.tool.hover(at(105, 0))
    const [piece] = s.tool.ghost()?.pieces ?? []
    expect(piece?.face === "reveal" ? piece.jamb : null).toBe("b")
  })

  it("RV-12: курсор вне тела стены против проёма — целью остаётся грань", () => {
    const s = setup(drawing({ doorways: [WIN] }))
    s.tool.hover(at(101, 14))
    expect(s.tool.ghost()?.pieces.map((x) => x.face)).toEqual([1])
  })

  it("RV-12: курсор на теле стены вдали от откосов — цель грань, как раньше", () => {
    const s = setup(drawing({ doorways: [WIN] }))
    s.tool.hover(at(160, 3))
    expect(s.tool.ghost()?.pieces.map((x) => x.face)).toEqual([1])
  })
})

describe("постановка откоса", () => {
  it("RV-13: клик у откоса a ставит одну пометку, одна запись истории, пометка не выделена, подсветки нет", () => {
    const s = setup(drawing({ doorways: [WIN] }))
    const placed = click(s, at(101, 5))
    expect(s.marks().map((m) => (m.face === "reveal" ? [m.elementId, m.jamb, m.thicknessMm] : null))).toEqual([["win", "a", 20]])
    expect(s.log.records).toBe(1)
    expect(s.log.changes).toBe(1)
    expect(s.tool.selectedId()).toBeNull()
    expect(placed).toBe(s.marks()[0]?.id)
  })

  it("RV-13: второй клик у откоса b ставит вторую пометку — две записи истории", () => {
    const s = setup(drawing({ doorways: [WIN] }))
    click(s, at(101, 5))
    click(s, at(219, -3))
    expect(s.marks().map((m) => (m.face === "reveal" ? m.jamb : null))).toEqual(["a", "b"])
    expect(s.log.records).toBe(2)
  })

  it("RV-13: откос ставится и на проём, и на дверь", () => {
    const s = setup(drawing({ doorways: [openingOn("op", "W", 100, 90), doorOn("dr", "W", 300, 90)] }))
    click(s, at(101, 0))
    click(s, at(389, 0))
    expect(s.marks().map((m) => (m.face === "reveal" ? [m.elementId, m.jamb] : null))).toEqual([
      ["op", "a"],
      ["dr", "b"],
    ])
  })

  it("RV-13: откос на собственном окне «Монтажа»", () => {
    const own = { id: "N", a: at(0, 300), b: at(400, 300), thicknessCm: 20, type: "brick" as const }
    const s = setup(drawing({ mounting: { walls: [own], dimensions: [], doorways: [windowOn("mw", "N", 50, 100)] } }))
    click(s, at(51, 300))
    expect(s.marks().map((m) => (m.face === "reveal" ? [m.elementId, m.jamb] : null))).toEqual([["mw", "a"]])
  })

  it("RV-14: повторный клик по оштукатуренному откосу ничего не меняет, записи истории нет", () => {
    const s = setup(drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 45)] }))
    const before = s.marks()
    expect(click(s, at(101, 5))).toBeNull()
    expect(s.marks()).toBe(before)
    expect(s.log.records).toBe(0)
  })

  it("RV-14: клик по грани рядом не затрагивает откос", () => {
    const s = setup(drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] }))
    click(s, at(101, 14))
    expect(s.marks().filter((m) => m.face === "reveal")).toHaveLength(1)
    expect(s.marks().filter((m) => m.face === 1)).toHaveLength(1)
  })

  it("RV-15: нажатие у откоса и протяжка дальше мёртвой зоны ничего не ставят", () => {
    const s = setup(drawing({ doorways: [WIN] }))
    s.tool.down(at(0, 0), at(101, 5))
    s.tool.move(at(150, 5), at(30, 0))
    expect(s.tool.up(at(150, 5), at(30, 0))).toBeNull()
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(0)
  })

  it("RV-16: клик по грани других стен не создаёт откосов", () => {
    const s = setup(drawing({ doorways: [WIN], roughPlaster: [plaster("p", "W", 1, "a", 0, 50, 20)] }))
    click(s, at(400, 14))
    expect(s.marks().some((m) => m.face === "reveal")).toBe(false)
  })
})
