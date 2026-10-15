import { CHAR_WIDTH } from "../doorway/element-label"
import { explicationTable } from "../room-explication"
import type { ExplicationTable } from "../room-explication"
import type { PlanPage } from "./pdf"
import { frameRect, titleBlockRect } from "./sheet-layout"
import type { PageFormat } from "./page-format"
import type { Rect } from "./sheet-layout"

// Таблица экспликации помещений на странице «Монтаж» (change add-room-explication, design D6, D7): раскладка в абсолютных
// миллиметрах листа, не зависит от масштаба чертежа. Таблица стоит в левом нижнем углу рамки и не касается основной надписи.

export const EXPLICATION_TITLE = "Экспликация помещений"
export const EXPLICATION_FONT_MM = 3.5
export const EXPLICATION_TITLE_FONT_MM = 5
export const EXPLICATION_TITLE_H_MM = 10
export const EXPLICATION_HEADER_H_MM = 12
export const EXPLICATION_ROW_MIN_H_MM = 8
export const EXPLICATION_LINE_PITCH_MM = 4.5
export const EXPLICATION_CELL_PAD_MM = 2
// ширины столбцов «№», «Наименование», «Площадь, м²»: на листе A4 между таблицей и основной надписью остаётся зазор
export const EXPLICATION_COLS_MM = [10, 45, 20] as const
export const EXPLICATION_W_MM = EXPLICATION_COLS_MM[0] + EXPLICATION_COLS_MM[1] + EXPLICATION_COLS_MM[2]
export const EXPLICATION_AREA_HEADER = ["Площадь,", "м²"] as const
export const EXPLICATION_TOTAL_LABEL = "Общая"

const textWidthMm = (text: string): number => text.length * EXPLICATION_FONT_MM * CHAR_WIDTH

// перенос названия по пробелам в ширину ячейки; слово, не помещающееся целиком, разбивается по символам
export function wrapName(name: string, widthMm: number = EXPLICATION_COLS_MM[1] - 2 * EXPLICATION_CELL_PAD_MM): string[] {
  const lines: string[] = []
  let current = ""
  const push = (): void => {
    if (current !== "") lines.push(current)
    current = ""
  }
  for (const word of name.split(/\s+/).filter((w) => w !== "")) {
    let rest = word
    while (textWidthMm(rest) > widthMm) {
      let cut = rest.length - 1
      while (cut > 1 && textWidthMm(rest.slice(0, cut)) > widthMm) cut--
      if (current !== "") push()
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    if (current === "") current = rest
    else if (textWidthMm(`${current} ${rest}`) <= widthMm) current = `${current} ${rest}`
    else {
      push()
      current = rest
    }
  }
  push()
  return lines.length > 0 ? lines : [""]
}

export interface ExplicationRowLayout {
  number: string
  lines: string[]
  area: string
  y: number // от верха строк данных, мм
  h: number
}

export interface ExplicationLayout {
  rows: ExplicationRowLayout[]
  total: { y: number; h: number; area: string }
  bodyH: number // шапка, строки и итог
  heightMm: number // заголовок и тело
}

export function explicationLayout(table: ExplicationTable): ExplicationLayout {
  let y = EXPLICATION_HEADER_H_MM
  const rows = table.rows.map((r): ExplicationRowLayout => {
    const lines = wrapName(r.name)
    const h = Math.max(EXPLICATION_ROW_MIN_H_MM, lines.length * EXPLICATION_LINE_PITCH_MM + 3.5)
    const row = { number: r.number, lines, area: r.area, y, h }
    y += h
    return row
  })
  const total = { y, h: EXPLICATION_ROW_MIN_H_MM, area: table.total }
  const bodyH = y + total.h
  return { rows, total, bodyH, heightMm: EXPLICATION_TITLE_H_MM + bodyH }
}

// таблица страницы: только у страницы со списком помещений экспликации (план «Монтаж»), не пустого
export const pageExplication = (page: PlanPage): ExplicationTable | null =>
  page.rooms !== undefined && page.rooms.length > 0 ? explicationTable(page.rooms) : null

// высота нижней полосы листа — одна на документ: наибольшая из высот основной надписи и таблицы экспликации любой страницы
export function bottomBandMm(pages: readonly PlanPage[], format: PageFormat): number {
  const title = titleBlockRect(format).h
  const tables = pages.map((p) => pageExplication(p)).flatMap((t) => (t === null ? [] : [explicationLayout(t).heightMm]))
  return Math.max(title, ...tables)
}

// прямоугольник таблицы вместе с заголовком: левый нижний угол рамки
export function explicationRect(format: PageFormat, layout: ExplicationLayout): Rect {
  const frame = frameRect(format)
  return { x: frame.x, y: frame.y + frame.h - layout.heightMm, w: EXPLICATION_W_MM, h: layout.heightMm }
}
