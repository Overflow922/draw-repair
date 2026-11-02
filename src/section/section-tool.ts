import type { Point, SectionLine } from "../types"
import type { SectionPreview } from "./section-draw"
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
  eraseAt(p: Point): boolean
  deleteSelected(): boolean
  select(id: string): void
  deselect(): void
  reset(): void
}

export function createSectionTool(host: SectionToolHost): SectionToolAdapter {
  let placing: Placing | null = null
  let cursor: Point | null = null
  let selected: string | null = null

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
    },
  }
}
