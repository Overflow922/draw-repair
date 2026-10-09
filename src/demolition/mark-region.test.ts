import { describe, expect, it } from "vitest"
import type { Doorway } from "../types"
import { displayPolygons } from "../wall-geometry"
import { W, areaOf, boxOf, deepFreeze, door_, mk, wall, window_ } from "./demolition.test-utils"
import { hiddenElements, markRegion, visibleElements } from "./mark-region"
import { effectiveMarks } from "./marks"

// change demolition-plan: область сноса и скрытие элементов стены (spec demolition-plan «Пометка сноса»,
// «Элементы стены в зоне сноса»; design D3). Стена W — (0,0)-(500,0), кирпич, 20 см.

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

describe("скрытие элементов стены", () => {
  const walls = [W()]
  const d1: Doorway = { id: "d1", wallId: "W", anchor: "a", offsetCm: 200, widthCm: 90, heightCm: 210 } // откосы 200–290
  const resolve = (from: number, to: number) => effectiveMarks([mk("m", "W", "a", from, to)], walls)

  it("RG-05: проём между откосами 200–290 внутри участка 100–400 скрыт", () => {
    expect(hiddenElements([d1], resolve(100, 400))).toEqual([d1])
    expect(visibleElements([d1], resolve(100, 400))).toEqual([])
  })

  it("RG-06: проём, частично пересекающийся с участком 250–400, скрыт целиком", () => {
    expect(hiddenElements([d1], resolve(250, 400))).toEqual([d1])
  })

  it("RG-07: проём, касающийся участка в точке (290–400 и 100–200), остаётся", () => {
    expect(hiddenElements([d1], resolve(290, 400))).toEqual([])
    expect(visibleElements([d1], resolve(290, 400))).toEqual([d1])
    expect(hiddenElements([d1], resolve(100, 200))).toEqual([])
  })

  it("RG-08: перекрытие 0,005 см (в пределах допуска) не скрывает, 0,02 см скрывает", () => {
    expect(hiddenElements([d1], resolve(289.995, 400))).toEqual([])
    expect(hiddenElements([d1], resolve(289.98, 400))).toEqual([d1])
    expect(hiddenElements([d1], resolve(100, 200.005))).toEqual([])
    expect(hiddenElements([d1], resolve(100, 200.02))).toEqual([d1])
  })

  it("RG-09: участок, не доходящий до проёма, его не скрывает", () => {
    expect(hiddenElements([d1], resolve(0, 150))).toEqual([])
    expect(hiddenElements([d1], resolve(350, 500))).toEqual([])
  })

  it("RG-10: элемент с привязкой b и теми же откосами скрыт так же", () => {
    const db: Doorway = { id: "db", wallId: "W", anchor: "b", offsetCm: 210, widthCm: 90, heightCm: 210 } // откосы 200–290
    expect(hiddenElements([db], resolve(250, 400))).toEqual([db])
    expect(hiddenElements([db], resolve(290, 400))).toEqual([])
  })

  it("RG-11: окно и дверь скрываются по тому же правилу", () => {
    const win = window_("W", "a", 200)
    const door = door_("W", "a", 200)
    expect(hiddenElements([win, door], resolve(250, 400))).toEqual([win, door])
    expect(hiddenElements([win, door], resolve(290, 400))).toEqual([])
  })

  it("RG-12: элемент другой стены не скрывается чужой пометкой с теми же числами", () => {
    const other = wall(0, 100, 500, 100, "V")
    const dv: Doorway = { id: "dv", wallId: "V", anchor: "a", offsetCm: 200, widthCm: 90, heightCm: 210 }
    expect(hiddenElements([dv, d1], effectiveMarks([mk("m", "W", "a", 100, 400)], [W(), other]))).toEqual([d1])
  })

  it("RG-12: пометка на железобетонной стене не действует, элементы остаются", () => {
    const resolved = effectiveMarks([mk("m", "W", "a", 100, 400)], [W("reinforced")])
    expect(hiddenElements([d1], resolved)).toEqual([])
    expect(visibleElements([d1], resolved)).toEqual([d1])
  })

  it("RG-13: скрытые и видимые вместе дают все элементы без пересечений, порядок сохраняется", () => {
    const d2: Doorway = { id: "d2", wallId: "W", anchor: "a", offsetCm: 400, widthCm: 60, heightCm: 210 } // 400–460
    const d3: Doorway = { id: "d3", wallId: "W", anchor: "a", offsetCm: 20, widthCm: 60, heightCm: 210 } // 20–80
    const all = [d3, d1, d2]
    const resolved = resolve(150, 420)
    expect(hiddenElements(all, resolved)).toEqual([d1, d2])
    expect(visibleElements(all, resolved)).toEqual([d3])
  })

  it("RG-14: пустые списки", () => {
    expect(hiddenElements([], resolve(100, 200))).toEqual([])
    expect(visibleElements([], resolve(100, 200))).toEqual([])
    expect(hiddenElements([d1], [])).toEqual([])
    expect(visibleElements([d1], [])).toEqual([d1])
  })

  it("RG-14: вход не мутируется", () => {
    expect(() => hiddenElements(deepFreeze([d1]), deepFreeze(resolve(100, 400)))).not.toThrow()
    expect(() => visibleElements(deepFreeze([d1]), deepFreeze(resolve(100, 400)))).not.toThrow()
  })

  it("RG-15: несколько участков одной стены — элемент скрыт любым из них", () => {
    const resolved = effectiveMarks([mk("m1", "W", "a", 0, 50), mk("m2", "W", "a", 280, 300)], walls)
    expect(hiddenElements([d1], resolved)).toEqual([d1])
  })
})
