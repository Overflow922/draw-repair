import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { deepFreeze, dimension, drawing, mark, opening, wall } from "../mounting/mounting.test-utils"
import type { DrawingParts } from "../mounting/mounting.test-utils"
import type { Drawing } from "../types"
import type { PageFormat } from "./pdf"
import { isRed, parseColoredStrokes } from "./pdf-colors.test-utils"
import { parsePaths, strokeSegments } from "./pdf-ops.test-utils"

// change mounting-plan: третья страница PDF — план «Монтаж» (spec pdf-export «Страница плана «Монтаж»»; design D7).
// Текст фиксируется на вызове doc.text вместе с номером страницы; векторные операторы разбираются из потока.

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

const { availableFormatsForPages, buildPdfPages, pagesOf } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 100, format: PageFormat = "A4"): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", scale, format, font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

// вертикальные отрезки длиной 2 мм на листе (торцы стены толщиной 20 см при 1:100)
const endCaps = (doc: jsPDF, page: number): number =>
  strokeSegments(parsePaths(doc, page)).filter((s) => Math.abs(s.a.x - s.b.x) < 1e-6 && Math.abs(Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y) - 2) < 0.05).length

const MARK = mark("m", "W", "a", 100, 190)
const numeric = (list: string[]): string[] => list.filter((t) => /^\d+([.,]\d+)?$/.test(t))
const ownDim = dimension(["N", 2], ["N", 1], ["N", 3], ["N", 1], 60)
const N = wall("N", 0, 100, 0, 400)
const withMounting = (extra: DrawingParts = {}): Drawing => drawing({ demolition: [MARK], mounting: { walls: [N], dimensions: [ownDim] }, ...extra })

describe("pagesOf: страница «Монтаж»", () => {
  it("MP-80: страниц три; третья — «Монтаж» из остатков и собственных стен, без пометок сноса", () => {
    const pages = pagesOf(withMounting())
    expect(pages).toHaveLength(3)
    const third = pages[2]
    expect(third?.title).toBe("Монтаж")
    expect(third?.walls.map((w) => w.id)).toEqual(["W~0", "W~1900", "N"])
    expect(third?.dimensions).toEqual([ownDim])
    expect(third !== undefined && third.demolition === undefined).toBe(true)
  })

  it("MP-80: размеры обмера на третью страницу не попадают, собственные — попадают", () => {
    const measureDim = dimension(["W", 2], ["W", 1], ["W", 3], ["W", 1], 60)
    const pages = pagesOf(withMounting({ dimensions: [measureDim] }))
    expect(pages[0]?.dimensions).toEqual([measureDim])
    expect(pages[2]?.dimensions).toEqual([ownDim])
  })

  it("MP-80: проёмы третьей страницы — видимые старые и собственные, снесённые не попадают", () => {
    const kept = opening("keep", "W", "a", 200) // [200,290], снос 100–190 не задевает
    const lost = opening("lost", "W", "a", 120, 40) // [120,160] внутри сноса
    const own = opening("own", "N", "a", 10)
    const pages = pagesOf(withMounting({ doorways: [kept, lost], mounting: { walls: [N], dimensions: [], doorways: [own] } }))
    expect(pages[2]?.doorways.map((d) => d.id)).toEqual(["keep", "own"])
    expect(pages[0]?.doorways.map((d) => d.id)).toEqual(["keep", "lost"])
  })

  it("MP-81: чертёж без поля mounting — третья страница из одних остатков", () => {
    const pages = pagesOf(drawing({ demolition: [MARK] }))
    expect(pages).toHaveLength(3)
    expect(pages[2]?.walls.map((w) => w.id)).toEqual(["W~0", "W~1900"])
    expect(pages[2]?.dimensions).toEqual([])
  })

  it("MP-82: первая и вторая страницы не зависят от объектов «Монтажа»", () => {
    const plain = pagesOf(drawing({ demolition: [MARK] }))
    const rich = pagesOf(withMounting())
    expect(rich[0]).toEqual(plain[0])
    expect(rich[1]).toEqual(plain[1])
  })

  it("MP-83: pagesOf не зависит от активного плана и не мутирует чертёж", () => {
    const base = withMounting()
    expect(pagesOf({ ...base, activePlan: "mounting" })).toEqual(pagesOf({ ...base, activePlan: "measure" }))
    expect(() => pagesOf(deepFreeze(withMounting()))).not.toThrow()
  })

  it("MP-84: чертёж без стен — третья страница пуста, но остаётся", () => {
    const pages = pagesOf(drawing({ walls: [] }))
    expect(pages).toHaveLength(3)
    expect(pages[2]?.walls).toEqual([])
  })
})

