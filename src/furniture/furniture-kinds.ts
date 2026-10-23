// Каталог видов мебели плана «Мебель» (change furniture-items-catalog, design D1): предметы одного устройства (центр, ширина,
// длина, угол) различаются только видом, а вид — только записью каталога. Новый вид — новая запись; больше ничего в логике
// не меняется (скилл add-furniture-kind).

import { chairDrawing, deskDrawing, officeChairDrawing, sofaDrawing, tableDrawing } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"

export interface ItemDefaults {
  widthCm: number
  lengthCm: number
  angleDeg: number
}

export interface FurnitureKindEntry {
  // название вида: подпись кнопки, запись легенды PDF, начало плашки пересечений
  label: string
  // слово вида в плашке пересечений, когда другой предмет — этого вида («Стол пересекается: стена, стол»)
  plaqueWord: string
  defaults: ItemDefaults
  // схематичный вид сверху — линии в сантиметрах в системе предмета (change furniture-line-drawings); цвета у вида нет
  drawing: ItemDrawingFn
  // содержимое SVG иконки кнопки вида (viewBox 24 x 24, stroke currentColor)
  icon: string
}

export const FURNITURE_KINDS = {
  table: {
    label: "Стол",
    plaqueWord: "стол",
    defaults: { widthCm: 80, lengthCm: 160, angleDeg: 0 },
    drawing: tableDrawing,
    icon: '<rect x="3" y="7" width="18" height="5" rx="1"/><path d="M6 12v7M18 12v7"/>',
  },
  chair: {
    label: "Стул",
    plaqueWord: "стул",
    defaults: { widthCm: 45, lengthCm: 45, angleDeg: 0 },
    drawing: chairDrawing,
    icon: '<path d="M7 3v9M7 12h10M17 12v9M7 12v9M7 3h6"/>',
  },
  sofa: {
    label: "Диван",
    plaqueWord: "диван",
    defaults: { widthCm: 200, lengthCm: 90, angleDeg: 0 },
    drawing: sofaDrawing,
    icon: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 18v2M19 18v2"/>',
  },
  desk: {
    label: "Письменный стол",
    plaqueWord: "письменный стол",
    defaults: { widthCm: 100, lengthCm: 50, angleDeg: 0 },
    drawing: deskDrawing,
    icon: '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M5 9v6M19 9v6" stroke-dasharray="1.5 1"/><path d="M8 15h8"/>',
  },
  officeChair: {
    label: "Компьютерное кресло",
    plaqueWord: "компьютерное кресло",
    defaults: { widthCm: 60, lengthCm: 60, angleDeg: 0 },
    drawing: officeChairDrawing,
    icon: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="8" y="11" width="8" height="5" rx="1.5"/><path d="M5 10v5M19 10v5M12 16v2M7 21l5-3 5 3"/>',
  },
} as const satisfies Record<string, FurnitureKindEntry>

export type FurnitureKind = keyof typeof FURNITURE_KINDS

// порядок видов — порядок объявления: кнопки панели, записи легенды, слова плашки
export const FURNITURE_KIND_ORDER = Object.keys(FURNITURE_KINDS).filter(isFurnitureKind)

export function isFurnitureKind(x: unknown): x is FurnitureKind {
  return typeof x === "string" && Object.hasOwn(FURNITURE_KINDS, x)
}

export const kindEntry = (kind: FurnitureKind): FurnitureKindEntry => FURNITURE_KINDS[kind]
