import { describe, expect, it } from "vitest"
import { displayPolygons } from "../wall-geometry"
import { W, areaOf, boxOf, deepFreeze, mk, wall } from "./demolition.test-utils"
import { markRegion } from "./mark-region"
import { effectiveMarks } from "./marks"

// change demolition-plan: область сноса (spec demolition-plan «Пометка сноса»; design D3). Скрытие элементов
// отменено change demolition-show-elements (TCR-1): тестов hiddenElements/visibleElements больше нет.
// Стена W — (0,0)-(500,0), кирпич, 20 см.

// форма стены W на обмерочном плане: один и тот же экземпляр в списке стен (дубликат в списке даёт пустую форму)
const shapeOfW = () => {
  const w = W()
  return displayPolygons(w, [w])
}

const region = (from: number, to: number, anchor: "a" | "b" = "a", walls = [W()]) => {
  const [r] = effectiveMarks([mk("m", "W", anchor, from, to)], walls)
  if (!r) throw new Error("пометка не действует")
  return markRegion(r, walls)
}

describe("markRegion на свободной стене", () => {
  it("RG-01: целая стена — область совпадает с формой стены: прямоугольник 500×20, площадь 10000", () => {
    const polys = region(0, 500)
    expect(boxOf(polys)).toEqual({ minX: 0, minY: -10, maxX: 500, maxY: 10 })
    expect(areaOf(polys)).toBeCloseTo(10000, 6)
    expect(areaOf(polys)).toBeCloseTo(areaOf(shapeOfW()), 6)
  })

  it("RG-02: участок 100–190 — полоса x от 100 до 190 на всю толщину (y от −10 до 10), площадь 1800", () => {
    const polys = region(100, 190)
    const box = boxOf(polys)
    expect(box.minX).toBeCloseTo(100, 6)
    expect(box.maxX).toBeCloseTo(190, 6)
    expect(box.minY).toBeCloseTo(-10, 6)
    expect(box.maxY).toBeCloseTo(10, 6)
    expect(areaOf(polys)).toBeCloseTo(1800, 6)
  })

  it("RG-04: запись с привязкой b даёт ту же область, что эквивалентная запись с привязкой a", () => {
    const a = region(360, 450, "a")
    const b = region(50, 140, "b")
    expect(boxOf(b)).toEqual(boxOf(a))
    expect(areaOf(b)).toBeCloseTo(areaOf(a), 6)
    expect(boxOf(a).minX).toBeCloseTo(360, 6)
    expect(boxOf(a).maxX).toBeCloseTo(450, 6)
  })

  it("RG-03: участок с from = 0 не обрезается по началу: левый край — левый край формы стены", () => {
    const full = boxOf(shapeOfW())
    const box = boxOf(region(0, 190))
    expect(box.minX).toBe(full.minX)
    expect(box.maxX).toBeCloseTo(190, 6)
  })

  it("RG-03: участок с to = длина не обрезается по концу: правый край — правый край формы", () => {
    const full = boxOf(shapeOfW())
    const box = boxOf(region(310, 500))
    expect(box.maxX).toBe(full.maxX)
    expect(box.minX).toBeCloseTo(310, 6)
  })

  it("RG-03: to = len − 0,02 см (дальше допуска от конца) обрезается по плоскости", () => {
    expect(boxOf(region(100, 499.98)).maxX).toBeCloseTo(499.98, 6)
  })

  it("RG-03: to = len − 0,005 см (в пределах допуска) не обрезает торцевую часть", () => {
    const full = boxOf(shapeOfW())
    expect(boxOf(region(100, 499.995)).maxX).toBe(full.maxX)
  })

  it("RG-03: from = 0,005 см не обрезает по началу, from = 0,02 см обрезает", () => {
    const full = boxOf(shapeOfW())
    expect(boxOf(region(0.005, 200)).minX).toBe(full.minX)
    expect(boxOf(region(0.02, 200)).minX).toBeCloseTo(0.02, 6)
  })

  it("RG-05: область не содержит пустых полигонов", () => {
    for (const poly of region(100, 190)) expect(poly.length).toBeGreaterThanOrEqual(3)
  })

  it("RG-05: вход не мутируется", () => {
    const walls = deepFreeze([W()])
    const [r] = effectiveMarks(deepFreeze([mk("m", "W", "a", 100, 190)]), walls)
    expect(() => markRegion(r!, walls)).not.toThrow()
  })
})

describe("markRegion в стыках", () => {
  // комната: W (0,0)-(500,0) и V (0,0)-(0,400) с общей вершиной
  const corner = [wall(0, 0, 500, 0, "W"), wall(0, 0, 0, 400, "V")]

  it("RG-06: целая стена в углу — область равна форме стены с учётом угла", () => {
    const [r] = effectiveMarks([mk("m", "W", "a", 0, 500)], corner)
    const polys = markRegion(r!, corner)
    const shape = displayPolygons(corner[0]!, corner)
    expect(areaOf(polys)).toBeCloseTo(areaOf(shape), 6)
    expect(boxOf(polys)).toEqual(boxOf(shape))
  })

  it("RG-06: участок у угла (from = 0) сохраняет угловую часть формы, участок вдали — нет", () => {
    const shape = boxOf(displayPolygons(corner[0]!, corner))
    const [near] = effectiveMarks([mk("m", "W", "a", 0, 190)], corner)
    const [far] = effectiveMarks([mk("m", "W", "a", 100, 190)], corner)
    expect(boxOf(markRegion(near!, corner)).minX).toBe(shape.minX)
    expect(boxOf(markRegion(far!, corner)).minX).toBeCloseTo(100, 6)
  })
})
