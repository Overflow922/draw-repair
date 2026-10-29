import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { Op } from "../doorway/doorway.test-utils"
import { colorRecorder } from "../doorway/window.test-utils"
import type { ColoredText } from "../doorway/window.test-utils"
import type { RenderOptions } from "../render"
import type { Callout } from "../types"
import { A, B, callout, make } from "./callout.test-utils"

// change add-callout: выноски в PDF — состав страниц, границы содержимого, передача в отрисовку без служебных элементов, шрифт
// (spec pdf-export «Выноски в PDF»; design D10; test-plan C-PDF-*).
// drawScene и drawDemolitionScene подменяются обёртками: запоминают аргументы и вызывают оригинал (как battery-pdf.test.ts).

interface DrawCall {
  opts: RenderOptions | undefined
  ops: Op[]
  texts: ColoredText[]
}
interface DemolitionCall {
  callouts: readonly Callout[] | undefined
  selected: string | null | undefined
  erasing: string | null | undefined
}

const calls = vi.hoisted((): DrawCall[] => [])
const demolitionCalls = vi.hoisted((): DemolitionCall[] => [])

vi.mock("../render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../render")>()
  return {
    ...mod,
    drawScene: (...args: Parameters<typeof mod.drawScene>): void => {
      const { ctx, ops, texts } = colorRecorder()
      const [, w, h, walls, preview, unit, view, selected, opts] = args
      mod.drawScene(ctx, w, h, walls, preview, unit, view, selected, opts)
      calls.push({ opts, ops, texts })
      mod.drawScene(...args)
    },
  }
})

vi.mock("../demolition/demolition-render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../demolition/demolition-render")>()
  return {
    ...mod,
    drawDemolitionScene: (...args: Parameters<typeof mod.drawDemolitionScene>): void => {
      const scene = args[3]
      demolitionCalls.push({ callouts: scene.callouts, selected: scene.selectedCalloutId, erasing: scene.erasingCalloutId })
      mod.drawDemolitionScene(...args)
    },
  }
})

