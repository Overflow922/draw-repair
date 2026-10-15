import type { jsPDF } from "jspdf"
import {
  NOTES_FONT_MM,
  NOTES_LINE_PITCH_MM,
  NOTES_NUMBER_X_MM,
  NOTES_TEXT_X_MM,
  NOTES_TITLE,
  NOTES_TITLE_ROW_MM,
  NOTES_TOP_PAD_MM,
  notesLayoutFor,
  notesRect,
} from "./notes"
import type { PageFormat } from "./page-format"
import { GRID_LINE_MM } from "./sheet-layout"

// Рисование блока примечаний на странице jsPDF (change add-plan-notes, design D5): заголовок «Примечание:» с подчёркиванием по
// ширине слова, ниже пронумерованные пункты. Блок без рамки; всё в миллиметрах листа.

const FONT = "PTSans"
const BASELINE_EM = 0.35 // смещение базовой линии от середины строки: доля кегля (как в основной надписи)
const UNDERLINE_GAP_MM = 1

export function drawNotes(doc: jsPDF, format: PageFormat, items: readonly string[]): void {
  const layout = notesLayoutFor(items, format)
  const rect = notesRect(format, layout)
  const baseline = (centerY: number): number => centerY + BASELINE_EM * NOTES_FONT_MM

  doc.setFont(FONT, "normal")
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(0, 0, 0)
  doc.setFontSize(NOTES_FONT_MM * doc.internal.scaleFactor)

  // заголовок и подчёркивание по ширине слова
  const titleBase = baseline(rect.y + NOTES_TOP_PAD_MM + NOTES_TITLE_ROW_MM / 2)
  const titleX = rect.x + NOTES_NUMBER_X_MM
  doc.text(NOTES_TITLE, titleX, titleBase)
  doc.setLineWidth(GRID_LINE_MM)
  doc.line(titleX, titleBase + UNDERLINE_GAP_MM, titleX + doc.getTextWidth(NOTES_TITLE), titleBase + UNDERLINE_GAP_MM)

  for (const line of layout.lines) {
    const base = baseline(rect.y + line.y + NOTES_LINE_PITCH_MM / 2)
    if (line.number !== undefined) doc.text(line.number, rect.x + NOTES_NUMBER_X_MM, base)
    doc.text(line.text, rect.x + NOTES_TEXT_X_MM, base)
  }
}
