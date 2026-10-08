import type { jsPDF } from "jspdf"
import type { PageFormat } from "./page-format"
import { FRAME_LINE_MM, GRID_LINE_MM, frameRect, titleBlockCells, titleBlockGrid, titleBlockRect, titleBlockTexts } from "./sheet-layout"
import type { Rect, TitleBlockContent } from "./sheet-layout"

// Рисование рамки листа и основной надписи на странице jsPDF (мм). Геометрия — в sheet-layout.

const FONT = "PTSans"
const NAME_FONT_MM = 5
const CONTENT_FONT_MM = 3.5
const CAPTION_FONT_MM = 2.5
const MIN_FONT_MM = 1.5
const TEXT_PAD_MM = 0.5
// высота строки графы 13, в которую пишется дата (первая строка подписной части)
const DATE_ROW_MM = 5
const ELLIPSIS = "..."

interface FittedText {
  text: string
  fontMm: number
}

// Текст по умолчанию в стандартном кегле; если не помещается в ширину — кегль уменьшается до MIN_FONT_MM,
// затем текст сокращается с многоточием.
function fitText(doc: jsPDF, text: string, boxWidthMm: number, standardMm: number): FittedText {
  const k = doc.internal.scaleFactor
  const widthAt = (s: string, fontMm: number): number => {
    doc.setFontSize(fontMm * k)
    return doc.getTextWidth(s)
  }
  const maxWidth = boxWidthMm - 2 * TEXT_PAD_MM
  const natural = widthAt(text, standardMm)
  if (natural <= maxWidth) return { text, fontMm: standardMm }

  let fontMm = Math.max(MIN_FONT_MM, (standardMm * maxWidth) / natural)
  while (fontMm > MIN_FONT_MM && widthAt(text, fontMm) > maxWidth) fontMm *= 0.98
  fontMm = Math.max(MIN_FONT_MM, fontMm)
  if (widthAt(text, fontMm) <= maxWidth) return { text, fontMm }

  let length = text.length
  while (length > 1 && widthAt(text.slice(0, length) + ELLIPSIS, MIN_FONT_MM) > maxWidth) length--
  return { text: text.slice(0, length) + ELLIPSIS, fontMm: MIN_FONT_MM }
}

function drawCentered(doc: jsPDF, text: string, box: Rect, standardMm: number): void {
  const fitted = fitText(doc, text, box.w, standardMm)
  doc.setFontSize(fitted.fontMm * doc.internal.scaleFactor)
  // базовая линия: середина графы плюс половина высоты прописных букв
  doc.text(fitted.text, box.x + box.w / 2, box.y + box.h / 2 + 0.35 * fitted.fontMm, { align: "center" })
}

export function drawSheet(doc: jsPDF, format: PageFormat, content: TitleBlockContent): void {
  const frame = frameRect(format)
  const block = titleBlockRect(format)

  doc.setDrawColor(0, 0, 0)
  doc.setTextColor(0, 0, 0)
  doc.setFont(FONT, "normal")

  doc.setLineWidth(FRAME_LINE_MM)
  doc.rect(frame.x, frame.y, frame.w, frame.h, "S")
  doc.rect(block.x, block.y, block.w, block.h, "S")

  doc.setLineWidth(GRID_LINE_MM)
  for (const l of titleBlockGrid()) doc.line(block.x + l.x1, block.y + l.y1, block.x + l.x2, block.y + l.y2)

  const cells = titleBlockCells()
  const inBlock = (c: Rect): Rect => ({ x: block.x + c.x, y: block.y + c.y, w: c.w, h: c.h })

  for (const c of cells) {
    if (c.label !== undefined) drawCentered(doc, c.label, inBlock(c), CAPTION_FONT_MM)
  }
  for (const t of titleBlockTexts(content)) {
    const c = cells.find((cell) => cell.id === t.cellId)
    if (!c) continue
    const rect = t.cellId === "13" ? { ...c, h: DATE_ROW_MM } : c
    drawCentered(doc, t.text, inBlock(rect), t.cellId === "1" ? NAME_FONT_MM : CONTENT_FONT_MM)
  }
}
