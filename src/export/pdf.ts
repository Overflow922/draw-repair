import { jsPDF } from "jspdf"
import { doorLeaf, heightLabelAt, heightLabelSide, labelDirection } from "../doorway/doorway-layout"
import { dimGeometry, dimPointPoint } from "../geometry"
import { LABEL_FRAME_PAD, elementLabel, labelWidth } from "../doorway/element-label"
import { drawScene, PDF_METRICS } from "../render"
import { demolitionColor, drawDemolitionScene } from "../demolition/demolition-render"
import { markDimensionExtent } from "../demolition/mark-dimensions"
import { effectiveMarks } from "../demolition/marks"
import type { ResolvedMark } from "../demolition/marks"
import { PLANS } from "../plans"
import { findRooms } from "../room-area"
import { LIGHT_PALETTE } from "../theme"
import { cross, dot, sub } from "../wall-geometry"
import { DEFAULT_SCALE, PX_PER_CM, isDoor, isWindow } from "../types"
import type { Dimension, Drawing, Point, Unit, Wall, WallElement } from "../types"
import { FONT_B64 } from "./font"
import { PAGE_FORMATS_MM } from "./page-format"
import type { PageFormat } from "./page-format"
import { drawSheet } from "./sheet-draw"
import { drawingArea, sheetSizeMm } from "./sheet-layout"

export { PAGE_FORMATS_MM }
export type { PageFormat }

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Placement {
  landscape: true
  mmPerCm: number
  offsetX: number
  offsetY: number
}

