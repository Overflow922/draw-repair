import { describe, expect, it } from "vitest"
import { SCREEN_METRICS } from "../render"
import { PX_PER_CM } from "../types"
import type { Point } from "../types"
import { W, wall } from "./demolition.test-utils"
import { markDimensionExtent, markDimensions } from "./mark-dimensions"
import type { MarkSpan } from "./mark-model"
import { markLabelSpot, markNumberAt, markNumberLayout } from "./mark-numbers"

// change demolition-dimension-chains: раскладка размеров пометок (spec demolition-plan «Размерные линии пометок»;
// design D2). Эталоны выведены из геометрии: стена W от (0,0) до (500,0), толщина 20, нормаль (0,1), грань y = 10,
// размерная линия на 1,2·кегль от грани.

const K = PX_PER_CM
const LABEL = SCREEN_METRICS.labelPx
const OFF = (1.2 * LABEL) / K // смещение размерной линии от грани, см
const near = (p: Point, x: number, y: number, tol = 1e-6): void => {
  expect(Math.abs(p.x - x)).toBeLessThan(tol)
  expect(Math.abs(p.y - y)).toBeLessThan(tol)
}
const span = (from: number, to: number, wallOf = W()): MarkSpan => ({ wall: wallOf, from, to })

describe("размеры пометки: ширина и цепочка", () => {
  it("DC-01: невыделенная пометка 100–190 — один размер ширины: точки на грани y = 10, линия сдвинута на 1,2·кегль в сторону нормали", () => {
    const dims = markDimensions(span(100, 190), false, "cm", K, LABEL)
    expect(dims).toHaveLength(1)
    const [d] = dims
    expect(d?.target).toBe("width")
    expect(d?.text).toBe("90")
    const g = d?.geom
    expect(g).not.toBeNull()
    if (!g) return
    near(g.a, 100, 10)
    near(g.b, 190, 10)
    near(g.p1, 100, 10 + OFF)
    near(g.p2, 190, 10 + OFF)
    expect(g.nx).toBeCloseTo(0, 9)
    expect(g.ny).toBeCloseTo(1, 9)
  })

  it("DC-02: выделенная пометка 100–190 — три размера в порядке gapA, width, gapB с числами 100, 90, 310 и своими границами на грани", () => {
    const dims = markDimensions(span(100, 190), true, "cm", K, LABEL)
    expect(dims.map((d) => d.target)).toEqual(["gapA", "width", "gapB"])
    expect(dims.map((d) => d.text)).toEqual(["100", "90", "310"])
    const [a, w, b] = dims
    if (!a?.geom || !w?.geom || !b?.geom) throw new Error("у трёх ненулевых размеров должна быть геометрия")
    near(a.geom.a, 0, 10)
    near(a.geom.b, 100, 10)
    near(w.geom.a, 100, 10)
    near(w.geom.b, 190, 10)
    near(b.geom.a, 190, 10)
    near(b.geom.b, 500, 10)
    for (const g of [a.geom, w.geom, b.geom]) {
      near(g.p1, g.a.x, 10 + OFF)
      near(g.p2, g.b.x, 10 + OFF)
    }
  })

  it("DC-02: ширина у выделенной и невыделенной пометки одна и та же (границы и число)", () => {
    const selected = markDimensions(span(100, 190), true, "cm", K, LABEL).find((d) => d.target === "width")
    const plain = markDimensions(span(100, 190), false, "cm", K, LABEL)[0]
    expect(selected?.text).toBe(plain?.text)
    expect(selected?.geom).toEqual(plain?.geom)
  })

  it("DC-03: нулевой отступ от конца a — размер gapA без геометрии и с числом «0»; остальные размеры с геометрией", () => {
    const dims = markDimensions(span(0, 190), true, "cm", K, LABEL)
    expect(dims.map((d) => d.text)).toEqual(["0", "190", "310"])
    expect(dims[0]?.geom).toBeNull()
    expect(dims[1]?.geom).not.toBeNull()
    expect(dims[2]?.geom).not.toBeNull()
  })

  it("DC-03: нулевой отступ до конца b — размер gapB без геометрии и с числом «0»", () => {
    const dims = markDimensions(span(300, 500), true, "cm", K, LABEL)
    expect(dims.map((d) => d.text)).toEqual(["300", "200", "0"])
    expect(dims[0]?.geom).not.toBeNull()
    expect(dims[1]?.geom).not.toBeNull()
    expect(dims[2]?.geom).toBeNull()
  })

  it("DC-03: пометка на всю стену — оба отступа нулевые, ширина 500 с геометрией", () => {
    const dims = markDimensions(span(0, 500), true, "cm", K, LABEL)
    expect(dims.map((d) => d.text)).toEqual(["0", "500", "0"])
    expect(dims.map((d) => d.geom === null)).toEqual([true, false, true])
    const g = dims[1]?.geom
    if (!g) throw new Error("ширина должна иметь геометрию")
    near(g.a, 0, 10)
    near(g.b, 500, 10)
  })

  it("DC-03: нулевой размер не превращается в размер с линией: у невыделенной пометки на всю стену есть только ширина", () => {
    const dims = markDimensions(span(0, 500), false, "cm", K, LABEL)
    expect(dims).toHaveLength(1)
    expect(dims[0]?.target).toBe("width")
    expect(dims[0]?.geom).not.toBeNull()
  })
})

