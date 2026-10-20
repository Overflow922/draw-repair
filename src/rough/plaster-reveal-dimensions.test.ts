import { describe, expect, it } from "vitest"
import type { Drawing, PlasterMark } from "../types"
import { plasterDimensions, plasterRunDimensions } from "./plaster-dimensions"
import type { PlasterDimension } from "./plaster-dimensions"
import { revealDimension } from "./plaster-reveal"
import { roughScene } from "./rough-scene"
import { doorOn, drawing, openingOn, plaster, reveal, wall, windowOn } from "./rough.test-utils"

// change plaster-reveal-dimensions: размер штукатурки грани учитывает штукатурку откосов проёма — граница сегмента у откоса
// лежит на внутренней стороне полосы откоса (spec rough-works-plan «Размер штукатурки от угла до угла»)

const K = 2
const LABEL = 14

const W = wall("W", 0, 0, 500, 0)
const whole = plaster("m", "W", 1, "a", 0, 500)

const left = (x: PlasterDimension): number => Math.min(x.geom.p1.x, x.geom.p2.x)

// сегменты ширины всех участков плана, слева направо
function segments(d: Drawing): number[] {
  const scene = roughScene(d)
  return plasterRunDimensions(scene.pieces, scene.base.walls, scene.base.doorways, "cm", K, LABEL)
    .flatMap((r) => r.dimensions)
    .filter((x) => x.target === "width")
    .sort((p, q) => left(p) - left(q))
    .map((x) => x.valueCm)
}

// размеры участка выделенной пометки, как их показывает выделение (с расстояниями до стыков)
function selectedDimensions(d: Drawing, markId: string): PlasterDimension[] {
  const scene = roughScene(d)
  const piece = scene.pieces.find((p) => p.mark.id === markId)
  return piece ? plasterDimensions(piece, scene.pieces, scene.base.walls, "cm", K, LABEL, scene.base.doorways) : []
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

function expectSegments(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length)
  expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 6))
}

describe("откосы окна оштукатурены", () => {
  const win = windowOn("win", "W", 200, 100)

  it("RD-1: оба откоса по 20 мм дают «202 | 96 | 202», отдельного сегмента на откос нет, сумма 500", () => {
    const d = drawing({ walls: [W], doorways: [win], roughPlaster: [whole, reveal("ra", "win", "a"), reveal("rb", "win", "b")] })
    const result = segments(d)
    expectSegments(result, [202, 96, 202])
    expect(sum(result)).toBeCloseTo(500, 6)
  })

  it("RD-2: оштукатурен только откос a — «202 | 98 | 200», только откос b — «200 | 98 | 202»", () => {
    expectSegments(segments(drawing({ walls: [W], doorways: [win], roughPlaster: [whole, reveal("ra", "win", "a")] })), [202, 98, 200])
    expectSegments(segments(drawing({ walls: [W], doorways: [win], roughPlaster: [whole, reveal("rb", "win", "b")] })), [200, 98, 202])
  })

  it("RD-3: откосы разной толщины — «205 | 93 | 202»", () => {
    const d = drawing({ walls: [W], doorways: [win], roughPlaster: [whole, reveal("ra", "win", "a", 50), reveal("rb", "win", "b", 20)] })
    expectSegments(segments(d), [205, 93, 202])
  })

  it("RD-3b: без пометок откосов размер прежний — «200 | 100 | 200»", () => {
    expectSegments(segments(drawing({ walls: [W], doorways: [win], roughPlaster: [whole] })), [200, 100, 200])
  })
})

describe("дверь и проём без вида", () => {
  it.each([
    ["дверь", doorOn("el", "W", 200, 100)],
    ["проём без вида", openingOn("el", "W", 200, 100)],
  ])("RD-4: %s с оштукатуренными откосами даёт «202 | 96 | 202»", (_name, element) => {
    const d = drawing({ walls: [W], doorways: [element], roughPlaster: [whole, reveal("ra", "el", "a"), reveal("rb", "el", "b")] })
    expectSegments(segments(d), [202, 96, 202])
  })
})

describe("узкий проём", () => {
  it("RD-5: проём 3 см, оба откоса по 20 мм — глубина 1,5 см, чистой части нет, «201,5 | 298,5»", () => {
    const d = drawing({
      walls: [W],
      doorways: [openingOn("op", "W", 200, 3)],
      roughPlaster: [whole, reveal("ra", "op", "a"), reveal("rb", "op", "b")],
    })
    expectSegments(segments(d), [201.5, 298.5])
  })
})

