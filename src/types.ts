import type { PlanId } from "./plans"

export interface Point {
  x: number
  y: number
}

export const MATERIALS = [
  { id: "brick", label: "Кирпич" },
  { id: "concrete", label: "Бетон" },
  { id: "reinforced", label: "Железобетон" },
  { id: "wood-long", label: "Дерево (вдоль)" },
] as const

export type Material = (typeof MATERIALS)[number]["id"]

export function normalizeMaterial(type: string): Material {
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

export interface DimPoint {
  a: EdgeRef
  b: EdgeRef
}

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

export const SCALE_DENOMINATORS = [50, 100, 200, 500] as const
export type ScaleDenominator = (typeof SCALE_DENOMINATORS)[number]
export const DEFAULT_SCALE: ScaleDenominator = 100

export const isScale = (value: unknown): value is ScaleDenominator =>
  typeof value === "number" && (SCALE_DENOMINATORS as readonly unknown[]).includes(value)

// Пометка сноса плана «Демонтаж» (change demolition-plan, design D2): участок оси стены обмерочного плана
// от конца привязки (anchor): расстояния fromCm (до ближней границы) и toCm (до дальней), 0 ≤ fromCm < toCm
export interface DemolitionMark {
  id: string
  wallId: string
  anchor: "a" | "b"
  fromCm: number
  toCm: number
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
  // активный план; отсутствие или неизвестное значение читается как план по умолчанию (drawing-plans design D3)
  activePlan?: PlanId
  // пометки сноса плана "demolition"; отсутствие — пустой список (design D7)
  demolition?: DemolitionMark[]
  view: View
  scale: ScaleDenominator
}

export interface DrawingStore {
  version: 3
  activeId: string
  drawings: Drawing[]
}
