import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import type { DemolitionMark, Drawing, Wall } from "../types"
import { colorSegments, isRed, parseColoredStrokes } from "./pdf-colors.test-utils"
import { availableFormatsForPages, buildPdfPages, pageBounds, pagesOf } from "./pdf"
import type { PlanPage } from "./pdf"
import { drawingArea } from "./sheet-layout"

// change demolition-dimension-chains: размеры пометок на странице демонтажа PDF и габариты страницы (spec pdf-export
// «Размеры пометок на странице демонтажа»; design D3–D4). Масштаб 1:100 — 1 см чертежа = 0,1 мм листа. Метрики PDF:
// кегль 3,5, линия размера на 1,2·кегль = 4,2 мм от грани, выступ выносной линии 1,5 мм, зазор числа 0,6 мм.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const SCALE = 100
const CM_PER_MM = SCALE / 10
const LABEL_MM = 3.5
const OFF_CM = 1.2 * LABEL_MM * CM_PER_MM // 42 см — смещение линии размера от грани
const OVERSHOOT_CM = 1.5 * CM_PER_MM // 15 см — выступ выносной линии
const PAD_CM = 0.5 * SCALE // 50 см — поле вокруг габаритов
const THIN_MM = 0.25

const wall = (ax: number, ay: number, bx: number, by: number, id: string): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm: 20, type: "brick" })
const mark = (id: string, wallId: string, from: number, to: number): DemolitionMark => ({ id, wallId, anchor: "a", fromCm: from, toCm: to })

const drawing = (walls: Wall[], demolition: DemolitionMark[]): Drawing => ({
  id: "a",
  name: "Чертёж 1",
  walls,
  dimensions: [],
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  scale: SCALE,
  demolition,
})

const pageOf = (walls: Wall[], demolition: DemolitionMark[]): PlanPage => {
  const page = pagesOf(drawing(walls, demolition))[1]
  if (!page) throw new Error("нет страницы демонтажа")
  return page
}

const W1 = wall(0, 0, 500, 0, "w1")
const M1 = mark("m1", "w1", 100, 190)

