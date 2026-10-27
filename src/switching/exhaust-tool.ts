import type { Shape } from "../communications/shape"
import { insideBodies } from "../ceiling/light-reach"
import type { ExhaustFan, ExhaustState, Point, View } from "../types"
import { PX_PER_CM } from "../types"
import { addExhaust, moveExhaust, newExhaust, removeExhaust } from "./exhaust"
import { exhaustHitRadiusPx } from "./exhaust-symbol"

// Инструмент «Вытяжка» и правка вытяжек без инструмента (change add-exhaust-fan, design D3): постановка с призраком, выделение по
// знаку, перетаскивание, Delete, ластик. Состояние выделения и перетаскивания без DOM; данные плана, история и перерисовка — через
// явный хост (по образцу инструмента «Освещение»). Вытяжка и её метка линии правятся вместе одним шагом.

export interface ExhaustToolHost {
  bodies(): readonly Shape[] // чистовые грани подложки (furnitureReachBodies): внутри них вытяжка не ставится
  state(): ExhaustState
  setState(next: ExhaustState): void
  record(): void // одна запись истории (снимок вытяжек и меток до операции) — перед setState и только при изменении
  changed(): void
  redraw(): void
  newId(): string
  view(): View
}

export interface ExhaustTool {
  ghost(p: Point): ExhaustFan | null
  place(p: Point): boolean
  hitAt(p: Point): ExhaustFan | null
  press(p: Point): ExhaustFan | null // без инструмента: выделяет вытяжку под точкой; пустое место снимает выделение
  displayed(): ExhaustFan[] // вытяжки как нарисованы: перетаскиваемая — в текущем положении
  selectedId(): string | null
  clearSelection(): void
  deleteSelected(): boolean
  beginDrag(p: Point): boolean
  dragTo(p: Point): void
  endDrag(): boolean
  dragging(): boolean
  erase(p: Point): boolean
  eraseTarget(p: Point): string | null
}

export function createExhaustTool(host: ExhaustToolHost): ExhaustTool {
  let selected: string | null = null
  let drag: { id: string; offset: Point; at: Point | null } | null = null

  const k = (): number => PX_PER_CM * host.view().zoom

  const commit = (next: ExhaustState): boolean => {
    const prev = host.state()
    if (next.exhausts === prev.exhausts && next.lines === prev.lines) return false
    host.record()
    host.setState(next)
    host.changed()
    host.redraw()
    return true
  }

  // центр вытяжки у точки p: округлённая точка вне тел стен, штукатурки и гипсокартона; null — нельзя
  const placementAt = (p: Point): Point | null => {
    const at = { x: Math.round(p.x), y: Math.round(p.y) }
    return insideBodies(at, host.bodies()) ? null : at
  }

  const displayed = (): ExhaustFan[] => {
    const list = host.state().exhausts
    return drag?.at ? moveExhaust(list, drag.id, drag.at) : list
  }

  // вытяжка, чей знак лежит под точкой; из совпавших побеждает позже поставленная
  const hitAt = (p: Point): ExhaustFan | null => {
    const list = displayed()
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]
      if (f && Math.hypot(p.x - f.x, p.y - f.y) <= exhaustHitRadiusPx() / k()) return f
    }
    return null
  }

  const remove = (id: string): boolean => {
    const { exhausts, lines } = host.state()
    return commit(removeExhaust(exhausts, lines, id))
  }

  return {
    ghost(p) {
      const at = placementAt(p)
      return at ? newExhaust("ghost", at) : null
    },
    place(p) {
      const at = placementAt(p)
      if (!at) return false
      const { exhausts, lines } = host.state()
      return commit({ exhausts: addExhaust(exhausts, newExhaust(host.newId(), at)), lines })
    },
    hitAt,
    press(p) {
      const fan = hitAt(p)
      selected = fan?.id ?? null
      host.redraw()
      return fan
    },
    displayed,
    selectedId: () => selected,
    clearSelection() {
      selected = null
      drag = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return remove(id)
    },
    beginDrag(p) {
      const fan = hitAt(p)
      if (!fan) return false
      selected = fan.id
      drag = { id: fan.id, offset: { x: fan.x - p.x, y: fan.y - p.y }, at: null }
      return true
    },
    dragTo(p) {
      if (!drag) return
      drag = { ...drag, at: placementAt({ x: p.x + drag.offset.x, y: p.y + drag.offset.y }) }
      host.redraw()
    },
    endDrag() {
      const d = drag
      drag = null
      if (!d?.at) {
        host.redraw()
        return false
      }
      const { exhausts, lines } = host.state()
      const moved = commit({ exhausts: moveExhaust(exhausts, d.id, d.at), lines })
      if (!moved) host.redraw()
      return moved
    },
    dragging: () => drag !== null,
    erase(p) {
      const fan = hitAt(p)
      if (!fan) return false
      if (fan.id === selected) selected = null
      return remove(fan.id)
    },
    eraseTarget: (p) => hitAt(p)?.id ?? null,
  }
}
