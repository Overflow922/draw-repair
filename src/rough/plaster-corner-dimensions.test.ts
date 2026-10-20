import { describe, expect, it } from "vitest"
import type { Drawing, PlasterMark, Wall, WallElement } from "../types"
import { plasterDimensions, plasterRunDimensions } from "./plaster-dimensions"
import type { PlasterDimension } from "./plaster-dimensions"
import { roughScene } from "./rough-scene"
import { drawing, plaster, wall } from "./rough.test-utils"

// change plaster-dimension-corner-to-corner: размер штукатурки от угла до угла через стык коллинеарных стен, сегменты по
// откосам проёмов (spec rough-works-plan «Размер штукатурки от угла до угла»)

const K = 2
const LABEL = 14

const opening = (wallId: string, offsetCm: number, widthCm: number, kind: "doorway" | "window" | "door" = "doorway"): WallElement => {
  const base = { id: `o${offsetCm}`, wallId, anchor: "a" as const, offsetCm, widthCm, heightCm: 210 }
  if (kind === "window") return { ...base, kind, sillCm: 90 }
  if (kind === "door") return { ...base, kind, hinge: "a", swing: "left" }
  return base
}

const endMark = (id: string, wallId: string, anchor: "a" | "b"): PlasterMark => ({ id, wallId, face: "end", anchor, thicknessMm: 20 })

// размеры участка, в который входит пометка markId; сегменты ширины — слева направо
function dimsOf(d: Drawing, markId: string): PlasterDimension[] {
  const scene = roughScene(d)
  const piece = scene.pieces.find((p) => p.mark.id === markId)
  return piece ? plasterDimensions(piece, scene.pieces, scene.base.walls, "cm", K, LABEL, scene.base.doorways) : []
}

const left = (x: PlasterDimension): number => Math.min(x.geom.p1.x, x.geom.p2.x)
const right = (x: PlasterDimension): number => Math.max(x.geom.p1.x, x.geom.p2.x)

function segments(d: Drawing, markId: string): number[] {
  return dimsOf(d, markId)
    .filter((x) => x.target === "width")
    .sort((p, q) => left(p) - left(q))
    .map((x) => x.valueCm)
}

function widthSpan(d: Drawing, markId: string): [number, number] {
  const widths = dimsOf(d, markId).filter((x) => x.target === "width")
  return [Math.min(...widths.map(left)), Math.max(...widths.map(right))]
}

describe("стык коллинеарных стен — один размер", () => {
  const W1 = wall("W1", 0, 0, 300, 0)
  const W2 = wall("W2", 300, 0, 600, 0)
  const marks = [plaster("m1", "W1", 1, "a", 0, 300), plaster("m2", "W2", 1, "a", 0, 300)]

  it("CD-1: две стены одной толщины дают один размер 600 см от x = 0 до x = 600", () => {
    const d = drawing({ walls: [W1, W2], roughPlaster: marks })
    expect(segments(d, "m1")).toEqual([600])
    expect(widthSpan(d, "m1")).toEqual([0, 600])
  })

  it("CD-2: тот же размер видит и вторая пометка, второго размера у неё нет", () => {
    const d = drawing({ walls: [W1, W2], roughPlaster: marks })
    expect(segments(d, "m2")).toEqual([600])
    const scene = roughScene(d)
    const runs = plasterRunDimensions(scene.pieces, scene.base.walls, scene.base.doorways, "cm", K, LABEL)
    expect(runs).toHaveLength(1)
    expect(runs[0]?.markIds.sort()).toEqual(["m1", "m2"])
  })

  it("CD-3: стена, нарисованная в обратную сторону, продолжает тот же размер", () => {
    const reversed = wall("W2", 600, 0, 300, 0)
    const d = drawing({ walls: [W1, reversed], roughPlaster: [marks[0] as PlasterMark, plaster("m2", "W2", -1, "a", 0, 300)] })
    expect(segments(d, "m1")).toEqual([600])
    expect(widthSpan(d, "m1")).toEqual([0, 600])
  })

  it("CD-4: стены разной толщины с общей гранью дают один размер 300 см", () => {
    const thin = wall("W1", 0, 0, 100, 0, 7)
    const thick = wall("W2", 100, -1.5, 300, -1.5, 10)
    const d = drawing({ walls: [thin, thick], roughPlaster: [plaster("m1", "W1", 1, "a", 0, 100), plaster("m2", "W2", 1, "a", 0, 200)] })
    expect(segments(d, "m1")).toEqual([300])
    expect(widthSpan(d, "m1")).toEqual([0, 300])
  })

  it("CD-5: разные участки одной плоскости с щелью между ними остаются двумя размерами", () => {
    const d = drawing({ walls: [W1, W2], roughPlaster: [plaster("m1", "W1", 1, "a", 0, 100), plaster("m2", "W2", 1, "a", 100, 200)] })
    expect(segments(d, "m1")).toEqual([100])
    expect(segments(d, "m2")).toEqual([100])
  })
})

