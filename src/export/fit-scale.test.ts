import { describe, expect, it } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import type { Dimension, Wall } from "../types"
import { legendWidthMm } from "./legend"
import { fitScale, formatScale, scaleLabel, SCALE_SERIES } from "./fit-scale"
import { fitsFormat, pageBounds } from "./pdf"
import type { PageFormat, PlanPage } from "./pdf"
import { drawingArea } from "./sheet-layout"

// change auto-fit-scale: подбор масштаба печати (spec drawing-scale «Ряд масштабов», «Автоподбор масштаба»,
// «Единый масштаб документа», «Масштаб не вычисляется сверх ряда»; design D1, D7; test-plan T-01…T-12, T-15, T-44…T-48).
// Ожидания строятся не из самой fitScale, а из геометрии: чертёж, помещающийся при X и не помещающийся при
// предыдущем члене ряда, собирается по формуле ширины горизонтальной стены на бумаге (см. wallFor).

const FORMATS: PageFormat[] = ["A4", "A3", "A2", "A1", "A0"]
const SERIES: readonly number[] = [2, 2.5, 4, 5, 10, 15, 20, 25, 40, 50, 75, 100, 200, 400, 500, 800, 1000]
const THICKNESS_CM = 20

const at = <T>(list: readonly T[], i: number): T => {
  const v = list[i]
  if (v === undefined) throw new Error(`нет элемента ${i}`)
  return v
}
const must = (v: number | null): number => {
  if (v === null) throw new Error("масштаб не подобран")
  return v
}

const wall = (ax: number, ay: number, bx: number, by: number, id: string, type: Wall["type"] = "brick"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: THICKNESS_CM,
  type,
})

const page = (walls: Wall[], dimensions: Dimension[] = []): PlanPage => ({ walls, dimensions, doorways: [] })
const EMPTY: PlanPage = page([])

// Горизонтальная стена длиной L см на бумаге при масштабе X занимает по ширине 10·(L + 20)/X + 10 мм
// (10 мм — запас вокруг, по 5 мм с каждой стороны). Длина подбирается так, чтобы при X ширина была frac·область,
// а при предыдущем члене ряда X' — frac·X/X' > 1 область, то есть чертёж помещался при X и не помещался при X'.
function wallPage(x: number, format: PageFormat, id = "w"): PlanPage {
  const i = SERIES.indexOf(x)
  const prev = i > 0 ? at(SERIES, i - 1) : undefined
  const frac = prev === undefined ? 0.5 : (1 + prev / x) / 2
  const probe = page([wall(0, 0, 100, 0, id)])
  const avail = drawingArea(format, legendWidthMm([probe])).w - 10
  const lengthCm = (frac * avail * x) / 10 - THICKNESS_CM
  return page([wall(0, 0, lengthCm, 0, id)])
}

// Независимый эталон: габариты прямоугольника wCm × hCm (с учётом толщины) на бумаге при масштабе X равны
// 10·w/X + 10 по ширине и 10·h/X + 10 по высоте (10 мм — запас вокруг); подбирается первый член ряда, при котором
// обе стороны не больше области чертежа формата с легендой страниц.
function oracleBox(wCm: number, hCm: number, format: PageFormat, pages: PlanPage[]): number {
  const area = drawingArea(format, legendWidthMm(pages))
  for (const x of SERIES) if ((10 * wCm) / x + 10 <= area.w && (10 * hCm) / x + 10 <= area.h) return x
  return 1000
}

const stepUlp = (x: number, dir: 1 | -1): number => {
  const f = new Float64Array([x])
  const u = new BigUint64Array(f.buffer)
  u[0] = (u[0] ?? 0n) + BigInt(dir)
  return f[0] ?? NaN
}

// Длина стены, при которой габарит на бумаге при 1:10 в точности равен стороне области чертежа (mmPerCm = 1, поэтому
// сравнение идёт напрямую в сантиметрах): перебором соседних чисел с плавающей точкой около приближённого значения.
// Возвращает пару [ровно равная, ближайшая большая], у большей габарит строго больше области.
function boundaryLengths(side: "w" | "h"): [number, number] {
  const probe = [page([wall(0, 0, 100, 0, "w")])]
  const area = drawingArea("A4", legendWidthMm(probe))
  const target = side === "w" ? area.w : area.h
  const make = (len: number): PlanPage => page([side === "w" ? wall(0, 0, len, 0, "w") : wall(0, 0, 0, len, "w")])
  const size = (len: number): number => {
    const b = pageBounds(make(len), 10)
    return side === "w" ? b.maxX - b.minX : b.maxY - b.minY
  }
  let len = target - 30
  for (let i = 0; i < 200; i++) len = stepUlp(len, -1)
  let steps = 0
  while (size(len) < target && steps++ < 1000) len = stepUlp(len, 1)
  if (size(len) !== target) throw new Error("точное равенство габарита не воспроизведено")
  let over = len
  while (size(over) <= target) over = stepUlp(over, 1)
  return [len, over]
}

