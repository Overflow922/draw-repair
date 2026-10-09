import { describe, expect, it } from "vitest"
import { CHAIN_OFFSET_EM, DIM_TEXT_GAP_PX } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import { SCREEN_METRICS } from "../render"
import { PX_PER_CM } from "../types"
import type { Point, Unit, Wall } from "../types"
import { W, deepFreeze, wall } from "./demolition.test-utils"
import { markDimensionExtent, markDimensions } from "./mark-dimensions"
import type { MarkDimension } from "./mark-dimensions"
import type { MarkSpan } from "./mark-model"
import { markNumberAt } from "./mark-numbers"

// change demolition-dimension-chains: раскладка размеров пометок (spec demolition-plan «Размерные линии пометок»;
// design D2). TCR-2 (change demolition-doorway-sizes): markDimensions(r, walls, mode, …) — режим «chain» даёт шесть
// размеров (грани +1 и −1), «width» — один (ширина на грани +1); оракулы свободной стены прежние: стена W от (0,0)
// до (500,0), толщина 20, нормаль (0,1), грань y = 10, линия размера на 1,2·кегль от грани. Тесты раскладки чисел
// NU-08…NU-13 (change demolition-plan) перенесены сюда с теми же оракулами для грани +1 и дополнены гранью −1.

const K = PX_PER_CM
const LABEL = SCREEN_METRICS.labelPx
const OFF = (CHAIN_OFFSET_EM * LABEL) / K // смещение размерной линии от грани, см
const LIFT = (DIM_TEXT_GAP_PX + LABEL / 2) / K
const near = (p: Point, x: number, y: number, tol = 1e-6): void => {
  expect(Math.abs(p.x - x)).toBeLessThan(tol)
  expect(Math.abs(p.y - y)).toBeLessThan(tol)
}
const span = (from: number, to: number, wallOf: Wall = W()): MarkSpan => ({ wall: wallOf, from, to })

function dims(r: MarkSpan, mode: "chain" | "width", unit: Unit = "cm", k = K, label = LABEL): MarkDimension[] {
  return markDimensions(r, [r.wall], mode, unit, k, label)
}
const chain = (r: MarkSpan, unit: Unit = "cm"): MarkDimension[] => dims(r, "chain", unit)
const side = (list: MarkDimension[], s: 1 | -1): MarkDimension[] => list.filter((d) => d.side === s)

