import { describe, expect, it } from "vitest"
import type { PageFormat } from "./pdf"
import { drawingArea, frameRect, sheetSizeMm, titleBlockCells, titleBlockRect, titleBlockTexts } from "./sheet-layout"
import type { TitleCell } from "./sheet-layout"

// change pdf-frame-title-block: геометрия рамки, основной надписи, области чертежа и содержимое граф.
// Все размеры — абсолютные миллиметры на бумаге (design D7).

const FORMATS: PageFormat[] = ["A4", "A3", "A2", "A1", "A0"]
const LANDSCAPE: Record<PageFormat, { w: number; h: number }> = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
  A2: { w: 594, h: 420 },
  A1: { w: 841, h: 594 },
  A0: { w: 1189, h: 841 },
}

const cells = titleBlockCells()
const byId = (id: string): TitleCell => {
  const cell = cells.find((c) => c.id === id)
  if (!cell) throw new Error(`нет графы ${id}`)
  return cell
}
const rectOf = (c: TitleCell): { x: number; y: number; w: number; h: number } => ({ x: c.x, y: c.y, w: c.w, h: c.h })
const captionRect = (label: string, y: number): { x: number; y: number; w: number; h: number } => {
  const found = cells.filter((c) => c.label === label && c.y === y)
  const [only] = found
  if (found.length !== 1 || !only) throw new Error(`заголовок «${label}» на y=${y}: найдено ${found.length}`)
  return rectOf(only)
}

describe("sheetSizeMm: страница всегда альбомная", () => {
  it.each(FORMATS)("OR: %s — ширина больше высоты, размеры ISO", (f) => {
    expect(sheetSizeMm(f)).toEqual(LANDSCAPE[f])
  })
})

describe("рамка листа", () => {
  it("FR-1: A4 альбомная — x 20, y 5, 272×200 мм", () => {
    expect(frameRect("A4")).toEqual({ x: 20, y: 5, w: 272, h: 200 })
  })

  it.each(FORMATS)("FR-2: %s — отступы 20 слева и 5 с остальных сторон", (f) => {
    const { w, h } = LANDSCAPE[f]
    expect(frameRect(f)).toEqual({ x: 20, y: 5, w: w - 25, h: h - 10 })
  })
})

describe("основная надпись: положение и размер", () => {
  it("TB-1: A4 — x 107, y 150, 185×55 мм", () => {
    expect(titleBlockRect("A4")).toEqual({ x: 107, y: 150, w: 185, h: 55 })
  })

  it.each(FORMATS)("TB-2: %s — 185×55, правый и нижний края совпадают с рамкой", (f) => {
    const tb = titleBlockRect(f)
    const fr = frameRect(f)
    expect(tb.w).toBe(185)
    expect(tb.h).toBe(55)
    expect(tb.x + tb.w).toBe(fr.x + fr.w)
    expect(tb.y + tb.h).toBe(fr.y + fr.h)
  })
})

describe("область чертежа", () => {
  it("DA-1: A4 — x 20, y 5, 272×145 мм", () => {
    expect(drawingArea("A4")).toEqual({ x: 20, y: 5, w: 272, h: 145 })
  })

  it.each(["A3", "A2", "A1", "A0"] as const)("DA-2: %s — ширина W−25, высота H−65, низ области = верх надписи", (f) => {
    const { w, h } = LANDSCAPE[f]
    const area = drawingArea(f)
    expect(area).toEqual({ x: 20, y: 5, w: w - 25, h: h - 65 })
    expect(area.y + area.h).toBe(titleBlockRect(f).y)
    expect(area.x + area.w).toBe(frameRect(f).x + frameRect(f).w)
  })
})

