import { describe, expect, it } from "vitest"
import { effectiveMarks } from "../demolition/marks"
import type { Battery, Communication, DemolitionMark, Drawing, Wall } from "../types"
import { legendEntries, legendWidthMm } from "./legend"
import type { PlanPage } from "./pdf"
import { pagesOf } from "./pdf"

// change add-legend-objects: записи «Батарея», «Стояк», «Воздуховод» в легенде страницы
// (spec pdf-export «Легенда на странице PDF»; design D1, D2).

const wall = (id: string, type: Wall["type"] = "brick", y = 0): Wall => ({ id, a: { x: 0, y }, b: { x: 500, y }, thicknessCm: 20, type })
const BATTERY: Battery = { id: "b1", wallId: "w1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
const RISER: Communication = { kind: "riser", id: "r1", x: 250, y: 200, diameterCm: 11 }
const DUCT: Communication = { kind: "duct", id: "d1", x: 100, y: 200, widthCm: 30, depthCm: 20 }
const MARK: DemolitionMark = { id: "m1", wallId: "w1", anchor: "a", fromCm: 300, toCm: 390 }

const page = (extra: Partial<PlanPage> = {}): PlanPage => ({ walls: [wall("w1")], dimensions: [], doorways: [], ...extra })
const labels = (p: PlanPage): string[] => legendEntries(p).map((e) => e.label)

describe("легенда: объекты страницы", () => {
  it("батарея, стояк и воздуховод идут после материалов в порядке «Батарея», «Стояк», «Воздуховод»", () => {
    expect(labels(page({ batteries: [BATTERY], communications: [DUCT, RISER] }))).toEqual(["Кирпич", "Батарея", "Стояк", "Воздуховод"])
  })

  it("на странице нет объектов — записей объектов нет", () => {
    expect(labels(page())).toEqual(["Кирпич"])
    expect(labels(page({ batteries: [], communications: [] }))).toEqual(["Кирпич"])
  })

  it("только стояк — одна запись «Стояк»", () => {
    expect(labels(page({ communications: [RISER] }))).toEqual(["Кирпич", "Стояк"])
  })

  it("только воздуховод — одна запись «Воздуховод»", () => {
    expect(labels(page({ communications: [DUCT] }))).toEqual(["Кирпич", "Воздуховод"])
  })

  it("несколько объектов одного вида дают одну запись", () => {
    const second: Communication = { ...RISER, id: "r2", x: 300 }
    expect(labels(page({ batteries: [BATTERY, { ...BATTERY, id: "b2" }], communications: [RISER, second] }))).toEqual(["Кирпич", "Батарея", "Стояк"])
  })

  it("снос стоит последним, после объектов", () => {
    const w = wall("w1")
    const marks = effectiveMarks([MARK], [w], [])
    expect(marks.length).toBe(1)
    expect(labels(page({ batteries: [BATTERY], communications: [RISER, DUCT], demolition: marks }))).toEqual([
      "Кирпич",
      "Батарея",
      "Стояк",
      "Воздуховод",
      "Демонтируемая стена",
    ])
  })

  it("страница без стен легенды не имеет, даже если на ней есть объекты", () => {
    expect(legendEntries({ walls: [], dimensions: [], doorways: [], batteries: [BATTERY], communications: [RISER] })).toEqual([])
  })

  it("столбец с объектами шире, чем с одним «Кирпичом»: «Воздуховод» длиннее", () => {
    expect(legendWidthMm([page({ communications: [DUCT] })])).toBeGreaterThan(legendWidthMm([page()]))
  })

  it("при странице со сносом записи объектов столбец не расширяют: самая длинная подпись — «Демонтируемая стена»", () => {
    const marks = effectiveMarks([MARK], [wall("w1")], [])
    const demolition = page({ demolition: marks })
    const withObjects = page({ batteries: [BATTERY], communications: [RISER, DUCT], demolition: marks })
    expect(legendWidthMm([withObjects])).toBe(legendWidthMm([demolition]))
  })
})

describe("легенда: объекты на страницах документа", () => {
  const drawing = (over: Partial<Drawing>): Drawing => ({
    id: "a",
    name: "Чертёж 1",
    walls: [wall("w1")],
    dimensions: [],
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    ...over,
  })

  // TCR (change add-rough-works-plan): страниц четыре; TCR (change reconstruction-plan): пять — «Объекты на всех планах» (pdf-export «Легенда на странице PDF»)
  it("батарея и стояк обмера есть в легенде всех пяти страниц", () => {
    const pages = pagesOf(drawing({ batteries: [BATTERY], communications: [RISER] }))
    expect(pages.map(labels)).toEqual([
      ["Кирпич", "Батарея", "Стояк"],
      ["Кирпич", "Батарея", "Стояк"],
      ["Кирпич", "Батарея", "Стояк"],
      ["Кирпич", "Батарея", "Стояк"],
      ["Кирпич", "Батарея", "Стояк"],
      ["Кирпич", "Батарея", "Стояк"], // TCR (change furniture-plan-table): шестая страница «Мебель»
    ])
  })

  // TCR (change add-rough-works-plan): запись «Батарея» нет в легендах «Монтаж» и «Черновые работы» (сценарий «Снесённая батарея на «Монтаже»»)
  it("единственная батарея, помеченная сносом: на «Демонтаже» запись есть, на «Монтаже», «Черновых работах» и «Реконструкции» нет", () => {
    const pages = pagesOf(drawing({ batteries: [BATTERY], batteryDemolition: [{ id: "bm", batteryId: "b1" }] }))
    // TCR (change reconstruction-plan): пятая страница «Реконструкция» — подложка из тех же видимых батарей, что у «Монтажа»
    expect(pages.map((p) => labels(p).includes("Батарея"))).toEqual([true, true, false, false, false, false]) // TCR (change furniture-plan-table): «Мебель» — как «Реконструкция»
  })
})
