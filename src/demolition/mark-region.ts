import { jambsT } from "../doorway/doorway-faces"
import type { Point, Wall, WallElement } from "../types"
import { clipHalfPlane, displayPolygons, polygonArea, unit } from "../wall-geometry"
import { EPS_CM, lengthOf } from "./mark-model"
import type { MarkSpan, ResolvedMark } from "./mark-model"

// Область сноса и скрытие элементов (change demolition-plan, design D3).

// Форма стены (displayPolygons, со стыками), обрезанная по границам участка. Обрезки нет у границы, лежащей
// в пределах EPS_CM от конца стены: у «целой стены» область включает торцевые части формы за концами оси.
export function markRegion(r: MarkSpan, walls: readonly Wall[]): Point[][] {
  const u = unit(r.wall.a, r.wall.b)
  let polygons = displayPolygons(r.wall, [...walls])
  if (r.from > EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, u, r.from))
  if (r.to < lengthOf(r.wall) - EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, { x: -u.x, y: -u.y }, -r.to))
  return polygons.filter((poly) => poly.length >= 3 && polygonArea(poly) > 1e-9)
}

// Элемент скрыт, если его участок между откосами пересекается с участком сноса своей стены на длину больше
// EPS_CM; касание не скрывает (spec «Элементы стены в зоне сноса»).
export function hiddenElements(elements: readonly WallElement[], resolved: readonly ResolvedMark[]): WallElement[] {
  return elements.filter((el) =>
    resolved.some((r) => {
      if (r.wall.id !== el.wallId) return false
      const [near, far] = jambsT(el, r.wall)
      return Math.min(r.to, far) - Math.max(r.from, near) > EPS_CM
    }),
  )
}

export function visibleElements(elements: readonly WallElement[], resolved: readonly ResolvedMark[]): WallElement[] {
  const hidden = new Set(hiddenElements(elements, resolved))
  return elements.filter((el) => !hidden.has(el))
}
