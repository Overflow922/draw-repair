import { readFileSync } from "node:fs"
import type { jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, wall } from "../mounting/mounting.test-utils"
import type { Drawing, RoomRecord } from "../types"

// Тесты change add-room-explication: блоки помещений и таблица экспликации на странице «Монтаж» PDF (spec room-explication
// «Таблица экспликации в PDF», «Блоки помещений в PDF»; pdf-export «Страница плана «Монтаж»»).
// Текст фиксируется на вызове doc.text вместе с номером страницы.

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
const NOW = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing): void => {
  texts.length = 0
  buildPdfPages(pagesOf(d), "cm", 100, "A4", font, d.name, NOW)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

// замкнутая комната 500×300 по осям из собственных стен «Монтажа», внутри 480×280 = 13,44 м²
const ROOM = [wall("F", 0, 0, 500, 0), wall("R", 500, 0, 500, 300), wall("B", 500, 300, 0, 300), wall("L", 0, 300, 0, 0)]
const withRoom = (rooms?: RoomRecord[]): Drawing => ({ ...drawing({ walls: [], mounting: { walls: ROOM, dimensions: [] } }), ...(rooms ? { rooms } : null) })
const record = (number: number, name: string, heightMm = 3000): RoomRecord => ({ number, name, heightMm, anchor: { x: 250, y: 150 } })

describe("таблица экспликации в PDF", () => {
  it("на странице «Монтаж» есть заголовок, шапка, строка помещения и итог", () => {
    build(withRoom())
    const page3 = textsOn(3)
    for (const t of ["Экспликация помещений", "№", "Наименование", "Площадь,", "м²", "Общая"]) expect(page3, t).toContain(t)
    expect(page3.filter((t) => t === "13,4")).toHaveLength(2) // строка помещения и итог
  })

  it("пустое название выводится как «Комната»", () => {
    build(withRoom([record(1, "")]))
    expect(textsOn(3)).toContain("Комната")
  })

  it("заданное название и высота попадают в таблицу и блок", () => {
    build(withRoom([record(1, "Кухня", 2923)]))
    const page3 = textsOn(3)
    expect(page3).toContain("Кухня")
    expect(page3).toContain("H=2923")
  })

  it("длинное название переносится на несколько строк, текст не теряется", () => {
    const name = "Жилая комната с балконом и гардеробной"
    build(withRoom([record(1, name)]))
    const lines = textsOn(3).filter((t) => name.includes(t) && t.length > 3)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(" ")).toBe(name)
  })

  it("без помещений таблицы на странице нет", () => {
    build(drawing({ walls: [], mounting: { walls: [ROOM[0], ROOM[1], ROOM[2]], dimensions: [] } }))
    expect(textsOn(3)).not.toContain("Экспликация помещений")
    expect(textsOn(3)).not.toContain("Общая")
  })

  it("на страницах других планов таблицы нет", () => {
    build(withRoom())
    for (const n of [1, 2]) {
      const page = textsOn(n)
      expect(page, `страница ${n}`).not.toContain("Экспликация помещений")
      expect(page, `страница ${n}`).not.toContain("Общая")
    }
  })

  it("помещение меньше 1 м² в таблицу не попадает", () => {
    const small = [wall("a", 0, 0, 110, 0), wall("b", 110, 0, 110, 110), wall("c", 110, 110, 0, 110), wall("d", 0, 110, 0, 0)]
    build(drawing({ walls: [], mounting: { walls: small, dimensions: [] } }))
    expect(textsOn(3)).not.toContain("Экспликация помещений")
  })
})

describe("блоки помещений в PDF", () => {
  it("на странице «Монтаж» у помещения блок с номером и высотой, подписи площади нет", () => {
    build(withRoom())
    const page3 = textsOn(3)
    expect(page3).toContain("H=3000")
    expect(page3.some((t) => / м²$/.test(t))).toBe(false)
  })

  it("номер блока совпадает с номером в таблице", () => {
    build(withRoom([record(5, "Кухня")]))
    expect(textsOn(3).filter((t) => t === "5").length).toBeGreaterThanOrEqual(2) // блок и строка таблицы
  })

  it("на других страницах блоков нет", () => {
    build(withRoom())
    for (const n of [1, 2]) expect(textsOn(n).some((t) => t.startsWith("H=")), `страница ${n}`).toBe(false)
  })

  it("страница «Обмерочный план» сохраняет подпись площади помещения", () => {
    build(drawing({ walls: ROOM }))
    expect(textsOn(1)).toContain("13,44 м²")
  })
})
