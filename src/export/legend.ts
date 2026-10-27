import { CHAR_WIDTH } from "../doorway/element-label"
import { FURNITURE_KIND_ORDER, kindEntry } from "../furniture/furniture-kinds"
import type { FurnitureKind } from "../furniture/furniture-kinds"
import { LIGHT_KINDS } from "../ceiling/lights"
import { MATERIALS, normalizeMaterial } from "../types"
import type { LightKind, Material } from "../types"
import type { PlanPage } from "./pdf"

// Легенда страницы PDF (change pdf-legend): состав записей страницы, перенос подписи и ширина столбца легенды документа.
// Все размеры — абсолютные миллиметры на бумаге и не зависят от масштаба чертежа (design D6).

export type LegendEntry =
  | { kind: "material"; material: Material; label: string }
  | { kind: "battery"; label: string }
  | { kind: "riser"; label: string }
  | { kind: "duct"; label: string }
  | { kind: "demolition"; label: string }
  | { kind: "plaster"; label: string }
  | { kind: "screed"; label: string }
  | { kind: "drywall"; label: string }
  | { kind: "ceiling"; label: string }
  | { kind: "light"; light: LightKind; label: string }
  | { kind: "furniture"; item: FurnitureKind; label: string }

export const LEGEND_PAD_LEFT_MM = 8
export const LEGEND_SAMPLE_W_MM = 16
export const LEGEND_ROW_PITCH_MM = 14
// записей в столбце: ⌊222 / 14⌋ — предел высоты области чертежа среди A3–A0; остальные записи — во втором столбце
export const LEGEND_COLUMN_CAPACITY = 15
export const LEGEND_GAP_MM = 5
export const LEGEND_FONT_MM = 3.5
export const LEGEND_LINE_PITCH_MM = 4.5
export const LEGEND_LABEL_MAX_MM = 28
export const LEGEND_PAD_RIGHT_MM = 5
// образцы объектов (change add-legend-objects, design D4): стояк — окружность, воздуховод — прямоугольник с диагональю, батарея — прямоугольник с секциями
export const LEGEND_RISER_DIAMETER_MM = 8
export const LEGEND_DUCT_WIDTH_MM = 16
export const LEGEND_DUCT_DEPTH_MM = 8
export const LEGEND_BATTERY_THICKNESS_MM = 4
// образец вида мебели (change furniture-line-drawings, design D4): детали рисунка в постоянном масштабе, под образец подгоняются габариты
export const LEGEND_ITEM_MM_PER_CM = 0.2

