import type { Scene } from "../history"
import type { Doorway, Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { arrowSlide, placeDoorway, setDistance, setHeight, setWidth, slideDoorway } from "./doorway-edit"
import type { DoorwayEdit } from "./doorway-edit"
import { chainLabels } from "./doorway-layout"
import type { ChainLabel } from "./doorway-layout"
import { hitDoorway, wallNearBody } from "./doorway-scene"

// Инструмент «Проём» (change add-doorway, design D7, D8): адаптер DOM — призрак установки,
// установка кликом, перетаскивание, стрелки, поле ввода на месте числа, панель «Ширина» / «H».
// Состояние чертежа и выделения остаётся в main.ts и доступно через явный DoorwayToolHost.

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

export interface DoorwayToolHost {
  walls(): Wall[]
  doorways(): readonly Doorway[]
  selectedDoorways(): readonly Doorway[]
  // выделены объекты других типов: размеры проёма не показываются
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
  add(d: Doorway): void
  replace(prev: Doorway, next: Doorway): void
  select(d: Doorway): void
  clearSelection(): void
  changed(): void // чертёж изменён — сохранить
  redraw(): void
}

export interface DoorwayPanel {
  root: HTMLElement
  width: HTMLInputElement
  height: HTMLInputElement
}

export interface DoorwayTool {
  ghost(): Doorway | null
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

export function createDoorwayTool(host: DoorwayToolHost, panel: DoorwayPanel): DoorwayTool {
  let ghost: Doorway | null = null
  let drag: { start: Doorway; live: Doorway; grab: Point; snapshot: Scene } | null = null
  let editor: NumberEditor | null = null
  let widthCm = 90
  let heightCm = 210

  const k = (): number => PX_PER_CM * host.view().zoom
  const single = (): Doorway | null => {
    const sel = host.selectedDoorways()
    return sel.length === 1 && !host.othersSelected() ? sel[0] : null
  }

  // применённая правка — одна запись истории
  const apply = (prev: Doorway, edit: DoorwayEdit): void => {
    if (edit.kind !== "applied") return
    host.record()
    host.replace(prev, edit.doorway)
    host.changed()
  }

  const closeEditor = (): void => {
    editor?.close()
    editor = null
  }

  // призрак над стеной (spec doorway «Установка проёма»); над существующим проёмом — нет
  const hover = (raw: Point): void => {
    const walls = host.walls()
    if (hitDoorway(raw, walls, host.doorways(), host.radiusCm())) {
      ghost = null
      return
    }
    const wall = wallNearBody(raw, walls, host.radiusCm())
    ghost = wall ? placeDoorway(wall, walls, raw, widthCm, heightCm, crypto.randomUUID()) : null
  }

  const labelAt = (p: Point): ChainLabel | null => {
    const d = single()
    if (!d) return null
    let best: ChainLabel | null = null
    let bestD = NUMBER_HIT_PX / k()
    for (const l of chainLabels(d, host.walls(), CHAIN_OFFSET_PX / k())) {
      const dist = Math.hypot(l.at.x - p.x, l.at.y - p.y)
      if (dist <= bestD) {
        best = l
        bestD = dist
      }
    }
    return best
  }

  // поле ввода на месте числа: расстояние или ширина с ограничением по инварианту
  const openEditor = (d: Doorway, label: ChainLabel): void => {
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
        apply(d, label.part === "width" ? setWidth(d, walls, cm) : setDistance(d, walls, label.side, label.part, cm))
        host.redraw()
      },
      () => {
        editor = null
      },
    )
  }

  // поля панели: правка выделенного проёма или параметры новых
  const commitField = (field: "width" | "height", input: HTMLInputElement): void => {
    const cm = host.parseCm(input.value)
    const sel = host.selectedDoorways()
    const d = sel.length === 1 ? sel[0] : null
    if (d) apply(d, field === "width" ? setWidth(d, host.walls(), cm) : setHeight(d, cm))
    else if (Number.isFinite(cm) && cm > 0) {
      if (field === "width") widthCm = cm
      else heightCm = cm
    }
    input.blur()
    host.redraw()
  }

  for (const [input, field] of [
    [panel.width, "width"],
    [panel.height, "height"],
  ] as const) {
    input.addEventListener("change", () => commitField(field, input))
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur()
    })
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
    // нажатие на проём: выделение и начало перетаскивания вдоль опорной стены
    pressDoorway(p) {
      const hit = hitDoorway(p, host.walls(), host.doorways(), host.radiusCm())
      if (!hit) return false
      const sel = host.selectedDoorways()
      if (sel.length !== 1 || sel[0] !== hit) host.select(hit)
      drag = { start: hit, live: hit, grab: p, snapshot: host.snapshot() }
      return true
    },
    // сдвиг от начала жеста полным вектором; проём не переходит через стыки
    dragTo(p) {
      if (!drag) return
      const r = slideDoorway(drag.start, host.walls(), { x: p.x - drag.grab.x, y: p.y - drag.grab.y })
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
    // стрелки при выделении проёмов без стен (spec doorway «Перемещение проёма»)
    nudge(arrow, stepCm) {
      const before = host.snapshot()
      let moved = false
      for (const d of [...host.selectedDoorways()]) {
        const r = arrowSlide(d, host.walls(), arrow, stepCm)
        if (r.kind !== "applied") continue
        host.replace(d, r.doorway)
        moved = true
      }
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
      const sel = host.selectedDoorways()
      const d = sel.length === 1 ? sel[0] : null
      if (document.activeElement !== panel.width) panel.width.value = host.formatCm(d ? d.widthCm : widthCm)
      if (document.activeElement !== panel.height) panel.height.value = host.formatCm(d ? d.heightCm : heightCm)
    },
    closeEditor,
    reset() {
      closeEditor()
      ghost = null
      drag = null
    },
  }
}
