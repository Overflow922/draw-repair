import { anchorLabelAt } from "../anchor-label"
import type { Point, StretchCeiling, View } from "../types"
import { pointInPolygon } from "../wall-geometry"
import { addCeiling, ceilingLabel, removeCeiling, setCeilingDrop } from "./ceiling"
import type { CeilingScene } from "./ceiling-scene"

// Инструмент «Натяжной потолок», выделение потолка по подписи и правка опускания (change add-ceiling-plan, design D5; по
// образцу инструмента «Стяжка»): состояние выделения без DOM. Данные чертежа, история и перерисовка — через явный хост.

export interface CeilingToolHost {
  scene(): CeilingScene
  ceilings(): StretchCeiling[]
  setCeilings(next: StretchCeiling[]): void
  record(): void // одна запись истории (снимок списка до операции) — перед setCeilings и только при изменении
  changed(): void
  redraw(): void
  newId(): string
  newDropMm(): number // опускание из панели инструмента — для новых потолков
  view(): View
  labelPx: number // кегль подписи на холсте
}

export interface CeilingTool {
  place(p: Point): boolean // клик инструментом: поставить потолок в помещении под точкой; false — ничего не изменилось
  select(p: Point): boolean // без инструмента: выделить потолок по подписи под точкой; false — выделение снято
  selectedId(): string | null
  selected(): StretchCeiling | null
  clearSelection(): void
  deleteSelected(): boolean
  setSelectedDrop(mm: number): boolean
  setDropOf(id: string, mm: number): boolean // правка по месту в подписи
  labelAt(p: Point): StretchCeiling | null
  erase(p: Point): boolean // ластик: подпись или помещение с потолком под точкой
  eraseTarget(p: Point): string | null
}

export function createCeilingTool(host: CeilingToolHost): CeilingTool {
  let selected: string | null = null

  const commit = (next: StretchCeiling[]): boolean => {
    if (next === host.ceilings()) return false
    host.record()
    host.setCeilings(next)
    host.changed()
    host.redraw()
    return true
  }

  // действующие потолки: подпись под точкой главнее помещения под точкой
  const labelAt = (p: Point): StretchCeiling | null =>
    anchorLabelAt(p, host.scene().ceilings.map((a) => a.object), (c) => ceilingLabel(c.dropMm), host.view(), host.labelPx)

  const targetAt = (p: Point): StretchCeiling | null => {
    const byLabel = labelAt(p)
    if (byLabel) return byLabel
    const hit = host.scene().ceilings.find((a) => pointInPolygon(p, a.item.room.outline) && !a.item.room.holes.some((h) => pointInPolygon(p, h)))
    return hit?.object ?? null
  }

  return {
    place: (p) => commit(addCeiling(host.ceilings(), host.scene().rooms, p, host.newDropMm(), host.newId)),
    select(p) {
      const hit = labelAt(p)
      selected = hit ? hit.id : null
      host.redraw()
      return hit !== null
    },
    selectedId: () => selected,
    selected: () => host.ceilings().find((c) => c.id === selected) ?? null,
    clearSelection() {
      selected = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return commit(removeCeiling(host.ceilings(), id))
    },
    setSelectedDrop: (mm) => (selected === null ? false : commit(setCeilingDrop(host.ceilings(), selected, mm))),
    setDropOf: (id, mm) => commit(setCeilingDrop(host.ceilings(), id, mm)),
    labelAt,
    erase(p) {
      const hit = targetAt(p)
      if (!hit) return false
      if (hit.id === selected) selected = null
      return commit(removeCeiling(host.ceilings(), hit.id))
    },
    eraseTarget: (p) => targetAt(p)?.id ?? null,
  }
}