describe("графы основной надписи", () => {
  it("TB-5: графа 1 — x 65–185, y 0–15", () => {
    expect(rectOf(byId("1"))).toEqual({ x: 65, y: 0, w: 120, h: 15 })
  })

  it("TB-6: графы 5, 23 и 9", () => {
    expect(rectOf(byId("5"))).toEqual({ x: 65, y: 15, w: 70, h: 25 })
    expect(rectOf(byId("23"))).toEqual({ x: 65, y: 40, w: 70, h: 15 })
    expect(rectOf(byId("9"))).toEqual({ x: 135, y: 40, w: 50, h: 15 })
  })

  it("TB-7: блок стадии — графы 6, 24, 25, 7 и 8", () => {
    expect(rectOf(byId("6"))).toEqual({ x: 135, y: 20, w: 15, h: 15 })
    expect(rectOf(byId("24"))).toEqual({ x: 150, y: 20, w: 15, h: 15 })
    expect(rectOf(byId("25"))).toEqual({ x: 165, y: 20, w: 20, h: 15 })
    expect(rectOf(byId("7"))).toEqual({ x: 135, y: 35, w: 20, h: 5 })
    expect(rectOf(byId("8"))).toEqual({ x: 155, y: 35, w: 30, h: 5 })
  })

  it("TB-7: заголовки «Стадия», «Масса», «Масштаб» — строка y 15–20 над графами 6, 24, 25", () => {
    expect(captionRect("Стадия", 15)).toEqual({ x: 135, y: 15, w: 15, h: 5 })
    expect(captionRect("Масса", 15)).toEqual({ x: 150, y: 15, w: 15, h: 5 })
    expect(captionRect("Масштаб", 15)).toEqual({ x: 165, y: 15, w: 20, h: 5 })
  })

  it("TB-7: заголовки «Лист» (x 135–155) и «Листов» (x 155–185) — строка y 35–40 блока стадии", () => {
    expect(captionRect("Лист", 35)).toEqual({ x: 135, y: 35, w: 20, h: 5 })
    expect(captionRect("Листов", 35)).toEqual({ x: 155, y: 35, w: 30, h: 5 })
  })

  it("TB-8: подписная часть — графы 10, 11, 12, 13 в строках y 20–55", () => {
    expect(rectOf(byId("10"))).toEqual({ x: 0, y: 20, w: 20, h: 35 })
    expect(rectOf(byId("11"))).toEqual({ x: 20, y: 20, w: 20, h: 35 })
    expect(rectOf(byId("12"))).toEqual({ x: 40, y: 20, w: 15, h: 35 })
    expect(rectOf(byId("13"))).toEqual({ x: 55, y: 20, w: 10, h: 35 })
  })

  it("TB-8: заголовки «Изм.», «Кол.», «Лист», «№док.», «Подп.», «Дата» — строка y 15–20, ширины 10/10/10/10/15/10", () => {
    const expected: [string, number, number][] = [
      ["Изм.", 0, 10],
      ["Кол.", 10, 10],
      ["Лист", 20, 10],
      ["№док.", 30, 10],
      ["Подп.", 40, 15],
      ["Дата", 55, 10],
    ]
    for (const [label, x, w] of expected) expect(captionRect(label, 15), label).toEqual({ x, y: 15, w, h: 5 })
  })

  it("TB-5: набор подписей граф — ровно 11 заголовков из спецификации", () => {
    const labels = cells.flatMap((c) => (c.label === undefined ? [] : [c.label])).sort()
    const expected = ["Изм.", "Кол.", "Лист", "№док.", "Подп.", "Дата", "Стадия", "Масса", "Масштаб", "Лист", "Листов"].sort()
    expect(labels).toEqual(expected)
  })

  it("TB-5: присутствуют все номерные графы 1, 5, 6, 7, 8, 9, 10–13, 23, 24, 25", () => {
    const ids = cells.filter((c) => /^\d+$/.test(c.id)).map((c) => c.id)
    expect([...ids].sort()).toEqual(["1", "10", "11", "12", "13", "23", "24", "25", "5", "6", "7", "8", "9"].sort())
  })

  it("инвариант: номерные графы не пересекаются и лежат внутри 185×55", () => {
    const numbered = cells.filter((c) => /^\d+$/.test(c.id))
    for (const c of numbered) {
      expect(c.x, c.id).toBeGreaterThanOrEqual(0)
      expect(c.y, c.id).toBeGreaterThanOrEqual(0)
      expect(c.x + c.w, c.id).toBeLessThanOrEqual(185)
      expect(c.y + c.h, c.id).toBeLessThanOrEqual(55)
    }
    for (let i = 0; i < numbered.length; i++) {
      for (let j = i + 1; j < numbered.length; j++) {
        const a = numbered[i]
        const b = numbered[j]
        if (!a || !b) continue
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap, `${a.id} × ${b.id}`).toBe(false)
      }
    }
  })

  it("инвариант: графы правой части вместе с заголовками блока стадии без зазоров покрывают 120×55", () => {
    const rightIds = ["1", "5", "6", "24", "25", "7", "8", "23", "9"]
    const stageCaptions = ["Стадия", "Масса", "Масштаб"]
    const numbered = rightIds.reduce((s, id) => s + byId(id).w * byId(id).h, 0)
    const captions = stageCaptions.reduce((s, label) => s + captionRect(label, 15).w * 5, 0)
    expect(numbered + captions).toBe(120 * 55)
  })
})

