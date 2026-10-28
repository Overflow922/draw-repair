// Каталог видов мебели плана «Мебель» (change furniture-items-catalog, design D1): предметы одного устройства (центр, ширина,
// длина, угол) различаются только видом, а вид — только записью каталога. Новый вид — новая запись; больше ничего в логике
// не меняется (скилл add-furniture-kind).

import { kitchenColumnDrawing, microwaveDrawing, ovenDrawing } from "./built-in-appliance-drawing"
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
import { hobDrawing, sinkDrawing } from "./kitchen-inset-drawing"
import { dishwasherDrawing, wineCabinetDrawing } from "./kitchen-module-drawing"
import { dryerDrawing, washerDrawing } from "./laundry-drawing"
import { TOILET_DEFAULTS, toiletBounds } from "./toilet"
import { toiletDrawing } from "./toilet-drawing"
import { tropicalShowerDrawing } from "./tropical-shower-drawing"
import { wallShowerDrainDrawing } from "./wall-shower-drain-drawing"
import type { ToiletSizes } from "../types"
import type { ObstacleKind } from "./overlap"
import { doubleWardrobeDrawing, slidingWardrobeDrawing } from "./wardrobe-drawing"

export interface ItemDefaults {
  widthCm: number
  lengthCm: number
  angleDeg: number
  // только у вида «Унитаз» (change add-toilet): четыре размера, из которых выведены ширина и длина
  toilet?: ToiletSizes
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
  // прибор, подключаемый к воде: показывается на плане «Сантехника» (change add-plumbing-plan, design D2)
  water?: true
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
  // объекты кухни (change add-furniture-kitchen-objects): встроенные стоят в кухонном шкафу, врезные — на нём и над встроенными
  wineCabinet: {
    label: "Винный шкаф",
    plaqueWord: "винный шкаф",
    defaults: { widthCm: 30, lengthCm: 62, angleDeg: 0 },
    drawing: wineCabinetDrawing,
    icon: '<rect x="7" y="6" width="10" height="15"/><path d="M7 8.500h10M10 3.500h4M10.500 3.500v2.500M13.500 3.500v2.500"/><path d="M11.300 10.500v2l-1.300 1.500v5h4v-5l-1.300-1.500v-2z"/>',
    overlapExemptions: { furniture: ["kitchenCabinet"] },
  },
  hob: {
    label: "Варочная панель",
    plaqueWord: "варочная панель",
    defaults: { widthCm: 52, lengthCm: 30, angleDeg: 0 },
    drawing: hobDrawing,
    icon: '<rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="8" cy="12" r="3.500"/><circle cx="15" cy="12" r="2.500"/><circle cx="19.500" cy="10.500" r="0.700"/><circle cx="19.500" cy="13.500" r="0.700"/>',
    overlapExemptions: { furniture: ["kitchenCabinet", "wineCabinet", "dishwasher", "oven", "washer"] },
  },
  dishwasher: {
    label: "Посудомойка",
    plaqueWord: "посудомойка",
    defaults: { widthCm: 60, lengthCm: 62, angleDeg: 0 },
    drawing: dishwasherDrawing,
    icon: '<rect x="3" y="7" width="18" height="14"/><path d="M3 10h18M8 3.500h8M9.500 3.500v3.500M14.500 3.500v3.500"/><path d="M6.500 12h5a2.500 3 0 0 1-5 0zM9 15v3M7 18.500h4M15 12v2.500a1 1 0 0 0 2 0V12M16 15.500v3"/>',
    overlapExemptions: { furniture: ["kitchenCabinet"] },
    water: true,
  },
  sink: {
    label: "Раковина",
    plaqueWord: "раковина",
    defaults: { widthCm: 45, lengthCm: 40, angleDeg: 0 },
    drawing: sinkDrawing,
    icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="4" y="6" width="16" height="8" rx="1.500"/><circle cx="12" cy="17" r="1.500"/><path d="M5 16.500h3M5 18h3M16 16.500h3M16 18h3"/>',
    overlapExemptions: { furniture: ["kitchenCabinet", "wineCabinet", "dishwasher", "oven", "washer"] },
    water: true,
  },
  // встраиваемая техника (change add-furniture-appliances): духовой шкаф и микроволновка стоят в колонне, духовой шкаф и стиральная
  // машина — встроенные объекты кухни, сушильная машина стоит на стиральной; отдельно стоящей техники нет
  kitchenColumn: {
    label: "Кухонная колонна",
    plaqueWord: "кухонная колонна",
    defaults: { widthCm: 60, lengthCm: 62, angleDeg: 0 },
    drawing: kitchenColumnDrawing,
    icon: '<rect x="5" y="6" width="14" height="15"/><path d="M5 8.5h14M9.5 3h5M10.5 3v3M13.5 3v3M5 8.5l14 12.5M19 8.5L5 21"/>',
  },
  oven: {
    label: "Духовой шкаф",
    plaqueWord: "духовой шкаф",
    defaults: { widthCm: 60, lengthCm: 62, angleDeg: 0 },
    drawing: ovenDrawing,
    icon: '<rect x="3" y="6" width="18" height="15"/><path d="M3 9h18M9 3h6M10 3v3M14 3v3"/><circle cx="12" cy="15" r="4.5"/><path d="M10.5 13c-.7.5-.7 1.5 0 2s.7 1.5 0 2M12 13c-.7.5-.7 1.5 0 2s.7 1.5 0 2M13.5 13c-.7.5-.7 1.5 0 2s.7 1.5 0 2"/>',
    overlapExemptions: { furniture: ["kitchenCabinet", "kitchenColumn"] },
  },
  microwave: {
    label: "Микроволновка",
    plaqueWord: "микроволновка",
    defaults: { widthCm: 60, lengthCm: 62, angleDeg: 0 },
    drawing: microwaveDrawing,
    icon: '<rect x="3" y="6" width="18" height="15"/><path d="M3 9h18M9 3h6M10 3v3M14 3v3"/><circle cx="12" cy="15" r="4.5"/><path d="M9 14c1-1 2 1 3 0s2 1 3 0M9 16.5c1-1 2 1 3 0s2 1 3 0"/>',
    overlapExemptions: { furniture: ["kitchenColumn", "oven"] },
  },
  washer: {
    label: "Стиральная машина",
    plaqueWord: "стиральная машина",
    defaults: { widthCm: 60, lengthCm: 60, angleDeg: 0 },
    drawing: washerDrawing,
    icon: '<rect x="3" y="5" width="18" height="16"/><path d="M4 5V3h3v2M8 5V3h3v2M13 5V3h7v2"/><circle cx="12" cy="13.5" r="5"/><path d="M7 13.5c.6.8 1.9.8 2.5 0s1.9.8 2.5 0 1.9.8 2.5 0 1.9.8 2.5 0"/>',
    overlapExemptions: { furniture: ["kitchenCabinet"] },
    water: true,
  },
  dryer: {
    label: "Сушильная машина",
    plaqueWord: "сушильная машина",
    defaults: { widthCm: 60, lengthCm: 60, angleDeg: 0 },
    drawing: dryerDrawing,
    icon: '<rect x="3" y="5" width="18" height="16"/><path d="M4 5V3h3v2M8 5V3h3v2M13 5V3h7v2"/><circle cx="12" cy="13.5" r="5"/><path d="M11 13.5a1 1 0 0 1 2 0a2 2 0 0 1-4 0a3 3 0 0 1 6 0a4 4 0 0 1-8 0"/>',
    overlapExemptions: { furniture: ["washer"] },
  },
  // унитаз с инсталляцией (change add-toilet, references/toilet.png): блок зашивается гипсокартоном, ёршика нет
  toilet: {
    label: "Унитаз",
    plaqueWord: "унитаз",
    defaults: { ...toiletBounds(TOILET_DEFAULTS), angleDeg: 0, toilet: TOILET_DEFAULTS },
    drawing: toiletDrawing,
    icon: '<rect x="3" y="3" width="18" height="5"/><path d="M3 3l18 5M21 3L3 8"/><path d="M8 8v6a4 4 0 0 0 8 0V8"/><ellipse cx="12" cy="15" rx="2" ry="2.5"/>',
    water: true,
  },
  // потолочная лейка тропического душа (change add-furniture-tropical-shower, набросок варианта A): прибор плана «Сантехника» (change add-plumbing-tropical-shower)
  tropicalShower: {
    label: "Тропический душ",
    plaqueWord: "тропический душ",
    defaults: { widthCm: 40, lengthCm: 30, angleDeg: 0 },
    drawing: tropicalShowerDrawing,
    icon: '<rect x="3" y="6" width="18" height="12" rx="2.500"/><rect x="5.500" y="8.500" width="13" height="7" rx="1"/><circle cx="8.500" cy="11" r="0.700"/><circle cx="12" cy="11" r="0.700"/><circle cx="15.500" cy="11" r="0.700"/><circle cx="8.500" cy="13.500" r="0.700"/><circle cx="12" cy="13.500" r="0.700"/><circle cx="15.500" cy="13.500" r="0.700"/>',
    water: true,
  },
  // душевой трап, утопленный в стену (change add-wall-shower-drain, набросок варианта А): лоток в толще стены, наружу выходит щель;
  // стоит в стене, поэтому наложение на стену, стену гипсокартона и штукатурку не пересечение
  wallShowerDrain: {
    label: "Трап в стену",
    plaqueWord: "трап в стену",
    defaults: { widthCm: 70, lengthCm: 8, angleDeg: 0 },
    drawing: wallShowerDrainDrawing,
    icon: '<rect x="2" y="6" width="20" height="10" rx="1"/><rect x="4" y="8" width="16" height="4" rx="0.500"/><rect x="5" y="14" width="14" height="1" rx="0.500"/>',
    overlapExemptions: { obstacles: ["wall", "drywall", "plaster"] },
    water: true,
  },
} as const satisfies Record<string, FurnitureKindEntry>

export type FurnitureKind = keyof typeof FURNITURE_KINDS

// порядок видов — порядок объявления: кнопки панели, записи легенды, слова плашки
export const FURNITURE_KIND_ORDER = Object.keys(FURNITURE_KINDS).filter(isFurnitureKind)

export function isFurnitureKind(x: unknown): x is FurnitureKind {
  return typeof x === "string" && Object.hasOwn(FURNITURE_KINDS, x)
}

export const kindEntry = (kind: FurnitureKind): FurnitureKindEntry => FURNITURE_KINDS[kind]
