import type { Point, Wall } from "../types"
import { clipHalfPlane, displayPolygons, polygonArea, unit } from "../wall-geometry"
import { neighborCuts } from "./mark-ends"
import { EPS_CM, lengthOf } from "./mark-model"
import type { MarkSpan } from "./mark-model"

// Область сноса (change demolition-plan, design D3). Элементы стен сносом не скрываются (change demolition-show-elements).

const NON_EMPTY_AREA = 1e-9

// Форма стены (displayPolygons, со стыками), обрезанная по границам участка. Обрезки нет у границы, лежащей
// в пределах EPS_CM от конца стены: у «целой стены» область включает торцевую часть собственной формы за концом оси.
// Область не заходит в тело соседних стен: у их ближних граней форма срезается (change demolition-no-neighbor-overlap).
export function markRegion(r: MarkSpan, walls: readonly Wall[]): Point[][] {
  const u = unit(r.wall.a, r.wall.b)
  let polygons = displayPolygons(r.wall, [...walls])
  if (r.from > EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, u, r.from))
  if (r.to < lengthOf(r.wall) - EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, { x: -u.x, y: -u.y }, -r.to))
  for (const cut of neighborCuts(r.wall, walls)) polygons = polygons.map((poly) => clipHalfPlane(poly, cut.origin, cut.normal, 0))
  return polygons.filter((poly) => poly.length >= 3 && polygonArea(poly) > NON_EMPTY_AREA)
}
