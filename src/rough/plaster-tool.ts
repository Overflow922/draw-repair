import { EPS_CM } from "../demolition/mark-model"
import { markNumberAt } from "../demolition/mark-numbers"
import type { MarkNumberSpot } from "../demolition/mark-numbers"
import { alongNodes, snapAlong } from "../demolition/mark-snap"
import type { PlasterMark, Point, Unit } from "../types"
import { dist, dot, pointInPolygon, sub, unit as unitVector } from "../wall-geometry"
import { plasterOrigins, plasterSources, plasterSpan, plasterStrip } from "./plaster"
import type { PlasterOrigin, PlasterPiece } from "./plaster"
import { addPlaster, addPlasterEnd, editPlasterNumber, removePlaster, samePlaster, setPlasterThickness } from "./plaster-marks"
import { plasterDimensions } from "./plaster-dimensions"
import { plasterTarget } from "./plaster-face"
import type { EndTargetPiece, PlasterTarget, SideTargetPiece, SourceEnd } from "./plaster-face"
import type { PlasterGhost } from "./rough-render"
import type { RoughScene } from "./rough-scene"
import type { Drawing } from "../types"

// Инструмент «Штукатурка», выделение пометки и правка чисел на месте (change add-rough-works-plan, design D3, D8; жест —
// change plaster-click-whole-face; протяжка — change plaster-partial-drag): состояние наведения, протяжки и выделения без DOM.
// Данные чертежа, история и перерисовка — через явный PlasterToolHost.

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
  hover(p: Point | null): void // наведение: подсвечивается цель под курсором; null — курсор ушёл с плана
  down(px: Point, p?: Point): void // нажатие: экранная точка (клик или протяжка) и точка мира — по ней определяется нажатая стена; без неё протяжки нет
  move(p: Point, px: Point): void // протяжка дальше мёртвой зоны: превью участка нажатой стены
  dragging(): boolean // идёт протяжка (нажатие на стене и сдвиг дальше мёртвой зоны)
  // Клик ставит штукатурку на всю цель и пометку не выделяет, протяжка ставит участок нажатой стены и выделяет его пометку.
  // Идентификатор поставленной (слитой) пометки; null — ничего не поставлено
  up(p: Point, px: Point): string | null
  cancel(): void // Escape: прервать протяжку и снять подсветку
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

// сигнатура цели: подсветка перерисовывается только при смене цели
const signature = (t: PlasterTarget | null): string => (t ? t.pieces.map((x) => `${x.wall.id}:${x.face}:${x.from}:${x.to}`).join("|") : "")

// участок боковой грани цели на стене подложки в координатах исходной стены: границы lo..hi от её конца a
interface PlacedSpan {
  origin: PlasterOrigin
  piece: SideTargetPiece
  lo: number
  hi: number
}