describe("размеры пометок на странице PDF", () => {
  const doc = buildPdfPages(pagesOf(drawing([W1], [M1])), "cm", SCALE, "A4", font, "Чертёж 1", SEP)
  const thin = colorSegments(parseColoredStrokes(doc, 2).filter((s) => isRed(s.color))).filter((s) => Math.abs(s.widthMm - THIN_MM) < 0.005)
  const length = (s: { a: { x: number; y: number }; b: { x: number; y: number } }): number => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)
  const isVertical = (s: { a: { x: number }; b: { x: number } }): boolean => Math.abs(s.a.x - s.b.x) < 1e-3
  const isHorizontal = (s: { a: { y: number }; b: { y: number } }): boolean => Math.abs(s.a.y - s.b.y) < 1e-3
  const distinct = (values: number[]): number[] => [...new Set(values.map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q)
  const gaps = (xs: number[]): number[] => xs.slice(1).map((x, i) => Math.round((x - (xs[i] ?? 0)) * 100) / 100)

  it("CD-11: выносные линии цепочки — красные вертикальные тонкие — стоят в четырёх местах x = 0, 100, 190, 500 см: промежутки 10, 9 и 31 мм", () => {
    const xs = distinct(thin.filter(isVertical).map((s) => s.a.x))
    expect(xs).toHaveLength(4)
    expect(gaps(xs)).toEqual([10, 9, 31])
  })

  it("CD-11: выносные линии есть на обеих гранях: на каждом из четырёх мест по линии выше и по линии ниже стены (две разные стороны от стены)", () => {
    const ext = thin.filter(isVertical)
    const ys = distinct(ext.flatMap((s) => [s.a.y, s.b.y]))
    // концы выносных линий у граней и у размерных линий: четыре различных высоты (две грани × грань и линия за выступом)
    expect(ys.length).toBeGreaterThanOrEqual(4)
    for (const x of distinct(ext.map((s) => s.a.x))) expect(ext.filter((s) => Math.abs(s.a.x - x) < 0.01).length).toBeGreaterThanOrEqual(2)
  })

  it("CD-11: длина выносной линии — от грани до линии размера плюс выступ: 4,2 + 1,5 = 5,7 мм", () => {
    const ext = thin.filter(isVertical)
    expect(ext.length).toBeGreaterThan(0)
    for (const s of ext) expect(Math.abs(length(s) - (1.2 * LABEL_MM + 1.5))).toBeLessThan(0.01)
  })

  it("CD-11: на каждой грани размерные линии идут сплошь от x = 0 до x = 500 см (50 мм) тремя размерами — две горизонтали на разной высоте", () => {
    const lines = thin.filter(isHorizontal)
    const ys = distinct(lines.map((s) => s.a.y))
    expect(ys).toHaveLength(2)
    for (const y of ys) {
      const onY = lines.filter((s) => Math.abs(s.a.y - y) < 0.01)
      const total = onY.reduce((sum, s) => sum + length(s), 0)
      expect(Math.abs(total - 50)).toBeLessThan(0.05)
    }
  })

  it("CD-11: подчёркивания на странице нет: на каждой размерной линии штрихи не короче размера без разрывов под числами — суммарная длина штрихов равна 50 мм", () => {
    const lines = thin.filter(isHorizontal)
    const total = lines.reduce((sum, s) => sum + length(s), 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.1)
  })

  it("CD-11: на странице обмерочного плана красных линий нет", () => {
    expect(parseColoredStrokes(doc, 1).filter((s) => isRed(s.color))).toEqual([])
  })

  it("DC-20: без пометок на странице демонтажа нет ни выносных, ни размерных линий", () => {
    const empty = buildPdfPages(pagesOf(drawing([W1], [])), "cm", SCALE, "A4", font, "Чертёж 1", SEP)
    expect(parseColoredStrokes(empty, 2).filter((s) => isRed(s.color))).toEqual([])
  })

  it("CD-14: нулевое расстояние в PDF не рисуется: у пометки 0–190 выносные линии стоят только в x = 0, 190, 500 — промежутки 19 и 31 мм", () => {
    const zero = buildPdfPages(pagesOf(drawing([W1], [mark("z", "w1", 0, 190)])), "cm", SCALE, "A4", font, "Чертёж 1", SEP)
    const zthin = colorSegments(parseColoredStrokes(zero, 2).filter((s) => isRed(s.color))).filter((s) => Math.abs(s.widthMm - THIN_MM) < 0.005)
    const xs = distinct(zthin.filter(isVertical).map((s) => s.a.x))
    expect(xs).toHaveLength(3)
    expect(gaps(xs)).toEqual([19, 31])
    const total = zthin.filter(isHorizontal).reduce((sum, s) => sum + length(s), 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.1)
  })
})
describe("габариты страницы демонтажа", () => {
  const top = (b: ReturnType<typeof pageBounds>) => b.minY
  it("CD-15: цепочка обеих граней выступает за стену: maxY = 10 + 42 + 15 + поле 50 см (грань +1), minY = −10 − 42 − число 50 − поле 50 см (число грани −1 над линией)", () => {
    const without = pageBounds(pageOf([W1], []), SCALE)
    const withMark = pageBounds(pageOf([W1], [M1]), SCALE)
    const numberFarEdgeCm = (1.5 + LABEL_MM) * CM_PER_MM
    expect(withMark.maxY).toBeCloseTo(10 + OFF_CM + OVERSHOOT_CM + PAD_CM, 6)
    expect(withMark.maxY).toBeGreaterThan(without.maxY)
    expect(withMark.minY).toBeCloseTo(-10 - OFF_CM - numberFarEdgeCm - PAD_CM, 6)
    expect(withMark.minY).toBeLessThan(top(without))
    expect(withMark.minX).toBeCloseTo(without.minX, 6)
    expect(withMark.maxX).toBeCloseTo(without.maxX, 6)
  })

  it("DC-21: страница без пометок: габариты как у стен с полем 50 см", () => {
    const b = pageBounds(pageOf([W1], []), SCALE)
    expect(b).toEqual({ minX: -10 - PAD_CM, minY: -10 - PAD_CM, maxX: 510 + PAD_CM, maxY: 10 + PAD_CM })
  })

  it("CD-15: стена в обратном направлении: число грани +1 лежит за линией размера (дальний край — зазор 1,5 + кегль 3,5 = 5 мм = 50 см), поэтому minY = −10 − 42 − 50 − 50; цепочка грани −1 даёт maxY = 10 + 42 + 15 + 50", () => {
    const rev = wall(500, 0, 0, 0, "r")
    const withMark = pageBounds(pageOf([rev], [mark("m", "r", 100, 190)]), SCALE)
    const numberFarEdgeCm = (1.5 + LABEL_MM) * CM_PER_MM
    expect(withMark.minY).toBeCloseTo(-10 - OFF_CM - numberFarEdgeCm - PAD_CM, 6)
    expect(withMark.maxY).toBeCloseTo(10 + OFF_CM + OVERSHOOT_CM + PAD_CM, 6)
  })

  it("CD-15: два участка на разных стенах учитываются оба, в любом порядке пометок: габариты расширены с обеих сторон (у каждой стены внешняя грань)", () => {
    const right = wall(600, 0, 600, 300, "v")
    const left = wall(0, 0, 0, 300, "l")
    const onLeft = mark("m", "l", 100, 190)
    const onRight = mark("n", "v", 100, 190)
    const both = [pageBounds(pageOf([left, right], [onLeft, onRight]), SCALE), pageBounds(pageOf([left, right], [onRight, onLeft]), SCALE)]
    const without = pageBounds(pageOf([left, right], []), SCALE)
    const onlyLeft = pageBounds(pageOf([left, right], [onLeft]), SCALE)
    expect(both[1]).toEqual(both[0])
    expect(both[0].minX).toBeCloseTo(onlyLeft.minX, 6)
    expect(onlyLeft.minX).toBeLessThan(without.minX)
    expect(both[0].maxX).toBeGreaterThan(without.maxX)
  })
  // независимый расчёт габаритов цепочки пометки 100–190 от конца a на свободной стене: на каждой грани (боковое смещение
  // s·10 от оси) концы выносных линий в t = 0, 100, 190, L за линией размера и четыре угла каждого из трёх чисел;
  // ось d = (b − a)/|b − a|, нормаль (−d.y, d.x), текст идёт вдоль оси слева направо, «вверх» от текста — (t.y, −t.x),
  // число стоит над линией с зазором 1,5 мм; ширина числа — число знаков × 0,6 × кегль (значение — целые см)
  const expectedBounds = (w: Wall) => {
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)
    const d = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len }
    const normal = { x: -d.y, y: d.x }
    const flip = Math.atan2(d.y, d.x) > Math.PI / 2 || Math.atan2(d.y, d.x) < -Math.PI / 2 ? -1 : 1
    const textDir = { x: flip * d.x, y: flip * d.y }
    const up = { x: textDir.y, y: -textDir.x }
    const at = (t: number, lateral: number) => ({ x: w.a.x + d.x * t + normal.x * lateral, y: w.a.y + d.y * t + normal.y * lateral })
    const lift = (1.5 + LABEL_MM / 2) * CM_PER_MM
    const hh = (LABEL_MM * CM_PER_MM) / 2
    const segments: [number, number][] = [[0, 100], [100, 190], [190, len]]
    const pts: { x: number; y: number }[] = []
    for (const s of [1, -1]) {
      for (const t of [0, 100, 190, len]) pts.push(at(t, s * (10 + OFF_CM + OVERSHOOT_CM)))
      for (const [t0, t1] of segments) {
        const base = at((t0 + t1) / 2, s * (10 + OFF_CM))
        const center = { x: base.x + up.x * lift, y: base.y + up.y * lift }
        const hw = (`${Math.round(t1 - t0)}`.length * 0.6 * LABEL_MM * CM_PER_MM) / 2
        for (const sa of [-1, 1])
          for (const sb of [-1, 1]) pts.push({ x: center.x + sa * textDir.x * hw + sb * up.x * hh, y: center.y + sa * textDir.y * hw + sb * up.y * hh })
      }
    }
    const walls = pageBounds(pageOf([w], []), SCALE)
    return {
      minX: Math.min(walls.minX + PAD_CM, ...pts.map((p) => p.x)) - PAD_CM,
      maxX: Math.max(walls.maxX - PAD_CM, ...pts.map((p) => p.x)) + PAD_CM,
      minY: Math.min(walls.minY + PAD_CM, ...pts.map((p) => p.y)) - PAD_CM,
      maxY: Math.max(walls.maxY - PAD_CM, ...pts.map((p) => p.y)) + PAD_CM,
    }
  }
  it.each([
    ["диагональ 45° (300,300)→(0,0), число снаружи", wall(300, 300, 0, 0, "d")],
    ["крутая диагональ (100,300)→(0,0)", wall(100, 300, 0, 0, "d")],
    ["крутая диагональ (60,300)→(0,0)", wall(60, 300, 0, 0, "d")],
    ["пологая диагональ (300,100)→(0,0)", wall(300, 100, 0, 0, "d")],
    ["диагональ вниз (0,0)→(300,300), число внутрь", wall(0, 0, 300, 300, "d")],
    ["крутая диагональ вниз (0,0)→(100,300)", wall(0, 0, 100, 300, "d")],
  ])("CD-15: %s: габариты по независимому расчёту углов чисел и концов выносных линий цепочки обеих граней", (_name, w) => {
    const b = pageBounds(pageOf([w], [mark("m", "d", 100, 190)]), SCALE)
    const want = expectedBounds(w)
    expect(b.minX).toBeCloseTo(want.minX, 5)
    expect(b.maxX).toBeCloseTo(want.maxX, 5)
    expect(b.minY).toBeCloseTo(want.minY, 5)
    expect(b.maxY).toBeCloseTo(want.maxY, 5)
  })

  it("CD-17: цепочка обеих граней лежит внутри габаритов стен (перегородка внутри замкнутой комнаты): габариты не меняются", () => {
    const room = [wall(0, 0, 500, 0, "w1"), wall(500, 0, 500, 400, "r"), wall(500, 400, 0, 400, "b"), wall(0, 400, 0, 0, "l"), wall(250, 100, 250, 300, "p")]
    expect(pageBounds(pageOf(room, [mark("p1", "p", 40, 120)]), SCALE)).toEqual(pageBounds(pageOf(room, []), SCALE))
  })

  it("CD-15: пометка на стене комнаты расширяет габариты только наружу: наружная грань даёт minY = −10 − 42 − число 50 − поле 50, остальные стороны не меняются", () => {
    const room = [wall(0, 0, 500, 0, "w1"), wall(500, 0, 500, 400, "r"), wall(500, 400, 0, 400, "b"), wall(0, 400, 0, 0, "l")]
    const without = pageBounds(pageOf(room, []), SCALE)
    const withMark = pageBounds(pageOf(room, [M1]), SCALE)
    expect(withMark.minY).toBeCloseTo(-10 - OFF_CM - (1.5 + LABEL_MM) * CM_PER_MM - PAD_CM, 6)
    expect(withMark.maxY).toBeCloseTo(without.maxY, 6)
    expect(withMark.minX).toBeCloseTo(without.minX, 6)
    expect(withMark.maxX).toBeCloseTo(without.maxX, 6)
  })

  it("DC-23: пометки на железобетонной или отсутствующей стене не действуют и габариты не меняют", () => {
    const reinforced: Wall = { ...W1, type: "reinforced" }
    expect(pageBounds(pageOf([reinforced], [M1]), SCALE)).toEqual(pageBounds(pageOf([reinforced], []), SCALE))
    expect(pageBounds(pageOf([W1], [mark("x", "gone", 100, 190)]), SCALE)).toEqual(pageBounds(pageOf([W1], []), SCALE))
  })

  it("DC-21: габариты страницы обмерочного плана размеров пометок не учитывают", () => {
    const measure = pagesOf(drawing([W1], [M1]))[0]
    if (!measure) throw new Error("нет страницы обмерочного плана")
    expect(pageBounds(measure, SCALE)).toEqual(pageBounds(pageOf([W1], []), SCALE))
  })

  it("DC-21: масштаб переводит метрики листа в сантиметры: при 1:50 размер выступает на 5,7·5 = 28,5 см, поле 25 см", () => {
    const b = pageBounds(pageOf([W1], [M1]), 50)
    expect(b.maxY).toBeCloseTo(10 + 1.2 * LABEL_MM * 5 + 1.5 * 5 + 25, 6)
  })
})

