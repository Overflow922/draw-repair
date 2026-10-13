import { CHAR_WIDTH } from "../doorway/element-label"
import { openNumberEditor } from "../doorway/doorway-tool"
import type { NumberEditor } from "../doorway/doorway-tool"
import { formatLength } from "../format-length"
import type { Scene } from "../history"
import { SCREEN_METRICS } from "../render"
import type { Communication, Point, Unit, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import type { CommunicationTool } from "./communications-group"
import { diameterLeader } from "./diameter-leader"
import { OUTSET_PX, applyNumber, communicationNumbers } from "./edit"
import type { CommunicationNumber } from "./edit"
import { hitCommunication } from "./pick"
import { DEFAULT_DUCT_CM, DEFAULT_RISER_DIAMETER_CM, ghostPosition, moveLimited } from "./placement"

// Адаптер DOM коммуникаций (change add-communications, design D9): инструменты «Стояк» и «Воздуховод» — призрак и
// установка кликом; выделенная коммуникация — перетаскивание за тело и правка чисел на месте. Состояние чертежа и
// выделения остаётся в main.ts и доступно через явный CommunicationToolHost; размер новых коммуникаций хранится
// здесь в пределах сеанса (не в чертеже и не в истории).

export interface CommunicationToolHost {
  walls(): readonly Wall[]
  communications(): readonly Communication[]
  selected(): Communication | null
  view(): View
  unit(): Unit
  formatCm(cm: number): string // число в текущей единице для поля ввода
  parseCm(text: string): number // NaN — не число
  editorParent: HTMLElement
  snapshot(): Scene
  record(): void // одна запись истории перед правкой
  recordSnapshot(snapshot: Scene): void
  add(c: Communication): void // добавить в чертёж и выделить
  replace(prev: Communication, next: Communication): void // заменить в чертеже; выделение переходит на next
  select(c: Communication): void
  changed(): void // чертёж изменён — сохранить
  redraw(): void
}

export interface CommunicationToolAdapter {
  ghost(): Communication | null
  dragging(): boolean
  hover(kind: CommunicationTool, raw: Point): void
  place(kind: CommunicationTool, raw: Point): boolean
  pressNumber(p: Point): boolean
  pressBody(p: Point): boolean
  dragTo(p: Point): void
  endDrag(): void
  clearGhost(): void
  closeEditor(): void
  reset(): void
}

const HIT_TOLERANCE_PX = 4 // допуск попадания в правимое число, как у чисел проёма
const BODY_HIT_PX = 2 // допуск попадания в тело коммуникации

// допуск попадания в тело в см при масштабе k пикселей на см
export const communicationBodyTolCm = (k: number): number => BODY_HIT_PX / k

export function createCommunicationTool(host: CommunicationToolHost): CommunicationToolAdapter {
  const params: { riserDiameterCm: number; widthCm: number; depthCm: number } = { riserDiameterCm: DEFAULT_RISER_DIAMETER_CM, widthCm: DEFAULT_DUCT_CM.width, depthCm: DEFAULT_DUCT_CM.depth }
  let ghost: Communication | null = null
  let editor: NumberEditor | null = null
  let drag: { start: Communication; live: Communication; grab: Point; snapshot: Scene } | null = null

  const k = (): number => PX_PER_CM * host.view().zoom
  const others = (c: Communication): Communication[] => host.communications().filter((o) => o.id !== c.id)

  const prototype = (kind: CommunicationTool): Communication =>
    kind === "riser"
      ? { kind: "riser", id: "", x: 0, y: 0, diameterCm: params.riserDiameterCm }
      : { kind: "duct", id: "", x: 0, y: 0, widthCm: params.widthCm, depthCm: params.depthCm }

  // курсор внутри тела существующей коммуникации — призрака нет: клик по ней новую не ставит (spec communications
  // «Установка коммуникации», сценарий «Клик по существующей коммуникации»)
  const ghostAt = (kind: CommunicationTool, raw: Point): Communication | null =>
    hitCommunication(raw, host.communications(), 0) ? null : ghostPosition(prototype(kind), raw, host.walls(), host.communications())

  // размер, введённый на месте, становится размером новых коммуникаций этого вида (spec «Группа «Коммуникации»…»)
  const inherit = (c: Communication): void => {
    if (c.kind === "riser") params.riserDiameterCm = c.diameterCm
    else {
      params.widthCm = c.widthCm
      params.depthCm = c.depthCm
    }
  }

  const textOf = (n: CommunicationNumber): string => {
    const value = formatLength(n.valueCm, host.unit())
    return n.field.kind === "diameter" ? `⌀${value}` : value
  }

  // центр числа в мире: диаметр стоит на полке выноски вне окружности, размер воздуховода — на вынесенной размерной
  // линии, расстояния — у своей точки
  const numberPosition = (n: CommunicationNumber, c: Communication): Point => {
    if (n.outward) return { x: n.at.x + (n.outward.x * OUTSET_PX) / k(), y: n.at.y + (n.outward.y * OUTSET_PX) / k() }
    if (n.field.kind !== "diameter" || c.kind !== "riser") return n.at
    const px = SCREEN_METRICS.labelPx
    const text = diameterLeader({ x: 0, y: 0 }, (c.diameterCm / 2) * k(), textOf(n).length * px * CHAR_WIDTH, px).textCenter
    return { x: c.x + text.x / k(), y: c.y + text.y / k() }
  }

  // число, в область которого попала точка: размер и нулевое расстояние — прямоугольник текста, расстояние с размерной
  // линией — круг вокруг середины линии (текст стоит над линией вдоль неё)
  const numberAt = (p: Point, c: Communication): CommunicationNumber | null => {
    const px = SCREEN_METRICS.labelPx
    const tol = HIT_TOLERANCE_PX / k()
    let best: CommunicationNumber | null = null
    let bestDistance = Infinity
    for (const n of communicationNumbers(c, host.walls())) {
      const half = (textOf(n).length * px * CHAR_WIDTH) / 2 / k()
      const at = numberPosition(n, c)
      const dx = Math.abs(p.x - at.x)
      const dy = Math.abs(p.y - at.y)
      const inside = n.span ? Math.hypot(dx, dy) <= half + px / k() + tol : dx <= half + tol && dy <= px / 2 / k() + tol
      const distance = Math.hypot(dx, dy)
      if (inside && distance < bestDistance) {
        best = n
        bestDistance = distance
      }
    }
    return best
  }

  const apply = (c: Communication, n: CommunicationNumber, text: string): void => {
    const value = host.parseCm(text)
    if (!Number.isFinite(value)) return
    const before = host.snapshot()
    const result = applyNumber(c, n.field, value, host.walls(), others(c))
    if (!result.changed) return
    host.recordSnapshot(before)
    host.replace(c, result.communication)
    if (n.field.kind !== "distance") inherit(result.communication)
    host.changed()
    host.redraw()
  }

  const closeEditor = (): void => {
    editor?.close()
    editor = null
  }

  return {
    ghost: () => ghost,
    dragging: () => drag !== null,
    hover(kind, raw) {
      ghost = ghostAt(kind, raw)
    },
    place(kind, raw) {
      const at = ghostAt(kind, raw)
      if (!at) return false
      const placed = { ...at, id: crypto.randomUUID() }
      host.record()
      host.add(placed)
      host.changed()
      ghost = null
      return true
    },
    pressNumber(p) {
      const c = host.selected()
      const n = c ? numberAt(p, c) : null
      if (!c || !n) return false
      closeEditor()
      const scale = k()
      const view = host.view()
      const world = numberPosition(n, c)
      const at = { x: (world.x - view.pan.x) * scale, y: (world.y - view.pan.y) * scale }
      editor = openNumberEditor(
        host.editorParent,
        at,
        host.formatCm(n.valueCm),
        (text) => apply(c, n, text),
        () => {
          editor = null
        },
      )
      return true
    },
    pressBody(p) {
      // выбор и перетаскивание — по телу, а не по радиусу привязки (он только у ластика): иначе коммуникация вплотную
      // к стене перехватывает нажатия по стене; допуск — пара пикселей
      const c = hitCommunication(p, host.communications(), communicationBodyTolCm(k()))
      if (!c) return false
      closeEditor()
      host.select(c)
      drag = { start: c, live: c, grab: p, snapshot: host.snapshot() }
      return true
    },
    dragTo(p) {
      if (!drag) return
      const { start, grab } = drag
      const target = { x: start.x + p.x - grab.x, y: start.y + p.y - grab.y }
      const at = moveLimited(start, target, host.walls(), others(start))
      const next = { ...start, x: at.x, y: at.y }
      host.replace(drag.live, next)
      drag.live = next
    },
    endDrag() {
      if (!drag) return
      const { start, live, snapshot } = drag
      drag = null
      if (live.x === start.x && live.y === start.y) return
      host.recordSnapshot(snapshot)
      host.changed()
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