describe("ряд масштабов и запись", () => {
  it("T-01: ряд состоит ровно из 17 значений от крупного к мелкому", () => {
    expect([...SCALE_SERIES]).toEqual([...SERIES])
  })

  it("T-02: целый масштаб пишется без дробной части", () => {
    expect(formatScale(100)).toBe("1:100")
    expect(formatScale(2)).toBe("1:2")
    expect(formatScale(1000)).toBe("1:1000")
  })

  it("T-02: нецелый масштаб пишется с десятичной запятой", () => {
    expect(formatScale(2.5)).toBe("1:2,5")
  })

  it("T-02: каждый член ряда записывается как 1:X, запятая только у 2,5", () => {
    for (const x of SERIES) {
      const text = formatScale(x)
      expect(text).toBe(x === 2.5 ? "1:2,5" : `1:${x}`)
      expect(text.includes(".")).toBe(false)
    }
  })
})

describe("fitScale: максимально крупный масштаб ряда", () => {
  it.each(SERIES.map((x) => [x]))("T-46: чертёж, помещающийся при 1:%s и не помещающийся при более крупном, получает тот же масштаб (A4)", (x) => {
    expect(fitScale([wallPage(x, "A4")], "A4")).toBe(x)
  })

  it.each(FORMATS.map((f) => [f]))("T-46: тот же перебор ряда на формате %s", (format) => {
    for (const x of [2.5, 15, 75, 400]) expect(fitScale([wallPage(x, format)], format)).toBe(x)
  })

  it("T-03: при 1:50 помещается, при 1:40 нет — подобран 1:50", () => {
    expect(fitScale([wallPage(50, "A4")], "A4")).toBe(50)
  })

  it("T-04: помещается при 1:75, не помещается при 1:50 — подобран 1:75, а не 1:100", () => {
    expect(fitScale([wallPage(75, "A4")], "A4")).toBe(75)
  })

  it("T-44: совсем маленький чертёж получает самый крупный масштаб 1:2", () => {
    expect(fitScale([page([wall(0, 0, 10, 0, "w")])], "A4")).toBe(2)
  })

  it("T-45: нецелый член ряда выбирается, если помещается: 1:2,5, а не 1:4", () => {
    expect(fitScale([wallPage(2.5, "A4")], "A4")).toBe(2.5)
  })

  it("T-07: чертёж, не дотягивающий до границы области на 0,05 мм по ширине, помещается", () => {
    const probe = page([wall(0, 0, 100, 0, "w")])
    const area = drawingArea("A4", legendWidthMm([probe]))
    // при 1:10 ширина на бумаге = L + 20 + 10 мм
    const lengthCm = area.w - 30 - 0.05
    expect(fitScale([page([wall(0, 0, lengthCm, 0, "w")])], "A4")).toBe(10)
  })

  it("T-08: превышение границы по ширине на 0,05 мм — подобран следующий, более мелкий масштаб", () => {
    const probe = page([wall(0, 0, 100, 0, "w")])
    const area = drawingArea("A4", legendWidthMm([probe]))
    const lengthCm = area.w - 30 + 0.05
    expect(fitScale([page([wall(0, 0, lengthCm, 0, "w")])], "A4")).toBe(15)
  })

  it("T-09: превышение границы по высоте на 0,05 мм — подобран следующий, более мелкий масштаб", () => {
    const probe = page([wall(0, 0, 100, 0, "w")])
    const area = drawingArea("A4", legendWidthMm([probe]))
    // вертикальная стена: высота на бумаге при 1:10 = L + 20 + 10 мм против 145 мм области
    const fits = page([wall(0, 0, 0, area.h - 30 - 0.05, "w")])
    const over = page([wall(0, 0, 0, area.h - 30 + 0.05, "w")])
    expect(fitScale([fits], "A4")).toBe(10)
    expect(fitScale([over], "A4")).toBe(15)
  })

  it("T-07: габарит ровно равен ширине области — масштаб подходит (границы включаются); на следующем числе — нет", () => {
    const [exact, over] = boundaryLengths("w")
    expect(fitScale([page([wall(0, 0, exact, 0, "w")])], "A4")).toBe(10)
    expect(fitScale([page([wall(0, 0, over, 0, "w")])], "A4")).toBe(15)
  })

  it("T-09: габарит ровно равен высоте области — масштаб подходит (границы включаются); на следующем числе — нет", () => {
    const [exact, over] = boundaryLengths("h")
    expect(fitScale([page([wall(0, 0, 0, exact, "w")])], "A4")).toBe(10)
    expect(fitScale([page([wall(0, 0, 0, over, "w")])], "A4")).toBe(15)
  })
})