describe("форматы с учётом размеров пометок", () => {
  it("DC-24: размер пометки, выступающий за габариты, исключает формат, на который помещалась бы страница без него", () => {
    const area = drawingArea("A4")
    const widthCm = area.w * CM_PER_MM
    // горизонтальная стена подбирает ширину так, чтобы без пометки страница помещалась на A4 с запасом 10 см
    const long = wall(0, 0, widthCm - 2 * PAD_CM - 20 - 10, 0, "h")
    const vertical = wall(0, 0, 0, 300, "v") // нормаль (−1, 0): размер уходит влево, наружу
    const without = pageOf([long, vertical], [])
    const withMark = pageOf([long, vertical], [mark("m", "v", 100, 190)])
    expect(availableFormatsForPages([without], SCALE)).toContain("A4")
    expect(availableFormatsForPages([withMark], SCALE)).not.toContain("A4")
  })

  it("DC-24: список форматов с пометкой — подмножество списка без неё", () => {
    const wide = [wall(0, 0, 2000, 0, "h"), wall(0, 0, 0, 300, "v")]
    const marks = [mark("m", "v", 100, 190)]
    const withMark = availableFormatsForPages([pageOf(wide, marks)], SCALE)
    const without = availableFormatsForPages([pageOf(wide, [])], SCALE)
    for (const f of withMark) expect(without).toContain(f)
  })
})

