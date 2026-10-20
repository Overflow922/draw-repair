import { EPS_CM } from "../demolition/mark-model"
import { markNumberAt } from "../demolition/mark-numbers"
import type { MarkNumberSpot } from "../demolition/mark-numbers"
import type { PlasterMark, Point, Unit } from "../types"
import { dist, pointInPolygon } from "../wall-geometry"
import { plasterOrigins, plasterSources, plasterSpan, plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { addPlaster, addPlasterEnd, editPlasterNumber, removePlaster, samePlaster, setPlasterThickness } from "./plaster-marks"
import { plasterDimensions } from "./plaster-dimensions"
import { plasterTarget } from "./plaster-face"
import type { EndTargetPiece, PlasterTarget, SideTargetPiece, SourceEnd } from "./plaster-face"
import type { PlasterGhost } from "./rough-render"
import type { RoughScene } from "./rough-scene"
import type { Drawing } from "../types"

// Инструмент «Штукатурка», выделение пометки и правка чисел на месте (change add-rough-works-plan, design D3, D8; жест —
// change plaster-click-whole-face): состояние наведения и выделения без DOM. Данные чертежа, история и перерисовка — через
// явный PlasterToolHost.

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
  down(px: Point): void // нажатие: запоминает экранную точку, чтобы отличить клик от перетаскивания
  up(p: Point, px: Point): string | null // клик ставит штукатурку; идентификатор пометки под курсором; null — ничего не поставлено
  cancel(): void
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

export function createPlasterTool(host: PlasterToolHost): PlasterTool {
  let pressPx: Point | null = null
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
    const spans = sides.flatMap((piece) => {
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
      ? next.find((m) => {
          if (m.wallId !== focus.origin.source.id || m.face !== focus.piece.face) return false
          const [start, end] = plasterSpan(m, focus.origin.source)
          return start <= focus.lo + EPS_CM && end >= focus.hi - EPS_CM
        })
      : focusEnd && focusEndOrigin
        ? next.find((m) => m.face === "end" && m.wallId === focusEndOrigin.source.id && m.anchor === focusEnd.end)
        : undefined
    commit(next)
    return placed?.id ?? null
  }

  const reset = (): void => {
    pressPx = null
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
      const next = p ? targetAt(p) : null
      if (signature(next) === signature(target)) return
      target = next
      host.redraw()
    },
    down(px) {
      pressPx = px
    },
    up(p, px) {
      const start = pressPx
      pressPx = null
      // участок ставит только клик; перетаскивание дальше мёртвой зоны ничего не меняет
      if (!start || dist(px, start) > DEAD_ZONE_PX) return null
      const t = targetAt(p)
      const placed = t ? place(t) : null
      target = null
      host.redraw()
      return placed
    },
    cancel() {
      reset()
      host.redraw()
    },
    ghost: () => (target ? { pieces: target.pieces, thicknessMm: host.newThicknessMm() } : null),
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
