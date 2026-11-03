import type { Point, SectionLine } from "../types"
import type { SectionPreview } from "./section-draw"
import type { Bounds } from "./section-layout"
import { figureObstacles, figureRect } from "./section-figure-obstacles"
import type { FigureObstacleSources } from "./section-figure-obstacles"
import { moveFigure } from "./section-figure-move"
import { pickSection } from "./section-hit"
import { addVertex, completeLine, finishVertices, nextVertex, sideView, startPlacing } from "./section-placing"
import type { Placing } from "./section-placing"
import { checkSectionLine, nextSectionLabel } from "./section-line"
import type { SectionEntry } from "./section-scene"

// Адаптер инструмента «Разрез» (change add-section-view, design D6, D7): размещение линии (вершины → направление), выделение
// без инструмента, удаление. Состояние чертежа остаётся в main.ts и доступно через явный SectionToolHost; состояние жеста и
// выделения — здесь. Линии не перемещаются и не растягиваются (spec section-view «Выделение и удаление линии разреза»).

export interface SectionToolHost {
  lines(): readonly SectionLine[] // линии разреза активного плана
  entries(): readonly SectionEntry[] // те же линии с вычисленными фигурами — для выбора кликом
  setLines(next: SectionLine[]): void
  recordBefore(before: readonly SectionLine[]): void // одна запись истории: список до операции
  snap(p: Point): Point // привязка вершины: сетка и вершины стен
  radiusCm(): number
  newId(): string
  selected(): void // линия выделена: main снимает выделение других объектов
  changed(): void // чертёж изменён — сохранить
  redraw(): void
}

export interface SectionToolAdapter {
  selectedId(): string | null
  hasDraft(): boolean // размещение начато и не завершено
  hover(p: Point): void
  click(p: Point): void // клик инструментом: вершина или, на шаге направления, создание линии
  finish(): boolean // Enter и двойной клик: завершить набор вершин; true — действие принято
  cancelDraft(): void
  preview(): SectionPreview | null
  press(p: Point): boolean // нажатие без инструмента: выделение линии
  pick(p: Point): string | null
  beginDrag(p: Point): boolean // нажатие на фигуру выделенной линии: начало перемещения фигуры
  dragTo(p: Point): void
  endDrag(): void
  isDragging(): boolean
  eraseAt(p: Point): boolean
  deleteSelected(): boolean
  select(id: string): void
  deselect(): void
  reset(): void
}

// перемещение фигуры (change move-section-figure, design D3, D4): позиция считается от начала жеста, препятствия — на его начало
interface FigureDrag {
  lineId: string
  start: Point
  origin: Point
  before: readonly SectionLine[]
  obstacles: readonly (readonly Point[])[]
  rectAt: (position: Point) => Bounds
}

// что не должна занимать фигура при перемещении, кроме фигур и линий разреза: объекты плана и размер названия (change move-section-figure)
export type FigureSurroundings = (lineId: string) => Pick<FigureObstacleSources, "plan" | "title">

const NO_SURROUNDINGS: FigureSurroundings = () => ({ plan: [], title: { width: 0, height: 0 } })

