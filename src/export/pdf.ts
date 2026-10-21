import { jsPDF } from "jspdf"
import { batteryRect } from "../battery/battery-geometry"
import { demolishedBatteries } from "../battery/battery-demolition"
import { hostOfBattery } from "../battery/battery-motion"
import { communicationBox } from "../communications/geometry"
import { doorLeaf, heightLabelAt, heightLabelSide, labelDirection } from "../doorway/doorway-layout"
import { dimensionGeometry } from "../geometry"
import { LABEL_FRAME_PAD, elementLabel, labelWidth } from "../doorway/element-label"
import { drawScene, PDF_METRICS } from "../render"
import { demolitionColor, drawDemolitionScene } from "../demolition/demolition-render"
import { markDimensionExtent } from "../demolition/mark-dimensions"
import { effectiveMarks } from "../demolition/marks"
import { mountingScene } from "../mounting/mounting-scene"
import type { ResolvedMark } from "../demolition/marks"
import { PLANS } from "../plans"
import { findRooms } from "../room-area"
import type { Room } from "../room-area"
import { roomBlocksOf } from "../room-block"
import { reconcileRooms } from "../room-explication"
import type { ExplicatedRoom } from "../room-explication"
import type { PlasterPiece } from "../rough/plaster"
import { drawReconstructionScene } from "../reconstruction/reconstruction-render"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawRoughScene, roughExtent } from "../rough/rough-render"
import type { RightAngleSign } from "../rough/rough-render"
import { roughScene } from "../rough/rough-scene"
import { LIGHT_PALETTE } from "../theme"
import { cross, dot, sub } from "../wall-geometry"
import { PX_PER_CM, isDoor, isWindow } from "../types"
import { calloutLayout } from "../callout/callout-layout"
import { calloutsOf } from "../callout/callout-store"
import { notesOf } from "../notes/notes-store"
import { CHAR_WIDTH } from "../doorway/element-label"
import type { Battery, Callout, Communication, Dimension, Drawing, DrywallWall, Point, Screed, Unit, Wall, WallElement } from "../types"
import { FONT_B64 } from "./font"
import { PAGE_FORMATS_MM } from "./page-format"
import type { PageFormat } from "./page-format"
import { bottomBandMm, pageExplication } from "./explication"
import { drawExplication } from "./explication-draw"
import { pageNotes } from "./notes"
import { drawNotes } from "./notes-draw"
import { drawLegend } from "./legend-draw"
import { legendWidthMm } from "./legend"
import { drawSheet } from "./sheet-draw"
import { drawingArea, legendArea, sheetSizeMm } from "./sheet-layout"

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

// масштаб, в котором считаются подписи окон, если вызывающий его не указал (размер подписей задан в мм на бумаге)
const BBOX_DEFAULT_SCALE = 100

