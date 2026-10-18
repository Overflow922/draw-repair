import { MIN_WIDTH_CM, EPS_CM } from "../demolition/mark-model"
import { markDimensions } from "../demolition/mark-dimensions"
import { markNumberAt } from "../demolition/mark-numbers"
import type { MarkNumberSpot } from "../demolition/mark-numbers"
import { alongNodes, snapAlong } from "../demolition/mark-snap"
import { wallNearBody } from "../doorway/doorway-scene"
import type { PlasterMark, Point, Unit, Wall } from "../types"
import { dist, dot, perp, pointInPolygon, sub, unit as unitVector } from "../wall-geometry"
import { plasterOrigins, plasterSources, plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { addPlaster, editPlasterNumber, removePlaster, samePlaster, setPlasterThickness } from "./plaster-marks"
import type { PlasterGhost } from "./rough-render"
import type { RoughScene } from "./rough-scene"
import type { Drawing } from "../types"

// Инструмент «Штукатурка», выделение пометки и правка чисел на месте (change add-rough-works-plan, design D3, D8): состояние
// жеста и выделения без DOM. Данные чертежа, история и перерисовка — через явный PlasterToolHost.

export interface PlasterToolHost {
  drawing(): Drawing
  scene(): RoughScene // подложка и действующие куски пометок на текущий момент
  marks(): PlasterMark[]
  setMarks(next: PlasterMark[]): void
  record(): void // одна запись истории (снимок списков до операции) — перед setMarks и только при изменении
  changed(): void
  redraw(): void
  radiusCm(): number
  newId(): string
  newThicknessMm(): number // толщина из панели инструмента — для новых пометок
}

export interface PlasterNumberSpot extends MarkNumberSpot {
  piece: PlasterPiece
}

export interface PlasterTool {
  down(p: Point, px: Point): void
  move(p: Point, px: Point): void
  up(p: Point, px: Point): string | null // идентификатор поставленной (слитой) пометки; null — ничего не поставлено
  cancel(): void
  dragging(): boolean
  ghost(): PlasterGhost | null
  select(p: Point): boolean // без инструмента: выделить пометку под точкой; false — выделение снято
  selectedId(): string | null
  selectedMark(): PlasterMark | null
  clearSelection(): void
  deleteSelected(): boolean
  setSelectedThickness(mm: number): boolean
  numberAt(p: Point, unit: Unit, k: number, labelPx: number, tolCm: number): PlasterNumberSpot | null
  applyNumber(spot: PlasterNumberSpot, valueCm: number): boolean
  erase(p: Point): boolean
  eraseTarget(p: Point): string | null
}

const DEAD_ZONE_PX = 4

interface Press {
  wall: Wall // стена подложки, на которой нажали
  face: 1 | -1
  p: Point
  px: Point
}

export function createPlasterTool(host: PlasterToolHost): PlasterTool {
  let press: Press | null = null
  let dragging = false
  let ghost: PlasterGhost | null = null
  let selected: string | null = null

  const commit = (next: PlasterMark[]): boolean => {
    if (samePlaster(next, host.marks())) return false
    host.record()
    host.setMarks(next)
    host.changed()
    host.redraw()
    return true
  }

  // грань, у которой лежит точка нажатия: сторона оси, на которой она находится
  const faceOf = (wall: Wall, p: Point): 1 | -1 => (dot(sub(p, wall.a), perp(unitVector(wall.a, wall.b))) >= 0 ? 1 : -1)

  // границы протяжки вдоль стены подложки от её конца a: проекции точек нажатия и p на ось с привязкой к узлам, в пределах стены
  const bounds = (pr: Press, p: Point): [number, number] => {
    const scene = host.scene().base
    const { wall } = pr
    const len = dist(wall.a, wall.b)
    const axis = unitVector(wall.a, wall.b)
    const nodes = alongNodes(wall, scene.walls, scene.doorways)
    const snapped = (q: Point): number => Math.min(Math.max(snapAlong(dot(sub(q, wall.a), axis), nodes, host.radiusCm(), len), 0), len)
    const t0 = snapped(pr.p)
    const t1 = snapped(p)
    return [Math.min(t0, t1), Math.max(t0, t1)]
  }

  // Постановка на стене подложки: участок переводится в координаты исходной стены; слияние — только с действующими пометками,
  // скрытые остаются без изменений. Поставленная (слитая) пометка выделяется; возвращается её идентификатор.
  const place = (pr: Press, lo: number, hi: number): string | null => {
    const origin = plasterOrigins(host.drawing()).get(pr.wall.id)
    if (!origin) return null
    const marks = host.marks()
    const acting = new Set(host.scene().pieces.map((x) => x.mark.id))
    const live = marks.filter((m) => acting.has(m.id))
    const merged = addPlaster(live, plasterSources(host.drawing()), origin.source.id, pr.face, origin.start + lo, origin.start + hi, host.newThicknessMm(), host.newId)
    if (merged === live) return null
    const hidden = marks.filter((m) => !acting.has(m.id))
    const next = hidden.length === 0 ? merged : [...hidden, ...merged]
    const placed = next.find((m) => {
      if (m.wallId !== origin.source.id || m.face !== pr.face) return false
      const len = dist(origin.source.a, origin.source.b)
      const [start, end] = m.anchor === "a" ? [m.fromCm, m.toCm] : [len - m.toCm, len - m.fromCm]
      return start <= origin.start + lo + EPS_CM && end >= origin.start + hi - EPS_CM
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

  // пометка под точкой: куски пометок рисуются в порядке списка, сверху — последний
  const markAt = (p: Point): PlasterMark | null => {
    const pieces = host.scene().pieces
    for (let i = pieces.length - 1; i >= 0; i--) {
      const piece = pieces[i]
      if (piece && pointInPolygon(p, plasterStrip(piece))) return piece.mark
    }
    return null
  }

  return {
    down(p, px) {
      const wall = wallNearBody(p, host.scene().base.walls, host.radiusCm())
      press = wall ? { wall, face: faceOf(wall, p), p, px } : null
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
      ghost = { wall: press.wall, from, to, face: press.face, thicknessMm: host.newThicknessMm() }
      host.redraw()
    },
    up(p, px) {
      const pr = press
      const drag = dragging || (pr !== null && dist(px, pr.px) > DEAD_ZONE_PX)
      reset()
      if (!pr) return null
      // участок ставит только протяжка; клик ничего не меняет
      const [from, to] = bounds(pr, p)
      const placed = drag && to - from >= MIN_WIDTH_CM ? place(pr, from, to) : null
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
      const hit = markAt(p)
      selected = hit ? hit.id : null
      host.redraw()
      return hit !== null
    },
    selectedId: () => selected,
    selectedMark: () => host.marks().find((m) => m.id === selected) ?? null,
    clearSelection() {
      selected = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return commit(removePlaster(host.marks(), id))
    },
    setSelectedThickness(mm) {
      if (selected === null) return false
      return commit(setPlasterThickness(host.marks(), selected, mm))
    },
    numberAt(p, unit, k, labelPx, tolCm) {
      const mark = host.marks().find((m) => m.id === selected)
      if (!mark) return null
      const walls = host.scene().base.walls
      const spots = host
        .scene()
        .pieces.filter((piece) => piece.mark.id === mark.id)
        .flatMap((piece) => markDimensions(piece, walls, "chain", unit, k, labelPx).filter((d) => d.side === mark.face).map((d): PlasterNumberSpot => ({ ...d.spot, piece })))
      const hit = markNumberAt(p, spots, tolCm)
      return hit ? spots.find((s) => s.piece === (hit as PlasterNumberSpot).piece && s.target === hit.target && s.side === hit.side) ?? null : null
    },
    applyNumber(spot, valueCm) {
      if (selected === null) return false
      const origin = plasterOrigins(host.drawing()).get(spot.piece.wall.id)
      if (!origin) return false
      const edited = editPlasterNumber(host.marks(), plasterSources(host.drawing()), host.scene().base.walls, spot.piece, origin.start, spot.target, valueCm)
      if (!edited || samePlaster(edited.marks, host.marks())) return false
      selected = edited.id
      return commit(edited.marks)
    },
    erase(p) {
      const hit = markAt(p)
      if (!hit) return false
      if (hit.id === selected) selected = null
      return commit(removePlaster(host.marks(), hit.id))
    },
    eraseTarget: (p) => markAt(p)?.id ?? null,
  }
}
