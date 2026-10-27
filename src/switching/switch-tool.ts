import type { Shape } from "../communications/shape"
import type { LightSwitch, Point, View } from "../types"
import { PX_PER_CM } from "../types"
import { addSwitch, moveSwitch, newSwitch, removeSwitch, setKeyCount, setKeyLines } from "./light-switch"
import type { SwitchPlacement } from "./light-switch"
import { snapSwitch } from "./switch-reach"
import { switchHit } from "./switch-symbol"
import type { SwitchHit } from "./switch-symbol"

// Инструмент «Выключатель» и правка выключателей без инструмента (change add-light-switch, design D5): постановка с призраком,
// выделение по знаку, перетаскивание вдоль граней, правка числа клавиш и списка линий клавиши, Delete, ластик. Состояние выделения
// и перетаскивания без DOM; данные плана, история и перерисовка — через явный хост (по образцу инструмента «Освещение»).

export interface SwitchToolHost {
  bodies(): readonly Shape[] // чистовые грани подложки (furnitureReachBodies)
  openings(): readonly Shape[] // тела проёмов, дверей и окон (openingBodies)
  switches(): LightSwitch[]
  setSwitches(next: LightSwitch[]): void
  record(): void // одна запись истории (снимок выключателей до операции) — перед setSwitches и только при изменении
  changed(): void
  redraw(): void
  newId(): string
  keyCount(): number // значение поля «Клавиш» панели — для новых выключателей
  view(): View
  unitsPerMm: number // пикселей холста на мм бумаги (размер знака)
}

export interface SwitchPress {
  switch: LightSwitch
  hit: SwitchHit
  wasSelected: boolean
}

export interface SwitchTool {
  ghost(p: Point): LightSwitch | null
  place(p: Point): boolean
  press(p: Point): SwitchPress | null // без инструмента: выделяет выключатель под точкой; пустое место снимает выделение
  hitAt(p: Point): { switch: LightSwitch; hit: SwitchHit } | null
  displayed(): LightSwitch[] // выключатели как нарисованы: перетаскиваемый — в текущем положении
  selectedId(): string | null
  selected(): LightSwitch | null
  clearSelection(): void
  deleteSelected(): boolean
  setSelectedKeyCount(count: number): boolean // правка в панели
  setKeyLines(id: string, keyIndex: number, lines: string[]): boolean // правка на месте
  beginDrag(p: Point): boolean
  dragTo(p: Point): void
  endDrag(): boolean
  dragging(): boolean
  erase(p: Point): boolean
  eraseTarget(p: Point): string | null
}

const SNAP_PX = 40

export function createSwitchTool(host: SwitchToolHost): SwitchTool {
  let selected: string | null = null
  let drag: { id: string; offset: Point; place: SwitchPlacement | null } | null = null

  const k = (): number => PX_PER_CM * host.view().zoom

  const commit = (next: LightSwitch[]): boolean => {
    if (next === host.switches()) return false
    host.record()
    host.setSwitches(next)
    host.changed()
    host.redraw()
    return true
  }

  const placementAt = (p: Point): SwitchPlacement | null => snapSwitch(p, host.bodies(), host.openings(), SNAP_PX / k())

  const displayed = (): LightSwitch[] => {
    const list = host.switches()
    return drag?.place ? moveSwitch(list, drag.id, drag.place) : list
  }

  // точка чертежа (см) → экранные пиксели; знак считается в пикселях холста
  const toScreen = (p: Point): Point => ({ x: (p.x - host.view().pan.x) * k(), y: (p.y - host.view().pan.y) * k() })

  // выключатель, чей знак лежит под точкой; из совпавших побеждает позже поставленный
  const hitAt = (p: Point): { switch: LightSwitch; hit: SwitchHit } | null => {
    const list = displayed()
    const sp = toScreen(p)
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]
      const hit = s ? switchHit(s, toScreen(s.at), sp, host.unitsPerMm) : null
      if (s && hit) return { switch: s, hit }
    }
    return null
  }

  return {
    ghost(p) {
      const place = placementAt(p)
      return place ? newSwitch("ghost", place, host.keyCount()) : null
    },
    place(p) {
      const place = placementAt(p)
      return place ? commit(addSwitch(host.switches(), newSwitch(host.newId(), place, host.keyCount()))) : false
    },
    press(p) {
      const found = hitAt(p)
      const wasSelected = found !== null && selected === found.switch.id
      selected = found?.switch.id ?? null
      host.redraw()
      return found ? { ...found, wasSelected } : null
    },
    hitAt,
    displayed,
    selectedId: () => selected,
    selected: () => host.switches().find((s) => s.id === selected) ?? null,
    clearSelection() {
      selected = null
      drag = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return commit(removeSwitch(host.switches(), id))
    },
    setSelectedKeyCount: (count) => (selected === null ? false : commit(setKeyCount(host.switches(), selected, count))),
    setKeyLines: (id, keyIndex, lines) => commit(setKeyLines(host.switches(), id, keyIndex, lines)),
    beginDrag(p) {
      const found = hitAt(p)
      if (!found) return false
      selected = found.switch.id
      drag = { id: found.switch.id, offset: { x: found.switch.at.x - p.x, y: found.switch.at.y - p.y }, place: null }
      return true
    },
    dragTo(p) {
      if (!drag) return
      drag = { ...drag, place: placementAt({ x: p.x + drag.offset.x, y: p.y + drag.offset.y }) }
      host.redraw()
    },
    endDrag() {
      const d = drag
      drag = null
      if (!d?.place) {
        host.redraw()
        return false
      }
      const moved = commit(moveSwitch(host.switches(), d.id, d.place))
      if (!moved) host.redraw()
      return moved
    },
    dragging: () => drag !== null,
    erase(p) {
      const found = hitAt(p)
      if (!found) return false
      if (found.switch.id === selected) selected = null
      return commit(removeSwitch(host.switches(), found.switch.id))
    },
    eraseTarget: (p) => hitAt(p)?.switch.id ?? null,
  }
}
