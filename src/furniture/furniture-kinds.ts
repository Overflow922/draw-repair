// Каталог видов мебели плана «Мебель» (change furniture-items-catalog, design D1): предметы одного устройства (центр, ширина,
// длина, угол) различаются только видом, а вид — только записью каталога. Новый вид — новая запись; больше ничего в логике
// не меняется (скилл add-furniture-kind).

export interface ItemColors {
  fill: string
  stroke: string
}

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
  // цвет предмета: PDF всегда светлая схема
  colors: { light: ItemColors; dark: ItemColors }
  // содержимое SVG иконки кнопки вида (viewBox 24 x 24, stroke currentColor)
  icon: string
}

export const FURNITURE_KINDS = {
  table: {
    label: "Стол",
    plaqueWord: "стол",
    defaults: { widthCm: 80, lengthCm: 160, angleDeg: 0 },
    // тёплая заливка с тёмным контуром, отличная от серой подложки, зелёного гипсокартона и красной подсветки
    colors: { light: { fill: "#e0b46c", stroke: "#6b4510" }, dark: { fill: "#b8863f", stroke: "#f3dcae" } },
    icon: '<rect x="3" y="7" width="18" height="5" rx="1"/><path d="M6 12v7M18 12v7"/>',
  },
  chair: {
    label: "Стул",
    plaqueWord: "стул",
    defaults: { widthCm: 45, lengthCm: 45, angleDeg: 0 },
    // синяя заливка с тёмным контуром, отличная от стола, подложки, гипсокартона и красной подсветки
    colors: { light: { fill: "#8fb4d9", stroke: "#1f4f7a" }, dark: { fill: "#4f7fae", stroke: "#cfe3f5" } },
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
