import { describe, expect, it } from "vitest"
import { mk, wall } from "./demolition.test-utils"
import { clippedFaceBounds, markChains } from "./mark-chains"
import { markRegion } from "./mark-region"
import { effectiveMarks } from "./mark-model"
import { editNumber } from "./mark-numbers"
import { span } from "./mark-model"

// change demolition-no-neighbor-overlap: ввод полной ширины даёт целую стену; числа на гранях считаются по области,
// не заходящей в тело соседей (spec demolition-plan «Выделение пометки и правка чисел на месте»).
// V — (0,0)-(0,1113), 25 см; её концы лежат на осях стен T и B.

const scene = (): ReturnType<typeof wall>[] => [
  wall(0, 0, 0, 1113, "V", "brick", 25),
  wall(0, 0, 312, 0, "T", "brick", 25),
  wall(-300, 1113, 300, 1113, "B", "brick", 25),
]

const spanAfter = (walls: ReturnType<typeof wall>[], from: number, to: number, side: 1 | -1, value: number): [number, number] | null => {
  const marks = [mk("m", "V", "a", from, to)]
  const result = editNumber(marks, walls, "m", "width", side, value)
  const v = walls[0]!
  const m = result?.marks.find((x) => x.id === result.id)
  return m ? span(m, v) : null
}

describe("ввод полной ширины", () => {
  it("NO-01: у пометки 0–500 ввод ширины, равной ширине целой стены (1088 между ближними гранями), даёт 0–1113", () => {
    const walls = scene()
    expect(spanAfter(walls, 0, 500, 1, 1088)).toEqual([0, 1113])
    expect(spanAfter(walls, 0, 500, -1, 1088)).toEqual([0, 1113])
  })

  it("NO-02: ширина больше полной тоже даёт целую стену", () => {
    expect(spanAfter(scene(), 0, 500, 1, 5000)).toEqual([0, 1113])
  })

  it("NO-03: ширина короче полной не доходит до конца стены", () => {
    const edited = spanAfter(scene(), 0, 500, 1, 1000)
    expect(edited?.[1]).toBeCloseTo(1012.5, 6)
  })
})

// Сцена пользователя (размеры в см): стена V (7 см) примыкает торцом к линии нижней стены, разорванной по её толщине
// (B1 и B2 примыкают к граням V), стена T (7 см) примыкает к её грани сверху. Торцевая часть V идёт сквозь разрыв нижней стены.
describe("стена между двумя примыкающими стенами с разрывом", () => {
  const room = (): ReturnType<typeof wall>[] => [
    wall(1119.3, 462.1, 1268.9, 462.1, "B1", "blocks", 10),
    wall(1272.4, 457.1, 1272.4, 345.8, "V", "blocks", 7),
    wall(1275.9, 349.3, 1307.1, 349.3, "T", "blocks", 7),
    wall(1312.1, 345.8, 1312.1, 193.5, "R1", "blocks", 10),
    wall(1312.1, 352.8, 1312.1, 457.1, "R2", "blocks", 10),
    wall(1275.9, 462.1, 1307.1, 462.1, "B2", "blocks", 10),
  ]

  it("NO-06: область V заканчивается у ближних граней нижних стен (y = 457,1), а не проходит сквозь их толщину", () => {
    const walls = room()
    const [r] = effectiveMarks([mk("m", "V", "a", 0, 111.3)], walls)
    const ys = markRegion(r!, walls).flat().map((p) => p.y)
    expect(Math.max(...ys)).toBeCloseTo(457.1, 6)
    expect(Math.min(...ys)).toBeCloseTo(345.8, 6)
  })

  it("NO-07: стена T, примкнувшая к грани V сбоку, область V не сокращает", () => {
    const walls = room()
    const [r] = effectiveMarks([mk("m", "V", "a", 0, 111.3)], walls)
    expect(Math.min(...markRegion(r!, walls).flat().map((p) => p.y))).toBeCloseTo(345.8, 6)
  })
})

describe("числа целой стены между соседями", () => {
  it("NO-04: ширина на обеих гранях — 1088 (от 12,5 до 1100,5), расстояний до ближних граней соседей нет", () => {
    const walls = scene()
    const [r] = effectiveMarks([mk("m", "V", "a", 0, 1113)], walls)
    for (const side of [1, -1] as const) {
      const bounds = clippedFaceBounds(r!, walls, side)
      expect(bounds && bounds.end - bounds.start).toBeCloseTo(1088, 6)
    }
    const widths = markChains(r!, walls, clippedFaceBounds).filter((c) => c.target === "width")
    expect(widths.map((c) => c.lengthCm)).toEqual([expect.closeTo(1088, 6), expect.closeTo(1088, 6)])
  })

  it("NO-05: у стены без соседей границы совпадают с обычными", () => {
    const free = [wall(0, 0, 500, 0, "V", "brick", 20)]
    const [r] = effectiveMarks([mk("m", "V", "a", 0, 500)], free)
    const bounds = clippedFaceBounds(r!, free, 1)
    expect(bounds && [bounds.start, bounds.end]).toEqual([0, 500])
  })
})
