import { describe, expect, it } from "vitest"
import { plasterPieces } from "./plaster"
import { revealDimension } from "./plaster-reveal"
import { setup } from "./plaster-tool.test-utils"
import { drawing, reveal, windowOn } from "./rough.test-utils"
import { mountingScene } from "../mounting/mounting-scene"
import type { Point } from "../types"

// change plaster-opening-reveals: выделение, правка толщины, удаление, ластик и размер откоса
// (spec rough-works-plan «Штукатурка откосов проёма», сценарии «Выделение и правка толщины», «Удаление откоса»)

const at = (x: number, y: number): Point => ({ x, y })
const WIN = windowOn("win", "W", 100, 120) // откосы x = 100 и x = 220, стена W 20 см
const withReveal = () => setup(drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] }))

describe("выделение и правка откоса", () => {
  it("RV-20: клик по полосе откоса выделяет пометку", () => {
    const s = withReveal()
    expect(s.tool.select(at(101, 0))).toBe(true)
    expect(s.tool.selectedId()).toBe("r")
    expect(s.tool.selectedMark()?.face).toBe("reveal")
  })

  it("RV-20: клик мимо полосы снимает выделение", () => {
    const s = withReveal()
    s.tool.select(at(101, 0))
    expect(s.tool.select(at(300, 0))).toBe(false)
    expect(s.tool.selectedId()).toBeNull()
  })

  it("RV-21: толщина 30 мм меняет выделенный откос одним шагом истории: полоса 3 см", () => {
    const s = withReveal()
    s.tool.select(at(101, 0))
    expect(s.tool.setSelectedThickness(30)).toBe(true)
    expect(s.log.records).toBe(1)
    const d = s.drawing()
    const piece = plasterPieces(d, mountingScene(d))[0]
    expect([piece?.from, piece?.to]).toEqual([100, 103])
  })

  it("RV-21: та же толщина записи истории не создаёт", () => {
    const s = withReveal()
    s.tool.select(at(101, 0))
    expect(s.tool.setSelectedThickness(20)).toBe(false)
    expect(s.log.records).toBe(0)
  })

  it("RV-22: Delete удаляет выделенный откос одним шагом, окно остаётся", () => {
    const s = withReveal()
    s.tool.select(at(101, 0))
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(1)
    expect(s.drawing().doorways).toEqual([WIN])
  })

  it("RV-22: ластик удаляет откос под курсором одним шагом, окно остаётся", () => {
    const s = withReveal()
    expect(s.tool.eraseTarget(at(101, 0))).toBe("r")
    expect(s.tool.erase(at(101, 0))).toBe(true)
    expect(s.marks()).toEqual([])
    expect(s.log.records).toBe(1)
    expect(s.drawing().doorways).toEqual([WIN])
  })

  it("RV-22: ластик мимо откоса ничего не удаляет", () => {
    const s = withReveal()
    expect(s.tool.erase(at(300, 0))).toBe(false)
    expect(s.log.records).toBe(0)
  })
})

describe("размер откоса", () => {
  const piece = (jamb: "a" | "b") => {
    const d = drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", jamb, 20)] })
    const p = plasterPieces(d, mountingScene(d))[0]
    if (!p) throw new Error("нет куска откоса")
    return p
  }

  it("RV-23: размер откоса равен толщине стены, линия размера лежит внутри проёма за полосой", () => {
    const a = revealDimension(piece("a"), "cm", 2, 14)
    expect(a?.text).toBe("20")
    expect(a && Math.min(a.geom.p1.x, a.geom.p2.x)).toBeGreaterThan(102)
    const b = revealDimension(piece("b"), "cm", 2, 14)
    expect(b?.text).toBe("20")
    expect(b && Math.max(b.geom.p1.x, b.geom.p2.x)).toBeLessThan(218)
  })

  it("RV-23: выносные линии начинаются на гранях стены, на внутренней стороне полосы", () => {
    const dim = revealDimension(piece("a"), "cm", 2, 14)
    expect(dim && [dim.geom.a.x, Math.min(dim.geom.a.y, dim.geom.b.y), Math.max(dim.geom.a.y, dim.geom.b.y)]).toEqual([102, -10, 10])
  })

  it("RV-24: число размера откоса не правится: под числом нет поля", () => {
    const s = withReveal()
    s.tool.select(at(101, 0))
    const dim = revealDimension(plasterPieces(s.drawing(), mountingScene(s.drawing()))[0] ?? piece("a"), "cm", 2, 14)
    const centre = dim ? { x: (dim.geom.p1.x + dim.geom.p2.x) / 2, y: (dim.geom.p1.y + dim.geom.p2.y) / 2 } : at(0, 0)
    expect(s.tool.dimensionAt(centre, "cm", 2, 14, 5)).toBe(false)
  })
})
