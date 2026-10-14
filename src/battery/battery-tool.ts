import { wallNearBody } from "../doorway/doorway-scene"
import { openNumberEditor } from "../doorway/doorway-tool"
import type { NumberEditor } from "../doorway/doorway-tool"
import { numberAt } from "../doorway/editable-numbers"
import type { Scene } from "../history"
import { SCREEN_METRICS } from "../render"
import type { Battery, Communication, Point, Unit, View, Wall, WallElement } from "../types"
import { PX_PER_CM } from "../types"
import type { TrackLine } from "../wall-tracking"
import { setBatteryDistance, setBatteryGap, setBatteryLength, setBatteryThickness } from "./battery-edit"
import { CENTER_GUIDE_OVERSHOOT_PX, centerGuide } from "./battery-guide"
import { centeredWindow, hostOfBattery } from "./battery-motion"
import { batteryNumberLayout } from "./battery-numbers"
import type { BatteryNumber } from "./battery-numbers"
import { hitBattery } from "./battery-pick"
import { DEFAULT_BATTERY_PARAMS, arrowSlideBattery, inheritBatteryParams, placeBattery, slideBattery } from "./battery-place"
import type { BatteryContext, BatteryEdit } from "./battery-place"

// Адаптер DOM батарей (change add-battery, design D10): инструмент «Батарея» — призрак и установка кликом; выделенная
// батарея — перетаскивание вдоль опорной стены, стрелки и правка чисел на месте. Состояние чертежа и выделения остаётся
// в main.ts и доступно через явный BatteryToolHost; параметры новых батарей хранятся здесь в пределах сеанса.

export interface BatteryToolHost {
  walls(): readonly Wall[]
  batteries(): readonly Battery[]
  communications(): readonly Communication[]
  elements(): readonly WallElement[]
  selectedBatteries(): readonly Battery[]
  editable(b: Battery): boolean // батареи обмера на плане «Монтаж» — только чтение
  view(): View
  unit(): Unit
  radiusCm(): number // радиус привязки (допуск попадания и поиск стены под курсором)
  centerRadiusCm(): number // радиус центровки по окну: отдельный, больше обычного (design D1)
  formatCm(cm: number): string // число в текущей единице для поля ввода
  parseCm(text: string): number // NaN — не число
  editorParent: HTMLElement
  snapshot(): Scene
  record(): void // одна запись истории перед правкой
  recordSnapshot(snapshot: Scene): void
  recordNudge(before: Scene): void // серия стрелок — одна запись
  add(b: Battery): void
  replace(prev: Battery, next: Battery): void // заменить в списке; выделение переходит на next
  select(b: Battery): void
  changed(): void // чертёж изменён — сохранить
  redraw(): void
}

export interface BatteryToolAdapter {
  ghost(): Battery | null
  guide(): TrackLine | null // риска центровки, пока призрак или перетаскиваемая батарея прилипли к центру окна
  dragging(): boolean
  hover(raw: Point): void
  place(raw: Point): boolean
  pressNumber(p: Point): boolean
  pressBody(p: Point): boolean
  dragTo(p: Point): void
  endDrag(): void
  nudge(arrow: Point, stepCm: number): boolean
  clearGhost(): void
  closeEditor(): void
  reset(): void
}

const HIT_TOLERANCE_PX = 4 // допуск попадания в правимое число, как у чисел проёма

