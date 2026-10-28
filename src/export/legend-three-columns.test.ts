import { readFileSync } from "node:fs"
import type { jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { content, drawing, drywall, plaster, rectWalls, wall } from "../reconstruction/reconstruction.test-utils"
import type { Battery, Communication, Drawing, FurnitureItem } from "../types"
import { FURNITURE_KIND_ORDER } from "../furniture/furniture-kinds"
import type { PageFormat, PlanPage } from "./pdf"

// change add-furniture-appliances: третий столбец легенды (spec pdf-export «Легенда на странице PDF», сценарии «Тридцать первая запись
// в третьем столбце», «Ширина легенды при трёх столбцах»). Подписи фиксируются на вызове doc.text вместе с номером страницы.

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
const { LEGEND_COLUMN_CAPACITY, LEGEND_ROW_PITCH_MM, legendCell, legendColumnCount, legendColumnWidthMm, legendEntries, legendWidthMm } = await import("./legend")
const { drawingArea, legendArea } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const TOL = 0.01

// страница «Мебель» со всеми материалами, батареей, стояком, воздуховодом, штукатуркой, гипсокартоном и предметами всех видов каталога
function fullFurniturePage(): PlanPage {
  const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
  const materials = ["blocks", "brick", "concrete", "gkl", "wood-long"] as const
  const walls = [...rectWalls("k", 0, 0, 420, 320), ...materials.map((m, i) => wall(`m${i}`, 600, i * 60, 800, i * 60, 10, m))]
  const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
  const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
  const base = drawing({ walls, roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) })
  const items: FurnitureItem[] = FURNITURE_KIND_ORDER.map((kind, i) => ({ id: `i${i}`, kind, x: 100 + (i % 6) * 60, y: 60 + Math.floor(i / 6) * 60, widthCm: 40, lengthCm: 40, angleDeg: 0 }))
  const d: Drawing = { ...base, furniture: { items, dimensions: [] }, batteries: [battery], communications: [riser, duct] }
  const page = pagesOf(d)[5]
  if (!page) throw new Error("страницы «Мебель» нет")
  return page
}

const FULL = fullFurniturePage()
const MOUNTING: PlanPage = { walls: [{ id: "w", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }], dimensions: [], doorways: [] }

const EXPECTED = [
  ["Блоки", "Кирпич", "Бетон", "ГКЛ", "Дерево", "Батарея", "Стояк", "Воздуховод", "Штукатурка", "Гипсокартон", "Стол", "Стул", "Диван", "Письменный стол", "Компьютерное кресло"],
  ["Телевизор", "Подвесная тумба", "Кровать", "Прикроватный столик", "Шкаф-купе", "Шкаф двустворчатый", "Шторы", "Кухонный шкаф", "Холодильник двустворчатый", "Винный шкаф", "Варочная панель", "Посудомойка", "Раковина", "Кухонная колонна", "Духовой шкаф"],
  // TCR (change add-toilet): в каталоге новый вид «Унитаз» — тридцать четвёртая запись в третьем столбце
  // TCR (change add-furniture-tropical-shower): в каталоге новый вид «Тропический душ» — тридцать пятая запись в третьем столбце
  // TCR (change add-wall-shower-drain): в каталоге новый вид «Трап в стену» — тридцать шестая запись в третьем столбце
  ["Микроволновка", "Стиральная машина", "Сушильная машина", "Унитаз", "Тропический душ", "Трап в стену"],
]

function build(pages: PlanPage[], format: PageFormat): void {
  texts.length = 0
  buildPdfPages(pages, "cm", 100, format, font, "Чертёж 1", SEP)
}

// подписи легенды страницы n: тексты в столбце легенды под полосой названия и над нижней полосой
const legendTexts = (n: number, pages: PlanPage[], format: PageFormat): TextCall[] => {
  const col = legendArea(format, legendWidthMm(pages))
  const area = drawingArea(format, legendWidthMm(pages))
  return texts.filter((t) => t.page === n && t.x >= col.x - TOL && t.x < area.x && t.y >= col.y - TOL && t.y <= col.y + col.h)
}

describe("легенда в три столбца", () => {
  it("L3-01: тридцать шесть записей по столбцам 15 + 15 + 6 в порядке спеки", () => {
    const labels = legendEntries(FULL).map((e) => e.label)
    expect(labels).toEqual(EXPECTED.flat())
    const byColumn = [0, 1, 2].map((c) => labels.filter((_, i) => legendCell(i).column === c))
    expect(byColumn).toEqual(EXPECTED)
    expect(legendColumnCount([FULL])).toBe(3)
  })

  it("L3-02: ширина легенды документа — три ширины столбца; страница с тремя записями получает ту же ширину", () => {
    expect(legendWidthMm([FULL])).toBe(3 * legendColumnWidthMm([FULL]))
    expect(legendColumnCount([FULL, MOUNTING])).toBe(3)
    expect(legendWidthMm([FULL, MOUNTING])).toBe(legendWidthMm([FULL]))
  })

  it.each(["A3", "A2", "A1", "A0"] as const)("L3-03: %s — каждый столбец помещается по высоте в область чертежа", (format) => {
    const col = legendArea(format, legendWidthMm([FULL]))
    expect(LEGEND_COLUMN_CAPACITY * LEGEND_ROW_PITCH_MM).toBeLessThanOrEqual(col.h + TOL)
  })

  it.each(["A3", "A0"] as const)("L3-04: %s — первые записи трёх столбцов на одном уровне, столбцы сдвинуты на ширину столбца", (format) => {
    const pages = [FULL, MOUNTING]
    build(pages, format)
    const on = legendTexts(1, pages, format)
    const first = (label: string): TextCall | undefined => on.find((t) => t.text === label)
    const [a, b, c] = ["Блоки", "Телевизор", "Микроволновка"].map(first)
    expect(a && b && c).toBeTruthy()
    const width = legendColumnWidthMm(pages)
    expect(b?.y).toBeCloseTo(a?.y ?? NaN, 6)
    expect(c?.y).toBeCloseTo(a?.y ?? NaN, 6)
    expect((b?.x ?? 0) - (a?.x ?? 0)).toBeCloseTo(width, 6)
    expect((c?.x ?? 0) - (a?.x ?? 0)).toBeCloseTo(2 * width, 6)
    const col = legendArea(format, legendWidthMm(pages))
    for (const t of on) expect(t.y, t.text).toBeLessThanOrEqual(col.y + col.h)
  })

  it("L3-05: страница «Монтаж» с тремя записями рисует только первый столбец", () => {
    const pages = [FULL, MOUNTING]
    build(pages, "A3")
    const full = legendTexts(1, pages, "A3")
    const mounting = legendTexts(2, pages, "A3")
    expect(mounting.map((t) => t.text)).toEqual(["Кирпич"])
    expect(mounting[0]?.x).toBeCloseTo(full.find((t) => t.text === "Блоки")?.x ?? NaN, 6)
  })
})
