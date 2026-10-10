import { readFileSync } from "node:fs"
import type { jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import type { Drawing, Wall } from "../types"
import { titleBlockTexts } from "./sheet-layout"

// change pdf-plan-page-names: в графе 5 основной надписи каждой страницы — название плана (spec pdf-export
// «Заполнение основной надписи»; design D1–D2). Текст фиксируется на вызове doc.text вместе с номером страницы.

interface TextCall {
  page: number
  text: string
  x: number
  y: number
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
          const [text, x, y] = args
          if (typeof text === "string" && typeof x === "number" && typeof y === "number") texts.push({ page: this.getCurrentPageInfo().pageNumber, text, x, y })
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pagesOf } = await import("./pdf")
const { titleBlockRect } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const wall = (id: string): Wall => ({ id, a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" })
const drawing = (): Drawing => ({ id: "a", name: "Чертёж 1", walls: [wall("w1")], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100 })

// координаты графы основной надписи в мм листа
const cell = (x: number, y: number, w: number, h: number) => {
  const block = titleBlockRect("A4")
  return { x: block.x + x, y: block.y + y, w, h }
}
const inCell = (t: TextCall, c: { x: number; y: number; w: number; h: number }): boolean => t.x >= c.x && t.x <= c.x + c.w && t.y >= c.y && t.y <= c.y + c.h
const CELL5 = cell(65, 15, 70, 25)
const CELL1 = cell(65, 0, 120, 15)

function build(d: Drawing = drawing()): void {
  texts.length = 0
  buildPdfPages(pagesOf(d), "cm", 100, "A4", font, d.name, SEP)
}

const inFifth = (page: number): string[] => texts.filter((t) => t.page === page && inCell(t, CELL5)).map((t) => t.text)

describe("название плана в графе 5", () => {
  it("PN-01: первая страница — «Обмерочный план», вторая — «Демонтаж» в графе 5", () => {
    build()
    expect(inFifth(1)).toEqual(["Обмерочный план"])
    expect(inFifth(2)).toEqual(["Демонтаж"])
  })

  it("PN-02: название плана стоит по центру графы 5 по горизонтали", () => {
    build()
    for (const page of [1, 2]) {
      const t = texts.find((x) => x.page === page && inCell(x, CELL5))
      expect(Math.abs((t?.x ?? 0) - (CELL5.x + CELL5.w / 2)), `страница ${page}`).toBeLessThan(0.01)
    }
  })

  it("PN-03: название плана чужого плана на странице нет: на первой нет «Демонтаж», на второй — «Обмерочный план»", () => {
    build()
    expect(texts.filter((t) => t.page === 1).map((t) => t.text)).not.toContain("Демонтаж")
    expect(texts.filter((t) => t.page === 2).map((t) => t.text)).not.toContain("Обмерочный план")
  })

  it("PN-04: имя чертежа по-прежнему в графе 1 обеих страниц и не попадает в графу 5; «Р», масштаб и дата на месте", () => {
    build()
    for (const page of [1, 2]) {
      const on = texts.filter((t) => t.page === page)
      expect(on.filter((t) => t.text === "Чертёж 1" && inCell(t, CELL1))).toHaveLength(1)
      expect(on.filter((t) => t.text === "Чертёж 1" && inCell(t, CELL5))).toEqual([])
      expect(on.some((t) => t.text === "Р" && inCell(t, cell(135, 20, 15, 15)))).toBe(true)
      expect(on.some((t) => t.text === "1:100" && inCell(t, cell(165, 20, 20, 15)))).toBe(true)
      expect(on.some((t) => t.text === "09.26" && inCell(t, cell(55, 20, 10, 5)))).toBe(true)
    }
  })

  it("PN-05: в графе 5 ровно один текст на странице", () => {
    build()
    for (const page of [1, 2]) expect(inFifth(page), `страница ${page}`).toHaveLength(1)
  })

  it("PN-06: имя чертежа «Демонтаж» не подменяет и не дублирует название плана: в графе 1 имя, в графе 5 название плана", () => {
    const d = { ...drawing(), name: "Демонтаж" }
    build(d)
    expect(inFifth(1)).toEqual(["Обмерочный план"])
    expect(inFifth(2)).toEqual(["Демонтаж"])
    expect(texts.filter((t) => t.page === 1 && inCell(t, CELL1)).map((t) => t.text)).toEqual(["Демонтаж"])
  })
})

describe("содержимое основной надписи: название страницы", () => {
  const date = new Date(2026, 8, 5)

  it("PN-10: pageName попадает в графу 5; остальные графы прежние", () => {
    const out = titleBlockTexts({ name: "Чертёж 1", scale: 100, date, pageName: "Демонтаж" })
    expect(out.find((t) => t.cellId === "5")).toEqual({ cellId: "5", text: "Демонтаж" })
    expect(out.filter((t) => t.cellId !== "5").map((t) => t.cellId).sort()).toEqual(["1", "13", "25", "6"].sort())
  })

  it("PN-11: без pageName и с пустым pageName графа 5 пуста", () => {
    for (const pageName of [undefined, ""]) {
      const content = pageName === undefined ? { name: "x", scale: 100, date } : { name: "x", scale: 100, date, pageName }
      expect(titleBlockTexts(content).map((t) => t.cellId)).not.toContain("5")
    }
  })

  it("PN-12: pageName не зависит от имени чертежа: пустое имя и длинное имя не мешают", () => {
    for (const name of ["", "очень длинное имя ".repeat(10)]) {
      expect(titleBlockTexts({ name, scale: 100, date, pageName: "Обмерочный план" }).find((t) => t.cellId === "5")?.text).toBe("Обмерочный план")
    }
  })
})
