import type { Point, Wall } from "../types"
import { clipHalfPlane, displayPolygons, dist, jointTol, perp, polygonArea, unit } from "../wall-geometry"
import { EPS_CM, lengthOf } from "./mark-model"
import type { MarkSpan } from "./mark-model"

// Область сноса (change demolition-plan, design D3). Элементы стен сносом не скрываются (change demolition-show-elements).

const NON_EMPTY_AREA = 1e-9

// Угловая часть за концом оси: в углу она может принадлежать форме соседней стены (ту, что позже, достраивает угол),
// тогда у самой стены торцевой части нет. Берётся часть формы стен, концы которых сходятся с этим концом, внутри полосы
// стены и за плоскостью конца; стена, идущая сквозь конец (Т), не считается — её тело не угол.
function cornerPieces(wall: Wall, end: "a" | "b", walls: readonly Wall[]): Point[][] {
  const E = wall[end]
  const u = unit(wall.a, wall.b)
  const n = perp(u)
  const half = wall.thicknessCm / 2
  const outward = end === "a" ? { x: -u.x, y: -u.y } : u
  const all = [...walls]
  return walls
    .filter((c) => c !== wall && [c.a, c.b].some((v) => dist(v, E) <= jointTol(wall, c)))
    .flatMap((c) => displayPolygons(c, all))
    .map((poly) => {
      const inStrip = clipHalfPlane(clipHalfPlane(poly, E, n, -half), E, { x: -n.x, y: -n.y }, -half)
      return clipHalfPlane(inStrip, E, outward, 0)
    })
    .filter((poly) => poly.length >= 3 && polygonArea(poly) > NON_EMPTY_AREA)
}

// Форма стены (displayPolygons, со стыками), обрезанная по границам участка. Обрезки нет у границы, лежащей
// в пределах EPS_CM от конца стены: у «целой стены» область включает торцевые части формы за концами оси,
// в том числе угловую часть, принадлежащую форме соседней стены.
export function markRegion(r: MarkSpan, walls: readonly Wall[]): Point[][] {
  const u = unit(r.wall.a, r.wall.b)
  let polygons = displayPolygons(r.wall, [...walls])
  if (r.from > EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, u, r.from))
  if (r.to < lengthOf(r.wall) - EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, { x: -u.x, y: -u.y }, -r.to))
  if (r.from <= EPS_CM) polygons = [...polygons, ...cornerPieces(r.wall, "a", walls)]
  if (r.to >= lengthOf(r.wall) - EPS_CM) polygons = [...polygons, ...cornerPieces(r.wall, "b", walls)]
  return polygons.filter((poly) => poly.length >= 3 && polygonArea(poly) > NON_EMPTY_AREA)
}
