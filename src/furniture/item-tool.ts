import type { Direction } from "../communications/geometry"
import type { FurnitureItem, Point } from "../types"
import type { FurnitureKind } from "./furniture-kinds"
import { newItem } from "./item"
import { nudgeItems, removeItems, replaceItem, shiftItems, itemAt } from "./item-edit"
import type { ItemParams } from "./item-params"

// Адаптер инструмента «Стол» (change furniture-plan-table, design D6, D7): постановка кликом, выделение, перетаскивание,
// стрелки, удаление, ластик. Состояние чертежа остаётся в main.ts и доступно через явный ItemToolHost; состояние жеста,
// выделения и призрака — здесь. Без DOM.

export interface ItemToolHost {
  items(): readonly FurnitureItem[]
  setItems(next: FurnitureItem[]): void
  kind(): FurnitureKind // активный вид инструмента «Мебель»
  params(): ItemParams // значения панели для новых предметов активного вида
  record(before: readonly FurnitureItem[]): void // одна запись истории: столы до операции
  changed(): void // чертёж изменён — сохранить
  redraw(): void
  selected(): void // выделены столы нажатием или постановкой: main снимает выделение остальных объектов и открывает панель
  newId(): string
}

export interface ItemTool {
  ghost(): FurnitureItem | null
  hover(p: Point | null): void
  place(p: Point): void
  selectedIds(): ReadonlySet<string>
  selectedItem(): FurnitureItem | null // выделен ровно один стол
  hasSelection(): boolean
  select(ids: readonly string[]): void // выделение рамкой: заменяет выделение, остальные объекты main снимает сам
  clearSelection(): void
  press(p: Point): boolean // нажатие без инструмента: выделение и начало перетаскивания
  dragTo(p: Point): void
  endDrag(): void
  dragging(): boolean
  nudge(direction: Direction, fine: boolean): boolean
  replaceSelected(next: FurnitureItem): void // правка поля панели: один шаг истории
  deleteSelected(): boolean
  eraseTarget(p: Point): FurnitureItem | null
  erase(p: Point): boolean
  endBurst(): void // серия стрелок закончена: следующее нажатие откроет новую запись
  reset(): void
}

interface Drag {
  grab: Point
  base: FurnitureItem[] // столы до жеста
}

export function createItemTool(host: ItemToolHost): ItemTool {
  let ghostAt: Point | null = null
  let selected: ReadonlySet<string> = new Set()
  let drag: Drag | null = null
  let burst = false

  const selectedItems = (): FurnitureItem[] => host.items().filter((t) => selected.has(t.id))
  const withoutSelection = (): void => {
    selected = new Set()
  }

  const tool: ItemTool = {
    ghost: () => (ghostAt ? newItem("", host.kind(), ghostAt, host.params()) : null),
    hover(p) {
      ghostAt = p
    },
    place(p) {
      const table = newItem(host.newId(), host.kind(), p, host.params())
      host.record(host.items())
      host.setItems([...host.items(), table])
      selected = new Set([table.id])
      burst = false
      ghostAt = null
      host.selected()
      host.changed()
      host.redraw()
    },
    selectedIds: () => selected,
    selectedItem() {
      const only = selectedItems()
      return only.length === 1 ? (only[0] ?? null) : null
    },
    hasSelection: () => selected.size > 0,
    select(ids) {
      selected = new Set(ids)
      burst = false
    },
    clearSelection() {
      withoutSelection()
      burst = false
    },
    press(p) {
      const hit = itemAt(host.items(), p, 0)
      if (!hit) return false
      if (!selected.has(hit.id)) {
        selected = new Set([hit.id])
        host.selected()
      }
      burst = false
      drag = { grab: p, base: host.items().map((t) => ({ ...t })) }
      host.redraw()
      return true
    },
    dragTo(p) {
      if (!drag) return
      host.setItems(shiftItems(drag.base, selected, p.x - drag.grab.x, p.y - drag.grab.y) ?? drag.base.map((t) => ({ ...t })))
      host.changed()
    },
    endDrag() {
      if (!drag) return
      const { base } = drag
      drag = null
      // не сдвинувшее стол перетаскивание шага истории не создаёт
      const moved = host.items().some((t, i) => t.x !== base[i]?.x || t.y !== base[i]?.y)
      if (moved) host.record(base)
    },
    dragging: () => drag !== null,
    nudge(direction, fine) {
      const next = nudgeItems(host.items(), selected, direction, fine)
      if (!next) return false
      if (!burst) host.record(host.items())
      burst = true
      host.setItems(next)
      host.changed()
      return true
    },
    replaceSelected(next) {
      host.record(host.items())
      host.setItems(replaceItem(host.items(), next))
      burst = false
      host.changed()
      host.redraw()
    },
    deleteSelected() {
      if (selected.size === 0) return false
      host.record(host.items())
      host.setItems(removeItems(host.items(), selected))
      withoutSelection()
      burst = false
      host.changed()
      host.redraw()
      return true
    },
    eraseTarget: (p) => itemAt(host.items(), p, 0),
    erase(p) {
      const hit = itemAt(host.items(), p, 0)
      if (!hit) return false
      host.record(host.items())
      host.setItems(removeItems(host.items(), new Set([hit.id])))
      selected = new Set([...selected].filter((id) => id !== hit.id))
      burst = false
      host.changed()
      host.redraw()
      return true
    },
    endBurst() {
      burst = false
    },
    reset() {
      ghostAt = null
      drag = null
      burst = false
      withoutSelection()
    },
  }
  return tool
}
