// Каталог видов мебели плана «Мебель» (change furniture-items-catalog, design D1): предметы одного устройства (центр, ширина,
// длина, угол) различаются только видом, а вид — только записью каталога. Новый вид — новая запись; больше ничего в логике
// не меняется (скилл add-furniture-kind).

import { chairDrawing, tableDrawing } from "./item-drawing"
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
} as const satisfies Record<string, FurnitureKindEntry>

export type FurnitureKind = keyof typeof FURNITURE_KINDS

// порядок видов — порядок объявления: кнопки панели, записи легенды, слова плашки
export const FURNITURE_KIND_ORDER = Object.keys(FURNITURE_KINDS).filter(isFurnitureKind)

export function isFurnitureKind(x: unknown): x is FurnitureKind {
  return typeof x === "string" && Object.hasOwn(FURNITURE_KINDS, x)
}

export const kindEntry = (kind: FurnitureKind): FurnitureKindEntry => FURNITURE_KINDS[kind]