describe("T-примыкание в плоскости", () => {
  it("CD-6: оси оканчиваются на гранях S — один размер от x = 0 до x = 1000", () => {
    const W1 = wall("W1", 0, 0, 490, 0, 10)
    const W2 = wall("W2", 510, 0, 1000, 0, 10)
    const S = wall("S", 500, 5, 500, 200, 20)
    const d = drawing({ walls: [W1, W2, S], roughPlaster: [plaster("m1", "W1", -1, "a", 0, 490), plaster("m2", "W2", -1, "a", 0, 490)] })
    expect(segments(d, "m1")).toEqual([1000])
    expect(widthSpan(d, "m1")).toEqual([0, 1000])
  })

  it("CD-7: торец S в плоскости входит в тот же размер, ширина не зависит от самой толстой стены чертежа", () => {
    const H1 = wall("H1", 0, 0, 490, 0)
    const H2 = wall("H2", 510, 0, 1000, 0)
    const S = wall("S", 500, -10, 500, 300)
    const marks = [plaster("p1", "H1", -1, "a", 0, 490), plaster("p2", "H2", -1, "a", 0, 490), endMark("e", "S", "a")]
    for (const walls of [[H1, H2, S], [H1, H2, S, wall("far", 0, 1000, 300, 1000, 60)]]) {
      const d = drawing({ walls, roughPlaster: marks })
      expect(segments(d, "p1")).toEqual([1000])
      expect(segments(d, "p2")).toEqual([1000])
    }
  })
})

describe("сегменты по проёмам", () => {
  const W = wall("W", 0, 0, 500, 0)
  const whole = [plaster("m", "W", 1, "a", 0, 500)]

  it("CD-8: проём в середине даёт 200 | 90 | 210", () => {
    const d = drawing({ walls: [W], roughPlaster: whole, doorways: [opening("W", 200, 90)] })
    expect(segments(d, "m")).toEqual([200, 90, 210])
  })

  it.each(["window", "door"] as const)("CD-9: %s делит размер так же, как проём", (kind) => {
    const d = drawing({ walls: [W], roughPlaster: whole, doorways: [opening("W", 200, 90, kind)] })
    expect(segments(d, "m")).toEqual([200, 90, 210])
  })

  it("CD-10: несколько проёмов дают 100 | 90 | 110 | 80 | 120", () => {
    const d = drawing({ walls: [W], roughPlaster: whole, doorways: [opening("W", 100, 90), opening("W", 300, 80, "window")] })
    expect(segments(d, "m")).toEqual([100, 90, 110, 80, 120])
  })

  it("CD-11: проём у стыка стен: стык не делит, проём делит — 220 | 80 | 300", () => {
    const W1 = wall("W1", 0, 0, 300, 0)
    const W2 = wall("W2", 300, 0, 600, 0)
    const d = drawing({
      walls: [W1, W2],
      roughPlaster: [plaster("m1", "W1", 1, "a", 0, 300), plaster("m2", "W2", 1, "a", 0, 300)],
      doorways: [opening("W1", 220, 80)],
    })
    expect(segments(d, "m1")).toEqual([220, 80, 300])
  })

  it("CD-12: проём вне участка сегментов не даёт", () => {
    const d = drawing({ walls: [W], roughPlaster: [plaster("m", "W", 1, "a", 0, 100)], doorways: [opening("W", 200, 90)] })
    expect(segments(d, "m")).toEqual([100])
  })

  it("CD-13: проём частично в участке — часть внутри участка; расстояния до стыков сохраняются", () => {
    const d = drawing({ walls: [W], roughPlaster: [plaster("m", "W", 1, "a", 100, 300)], doorways: [opening("W", 250, 100)] })
    const dims = dimsOf(d, "m")
    expect(segments(d, "m")).toEqual([150, 50])
    expect(dims.filter((x) => x.target === "gapA").map((x) => x.valueCm)).toEqual([100])
    expect(dims.filter((x) => x.target === "gapB").map((x) => x.valueCm)).toEqual([200])
  })

  it("CD-14: сумма сегментов равна ширине той же цепочки без проёмов", () => {
    const W1 = wall("W1", 0, 0, 300, 0)
    const W2 = wall("W2", 300, 0, 600, 0)
    const marks = [plaster("m1", "W1", 1, "a", 0, 300), plaster("m2", "W2", 1, "a", 0, 300)]
    const openings = [opening("W1", 50, 90), opening("W2", 100, 120, "window")]
    const without = segments(drawing({ walls: [W1, W2], roughPlaster: marks }), "m1")
    const withOpenings = segments(drawing({ walls: [W1, W2], roughPlaster: marks, doorways: openings }), "m1")
    expect(withOpenings.reduce((s, v) => s + v, 0)).toBeCloseTo(without.reduce((s, v) => s + v, 0), 6)
    expect(withOpenings).toEqual([50, 90, 260, 120, 80])
  })

  it("CD-15: сегменты лежат на одной линии без перекрытия и по порядку", () => {
    const d = drawing({ walls: [W], roughPlaster: whole, doorways: [opening("W", 200, 90)] })
    const widths = dimsOf(d, "m").filter((x) => x.target === "width").sort((p, q) => left(p) - left(q))
    expect(widths.map((x) => [left(x), right(x)])).toEqual([
      [0, 200],
      [200, 290],
      [290, 500],
    ])
  })
})