describe("размеры пометки: ширина (режим width)", () => {
  it("DC-01: пометка 100–190 — один размер ширины на грани +1: точки на грани y = 10, линия сдвинута на 1,2·кегль в сторону нормали", () => {
    const list = dims(span(100, 190), "width")
    expect(list).toHaveLength(1)
    const [d] = list
    expect(d?.side).toBe(1)
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

  it("DC-02: ширина в режиме width совпадает с шириной грани +1 в режиме chain (границы и число)", () => {
    const inChain = chain(span(100, 190)).find((d) => d.side === 1 && d.target === "width")
    const alone = dims(span(100, 190), "width")[0]
    expect(inChain?.text).toBe(alone?.text)
    expect(inChain?.geom).toEqual(alone?.geom)
  })

  it("DC-03: пометка на всю стену в режиме width: один размер ширины 500 с геометрией", () => {
    const list = dims(span(0, 500), "width")
    expect(list).toHaveLength(1)
    expect(list[0]?.text).toBe("500")
    const g = list[0]?.geom
    if (!g) throw new Error("ширина должна иметь геометрию")
    near(g.a, 0, 10)
    near(g.b, 500, 10)
  })

  it("DC-05: единицы меняют только текст: 90 см = «0,9» м = «900» мм, геометрия не меняется", () => {
    const [cm, m, mm] = (["cm", "m", "mm"] as const).map((u) => dims(span(100, 190), "width", u)[0])
    expect([cm?.text, m?.text, mm?.text]).toEqual(["90", "0,9", "900"])
    expect(m?.geom).toEqual(cm?.geom)
    expect(mm?.geom).toEqual(cm?.geom)
  })
})

describe("размеры пометки: цепочка из шести размеров (режим chain)", () => {
  it("DC-02: свободная стена, 100–190: порядок — грань +1 (gapA, width, gapB), затем грань −1; числа 100, 90, 310 на каждой", () => {
    const list = chain(span(100, 190))
    expect(list.map((d) => [d.side, d.target])).toEqual([
      [1, "gapA"],
      [1, "width"],
      [1, "gapB"],
      [-1, "gapA"],
      [-1, "width"],
      [-1, "gapB"],
    ])
    expect(list.map((d) => d.text)).toEqual(["100", "90", "310", "100", "90", "310"])
    expect(list.map((d) => d.valueCm)).toEqual([100, 90, 310, 100, 90, 310])
  })

  it("DC-02: границы вдоль оси: [0,100], [100,190], [190,500] на обеих гранях", () => {
    for (const s of [1, -1] as const) expect(side(chain(span(100, 190)), s).map((d) => [d.fromCm, d.toCm])).toEqual([[0, 100], [100, 190], [190, 500]])
  })

  it("DC-02: грань +1 — точки на y = 10, линии на y = 10 + OFF; грань −1 — точки на y = −10, линии на y = −10 − OFF", () => {
    const list = chain(span(100, 190))
    const xs: [number, number][] = [[0, 100], [100, 190], [190, 500]]
    side(list, 1).forEach((d, i) => {
      const g = d.geom
      const [x0, x1] = xs[i] ?? [NaN, NaN]
      if (!g) throw new Error("ожидалась геометрия")
      near(g.a, x0, 10)
      near(g.b, x1, 10)
      near(g.p1, x0, 10 + OFF)
      near(g.p2, x1, 10 + OFF)
    })
    side(list, -1).forEach((d, i) => {
      const g = d.geom
      const [x0, x1] = xs[i] ?? [NaN, NaN]
      if (!g) throw new Error("ожидалась геометрия")
      near(g.a, x0, -10)
      near(g.b, x1, -10)
      near(g.p1, x0, -10 - OFF)
      near(g.p2, x1, -10 - OFF)
    })
  })

  it("DC-03: нулевой отступ от конца a — gapA на обеих гранях без геометрии и с числом «0»; остальные размеры с геометрией", () => {
    const list = chain(span(0, 190))
    expect(list.map((d) => d.text)).toEqual(["0", "190", "310", "0", "190", "310"])
    expect(list.map((d) => d.geom === null)).toEqual([true, false, false, true, false, false])
  })

  it("DC-03: нулевой отступ до конца b — gapB на обеих гранях без геометрии", () => {
    const list = chain(span(300, 500))
    expect(list.map((d) => d.text)).toEqual(["300", "200", "0", "300", "200", "0"])
    expect(list.map((d) => d.geom === null)).toEqual([false, false, true, false, false, true])
  })

  it("DC-03: пометка на всю стену — оба отступа нулевые, ширина 500 с геометрией", () => {
    const list = chain(span(0, 500))
    expect(list.map((d) => d.text)).toEqual(["0", "500", "0", "0", "500", "0"])
    expect(list.map((d) => d.geom === null)).toEqual([true, false, true, true, false, true])
  })

  it("DC-03: малый отступ 3 см — ненулевой размер с геометрией и числом «3»", () => {
    const [d] = chain(span(3, 190))
    expect(d?.text).toBe("3")
    const g = d?.geom
    expect(g).not.toBeNull()
    if (g) {
      near(g.a, 0, 10)
      near(g.b, 3, 10)
    }
  })

  it("DC-05: единицы в цепочке: м — «1», «0,9», «3,1»; мм — «1000», «900», «3100»", () => {
    expect(side(chain(span(100, 190), "m"), 1).map((d) => d.text)).toEqual(["1", "0,9", "3,1"])
    expect(side(chain(span(100, 190), "mm"), 1).map((d) => d.text)).toEqual(["1000", "900", "3100"])
  })

  it("DC-08: комната с замкнутыми углами: размеры грани +1 начинаются у стыка 10 и заканчиваются у стыка 490; грани −1 — от −10 до 510", () => {
    const ws = [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]
    const r: MarkSpan = { wall: ws[0] as Wall, from: 100, to: 190 }
    const list = markDimensions(r, ws, "chain", "cm", K, LABEL)
    expect(list.map((d) => d.text)).toEqual(["90", "90", "300", "110", "90", "320"])
    expect(side(list, 1).map((d) => [d.fromCm, d.toCm])).toEqual([[10, 100], [100, 190], [190, 490]])
    expect(side(list, -1).map((d) => [d.fromCm, d.toCm])).toEqual([[-10, 100], [100, 190], [190, 510]])
  })

  it("DC-08: комната, пометка на всю стену: на гранях 0, 480, 0 и 0, 520, 0; ширина в режиме width — 480 (грань +1 между стыками)", () => {
    const ws = [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]
    const r: MarkSpan = { wall: ws[0] as Wall, from: 0, to: 500 }
    expect(markDimensions(r, ws, "chain", "cm", K, LABEL).map((d) => d.text)).toEqual(["0", "480", "0", "0", "520", "0"])
    const [width] = markDimensions(r, ws, "width", "cm", K, LABEL)
    expect(width?.text).toBe("480")
    const g = width?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, 10, 10)
    near(g.b, 490, 10)
  })

  it("DC-08: стена без граней (вырожденная) — пустой список", () => {
    const z = wall(10, 10, 10, 10, "Z")
    expect(markDimensions({ wall: z, from: 0, to: 5 }, [z], "chain", "cm", K, LABEL)).toEqual([])
    expect(markDimensions({ wall: z, from: 0, to: 5 }, [z], "width", "cm", K, LABEL)).toEqual([])
  })
})

describe("размеры пометки: сторона нормали и направление стены", () => {
  it("DC-04: стена в обратном направлении (500,0)→(0,0): грань +1 — нормаль (0,−1), y = −10, участок 100–190 от конца a даёт x = 400…310", () => {
    const g = dims(span(100, 190, wall(500, 0, 0, 0, "R")), "width")[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, 400, -10)
    near(g.b, 310, -10)
    near(g.p1, 400, -10 - OFF)
    near(g.p2, 310, -10 - OFF)
  })

  it("DC-04: вертикальная стена (0,0)→(0,300): грань +1 — нормаль (−1,0), x = −10, линия левее", () => {
    const g = dims(span(100, 190, wall(0, 0, 0, 300, "V")), "width")[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, -10, 100)
    near(g.b, -10, 190)
    near(g.p1, -10 - OFF, 100)
    near(g.p2, -10 - OFF, 190)
  })

  it("DC-04: диагональная стена (0,0)→(300,300): точки на грани и линия на 1,2·кегль по нормали (−√½, √½)", () => {
    const s = Math.SQRT1_2
    const g = dims(span(100, 190, wall(0, 0, 300, 300, "D")), "width")[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, 100 * s - 10 * s, 100 * s + 10 * s)
    near(g.b, 190 * s - 10 * s, 190 * s + 10 * s)
    near(g.p1, 100 * s - (10 + OFF) * s, 100 * s + (10 + OFF) * s)
    near(g.p2, 190 * s - (10 + OFF) * s, 190 * s + (10 + OFF) * s)
  })

  it("DC-04: толщина стены задаёт положение грани: стена 40 см — грань y = 20", () => {
    const g = dims(span(100, 190, wall(0, 0, 500, 0, "T", "brick", 40)), "width")[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.a, 100, 20)
    near(g.p1, 100, 20 + OFF)
  })

  it("DC-04: смещение линии зависит от масштаба экрана и кегля: k = 4 и кегль 7 дают 1,2·7/4 см", () => {
    const g = dims(span(100, 190), "width", "cm", 4, 7)[0]?.geom
    if (!g) throw new Error("ожидалась геометрия")
    near(g.p1, 100, 10 + (1.2 * 7) / 4)
  })
})

describe("раскладка чисел размеров", () => {
  const list = chain(span(100, 190))

  it("NU-09: центры чисел грани +1 — середины отрезков [0,100], [100,190], [190,500] над линией размера; направление текста (1, 0)", () => {
    const xs = [50, 145, 345]
    side(list, 1).forEach((d, i) => {
      expect(d.spot.center.x).toBeCloseTo(xs[i] ?? NaN, 9)
      expect(d.spot.center.y).toBeCloseTo(10 + OFF - LIFT, 9)
      expect(d.spot.dir.x).toBeCloseTo(1, 9)
      expect(d.spot.dir.y).toBeCloseTo(0, 9)
    })
  })

  it("NU-09: центры чисел грани −1 — над линией размера на y = −10 − OFF (текст всегда «вверх» по экрану)", () => {
    const xs = [50, 145, 345]
    side(list, -1).forEach((d, i) => {
      expect(d.spot.center.x).toBeCloseTo(xs[i] ?? NaN, 9)
      expect(d.spot.center.y).toBeCloseTo(-10 - OFF - LIFT, 9)
    })
  })

  it("NU-09: spot несёт сторону грани и цель числа, текст и значение совпадают с размером", () => {
    list.forEach((d) => {
      expect(d.spot.side).toBe(d.side)
      expect(d.spot.target).toBe(d.target)
      expect(d.spot.text).toBe(d.text)
      expect(d.spot.valueCm).toBe(d.valueCm)
    })
  })

  it("NU-09: размеры прямоугольника числа: ширина — длина текста × кегль × CHAR_WIDTH / k, высота — кегль / k", () => {
    list.forEach((d) => {
      expect(d.spot.widthCm).toBeCloseTo((d.text.length * LABEL * CHAR_WIDTH) / K, 9)
      expect(d.spot.heightCm).toBeCloseTo(LABEL / K, 9)
    })
  })

  it("NU-10: вертикальная стена (0,0)→(0,500): грань +1 — числа левее стены (x < −10), грань −1 — правее (x > 10); y — середины отрезков", () => {
    const vertical = chain(span(100, 190, wall(0, 0, 0, 500, "W")))
    const ys = [50, 145, 345]
    side(vertical, 1).forEach((d, i) => {
      expect(d.spot.center.y).toBeCloseTo(ys[i] ?? NaN, 9)
      expect(d.spot.center.x).toBeLessThan(-10)
    })
    side(vertical, -1).forEach((d, i) => {
      expect(d.spot.center.y).toBeCloseTo(ys[i] ?? NaN, 9)
      expect(d.spot.center.x).toBeGreaterThan(10)
    })
  })

  it("NU-10: текст направлен слева направо (dir.x > 0) у стены, идущей справа налево", () => {
    for (const d of chain(span(100, 190, wall(500, 0, 0, 0, "W")))) expect(d.spot.dir.x).toBeGreaterThan(0.99)
  })

  it("NU-11: нулевой отступ — число над точкой: dir = (1, 0), подъём — половина кегля, текст «0»", () => {
    const [zero] = chain(span(0, 190))
    expect(zero?.text).toBe("0")
    expect(zero?.spot.dir).toEqual({ x: 1, y: 0 })
    expect(zero?.spot.center.x).toBeCloseTo(0, 9)
    expect(zero?.spot.center.y).toBeCloseTo(10 + OFF - LABEL / 2 / K, 9)
  })

  it("NU-11: нулевое число грани −1 стоит над точкой на линии y = −10 − OFF", () => {
    const zero = chain(span(0, 190)).find((d) => d.side === -1 && d.target === "gapA")
    expect(zero?.spot.center.x).toBeCloseTo(0, 9)
    expect(zero?.spot.center.y).toBeCloseTo(-10 - OFF - LABEL / 2 / K, 9)
  })

  it("NU-13: spot ширины в режиме width совпадает со spot ширины грани +1 из цепочки", () => {
    const width = dims(span(100, 190), "width")[0]
    expect(width?.spot).toEqual(list.find((d) => d.side === 1 && d.target === "width")?.spot)
    expect(width?.spot.text).toBe("90")
  })

  it("DC-06: размерные линии не правятся: точка на линии размера между числами и на выносной линии не попадает ни в одно число", () => {
    const spots = list.map((d) => d.spot)
    expect(markNumberAt({ x: 110, y: 10 + OFF }, spots, 1 / K)).toBeNull()
    expect(markNumberAt({ x: 100, y: 10 + OFF / 2 }, spots, 1 / K)).toBeNull()
    expect(markNumberAt({ x: 110, y: -10 - OFF }, spots, 1 / K)).toBeNull()
  })

  it("DC-06: попадание в центр числа возвращает spot именно этой грани и цели", () => {
    for (const d of list) expect(markNumberAt(d.spot.center, list.map((x) => x.spot), 0)).toBe(d.spot)
  })

  it("NU-09: вход не мутируется", () => {
    const r = deepFreeze(span(100, 190, deepFreeze(W())))
    expect(() => markDimensions(r, deepFreeze([W()]), "chain", "cm", K, LABEL)).not.toThrow()
  })
})

describe("габариты размера пометки для страницы", () => {
  const box = (pts: Point[]) => ({
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  })
  const extent = (r: MarkSpan, k = K, ws: Wall[] = [r.wall]): Point[] => markDimensionExtent(r, ws, k, SCREEN_METRICS)

  it("DC-07: габариты включают концы выносных линий за размерной линией: x = 100 и 190, y = 10 + 1,2·кегль/k + выступ/k", () => {
    const pts = extent(span(100, 190))
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
    const spot = dims(r, "width")[0]?.spot
    if (!spot) throw new Error("ожидался spot")
    const b = box(extent(r))
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
    const b = box(extent(span(100, 190, wall(500, 0, 0, 0, "R"))))
    expect(b.minY).toBeLessThanOrEqual(-10 - OFF - SCREEN_METRICS.dimOvershootPx / K + 1e-6)
    expect(b.maxY).toBeLessThan(0)
  })

  it("DC-07: масштаб k переводит пиксели метрик в сантиметры: при k = 2·K отступы вдвое меньше", () => {
    const a = box(extent(span(100, 190)))
    const c = box(extent(span(100, 190), 2 * K))
    expect(c.maxY - 10).toBeLessThan((a.maxY - 10) * 0.75)
    expect(c.maxY).toBeGreaterThan(10)
  })

  it("DC-07: габариты берутся по ширине на грани +1 между стыками: комната, пометка на всю стену — выносные линии в x = 10 и 490", () => {
    const ws = [wall(0, 0, 500, 0, "W"), wall(500, 0, 500, 400, "R"), wall(500, 400, 0, 400, "B"), wall(0, 400, 0, 0, "L")]
    const r: MarkSpan = { wall: ws[0] as Wall, from: 0, to: 500 }
    const pts = extent(r, K, ws)
    const far = 10 + OFF + SCREEN_METRICS.dimOvershootPx / K
    expect(pts.some((p) => Math.abs(p.x - 10) < 1e-6 && Math.abs(p.y - far) < 1e-6)).toBe(true)
    expect(pts.some((p) => Math.abs(p.x - 490) < 1e-6 && Math.abs(p.y - far) < 1e-6)).toBe(true)
  })

  it("DC-07: вырожденная стена — пустой список точек", () => {
    const z = wall(10, 10, 10, 10, "Z")
    expect(extent({ wall: z, from: 0, to: 5 })).toEqual([])
  })
})
