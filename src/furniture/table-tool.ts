import type { Direction } from "../communications/geometry"
import type { Point, Table } from "../types"
import { newTable } from "./table"
import { nudgeTables, removeTables, replaceTable, shiftTables, tableAt } from "./table-edit"
import type { TableParams } from "./table-params"

// Адаптер инструмента «Стол» (change furniture-plan-table, design D6, D7): постановка кликом, выделение, перетаскивание,
// стрелки, удаление, ластик. Состояние чертежа остаётся в main.ts и доступно через явный TableToolHost; состояние жеста,
// выделения и призрака — здесь. Без DOM.

export interface TableToolHost {
  tables(): readonly Table[]
  setTables(next: Table[]): void
  params(): TableParams // значения панели «Стол» для новых столов
  record(before: readonly Table[]): void // одна запись истории: столы до операции
  changed(): void // чертёж изменён — сохранить
  redraw(): void
  selected(): void // выделены столы нажатием или постановкой: main снимает выделение остальных объектов и открывает панель
  newId(): string
}

export interface TableTool {
  ghost(): Table | null
  hover(p: Point | null): void
  place(p: Point): void
  selectedIds(): ReadonlySet<string>
  selectedTable(): Table | null // выделен ровно один стол
  hasSelection(): boolean
  select(ids: readonly string[]): void // выделение рамкой: заменяет выделение, остальные объекты main снимает сам
  clearSelection(): void
  press(p: Point): boolean // нажатие без инструмента: выделение и начало перетаскивания
  dragTo(p: Point): void
  endDrag(): void
  dragging(): boolean
  nudge(direction: Direction, fine: boolean): boolean
  replaceSelected(next: Table): void // правка поля панели: один шаг истории
  deleteSelected(): boolean
  eraseTarget(p: Point): Table | null
  erase(p: Point): boolean
  endBurst(): void // серия стрелок закончена: следующее нажатие откроет новую запись
  reset(): void
}

interface Drag {
  grab: Point
  base: Table[] // столы до жеста
}

export function createTableTool(host: TableToolHost): TableTool {
  let ghostAt: Point | null = null
  let selected: ReadonlySet<string> = new Set()
  let drag: Drag | null = null
  let burst = false

  const selectedTables = (): Table[] => host.tables().filter((t) => selected.has(t.id))
  const withoutSelection = (): void => {
    selected = new Set()
  }

  const tool: TableTool = {
    ghost: () => (ghostAt ? newTable("", ghostAt, host.params()) : null),
    hover(p) {
      ghostAt = p
    },
    place(p) {
      const table = newTable(host.newId(), p, host.params())
      host.record(host.tables())
      host.setTables([...host.tables(), table])
      selected = new Set([table.id])
      burst = false
      ghostAt = null
      host.selected()
      host.changed()
      host.redraw()
    },
    selectedIds: () => selected,
    selectedTable() {
      const only = selectedTables()
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
      const hit = tableAt(host.tables(), p, 0)
      if (!hit) return false
      if (!selected.has(hit.id)) {
        selected = new Set([hit.id])
        host.selected()
      }
      burst = false
      drag = { grab: p, base: host.tables().map((t) => ({ ...t })) }
      host.redraw()
      return true
    },
    dragTo(p) {
      if (!drag) return
      host.setTables(shiftTables(drag.base, selected, p.x - drag.grab.x, p.y - drag.grab.y) ?? drag.base.map((t) => ({ ...t })))
      host.changed()
    },
    endDrag() {
      if (!drag) return
      const { base } = drag
      drag = null
      // не сдвинувшее стол перетаскивание шага истории не создаёт
      const moved = host.tables().some((t, i) => t.x !== base[i]?.x || t.y !== base[i]?.y)
      if (moved) host.record(base)
    },
    dragging: () => drag !== null,
    nudge(direction, fine) {
      const next = nudgeTables(host.tables(), selected, direction, fine)
      if (!next) return false
      if (!burst) host.record(host.tables())
      burst = true
      host.setTables(next)
      host.changed()
      return true
    },
    replaceSelected(next) {
      host.record(host.tables())
      host.setTables(replaceTable(host.tables(), next))
      burst = false
      host.changed()
      host.redraw()
    },
    deleteSelected() {
      if (selected.size === 0) return false
      host.record(host.tables())
      host.setTables(removeTables(host.tables(), selected))
      withoutSelection()
      burst = false
      host.changed()
      host.redraw()
      return true
    },
    eraseTarget: (p) => tableAt(host.tables(), p, 0),
    erase(p) {
      const hit = tableAt(host.tables(), p, 0)
      if (!hit) return false
      host.record(host.tables())
      host.setTables(removeTables(host.tables(), new Set([hit.id])))
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
