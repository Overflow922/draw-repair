import { describe, expect, it } from "vitest"
import type { SectionView } from "../types"
import { figureToWorld, worldToFigure } from "./section-layout"
import type { FigurePlacement } from "./section-layout"

// change add-section-shapes: точка чертежа в координатах фигуры — обратная figureToWorld для всех четырёх взглядов
// (design D8; зеркальность `down` заложена в s сечений, сама фигура рисуется слева направо). Схематично:
//
//   фигура 220 x 250, левый нижний угол пола в (400, 105): s = x - 400, z = 105 - y
const placement = (view: SectionView): FigurePlacement => ({ lineId: "L", label: "A", view, x: 400, floorY: 105, width: 220, height: 250 })

describe("worldToFigure", () => {
  it.each<SectionView>(["up", "down", "left", "right"])("SH-140: взгляд %s: обратное преобразование к figureToWorld", (view) => {
    const p = placement(view)
    for (const [s, z] of [[0, 0], [30, 120], [220, 250], [110.5, 62.25]]) {
      expect(worldToFigure(p, figureToWorld(p, s, z))).toEqual({ s, z })
    }
  })

  it("SH-141: левый нижний угол пола — начало координат фигуры", () => {
    expect(worldToFigure(placement("right"), { x: 400, y: 105 })).toEqual({ s: 0, z: 0 })
  })

  it("SH-142: точка выше и правее лежит в положительных s и z", () => {
    expect(worldToFigure(placement("right"), { x: 430, y: -15 })).toEqual({ s: 30, z: 120 })
  })
})
