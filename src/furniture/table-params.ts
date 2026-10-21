import type { Table } from "../types"
import { normalizeAngle } from "./table"

// Параметры инструмента «Стол» (change furniture-plan-table, design D7): ширина и длина в сантиметрах, угол в градусах. Значения
// панели применяются к новым столам; у единственного выделенного стола панель показывает его значения, правка меняет стол,
// а не значения для новых.

export interface TableParams {
  widthCm: number
  lengthCm: number
  angleDeg: number
}

export const TABLE_DEFAULTS: TableParams = { widthCm: 80, lengthCm: 160, angleDeg: 0 }

// значение поля «Угол» → градусы в [0, 360); нечисловое не применяется, ноль и отрицательные допустимы
export function parseAngleField(text: string): number | null {
  const v = parseFloat(text.replace(",", "."))
  return Number.isFinite(v) ? normalizeAngle(v) : null
}

export const panelValues = (params: TableParams, selected: Table | null): TableParams =>
  selected ? { widthCm: selected.widthCm, lengthCm: selected.lengthCm, angleDeg: selected.angleDeg } : params

const positive = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v) && v > 0

// правка поля панели: без выделенного стола — значения для новых; с одним выделенным — новый стол (null, если ничего не изменилось)
export function editParams(params: TableParams, selected: Table | null, patch: Partial<TableParams>): { params: TableParams; table: Table | null } {
  const accepted: Partial<TableParams> = {
    ...(positive(patch.widthCm) ? { widthCm: patch.widthCm } : null),
    ...(positive(patch.lengthCm) ? { lengthCm: patch.lengthCm } : null),
    ...(patch.angleDeg !== undefined && Number.isFinite(patch.angleDeg) ? { angleDeg: normalizeAngle(patch.angleDeg) } : null),
  }
  if (!selected) return { params: { ...params, ...accepted }, table: null }
  const next = { ...selected, ...accepted }
  const changed = next.widthCm !== selected.widthCm || next.lengthCm !== selected.lengthCm || next.angleDeg !== selected.angleDeg
  return { params, table: changed ? next : null }
}