describe("fitScale: формат, правка и состав страниц", () => {
  it("T-05: чертёж, получивший на A4 масштаб 1:100, на A3 получает более крупный масштаб, и он помещается", () => {
    const pages = [wallPage(100, "A4")]
    expect(fitScale(pages, "A4")).toBe(100)
    const a3 = must(fitScale(pages, "A3"))
    const lengthCm = Math.abs((at(at(pages, 0).walls, 0).b.x))
    expect(a3).toBe(oracleBox(lengthCm + THICKNESS_CM, THICKNESS_CM, "A3", pages))
    expect(a3).toBeLessThan(100)
    const area = drawingArea("A3", legendWidthMm(pages))
    const b = pageBounds(at(pages, 0), a3)
    expect((b.maxX - b.minX) * (10 / a3)).toBeLessThanOrEqual(area.w)
  })

  it("T-05: масштаб не мельчает при росте формата (A4 → A0) для одного и того же чертежа", () => {
    const pages = [wallPage(200, "A4")]
    const scales = FORMATS.map((f) => fitScale(pages, f) ?? Infinity)
    for (let i = 1; i < scales.length; i++) expect(at(scales, i)).toBeLessThanOrEqual(at(scales, i - 1))
    expect(at(scales, 0)).toBeGreaterThan(at(scales, 4))
  })

  it("T-06: новая стена, из-за которой габариты перестали помещаться, меняет масштаб на более мелкий", () => {
    const before = [wallPage(50, "A4")]
    expect(fitScale(before, "A4")).toBe(50)
    const w0 = at(at(before, 0).walls, 0)
    const after = [page([w0, wall(w0.b.x, 0, w0.b.x, 2000, "w2")])]
    expect(fitScale(after, "A4")).toBe(oracleBox(w0.b.x + THICKNESS_CM, 2000 + THICKNESS_CM, "A4", after))
    expect(must(fitScale(after, "A4"))).toBeGreaterThan(50)
  })

  it("T-19: размер, вынесенный за габарит стен, делает масштаб мельче; удаление размера возвращает его", () => {
    const w = wall(0, 0, 500, 0, "w")
    const dim: Dimension = {
      from: { a: { wallId: "w", edge: 2 }, b: { wallId: "w", edge: 1 } },
      to: { a: { wallId: "w", edge: 3 }, b: { wallId: "w", edge: 1 } },
      offset: 5000,
    }
    const without = must(fitScale([page([w])], "A4"))
    const withDim = must(fitScale([page([w], [dim])], "A4"))
    expect(withDim).toBeGreaterThan(without)
    expect(fitScale([page([w], [])], "A4")).toBe(without)
  })

  it("T-11: масштаб определяет самая крупная страница, остальные не влияют", () => {
    const small = wallPage(50, "A4", "s")
    const big = wallPage(100, "A4", "b")
    expect(fitScale([small, big], "A4")).toBe(100)
    expect(fitScale([big, small], "A4")).toBe(100)
    expect(fitScale([small, big, small], "A4")).toBe(100)
  })

  it("T-11: три страницы — выбирается самая мелкая из подходящих (самая тяжёлая страница)", () => {
    const pages = [wallPage(25, "A4", "a"), wallPage(400, "A4", "b"), wallPage(50, "A4", "c")]
    expect(fitScale(pages, "A4")).toBe(400)
  })

  it("T-12: пустые страницы масштаб не ограничивают", () => {
    const big = wallPage(100, "A4")
    expect(fitScale([EMPTY, big, EMPTY], "A4")).toBe(100)
    expect(fitScale([big, EMPTY], "A4")).toBe(fitScale([big], "A4"))
  })

  it("T-47: стены только на одной из страниц — масштаб определяет она одна", () => {
    const only = wallPage(75, "A4")
    expect(fitScale([EMPTY, EMPTY, only], "A4")).toBe(75)
    expect(fitScale([only, EMPTY, EMPTY], "A4")).toBe(75)
  })

  it("T-12: ни на одной странице нет стен — подбирать нечем, результат null", () => {
    expect(fitScale([EMPTY, EMPTY, EMPTY], "A4")).toBeNull()
    expect(fitScale([], "A4")).toBeNull()
  })
})

