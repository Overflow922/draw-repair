import { describe, expect, it } from "vitest"
import { drywall } from "../reconstruction/reconstruction.test-utils"
import type { Point, SectionLine, SectionView } from "../types"
import { sectionFigure } from "./section-figure"

// change add-section-view: фигура разреза — содержание (spec section-view «Фигура разреза — содержание и штриховка»)

const line = (view: SectionView, ...xy: [number, number][]): SectionLine => ({
  id: "L1",
  label: "A",
  view,
  points: xy.map(([x, y]): Point => ({ x, y })),
})

describe("сечения стен", () => {
  it("SV-20: линия поперёк стены даёт прямоугольник толщины на высоту стены", () => {
    // стена (100,0)-(300,0), толщина 10, высота 250; линия x = 200 от y = -100 до 100, взгляд вправо: s = y, s' = y + 100
    const f = sectionFigure(line("right", [200, -100], [200, 100]), [drywall("W", 100, 0, 300, 0, 10, 250)])
    expect(f.width).toBe(200)
    expect(f.height).toBe(250)
    expect(f.pieces).toEqual([{ wallId: "W", segment: 0, s0: 95, s1: 105, heightCm: 250 }])
  })

  it("SV-21: линия вдоль стены внутри её тела даёт участок стены под отрезком", () => {
    const f = sectionFigure(line("up", [150, 0], [250, 0]), [drywall("W", 100, 0, 300, 0, 10, 250)])
    expect(f.pieces).toEqual([{ wallId: "W", segment: 0, s0: 0, s1: 100, heightCm: 250 }])
  })

  it("SV-22: отрезок шире стены обрезается телом стены", () => {
    const f = sectionFigure(line("up", [50, 0], [350, 0]), [drywall("W", 100, 0, 300, 0, 10, 250)])
    expect(f.pieces).toEqual([{ wallId: "W", segment: 0, s0: 50, s1: 250, heightCm: 250 }])
  })

  it("SV-23: ступенька не даёт сечения, если рабочие отрезки стену не касаются", () => {
    // стена вдоль X на y = 20 пересекает ступеньку x = 100 (от y = 0 до 40); рабочие отрезки лежат на y = 0 и y = 40
    const f = sectionFigure(line("down", [0, 0], [100, 0], [100, 40], [200, 40]), [drywall("W", 50, 20, 150, 20, 10)])
    expect(f.pieces).toEqual([])
  })

  it("SV-24: стена за плоскостью разреза в фигуру не попадает", () => {
    // линия x = 200 от y = -100 до 100, взгляд вправо; стена правее линии (за плоскостью), линию не касается
    const f = sectionFigure(line("right", [200, -100], [200, 100]), [drywall("W", 300, -50, 300, 50, 10)])
    expect(f.pieces).toEqual([])
    expect(f.height).toBe(0)
    expect(f.width).toBe(200)
  })

  it("SV-25: косая стена даёт сечение шире толщины", () => {
    // диагональная стена (0,0)-(100,100) толщиной 10: горизонтальное сечение 10 / sin 45° = 14,142
    const f = sectionFigure(line("up", [-50, 50], [150, 50]), [drywall("D", 0, 0, 100, 100, 10, 200)])
    const [p] = f.pieces
    expect(f.pieces).toHaveLength(1)
    expect(p.s0).toBeCloseTo(100 - 7.0711, 3)
    expect(p.s1).toBeCloseTo(100 + 7.0711, 3)
  })

  it("SV-26: стена, пересечённая двумя рабочими отрезками, даёт два сечения", () => {
    // стена (-50,20)-(250,20) толщиной 60 (y от -10 до 50) пересекает оба рабочих отрезка (y = 0 и y = 40);
    // взгляд вниз: s = -x, левый край фигуры — x = 200
    const f = sectionFigure(line("down", [0, 0], [100, 0], [100, 40], [200, 40]), [drywall("W", -50, 20, 250, 20, 60, 250)])
    expect(f.width).toBe(200)
    expect(f.pieces).toEqual([
      { wallId: "W", segment: 0, s0: 100, s1: 200, heightCm: 250 },
      { wallId: "W", segment: 1, s0: 0, s1: 100, heightCm: 250 },
    ])
  })

  it("SV-27: высота фигуры — наибольшая из пересечённых стен", () => {
    const f = sectionFigure(line("right", [200, -100], [200, 100]), [
      drywall("A", 100, 0, 300, 0, 10, 250),
      drywall("B", 100, 40, 300, 40, 10, 270),
      drywall("C", 300, 80, 400, 80, 10, 400),
    ])
    expect(f.height).toBe(270)
  })

  it("SV-28: линия без стен — пустая фигура шириной в линию", () => {
    const f = sectionFigure(line("right", [200, -100], [200, 100]), [])
    expect(f).toMatchObject({ width: 200, height: 0, pieces: [] })
  })

  it("SV-29: ширина складывается из рабочих отрезков, ступеньки её не меняют", () => {
    const f = sectionFigure(line("down", [0, 0], [100, 0], [100, 40], [250, 40]), [])
    expect(f.width).toBe(250)
  })

  it("SV-30: линия, нарисованная справа налево, даёт ту же фигуру", () => {
    const f = sectionFigure(line("up", [250, 0], [150, 0]), [drywall("W", 100, 0, 300, 0, 10, 250)])
    expect(f.pieces).toEqual([{ wallId: "W", segment: 0, s0: 0, s1: 100, heightCm: 250 }])
  })
})
