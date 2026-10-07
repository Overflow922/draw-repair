import type { Scene } from "../history"
import { SCREEN_METRICS } from "../render"
import type { Room } from "../room-area"
import type { DoorSwing, Point, Unit, View, Wall, WallElement } from "../types"
import { PX_PER_CM, isDoor } from "../types"
import { ghostSwing, nudgeElements, placeDoor, placeDoorway, placeWindow, setDirection, setDistance, setHeight, setSill, setWidth, slideDoorway } from "./doorway-edit"
import type { ElementEdit } from "./doorway-edit"
import { doorZoneAt } from "./doorway-layout"
import { hitDoorway, wallNearBody } from "./doorway-scene"
import { editableNumbers, numberAt } from "./editable-numbers"
import type { EditableNumber } from "./editable-numbers"
import type { ElementKind, NewElementParams } from "./element-kind"

// Адаптеры DOM элементов стены (change add-doorway design D7, D8; add-window design D4; popups-buttons-only design
// D3–D6): инструменты установки «Проём», «Дверь», «Окно» — призрак, установка кликом, перетаскивание, стрелки;
// правка выделенного элемента на месте — числа цепочек и подписи, зоны направления двери. Состояние чертежа,
// выделения и параметров новых элементов остаётся в main.ts и доступно через явный ElementToolHost; все операции
// получают полный список элементов (соседи — стыки граней).

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
  // фокус — после нажатия мыши: по умолчанию mousedown на холсте сразу снимает фокус с поля и закрывает его по blur
  setTimeout(() => {
    if (closed) return
    input.focus()
    input.select()
  })
  return { close }
}

export interface ElementToolHost {
  walls(): Wall[]
  elements(): readonly WallElement[] // все элементы чертежа любого вида
  selectedElements(): readonly WallElement[]
  // выделены объекты других типов: размеры и числа элемента не показываются и не правятся
  othersSelected(): boolean
  view(): View
  radiusCm(): number
  formatCm(cm: number): string // число в текущей единице
  parseCm(text: string): number // NaN — не число
  unitLabel(): string
  unit(): Unit
  rooms(): Room[]
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
  params(): NewElementParams // параметры новых элементов
  inherit(e: WallElement): void // правка на месте изменила элемент — его значения становятся параметрами новых
}

export interface ElementTool {
  ghost(): WallElement | null
  dragging(): boolean
  hover(raw: Point): void
  place(raw: Point): void
  pressDoorway(p: Point): boolean
  dragTo(p: Point): void
  endDrag(): void
  nudge(arrow: Point, stepCm: number): boolean
  reset(): void
}

const DEAD_ZONE_PX = 4 // мёртвая зона у оси стены для стороны открывания призрака двери
const HIT_TOLERANCE_PX = 4 // допуск попадания в правимое число

// сторона открывания призрака двери до первого показа призрака — left (spec door)
const FIRST_SWING: DoorSwing = "left"

export function createElementTool(kind: ElementKind, host: ElementToolHost): ElementTool {
  let ghost: WallElement | null = null
  let drag: { start: WallElement; live: WallElement; grab: Point; snapshot: Scene } | null = null
  let lastSwing: DoorSwing = FIRST_SWING

  const k = (): number => PX_PER_CM * host.view().zoom

  const makeGhost = (wall: Wall, raw: Point): WallElement | null => {
    const walls = host.walls()
    const elements = host.elements()
    const params = host.params()
    const id = crypto.randomUUID()
    if (kind === "window") {
      const w = params.window
      return placeWindow(wall, walls, raw, w.widthCm, w.heightCm, w.sillCm, id, elements)
    }
    if (kind === "door") {
      const dr = params.door
      const swing = ghostSwing(raw, wall, lastSwing, DEAD_ZONE_PX / k())
      const door = placeDoor(wall, walls, raw, dr.widthCm, dr.heightCm, dr.hinge, swing, id, elements)
      if (door) lastSwing = swing
      return door
    }
    const dw = params.doorway
    return placeDoorway(wall, walls, raw, dw.widthCm, dw.heightCm, id, elements)
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
    reset() {
      ghost = null
      drag = null
    },
  }
}

export interface SelectionEditing {
  pressNumber(p: Point): boolean // клик по правимому числу выделенного элемента — открывает поле ввода
  pressZone(p: Point): boolean // клик в зону направления выделенной двери — поглощает нажатие
  closeEditor(): void
}

// правка выделенного элемента на месте (design D3, D6): не зависит от активного инструмента
export function createSelectionEditing(host: ElementToolHost): SelectionEditing {
  let editor: NumberEditor | null = null

  const k = (): number => PX_PER_CM * host.view().zoom
  const single = (): WallElement | null => {
    const sel = host.selectedElements()
    return sel.length === 1 && !host.othersSelected() ? sel[0] : null
  }

  const closeEditor = (): void => {
    editor?.close()
    editor = null
  }

  // применённая правка — одна запись истории до правки; фактический элемент становится параметрами новых
  const apply = (prev: WallElement, edit: ElementEdit): void => {
    if (edit.kind !== "applied") return
    host.record()
    host.replace(prev, edit.doorway)
    host.changed()
    host.inherit(edit.doorway)
  }

  // значение числа с ограничением по инварианту; вид и данные вида сохраняются
  const edit = (d: WallElement, n: EditableNumber, cm: number): ElementEdit => {
    const walls = host.walls()
    const elements = host.elements()
    const t = n.target
    if (t.kind === "distance") return setDistance(d, walls, t.side, t.part, cm, elements)
    if (t.kind === "width") return setWidth(d, walls, cm, elements)
    if (t.kind === "height") return setHeight(d, cm)
    return d.kind === "window" ? setSill(d, cm) : { kind: "rejected", reason: "invalid" }
  }

  const openEditor = (d: WallElement, n: EditableNumber): void => {
    closeEditor()
    const view = host.view()
    const at = { x: (n.center.x - view.pan.x) * k(), y: (n.center.y - view.pan.y) * k() }
    editor = openNumberEditor(
      host.editorParent,
      at,
      host.formatCm(n.valueCm),
      (text) => {
        apply(d, edit(d, n, host.parseCm(text)))
        host.redraw()
      },
      () => {
        editor = null
      },
    )
  }

  return {
    pressNumber(p) {
      const d = single()
      if (!d) return false
      const numbers = editableNumbers(d, host.walls(), host.elements(), host.rooms(), host.unit(), k(), SCREEN_METRICS.labelPx)
      const n = numberAt(p, numbers, HIT_TOLERANCE_PX / k())
      if (!n) return false
      openEditor(d, n)
      return true
    },
    pressZone(p) {
      const d = single()
      if (!d || !isDoor(d)) return false
      const zone = doorZoneAt(p, d, host.walls())
      if (!zone) return false
      apply(d, setDirection(d, zone.hinge, zone.swing))
      host.redraw()
      return true
    },
    closeEditor,
  }
}
