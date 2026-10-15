import { describe, expect, it } from "vitest"
import type { Room } from "../room-area"
import type { ExplicatedRoom } from "../room-explication"
import { explicationTable } from "../room-explication"
import type { PlanPage } from "./pdf"
import {
  EXPLICATION_HEADER_H_MM,
  EXPLICATION_ROW_MIN_H_MM,
  EXPLICATION_TITLE_H_MM,
  EXPLICATION_W_MM,
  bottomBandMm,
  explicationLayout,
  explicationRect,
  pageExplication,
  wrapName,
} from "./explication"
import { fitScale } from "./fit-scale"
import { PAGE_FORMATS_MM } from "./page-format"
import type { PageFormat } from "./page-format"
import { drawingArea, frameRect, legendArea, titleBlockRect } from "./sheet-layout"

// Тесты change add-room-explication: раскладка таблицы экспликации и нижняя полоса листа (spec room-explication «Таблица
// экспликации в PDF», pdf-export «Область чертежа внутри рамки»). Размеры — абсолютные миллиметры.

const FORMATS = Object.keys(PAGE_FORMATS_MM) as PageFormat[]
const noRoom: Room = { outline: [], holes: [], areaCm2: 0, labelAt: { x: 0, y: 0 } }
const item = (number: number, name: string, areaCm2 = 100000): ExplicatedRoom => ({
  room: { ...noRoom, areaCm2 },
  record: { number, name, heightMm: 3000, anchor: { x: 0, y: 0 } },
})
const items = (n: number, name = "Комната"): ExplicatedRoom[] => Array.from({ length: n }, (_, i) => item(i + 1, name))
const tableOf = (rooms: ExplicatedRoom[]) => explicationTable(rooms)
const pageWith = (rooms: ExplicatedRoom[] | undefined): PlanPage => ({
  walls: [{ id: "w", a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thicknessCm: 20, type: "brick" }],
  dimensions: [],
  doorways: [],
  ...(rooms ? { rooms } : null),
})

describe("перенос названия", () => {
  it("короткое название — одна строка", () => {
    expect(wrapName("Кухня")).toEqual(["Кухня"])
  })

  it("длинное название переносится по пробелам", () => {
    const lines = wrapName("Жилая комната с балконом и гардеробной")
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(" ")).toBe("Жилая комната с балконом и гардеробной")
  })

  it("слово длиннее ячейки разбивается по символам, текст не теряется", () => {
    const word = "Многофункциональноепомещениесловомбезпробелов"
    const lines = wrapName(word)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join("")).toBe(word)
  })

  it("пустое название — одна пустая строка", () => {
    expect(wrapName("")).toEqual([""])
  })
})

describe("раскладка таблицы", () => {
  it("высота = заголовок + шапка + строки + итог", () => {
    const l = explicationLayout(tableOf(items(3)))
    expect(l.heightMm).toBeCloseTo(EXPLICATION_TITLE_H_MM + EXPLICATION_HEADER_H_MM + 3 * EXPLICATION_ROW_MIN_H_MM + EXPLICATION_ROW_MIN_H_MM, 6)
  })

  it("перенесённое название делает строку выше", () => {
    const one = explicationLayout(tableOf([item(1, "Кухня")]))
    const wrapped = explicationLayout(tableOf([item(1, "Жилая комната с балконом и гардеробной")]))
    expect(wrapped.rows[0].h).toBeGreaterThan(one.rows[0].h)
    expect(wrapped.heightMm).toBeGreaterThan(one.heightMm)
  })

  it("строки идут подряд без зазоров, итог — под последней строкой", () => {
    const l = explicationLayout(tableOf(items(4)))
    l.rows.forEach((r, i) => expect(r.y).toBeCloseTo(i === 0 ? EXPLICATION_HEADER_H_MM : l.rows[i - 1].y + l.rows[i - 1].h, 6))
    const last = l.rows[l.rows.length - 1]
    expect(l.total.y).toBeCloseTo(last.y + last.h, 6)
    expect(l.bodyH).toBeCloseTo(l.total.y + l.total.h, 6)
  })

  it("итог и строки берут значения из таблицы экспликации", () => {
    const l = explicationLayout(tableOf([item(1, "Коридор", 108000), item(2, "Кухня", 121000)]))
    expect(l.rows.map((r) => r.area)).toEqual(["10,8", "12,1"])
    expect(l.total.area).toBe("22,9")
  })
})

describe("таблица страницы", () => {
  it("у страницы без поля помещений таблицы нет", () => {
    expect(pageExplication(pageWith(undefined))).toBeNull()
  })

  it("у страницы с пустым списком помещений таблицы нет", () => {
    expect(pageExplication(pageWith([]))).toBeNull()
  })

  it("у страницы с помещениями таблица есть", () => {
    expect(pageExplication(pageWith(items(2)))?.rows).toHaveLength(2)
  })
})

