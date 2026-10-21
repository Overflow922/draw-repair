import type { DrywallWall, Point } from "../types"

export { parseLengthField } from "../length-field"

// Параметры инструмента «Гипсокартон» (change reconstruction-plan, design D8): толщина и высота в сантиметрах. Значения панели
// применяются к новым стенам; у выделенной стены панель показывает её значения, правка меняет стену, а не значения для новых.

export interface DrywallParams {
  thicknessCm: number
  heightCm: number
}

export const DRYWALL_DEFAULTS: DrywallParams = { thicknessCm: 10, heightCm: 250 }

export const newDrywallWall = (id: string, a: Point, b: Point, params: DrywallParams): DrywallWall => ({
  id,
  a: { ...a },
  b: { ...b },
  thicknessCm: params.thicknessCm,
  type: "gkl",
  heightCm: params.heightCm,
})

export const panelValues = (params: DrywallParams, selected: DrywallWall | null): DrywallParams =>
  selected ? { thicknessCm: selected.thicknessCm, heightCm: selected.heightCm } : params

const valid = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v) && v > 0

// правка поля панели: без выделения — значения для новых; с выделением — новая стена (null, если ничего не изменилось)
export function editParams(params: DrywallParams, selected: DrywallWall | null, patch: Partial<DrywallParams>): { params: DrywallParams; wall: DrywallWall | null } {
  const accepted: Partial<DrywallParams> = {
    ...(valid(patch.thicknessCm) ? { thicknessCm: patch.thicknessCm } : null),
    ...(valid(patch.heightCm) ? { heightCm: patch.heightCm } : null),
  }
  if (!selected) return { params: { ...params, ...accepted }, wall: null }
  const next = { ...selected, ...accepted }
  const changed = next.thicknessCm !== selected.thicknessCm || next.heightCm !== selected.heightCm
  return { params, wall: changed ? next : null }
}
