import type { Point, SectionLine, SectionView } from "../types"
import { checkSectionLine, nextSectionLabel } from "./section-line"

// Размещение линии разреза (change add-section-view, design D6; spec section-view «Инструмент «Разрез» и размещение линии»):
// клики задают вершины, затем завершение набора и выбор стороны взгляда. Чистые функции, состояние не мутируется.

export type Placing = { phase: "vertices"; points: Point[] } | { phase: "side"; points: Point[] }

export const startPlacing = (first: Point): Placing => ({ phase: "vertices", points: [{ x: first.x, y: first.y }] })

// первый отрезок лежит вдоль X, если вторая вершина имеет тот же Y; пока её нет, ось задаёт курсор
const firstAxisHorizontal = (points: readonly Point[], cursor: Point): boolean =>
  points.length >= 2 ? points[1].y === points[0].y : Math.abs(cursor.x - points[0].x) >= Math.abs(cursor.y - points[0].y)

// вершина, в которую встанет клик: проекция курсора на ось нового отрезка; null — клик не принимается
// (отрезок нулевой длины или рабочий отрезок идёт назад относительно первого)
export function nextVertex(points: readonly Point[], cursor: Point): Point | null {
  const last = points[points.length - 1]
  const index = points.length - 1 // номер нового отрезка
  const horizontal = firstAxisHorizontal(points, cursor) === (index % 2 === 0)
  const next = horizontal ? { x: cursor.x, y: last.y } : { x: last.x, y: cursor.y }
  const dx = next.x - last.x
  const dy = next.y - last.y
  if (dx === 0 && dy === 0) return null
  if (index % 2 === 0 && index > 0) {
    // рабочий отрезок идёт в ту же сторону, что первый
    const first = Math.sign(points[1].x - points[0].x) + Math.sign(points[1].y - points[0].y)
    if (Math.sign(dx) + Math.sign(dy) !== first) return null
  }
  return next
}

export function addVertex(state: Placing, cursor: Point): Placing {
  if (state.phase !== "vertices") return state
  const next = nextVertex(state.points, cursor)
  return next === null ? state : { phase: "vertices", points: [...state.points, next] }
}

// завершить набор можно при нечётном числе отрезков (первый и последний перпендикулярны взгляду)
export const canFinish = (state: Placing): boolean => state.phase === "vertices" && state.points.length >= 2 && (state.points.length - 1) % 2 === 1

export const finishVertices = (state: Placing): Placing => (canFinish(state) ? { phase: "side", points: state.points } : state)

// взгляд — на сторону первого отрезка, где лежит курсор
export function sideView(points: readonly Point[], cursor: Point): SectionView {
  const horizontal = points[1].y === points[0].y
  if (horizontal) return cursor.y < points[0].y ? "up" : "down"
  return cursor.x > points[0].x ? "right" : "left"
}

// линия по завершённому размещению; null — не на шаге направления или линия недопустима
export function completeLine(state: Placing, cursor: Point, id: string, takenLabels: readonly string[]): SectionLine | null {
  if (state.phase !== "side") return null
  const view = sideView(state.points, cursor)
  if (!checkSectionLine(state.points, view).ok) return null
  return { id, label: nextSectionLabel(takenLabels), view, points: state.points.map((p) => ({ x: p.x, y: p.y })) }
}