export function createBatteryTool(host: BatteryToolHost): BatteryToolAdapter {
  let params = DEFAULT_BATTERY_PARAMS
  let ghost: Battery | null = null
  let editor: NumberEditor | null = null
  let drag: { start: Battery; live: Battery; grab: Point; snapshot: Scene; moved: boolean } | null = null

  const k = (): number => PX_PER_CM * host.view().zoom
  const context = (): BatteryContext => ({
    batteries: host.batteries(),
    communications: host.communications(),
    elements: host.elements(),
    snapCm: host.centerRadiusCm(),
  })

  // призрак: у стены под курсором, над существующей батареей — нет (клик по ней новую не ставит)
  const ghostAt = (raw: Point): Battery | null => {
    const walls = host.walls()
    if (hitBattery(raw, walls, host.batteries(), 0)) return null
    const wall = wallNearBody(raw, walls, host.radiusCm())
    return wall ? placeBattery(wall, walls, raw, params, "", context()) : null
  }

  const numbersOf = (b: Battery): BatteryNumber[] => batteryNumberLayout(b, host.walls(), host.unit(), k(), SCREEN_METRICS.labelPx)

  const edit = (b: Battery, n: BatteryNumber, value: number): BatteryEdit => {
    const walls = host.walls()
    const ctx = context()
    switch (n.field) {
      case "toA":
        return setBatteryDistance(b, walls, "a", value, ctx)
      case "toB":
        return setBatteryDistance(b, walls, "b", value, ctx)
      case "length":
        return setBatteryLength(b, walls, value, ctx)
      case "thickness":
        return setBatteryThickness(b, walls, value, ctx)
      case "gap":
        return setBatteryGap(b, walls, value, ctx)
    }
  }

  const apply = (b: Battery, n: BatteryNumber, text: string): void => {
    const value = host.parseCm(text)
    if (!Number.isFinite(value)) return
    const before = host.snapshot()
    const result = edit(b, n, value)
    if (result.kind !== "applied") return
    host.recordSnapshot(before)
    host.replace(b, result.battery)
    params = inheritBatteryParams(params, result.battery)
    host.changed()
    host.redraw()
  }

  const closeEditor = (): void => {
    editor?.close()
    editor = null
  }

  // риска выводится из итогового положения: центр батареи лежит на центре окна (design D2); при нажатии без движения её нет,
  // а батарея, уже стоящая по центру и удержанная прилипанием, остаётся с риской, пока указатель движется
  const guide = (): TrackLine | null => {
    const b = drag ? (drag.moved ? drag.live : null) : ghost
    const wall = b ? hostOfBattery(b, host.walls()) : null
    if (!b || !wall) return null
    const centre = centeredWindow(b, wall, host.elements())
    return centre === null ? null : centerGuide(b, wall, centre, k(), CENTER_GUIDE_OVERSHOOT_PX)
  }

  return {
    ghost: () => ghost,
    guide,
    dragging: () => drag !== null,
    hover(raw) {
      ghost = ghostAt(raw)
    },
    // клик инструментом: установка в положение призрака с выделением, одна запись истории; false — места нет
    place(raw) {
      const at = ghostAt(raw)
      if (!at) return false
      const placed = { ...at, id: crypto.randomUUID() }
      host.record()
      host.add(placed)
      host.changed()
      host.select(placed)
      ghost = null
      return true
    },
    pressNumber(p) {
      const selected = host.selectedBatteries()
      const b = selected.length === 1 && host.editable(selected[0]) ? selected[0] : null
      const n = b ? numberAt(p, numbersOf(b), HIT_TOLERANCE_PX / k()) : null
      if (!b || !n) return false
      closeEditor()
      const view = host.view()
      const at = { x: (n.center.x - view.pan.x) * k(), y: (n.center.y - view.pan.y) * k() }
      editor = openNumberEditor(
        host.editorParent,
        at,
        host.formatCm(n.valueCm),
        (text) => apply(b, n, text),
        () => {
          editor = null
        },
      )
      return true
    },
    // нажатие на батарею: выделение и начало перетаскивания вдоль опорной стены
    pressBody(p) {
      const hit = hitBattery(p, host.walls(), host.batteries().filter(host.editable), host.radiusCm())
      if (!hit) return false
      closeEditor()
      const sel = host.selectedBatteries()
      if (sel.length !== 1 || sel[0] !== hit) host.select(hit)
      drag = { start: hit, live: hit, grab: p, snapshot: host.snapshot(), moved: false }
      return true
    },
    // сдвиг от начала жеста полным вектором; батарея не заходит на соседей и стыки
    dragTo(p) {
      if (!drag) return
      drag.moved = true
      const r = slideBattery(drag.start, host.walls(), { x: p.x - drag.grab.x, y: p.y - drag.grab.y }, context())
      const next = r.kind === "applied" ? r.battery : drag.start
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
    // стрелки при выделении батарей без стен: каждая сдвигается вдоль своей опорной стены, серия — одна запись
    nudge(arrow, stepCm) {
      const before = host.snapshot()
      let moved = false
      for (const prev of host.selectedBatteries()) {
        if (!host.editable(prev)) continue
        const r = arrowSlideBattery(prev, host.walls(), arrow, stepCm, context())
        if (r.kind !== "applied") continue
        host.replace(prev, r.battery)
        moved = true
      }
      if (!moved) return false
      host.recordNudge(before)
      host.changed()
      return true
    },
    clearGhost() {
      ghost = null
    },
    closeEditor,
    reset() {
      ghost = null
      drag = null
      closeEditor()
    },
  }
}
