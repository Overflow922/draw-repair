// Каталог видов мебели плана «Мебель» (change furniture-items-catalog, design D1): предметы одного устройства (центр, ширина,
// длина, угол) различаются только видом, а вид — только записью каталога. Новый вид — новая запись; больше ничего в логике
// не меняется (скилл add-furniture-kind).

import { curtainsDrawing } from "./curtains-drawing"
import { fridgeDrawing } from "./fridge-drawing"
import {
  bedDrawing,
  chairDrawing,
  deskDrawing,
  nightstandDrawing,
  officeChairDrawing,
  sofaDrawing,
  tableDrawing,
  tvDrawing,
  wallCabinetDrawing,
} from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"
import { kitchenCabinetDrawing } from "./kitchen-cabinet-drawing"
import type { ObstacleKind } from "./overlap"
import { doubleWardrobeDrawing, slidingWardrobeDrawing } from "./wardrobe-drawing"

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
  // с чем этот вид может стоять без предупреждения о пересечении (change furniture-overlap-exemptions): виды препятствий
  // и виды мебели; пара видов исключена, если любой из двух перечисляет другой
  overlapExemptions?: OverlapExemptions
}

export interface OverlapExemptions {
  obstacles?: readonly ObstacleKind[]
  // ключи каталога; тип FurnitureKind выводится из самого каталога, поэтому здесь строки — их проверяет тест FOE-10
  furniture?: readonly string[]
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
  tv: {
    label: "Телевизор",
    plaqueWord: "телевизор",
    defaults: { widthCm: 91, lengthCm: 11, angleDeg: 0 },
    drawing: tvDrawing,
    icon: '<rect x="2" y="6" width="20" height="3"/><path d="M5 9l2 3h10l2-3"/><path d="M9 12v3M15 12v3M8 18h8v-3H8z"/>',
    overlapExemptions: { furniture: ["wallCabinet", "nightstand", "kitchenCabinet"] },
  },
  wallCabinet: {
    label: "Подвесная тумба",
    plaqueWord: "подвесная тумба",
    defaults: { widthCm: 180, lengthCm: 42, angleDeg: 0 },
    drawing: wallCabinetDrawing,
    icon: '<rect x="3" y="6" width="18" height="12"/><path d="M6 18v-3h3v3M15 18v-3h3v3"/>',
  },
  bed: {
    label: "Кровать",
    plaqueWord: "кровать",
    defaults: { widthCm: 160, lengthCm: 200, angleDeg: 0 },
    drawing: bedDrawing,
    icon: '<rect x="4" y="3" width="16" height="18" rx="1"/><rect x="6" y="15.5" width="5" height="3.5" rx="1"/><rect x="13" y="15.5" width="5" height="3.5" rx="1"/><path d="M4 11h16"/>',
  },
  nightstand: {
    label: "Прикроватный столик",
    plaqueWord: "прикроватный столик",
    defaults: { widthCm: 30, lengthCm: 60, angleDeg: 0 },
    drawing: nightstandDrawing,
    icon: '<rect x="6" y="3" width="12" height="18"/><path d="M8 6h8" stroke-dasharray="1.5 1"/><path d="M8 6v13h8V6"/>',
  },
  slidingWardrobe: {
    label: "Шкаф-купе",
    plaqueWord: "шкаф-купе",
    defaults: { widthCm: 300, lengthCm: 60, angleDeg: 0 },
    drawing: slidingWardrobeDrawing,
    icon: '<rect x="2" y="5" width="20" height="14"/><path d="M2 8h20M2 10.5h20M9 5v3M15 5v3M12 8v2.5"/><path d="M6 13v4M9 13v4M15 13v4M18 13v4"/>',
  },
  doubleWardrobe: {
    label: "Шкаф двустворчатый",
    plaqueWord: "шкаф двустворчатый",
    defaults: { widthCm: 100, lengthCm: 60, angleDeg: 0 },
    drawing: doubleWardrobeDrawing,
    icon: '<rect x="5" y="3" width="14" height="18"/><path d="M5 6h14M12 3v3M8 14h8"/><path d="M8 8.5v4.5M10.5 8.5v4.5M13.5 15v4M16 15v4"/>',
  },
  curtains: {
    label: "Шторы",
    plaqueWord: "шторы",
    defaults: { widthCm: 300, lengthCm: 13, angleDeg: 0 },
    drawing: curtainsDrawing,
    icon: '<path d="M2 11c2-6 4-6 5.5 0s3.500 6 4.500 0 3.500-6 5.500 0 3 6 4.500 0"/><path d="M3 15c2-4 3.500-4 5 0s3 4 4 0 3-4 4.500 0 2 4 4 0"/><path d="M2 19h20M2 21h20"/>',
    overlapExemptions: { obstacles: ["battery"] },
  },
  kitchenCabinet: {
    label: "Кухонный шкаф",
    plaqueWord: "кухонный шкаф",
    defaults: { widthCm: 60, lengthCm: 62, angleDeg: 0 },
    drawing: kitchenCabinetDrawing,
    icon: '<rect x="4" y="7" width="16" height="14"/><path d="M4 10h16M9 3.500h6M10 3.500v3.500M14 3.500v3.500"/>',
  },
  fridge: {
    label: "Холодильник двустворчатый",
    plaqueWord: "холодильник двустворчатый",
    defaults: { widthCm: 100, lengthCm: 90, angleDeg: 0 },
    drawing: fridgeDrawing,
    icon: '<rect x="3" y="3" width="18" height="11"/><circle cx="12" cy="8.500" r="3"/><path d="M3 14l5 7M21 14l-8 7"/>',
  },
} as const satisfies Record<string, FurnitureKindEntry>

export type FurnitureKind = keyof typeof FURNITURE_KINDS

// порядок видов — порядок объявления: кнопки панели, записи легенды, слова плашки
export const FURNITURE_KIND_ORDER = Object.keys(FURNITURE_KINDS).filter(isFurnitureKind)

export function isFurnitureKind(x: unknown): x is FurnitureKind {
  return typeof x === "string" && Object.hasOwn(FURNITURE_KINDS, x)
}

export const kindEntry = (kind: FurnitureKind): FurnitureKindEntry => FURNITURE_KINDS[kind]