// doorways: подписи высоты выходят за стену со своей стороны (change add-doorway, design D10); batteries нужны размерам
// с углами батарей (change add-battery, design D5)
export function wallsBBox(
  walls: Wall[],
  dimensions: Dimension[] = [],
  padCm = 0,
  doorways: WallElement[] = [],
  scale: number = BBOX_DEFAULT_SCALE,
  extra: readonly Point[] = [],
  batteries: readonly Battery[] = [],
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
    const g = dimensionGeometry(dim, walls, doorways, batteries)
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

export function fitsFormat(b: BBox, scale: number, format: PageFormat, legendMm = 0, bandMm?: number): boolean {
  const mmPerCm = 10 / scale
  const area = drawingArea(format, legendMm, bandMm)
  return (b.maxX - b.minX) * mmPerCm <= area.w && (b.maxY - b.minY) * mmPerCm <= area.h
}

// Страница PDF — содержимое одного плана чертежа (change drawing-plans, design D5)
export interface PlanPage {
  walls: Wall[]
  dimensions: Dimension[]
  doorways: WallElement[]
  // действующие пометки сноса: страница плана «Демонтаж» (change demolition-plan, design D9); у остальных страниц нет
  demolition?: readonly ResolvedMark[]
  // общие коммуникации чертежа: на каждой странице каждого плана (change add-communications, design D10)
  communications?: readonly Communication[]
  // батареи страницы (change add-battery, design D11): обмер — батареи обмера, «Демонтаж» — они же с множеством снесённых,
  // «Монтаж» — видимые батареи обмера и собственные
  batteries?: readonly Battery[]
  demolishedBatteryIds?: ReadonlySet<string>
  // выноски плана страницы (change add-callout, design D10)
  callouts?: readonly Callout[]
  // помещения экспликации страницы «Монтаж» с данными (change add-room-explication, design D6): блоки на чертеже и таблица;
  // у остальных страниц поля нет
  rooms?: readonly ExplicatedRoom[]
  // примечания плана страницы (change add-plan-notes, design D5): блок над основной надписью; у страницы без примечаний поля нет
  notes?: readonly string[]
  title?: string // название плана страницы — в графу 5 основной надписи (change pdf-plan-page-names)
  // слой плана «Черновые работы» (change add-rough-works-plan, design D6): действующие куски штукатурки и действующие стяжки с
  // помещениями; поле есть только у страницы этого плана, рядом rooms — помещения с площадью после штукатурки
  rough?: RoughLayer
  // слой плана «Реконструкция» (change reconstruction-plan, design D5): действующие куски штукатурки подложки (серые) и стены
  // гипсокартона; walls страницы — подложка, dimensions — размеры самого плана
  reconstruction?: ReconstructionLayer
}

export interface RoughLayer {
  // знаки действующих пометок прямых углов (change plaster-right-angle, design D4)
  rightAngles?: readonly RightAngleSign[]
  pieces: readonly PlasterPiece[]
  screeds: readonly { screed: Screed; room: Room }[]
}

export interface ReconstructionLayer {
  pieces: readonly PlasterPiece[]
  drywall: readonly DrywallWall[]
}

// страницы чертежа: по одной на план каталога в порядке каталога; объекты обмерочного плана лежат в прежних полях
// чертежа (design D1), страница демонтажа — подложка из тех же стен без размеров, видимые элементы и пометки
export function pagesOf(drawing: Drawing): PlanPage[] {
  const doorways = drawing.doorways ?? []
  const marks = effectiveMarks(drawing.demolition ?? [], drawing.walls, doorways)
  // страница «Монтаж» — остатки и собственные объекты плана (change mounting-plan, design D7)
  const mounting = mountingScene(drawing)
  const shared = drawing.communications ? { communications: drawing.communications } : null
  const batteries = drawing.batteries ? { batteries: drawing.batteries } : null
  const demolished = drawing.batteries
    ? { demolishedBatteryIds: new Set(demolishedBatteries(drawing.batteryDemolition ?? [], drawing.batteries).map((b) => b.id)) }
    : null
  return PLANS.map((plan): PlanPage => {
    // выноски страницы — только своего плана (change add-callout, design D10)
    const own = calloutsOf(drawing, plan.id)
    const callouts = own.length ? { callouts: own } : null
    const ownNotes = notesOf(drawing, plan.id)
    const notes = ownNotes.length ? { notes: ownNotes } : null
    switch (plan.id) {
      case "demolition":
        return { walls: drawing.walls, dimensions: [], doorways, demolition: marks, ...shared, ...batteries, ...demolished, ...callouts, ...notes, title: plan.label }
      case "mounting":
        return {
          walls: mounting.walls,
          dimensions: mounting.dimensions,
          doorways: mounting.doorways,
          ...shared,
          ...(mounting.batteries.length ? { batteries: mounting.batteries } : null),
          ...callouts,
          ...notes,
          rooms: reconcileRooms(findRooms(mounting.walls), drawing.rooms ?? []),
          title: plan.label,
        }
      case "measure":
        return { walls: drawing.walls, dimensions: drawing.dimensions, doorways, ...shared, ...batteries, ...callouts, ...notes, title: plan.label }
      case "rough": {
        const rough = roughScene(drawing, mounting)
        return {
          walls: mounting.walls,
          dimensions: [],
          doorways: mounting.doorways,
          ...shared,
          ...(mounting.batteries.length ? { batteries: mounting.batteries } : null),
          ...callouts,
          ...notes,
          rooms: rough.netItems,
          rough: {
            pieces: rough.pieces,
            screeds: rough.screeds.map((a) => ({ screed: a.screed, room: a.item.room })),
            // поле только при действующих пометках: страница без них та же, что до введения прямых углов
            ...(rough.rightAngles.length > 0
              ? { rightAngles: rough.rightAngles.map((a) => ({ id: a.mark.id, point: a.corner.point, arms: a.corner.arms })) }
              : null),
          },
          title: plan.label,
        }
      }
      case "reconstruction": {
        const scene = reconstructionScene(drawing, mounting)
        return {
          walls: scene.underlay,
          dimensions: scene.dimensions,
          doorways: mounting.doorways,
          ...shared,
          ...(mounting.batteries.length ? { batteries: mounting.batteries } : null),
          ...callouts,
          ...notes,
          reconstruction: { pieces: scene.pieces, drywall: scene.own },
          title: plan.label,
        }
      }
    }
  })
}

// габариты страницы с запасом: стены, размеры и элементы (страница демонтажа — без размеров, но с элементами)
// страница демонтажа дополнительно — размеры пометок (change demolition-dimension-chains, design D4): k — px листа на см чертежа
export function pageBounds(page: PlanPage, scale: number): BBox {
  const k = 10 / scale
  const marks = (page.demolition ?? []).flatMap((r) => markDimensionExtent(r, page.walls, k, PDF_METRICS))
  // тело коммуникации — две противоположные вершины габарита
  const bodies = (page.communications ?? []).flatMap((c): Point[] => {
    const [x1, y1, x2, y2] = communicationBox(c)
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  })
  // прямоугольники батарей — четыре вершины
  const batteries = page.batteries ?? []
  const rects = batteries.flatMap((b): Point[] => {
    const host = hostOfBattery(b, page.walls)
    return host ? batteryRect(b, host) : []
  })
  // выноски: подложка текста и концы линии; раскладка в мм листа (px PDF), оценка ширины строки по кеглю
  const kMm = 10 / scale
  const calloutPoints = (page.callouts ?? []).flatMap((c): Point[] => {
    const l = calloutLayout(c, { zoom: kMm / PX_PER_CM, pan: { x: 0, y: 0 } }, PDF_METRICS, (line) => line.length * PDF_METRICS.labelPx * CHAR_WIDTH)
    const { x, y, w, h } = l.box
    return [{ x, y }, { x: x + w, y: y + h }, l.lineStart, l.arrowTip].map((q) => ({ x: q.x / kMm, y: q.y / kMm }))
  })
  // штукатурка и подписи стяжек плана «Черновые работы»
  const rough = page.rough ? roughExtent(page.rough, kMm, PDF_METRICS.labelPx) : []
  // штукатурка подложки плана «Реконструкция»; стены гипсокартона входят в габариты как стены
  const reconstruction = page.reconstruction ? roughExtent({ pieces: page.reconstruction.pieces, screeds: [] }, kMm, PDF_METRICS.labelPx) : []
  const extra = [...marks, ...bodies, ...rects, ...calloutPoints, ...rough, ...reconstruction]
  const walls = page.reconstruction ? [...page.walls, ...page.reconstruction.drywall] : page.walls
  return wallsBBox(walls, page.dimensions, 0.5 * scale, page.doorways, scale, extra, batteries)
}

export function placeOnPage(b: BBox, scale: number, format: PageFormat, legendMm = 0, bandMm?: number): Placement {
  const mmPerCm = 10 / scale
  const dw = (b.maxX - b.minX) * mmPerCm
  const dh = (b.maxY - b.minY) * mmPerCm
  const area = drawingArea(format, legendMm, bandMm)
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
function drawPage(
  doc: jsPDF,
  page: PlanPage,
  unit: Unit,
  scale: number,
  format: PageFormat,
  legendMm: number,
  bandMm: number,
  name: string,
  date: Date,
): void {
  const placement = placeOnPage(pageBounds(page, scale), scale, format, legendMm, bandMm)
  const { w, h } = sheetSizeMm(format)
  const ctx = doc.context2d as unknown as CanvasRenderingContext2D
  const view = {
    zoom: placement.mmPerCm / PX_PER_CM,
    pan: { x: -placement.offsetX / placement.mmPerCm, y: -placement.offsetY / placement.mmPerCm },
  }
  drawSheet(doc, format, page.title === undefined ? { name, scale, date } : { name, scale, date, pageName: page.title })
  drawLegend(doc, ctx, page, legendArea(format, legendMm, bandMm))
  const explication = pageExplication(page)
  if (explication) drawExplication(doc, format, explication)
  const notes = pageNotes(page)
  if (notes) drawNotes(doc, format, notes)
  if (page.reconstruction !== undefined) {
    const scene = {
      walls: page.walls,
      doorways: page.doorways,
      communications: page.communications,
      batteries: page.batteries,
      pieces: page.reconstruction.pieces,
      drywall: page.reconstruction.drywall,
      callouts: page.callouts,
    }
    drawReconstructionScene(ctx, w, h, scene, unit, view, { grid: false, metrics: PDF_METRICS, palette: LIGHT_PALETTE, theme: "light", dimensions: page.dimensions })
    return
  }
  if (page.rough !== undefined) {
    const scene = {
      walls: page.walls,
      doorways: page.doorways,
      communications: page.communications,
      batteries: page.batteries,
      pieces: page.rough.pieces,
      screeds: page.rough.screeds,
      rightAngles: page.rough.rightAngles,
      blocks: roomBlocksOf(page.rooms ?? []),
      callouts: page.callouts,
    }
    drawRoughScene(ctx, w, h, scene, unit, view, { grid: false, metrics: PDF_METRICS, palette: LIGHT_PALETTE, theme: "light", dimensions: false })
    return
  }
  if (page.demolition !== undefined) {
    const scene = {
      walls: page.walls,
      doorways: page.doorways,
      marks: page.demolition,
      communications: page.communications,
      batteries: page.batteries,
      demolishedBatteryIds: page.demolishedBatteryIds,
      callouts: page.callouts,
    }
    drawDemolitionScene(ctx, w, h, scene, unit, view, { color: demolitionColor("light"), grid: false, metrics: PDF_METRICS, palette: LIGHT_PALETTE })
    return
  }
  drawScene(ctx, w, h, page.walls, null, unit, view, [], {
    grid: false,
    metrics: PDF_METRICS,
    dimensions: page.dimensions,
    doorways: page.doorways,
    communications: page.communications,
    batteries: page.batteries,
    callouts: page.callouts,
    // страница «Монтаж»: помещения — блоками вместо подписей площади
    ...(page.rooms ? { roomRecords: page.rooms.map((r) => r.record) } : null),
  })
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
  const legendMm = legendWidthMm(pages)
  const bandMm = bottomBandMm(pages, format)
  pages.forEach((page, i) => {
    if (i > 0) doc.addPage([pw, ph], "landscape")
    drawPage(doc, page, unit, scale, format, legendMm, bandMm, name, date)
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