describe("размеры пометки: сторона нормали и направление стены", () => {
  it("DC-04: стена в обратном направлении (500,0)→(0,0): нормаль (0,−1), грань y = −10, участок 100–190 от конца a даёт x = 400…310", () => {
    const g = markDimensions(span(100, 190, wall(500, 0, 0, 0, "R")), false, "cm", K, LABEL)[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, 400, -10)
    near(g.b, 310, -10)
    near(g.p1, 400, -10 - OFF)
    near(g.p2, 310, -10 - OFF)
  })

  it("DC-04: вертикальная стена (0,0)→(0,300): нормаль (−1,0), грань x = −10, линия левее", () => {
    const g = markDimensions(span(100, 190, wall(0, 0, 0, 300, "V")), false, "cm", K, LABEL)[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, -10, 100)
    near(g.b, -10, 190)
    near(g.p1, -10 - OFF, 100)
    near(g.p2, -10 - OFF, 190)
  })

  it("DC-04: диагональная стена (0,0)→(300,300): точки на грани и линия на 1,2·кегль по нормали (−√½, √½)", () => {
    const s = Math.SQRT1_2
    const g = markDimensions(span(100, 190, wall(0, 0, 300, 300, "D")), false, "cm", K, LABEL)[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, 100 * s - 10 * s, 100 * s + 10 * s)
    near(g.b, 190 * s - 10 * s, 190 * s + 10 * s)
    near(g.p1, 100 * s - (10 + OFF) * s, 100 * s + (10 + OFF) * s)
    near(g.p2, 190 * s - (10 + OFF) * s, 190 * s + (10 + OFF) * s)
  })

  it("DC-04: толщина стены задаёт положение грани: стена 40 см — грань y = 20", () => {
    const g = markDimensions(span(100, 190, wall(0, 0, 500, 0, "T", "brick", 40)), false, "cm", K, LABEL)[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, 100, 20)
    near(g.p1, 100, 20 + OFF)
  })

  it("DC-04: смещение линии зависит от масштаба экрана и кегля: k = 4 и кегль 7 дают 1,2·7/4 см", () => {
    const g = markDimensions(span(100, 190), false, "cm", 4, 7)[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.p1, 100, 10 + (1.2 * 7) / 4)
  })
})