describe("положение таблицы", () => {
  it.each(FORMATS)("%s: таблица в левом нижнем углу рамки", (format) => {
    const rect = explicationRect(format, explicationLayout(tableOf(items(3))))
    const frame = frameRect(format)
    expect(rect.x).toBeCloseTo(frame.x, 6)
    expect(rect.y + rect.h).toBeCloseTo(frame.y + frame.h, 6)
    expect(rect.w).toBe(EXPLICATION_W_MM)
  })

  it.each(FORMATS)("%s: между таблицей и основной надписью свободный зазор", (format) => {
    const rect = explicationRect(format, explicationLayout(tableOf(items(3))))
    expect(titleBlockRect(format).x - (rect.x + rect.w)).toBeGreaterThan(0)
  })

  it("на A4 зазор не менее 10 мм", () => {
    const rect = explicationRect("A4", explicationLayout(tableOf(items(1))))
    expect(titleBlockRect("A4").x - (rect.x + rect.w)).toBeGreaterThanOrEqual(10)
  })
})

describe("нижняя полоса листа", () => {
  it("без таблицы равна высоте основной надписи", () => {
    for (const f of FORMATS) expect(bottomBandMm([pageWith(undefined), pageWith([])], f)).toBe(titleBlockRect(f).h)
  })

  it("низкая таблица не выше основной надписи — полоса равна основной надписи", () => {
    expect(bottomBandMm([pageWith(items(2))], "A4")).toBe(titleBlockRect("A4").h)
  })

  it("высокая таблица делает полосу равной её высоте", () => {
    const rooms = items(10)
    expect(bottomBandMm([pageWith(rooms)], "A4")).toBeCloseTo(explicationLayout(tableOf(rooms)).heightMm, 6)
    expect(bottomBandMm([pageWith(rooms)], "A4")).toBeGreaterThan(titleBlockRect("A4").h)
  })

  it("полоса одна на документ: берётся наибольшая таблица среди страниц", () => {
    const small = pageWith(items(1))
    const big = pageWith(items(10))
    expect(bottomBandMm([small, big], "A4")).toBe(bottomBandMm([big], "A4"))
  })
})

describe("область чертежа и легенда с нижней полосой", () => {
  it("A4 без таблицы: область 272×135 мм, как прежде", () => {
    const a = drawingArea("A4", 0)
    expect({ x: a.x, y: a.y, w: a.w, h: a.h }).toEqual({ x: 20, y: 15, w: 272, h: 135 })
  })

  it("A4 с таблицей высотой T: область от y=15 до y=205−T, высота 190−T", () => {
    const T = 90
    const a = drawingArea("A4", 0, T)
    expect(a.y).toBe(15)
    expect(a.y + a.h).toBe(205 - T)
    expect(a.h).toBe(190 - T)
  })

  it("легенда заканчивается там же, где область чертежа", () => {
    const T = 90
    const legend = legendArea("A4", 50, T)
    const area = drawingArea("A4", 50, T)
    expect(legend.y + legend.h).toBeCloseTo(area.y + area.h, 6)
  })

  it("высота полосы не влияет на ширину области", () => {
    expect(drawingArea("A4", 50, 90).w).toBe(drawingArea("A4", 50).w)
  })
})

describe("подбор масштаба с таблицей", () => {
  const big = (rooms: ExplicatedRoom[] | undefined): PlanPage => ({
    walls: [{ id: "w", a: { x: 0, y: 0 }, b: { x: 1500, y: 0 }, thicknessCm: 20, type: "brick" }, { id: "v", a: { x: 0, y: 0 }, b: { x: 0, y: 700 }, thicknessCm: 20, type: "brick" }],
    dimensions: [],
    doorways: [],
    ...(rooms ? { rooms } : null),
  })
  const order = (s: number | null): number => s ?? 0

  it("высокая таблица не позволяет более крупный масштаб, чем без неё", () => {
    const without = fitScale([big(undefined)], "A3")
    const withTable = fitScale([big(items(12))], "A3")
    expect(order(withTable)).toBeGreaterThanOrEqual(order(without))
  })

  it("высокая таблица на тесном формате делает масштаб мельче", () => {
    const without = fitScale([big(undefined)], "A4")
    const withTable = fitScale([big(items(12))], "A4")
    expect(order(withTable)).toBeGreaterThan(order(without))
  })

  it("таблица, не выше основной надписи, масштаб не меняет", () => {
    expect(fitScale([big(items(2))], "A4")).toBe(fitScale([big(undefined)], "A4"))
  })

  it("область чертежа одинакова на всех страницах: таблица на одной странице меняет масштаб всего документа", () => {
    const plain = big(undefined)
    const withTable = big(items(12))
    expect(fitScale([plain, withTable], "A4")).toBe(fitScale([withTable], "A4"))
    expect(order(fitScale([plain, withTable], "A4"))).toBeGreaterThan(order(fitScale([plain], "A4")))
  })
})
