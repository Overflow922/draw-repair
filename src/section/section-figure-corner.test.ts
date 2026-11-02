import { describe, expect, it } from "vitest"
import { drywall } from "../reconstruction/reconstruction.test-utils"
import type { SectionLine } from "../types"
import { sectionFigure } from "./section-figure"

// change add-section-view: фигура совпадает с тем, что нарисовано на плане, в углу двух стен ГКЛ
// (spec section-view «Фигура разреза — содержание и штриховка»)
//
//   y=95  +=====+        горизонтальная стена H: ось y = 100, толщина 10, от x = 0 до x = 200
//   y=105 +==+  |        в углу она доходит до наружной грани вертикальной (x = 205)
//            |  |        вертикальная стена V: ось x = 200, от y = 100 до y = 500, толщина 10
//            |  |
//   y=500    +--+
//   линия A–A идёт по оси V (x = 200) сверху вниз, взгляд влево          схематично, не в масштабе

const line: SectionLine = { id: "L", label: "A", view: "left", points: [{ x: 200, y: 0 }, { x: 200, y: 600 }] }
const H = drywall("H", 0, 100, 200, 100, 10, 250)
const V = drywall("V", 200, 100, 200, 500, 10, 250)

describe("угол двух стен", () => {
  it("SV-320: линия по оси стены даёт одно сечение от наружной грани соседней стены до торца: 95…500", () => {
    const figure = sectionFigure(line, [H, V])
    expect(figure.pieces).toHaveLength(1)
    const [piece] = figure.pieces
    // вид влево: слева направо — с юга на север, s отсчитывается от юга (y = 600)
    expect(piece.s1 - piece.s0).toBeCloseTo(405, 6)
    expect(piece.s0).toBeCloseTo(100, 6)
    expect(piece.s1).toBeCloseTo(505, 6)
  })

  it("SV-321: порядок стен в списке на результат не влияет", () => {
    const [a] = sectionFigure(line, [H, V]).pieces
    const [b] = sectionFigure(line, [V, H]).pieces
    expect(b.s1 - b.s0).toBeCloseTo(a.s1 - a.s0, 6)
  })

  it("SV-322: сечение низкой стены, накрытое сечением более высокой, не показывается; более высокой стены — показывается", () => {
    const lowH = drywall("H", 0, 100, 200, 100, 10, 100)
    const figure = sectionFigure(line, [lowH, V])
    expect(figure.pieces.map((p) => p.wallId)).toEqual(["V"])
    const tallH = drywall("H", 0, 100, 200, 100, 10, 300)
    expect(sectionFigure(line, [tallH, V]).pieces.map((p) => p.wallId).sort()).toEqual(["H", "V"])
  })
})