describe("размеры пометки: единицы и числа", () => {
  it("DC-05: единицы меняют только текст: 90 см = «0,9» м = «900» мм, геометрия не меняется", () => {
    const cm = markDimensions(span(100, 190), false, "cm", K, LABEL)[0]
    const m = markDimensions(span(100, 190), false, "m", K, LABEL)[0]
    const mm = markDimensions(span(100, 190), false, "mm", K, LABEL)[0]
    expect([cm?.text, m?.text, mm?.text]).toEqual(["90", "0,9", "900"])
    expect(m?.geom).toEqual(cm?.geom)
    expect(mm?.geom).toEqual(cm?.geom)
  })

  it("DC-03: малый отступ 3 см — ненулевой размер с геометрией и числом «3»", () => {
    const dims = markDimensions(span(3, 190), true, "cm", K, LABEL)
    expect(dims[0]?.text).toBe("3")
    expect(dims[0]?.geom).not.toBeNull()
    const g = dims[0]?.geom
    if (g) {
      near(g.a, 0, 10)
      near(g.b, 3, 10)
    }
  })

  it("DC-06: размерные линии не правятся: точка на линии размера между числами не попадает ни в одно число (markNumberAt = null)", () => {
    const dims = markDimensions(span(100, 190), true, "cm", K, LABEL)
    const onLine = { x: 110, y: 10 + OFF }
    expect(markNumberAt(onLine, dims.map((d) => d.spot), 1 / K)).toBeNull()
    const onExtension = { x: 100, y: 10 + OFF / 2 }
    expect(markNumberAt(onExtension, dims.map((d) => d.spot), 1 / K)).toBeNull()
  })

  it("DC-06: числа для попадания не меняются: spot каждого размера совпадает с markNumberLayout, у невыделенной — с markLabelSpot", () => {
    const r = span(100, 190)
    const dims = markDimensions(r, true, "cm", K, LABEL)
    expect(dims.map((d) => d.spot)).toEqual(markNumberLayout(r, "cm", K, LABEL))
    expect(markDimensions(r, false, "cm", K, LABEL).map((d) => d.spot)).toEqual([markLabelSpot(r, "cm", K, LABEL)])
  })
})

describe("габариты размера пометки для страницы", () => {
  const box = (pts: Point[]) => ({
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  })

  it("DC-07: габариты включают концы выносных линий за размерной линией: x = 100 и 190, y = 10 + 1,2·кегль/k + выступ/k", () => {
    const pts = markDimensionExtent(span(100, 190), K, SCREEN_METRICS)
    const b = box(pts)
    const far = 10 + OFF + SCREEN_METRICS.dimOvershootPx / K
    expect(b.maxY).toBeGreaterThanOrEqual(far - 1e-6)
    expect(b.minX).toBeLessThanOrEqual(100 + 1e-6)
    expect(b.maxX).toBeGreaterThanOrEqual(190 - 1e-6)
    expect(pts.some((p) => Math.abs(p.x - 100) < 1e-6 && Math.abs(p.y - far) < 1e-6)).toBe(true)
    expect(pts.some((p) => Math.abs(p.x - 190) < 1e-6 && Math.abs(p.y - far) < 1e-6)).toBe(true)
  })

  it("DC-07: габариты включают прямоугольник числа ширины (все четыре угла)", () => {
    const r = span(100, 190)
    const spot = markLabelSpot(r, "cm", K, SCREEN_METRICS.labelPx)
    const b = box(markDimensionExtent(r, K, SCREEN_METRICS))
    const hw = spot.widthCm / 2
    const hh = spot.heightCm / 2
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const cx = spot.center.x + sx * spot.dir.x * hw - sy * spot.dir.y * hh
        const cy = spot.center.y + sx * spot.dir.y * hw + sy * spot.dir.x * hh
        expect(cx).toBeGreaterThanOrEqual(b.minX - 1e-6)
        expect(cx).toBeLessThanOrEqual(b.maxX + 1e-6)
        expect(cy).toBeGreaterThanOrEqual(b.minY - 1e-6)
        expect(cy).toBeLessThanOrEqual(b.maxY + 1e-6)
      }
  })

  it("DC-07: у обратной стены габариты уходят в сторону её нормали (y < −10)", () => {
    const b = box(markDimensionExtent(span(100, 190, wall(500, 0, 0, 0, "R")), K, SCREEN_METRICS))
    expect(b.minY).toBeLessThanOrEqual(-10 - OFF - SCREEN_METRICS.dimOvershootPx / K + 1e-6)
    expect(b.maxY).toBeLessThan(0)
  })

  it("DC-07: масштаб k переводит пиксели метрик в сантиметры: при k = 2·K отступы вдвое меньше", () => {
    const a = box(markDimensionExtent(span(100, 190), K, SCREEN_METRICS))
    const c = box(markDimensionExtent(span(100, 190), 2 * K, SCREEN_METRICS))
    expect(c.maxY - 10).toBeLessThan((a.maxY - 10) * 0.75)
    expect(c.maxY).toBeGreaterThan(10)
  })
})