export function createPlasterTool(host: PlasterToolHost): PlasterTool {
  let pressPx: Point | null = null
  let pressWorld: Point | null = null
  let pressed: SideTargetPiece | null = null // боковой кусок нажатой стены: диапазон протяжки
  let dragging = false
  let dragGhost: PlasterGhost | null = null
  let target: PlasterTarget | null = null
  let selected: string | null = null

  const commit = (next: PlasterMark[]): boolean => {
    if (samePlaster(next, host.marks())) return false
    host.record()
    host.setMarks(next)
    host.changed()
    host.redraw()
    return true
  }

  // торец штукатурится только у конца исходной стены: конец остатка на срезе сноса — не торец (design D4)
  const targetAt = (p: Point): PlasterTarget | null => {
    const origins = plasterOrigins(host.drawing())
    const sourceEnd: SourceEnd = (wall, end) => {
      const origin = origins.get(wall.id)
      if (!origin) return false
      return end === "a" ? origin.start <= EPS_CM : origin.start + dist(wall.a, wall.b) >= dist(origin.source.a, origin.source.b) - EPS_CM
    }
    return plasterTarget(p, host.scene().base.walls, host.radiusCm(), sourceEnd)
  }

  // Боковые куски цели: переводятся в координаты исходных стен; слияние — только с действующими пометками, скрытые остаются
  // без изменений. Участок, уже целиком лежащий в действующей пометке той же грани, не меняет ничего (тот же массив).
  const placeSides = (sides: readonly SideTargetPiece[], origins: ReturnType<typeof plasterOrigins>, marks: PlasterMark[]) => {
    const sources = plasterSources(host.drawing())
    const acting = new Set(host.scene().pieces.map((x) => x.mark.id))
    const live = marks.filter((m) => acting.has(m.id))
    const spans = sides.flatMap((piece): PlacedSpan[] => {
      const origin = origins.get(piece.wall.id)
      return origin ? [{ origin, piece, lo: origin.start + piece.from, hi: origin.start + piece.to }] : []
    })
    const covered = spans.every(({ origin, piece, lo, hi }) =>
      live.some((m) => {
        if (m.wallId !== origin.source.id || m.face !== piece.face) return false
        const [start, end] = plasterSpan(m, origin.source)
        return start <= lo + EPS_CM && end >= hi - EPS_CM
      }),
    )
    if (spans.length === 0 || covered) return { next: marks, spans }
    const merged = spans.reduce((acc, { origin, piece, lo, hi }) => addPlaster(acc, sources, origin.source.id, piece.face, lo, hi, host.newThicknessMm(), host.newId), live)
    if (merged === live) return { next: marks, spans }
    const hidden = marks.filter((m) => !acting.has(m.id))
    return { next: hidden.length === 0 ? merged : [...hidden, ...merged], spans }
  }

  // действующая пометка, целиком накрывающая участок: после слияния это поставленная пометка
  const placedAt = (next: readonly PlasterMark[], { origin, piece, lo, hi }: PlacedSpan): PlasterMark | undefined =>
    next.find((m) => {
      if (m.wallId !== origin.source.id || m.face !== piece.face) return false
      const [start, end] = plasterSpan(m, origin.source)
      return start <= lo + EPS_CM && end >= hi - EPS_CM
    })

  // Постановка цели одним шагом истории: боковые куски и торцы плоскости (одна пометка на торец конца исходной стены; уже
  // оштукатуренный торец ничего не меняет). Поставленная пометка не выделяется; возвращается идентификатор пометки стены
  // под курсором.
  const place = (t: PlasterTarget): string | null => {
    const origins = plasterOrigins(host.drawing())
    const sources = plasterSources(host.drawing())
    const marks = host.marks()
    const { next: withSides, spans } = placeSides(
      t.pieces.filter((x): x is SideTargetPiece => x.face !== "end"),
      origins,
      marks,
    )
    const ends = t.pieces.filter((x): x is EndTargetPiece => x.face === "end")
    const next = ends.reduce((acc, piece) => {
      const origin = origins.get(piece.wall.id)
      return origin ? addPlasterEnd(acc, sources, origin.source.id, piece.end, host.newThicknessMm(), host.newId) : acc
    }, withSides)
    if (next === marks) return null
    const focus = spans.find(({ piece }) => piece.wall.id === t.focusWallId) ?? spans[0]
    const focusEnd = ends.find((x) => x.wall.id === t.focusWallId) ?? (focus ? undefined : ends[0])
    const focusEndOrigin = focusEnd && origins.get(focusEnd.wall.id)
    const placed = focus
      ? placedAt(next, focus)
      : focusEnd && focusEndOrigin
        ? next.find((m) => m.face === "end" && m.wallId === focusEndOrigin.source.id && m.anchor === focusEnd.end)
        : undefined
    commit(next)
    return placed?.id ?? null
  }

  // Боковой кусок нажатой стены: стена под точкой нажатия и грань нажатия из цели клика; торец и точка без цели жеста не начинают
  const pressedPiece = (p: Point): SideTargetPiece | null => {
    const t = targetAt(p)
    return t?.pieces.find((x): x is SideTargetPiece => x.face !== "end" && x.wall.id === t.focusWallId) ?? null
  }

  // Кусок протяжки: границы от конца a стены подложки — проекции точки нажатия и точки p на ось с привязкой к узлам, в пределах
  // куска нажатой стены (от стыка до стыка)
  const dragPiece = (piece: SideTargetPiece, start: Point, p: Point): SideTargetPiece => {
    const { wall } = piece
    const axis = unitVector(wall.a, wall.b)
    const { walls, doorways } = host.scene().base
    const nodes = alongNodes(wall, walls, doorways)
    const snapped = (q: Point): number => Math.min(Math.max(snapAlong(dot(sub(q, wall.a), axis), nodes, host.radiusCm(), dist(wall.a, wall.b)), piece.from), piece.to)
    const t0 = snapped(start)
    const t1 = snapped(p)
    return { ...piece, from: Math.min(t0, t1), to: Math.max(t0, t1) }
  }

  // Постановка участка протяжки одним шагом истории: поставленная (слитая) пометка выделяется до замены списка, чтобы
  // перерисовка уже видела выделение; null — список не изменился
  const placeDrag = (piece: SideTargetPiece): string | null => {
    const marks = host.marks()
    const { next, spans } = placeSides([piece], plasterOrigins(host.drawing()), marks)
    const span = spans[0]
    const placed = next !== marks && span ? placedAt(next, span) : undefined
    if (!placed) return null
    const before = selected
    selected = placed.id
    if (commit(next)) return placed.id
    selected = before
    return null
  }

  const reset = (): void => {
    pressPx = null
    pressed = null
    pressWorld = null
    dragging = false
    dragGhost = null
    target = null
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
    hover(p) {
      if (dragging) return // во время протяжки подсвечивается её участок, а не цель клика
      const next = p ? targetAt(p) : null
      if (signature(next) === signature(target)) return
      target = next
      host.redraw()
    },
    down(px, p) {
      pressPx = px
      pressWorld = p ?? null
      pressed = p ? pressedPiece(p) : null
      dragging = false
      dragGhost = null
    },
    move(p, px) {
      if (!pressPx || !pressed || !pressWorld) return
      if (!dragging) {
        if (dist(px, pressPx) <= DEAD_ZONE_PX) return
        dragging = true
        target = null
      }
      dragGhost = { pieces: [dragPiece(pressed, pressWorld, p)], thicknessMm: host.newThicknessMm(), measured: true }
      host.redraw()
    },
    dragging: () => dragging,
    up(p, px) {
      const start = pressPx
      const piece = pressed
      const from = pressWorld
      reset()
      if (!start) return null
      // за мёртвой зоной — протяжка по куску нажатой стены; без него (торец, нет цели) ничего не ставится
      if (dist(px, start) > DEAD_ZONE_PX) {
        const placed = piece && from ? placeDrag(dragPiece(piece, from, p)) : null
        host.redraw()
        return placed
      }
      const t = targetAt(p)
      const placed = t ? place(t) : null
      host.redraw()
      return placed
    },
    cancel() {
      reset()
      host.redraw()
    },
    ghost: () => dragGhost ?? (target ? { pieces: target.pieces, thicknessMm: host.newThicknessMm() } : null),
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
      // размер торца не редактируется (design D7)
      if (!mark || mark.face === "end") return null
      const walls = host.scene().base.walls
      const all = host.scene().pieces
      const spots = all
        .filter((piece) => piece.mark.id === mark.id)
        .flatMap((piece) => plasterDimensions(piece, all, walls, unit, k, labelPx).filter((d) => d.side === mark.face).map((d): PlasterNumberSpot => ({ ...d.spot, piece })))
      const hit = markNumberAt(p, spots, tolCm)
      return hit ? spots.find((s) => s.piece === (hit as PlasterNumberSpot).piece && s.target === hit.target && s.side === hit.side) ?? null : null
    },
    applyNumber(spot, valueCm) {
      if (selected === null) return false
      const origin = plasterOrigins(host.drawing()).get(spot.piece.wall.id)
      if (!origin) return false
      const edited = editPlasterNumber(host.marks(), plasterSources(host.drawing()), host.scene().base.walls, spot.piece, origin.start, spot.target, valueCm + (spot.trimCm ?? 0))
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
