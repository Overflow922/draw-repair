// Меню групп видов мебели (change furniture-kind-groups, design D2, D3, D5): состояние четырёх кнопок групп и их панелей без DOM.
// main.ts собирает модель из своих переменных, применяет переход и отражает результат в разметке. Переходы кнопки группы и выбора
// вида — те же, что у групп «Проёмы» и «Коммуникации» (openings-group).

import { groupButtonClick, groupPick } from "../doorway/openings-group"
import type { GroupState } from "../doorway/openings-group"
import { groupOf, kindsOfGroup } from "./furniture-kinds"
import type { FurnitureGroup, FurnitureKind } from "./furniture-kinds"

export interface FurnitureMenu {
  // вид, который ставит инструмент «Мебель» (последний выбранный)
  readonly kind: FurnitureKind
  // инструмент «Мебель» активен
  readonly active: boolean
  // текущий вид каждой группы — его активирует кнопка группы
  readonly current: Readonly<Record<FurnitureGroup, FurnitureKind>>
  // группа открытой панели; открыта не больше чем одна
  readonly panel: FurnitureGroup | null
}

const firstKinds = (): Record<FurnitureGroup, FurnitureKind> => {
  const first = (g: FurnitureGroup): FurnitureKind => kindsOfGroup(g)[0] ?? "table"
  return { room: first("room"), bedroom: first("bedroom"), kitchen: first("kitchen"), bathroom: first("bathroom") }
}

// план «Мебель» при открытии: активен первый вид первой группы («Стол»), панели закрыты
export const initialMenu = (): FurnitureMenu => ({ kind: "table", active: false, current: firstKinds(), panel: null })

export const withActive = (menu: FurnitureMenu, active: boolean): FurnitureMenu => ({ ...menu, active })

export const withoutPanel = (menu: FurnitureMenu): FurnitureMenu => ({ ...menu, panel: null })

// кнопка группы выделена, пока активен инструмент и его вид — из этой группы
export const groupIsActive = (menu: FurnitureMenu, group: FurnitureGroup): boolean => menu.active && groupOf(menu.kind) === group

const groupState = (menu: FurnitureMenu, group: FurnitureGroup): GroupState<FurnitureKind> => ({
  current: menu.current[group],
  active: groupIsActive(menu, group) ? menu.kind : "other",
  panelOpen: menu.panel === group,
})

function applyGroup(menu: FurnitureMenu, group: FurnitureGroup, next: GroupState<FurnitureKind>): FurnitureMenu {
  const activated = next.active !== "other"
  const panel = next.panelOpen ? group : menu.panel === group ? null : menu.panel
  return {
    kind: activated ? next.current : menu.kind,
    active: activated || menu.active,
    current: { ...menu.current, [group]: next.current },
    panel,
  }
}

// клик по кнопке группы: другой инструмент → текущий вид группы и панель с первого нажатия; уже активная группа → переключение панели
export const clickGroup = (menu: FurnitureMenu, group: FurnitureGroup): FurnitureMenu => applyGroup(menu, group, groupButtonClick(groupState(menu, group)))

// кнопка вида в панели группы: вид становится текущим видом своей группы и активным, панель остаётся открытой
export function pickKind(menu: FurnitureMenu, kind: FurnitureKind): FurnitureMenu {
  const group = groupOf(kind)
  return applyGroup(menu, group, groupPick(groupState(menu, group), kind))
}

// выделение предмета открывает панель группы его вида, вид и текущие виды групп не меняются
export const revealSelection = (menu: FurnitureMenu, kind: FurnitureKind): FurnitureMenu => ({ ...menu, panel: groupOf(kind) })

// установка предмета снимает инструмент и оставляет открытой панель группы поставленного вида
export const placed = (menu: FurnitureMenu): FurnitureMenu => ({ ...revealSelection(menu, menu.kind), active: false })
