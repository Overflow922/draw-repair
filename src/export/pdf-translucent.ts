import { GState } from "jspdf"
import type { jsPDF } from "jspdf"
import type { Translucent } from "../ceiling/ceiling-render"

// Рисование с прозрачностью в PDF (change add-ceiling-plan, design D7): контекст jsPDF не выводит ни globalAlpha, ни альфу rgba,
// поэтому рисунок обрамляется состоянием графики документа с непрозрачностью заливки и обводки
export const pdfTranslucent =
  (doc: jsPDF): Translucent =>
  (alpha, paint) => {
    doc.saveGraphicsState()
    doc.setGState(new GState({ opacity: alpha, "stroke-opacity": alpha }))
    paint()
    doc.restoreGraphicsState()
  }
