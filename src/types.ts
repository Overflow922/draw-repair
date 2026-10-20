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

// угол батареи — точка замера: торец у конца a или b оси опорной стены, задняя (ближняя к стене) или передняя сторона
// (change add-battery, design D5)
export interface BatteryCornerPoint {
  kind: "corner"
  batteryId: string
  end: "a" | "b"
  side: "back" | "front"
}

export type DimPoint = EdgePoint | JambPoint | BatteryCornerPoint

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

// Батарея — объект на грани опорной стены, не элемент стены (change add-battery, design D1): грань — знак нормали
// (−d.y, d.x) оси; расстояние привязки — от конца привязки до ближнего торца вдоль оси (может быть дробным);
// отступ — от грани стены до задней стороны. Положение в плане вычисляется, не хранится
export interface Battery {
  id: string
  wallId: string
  face: 1 | -1
  anchor: "a" | "b"
  offsetCm: number
  lengthCm: number
  thicknessCm: number
  gapCm: number
}

// Пометка сноса батареи целиком (change add-battery, design D8)
export interface BatteryMark {
  id: string
  batteryId: string
}

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
// радиус прилипания центра батареи к центру окна: окно и батарея — длинные объекты, обычного радиуса мало (spec battery «Центровка по окну»)
export const CENTER_SNAP_RADIUS_PX = 35
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

// Пометка штукатурки плана «Черновые работы» (change add-rough-works-plan, design D3): участок грани стены от конца привязки,
// как у пометки сноса; грань — знак нормали (−d.y, d.x) оси стены; толщина — целые миллиметры. Стена — стена обмера или собственная
// стена «Монтажа», положение участка — относительно исходной стены (остатки вычисляются)
export interface SidePlasterMark {
  id: string
  wallId: string
  face: 1 | -1
  anchor: "a" | "b"
  fromCm: number
  toCm: number
  thicknessMm: number
}

// Пометка торца (change plaster-wall-end-face, design D1): свободный конец исходной стены; участка вдоль оси нет,
// длина торца — толщина стены
export interface EndPlasterMark {
  id: string
  wallId: string
  face: "end"
  anchor: "a" | "b"
  thicknessMm: number
}

export type PlasterMark = SidePlasterMark | EndPlasterMark

// Стяжка помещения (change add-rough-works-plan, design D1, D2): опорная точка — точка клика и место подписи «h = …мм»;
// действует, пока опорная точка лежит в помещении экспликации
export interface Screed {
  id: string
  at: Point
  thicknessMm: number
}

// Выноска — подпись со стрелкой (change add-callout, design D1): точка стрелки и точка текста лежат в координатах чертежа ровно там,
// где кликнул пользователь, к стенам не привязаны; текст — строки через \n, не пустой. Принадлежит одному плану
export interface Callout {
  id: string
  target: Point
  at: Point
  text: string
}

// Данные помещения экспликации (change add-room-explication, design D1): помещение вычисляется по стенам, запись привязана к нему
// опорной точкой внутри помещения; пустое название выводится как «Комната», номер автоматический
export interface RoomRecord {
  number: number
  name: string
  heightMm: number
  anchor: Point
}

// Собственные объекты плана «Монтаж» (change mounting-plan, design D4): те же типы, что у обмера; остатки стен
// обмера после сноса вычисляются и здесь не хранятся
export interface MountingContent {
  walls: Wall[]
  dimensions: Dimension[]
  callouts?: Callout[]
  doorways?: WallElement[]
  batteries?: Battery[]
  notes?: string[]
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
  // батареи обмерочного плана и пометки их сноса; отсутствие — пустой список, при загрузке не дописывается (add-battery design D1, D8)
  batteries?: Battery[]
  batteryDemolition?: BatteryMark[]
  // активный план; отсутствие или неизвестное значение читается как план по умолчанию (drawing-plans design D3)
  activePlan?: PlanId
  // пометки сноса плана "demolition"; отсутствие — пустой список (design D7)
  demolition?: DemolitionMark[]
  // объекты плана "mounting"; отсутствие — пустой «Монтаж», при загрузке не дописывается
  mounting?: MountingContent
  // выноски планов «Обмерочный план» и «Демонтаж»; выноски «Монтажа» — в mounting.callouts; отсутствие — пустой список,
  // при загрузке не дописывается (add-callout design D1)
  callouts?: Callout[]
  demolitionCallouts?: Callout[]
  // примечания планов «Обмерочный план» и «Демонтаж»; примечания «Монтажа» — в mounting.notes; отсутствие — пустой список,
  // при загрузке не дописывается (add-plan-notes design D1)
  notes?: string[]
  demolitionNotes?: string[]
  // данные помещений плана «Монтаж», общие для планов; отсутствие — пустой список, при загрузке не дописывается
  // (add-room-explication design D1)
  rooms?: RoomRecord[]
  // объекты плана «Черновые работы»: штукатурка, стяжки, выноски и примечания; отсутствие — пустой список, при загрузке не
  // дописывается (add-rough-works-plan design D7)
  roughPlaster?: PlasterMark[]
  roughScreeds?: Screed[]
  roughCallouts?: Callout[]
  roughNotes?: string[]
  view: View
}

export interface DrawingStore {
  version: 3
  activeId: string
  drawings: Drawing[]
}