describe("откос без действующей пометки", () => {
  it("RD-6: пометка откоса элемента, которого на плане нет, границу не двигает", () => {
    const d = drawing({ walls: [W], doorways: [windowOn("win", "W", 200, 100)], roughPlaster: [whole, reveal("ra", "ghost", "a"), reveal("rb", "ghost", "b")] })
    expectSegments(segments(d), [200, 100, 200])
  })

  it("RD-6b: откос другого окна границу этого окна не двигает", () => {
    const d = drawing({
      walls: [W],
      doorways: [windowOn("win", "W", 200, 60), windowOn("other", "W", 400, 40)],
      roughPlaster: [whole, reveal("ra", "other", "a")],
    })
    expectSegments(segments(d), [200, 60, 142, 38, 60])
  })
})

describe("стык стен", () => {
  it("RD-7: окно у стыка стен, оштукатурен откос a — «222 | 78 | 300», стык размер не делит", () => {
    const W1 = wall("W1", 0, 0, 300, 0)
    const W2 = wall("W2", 300, 0, 600, 0)
    const d = drawing({
      walls: [W1, W2],
      doorways: [windowOn("win", "W1", 220, 80)],
      roughPlaster: [plaster("m1", "W1", 1, "a", 0, 300), plaster("m2", "W2", 1, "a", 0, 300), reveal("ra", "win", "a")],
    })
    expectSegments(segments(d), [222, 78, 300])
  })
})

describe("проём у края цепочки", () => {
  it("RD-7b: окно у начала цепочки, оба откоса по 20 мм — «98 | 402», обрубка «2» у угла нет", () => {
    const d = drawing({
      walls: [W],
      doorways: [windowOn("win", "W", 0, 100)],
      roughPlaster: [whole, reveal("ra", "win", "a"), reveal("rb", "win", "b")],
    })
    expectSegments(segments(d), [98, 402])
  })

  it("RD-7c: окно у конца цепочки — «402 | 98», обрубка у угла нет", () => {
    const d = drawing({
      walls: [W],
      doorways: [windowOn("win", "W", 400, 100)],
      roughPlaster: [whole, reveal("ra", "win", "a"), reveal("rb", "win", "b")],
    })
    expectSegments(segments(d), [402, 98])
  })
})

describe("участок, частично захватывающий проём", () => {
  it("RD-8: участок 100–300, проём 250–350, откос a оштукатурен — ширина «152 | 48», расстояние до стыка a остаётся 100", () => {
    const d = drawing({
      walls: [W],
      doorways: [windowOn("win", "W", 250, 100)],
      roughPlaster: [plaster("m", "W", 1, "a", 100, 300), reveal("ra", "win", "a")],
    })
    const dims = selectedDimensions(d, "m")
    const widths = dims.filter((x) => x.target === "width").sort((p, q) => left(p) - left(q))
    expectSegments(
      widths.map((x) => x.valueCm),
      [152, 48],
    )
    expect(dims.find((x) => x.target === "gapA")?.valueCm).toBeCloseTo(100, 6)
  })
})

describe("размер следует за правкой", () => {
  const win = windowOn("win", "W", 200, 100)
  const marks = (thicknessMm: number): PlasterMark[] => [whole, reveal("ra", "win", "a", thicknessMm), reveal("rb", "win", "b", thicknessMm)]

  it("RD-9: правка толщины откоса сдвигает границу, снятые откосы возвращают границу на линию откоса", () => {
    expectSegments(segments(drawing({ walls: [W], doorways: [win], roughPlaster: marks(30) })), [203, 94, 203])
    expectSegments(segments(drawing({ walls: [W], doorways: [win], roughPlaster: [whole] })), [200, 100, 200])
  })

  it("RD-9b: окно, сдвинутое на 30 см, сдвигает сегменты вместе с собой, сумма остаётся 500", () => {
    const result = segments(drawing({ walls: [W], doorways: [windowOn("win", "W", 230, 100)], roughPlaster: marks(20) }))
    expectSegments(result, [232, 96, 172])
    expect(sum(result)).toBeCloseTo(500, 6)
  })
})

describe("размер откоса", () => {
  it("RD-10: размер самой полосы откоса — толщина стены, и не зависит от размеров грани", () => {
    const withFace = drawing({ walls: [W], doorways: [windowOn("win", "W", 200, 100)], roughPlaster: [whole, reveal("ra", "win", "a")] })
    const alone = drawing({ walls: [W], doorways: [windowOn("win", "W", 200, 100)], roughPlaster: [reveal("ra", "win", "a")] })
    const textOf = (d: Drawing): string | undefined => {
      const piece = roughScene(d).pieces.find((p) => p.mark.face === "reveal")
      return piece ? revealDimension(piece, "cm", K, LABEL)?.text : undefined
    }
    expect(textOf(withFace)).toBe(textOf(alone))
    expect(textOf(alone)).toBeDefined()
  })
})
