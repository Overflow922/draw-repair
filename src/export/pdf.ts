import { jsPDF } from "jspdf"
import { doorLeaf, heightLabelAt, heightLabelSide, labelDirection } from "../doorway/doorway-layout"
import { dimGeometry, dimPointPoint } from "../geometry"
import { LABEL_FRAME_PAD, elementLabel, labelWidth } from "../doorway/element-label"
import { drawScene, PDF_METRICS } from "../render"
import { findRooms } from "../room-area"
import { cross, dot, sub } from "../wall-geometry"
import { DEFAULT_SCALE, PX_PER_CM, isDoor, isWindow } from "../types"
import type { Dimension, Unit, Wall, WallElement } from "../types"
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

export interface Placement {
  landscape: boolean
  mmPerCm: number
  offsetX: number
  offsetY: number
}

// doorways: подписи высоты выходят за стену со своей стороны (change add-doorway, design D10)
export function wallsBBox(walls: Wall[], dimensions: Dimension[] = [], padCm = 0, doorways: WallElement[] = [], scale: number = DEFAULT_SCALE): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const add = (x: number, y: number): void => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const w of walls) {
    add(w.a.x - w.thicknessCm / 2, w.a.y - w.thicknessCm / 2)
    add(w.b.x - w.thicknessCm / 2, w.b.y - w.thicknessCm / 2)
    add(w.a.x + w.thicknessCm / 2, w.a.y + w.thicknessCm / 2)
    add(w.b.x + w.thicknessCm / 2, w.b.y + w.thicknessCm / 2)
  }
  for (const dim of dimensions) {
    const from = dimPointPoint(dim.from, walls)
    const to = dimPointPoint(dim.to, walls)
    if (!from || !to) continue
    const g = dimGeometry(from, to, dim.offset)
    if (!g) continue
    add(g.p1.x, g.p1.y)
    add(g.p2.x, g.p2.y)
  }
  const rooms = doorways.length ? findRooms(walls) : []
  // полотно и дуга двери (add-door design D8): углы полотна, концы дуги и её крайние точки по осям в пределах пролёта
  for (const d of doorways) {
    if (!isDoor(d)) continue
    const l = doorLeaf(d, walls)
    if (!l) continue
    for (const c of [...l.leaf, l.arcFrom, l.arcTo]) add(c.x, c.y)
    const from = sub(l.arcFrom, l.hinge)
    const to = sub(l.arcTo, l.hinge)
    const start = Math.atan2(from.y, from.x)
    const span = Math.atan2(cross(from, to), dot(from, to))
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2
      const off = (((a - start) * Math.sign(span)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
      if (off <= Math.abs(span)) add(l.hinge.x + Math.cos(a) * l.radius, l.hinge.y + Math.sin(a) * l.radius)
    }
  }
  for (const d of doorways) {
    const side = heightLabelSide(d, walls, rooms)
    // подпись на листе — до 2·pad от грани с учётом полуширины текста (отступ подписи в render);
    // итоговое поле pad сверху
    const at = side === null ? null : heightLabelAt(d, walls, side, padCm * 2 + 1)
    if (!at) continue
    if (!isWindow(d) || side === null) {
      add(at.x, at.y)
      continue
    }
    // подпись окна длиннее и в рамке (add-window design D6): повёрнутый вдоль стены прямоугольник подписи
    // в см чертежа; ширина — оценка по кеглю, как в render
    const face = heightLabelAt(d, walls, side, 0)
    const dir = labelDirection(d, walls)
    if (!face || !dir) continue
    const cmPerMm = scale / 10
    const m = PDF_METRICS
    const hw = (labelWidth(elementLabel(d, "mm"), m.labelPx) / 2 + LABEL_FRAME_PAD * m.labelPx) * cmPerMm
    const hh = (m.labelPx / 2 + LABEL_FRAME_PAD * m.labelPx) * cmPerMm
    const len = Math.hypot(at.x - face.x, at.y - face.y)
    const n = { x: (at.x - face.x) / len, y: (at.y - face.y) / len }
    const c = { x: at.x + n.x * hh, y: at.y + n.y * hh }
    for (const sa of [-1, 1])
      for (const sb of [-1, 1]) add(c.x + sa * dir.x * hw + sb * n.x * hh, c.y + sa * dir.y * hw + sb * n.y * hh)
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX: minX - padCm, minY: minY - padCm, maxX: maxX + padCm, maxY: maxY + padCm }
}

