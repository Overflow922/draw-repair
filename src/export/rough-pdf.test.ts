import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, plaster, rectWalls, screed, wall } from "../rough/rough.test-utils"
import type { RoughParts } from "../rough/rough.test-utils"
import type { Battery, Communication, Drawing } from "../types"
import { legendEntries, legendWidthMm } from "./legend"
import type { PageFormat } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import { parseColoredStrokes } from "./pdf-colors.test-utils"

// change add-rough-works-plan: четвёртая страница PDF — план «Черновые работы» и записи легенды
// (spec pdf-export «Страница плана «Черновые работы»», «Легенда на странице PDF»; room-explication «Таблица экспликации в PDF»)

interface TextCall {
  page: number
  text: string
}

const texts = vi.hoisted((): TextCall[] => [])

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>()
  class RecordingPdf extends mod.jsPDF {
    constructor(options?: jsPDFOptions) {
      super(options)
      const original: unknown = Reflect.get(this, "text")
      if (typeof original !== "function") throw new Error("jsPDF.text недоступен")
      Object.defineProperty(this, "text", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): unknown => {
          const [text] = args
          const lines = typeof text === "string" ? [text] : Array.isArray(text) ? text.filter((t): t is string => typeof t === "string") : []
          for (const line of lines) texts.push({ page: this.getCurrentPageInfo().pageNumber, text: line })
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pagesOf, pageBounds } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 50, format: PageFormat = "A3"): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", scale, format, font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

// комната 4×5 м: внутренняя область [10,410]×[10,510]; грань +1 всех стен смотрит внутрь
const ROOM = (): ReturnType<typeof rectWalls> => rectWalls("k", 0, 0, 420, 520)
const ALL_FACES = [plaster("a", "k1", 1, "a", 0, 420, 30), plaster("b", "k2", 1, "a", 0, 520, 30), plaster("c", "k3", 1, "a", 0, 420, 30), plaster("d", "k4", 1, "a", 0, 520, 30)]
const rough = (parts: RoughParts = {}): Drawing => drawing({ walls: ROOM(), ...parts })

// фиолетовая заливка штукатурки светлой схемы #a44ea8
const PURPLE: readonly [number, number, number] = [0xa4 / 255, 0x4e / 255, 0xa8 / 255]
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
const purpleFills = (doc: jsPDF, page: number) => parsePaint(doc, page).filter((op) => op.kind === "fill" && near(op.color, PURPLE))

describe("pagesOf: страница «Черновые работы»", () => {
  // TCR (change reconstruction-plan): после «Черновых работ» в каталоге пятый план, страниц пять
  it("RW-110: страниц пять; четвёртая — «Черновые работы» с подложкой «Монтажа», без размеров и пометок сноса", () => {
    const pages = pagesOf(rough({ roughPlaster: ALL_FACES }))
    expect(pages).toHaveLength(8) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение»
    const fourth = pages[3]
    expect(fourth?.title).toBe("Черновые работы")
    expect(fourth?.walls.map((w) => w.id)).toEqual(["k1~0", "k2~0", "k3~0", "k4~0"])
    expect(fourth?.dimensions).toEqual([])
    expect(fourth?.demolition).toBeUndefined()
    expect(fourth?.rough?.pieces).toHaveLength(4)
  })

  it("RW-110: подложка — результат «Монтажа»: остатки и собственные стены", () => {
    const own = wall("own", 0, 700, 300, 700)
    const d = drawing({ walls: [wall("W", 0, 0, 500, 0)], demolition: [{ id: "m", wallId: "W", anchor: "a", fromCm: 100, toCm: 190 }], mounting: { walls: [own], dimensions: [] } })
    expect(pagesOf(d)[3]?.walls.map((w) => w.id)).toEqual(["W~0", "W~1900", "own"])
  })

  it("RW-111: у остальных страниц слоя «Черновых работ» нет", () => {
    const pages = pagesOf(rough({ roughPlaster: ALL_FACES, roughScreeds: [screed("s", 200, 260, 65)] }))
    for (const p of pages.slice(0, 3)) expect(p.rough).toBeUndefined()
  })

  it("RW-112: помещения страницы — с площадью после штукатурки, помещения «Монтажа» — прежние", () => {
    const pages = pagesOf(rough({ roughPlaster: ALL_FACES }))
    expect(Math.round(pages[2]?.rooms?.[0]?.room.areaCm2 ?? 0)).toBe(200000)
    expect(Math.round(pages[3]?.rooms?.[0]?.room.areaCm2 ?? 0)).toBe(194636)
  })

  it("RW-113: недействующая стяжка (опорная точка вне помещений) в слое страницы не попадает", () => {
    const pages = pagesOf(rough({ roughScreeds: [screed("s", 9999, 9999, 65)] }))
    expect(pages[3]?.rough?.screeds).toEqual([])
  })

  it("RW-114: габариты страницы учитывают полосу штукатурки, выступающую за стены: наружная грань 100 мм — на 10 см дальше", () => {
    const bare = pagesOf(rough())[3]
    const withOuter = pagesOf(rough({ roughPlaster: [plaster("o", "k1", -1, "a", 0, 420, 100)] }))[3]
    if (!bare || !withOuter) throw new Error("нет страниц")
    expect(pageBounds(withOuter, 50).minY).toBeLessThan(pageBounds(bare, 50).minY)
  })
})

describe("страница «Черновые работы» в документе PDF", () => {
  // TCR (change reconstruction-plan): страниц пять; на пятой штукатурка серая, фиолетового нет и там
  it("RW-120: PDF содержит пять страниц; штукатурка фиолетовая только на четвёртой", () => {
    const doc = build(rough({ roughPlaster: ALL_FACES }))
    expect(doc.getNumberOfPages()).toBe(8) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение»
    expect(purpleFills(doc, 4).length).toBeGreaterThan(0)
    for (const n of [1, 2, 3, 5]) expect(purpleFills(doc, n), `страница ${n}`).toEqual([])
  })

  it("RW-121: толщина штукатурки 20 мм при 1:50 — полоса шириной 0,4 мм на листе", () => {
    const doc = build(rough({ roughPlaster: [plaster("p", "k1", 1, "a", 100, 300, 20)] }), 50)
    const strips = purpleFills(doc, 4).flatMap((op) => (op.kind === "fill" && op.box ? [op.box] : []))
    // полоса длиной 200 см = 40 мм и толщиной 0,4 мм (образец легенды — другой размер)
    expect(strips.some((b) => Math.abs(b.w - 40) < 0.05 && Math.abs(b.h - 0.4) < 0.02)).toBe(true)
  })

  it("RW-122: стяжка в PDF — подпись «h = 65мм» на четвёртой странице; на остальных её нет", () => {
    const doc = build(rough({ roughScreeds: [screed("s", 200, 260, 65)] }))
    expect(textsOn(4)).toContain("h = 65мм")
    for (const n of [1, 2, 3, 5]) expect(textsOn(n).includes("h = 65мм"), `страница ${n}`).toBe(false)
    expect(doc.getNumberOfPages()).toBe(8) // TCR (change reconstruction-plan) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение»
  })

  it("RW-123: стяжка штрихует помещение: на четвёртой странице больше диагональных штрихов, чем без стяжки", () => {
    const diagonals = (d: Drawing): number =>
      parseColoredStrokes(build(d), 4).flatMap((s) => s.subpaths).filter((sp) => sp.length === 2 && Math.abs(Math.abs(sp[0]!.x - sp[1]!.x) - Math.abs(sp[0]!.y - sp[1]!.y)) < 0.01 && Math.abs(sp[0]!.x - sp[1]!.x) > 0.5).length
    expect(diagonals(rough({ roughScreeds: [screed("s", 200, 260, 65)] }))).toBeGreaterThan(diagonals(rough()))
  })

  it("RW-123b: порог проёма между помещениями со стяжкой 50 и 65 мм заштрихован и на странице PDF: диагональных штрихов больше, чем без проёма", () => {
    const diagonals = (d: Drawing): number =>
      parseColoredStrokes(build(d), 4).flatMap((s) => s.subpaths).filter((sp) => sp.length === 2 && Math.abs(Math.abs(sp[0]!.x - sp[1]!.x) - Math.abs(sp[0]!.y - sp[1]!.y)) < 0.01 && Math.abs(sp[0]!.x - sp[1]!.x) > 0.5).length
    const partitioned = (doorways: Drawing["doorways"]): Drawing =>
      drawing({ walls: [...ROOM(), wall("p", 210, 0, 210, 520)], roughScreeds: [screed("l", 100, 260, 50), screed("r", 300, 260, 65)], ...(doorways ? { doorways } : null) })
    const opening = { id: "o", wallId: "p", anchor: "a" as const, offsetCm: 200, widthCm: 90, heightCm: 210 }
    expect(diagonals(partitioned([opening]))).toBeGreaterThan(diagonals(partitioned(undefined)))
  })

  it("RW-124: таблица экспликации на страницах «Монтаж» и «Черновые работы» — площади до и после штукатурки", () => {
    build(rough({ roughPlaster: ALL_FACES }))
    expect(textsOn(3)).toContain("Экспликация помещений")
    expect(textsOn(4)).toContain("Экспликация помещений")
    expect(textsOn(3)).toContain("20,0")
    expect(textsOn(4)).toContain("19,5")
    for (const n of [1, 2]) expect(textsOn(n).includes("Экспликация помещений"), `страница ${n}`).toBe(false)
  })

  it("RW-125: блоки помещений на четвёртой странице: номер и «H=3000», как на «Монтаже»", () => {
    build(rough())
    expect(textsOn(3)).toContain("H=3000")
    expect(textsOn(4)).toContain("H=3000")
  })

  it("RW-126: название плана в графе 5 и в полосе названия страницы 4", () => {
    build(rough())
    expect(textsOn(4).filter((t) => t === "Черновые работы").length).toBeGreaterThanOrEqual(2)
  })

  it("RW-127: подложка серая (muted), как на «Демонтаже»: контуры стен страницы 4 цвета #555, а не #333", () => {
    const doc = build(rough())
    const greys = (page: number): number => parseColoredStrokes(doc, page).filter((s) => near(s.color, [0x55 / 255, 0x55 / 255, 0x55 / 255])).length
    expect(greys(4)).toBeGreaterThan(0)
    expect(greys(3)).toBe(0)
  })

  it("RW-128: размеров подложки и подписей площади на странице нет", () => {
    const d = rough({ roughPlaster: ALL_FACES })
    build(d)
    // подписи площади «м²» на странице планов не выводятся (в таблице — «Площадь, м²» без числа в той же строке)
    expect(textsOn(4).filter((t) => / м²$/.test(t))).toEqual([])
  })

  it("RW-129: первые три страницы не меняются от штукатурки и стяжки", () => {
    const firstThree = (): string[][] => [1, 2, 3].map((n) => texts.filter((t) => t.page === n).map((t) => t.text))
    build(rough())
    const before = firstThree()
    build(rough({ roughPlaster: ALL_FACES, roughScreeds: [screed("s", 200, 260, 65)] }))
    expect(firstThree()).toEqual(before)
  })
})

describe("легенда страницы «Черновые работы»", () => {
  const BRICK = ["Кирпич"]
  const labelsOf = (d: Drawing): string[][] => pagesOf(d).map((p) => legendEntries(p).map((e) => e.label))
  // две комнаты: перегородка по x = 200
  const TWO = (): ReturnType<typeof rectWalls> => [...rectWalls("k", 0, 0, 420, 320), wall("p", 200, 0, 200, 320)]

  it("RW-130: штукатурка и стяжки 50 и 100 мм: «Кирпич», «Штукатурка», «Стяжка до 100 мм» в этом порядке", () => {
    const d = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], roughScreeds: [screed("s1", 100, 160, 50), screed("s2", 300, 160, 100)] })
    expect(labelsOf(d)[3]).toEqual([...BRICK, "Штукатурка", "Стяжка до 100 мм"])
  })

  it("RW-131: только штукатурка — записи «Стяжка до N мм» нет", () => {
    const d = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)] })
    expect(labelsOf(d)[3]).toEqual([...BRICK, "Штукатурка"])
  })

  it("RW-131: только стяжка 65 мм — «Стяжка до 65 мм», записи «Штукатурка» нет", () => {
    const d = drawing({ walls: TWO(), roughScreeds: [screed("s", 100, 160, 65)] })
    expect(labelsOf(d)[3]).toEqual([...BRICK, "Стяжка до 65 мм"])
  })

  it("RW-132: недействующая стяжка в легенду не входит", () => {
    const d = drawing({ walls: TWO(), roughScreeds: [screed("s", 9999, 9999, 65)] })
    expect(labelsOf(d)[3]).toEqual(BRICK)
  })

  it("RW-133: штукатурка и стяжка есть только в легенде своей страницы", () => {
    const d = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], roughScreeds: [screed("s", 100, 160, 65)] })
    for (const labels of labelsOf(d).slice(0, 3)) {
      expect(labels).not.toContain("Штукатурка")
      expect(labels.some((l) => l.startsWith("Стяжка"))).toBe(false)
    }
  })

  it("RW-134: порядок: материалы, «Батарея», «Стояк», «Воздуховод», «Штукатурка», «Стяжка до N мм»", () => {
    const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
    const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
    const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
    const d = { ...drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], roughScreeds: [screed("s", 100, 160, 65)] }), batteries: [battery], communications: [riser, duct] }
    expect(labelsOf(d)[3]).toEqual(["Кирпич", "Батарея", "Стояк", "Воздуховод", "Штукатурка", "Стяжка до 65 мм"])
  })

  it("RW-135: «Стяжка до 100 мм» делает столбец легенды не уже, чем без записей штукатурки и стяжки", () => {
    const base = drawing({ walls: TWO() })
    const full = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], roughScreeds: [screed("s", 100, 160, 100)] })
    expect(legendWidthMm(pagesOf(full))).toBeGreaterThanOrEqual(legendWidthMm(pagesOf(base)))
  })

  it("RW-136: образцы легенды: штукатурка — фиолетовая, стяжка — штриховка, на странице 4", () => {
    const d = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], roughScreeds: [screed("s", 100, 160, 65)] })
    const doc = build(d)
    // фиолетовая заливка штукатурки на листе и образец легенды слева (x меньше области чертежа)
    const fills = purpleFills(doc, 4).flatMap((op) => (op.kind === "fill" && op.box ? [op.box] : []))
    expect(fills.some((b) => b.x < 60)).toBe(true)
  })
})