describe("fitScale: чертёж, не помещающийся даже при 1:1000", () => {
  it.each(FORMATS.map((f) => [f]))("T-15: огромная стена на %s — масштаб 1:1000", (format) => {
    expect(fitScale([page([wall(0, 0, 4_000_000, 0, "w")])], format)).toBe(1000)
  })

  it("T-15: чертёж, помещающийся ровно при 1:1000, тоже получает 1:1000", () => {
    expect(fitScale([wallPage(1000, "A4")], "A4")).toBe(1000)
  })
})

describe("fitScale: инварианты", () => {
  // детерминированный набор случайных чертежей без внешнего источника случайности
  function lcg(seed: number): () => number {
    let s = seed
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296
      return s / 4294967296
    }
  }

  const rnd = lcg(20261011)
  const drawings: PlanPage[][] = Array.from({ length: 40 }, (_, n) => {
    const pages: PlanPage[] = []
    for (let p = 0; p < 1 + (n % 3); p++) {
      const walls: Wall[] = []
      const count = 1 + Math.floor(rnd() * 4)
      for (let i = 0; i < count; i++) {
        const span = 10 ** (1 + rnd() * 4.2)
        const ax = (rnd() - 0.5) * span
        const ay = (rnd() - 0.5) * span
        walls.push(wall(ax, ay, ax + (rnd() - 0.5) * span, ay + (rnd() - 0.5) * span, `w${p}-${i}`))
      }
      pages.push(page(walls.filter((w) => w.a.x !== w.b.x || w.a.y !== w.b.y)))
    }
    return pages
  })

  const fits = (pages: PlanPage[], x: number, format: PageFormat): boolean => {
    const legend = legendWidthMm(pages)
    return pages.filter((p) => p.walls.length > 0).every((p) => fitsFormat(pageBounds(p, x), x, format, legend))
  }

  it("T-48: результат всегда член ряда или null", () => {
    for (const pages of drawings)
      for (const f of FORMATS) {
        const r = fitScale(pages, f)
        if (r !== null) expect(SERIES).toContain(r)
      }
  })

  it("T-46: результат помещает все страницы, а более крупный член ряда — нет (кроме краёв ряда)", () => {
    for (const pages of drawings)
      for (const f of FORMATS) {
        const r = fitScale(pages, f)
        if (r === null) continue
        if (r !== 1000) expect(fits(pages, r, f), `помещается при ${r} на ${f}`).toBe(true)
        const i = SERIES.indexOf(r)
        if (i > 0) expect(fits(pages, at(SERIES, i - 1), f), `не должно помещаться при ${at(SERIES, i - 1)} на ${f}`).toBe(false)
      }
  })

  it("T-05: подобранный масштаб не мельчает при росте формата", () => {
    for (const pages of drawings) {
      const scales = FORMATS.map((f) => fitScale(pages, f) ?? Infinity)
      for (let i = 1; i < scales.length; i++) expect(at(scales, i)).toBeLessThanOrEqual(at(scales, i - 1))
    }
  })

  it("T-13: результат не зависит от порядка страниц", () => {
    for (const pages of drawings) expect(fitScale([...pages].reverse(), "A4")).toBe(fitScale(pages, "A4"))
  })

  it("T-10: запас вокруг чертежа постоянен — 10 мм на бумаге при любом масштабе ряда", () => {
    const p = wallPage(100, "A4")
    const lengthCm = at(p.walls, 0).b.x
    for (const x of SERIES) {
      const b = pageBounds(p, x)
      expect((b.maxX - b.minX) * (10 / x) - ((lengthCm + THICKNESS_CM) * 10) / x, `масштаб ${x}`).toBeCloseTo(10, 6)
    }
  })
})