const { buildPdfPages, pageBounds, pagesOf } = await import("../export/pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SCALE = 100

const M = callout("m", { x: 100, y: 100 }, { x: 200, y: 100 }, "Монтаж")
const D = callout("d", { x: 100, y: 120 }, { x: 200, y: 120 }, "Демонтаж")
const MEASURE = callout("o", { x: 100, y: 140 }, { x: 200, y: 140 }, "Обмер")
const all = () => make({ callouts: [MEASURE], demolitionCallouts: [D], mounting: { walls: [], dimensions: [], callouts: [M] } })

describe("страницы планов", () => {
  it("C-PDF-1: каждая страница содержит выноски только своего плана", () => {
    const [measure, demolition, mounting] = pagesOf(all())
    expect(measure.callouts).toEqual([MEASURE])
    expect(demolition.callouts).toEqual([D])
    expect(mounting.callouts).toEqual([M])
  })

  it("C-PDF-2: без выносок поля страниц пусты", () => {
    for (const page of pagesOf(make())) expect(page.callouts ?? []).toEqual([])
  })

  it("C-PDF-2b: выноски одного плана не попадают на страницы других", () => {
    const [measure, demolition, mounting] = pagesOf(make({ callouts: [A()] }))
    expect(measure.callouts).toEqual([A()])
    expect(demolition.callouts ?? []).toEqual([])
    expect(mounting.callouts ?? []).toEqual([])
    const [m2, d2, g2] = pagesOf(make({ mounting: { walls: [], dimensions: [], callouts: [B()] } }))
    expect(m2.callouts ?? []).toEqual([])
    expect(d2.callouts ?? []).toEqual([])
    expect(g2.callouts).toEqual([B()])
  })
})

describe("отрисовка страниц", () => {
  const build = (drawing = all()) => {
    calls.length = 0
    demolitionCalls.length = 0
    buildPdfPages(pagesOf(drawing), "cm", SCALE, "A4", font, "t", new Date(2026, 0, 1))
    return { draws: calls.filter((c) => !c.opts?.underlay), demolition: [...demolitionCalls] }
  }

  it("C-PDF-3: в отрисовку каждой страницы передаются выноски именно её плана", () => {
    const { draws, demolition } = build()
    const ids = draws.flatMap((c) => (c.opts?.callouts ?? []).map((x) => x.id)).sort()
    expect(ids).toEqual(["m", "o"])
    expect(demolition).toHaveLength(1)
    expect((demolition[0].callouts ?? []).map((x) => x.id)).toEqual(["d"])
  })

  it("C-PDF-6: выделение и подсветка ластика выносок в отрисовку страниц не передаются", () => {
    const { draws, demolition } = build()
    expect(draws.length).toBeGreaterThan(0)
    for (const c of draws) {
      expect(c.opts?.selectedCallout ?? null).toBeNull()
      expect(c.opts?.erasingCallout ?? null).toBeNull()
    }
    for (const d of demolition) {
      expect(d.selected ?? null).toBeNull()
      expect(d.erasing ?? null).toBeNull()
    }
  })

  it("C-PDF-4: текст выноски выведен шрифтом PDF того размера, что числа размеров страницы", () => {
    const { draws } = build(make({ callouts: [A()] }))
    const own = draws.flatMap((c) => c.ops).filter((o): o is Extract<Op, { kind: "text" }> => o.kind === "text" && ["Монтаж радиатора", "в нишу"].includes(o.text))
    expect(own.map((o) => o.text)).toEqual(["Монтаж радиатора", "в нишу"])
    for (const o of own) expect(o.font).toBe("3.5px PTSans")
  })

  it("C-PDF-5: кириллический текст выведен целиком и в порядке строк, сборка PDF проходит", () => {
    const text = "Монтаж радиатора\nв нишу\n\nЁжик Щ"
    const { draws } = build(make({ callouts: [callout("k", { x: 300, y: 100 }, { x: 100, y: 100 }, text)] }))
    const printed = draws.flatMap((c) => c.ops).filter((o): o is Extract<Op, { kind: "text" }> => o.kind === "text" && text.split("\n").includes(o.text) && o.text !== "")
    expect(printed.map((o) => o.text)).toEqual(["Монтаж радиатора", "в нишу", "Ёжик Щ"])
  })

  it("C-PDF-3c: несколько выносок плана доходят до отрисовки все и в порядке списка, на каждой странице своего плана", () => {
    const own = (prefix: string): Callout[] => [1, 2, 3].map((i) => callout(`${prefix}${i}`, { x: 100, y: 100 * i }, { x: 200, y: 100 * i }, `${prefix} ${i}`))
    const { draws, demolition } = build(make({ callouts: own("o"), demolitionCallouts: own("d"), mounting: { walls: [], dimensions: [], callouts: own("m") } }))
    const ids = draws.map((c) => (c.opts?.callouts ?? []).map((x) => x.id)).filter((l) => l.length > 0)
    expect(ids).toEqual([["o1", "o2", "o3"], ["m1", "m2", "m3"]])
    expect(demolition).toHaveLength(1)
    expect((demolition[0].callouts ?? []).map((x) => x.id)).toEqual(["d1", "d2", "d3"])
  })

  // TCR (change add-rough-works-plan): страниц четыре — добавлена страница плана «Черновые работы» (pdf-export «Одна страница PDF на каждый план»)
  // TCR (change reconstruction-plan): страниц пять — добавлена страница плана «Реконструкция»
  it("C-PDF-3b: PDF содержит шесть страниц и собирается с выносками на всех планах", () => {
    calls.length = 0
    const doc = buildPdfPages(pagesOf(all()), "cm", SCALE, "A4", font, "t", new Date(2026, 0, 1))
    expect(doc.getNumberOfPages()).toBe(11) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» // TCR (change add-electrical-plan): одиннадцать — страница плана «Электрооборудование»
  })
})

describe("границы содержимого страницы", () => {
  const bounds = (drawing = make()) => pageBounds(pagesOf(drawing)[0], SCALE)
  const without = bounds()

  it("C-PDF-7: выноска, выступающая за контуры стен, расширяет границы вместе с текстом: левее, выше и ниже точки текста", () => {
    // текст правее стрелки не бывает: стрелка правее — текст выровнен вправо и уходит влево от точки текста
    const far = callout("f", { x: -100, y: -150 }, { x: -200, y: -150 }, "Монтаж радиатора\nв нишу")
    const b = bounds(make({ callouts: [far] }))
    expect(b.minX).toBeLessThanOrEqual(-200 - 100) // текст не короче 10 мм = 100 см при 1:100
    expect(b.minY).toBeLessThanOrEqual(-150 - 30) // первая строка — 3,5 мм = 35 см над нижней кромкой
    expect(b.minY).toBeLessThan(without.minY)
    expect(b.maxY).toBeGreaterThanOrEqual(-150 + 30) // вторая строка ниже
  })

  it("C-PDF-7b: выноска, у которой точка стрелки за правым краем чертежа, расширяет границы до стрелки", () => {
    const wide = callout("w", { x: 1500, y: 0 }, { x: 100, y: 0 }, "Тест")
    const b = bounds(make({ callouts: [wide] }))
    expect(b.maxX).toBeGreaterThanOrEqual(1500)
    expect(b.maxX).toBeGreaterThan(without.maxX)
  })

  it("C-PDF-7c: выноска ниже и левее — границы растут вниз и влево", () => {
    const low = callout("l", { x: -50, y: 800 }, { x: 100, y: 800 }, "Тест")
    const b = bounds(make({ callouts: [low] }))
    expect(b.maxY).toBeGreaterThanOrEqual(800)
    expect(b.minX).toBeLessThanOrEqual(-50)
  })

  it("C-PDF-7e: текст уходит вправо и вниз за все точки и стены (выравнивание влево) — границы охватывают правый и нижний край текста", () => {
    const c = callout("r", { x: 100, y: 800 }, { x: 900, y: 800 }, "Монтаж радиатора\nв нишу")
    const b = bounds(make({ callouts: [c] }))
    expect(b.maxX).toBeGreaterThanOrEqual(900 + 100) // строка не короче 10 мм = 100 см при 1:100
    expect(b.maxY).toBeGreaterThanOrEqual(800 + 30) // вторая строка ниже точки текста
    expect(b.minX).toBeLessThanOrEqual(100)
  })

  it("C-PDF-7f: нижний край текста решающий: вторая строка поднимает нижнюю границу ровно на интервал строк (35…70 см при 1:100)", () => {
    const one = bounds(make({ callouts: [callout("r", { x: 100, y: 800 }, { x: 900, y: 800 }, "Монтаж")] }))
    const two = bounds(make({ callouts: [callout("r", { x: 100, y: 800 }, { x: 900, y: 800 }, "Монтаж\nв нишу")] }))
    const delta = two.maxY - one.maxY
    expect(delta).toBeGreaterThanOrEqual(35 - 1e-6) // не меньше высоты шрифта 3,5 мм
    expect(delta).toBeLessThanOrEqual(70 + 1e-6) // не больше двух высот
    const three = bounds(make({ callouts: [callout("r", { x: 100, y: 800 }, { x: 900, y: 800 }, "Монтаж\nв нишу\nещё")] }))
    expect(three.maxY - two.maxY).toBeCloseTo(delta, 6)
  })

  it("C-PDF-7g: ширина текста в границах — по метрикам шрифта PDF: строка из 16 букв шире 168 см и не шире 504 см (1:100) за точкой текста", () => {
    const c = callout("r", { x: 100, y: 800 }, { x: 900, y: 800 }, "Монтаж радиатора")
    const b = bounds(make({ callouts: [c] }))
    const extent = b.maxX - 900 // ширина текста плюс поле страницы
    expect(extent).toBeGreaterThanOrEqual(168)
    expect(extent).toBeLessThanOrEqual(504 + 100)
    const doubled = bounds(make({ callouts: [callout("r", { x: 100, y: 800 }, { x: 900, y: 800 }, "Монтаж радиатора Монтаж радиатора")] }))
    expect(doubled.maxX - b.maxX).toBeGreaterThanOrEqual(168)
  })

  it("C-PDF-7h: выноска внутри габарита стен границы страницы не меняет (не расширяет сверх содержимого)", () => {
    const rect = (id: string, ax: number, ay: number, bx: number, by: number) => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm: 20, type: "brick" as const })
    const walls = [rect("W", 0, 0, 4000, 0), rect("R", 4000, 0, 4000, 3000), rect("B", 4000, 3000, 0, 3000), rect("L", 0, 3000, 0, 0)]
    const base = pageBounds(pagesOf(make({ walls }))[0], SCALE)
    const inside = callout("i", { x: 3300, y: 2200 }, { x: 3000, y: 2200 }, "Монтаж радиатора\nв нишу")
    expect(pageBounds(pagesOf(make({ walls, callouts: [inside] }))[0], SCALE)).toEqual(base)
  })

  it("C-PDF-7i: несколько выносок на странице — границы охватывают каждую", () => {
    const left = callout("l", { x: -100, y: 0 }, { x: -600, y: 0 }, "Левая")
    const right = callout("r", { x: 2500, y: 0 }, { x: 1500, y: 0 }, "Правая")
    const b = bounds(make({ callouts: [left, right] }))
    expect(b.minX).toBeLessThanOrEqual(-600 - 50)
    expect(b.maxX).toBeGreaterThanOrEqual(2500)
  })

  it("C-PDF-7d: выноска другого плана границы страницы не меняет", () => {
    const far = callout("f", { x: 1500, y: 900 }, { x: 100, y: 900 }, "Тест")
    const other = make({ demolitionCallouts: [far], mounting: { walls: [], dimensions: [], callouts: [far] } })
    const b = pageBounds(pagesOf(other)[0], SCALE)
    expect(b).toEqual(without)
  })

  it("C-PDF-8: у плана без стен только с выноской границы конечны и содержат обе точки; PDF собирается", () => {
    const only = make({ walls: [], callouts: [A()] })
    const b = pageBounds(pagesOf(only)[0], SCALE)
    for (const v of [b.minX, b.minY, b.maxX, b.maxY]) expect(Number.isFinite(v)).toBe(true)
    expect(b.maxX).toBeGreaterThanOrEqual(300)
    expect(b.minX).toBeLessThanOrEqual(100)
    const doc = buildPdfPages(pagesOf(only), "cm", SCALE, "A4", font, "t", new Date(2026, 0, 1))
    // TCR (change add-rough-works-plan): страниц четыре; TCR (change reconstruction-plan): пять
    expect(doc.getNumberOfPages()).toBe(11) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» // TCR (change add-electrical-plan): одиннадцать — страница плана «Электрооборудование»
  })
})
