import type { Scene } from "../history"
import type { Point, View, Wall, WallElement } from "../types"
import { PX_PER_CM, isWindow } from "../types"
import { nudgeElements, placeDoorway, placeWindow, setDistance, setHeight, setSill, setWidth, slideDoorway } from "./doorway-edit"
import type { ElementEdit } from "./doorway-edit"
import { chainLabels } from "./doorway-layout"
import type { ChainLabel } from "./doorway-layout"
import { hitDoorway, wallNearBody } from "./doorway-scene"
import { acceptField, elementDefaults } from "./element-kind"
import type { ElementField, ElementKind } from "./element-kind"

// Инструменты «Проём» и «Окно» (change add-doorway design D7, D8; add-window design D4): адаптер DOM —
// призрак установки, установка кликом, перетаскивание, стрелки, поле ввода на месте числа, панель
// «Ширина» / «H» (/ «H под.»). Состояние чертежа и выделения остаётся в main.ts и доступно через явный
// ElementToolHost; все операции получают полный список элементов (соседи — стыки граней).

export interface NumberEditor {
  close(): void
}

// Enter применяет введённый текст, Esc и потеря фокуса закрывают поле без изменений
export function openNumberEditor(
  parent: HTMLElement,
  at: Point, // экранные координаты числа относительно parent
  value: string,
  onCommit: (text: string) => void,
  onClose: () => void,
): NumberEditor {
  const input = document.createElement("input")
  input.className = "doorway-number-input"
  input.type = "text"
  input.inputMode = "decimal"
  input.value = value
  input.style.left = `${at.x}px`
  input.style.top = `${at.y}px`
  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    input.remove()
    onClose()
  }
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Enter") {
      const text = input.value
      close()
      onCommit(text)
    } else if (e.key === "Escape") close()
  })
  input.addEventListener("blur", close)
  parent.append(input)
  input.focus()
  input.select()
  return { close }
}

export interface ElementToolHost {
  walls(): Wall[]
  elements(): readonly WallElement[] // все элементы чертежа любого вида
  selectedElements(): readonly WallElement[]
  // выделены объекты других типов: размеры элемента не показываются
  othersSelected(): boolean
  view(): View
  radiusCm(): number
  formatCm(cm: number): string // число в текущей единице
  parseCm(text: string): number // NaN — не число
  unitLabel(): string
  editorParent: HTMLElement
  snapshot(): Scene
  record(): void // одна запись истории перед правкой
  recordSnapshot(snapshot: Scene): void
  recordNudge(before: Scene): void // серия стрелок — одна запись
  add(e: WallElement): void
  replace(prev: WallElement, next: WallElement): void
  select(e: WallElement): void
  clearSelection(): void
  changed(): void // чертёж изменён — сохранить
  redraw(): void
}

// поле sill — только у окна
export interface ElementPanel {
  root: HTMLElement
  width: HTMLInputElement
  height: HTMLInputElement
  sill?: HTMLInputElement
}

export interface ElementTool {
  ghost(): WallElement | null
  dragging(): boolean
  hover(raw: Point): void
  place(raw: Point): void
  pressNumber(p: Point): boolean
  pressDoorway(p: Point): boolean
  dragTo(p: Point): void
  endDrag(): void
  nudge(arrow: Point, stepCm: number): boolean
  setPanel(open: boolean): void
  togglePanel(): void
  syncPanel(): void
  closeEditor(): void
  reset(): void
}

// вынос чисел цепочки — как в отрисовке (render.ts: 1.2 · labelPx экрана)
const CHAIN_OFFSET_PX = 14 * 1.2
const NUMBER_HIT_PX = 20

const kindOf = (e: WallElement): ElementKind => (isWindow(e) ? "window" : "doorway")

