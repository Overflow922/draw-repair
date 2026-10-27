import { lineLabel } from "./light-lines"

// Пункты выпадающего меню «Линия» (change line-dropdown, design D4, D6): L1–L10 для светильников, вытяжек и выключателей, недоступный
// «—» без линии, дополнительный пункт для имени вне списка (L12 или LV1 из чертежа, созданного раньше). Чистая функция — меню в DOM
// только наполняется ею.

export const LINE_MENU_MAX = 10

export interface LineMenuItem {
  value: string
  text: string
  disabled: boolean
}

export interface LineMenu {
  items: LineMenuItem[]
  selected: string // значение выбранного пункта; пустая строка — «—»
}

export function lineMenu(selected: string | null): LineMenu {
  const items: LineMenuItem[] = selected === null ? [{ value: "", text: "—", disabled: true }] : []
  for (let n = 1; n <= LINE_MENU_MAX; n++) {
    const value = lineLabel(n)
    items.push({ value, text: value, disabled: false })
  }
  if (selected !== null && !items.some((i) => i.value === selected)) items.push({ value: selected, text: selected, disabled: false })
  return { items, selected: selected ?? "" }
}
