import { wallNearBody } from "../doorway/doorway-scene"
import type { DemolitionMark, Point, Unit, Wall, WallElement } from "../types"
import { dist, dot, sub, unit as unitVector } from "../wall-geometry"
import { alongNodes, snapAlong } from "./mark-snap"
import { markDimensions } from "./mark-dimensions"
import { editNumber, markNumberAt } from "./mark-numbers"
import type { MarkNumberSpot, NumberRef } from "./mark-numbers"
import { canDemolish } from "./mark-model"
import { EPS_CM, MIN_WIDTH_CM, addMark, effectiveMarks, markAt, removeMark, sameMarks, span } from "./marks"

// Инструмент «Демонтаж», выделение пометки и правка чисел на месте (change demolition-plan, design D10): состояние
// жеста и выделения без DOM. Данные чертежа, история и перерисовка — через явный DemolitionToolHost.

export interface DemolitionToolHost {
  walls(): readonly Wall[]
  elements(): readonly WallElement[]
  marks(): DemolitionMark[]
  setMarks(next: DemolitionMark[]): void // заменить пометки чертежа
  record(): void // одна запись истории (снимок текущих пометок) — перед setMarks и только при изменении
  changed(): void // чертёж изменён — сохранить (вызывается после setMarks)
  redraw(): void
  radiusCm(): number // радиус привязки
  newId(): string
}

// превью протяжки: участок стены от конца a
export interface Ghost {
  wallId: string
  from: number
  to: number
}

export interface DemolitionTool {
  down(p: Point, px: Point): void // p — мир (см), px — экранная точка (мёртвая зона жеста — в px)
  move(p: Point, px: Point): void
  up(p: Point, px: Point): string | null // идентификатор поставленной (слитой) пометки; null — ничего не поставлено
  cancel(): void // Escape: прервать протяжку без изменений
  dragging(): boolean
  ghost(): Ghost | null
  select(p: Point): boolean // без инструмента: выделить пометку под точкой; false — выделение снято
  selectedId(): string | null
  clearSelection(): void
  deleteSelected(): boolean
  numberAt(p: Point, unit: Unit, k: number, labelPx: number, tolCm: number): MarkNumberSpot | null // правимое число выделенной
  applyNumber(ref: NumberRef, valueCm: number): boolean
  erase(p: Point): boolean // ластик: снять пометку под точкой одним шагом истории; false — под точкой нет области сноса
  eraseTarget(p: Point): string | null // идентификатор пометки под точкой (подсветка ластика)
}

const DEAD_ZONE_PX = 4 // сдвиг до этого — ещё клик

interface Press {
  wall: Wall
  p: Point
  px: Point
}

