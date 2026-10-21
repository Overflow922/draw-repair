import type { Point, Wall } from "../types"
import { clipHalfPlane, displayPolygons, dist, polygonArea, unit } from "../wall-geometry"
import { cornerCells, neighborCuts } from "./mark-ends"
import type { CornerOwner } from "./mark-ends"
import { EPS_CM, lengthOf } from "./mark-model"
import type { MarkSpan } from "./mark-model"

// Область сноса (change demolition-plan, design D3). Элементы стен сносом не скрываются (change demolition-show-elements).

const NON_EMPTY_AREA = 1e-9

// допуск совпадения концов осей в стыке, см
const JOINT_CM = 0.5

// Владелец углового квадрата (change demolition-corner-owner, design D1): стена, нарисованная позже, если ось соседа
// сходится с её концом E и сосед тоже помечен до этого стыка; помечена одна стена — сосед остаётся целым вместе с квадратом.
function cornerOwner(wall: Wall, walls: readonly Wall[], marks: readonly MarkSpan[]): CornerOwner {
  return (c, E) => {
    if (walls.indexOf(wall) <= walls.indexOf(c)) return false
    const atA = dist(E, c.a) <= JOINT_CM
    if (!atA && dist(E, c.b) > JOINT_CM) return false
    return marks.some((m) => m.wall === c && (atA ? m.from <= EPS_CM : m.to >= lengthOf(c) - EPS_CM))
  }
}

// Форма стены (displayPolygons, со стыками), обрезанная по границам участка. Обрезки нет у границы, лежащей
// в пределах EPS_CM от конца стены: у «целой стены» область включает торцевую часть собственной формы за концом оси.
// Область не заходит в тело соседних стен: у их ближних граней форма срезается (change demolition-no-neighbor-overlap).
// marks — все действующие пометки плана: по ним определяется владелец углового квадрата.
export function markRegion(r: MarkSpan, walls: readonly Wall[], marks: readonly MarkSpan[] = []): Point[][] {
  const u = unit(r.wall.a, r.wall.b)
  let polygons = displayPolygons(r.wall, [...walls])
  if (r.from > EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, u, r.from))
  if (r.to < lengthOf(r.wall) - EPS_CM) polygons = polygons.map((poly) => clipHalfPlane(poly, r.wall.a, { x: -u.x, y: -u.y }, -r.to))
  const owns = cornerOwner(r.wall, walls, marks)
  for (const cut of neighborCuts(r.wall, walls, owns)) polygons = polygons.map((poly) => clipHalfPlane(poly, cut.origin, cut.normal, 0))
  // угловой квадрат у конца стены, которым она владеет, сносится вместе с ней, если участок доходит до этого конца
  const len = lengthOf(r.wall)
  const reached = (end: "a" | "b"): boolean => (end === "a" ? r.from <= EPS_CM : r.to >= len - EPS_CM)
  const cells = cornerCells(r.wall, walls, owns).filter(({ end }) => reached(end)).map(({ cell }) => cell)
  return [...polygons, ...cells].filter((poly) => poly.length >= 3 && polygonArea(poly) > NON_EMPTY_AREA)
}
