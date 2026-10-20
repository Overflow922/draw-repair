import { describe, expect, it } from "vitest"
import type { Drawing, PlasterMark, Point, Wall } from "../types"
import { plasterPieces, plasterStrip } from "./plaster"
import { plasterDimensions } from "./plaster-dimensions"
import { plasterTarget } from "./plaster-face"
import type { PlasterTarget } from "./plaster-face"
import { createPlasterTool } from "./plaster-tool"
import type { PlasterToolHost } from "./plaster-tool"
import { roughScene } from "./rough-scene"
import { drawing, idGen, plaster, wall } from "./rough.test-utils"

// change plaster-flush-end-in-plane: торец перпендикулярной стены в плоскости входит в цель клика по плоскости (spec
// rough-works-plan «Торец перпендикулярной стены в плоскости», «Торец в плоскости с той же стороны оштукатурен отдельно»,
// «Торец в плоскости, покрытый телом соседней стены», «Стык у T-примыкания с торцом в плоскости»)

const at = (x: number, y: number): Point => ({ x, y })

// плоскость y = −10: брусья H1 и H2 упираются в боковые грани S, торец S (конец a) лежит в этой же плоскости
const H1 = wall("H1", 0, 0, 490, 0)
const H2 = wall("H2", 510, 0, 1000, 0)
const S = wall("S", 500, -10, 500, 300)
const ROW = [H1, H2, S]

const summary = (t: PlasterTarget | null) =>
  (t?.pieces.map((x) => [x.wall.id, x.face, Math.round(x.from * 10) / 10, Math.round(x.to * 10) / 10]) ?? []).sort((p, q) => String(p[0]).localeCompare(String(q[0])))

describe("цель: торец в плоскости", () => {
  it("FE-1: клик по грани бруса включает боковые куски H1 и H2 и торец S", () => {
    expect(summary(plasterTarget(at(100, -8), ROW, 5))).toEqual([
      ["H1", -1, 0, 490],
      ["H2", -1, 0, 490],
      ["S", "end", -10, 10],
    ])
  })

  it("FE-2: клик по грани H2 даёт ту же цель", () => {
    expect(summary(plasterTarget(at(800, -8), ROW, 5))).toEqual(summary(plasterTarget(at(100, -8), ROW, 5)))
  })

  it("FE-3: торец S, покрытый боковой гранью сплошной стены плоскости, в цель не входит", () => {
    const H = wall("H", 0, 0, 1000, 0)
    expect(summary(plasterTarget(at(100, -8), [H, S], 5))).toEqual([["H", -1, 0, 1000]])
  })

  it("FE-4: торец, закрытый другой стеной, в цель не входит", () => {
    const cap = wall("C", 500, -10, 500, -30, 20) // стена продолжает S за торец: торец S закрыт
    const target = plasterTarget(at(100, -8), [...ROW, cap], 5)
    expect(summary(target).some((x) => x[0] === "S" && x[1] === "end")).toBe(false)
  })

  it("FE-5: курсор за торцом S — цель один торец, как раньше", () => {
    expect(summary(plasterTarget(at(500, -14), ROW, 5))).toEqual([["S", "end", -10, 10]])
  })
})

const NONE: PlasterMark[] = []

function setup(initial: Drawing) {
  let d = initial
  let steps = 0
  const host: PlasterToolHost = {
    drawing: () => d,
    scene: () => roughScene(d),
    marks: () => d.roughPlaster ?? NONE,
    setMarks: (next) => {
      d = { ...d, roughPlaster: next }
    },
    record: () => {
      steps++
    },
    changed: () => undefined,
    redraw: () => undefined,
    radiusCm: () => 5,
    newId: idGen(),
    newThicknessMm: () => 20,
  }
  const tool = createPlasterTool(host)
  const click = (p: Point): void => {
    tool.down(at(0, 0))
    tool.up(p, at(1, 1))
  }
  return { click, drawing: () => d, steps: () => steps }
}

const marksOf = (d: Drawing) => (d.roughPlaster ?? []).map((m) => (m.face === "end" ? [m.wallId, "end", m.anchor] : [m.wallId, m.face])).sort((p, q) => String(p[0]).localeCompare(String(q[0])))