describe("углы остаются по правилам пометки", () => {
  it("CD-16: соседняя штукатурка в углу укорачивает размер на её толщину, одиночный размер — до угла стены", () => {
    const walls = [wall("A", 0, 0, 500, 0), wall("B", 500, 0, 500, 400)]
    const alone = segments(drawing({ walls, roughPlaster: [plaster("p", "A", 1, "a", 0, 500)] }), "p")
    const both = segments(drawing({ walls, roughPlaster: [plaster("p", "A", 1, "a", 0, 500), plaster("q", "B", 1, "a", 0, 400)] }), "p")
    expect((alone[0] ?? NaN) - (both[0] ?? NaN)).toBeCloseTo(2)
  })
})

describe("торец вне плоскости", () => {
  it("CD-17: размер боковой полосы выступа длиннее на толщину полосы торца", () => {
    const S: Wall = wall("S", 0, -10, 0, -30)
    const side = plaster("l", "S", 1, "a", 0, 20)
    const widthOf = (marks: PlasterMark[]): number | undefined =>
      segments(drawing({ walls: [wall("W", -100, 0, 100, 0), S], roughPlaster: marks }), "l")[0]
    const alone = widthOf([side])
    const wrapped = widthOf([side, endMark("e", "S", "b")])
    expect((wrapped ?? NaN) - (alone ?? NaN)).toBeCloseTo(2)
  })
})

describe("чертёж пользователя: кухня «Чертежа 2»", () => {
  // 4fec4452 (7 см, обмер) и a0048405 (10 см, «Монтаж») с общей гранью y = 405.6; у пользователя размеры показывали 703 и 2003
  it("CD-18: куски 48.3 и 174.3 см дают один размер 222.6 см", () => {
    const d: Drawing = {
      ...drawing({
        walls: [wall("4fec4452", 130.6, 402.1, 178.9, 402.1, 7, "blocks"), wall("63bcbab7", 450.7, 828.9, 450.7, 665.4, 25, "concrete")],
        mounting: { walls: [wall("a0048405", 178.9, 400.6, 353.2, 400.6, 10, "blocks")], dimensions: [] },
      }),
      roughPlaster: [plaster("be73e1b9", "4fec4452", 1, "a", 0, 48.3), plaster("3c8153b6", "a0048405", 1, "a", 0, 174.3)],
    }
    expect(segments(d, "be73e1b9")[0]).toBeCloseTo(222.6, 6)
    expect(segments(d, "be73e1b9")).toHaveLength(1)
    expect(segments(d, "3c8153b6")[0]).toBeCloseTo(222.6, 6)
  })
})