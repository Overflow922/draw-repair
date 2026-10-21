import type { FurnitureItem } from "../types"
import { FURNITURE_KIND_ORDER, kindEntry } from "./furniture-kinds"
import type { FurnitureKind } from "./furniture-kinds"
import { normalizeAngle } from "./item"

// Параметры инструмента мебели (change furniture-plan-table, design D7): ширина и длина в сантиметрах, угол в градусах. Значения
// панели применяются к новым предметам; у единственного выделенного предмета панель показывает его значения, правка меняет
// предмет, а не значения для новых.

export interface ItemParams {
  widthCm: number
  lengthCm: number
  angleDeg: number
}

// значения для новых предметов вида до первой правки панели — из каталога видов
export const defaultParams = (kind: FurnitureKind): ItemParams => ({ ...kindEntry(kind).defaults })

// значения для новых предметов по видам (в сеансе): правка панели меняет значения активного вида и не трогает остальные виды
export type KindParams = ReadonlyMap<FurnitureKind, ItemParams>

export const initialKindParams = (): KindParams => new Map(FURNITURE_KIND_ORDER.map((kind) => [kind, defaultParams(kind)]))

export const paramsOfKind = (all: KindParams, kind: FurnitureKind): ItemParams => all.get(kind) ?? defaultParams(kind)

export const withKindParams = (all: KindParams, kind: FurnitureKind, params: ItemParams): KindParams => new Map(all).set(kind, params)

// значение поля «Угол» → градусы в [0, 360); нечисловое не применяется, ноль и отрицательные допустимы
export function parseAngleField(text: string): number | null {
  const v = parseFloat(text.replace(",", "."))
  return Number.isFinite(v) ? normalizeAngle(v) : null
}

export const panelValues = (params: ItemParams, selected: FurnitureItem | null): ItemParams =>
  selected ? { widthCm: selected.widthCm, lengthCm: selected.lengthCm, angleDeg: selected.angleDeg } : params

const positive = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v) && v > 0

// правка поля панели: без выделенного стола — значения для новых; с одним выделенным — новый стол (null, если ничего не изменилось)
export function editParams(params: ItemParams, selected: FurnitureItem | null, patch: Partial<ItemParams>): { params: ItemParams; table: FurnitureItem | null } {
  const accepted: Partial<ItemParams> = {
    ...(positive(patch.widthCm) ? { widthCm: patch.widthCm } : null),
    ...(positive(patch.lengthCm) ? { lengthCm: patch.lengthCm } : null),
    ...(patch.angleDeg !== undefined && Number.isFinite(patch.angleDeg) ? { angleDeg: normalizeAngle(patch.angleDeg) } : null),
  }
  if (!selected) return { params: { ...params, ...accepted }, table: null }
  const next = { ...selected, ...accepted }
  const changed = next.widthCm !== selected.widthCm || next.lengthCm !== selected.lengthCm || next.angleDeg !== selected.angleDeg
  return { params, table: changed ? next : null }
}
