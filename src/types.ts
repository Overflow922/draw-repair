import type { PlanId } from "./plans"

export interface Point {
  x: number
  y: number
}

// порядок каталога — порядок образцов в панели, переключения стрелками и записей легенды PDF
export const MATERIALS = [
  { id: "blocks", label: "Блоки" },
  { id: "brick", label: "Кирпич" },
  { id: "concrete", label: "Бетон" },
  { id: "gkl", label: "ГКЛ" },
  { id: "wood-long", label: "Дерево" }, // id остался от «Дерево (вдоль)»: сохранённые чертежи читаются без миграции
] as const

export type Material = (typeof MATERIALS)[number]["id"]

// «Железобетон» убран из каталога: сохранённые такие стены читаются как «Бетон»; остальные неизвестные типы — как «Кирпич»
export function normalizeMaterial(type: string): Material {
  if (type === "reinforced") return "concrete"
  return (MATERIALS.some((m) => m.id === type) ? type : "brick") as Material
}

export interface Wall {
  id: string
  a: Point
  b: Point
  thicknessCm: number
  type: Material
}

export interface EdgeRef {
  wallId: string
  edge: number
}

// Точка замера — пересечение двух граней стен или откос элемента стены (change add-opening-dimension-anchors, design D1).
// Граневая точка записана без поля kind (формат до этого change)
export interface EdgePoint {
  kind?: undefined
  a: EdgeRef
  b: EdgeRef
}

// откос элемента: jamb — ближний к концу a или b оси опорной стены, face — знак нормали (−d.y, d.x) этой оси
export interface JambPoint {
  kind: "jamb"
  elementId: string
  jamb: "a" | "b"
  face: 1 | -1
}

export type DimPoint = EdgePoint | JambPoint

export interface Dimension {
  from: DimPoint
  to: DimPoint
  offset: number
  // идентификатор стены-владельца у размера, созданного автоматически (change auto-wall-dimensions, design D5)
  auto?: string
}

// Проём в стене (change add-doorway, design D1): положение — расстояние вдоль оси опорной стены
// от конца привязки до ближнего откоса; данные относительны к стене и следуют за ней сами
// Вид проёма — отсутствующее поле kind (формат add-doorway) или "doorway" (change add-window, design D1)
export interface Doorway {
  kind?: "doorway"
  id: string
  wallId: string
  anchor: "a" | "b"
  offsetCm: number
  widthCm: number
  heightCm: number
}

// Окно — элемент стены с высотой подоконника (change add-window, design D1)
export interface WallWindow {
  kind: "window"
  id: string
  wallId: string
  anchor: "a" | "b"
  offsetCm: number
  widthCm: number
  heightCm: number
  sillCm: number
}

// Дверь — элемент стены с направлением открывания относительно опорной стены (change add-door, design D1):
// петли у откоса со стороны конца hinge, полотно открывается на грань swing (left — нормаль (d.y, −d.x))
export type DoorHinge = "a" | "b"
export type DoorSwing = "left" | "right"

export interface WallDoor {
  kind: "door"
  id: string
  wallId: string
  anchor: "a" | "b"
  offsetCm: number
  widthCm: number
  heightCm: number
  hinge: DoorHinge
  swing: DoorSwing
}

// Элемент стены: проём, окно или дверь (spec doorway «Элементы стены»)
export type WallElement = Doorway | WallWindow | WallDoor

export const isWindow = (e: WallElement): e is WallWindow => e.kind === "window"
export const isDoor = (e: WallElement): e is WallDoor => e.kind === "door"

// Коммуникации — вертикальные трубы, общие для всех планов чертежа (change add-communications, design D1):
// положение — центр в координатах чертежа, к стенам не привязаны; воздуховод — прямоугольник по осям без поворота
export interface Riser {
  kind: "riser"
  id: string
  x: number
  y: number
  diameterCm: number
}

export interface Duct {
  kind: "duct"
  id: string
  x: number
  y: number
  widthCm: number // по оси X
  depthCm: number // по оси Y
}

export type Communication = Riser | Duct

export interface View {
  zoom: number
  pan: Point
}

export const PX_PER_CM = 2
export const GRID_STEP_CM = 10
export const SNAP_RADIUS_PX = 12
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 10

export type Unit = "m" | "cm" | "mm"

// Пометка сноса плана «Демонтаж» (change demolition-plan, design D2): участок оси стены обмерочного плана
// от конца привязки (anchor): расстояния fromCm (до ближней границы) и toCm (до дальней), 0 ≤ fromCm < toCm
export interface DemolitionMark {
  id: string
  wallId: string
  anchor: "a" | "b"
  fromCm: number
  toCm: number
}

// Собственные объекты плана «Монтаж» (change mounting-plan, design D4): те же типы, что у обмера; остатки стен
// обмера после сноса вычисляются и здесь не хранятся
export interface MountingContent {
  walls: Wall[]
  dimensions: Dimension[]
  doorways?: WallElement[]
}

export interface Drawing {
  id: string
  name: string
  // walls, dimensions и doorways — содержимое плана "measure" (change drawing-plans, design D1)
  walls: Wall[]
  dimensions: Dimension[]
  // элементы стены (проёмы и окна); отсутствие — пустой список, при загрузке не дописывается
  // (add-doorway design D9); JSON-ключ прежний (add-window design D1)
  doorways?: WallElement[]
  // коммуникации: общие для всех планов, правятся на обмерочном плане; отсутствие — пустой список, при загрузке не
  // дописывается (add-communications design D1)
  communications?: Communication[]
  // активный план; отсутствие или неизвестное значение читается как план по умолчанию (drawing-plans design D3)
  activePlan?: PlanId
  // пометки сноса плана "demolition"; отсутствие — пустой список (design D7)
  demolition?: DemolitionMark[]
  // объекты плана "mounting"; отсутствие — пустой «Монтаж», при загрузке не дописывается
  mounting?: MountingContent
  view: View
}

export interface DrawingStore {
  version: 3
  activeId: string
  drawings: Drawing[]
}