describe("постановка: торец в плоскости", () => {
  it("FE-6: один клик ставит пометки H1, H2 и торца S одним шагом истории", () => {
    const s = setup(drawing({ walls: ROW }))
    s.click(at(100, -8))
    expect(marksOf(s.drawing())).toEqual([
      ["H1", -1],
      ["H2", -1],
      ["S", "end", "a"],
    ])
    expect(s.steps()).toBe(1)
  })

  it("FE-7: повторный клик ничего не меняет и шага истории не создаёт", () => {
    const s = setup(drawing({ walls: ROW }))
    s.click(at(100, -8))
    const before = s.drawing().roughPlaster
    s.click(at(800, -8))
    expect(s.drawing().roughPlaster).toBe(before)
    expect(s.steps()).toBe(1)
  })

  it("FE-8: боковые грани оштукатурены, торец нет — ставится только торец", () => {
    const sides = [plaster("p1", "H1", -1, "a", 0, 490), plaster("p2", "H2", -1, "a", 0, 490)]
    const s = setup(drawing({ walls: ROW, roughPlaster: sides }))
    s.click(at(100, -8))
    expect(s.drawing().roughPlaster?.slice(0, 2)).toEqual(sides)
    expect(marksOf(s.drawing())).toEqual([
      ["H1", -1],
      ["H2", -1],
      ["S", "end", "a"],
    ])
    expect(s.steps()).toBe(1)
  })

  it("FE-9: клик по самому торцу S ставит один торец", () => {
    const s = setup(drawing({ walls: ROW }))
    s.click(at(500, -14))
    expect(marksOf(s.drawing())).toEqual([["S", "end", "a"]])
  })
})

describe("размеры и подсветка: торец в плоскости", () => {
  it("FE-11: боковые полосы не заходят на торец: куски по 490 см, а размер участка один — от x = 0 до x = 1000 (1000 см)", () => {
    const widthOf = (walls: Wall[], id: string): number | undefined => {
      const s = setup(drawing({ walls }))
      s.click(at(100, -8))
      const d = s.drawing()
      const pieces = plasterPieces(d)
      const piece = pieces.find((p) => p.wall.id.startsWith(`${id}~`) && p.mark.face === -1)
      return piece && plasterDimensions(piece, pieces, d.walls, "cm", 2, 14).find((x) => x.side === -1 && x.target === "width")?.valueCm
    }
    expect(widthOf(ROW, "H1")).toBeCloseTo(1000)
    expect(widthOf(ROW, "H2")).toBeCloseTo(1000)
    // ширина не зависит от самой толстой стены чертежа (раньше на неё влияло окно поиска грани)
    expect(widthOf([...ROW, wall("far", 0, 1000, 300, 1000, 60)], "H1")).toBeCloseTo(1000)
  })

  it("FE-12: подсветка цели равна поставленным полосам", () => {
    const target = plasterTarget(at(100, -8), ROW, 5)
    const s = setup(drawing({ walls: ROW }))
    s.click(at(100, -8))
    const base = (id: string): string => id.replace(/~\d+$/, "")
    const placed = plasterPieces(s.drawing()).map((p) => `${base(p.wall.id)}:${p.mark.face}`).sort()
    expect(target?.pieces.map((x) => `${base(x.wall.id)}:${x.face}`).sort()).toEqual(placed)
  })
})

describe("покрытие: торец в плоскости", () => {
  it("FE-10: полоса вдоль плоскости непрерывна от x = 0 до x = 1000, без щели и наложения", () => {
    const s = setup(drawing({ walls: ROW }))
    s.click(at(100, -8))
    const spans = plasterPieces(s.drawing())
      .map((p) => plasterStrip(p))
      .filter((poly) => poly.every((q) => q.y <= -10 + 1e-6))
      .map((poly) => [Math.min(...poly.map((q) => q.x)), Math.max(...poly.map((q) => q.x))] as const)
      .sort((p, q) => p[0] - q[0])
    expect(spans[0]?.[0]).toBeCloseTo(0)
    expect(spans[spans.length - 1]?.[1]).toBeCloseTo(1000)
    spans.slice(1).forEach(([lo], i) => expect(lo).toBeCloseTo(spans[i]?.[1] ?? NaN))
  })
})
