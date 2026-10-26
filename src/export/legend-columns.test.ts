import { describe, expect, it } from "vitest"
import { content, drawing, drywall, plaster, rectWalls, wall } from "../reconstruction/reconstruction.test-utils"
import type { Battery, Communication, Drawing, FurnitureItem } from "../types"
import { LEGEND_COLUMN_CAPACITY, legendCell, legendColumnCount, legendColumnWidthMm, legendEntries, legendWidthMm } from "./legend"
import { pagesOf } from "./pdf"
import type { PlanPage } from "./pdf"

// change add-furniture-tv-wall-cabinet: легенда в два столбца (spec pdf-export «Легенда на странице PDF», сценарии «Пятнадцать записей —
// один столбец», «Шестнадцатая запись во втором столбце», «Число столбцов общее для документа», «Ширина легенды при двух столбцах»).

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const ITEMS: Record<FurnitureItem["kind"], FurnitureItem> = {
  table: item("t", "table", 200, 160, 80, 160),
  chair: item("c", "chair", 100, 100, 45, 45),
  sofa: item("s", "sofa", 300, 100, 200, 90),
  desk: item("p", "desk", 200, 300, 100, 50),
  officeChair: item("o", "officeChair", 100, 300, 60, 60),
  tv: item("v", "tv", 300, 300, 91, 11),
  wallCabinet: item("w", "wallCabinet", 300, 400, 180, 42),
  // TCR (change add-furniture-bed-nightstand): в каталоге новые виды (запись нужна типу Record; наборы FIFTEEN и ALL не меняются)
  bed: item("b", "bed", 500, 400, 160, 200),
  nightstand: item("n", "nightstand", 600, 400, 30, 60),
  // TCR (change add-furniture-wardrobes): в каталоге новые виды (запись нужна типу Record; наборы FIFTEEN и ALL не меняются)
  slidingWardrobe: item("k", "slidingWardrobe", 700, 400, 300, 60),
  doubleWardrobe: item("d", "doubleWardrobe", 800, 400, 100, 60),
  // TCR (change add-furniture-curtains): в каталоге новый вид (запись нужна типу Record; наборы FIFTEEN и ALL не меняются)
  curtains: item("u", "curtains", 900, 400, 300, 13),
  // TCR (change add-furniture-kitchen-cabinet-fridge): в каталоге новые виды (запись нужна типу Record; наборы FIFTEEN и ALL не меняются)
  kitchenCabinet: item("q", "kitchenCabinet", 1000, 400, 60, 62),
  fridge: item("f", "fridge", 1100, 400, 100, 90),
  // TCR (change add-furniture-kitchen-objects): в каталоге новые виды (запись нужна типу Record; наборы FIFTEEN и ALL не меняются)
  wineCabinet: item("e", "wineCabinet", 1200, 400, 30, 62),
  hob: item("h", "hob", 1300, 400, 52, 30),
  dishwasher: item("j", "dishwasher", 1400, 400, 60, 62),
  sink: item("r", "sink", 1500, 400, 45, 40),
  // TCR (change add-furniture-appliances): в каталоге новые виды (запись нужна типу Record; наборы FIFTEEN и ALL не меняются)
  kitchenColumn: item("x", "kitchenColumn", 1600, 400, 60, 62),
  oven: item("y", "oven", 1700, 400, 60, 62),
  microwave: item("z", "microwave", 1800, 400, 60, 62),
  washer: item("a", "washer", 1900, 400, 60, 60),
  dryer: item("g", "dryer", 2000, 400, 60, 60),
}

// страница «Мебель» со всеми материалами, батареей, стояком, воздуховодом, штукатуркой, гипсокартоном и предметами заданных видов
function furniturePage(kinds: FurnitureItem["kind"][]): PlanPage {
  const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
  const materials = ["blocks", "brick", "concrete", "gkl", "wood-long"] as const
  const walls = [...rectWalls("k", 0, 0, 420, 320), ...materials.map((m, i) => wall(`m${i}`, 600, i * 60, 800, i * 60, 10, m))]
  const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
  const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
  const base = drawing({ walls, roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) })
  const d: Drawing = { ...base, furniture: { items: kinds.map((k) => ITEMS[k]), dimensions: [] }, batteries: [battery], communications: [riser, duct] }
  const page = pagesOf(d)[5]
  if (!page) throw new Error("страницы «Мебель» нет")
  return page
}

const FIFTEEN: FurnitureItem["kind"][] = ["table", "chair", "sofa", "desk", "officeChair"]
const ALL: FurnitureItem["kind"][] = ["table", "chair", "sofa", "desk", "officeChair", "tv", "wallCabinet"]
const brickOnly: PlanPage = { walls: [{ id: "w", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }], dimensions: [], doorways: [] }

describe("легенда в два столбца", () => {
  it("LC-01: столбец вмещает 15 записей", () => {
    expect(LEGEND_COLUMN_CAPACITY).toBe(15)
  })

  it("LC-02: запись i стоит в столбце ⌊i / 15⌋, строке i mod 15", () => {
    expect(legendCell(0)).toEqual({ column: 0, row: 0 })
    expect(legendCell(14)).toEqual({ column: 0, row: 14 })
    expect(legendCell(15)).toEqual({ column: 1, row: 0 })
    expect(legendCell(16)).toEqual({ column: 1, row: 1 })
  })

  it("LC-03: пятнадцать записей — один столбец, ширина легенды равна ширине столбца", () => {
    const page = furniturePage(FIFTEEN)
    expect(legendEntries(page)).toHaveLength(15)
    expect(legendColumnCount([page])).toBe(1)
    expect(legendWidthMm([page])).toBe(legendColumnWidthMm([page]))
  })

  it("LC-04: семнадцать записей — порядок и два столбца: пятнадцать в первом, «Телевизор» и «Подвесная тумба» во втором", () => {
    const page = furniturePage(ALL)
    const labels = legendEntries(page).map((e) => e.label)
    expect(labels).toHaveLength(17)
    expect(labels.slice(14)).toEqual(["Компьютерное кресло", "Телевизор", "Подвесная тумба"])
    expect(legendColumnCount([page])).toBe(2)
    expect(labels.map((_, i) => legendCell(i).column).filter((c) => c === 1)).toHaveLength(2)
  })

  it("LC-05: ширина легенды при двух столбцах вдвое больше ширины столбца", () => {
    const page = furniturePage(ALL)
    expect(legendWidthMm([page])).toBe(2 * legendColumnWidthMm([page]))
  })

  it("LC-06: число столбцов общее для документа — страница с тремя записями при двух столбцах документа получает ту же ширину", () => {
    const wide = furniturePage(ALL)
    expect(legendColumnCount([wide, brickOnly])).toBe(2)
    expect(legendWidthMm([wide, brickOnly])).toBe(legendWidthMm([wide]))
    expect(legendColumnWidthMm([wide, brickOnly])).toBe(legendColumnWidthMm([wide]))
  })

  it("LC-07: без стен легенды нет, столбцов нет", () => {
    expect(legendWidthMm([{ walls: [], dimensions: [], doorways: [] }])).toBe(0)
    expect(legendWidthMm([])).toBe(0)
  })
})
