import type { PageFormat } from "./page-format"
import type { PlanPage } from "./pdf"
import { titleBlockRect } from "./sheet-layout"
import type { Rect } from "./sheet-layout"
import { wrapText } from "./wrap-text"

// Блок примечаний плана на странице PDF (change add-plan-notes, design D5, D6): раскладка в абсолютных миллиметрах листа,
// не зависит от масштаба чертежа. Блок стоит над основной надписью, его ширина — ширина надписи, левее надписи он не заходит.

export const NOTES_TITLE = "Примечание:"
export const NOTES_FONT_MM = 3.5
export const NOTES_LINE_PITCH_MM = 4.5
export const NOTES_TOP_PAD_MM = 3
export const NOTES_TITLE_ROW_MM = 5
export const NOTES_BOTTOM_PAD_MM = 2
export const NOTES_NUMBER_X_MM = 3
export const NOTES_TEXT_X_MM = 12
export const NOTES_RIGHT_PAD_MM = 3

export interface NotesLine {
  number?: string // «N.» только у первой строки пункта
  text: string
  y: number // верх строки от верха блока, мм
}

export interface NotesLayout {
  lines: NotesLine[]
  heightMm: number
}

// ширина текста пункта: от отступа текста до правого отступа блока
const textWidthMm = (blockWidthMm: number): number => blockWidthMm - NOTES_TEXT_X_MM - NOTES_RIGHT_PAD_MM

export function notesLayout(items: readonly string[], blockWidthMm: number): NotesLayout {
  const lines: NotesLine[] = []
  let y = NOTES_TOP_PAD_MM + NOTES_TITLE_ROW_MM
  items.forEach((item, i) => {
    wrapText(item, textWidthMm(blockWidthMm), NOTES_FONT_MM).forEach((text, j) => {
      lines.push(j === 0 ? { number: `${i + 1}.`, text, y } : { text, y })
      y += NOTES_LINE_PITCH_MM
    })
  })
  return { lines, heightMm: y + NOTES_BOTTOM_PAD_MM }
}

// блок страницы: только у страницы с непустым списком примечаний
export const pageNotes = (page: PlanPage): readonly string[] | null => (page.notes !== undefined && page.notes.length > 0 ? page.notes : null)

// раскладка блока для основной надписи формата
export const notesLayoutFor = (items: readonly string[], format: PageFormat): NotesLayout => notesLayout(items, titleBlockRect(format).w)

// прямоугольник блока: над основной надписью, те же левая и правая стороны
export function notesRect(format: PageFormat, layout: NotesLayout): Rect {
  const title = titleBlockRect(format)
  return { x: title.x, y: title.y - layout.heightMm, w: title.w, h: layout.heightMm }
}

// высота самого высокого блока примечаний среди страниц (0, если блоков нет)
export function maxNotesHeightMm(pages: readonly PlanPage[], format: PageFormat): number {
  return Math.max(0, ...pages.map((p) => pageNotes(p)).flatMap((n) => (n === null ? [] : [notesLayoutFor(n, format).heightMm])))
}