// записи страницы сверху вниз: материалы стен в порядке каталога, затем батарея, стояк, воздуховод (если они нарисованы на странице),
// затем снос, штукатурка и стяжка плана «Черновые работы» («Стяжка до N мм» — по наибольшей толщине действующих стяжек страницы,
// change add-rough-works-plan, design D9); на странице «Реконструкция» — штукатурка подложки и «Гипсокартон» (change
// reconstruction-plan, design D5); стена гипсокартона материал «ГКЛ» не даёт, элементы стены (проём, дверь, окно) в легенду не входят
export function legendEntries(page: PlanPage): LegendEntry[] {
  const drywall = page.reconstruction?.drywall.length ?? 0
  if (page.walls.length === 0 && drywall === 0) return []
  const used = new Set(page.walls.map((w) => normalizeMaterial(w.type)))
  const entries: LegendEntry[] = MATERIALS.filter((m) => used.has(m.id)).map((m) => ({ kind: "material", material: m.id, label: m.label }))
  const communications = page.communications ?? []
  if ((page.batteries?.length ?? 0) > 0) entries.push({ kind: "battery", label: "Батарея" })
  if (communications.some((c) => c.kind === "riser")) entries.push({ kind: "riser", label: "Стояк" })
  if (communications.some((c) => c.kind === "duct")) entries.push({ kind: "duct", label: "Воздуховод" })
  if ((page.demolition?.length ?? 0) > 0) entries.push({ kind: "demolition", label: "Демонтируемая стена" })
  if ((page.rough?.pieces.length ?? 0) > 0 || (page.reconstruction?.pieces.length ?? 0) > 0) entries.push({ kind: "plaster", label: "Штукатурка" })
  const screeds = page.rough?.screeds ?? []
  if (screeds.length > 0) entries.push({ kind: "screed", label: `Стяжка до ${Math.max(...screeds.map((s) => s.screed.thicknessMm))} мм` })
  if (drywall > 0) entries.push({ kind: "drywall", label: "Гипсокартон" })
  // натяжной потолок — на странице «Потолки и освещение» при действующих потолках; её предметы — подложка, записей видов не дают
  // (change add-ceiling-plan, design D8)
  if ((page.ceiling?.ceilings.length ?? 0) > 0) entries.push({ kind: "ceiling", label: "Натяжной потолок" })
  // виды освещения, чьи объекты есть на странице, в порядке каталога видов освещения (change add-ceiling-lighting, design D8)
  // страница «Группы включения» даёт те же записи видов освещения, но без «Натяжного потолка» и видов мебели (change
  // add-switching-plan, design D7)
  const lights = page.ceiling?.lights ?? page.switching?.lights ?? []
  for (const { kind, title } of LIGHT_KINDS) if (lights.some((l) => l.kind === kind)) entries.push({ kind: "light", light: kind, label: title })
  // мебель: запись на каждый вид каталога, чьи предметы есть на странице, в порядке каталога (change furniture-items-catalog, design D6)
  for (const item of FURNITURE_KIND_ORDER)
    if (page.furniture?.items.some((i) => i.kind === item)) entries.push({ kind: "furniture", item, label: kindEntry(item).label })
  return entries
}

// оценка ширины строки подписи, мм (без jsPDF: вместимость форматов считается в UI без документа)
const estimateMm = (text: string): number => text.length * LEGEND_FONT_MM * CHAR_WIDTH

// перенос подписи по пробелам: строка набирается, пока оценка её ширины не превышает предел; слово, не помещающееся
// само, остаётся целым в своей строке
export function wrapLabel(label: string): string[] {
  const lines: string[] = []
  let current = ""
  for (const word of label.split(" ")) {
    if (current === "") current = word
    else if (estimateMm(`${current} ${word}`) <= LEGEND_LABEL_MAX_MM) current = `${current} ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)
  return lines
}

// ширина одного столбца легенды документа: самая широкая строка подписей среди всех страниц после переноса
export function legendColumnWidthMm(pages: readonly PlanPage[]): number {
  const widest = Math.max(0, ...pages.flatMap((p) => legendEntries(p)).flatMap((e) => wrapLabel(e.label)).map(estimateMm))
  if (widest === 0) return 0
  return LEGEND_PAD_LEFT_MM + LEGEND_SAMPLE_W_MM + LEGEND_GAP_MM + widest + LEGEND_PAD_RIGHT_MM
}

// столбец и строка записи с номером i: записи идут сверху вниз по первому столбцу, затем по второму (change add-furniture-tv-wall-cabinet)
export function legendCell(i: number): { column: number; row: number } {
  return { column: Math.floor(i / LEGEND_COLUMN_CAPACITY), row: i % LEGEND_COLUMN_CAPACITY }
}

// число столбцов легенды документа: наибольшее среди страниц, не меньше одного
export function legendColumnCount(pages: readonly PlanPage[]): number {
  return Math.max(1, ...pages.map((p) => Math.ceil(legendEntries(p).length / LEGEND_COLUMN_CAPACITY)))
}

// ширина легенды документа: число столбцов, умноженное на ширину столбца; 0, если легенды нигде нет
export function legendWidthMm(pages: readonly PlanPage[]): number {
  return legendColumnCount(pages) * legendColumnWidthMm(pages)
}
