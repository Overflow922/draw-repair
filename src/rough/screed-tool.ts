import type { Point, Screed, View } from "../types"
import { pointInPolygon } from "../wall-geometry"
import type { RoughScene } from "./rough-scene"
import { screedLabelAt } from "./screed-label"
import { addScreed, removeScreed, setScreedThickness } from "./screed"

// Инструмент «Стяжка», выделение стяжки по подписи и правка толщины (change add-rough-works-plan, design D2, D8): состояние
// выделения без DOM. Данные чертежа, история и перерисовка — через явный ScreedToolHost.

export interface ScreedToolHost {
  scene(): RoughScene
  screeds(): Screed[]
  setScreeds(next: Screed[]): void
  record(): void // одна запись истории (снимок списков до операции) — перед setScreeds и только при изменении
  changed(): void
  redraw(): void
  newId(): string
  newThicknessMm(): number // толщина из панели инструмента — для новых стяжек
  view(): View
  labelPx: number // кегль подписи на холсте
}

export interface ScreedTool {
  place(p: Point): boolean // клик инструментом: поставить стяжку в помещении под точкой; false — ничего не изменилось
  select(p: Point): boolean // без инструмента: выделить стяжку по подписи под точкой; false — выделение снято
  selectedId(): string | null
  selected(): Screed | null
  clearSelection(): void
  deleteSelected(): boolean
  setSelectedThickness(mm: number): boolean
  setThicknessOf(id: string, mm: number): boolean // правка по месту в подписи
  labelAt(p: Point): Screed | null
  erase(p: Point): boolean // ластик: подпись или помещение со стяжкой под точкой
  eraseTarget(p: Point): string | null
}

export function createScreedTool(host: ScreedToolHost): ScreedTool {
  let selected: string | null = null

  const commit = (next: Screed[]): boolean => {
    if (next === host.screeds()) return false
    host.record()
    host.setScreeds(next)
    host.changed()
    host.redraw()
    return true
  }

  // действующие стяжки в порядке списка: подпись или помещение под точкой; подпись главнее, затем помещение
  const labelAt = (p: Point): Screed | null =>
    screedLabelAt(p, host.scene().screeds.map((a) => a.screed), host.view(), host.labelPx)

  const targetAt = (p: Point): Screed | null => {
    const byLabel = labelAt(p)
    if (byLabel) return byLabel
    const hit = host.scene().screeds.find((a) => pointInPolygon(p, a.item.room.outline) && !a.item.room.holes.some((h) => pointInPolygon(p, h)))
    return hit?.screed ?? null
  }

  return {
    place(p) {
      const next = addScreed(host.screeds(), host.scene().items, p, host.newThicknessMm(), host.newId)
      return commit(next)
    },
    select(p) {
      const hit = labelAt(p)
      selected = hit ? hit.id : null
      host.redraw()
      return hit !== null
    },
    selectedId: () => selected,
    selected: () => host.screeds().find((s) => s.id === selected) ?? null,
    clearSelection() {
      selected = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return commit(removeScreed(host.screeds(), id))
    },
    setSelectedThickness(mm) {
      return selected === null ? false : commit(setScreedThickness(host.screeds(), selected, mm))
    },
    setThicknessOf: (id, mm) => commit(setScreedThickness(host.screeds(), id, mm)),
    labelAt,
    erase(p) {
      const hit = targetAt(p)
      if (!hit) return false
      if (hit.id === selected) selected = null
      return commit(removeScreed(host.screeds(), hit.id))
    },
    eraseTarget: (p) => targetAt(p)?.id ?? null,
  }
}