describe("третья страница в документе PDF", () => {
  it("MP-85: в PDF три страницы; красного (сноса) на третьей нет", () => {
    const doc = build(withMounting())
    expect(doc.getNumberOfPages()).toBe(3)
    expect(parseColoredStrokes(doc, 3).filter((s) => isRed(s.color))).toEqual([])
  })

  it("MP-85: название плана «Монтаж» стоит на третьей странице и не стоит на первых двух", () => {
    build(withMounting())
    expect(textsOn(3)).toContain("Монтаж")
    expect(textsOn(1)).not.toContain("Монтаж")
    expect(textsOn(2)).not.toContain("Монтаж")
    expect(textsOn(1)).toContain("Обмерочный план")
    expect(textsOn(2)).toContain("Демонтаж")
  })

  it("MP-86: снесённого участка на третьей странице нет: торцов стены четыре (две части), на первой — два (стена целая)", () => {
    const doc = build(drawing({ demolition: [MARK] }))
    expect(endCaps(doc, 1)).toBe(2)
    expect(endCaps(doc, 3)).toBe(4)
  })

  it("MP-86: достройка собственной стеной на месте сноса снова даёт цельный контур: торцов два", () => {
    const doc = build(drawing({ demolition: [MARK], mounting: { walls: [wall("F", 100, 0, 190, 0)], dimensions: [] } }))
    expect(endCaps(doc, 3)).toBe(2)
  })

  it("MP-87: размер собственных объектов нарисован на третьей странице, размер обмера — нет", () => {
    const measureDim = dimension(["W", 2], ["W", 1], ["W", 3], ["W", 1], 60)
    const bare = build(drawing({ demolition: [MARK], mounting: { walls: [N], dimensions: [] } }))
    expect(bare.getNumberOfPages()).toBe(3)
    const bareThird = numeric(textsOn(3))
    build(drawing({ demolition: [MARK], dimensions: [measureDim], mounting: { walls: [N], dimensions: [] } }))
    expect(numeric(textsOn(3))).toEqual(bareThird)
    build(withMounting())
    expect(numeric(textsOn(3)).length).toBeGreaterThan(bareThird.length)
  })

  it("MP-88: подпись высоты старого проёма, задетого сносом, на третьей странице отсутствует, на первой есть", () => {
    const lost = opening("lost", "W", "a", 120, 40)
    build(drawing({ demolition: [MARK], doorways: [lost] }))
    expect(textsOn(1).some((t) => t.includes("210"))).toBe(true)
    expect(textsOn(3).some((t) => t.includes("210"))).toBe(false)
  })

  it("MP-88: подпись высоты не задетого сносом старого проёма на третьей странице есть", () => {
    const kept = opening("keep", "W", "a", 200)
    build(drawing({ demolition: [MARK], doorways: [kept] }))
    expect(textsOn(3).some((t) => t.includes("210"))).toBe(true)
  })

  it("MP-91: замкнутое помещение из остатков и собственных стен подписано площадью 13,44 м² на третьей странице (и только на ней)", () => {
    const closed = drawing({
      demolition: [MARK],
      mounting: { walls: [wall("F", 100, 0, 190, 0), wall("R", 500, 0, 500, 300), wall("B", 500, 300, 0, 300), wall("L", 0, 300, 0, 0)], dimensions: [] },
    })
    build(closed)
    expect(textsOn(3)).toContain("13,44 м²")
    expect(textsOn(2).some((t) => / м²$/.test(t))).toBe(false)
  })

  it("MP-91: пока в сносе остаётся разрыв, подписи площади на третьей странице нет", () => {
    const open = drawing({
      demolition: [MARK],
      mounting: { walls: [wall("R", 500, 0, 500, 300), wall("B", 500, 300, 0, 300), wall("L", 0, 300, 0, 0)], dimensions: [] },
    })
    build(open)
    expect(textsOn(3).some((t) => / м²$/.test(t))).toBe(false)
  })

  it("MP-89: у третьей страницы те же рамка, формат и масштаб, что у остальных", () => {
    const doc = build(withMounting(), 50, "A3")
    expect(doc.getNumberOfPages()).toBe(3)
    for (const n of [1, 2, 3]) expect(textsOn(n), `страница ${n}`).toContain("1:50")
  })
})

describe("форматы учитывают страницу «Монтаж»", () => {
  const long = (len: number): Drawing => drawing({ walls: [wall("W", 0, 0, 242, 0)], mounting: { walls: [wall("N", 0, 100, len, 100)], dimensions: [] } })

  it("MP-90: собственная стена 242 см при 1:10 помещается на A4, 243 — нет (габариты третьей страницы)", () => {
    expect(availableFormatsForPages(pagesOf(long(242)), 10)).toContain("A4")
    expect(availableFormatsForPages(pagesOf(long(243)), 10)).not.toContain("A4")
  })

  it("MP-90: снесённая и потому не показанная часть стены габариты не раздувает", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 243, 0)], demolition: [mark("m", "W", "a", 100, 243)] })
    const [measure, , mounting] = pagesOf(d)
    if (!measure || !mounting) throw new Error("нет страниц")
    expect(availableFormatsForPages([measure], 10)).not.toContain("A4")
    expect(availableFormatsForPages([mounting], 10)).toContain("A4")
  })

  it("MP-90: собственные размеры третьей страницы входят в габариты", () => {
    const far = dimension(["N", 2], ["N", 1], ["N", 3], ["N", 1], 3000)
    const near = dimension(["N", 2], ["N", 1], ["N", 3], ["N", 1], 30)
    const base = (dim: typeof far): Drawing => drawing({ walls: [wall("W", 0, 0, 100, 0)], mounting: { walls: [wall("N", 0, 100, 100, 100)], dimensions: [dim] } })
    expect(availableFormatsForPages(pagesOf(base(near)), 10)).toContain("A4")
    expect(availableFormatsForPages(pagesOf(base(far)), 10)).not.toContain("A4")
  })
})