// doorways: подписи высоты выходят за стену со своей стороны (change add-doorway, design D10)
export function wallsBBox(
  walls: Wall[],
  dimensions: Dimension[] = [],
  padCm = 0,
  doorways: WallElement[] = [],
  scale: number = DEFAULT_SCALE,
  extra: readonly Point[] = [],
): BBox {
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
  for (const p of extra) add(p.x, p.y)
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

export function fitsFormat(b: BBox, scale: number, format: PageFormat): boolean {
  const mmPerCm = 10 / scale
  const area = drawingArea(format)
  return (b.maxX - b.minX) * mmPerCm <= area.w && (b.maxY - b.minY) * mmPerCm <= area.h
}

// Страница PDF — содержимое одного плана чертежа (change drawing-plans, design D5)
export interface PlanPage {
  walls: Wall[]
  dimensions: Dimension[]
  doorways: WallElement[]
  // действующие пометки сноса: страница плана «Демонтаж» (change demolition-plan, design D9); у остальных страниц нет
  demolition?: readonly ResolvedMark[]
}

// страницы чертежа: по одной на план каталога в порядке каталога; объекты обмерочного плана лежат в прежних полях
// чертежа (design D1), страница демонтажа — подложка из тех же стен без размеров, видимые элементы и пометки
export function pagesOf(drawing: Drawing): PlanPage[] {
  const doorways = drawing.doorways ?? []
  const marks = effectiveMarks(drawing.demolition ?? [], drawing.walls)
  return PLANS.map(
    (plan): PlanPage =>
      plan.id === "demolition"
        ? { walls: drawing.walls, dimensions: [], doorways, demolition: marks }
        : { walls: drawing.walls, dimensions: drawing.dimensions, doorways },
  )
}

const ALL_FORMATS = Object.keys(PAGE_FORMATS_MM) as PageFormat[]

// габариты страницы с запасом: стены, размеры и элементы (страница демонтажа — без размеров, но с элементами)
// страница демонтажа дополнительно — размеры пометок (change demolition-dimension-chains, design D4): k — px листа на см чертежа
export function pageBounds(page: PlanPage, scale: number): BBox {
  const k = 10 / scale
  const extra = (page.demolition ?? []).flatMap((r) => markDimensionExtent(r, page.walls, k, PDF_METRICS))
  return wallsBBox(page.walls, page.dimensions, 0.5 * scale, page.doorways, scale, extra)
}

// форматы, на которые страница помещается по своим габаритам; пустая страница ничего не ограничивает
function pageFormats(page: PlanPage, scale: number): PageFormat[] {
  if (page.walls.length === 0) return ALL_FORMATS
  const b = pageBounds(page, scale)
  return ALL_FORMATS.filter((f) => fitsFormat(b, scale, f))
}

// форматы, на которые помещаются все страницы (spec pdf-export «Форматы учитывают все страницы»)
export function availableFormatsForPages(pages: PlanPage[], scale: number): PageFormat[] {
  const perPage = pages.map((p) => pageFormats(p, scale))
  return ALL_FORMATS.filter((f) => perPage.every((formats) => formats.includes(f)))
}

export function availableFormats(walls: Wall[], dimensions: Dimension[] = [], scale: number = 100, doorways: WallElement[] = []): PageFormat[] {
  return availableFormatsForPages([{ walls, dimensions, doorways }], scale)
}

export function placeOnPage(b: BBox, scale: number, format: PageFormat): Placement {
  const mmPerCm = 10 / scale
  const dw = (b.maxX - b.minX) * mmPerCm
  const dh = (b.maxY - b.minY) * mmPerCm
  const area = drawingArea(format)
  return {
    landscape: true,
    mmPerCm,
    offsetX: area.x + (area.w - dw) / 2 - b.minX * mmPerCm,
    offsetY: area.y + (area.h - dh) / 2 - b.minY * mmPerCm,
  }
}

export function pdfFileName(name: string, now: Date): string {
  const clean = name.replace(/[/\\:*?"<>|]/g, "").trim() || "Чертёж"
  const p = (n: number): string => String(n).padStart(2, "0")
  return `${clean}_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}.pdf`
}

// рамка, основная надпись и чертёж одной страницы на текущей странице документа
function drawPage(doc: jsPDF, page: PlanPage, unit: Unit, scale: number, format: PageFormat, name: string, date: Date): void {
  const placement = placeOnPage(pageBounds(page, scale), scale, format)
  const { w, h } = sheetSizeMm(format)
  const ctx = doc.context2d as unknown as CanvasRenderingContext2D
  const view = {
    zoom: placement.mmPerCm / PX_PER_CM,
    pan: { x: -placement.offsetX / placement.mmPerCm, y: -placement.offsetY / placement.mmPerCm },
  }
  drawSheet(doc, format, { name, scale, date })
  if (page.demolition !== undefined) {
    const scene = { walls: page.walls, doorways: page.doorways, marks: page.demolition }
    drawDemolitionScene(ctx, w, h, scene, unit, view, { color: demolitionColor("light"), grid: false, metrics: PDF_METRICS, palette: LIGHT_PALETTE, widths: true })
    return
  }
  drawScene(ctx, w, h, page.walls, null, unit, view, [], { grid: false, metrics: PDF_METRICS, dimensions: page.dimensions, doorways: page.doorways })
}

// PDF из упорядоченного списка страниц: один формат, масштаб, имя и дата на всех страницах
export function buildPdfPages(
  pages: PlanPage[],
  unit: Unit,
  scale: number,
  format: PageFormat,
  fontB64: string,
  name = "",
  date: Date = new Date(),
): jsPDF {
  const [pw, ph] = PAGE_FORMATS_MM[format]
  const doc = new jsPDF({ unit: "mm", format: [pw, ph], orientation: "landscape" })
  doc.addFileToVFS("PTSans.ttf", fontB64)
  doc.addFont("PTSans.ttf", "PTSans", "normal")
  pages.forEach((page, i) => {
    if (i > 0) doc.addPage([pw, ph], "landscape")
    drawPage(doc, page, unit, scale, format, name, date)
  })
  return doc
}

export function exportPages(pages: PlanPage[], unit: Unit, scale: number, format: PageFormat, name: string): void {
  const now = new Date()
  const doc = buildPdfPages(pages, unit, scale, format, FONT_B64, name, now)
  const url = URL.createObjectURL(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = pdfFileName(name, now)
  a.click()
  URL.revokeObjectURL(url)
}

// одностраничные формы с прежними сигнатурами
export function buildPdf(
  walls: Wall[],
  dimensions: Dimension[],
  unit: Unit,
  scale: number,
  format: PageFormat,
  fontB64: string,
  doorways: WallElement[] = [],
  name = "",
  date: Date = new Date(),
): jsPDF {
  return buildPdfPages([{ walls, dimensions, doorways }], unit, scale, format, fontB64, name, date)
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
  exportPages([{ walls, dimensions, doorways }], unit, scale, format, name)
}
