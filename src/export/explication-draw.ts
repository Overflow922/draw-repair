import type { jsPDF } from "jspdf"
import type { ExplicationTable } from "../room-explication"
import {
  EXPLICATION_AREA_HEADER,
  EXPLICATION_CELL_PAD_MM,
  EXPLICATION_COLS_MM,
  EXPLICATION_FONT_MM,
  EXPLICATION_HEADER_H_MM,
  EXPLICATION_LINE_PITCH_MM,
  EXPLICATION_TITLE,
  EXPLICATION_TITLE_FONT_MM,
  EXPLICATION_TITLE_H_MM,
  EXPLICATION_TOTAL_LABEL,
  EXPLICATION_W_MM,
  explicationLayout,
  explicationRect,
} from "./explication"
import type { PageFormat } from "./page-format"
import { FRAME_LINE_MM, GRID_LINE_MM } from "./sheet-layout"

// Рисование таблицы экспликации помещений на странице jsPDF (change add-room-explication, design D6): заголовок с подчёркиванием
// над таблицей, шапка «№ / Наименование / Площадь, м²», строки помещений и итоговая строка «Общая». Всё в миллиметрах листа.

const FONT = "PTSans"
const BASELINE_EM = 0.35 // смещение базовой линии от середины строки: доля кегля (как в основной надписи)
const OUTER_LINE_MM = FRAME_LINE_MM / 2

export function drawExplication(doc: jsPDF, format: PageFormat, table: ExplicationTable): void {
  const layout = explicationLayout(table)
  const rect = explicationRect(format, layout)
  const top = rect.y + EXPLICATION_TITLE_H_MM
  const [wNumber, wName] = EXPLICATION_COLS_MM
  const x1 = rect.x + wNumber
  const x2 = x1 + wName
  const k = doc.internal.scaleFactor

  doc.setFont(FONT, "normal")
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(0, 0, 0)

  // заголовок и его подчёркивание
  doc.setFontSize(EXPLICATION_TITLE_FONT_MM * k)
  const titleBase = rect.y + EXPLICATION_TITLE_H_MM - 2.5
  doc.text(EXPLICATION_TITLE, rect.x + EXPLICATION_CELL_PAD_MM, titleBase)
  doc.setLineWidth(GRID_LINE_MM)
  doc.line(rect.x + EXPLICATION_CELL_PAD_MM, titleBase + 1, rect.x + EXPLICATION_CELL_PAD_MM + doc.getTextWidth(EXPLICATION_TITLE), titleBase + 1)

  // линии: рамка таблицы, строки, разделители столбцов (между «№» и названием итог не пересекают)
  doc.setLineWidth(OUTER_LINE_MM)
  doc.rect(rect.x, top, EXPLICATION_W_MM, layout.bodyH, "S")
  doc.setLineWidth(GRID_LINE_MM)
  doc.line(rect.x, top + EXPLICATION_HEADER_H_MM, rect.x + EXPLICATION_W_MM, top + EXPLICATION_HEADER_H_MM)
  for (const r of layout.rows) doc.line(rect.x, top + r.y + r.h, rect.x + EXPLICATION_W_MM, top + r.y + r.h)
  doc.line(x1, top, x1, top + layout.total.y)
  doc.line(x2, top, x2, top + layout.bodyH)

  doc.setFontSize(EXPLICATION_FONT_MM * k)
  const baseline = (centerY: number): number => centerY + BASELINE_EM * EXPLICATION_FONT_MM
  const center = (text: string, cx: number, cy: number): void => {
    doc.text(text, cx, baseline(cy), { align: "center" })
  }

  // шапка
  const headerMid = top + EXPLICATION_HEADER_H_MM / 2
  center("№", rect.x + wNumber / 2, headerMid)
  center("Наименование", x1 + wName / 2, headerMid)
  const areaX = x2 + EXPLICATION_COLS_MM[2] / 2
  EXPLICATION_AREA_HEADER.forEach((line, i) => center(line, areaX, headerMid + (i - 0.5) * EXPLICATION_LINE_PITCH_MM))

  // строки помещений
  for (const r of layout.rows) {
    const mid = top + r.y + r.h / 2
    center(r.number, rect.x + wNumber / 2, mid)
    r.lines.forEach((line, i) => doc.text(line, x1 + EXPLICATION_CELL_PAD_MM, baseline(mid + (i - (r.lines.length - 1) / 2) * EXPLICATION_LINE_PITCH_MM)))
    center(r.area, areaX, mid)
  }

  // итог
  const totalMid = top + layout.total.y + layout.total.h / 2
  doc.text(EXPLICATION_TOTAL_LABEL, rect.x + EXPLICATION_CELL_PAD_MM, baseline(totalMid))
  center(layout.total.area, areaX, totalMid)
}