describe("fitScale: область чертежа альбомной страницы", () => {
  it("T-24: высокий чертёж проверяется по альбомной области: вертикальная стена 170 см на A4 не получает 1:10, на A3 получает", () => {
    // при 1:10 высота на бумаге 170 + 20 + 10 = 200 мм: больше 145 мм области A4, меньше 232 мм области A3
    const tall = [page([wall(0, 0, 0, 170, "w")])]
    expect(fitScale(tall, "A4")).toBe(oracleBox(THICKNESS_CM, 170 + THICKNESS_CM, "A4", tall))
    expect(fitScale(tall, "A3")).toBe(oracleBox(THICKNESS_CM, 170 + THICKNESS_CM, "A3", tall))
    expect(must(fitScale(tall, "A4"))).toBeGreaterThan(10)
    expect(must(fitScale(tall, "A3"))).toBeLessThanOrEqual(10)
  })

  it("T-25: столбец легенды сужает область: чертёж шириной 272 мм при 1:10 на A4 с легендой получает более мелкий масштаб", () => {
    // 272 мм = ширина области A4 без легенды; стены есть, легенда занимает часть ширины
    const wide = [page([wall(0, 0, 242, 0, "w")])]
    expect(legendWidthMm(wide)).toBeGreaterThan(0)
    expect(fitScale(wide, "A4")).toBe(oracleBox(242 + THICKNESS_CM, THICKNESS_CM, "A4", wide))
    expect(must(fitScale(wide, "A4"))).toBeGreaterThan(10)
  })
})
describe("fitScale: столбец легенды общий для документа", () => {
  // горизонтальная кирпичная стена, занимающая 99,9 % ширины области чертежа при масштабе x (с легендой этой страницы)
  function tightBrick(x: number, id: string): PlanPage {
    const probe = page([wall(0, 0, 100, 0, id)])
    const avail = drawingArea("A4", legendWidthMm([probe])).w - 10
    return page([wall(0, 0, (0.999 * avail * x) / 10 - THICKNESS_CM, 0, id)])
  }

  it("T-12: легенда считается по всем страницам: страница с более длинной подписью материала сужает область для остальных", () => {
    const first = tightBrick(100, "a")
    // самая длинная подпись легенды — «Демонтируемая стена» (страница со сносом), она длиннее подписей всех материалов
    const secondWall = wall(0, 0, 50, 0, "b")
    const second: PlanPage = { ...page([secondWall]), demolition: effectiveMarks([{ id: "m", wallId: "b", anchor: "a", fromCm: 0, toCm: 10 }], [secondWall]) }
    expect(second.demolition?.length).toBe(1)
    expect(legendWidthMm([second])).toBeGreaterThan(legendWidthMm([first]))
    expect(fitScale([first], "A4")).toBe(100)
    expect(fitScale([first, second], "A4")).toBe(200)
    expect(fitScale([second, first], "A4")).toBe(200)
  })
})

describe("scaleLabel: текст подписи масштаба", () => {
  it("T-31: подпись — масштаб, подобранный для страниц и формата, в виде «1:X»", () => {
    expect(scaleLabel([wallPage(50, "A4")], "A4")).toBe("1:50")
    expect(scaleLabel([wallPage(100, "A4")], "A4")).toBe("1:100")
  })

  it("T-31: нецелый масштаб в подписи — с запятой", () => {
    expect(scaleLabel([wallPage(2.5, "A4")], "A4")).toBe("1:2,5")
  })

  it("T-32: подпись следует за форматом: для A4 и A3 один и тот же чертёж даёт разные подписи", () => {
    const pages = [wallPage(100, "A4")]
    const lengthCm = at(at(pages, 0).walls, 0).b.x
    expect(scaleLabel(pages, "A4")).toBe("1:100")
    expect(scaleLabel(pages, "A3")).toBe(formatScale(oracleBox(lengthCm + THICKNESS_CM, THICKNESS_CM, "A3", pages)))
    expect(scaleLabel(pages, "A3")).not.toBe(scaleLabel(pages, "A4"))
  })

  it("T-33: нет страниц со стенами — подпись пуста", () => {
    expect(scaleLabel([], "A4")).toBe("")
    expect(scaleLabel([EMPTY, EMPTY, EMPTY], "A4")).toBe("")
  })

  it("T-15: чертёж, не помещающийся даже при 1:1000, — подпись «1:1000»", () => {
    expect(scaleLabel([page([wall(0, 0, 4_000_000, 0, "w")])], "A4")).toBe("1:1000")
  })

  it("T-31: подпись всегда согласована с fitScale (тот же масштаб, что уйдёт в экспорт)", () => {
    for (const x of SERIES) {
      for (const format of FORMATS) {
        const pages = [wallPage(x, format)]
        const r = fitScale(pages, format)
        expect(scaleLabel(pages, format)).toBe(r === null ? "" : formatScale(r))
      }
    }
  })
})