describe("содержимое основной надписи", () => {
  const sep = new Date(2026, 8, 5, 14, 32, 7)
  const sorted = (xs: { cellId: string; text: string }[]): { cellId: string; text: string }[] =>
    [...xs].sort((a, b) => a.cellId.localeCompare(b.cellId))

  it("FL-1: имя, «Р», масштаб и месяц-год экспорта — и ничего больше", () => {
    const texts = titleBlockTexts({ name: "Чертёж 1", scale: 100, date: sep })
    expect(sorted(texts)).toEqual(
      sorted([
        { cellId: "1", text: "Чертёж 1" },
        { cellId: "6", text: "Р" },
        { cellId: "25", text: "1:100" },
        { cellId: "13", text: "09.26" },
      ]),
    )
  })

  it("FL-2: масштаб 1:50 пишется как «1:50»", () => {
    const t = titleBlockTexts({ name: "x", scale: 50, date: sep }).find((e) => e.cellId === "25")
    expect(t?.text).toBe("1:50")
  })

  it.each([
    [new Date(2027, 0, 15), "01.27"],
    [new Date(2026, 11, 31, 23, 59, 59), "12.26"],
    [new Date(2099, 4, 1), "05.99"],
    [new Date(2100, 5, 1), "06.00"],
  ])("FL-2: дата %s — «%s» (месяц с нулём, год двумя цифрами)", (date, expected) => {
    const t = titleBlockTexts({ name: "x", scale: 100, date }).find((e) => e.cellId === "13")
    expect(t?.text).toBe(expected)
  })

  it("FL-3: графа 5 (наименование страницы) никогда не заполняется", () => {
    for (const name of ["Чертёж 1", "", "5", "очень длинное имя чертежа ".repeat(10)]) {
      const ids = titleBlockTexts({ name, scale: 100, date: sep }).map((e) => e.cellId)
      expect(ids, name).not.toContain("5")
    }
  })

  it("FL-3: заполняются только графы 1, 6, 13, 25", () => {
    const ids = titleBlockTexts({ name: "Чертёж 1", scale: 20, date: sep }).map((e) => e.cellId)
    expect([...ids].sort()).toEqual(["1", "13", "25", "6"])
  })

  it("FL-6: имя передаётся как есть, без санитизации имени файла", () => {
    const t = titleBlockTexts({ name: 'a/b:c*"d', scale: 100, date: sep }).find((e) => e.cellId === "1")
    expect(t?.text).toBe('a/b:c*"d')
  })
})
