import { GRID_STEP_CM } from "../types"
import type { Point, SectionLine, SectionShape, SectionsState } from "../types"
import { dragShape, figureFrame, moveShape } from "./section-shape"
import type { FigureFrame, FigurePoint } from "./section-shape"
import { pickShape } from "./section-shape-hit"
import type { ShapeRef } from "./section-shape-hit"
import { snapFaces } from "./section-shape-snap"
import { applyShapeNumber } from "./section-shape-numbers"
import type { ShapeNumberField } from "./section-shape-numbers"
import { finishShape, placingPreview, startShape } from "./section-shape-placing"
import type { ShapePlacing } from "./section-shape-placing"
import type { SectionEntry } from "./section-scene"

// Адаптер инструмента «Деталь разреза» (change add-section-shapes, design D3, D5; spec section-view «Инструмент «Деталь разреза»
// и размещение детали», «Выделение, перемещение и правка детали разреза»): двухкликовое размещение, выделение без инструмента,
// перетаскивание, стрелки, ввод чисел, удаление. Состояние чертежа остаётся в main.ts и доступно через явный хост; состояние
// жеста и выделения — здесь. Каждая операция — один шаг истории: запись содержит линии и детали до операции.

export interface SectionShapeHost {
  lines(): readonly SectionLine[]
  shapes(): readonly SectionShape[]
  entries(): readonly SectionEntry[] // линии с фигурами и их деталями — для привязки и выбора кликом
  setShapes(next: SectionShape[]): void
  recordBefore(before: SectionsState): void // одна запись истории: линии и детали до операции
  inBurst(): boolean // идёт серия нажатий стрелок (общий флаг приложения)
  startBurst(): void
  radiusCm(): number
  newId(): string
  selected(): void // деталь выделена: main снимает выделение других объектов
  changed(): void // чертёж изменён — сохранить
  redraw(): void
}

export type NudgeKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"

export interface SectionShapePreview {
  entry: SectionEntry
  first: FigurePoint
  shape: SectionShape | null // прямоугольник до курсора; null — курсор вне фигуры или даёт нулевую деталь
}

export interface SectionShapeToolAdapter {
  selectedId(): string | null
  selection(): { entry: SectionEntry; shape: SectionShape } | null
  hasDraft(): boolean
  hover(p: Point): void
  click(p: Point): boolean // клик инструментом: угол детали; true — клик принят (угол задан или деталь создана)
  cancelDraft(): void
  preview(): SectionShapePreview | null
  press(p: Point): boolean // нажатие без инструмента: выделение детали
  pick(p: Point): ShapeRef | null
  beginDrag(p: Point): boolean // нажатие на тело выделенной детали: начало перетаскивания
  dragTo(p: Point): void
  endDrag(): void
  isDragging(): boolean
  nudge(key: NudgeKey, fine: boolean): boolean // стрелка: true — клавиша принята (деталь выделена), даже если сдвига нет
  applyNumber(field: ShapeNumberField, valueCm: number): boolean
  eraseAt(p: Point): boolean
  deleteSelected(): boolean
  select(id: string): void
  deselect(): void
  reset(): void
}

const FINE_STEP_CM = 1 // Shift + стрелка

const STEP: Record<NudgeKey, FigurePoint> = {
  ArrowLeft: { s: -1, z: 0 },
  ArrowRight: { s: 1, z: 0 },
  ArrowUp: { s: 0, z: 1 },
  ArrowDown: { s: 0, z: -1 },
}

interface Drag {
  origin: SectionShape
  start: Point
  frame: FigureFrame
  faces: { s: number[]; z: number[] }
  before: readonly SectionShape[]
}

