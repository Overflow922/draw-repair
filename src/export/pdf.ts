import { jsPDF } from "jspdf"
import { drawScene, PDF_METRICS } from "../render"
import { PX_PER_CM } from "../types"
import type { Unit, Wall } from "../types"
import { FONT_B64 } from "./font"

export type PageFormat = "A4" | "A3" | "A2" | "A1" | "A0"

export const PAGE_FORMATS_MM: Record<PageFormat, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
}

export const PDF_MARGIN_MM = 10

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Fit {
  landscape: boolean
  scale: number
  offsetX: number
  offsetY: number
}

export function wallsBBox(walls: Wall[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const w of walls) {
    minX = Math.min(minX, w.a.x - w.thicknessCm / 2, w.b.x - w.thicknessCm / 2)
    minY = Math.min(minY, w.a.y - w.thicknessCm / 2, w.b.y - w.thicknessCm / 2)
    maxX = Math.max(maxX, w.a.x + w.thicknessCm / 2, w.b.x + w.thicknessCm / 2)
    maxY = Math.max(maxY, w.a.y + w.thicknessCm / 2, w.b.y + w.thicknessCm / 2)
  }
  return { minX, minY, maxX, maxY }
}

export function fitToPage(b: BBox, pageW: number, pageH: number, margin: number): Fit {
  const bw = Math.max(b.maxX - b.minX, 1)
  const bh = Math.max(b.maxY - b.minY, 1)
  const landscape = bw > bh
  const w = landscape ? pageH : pageW
  const h = landscape ? pageW : pageH
  const cw = w - 2 * margin
  const ch = h - 2 * margin
  const scale = Math.min(cw / bw, ch / bh)
  return {
    landscape,
    scale,
    offsetX: margin + (cw - bw * scale) / 2 - b.minX * scale,
    offsetY: margin + (ch - bh * scale) / 2 - b.minY * scale,
  }
}

export function pdfFileName(name: string, now: Date): string {
  const clean = name.replace(/[/\\:*?"<>|]/g, "").trim() || "Чертёж"
  const p = (n: number): string => String(n).padStart(2, "0")
  return `${clean}_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}.pdf`
}

export function buildPdf(walls: Wall[], unit: Unit, format: PageFormat, fontB64: string): jsPDF {
  const [pw, ph] = PAGE_FORMATS_MM[format]
  const fit = fitToPage(wallsBBox(walls), pw, ph, PDF_MARGIN_MM)
  const doc = new jsPDF({ unit: "mm", format: [pw, ph], orientation: fit.landscape ? "landscape" : "portrait" })
  doc.addFileToVFS("PTSans.ttf", fontB64)
  doc.addFont("PTSans.ttf", "PTSans", "normal")
  const w = fit.landscape ? ph : pw
  const h = fit.landscape ? pw : ph
  drawScene(
    doc.context2d as unknown as CanvasRenderingContext2D,
    w,
    h,
    walls,
    null,
    unit,
    {
      zoom: fit.scale / PX_PER_CM,
      pan: { x: -fit.offsetX / fit.scale, y: -fit.offsetY / fit.scale },
    },
    null,
    { grid: false, metrics: PDF_METRICS },
  )
  return doc
}

export function exportDrawing(walls: Wall[], unit: Unit, format: PageFormat, name: string): void {
  const doc = buildPdf(walls, unit, format, FONT_B64)
  const url = URL.createObjectURL(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = pdfFileName(name, new Date())
  a.click()
  URL.revokeObjectURL(url)
}