export function createElementTool(kind: ElementKind, host: ElementToolHost, panel: ElementPanel): ElementTool {
  let ghost: WallElement | null = null
  let drag: { start: WallElement; live: WallElement; grab: Point; snapshot: Scene } | null = null
  let editor: NumberEditor | null = null
  const params = { ...elementDefaults(kind) }

  const k = (): number => PX_PER_CM * host.view().zoom
  const single = (): WallElement | null => {
    const sel = host.selectedElements()
    return sel.length === 1 && !host.othersSelected() ? sel[0] : null
  }
  // выделенный элемент своего вида — его меняют поля панели
  const own = (): WallElement | null => {
    const sel = host.selectedElements()
    return sel.length === 1 && kindOf(sel[0]) === kind ? sel[0] : null
  }

  // применённая правка — одна запись истории
  const apply = (prev: WallElement, edit: ElementEdit): void => {
    if (edit.kind !== "applied") return
    host.record()
    host.replace(prev, edit.doorway)
    host.changed()
  }

  const closeEditor = (): void => {
    editor?.close()
    editor = null
  }

  const makeGhost = (wall: Wall, raw: Point): WallElement | null => {
    const walls = host.walls()
    const elements = host.elements()
    const id = crypto.randomUUID()
    if (kind === "window")
      return placeWindow(wall, walls, raw, params.widthCm, params.heightCm, params.sillCm ?? 0, id, elements)
    return placeDoorway(wall, walls, raw, params.widthCm, params.heightCm, id, elements)
  }

  // призрак над стеной (spec doorway «Установка проёма»); над существующим элементом — нет
  const hover = (raw: Point): void => {
    const walls = host.walls()
    if (hitDoorway(raw, walls, host.elements(), host.radiusCm())) {
      ghost = null
      return
    }
    const wall = wallNearBody(raw, walls, host.radiusCm())
    ghost = wall ? makeGhost(wall, raw) : null
  }

  const labelAt = (p: Point): ChainLabel | null => {
    const d = single()
    if (!d) return null
    let best: ChainLabel | null = null
    let bestD = NUMBER_HIT_PX / k()
    for (const l of chainLabels(d, host.walls(), CHAIN_OFFSET_PX / k(), host.elements())) {
      const dist = Math.hypot(l.at.x - p.x, l.at.y - p.y)
      if (dist <= bestD) {
        best = l
        bestD = dist
      }
    }
    return best
  }

  // поле ввода на месте числа: расстояние или ширина с ограничением по инварианту
  const openEditor = (d: WallElement, label: ChainLabel): void => {
    closeEditor()
    const view = host.view()
    const at = { x: (label.at.x - view.pan.x) * k(), y: (label.at.y - view.pan.y) * k() }
    editor = openNumberEditor(
      host.editorParent,
      at,
      host.formatCm(label.lengthCm),
      (text) => {
        const cm = host.parseCm(text)
        const walls = host.walls()
        const elements = host.elements()
        apply(d, label.part === "width" ? setWidth(d, walls, cm, elements) : setDistance(d, walls, label.side, label.part, cm, elements))
        host.redraw()
      },
      () => {
        editor = null
      },
    )
  }

  const editField = (d: WallElement, field: ElementField, cm: number): ElementEdit => {
    if (field === "width") return setWidth(d, host.walls(), cm, host.elements())
    if (field === "height") return setHeight(d, cm)
    return isWindow(d) ? setSill(d, cm) : { kind: "rejected", reason: "invalid" }
  }

  const setParam = (field: ElementField, cm: number): void => {
    if (!acceptField(kind, field, cm)) return
    if (field === "width") params.widthCm = cm
    else if (field === "height") params.heightCm = cm
    else params.sillCm = cm
  }

  // поля панели: правка выделенного элемента своего вида или параметры новых
  const commitField = (field: ElementField, input: HTMLInputElement): void => {
    const cm = host.parseCm(input.value)
    const d = own()
    if (d) apply(d, editField(d, field, cm))
    else setParam(field, cm)
    input.blur()
    host.redraw()
  }

  const fields: [HTMLInputElement | undefined, ElementField][] = [
    [panel.width, "width"],
    [panel.height, "height"],
    [panel.sill, "sill"],
  ]
  for (const [input, field] of fields) {
    if (!input) continue
    input.addEventListener("change", () => commitField(field, input))
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur()
    })
  }

  const show = (input: HTMLInputElement | undefined, cm: number | undefined): void => {
    if (input && cm !== undefined && document.activeElement !== input) input.value = host.formatCm(cm)
  }

  return {
    ghost: () => ghost,
    dragging: () => drag !== null,
    hover,
    // клик инструментом: установка в положение призрака с выделением, одна запись истории
    place(raw) {
      hover(raw)
      const placed = ghost
      if (!placed) {
        host.clearSelection()
        return
      }
      host.record()
      host.add(placed)
      ghost = null
      host.changed()
      host.select(placed)
    },
    pressNumber(p) {
      const d = single()
      const label = d ? labelAt(p) : null
      if (!d || !label) return false
      openEditor(d, label)
      return true
    },
    // нажатие на элемент любого вида: выделение и начало перетаскивания вдоль опорной стены
    pressDoorway(p) {
      const hit = hitDoorway(p, host.walls(), host.elements(), host.radiusCm())
      if (!hit) return false
      const sel = host.selectedElements()
      if (sel.length !== 1 || sel[0] !== hit) host.select(hit)
      drag = { start: hit, live: hit, grab: p, snapshot: host.snapshot() }
      return true
    },
    // сдвиг от начала жеста полным вектором; элемент не переходит через стыки и соседей
    dragTo(p) {
      if (!drag) return
      const r = slideDoorway(drag.start, host.walls(), { x: p.x - drag.grab.x, y: p.y - drag.grab.y }, host.elements())
      const next = r.kind === "applied" ? r.doorway : drag.start
      if (next === drag.live) return
      host.replace(drag.live, next)
      drag.live = next
      host.changed()
    },
    endDrag() {
      if (!drag) return
      if (drag.live !== drag.start) {
        host.recordSnapshot(drag.snapshot)
        host.changed()
      }
      drag = null
    },
    // стрелки при выделении элементов без стен: ведущий первым, соседи — стыки (add-window design D3)
    nudge(arrow, stepCm) {
      const before = host.snapshot()
      const elements = host.elements()
      const next = nudgeElements(host.selectedElements(), host.walls(), elements, arrow, stepCm)
      let moved = false
      elements.forEach((prev, i) => {
        if (next[i] === prev) return
        host.replace(prev, next[i])
        moved = true
      })
      if (!moved) return false
      host.recordNudge(before)
      host.changed()
      return true
    },
    setPanel(open) {
      panel.root.classList.toggle("open", open)
    },
    togglePanel() {
      panel.root.classList.toggle("open")
    },
    syncPanel() {
      for (const el of panel.root.querySelectorAll(".doorway-unit")) el.textContent = host.unitLabel()
      const d = own()
      show(panel.width, d ? d.widthCm : params.widthCm)
      show(panel.height, d ? d.heightCm : params.heightCm)
      show(panel.sill, d && isWindow(d) ? d.sillCm : params.sillCm)
    },
    closeEditor,
    reset() {
      closeEditor()
      ghost = null
      drag = null
    },
  }
}