export function createSectionShapeTool(host: SectionShapeHost): SectionShapeToolAdapter {
  let placing: ShapePlacing | null = null
  let cursor: Point | null = null
  let selected: string | null = null
  let drag: Drag | null = null
  let burstFor: string | null = null

  const state = (shapes: readonly SectionShape[] = host.shapes()): SectionsState => ({ sections: [...host.lines()], shapes: [...shapes] })
  const pick = (p: Point): ShapeRef | null => pickShape(host.entries(), p, host.radiusCm())

  const selection = (): { entry: SectionEntry; shape: SectionShape } | null => {
    if (selected === null) return null
    for (const entry of host.entries()) {
      const shape = entry.shapes.find((s) => s.id === selected)
      if (shape !== undefined) return { entry, shape }
    }
    return null
  }

  const replace = (next: SectionShape): void => {
    host.setShapes(host.shapes().map((s) => (s.id === next.id ? next : s)))
  }

  // шаг истории и новое состояние одной деталью
  const commit = (next: SectionShape): void => {
    host.recordBefore(state())
    burstFor = null
    replace(next)
    host.changed()
    host.redraw()
  }

  const remove = (id: string): void => {
    const before = host.shapes()
    if (!before.some((s) => s.id === id)) return
    host.recordBefore(state(before))
    burstFor = null
    host.setShapes(before.filter((s) => s.id !== id))
    if (selected === id) selected = null
    host.changed()
    host.redraw()
  }

  return {
    selectedId: () => selected,
    selection,
    hasDraft: () => placing !== null,
    hover(p) {
      cursor = p
    },
    click(p) {
      const entries = host.entries()
      if (placing === null) {
        const next = startShape(entries, p, host.radiusCm())
        if (next === null) return false
        placing = next
        selected = null
        host.redraw()
        return true
      }
      const shape = finishShape(placing, entries, p, host.radiusCm(), host.newId())
      if (shape === null) return false
      placing = null
      host.recordBefore(state())
      burstFor = null
      host.setShapes([...host.shapes(), shape])
      selected = shape.id
      host.selected()
      host.changed()
      host.redraw()
      return true
    },
    cancelDraft() {
      placing = null
      host.redraw()
    },
    preview() {
      if (placing === null) return null
      const entry = host.entries().find((e) => e.line.id === placing?.lineId)
      if (entry === undefined) return null
      return { entry, first: placing.first, shape: cursor === null ? null : placingPreview(placing, host.entries(), cursor, host.radiusCm()) }
    },
    press(p) {
      const ref = pick(p)
      if (ref === null) return false
      selected = ref.shapeId
      host.selected()
      host.redraw()
      return true
    },
    pick,
    beginDrag(p) {
      const sel = selection()
      if (sel === null || pick(p)?.shapeId !== sel.shape.id) return false
      drag = { origin: sel.shape, start: p, frame: figureFrame(sel.entry.figure), faces: snapFaces(sel.entry, sel.shape.id), before: host.shapes() }
      return true
    },
    dragTo(p) {
      if (drag === null) return
      const next = dragShape(drag.origin, p.x - drag.start.x, -(p.y - drag.start.y), drag.frame, { ...drag.faces, radiusCm: host.radiusCm() }) ?? drag.origin
      replace(next)
      host.redraw()
    },
    endDrag() {
      if (drag === null) return
      const done = drag
      drag = null
      const now = host.shapes().find((s) => s.id === done.origin.id)
      if (now === undefined || (now.s0 === done.origin.s0 && now.z0 === done.origin.z0)) return
      host.recordBefore(state(done.before))
      burstFor = null
      host.changed()
      host.redraw()
    },
    isDragging: () => drag !== null,
    nudge(key, fine) {
      const sel = selection()
      if (sel === null) return false
      const step = fine ? FINE_STEP_CM : GRID_STEP_CM
      const next = moveShape(sel.shape, STEP[key].s * step, STEP[key].z * step, figureFrame(sel.entry.figure))
      if (next === null) return true
      // серия подряд идущих нажатий по одной детали — один шаг истории
      if (!(burstFor === sel.shape.id && host.inBurst())) host.recordBefore(state())
      host.startBurst()
      burstFor = sel.shape.id
      replace(next)
      host.changed()
      host.redraw()
      return true
    },
    applyNumber(field, valueCm) {
      const sel = selection()
      if (sel === null) return false
      const next = applyShapeNumber(sel.entry, sel.shape, field, valueCm)
      if (next === null) return false
      commit(next)
      return true
    },
    eraseAt(p) {
      const ref = pick(p)
      if (ref === null) return false
      remove(ref.shapeId)
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
      burstFor = null
    },
  }
}
