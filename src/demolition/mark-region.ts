import type { Point, Wall } from "../types"
import { clipHalfPlane, displayPolygons, polygonArea, unit } from "../wall-geometry"
import { EPS_CM, lengthOf } from "./mark-model"
import type { MarkSpan } from "./mark-model"

// Область сноса (change demolition-plan, design D3). Элементы стен сносом не скрываются (change demolition-show-elements).

// Форма стены (displayPolygons, со стыками), обрезанная по границам участка. Обрезки нет у границы, лежащей
// в пределах EPS_CM от конца стены: у «целой стены» область включает торцевые части формы за концами оси.
export function markRegion(r: MarkSpan, walls: readonly Wall[]): Point[][] {
  const u = unit(r.wall.a, r.wall.b)
  let polygons = displayPolygons(r.wall, [...walls])
  if (r.from > EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, u, r.from))
  if (r.to < lengthOf(r.wall) - EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, { x: -u.x, y: -u.y }, -r.to))
  return polygons.filter((poly) => poly.length >= 3 && polygonArea(poly) > 1e-9)
}
