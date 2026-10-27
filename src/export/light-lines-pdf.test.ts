import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, LightFixture, LightLine } from "../types"
import { legendEntries } from "./legend"
import type { PlanPage } from "./pdf"

// change add-light-lines: метки линий освещения на странице «Группы включения» и запись легенды
// (spec pdf-export «Метки линий на странице», «Запись «Линия освещения»», «Нет меток — нет записи»; design D7)
//
//  вид сверху, схематично, не в масштабе. Комната: внутренние грани x = 0, x = 400, y = 0, y = 300
//
//   ##########################
//   #  L3 L3                 #     пять светильников (+) с метками L3 и люстра с меткой L2
//   # (+)(+)(+)  L2          #
//   #  (+)(+)   (X)          #
//   ##########################

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

const { buildPdfPages, pagesOf } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })
const chandelier: LightFixture = { id: "x", kind: "chandelier", x: 250, y: 150 }
const SPOTS = [spot("a", 50, 80), spot("b", 100, 80), spot("c", 150, 80), spot("d", 70, 120), spot("e", 130, 120)]
const line = (id: string, targetId: string, name: string): LightLine => ({ id, targetId, name })
const FIVE: LightLine[] = SPOTS.map((s, i) => line("m" + String(i), s.id, "L3"))

const room = (): Drawing => drawing({ walls: rectWalls("k", -10, -10, 410, 310) })
const withLines = (lines: LightLine[]): Drawing => ({ ...room(), ceiling: { ceilings: [], lights: [...SPOTS, chandelier] }, switching: { lines } })
const switchingPage = (d: Drawing): PlanPage | undefined => pagesOf(d)[8]
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])
const count = (list: string[], text: string): number => list.filter((t) => t === text).length

describe("метки линий на странице «Группы включения»", () => {
  it("LL-100: пять светильников — пять подписей «L3» на девятой странице", () => {
    build(withLines(FIVE))
    expect(count(textsOn(9), "L3")).toBe(5)
  })

  it("LL-101: подписи есть только на девятой странице", () => {
    build(withLines(FIVE))
    for (let page = 1; page <= 8; page++) expect(textsOn(page)).not.toContain("L3")
  })

  it("LL-102: метка люстры «L2» нарисована отдельно от «L3»", () => {
    build(withLines([...FIVE, line("mx", "x", "L2")]))
    expect(count(textsOn(9), "L2")).toBe(1)
    expect(count(textsOn(9), "L3")).toBe(5)
  })

  it("LL-103: метка светильника, которого нет, не рисуется", () => {
    build(withLines([line("m", "нет-такого", "L3")]))
    expect(textsOn(9)).not.toContain("L3")
  })

  it("LL-104: метки не меняют первые восемь страниц", () => {
    build(withLines([]))
    const before = Array.from({ length: 8 }, (_, i) => textsOn(i + 1))
    build(withLines(FIVE))
    expect(Array.from({ length: 8 }, (_, i) => textsOn(i + 1))).toEqual(before)
  })
})

describe("легенда страницы «Группы включения»: «Линия освещения»", () => {
  it("LL-105: при показанных метках запись идёт после записей видов освещения, образец — «L1»", () => {
    const page = switchingPage(withLines(FIVE))
    expect(labels(page)).toEqual(["Кирпич", "Точечный встроенный светильник", "Люстра", "Линия освещения"])
    build(withLines(FIVE))
    expect(textsOn(9)).toContain("L1")
    // подпись легенды переносится по пробелам
    expect(textsOn(9)).toEqual(expect.arrayContaining(["Линия", "освещения"]))
  })

  it("LL-106: нет показанных меток — записи нет, в том числе когда светильника нет", () => {
    expect(labels(switchingPage(withLines([])))).not.toContain("Линия освещения")
    expect(labels(switchingPage(withLines([line("m", "нет-такого", "L3")])))).not.toContain("Линия освещения")
    build(withLines([]))
    expect(textsOn(9)).not.toContain("L1")
  })

  it("LL-107: записи «Линия освещения» нет в легендах других страниц", () => {
    const pages = pagesOf(withLines(FIVE))
    expect(pages.slice(0, 8).flatMap((p) => labels(p))).not.toContain("Линия освещения")
  })
})