describe("размещение размеров на листе", () => {
  it("DC-25: страница, которая помещается на A4 только с учётом размеров пометки, размещается так, что все красные штрихи лежат в области чертежа", () => {
    const area = drawingArea("A4")
    const vertical = wall(0, 0, 0, 300, "v") // нормаль (−1, 0): размер уходит влево, наружу
    const m = [mark("m", "v", 100, 190)]
    const widthOf = (long: Wall): number => {
      const b = pageBounds(pageOf([long, vertical], m), SCALE)
      return b.maxX - b.minX
    }
    // длина горизонтальной стены такова, что габариты с размером занимают область чертежа почти целиком (запас 2 см)
    const base = widthOf(wall(0, 0, 1000, 0, "h"))
    const long = wall(0, 0, 1000 + area.w * CM_PER_MM - 2 - base, 0, "h")
    const page = pageOf([long, vertical], m)
    expect(availableFormatsForPages([page], SCALE)).toContain("A4")
    const doc = buildPdfPages([page], "cm", SCALE, "A4", font, "Чертёж 1", SEP)
    const red = parseColoredStrokes(doc, 1).filter((s) => isRed(s.color))
    const pts = red.flatMap((s) => s.subpaths.flat())
    expect(pts.length).toBeGreaterThan(0)
    // чертёж центрирован в области по габаритам с учётом размеров: крайняя красная линия — конец выносной линии
    // (x = −10 − 42 − 15 см), отстоящий от левой границы габаритов на (−67 − minX) см = 0,1 мм на см
    const b = pageBounds(page, SCALE)
    const leftmost = Math.min(...pts.map((p) => p.x))
    const expectedLeft = area.x + (area.w - (b.maxX - b.minX) / CM_PER_MM) / 2 + (-10 - OFF_CM - OVERSHOOT_CM - b.minX) / CM_PER_MM
    expect(Math.abs(leftmost - expectedLeft)).toBeLessThan(0.01)
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(area.x - 1e-3)
      expect(p.x).toBeLessThanOrEqual(area.x + area.w + 1e-3)
      expect(p.y).toBeGreaterThanOrEqual(area.y - 1e-3)
      expect(p.y).toBeLessThanOrEqual(area.y + area.h + 1e-3)
    }
  })
})

describe("effectiveMarks на странице", () => {
  it("DC-21: страница демонтажа хранит действующие пометки: размеры считаются только по ним", () => {
    const page = pageOf([W1], [M1])
    expect(page.demolition).toEqual(effectiveMarks([M1], [W1]))
  })
})