function sheetMm(format: PageFormat, landscape: boolean): [number, number] {
  const [pw, ph] = PAGE_FORMATS_MM[format]
  return landscape ? [ph, pw] : [pw, ph]
}

export function fitsFormat(b: BBox, scale: number, format: PageFormat): boolean {
  const mmPerCm = 10 / scale
  const dw = (b.maxX - b.minX) * mmPerCm
  const dh = (b.maxY - b.minY) * mmPerCm
  const [w, h] = sheetMm(format, dw > dh)
  return dw <= w - 2 * PDF_MARGIN_MM && dh <= h - 2 * PDF_MARGIN_MM
}

export function availableFormats(walls: Wall[], dimensions: Dimension[] = [], scale: number = 100, doorways: WallElement[] = []): PageFormat[] {
  const all = Object.keys(PAGE_FORMATS_MM) as PageFormat[]
  if (walls.length === 0) return all
  const b = wallsBBox(walls, dimensions, 0.5 * scale, doorways, scale)
  return all.filter((f) => fitsFormat(b, scale, f))
}

export function placeOnPage(b: BBox, scale: number, format: PageFormat): Placement {
  const mmPerCm = 10 / scale
  const dw = (b.maxX - b.minX) * mmPerCm
  const dh = (b.maxY - b.minY) * mmPerCm
  const landscape = dw > dh
  const [w, h] = sheetMm(format, landscape)
  return {
    landscape,
    mmPerCm,
    offsetX: (w - 2 * PDF_MARGIN_MM - dw) / 2 + PDF_MARGIN_MM - b.minX * mmPerCm,
    offsetY: (h - 2 * PDF_MARGIN_MM - dh) / 2 + PDF_MARGIN_MM - b.minY * mmPerCm,
  }
}

export function pdfFileName(name: string, now: Date): string {
  const clean = name.replace(/[/\\:*?"<>|]/g, "").trim() || "Чертёж"
  const p = (n: number): string => String(n).padStart(2, "0")
  return `${clean}_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}.pdf`
}

export function buildPdf(
  walls: Wall[],
  dimensions: Dimension[],
  unit: Unit,
  scale: number,
  format: PageFormat,
  fontB64: string,
  doorways: WallElement[] = [],
): jsPDF {
  const placement = placeOnPage(wallsBBox(walls, dimensions, 0.5 * scale, doorways, scale), scale, format)
  const [pw, ph] = PAGE_FORMATS_MM[format]
  const doc = new jsPDF({ unit: "mm", format: [pw, ph], orientation: placement.landscape ? "landscape" : "portrait" })
  doc.addFileToVFS("PTSans.ttf", fontB64)
  doc.addFont("PTSans.ttf", "PTSans", "normal")
  const [w, h] = sheetMm(format, placement.landscape)
  drawScene(
    doc.context2d as unknown as CanvasRenderingContext2D,
    w,
    h,
    walls,
    null,
    unit,
    {
      zoom: placement.mmPerCm / PX_PER_CM,
      pan: { x: -placement.offsetX / placement.mmPerCm, y: -placement.offsetY / placement.mmPerCm },
    },
    [],
    { grid: false, metrics: PDF_METRICS, dimensions, doorways },
  )
  return doc
}

export function exportDrawing(
  walls: Wall[],
  dimensions: Dimension[],
  unit: Unit,
  scale: number,
  format: PageFormat,
  name: string,
  doorways: WallElement[] = [],
): void {
  const doc = buildPdf(walls, dimensions, unit, scale, format, FONT_B64, doorways)
  const url = URL.createObjectURL(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = pdfFileName(name, new Date())
  a.click()
  URL.revokeObjectURL(url)
}