export function createSectionTool(host: SectionToolHost, surroundings: FigureSurroundings = NO_SURROUNDINGS): SectionToolAdapter {
  let placing: Placing | null = null
  let cursor: Point | null = null
  let selected: string | null = null
  let drag: FigureDrag | null = null

  const withPosition = (lines: readonly SectionLine[], id: string, at: Point): SectionLine[] =>
    lines.map((l) => (l.id === id ? { ...l, figureAt: at } : l))

  const pick = (p: Point): string | null => pickSection(host.entries(), p, host.radiusCm())

  const remove = (id: string): void => {
    const before = host.lines()
    if (!before.some((l) => l.id === id)) return
    host.recordBefore(before)
    host.setLines(before.filter((l) => l.id !== id))
    if (selected === id) selected = null
    host.changed()
    host.redraw()
  }

  return {
    selectedId: () => selected,
    hasDraft: () => placing !== null,
    hover(p) {
      cursor = p
    },
    click(p) {
      if (placing === null) {
        placing = startPlacing(host.snap(p))
        selected = null
        host.redraw()
        return
      }
      if (placing.phase === "vertices") {
        placing = addVertex(placing, host.snap(p))
        host.redraw()
        return
      }
      const before = host.lines()
      const line = completeLine(placing, p, host.newId(), before.map((l) => l.label))
      if (line === null) return
      placing = null
      host.recordBefore(before)
      host.setLines([...before, line])
      selected = line.id
      host.selected()
      host.changed()
      host.redraw()
    },
    finish() {
      if (placing === null || placing.phase !== "vertices") return false
      const next = finishVertices(placing)
      if (next === placing) return true // чётное число отрезков: набор продолжается, действие поглощено
      placing = next
      host.redraw()
      return true
    },
    cancelDraft() {
      placing = null
      host.redraw()
    },
    preview() {
      if (placing === null) return null
      if (placing.phase === "vertices") {
        const target = cursor === null ? null : nextVertex(placing.points, host.snap(cursor))
        return { points: placing.points, cursor: target, line: null }
      }
      if (cursor === null) return { points: placing.points, cursor: null, line: null }
      const view = sideView(placing.points, cursor)
      const line: SectionLine = { id: "", label: nextSectionLabel(host.lines().map((l) => l.label)), view, points: placing.points }
      return { points: placing.points, cursor: null, line: checkSectionLine(line.points, view).ok ? line : null }
    },
    press(p) {
      const id = pick(p)
      if (id === null) return false
      selected = id
      host.selected()
      host.redraw()
      return true
    },
    pick,
    beginDrag(p) {
      if (selected === null) return false
      const entries = host.entries()
      const entry = entries.find((e) => e.line.id === selected)
      if (entry === undefined) return false
      const around = surroundings(selected)
      const own = figureRect(entry.placement, around.title)
      if (p.x < own.minX || p.x > own.maxX || p.y < own.minY || p.y > own.maxY) return false
      const { width, height } = entry.placement
      drag = {
        lineId: entry.line.id,
        start: p,
        origin: { x: entry.placement.x, y: entry.placement.floorY },
        before: host.lines(),
        obstacles: figureObstacles({ entries, lineId: entry.line.id, ...around }),
        rectAt: (position) => figureRect({ ...entry.placement, x: position.x, floorY: position.y, width, height }, around.title),
      }
      return true
    },
    dragTo(p) {
      if (drag === null) return
      const at = moveFigure(drag.origin, { x: p.x - drag.start.x, y: p.y - drag.start.y }, { rectAt: drag.rectAt, obstacles: drag.obstacles })
      host.setLines(withPosition(drag.before, drag.lineId, at))
      host.redraw()
    },
    endDrag() {
      if (drag === null) return
      const done = drag
      drag = null
      const now = host.lines().find((l) => l.id === done.lineId)
      const moved = now?.figureAt !== undefined && (now.figureAt.x !== done.origin.x || now.figureAt.y !== done.origin.y)
      if (!moved) {
        // фигура не сдвинулась: как было до жеста (поле не появляется), шага истории нет
        host.setLines([...done.before])
        host.redraw()
        return
      }
      host.recordBefore(done.before)
      host.changed()
      host.redraw()
    },
    isDragging: () => drag !== null,
    eraseAt(p) {
      const id = pick(p)
      if (id === null) return false
      remove(id)
      return true
    },
    deleteSelected() {
      if (selected === null) return false
      remove(selected)
      return true
    },
    select(id) {
      selected = id
    },
    deselect() {
      selected = null
    },
    reset() {
      placing = null
      cursor = null
      selected = null
      drag = null
    },
  }
}