export function createDemolitionTool(host: DemolitionToolHost): DemolitionTool {
  let press: Press | null = null
  let dragging = false
  let ghost: Ghost | null = null
  let selected: string | null = null

  // замена пометок одним шагом истории; без изменений (тот же массив) — ни шага, ни сохранения
  const commit = (next: DemolitionMark[]): boolean => {
    if (next === host.marks()) return false
    host.record()
    host.setMarks(next)
    host.changed()
    host.redraw()
    return true
  }

  // границы участка протяжки от конца a: проекции точки нажатия и точки p на ось, с привязкой к узлам
  const bounds = (pr: Press, p: Point): [number, number] => {
    const { wall } = pr
    const axis = unitVector(wall.a, wall.b)
    const nodes = alongNodes(wall, host.walls(), host.elements())
    const snapped = (q: Point): number => snapAlong(dot(sub(q, wall.a), axis), nodes, host.radiusCm(), dist(wall.a, wall.b))
    const t0 = snapped(pr.p)
    const t1 = snapped(p)
    return [Math.min(t0, t1), Math.max(t0, t1)]
  }

  // Постановка участка [from, to] от конца a: поставленная (слитая) пометка выделяется до замены списка, чтобы
  // перерисовка уже видела выделение; возвращается её идентификатор, null — список не изменился (change
  // demolition-select-after-mark, design D1)
  const place = (wall: Wall, from: number, to: number): string | null => {
    const marks = host.marks()
    const next = addMark(marks, host.walls(), wall.id, from, to, host.newId)
    if (next === marks) return null
    const lo = Math.max(0, from)
    const hi = Math.min(dist(wall.a, wall.b), to)
    const placed = next.find((m) => {
      if (m.wallId !== wall.id) return false
      const [start, end] = span(m, wall)
      return start <= lo + EPS_CM && end >= hi - EPS_CM
    })
    if (placed) selected = placed.id
    commit(next)
    return placed?.id ?? null
  }

  const reset = (): void => {
    press = null
    dragging = false
    ghost = null
  }

  const selectedMark = () => effectiveMarks(host.marks(), host.walls(), host.elements()).find((r) => r.mark.id === selected)

  return {
    down(p, px) {
      // стена из железобетона или с окном не сносится: нажатие на неё жеста не начинает
      const wall = wallNearBody(p, host.walls(), host.radiusCm())
      press = wall && canDemolish(wall, host.elements()) ? { wall, p, px } : null
      dragging = false
      ghost = null
    },
    move(p, px) {
      if (!press) return
      if (!dragging) {
        if (dist(px, press.px) <= DEAD_ZONE_PX) return
        dragging = true
      }
      const [from, to] = bounds(press, p)
      ghost = { wallId: press.wall.id, from, to }
      host.redraw()
    },
    up(p, px) {
      const pr = press
      const drag = dragging || (pr !== null && dist(px, pr.px) > DEAD_ZONE_PX)
      reset()
      if (!pr) return null
      const marks = host.marks()
      const walls = host.walls()
      const [from, to] = bounds(pr, p)
      let placed: string | null = null
      if (drag && to - from >= MIN_WIDTH_CM) {
        placed = place(pr.wall, from, to)
      } else {
        // клик: по неснесённой части — пометить стену целиком; по снесённой области ничего не меняется (снимает ластик)
        const hit = markAt(pr.p, effectiveMarks(marks, walls, host.elements()), walls)
        if (!hit) placed = place(pr.wall, 0, dist(pr.wall.a, pr.wall.b))
      }
      host.redraw()
      return placed
    },
    cancel() {
      reset()
      host.redraw()
    },
    dragging: () => dragging,
    ghost: () => ghost,
    select(p) {
      const hit = markAt(p, effectiveMarks(host.marks(), host.walls(), host.elements()), host.walls())
      selected = hit ? hit.mark.id : null
      host.redraw()
      return hit !== null
    },
    selectedId: () => selected,
    clearSelection() {
      selected = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return commit(removeMark(host.marks(), id))
    },
    numberAt(p, unit, k, labelPx, tolCm) {
      const r = selectedMark()
      return r ? markNumberAt(p, markDimensions(r, host.walls(), "chain", unit, k, labelPx).map((d) => d.spot), tolCm) : null
    },
    erase(p) {
      const hit = markAt(p, effectiveMarks(host.marks(), host.walls(), host.elements()), host.walls())
      if (!hit) return false
      if (hit.mark.id === selected) selected = null
      return commit(removeMark(host.marks(), hit.mark.id))
    },
    eraseTarget: (p) => markAt(p, effectiveMarks(host.marks(), host.walls(), host.elements()), host.walls())?.mark.id ?? null,
    applyNumber(ref, valueCm) {
      if (selected === null) return false
      const edited = editNumber(host.marks(), host.walls(), selected, ref.target, ref.side, valueCm)
      if (!edited || sameMarks(edited.marks, host.marks())) return false
      selected = edited.id // выделение следует за слитой пометкой; перерисовка в commit уже видит его
      return commit(edited.marks)
    },
  }
}
