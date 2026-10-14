import { CHAR_WIDTH } from "../doorway/element-label"
import { SCREEN_METRICS } from "../render"
import type { Callout, Point, View } from "../types"
import { PX_PER_CM } from "../types"
import { commitCallout, moveCalloutPoint, removeCallout } from "./callout-actions"
import type { CalloutEdit } from "./callout-actions"
import { BOX_PAD_EM, LINE_STEP_EM, calloutLayout } from "./callout-layout"
import { pickCallout } from "./callout-pick"
import { openTextEditor } from "./text-editor"
import type { EditorGeometry, TextEditor } from "./text-editor"

// Адаптер DOM выносок (change add-callout, design D4, D5, D8, D9): инструмент «Выноска» — два клика и ввод текста на месте;
// выделение без инструмента — перенос точки стрелки и текста, правка текста кликом, удаление. Состояние чертежа остаётся
// в main.ts и доступно через явный CalloutToolHost; состояние жеста, выделения и поля ввода — здесь.

export interface CalloutToolHost {
  callouts(): readonly Callout[] // выноски активного плана
  setCallouts(next: Callout[]): void
  recordBefore(before: readonly Callout[]): void // одна запись истории: список до операции
  view(): View
  radiusCm(): number
  editorParent: HTMLElement
  newId(): string
  selected(): void // выноска выделена: main снимает выделение других объектов
  changed(): void // чертёж изменён — сохранить
  redraw(): void
}

export interface CalloutToolAdapter {
  displayList(): readonly Callout[] // выноски плана с живым текстом поля ввода и превью размещения
  selectedId(): string | null
  hasDraft(): boolean // задана точка стрелки, поле ввода ещё не открыто
  editing(): boolean // поле ввода открыто
  dragging(): boolean
  hover(p: Point): void
  click(p: Point): void // клик инструментом: точка стрелки, затем точка текста и поле ввода
  cancelDraft(): void
  press(p: Point): boolean // нажатие без инструмента: выделение и начало переноса
  dragTo(p: Point): void
  endDrag(): void
  pick(p: Point): Callout | null
  eraseAt(p: Point): boolean
  deleteSelected(): boolean
  deselect(): void
  commitEditor(): void
  reset(): void
}

const HANDLE_HIT_PX = 8 // допуск попадания в маркер точки
const DRAG_THRESHOLD_PX = 3 // нажатие и отпускание в пределах этого расстояния — клик, а не перенос

const measureContext = document.createElement("canvas").getContext("2d")
const FONT = `${SCREEN_METRICS.labelPx}px ${SCREEN_METRICS.font}`

// ширина строки тем же шрифтом, каким рисует холст
function measureLine(line: string): number {
  if (!measureContext) return line.length * SCREEN_METRICS.labelPx * CHAR_WIDTH
  measureContext.font = FONT
  return measureContext.measureText(line).width
}

export function createCalloutTool(host: CalloutToolHost): CalloutToolAdapter {
  let draft: Point | null = null // точка стрелки после первого клика
  let cursor: Point | null = null
  let selected: string | null = null
  let editor: { handle: TextEditor; edit: CalloutEdit; target: Point; at: Point; text: string } | null = null
  let drag: { id: string; which: "target" | "at"; before: Callout[]; grab: Point; startPx: Point; moved: boolean; reopen: boolean } | null = null

  const k = (): number => PX_PER_CM * host.view().zoom
  const toPx = (p: Point): Point => {
    const view = host.view()
    return { x: (p.x - view.pan.x) * k(), y: (p.y - view.pan.y) * k() }
  }
  const layoutOf = (c: Callout) => calloutLayout(c, host.view(), SCREEN_METRICS, measureLine)
  const pick = (p: Point): Callout | null => pickCallout(host.callouts(), p, host.view(), SCREEN_METRICS, measureLine, host.radiusCm())

  const geometryOf = (c: Callout): EditorGeometry => {
    const { box, align } = layoutOf(c)
    return {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      align,
      padPx: SCREEN_METRICS.labelPx * BOX_PAD_EM,
      lineHeightPx: SCREEN_METRICS.labelPx * LINE_STEP_EM,
      font: FONT,
    }
  }

  // фиксация текста при снятии редактирования: одна запись истории, если что-то изменилось
  const commit = (edit: CalloutEdit, text: string): void => {
    const before = host.callouts()
    const result = commitCallout([...before], edit, text)
    if (edit.kind === "edit" && selected === edit.id && !result.list.some((c) => c.id === edit.id)) selected = null
    if (result.changed) {
      host.recordBefore(before)
      host.setCallouts(result.list)
      host.changed()
    }
    host.redraw()
  }

  const openEditor = (edit: CalloutEdit, target: Point, at: Point, text: string): void => {
    const draftOf = (t: string): Callout => ({ id: edit.id, target, at, text: t })
    const handle = openTextEditor(
      host.editorParent,
      text,
      geometryOf(draftOf(text)),
      (t) => {
        if (editor) editor.text = t
        host.redraw()
        return geometryOf(draftOf(t))
      },
      (final) => commit(edit, final),
      () => {
        editor = null
      },
    )
    editor = { handle, edit, target, at, text }
  }

  const erase = (id: string): void => {
    const before = host.callouts()
    const result = removeCallout([...before], id)
    if (!result.changed) return
    host.recordBefore(before)
    host.setCallouts(result.list)
    if (selected === id) selected = null
    host.changed()
    host.redraw()
  }

  return {
    displayList() {
      const list = host.callouts()
      if (editor) {
        const live = { id: editor.edit.id, target: editor.target, at: editor.at, text: editor.text }
        return editor.edit.kind === "new" ? [...list, live] : list.map((c) => (c.id === live.id ? live : c))
      }
      if (draft) return [...list, { id: "", target: draft, at: cursor ?? draft, text: "" }]
      return list
    },
    selectedId: () => selected,
    hasDraft: () => draft !== null && editor === null,
    editing: () => editor !== null,
    dragging: () => drag !== null,
    hover(p) {
      cursor = p
    },
    click(p) {
      if (editor) return
      if (!draft) {
        draft = p
        host.redraw()
        return
      }
      // совпадающая точка текста не принимается: линия нулевой длины
      if (p.x === draft.x && p.y === draft.y) return
      const target = draft
      draft = null
      openEditor({ kind: "new", id: host.newId(), target, at: p }, target, p, "")
      host.redraw()
    },
    cancelDraft() {
      draft = null
      host.redraw()
    },
    press(p) {
      const hit = pick(p)
      if (!hit) return false
      const wasSelected = selected === hit.id
      selected = hit.id
      host.selected()
      const l = layoutOf(hit)
      const px = toPx(p)
      const near = (q: Point): number => Math.hypot(px.x - q.x, px.y - q.y)
      const inBox = px.x >= l.box.x && px.x <= l.box.x + l.box.w && px.y >= l.box.y && px.y <= l.box.y + l.box.h
      // точку стрелки тянет маркер у её конца; точку текста — сам текст или маркер у точки текста; линия только выделяет
      const which = near(l.arrowTip) <= HANDLE_HIT_PX ? "target" : inBox || near(toPx(hit.at)) <= HANDLE_HIT_PX ? "at" : null
      drag = which
        ? { id: hit.id, which, before: [...host.callouts()], grab: { x: p.x - hit[which].x, y: p.y - hit[which].y }, startPx: px, moved: false, reopen: wasSelected && which === "at" && inBox }
        : null
      host.redraw()
      return true
    },
    dragTo(p) {
      if (!drag) return
      const px = toPx(p)
      if (!drag.moved) {
        if (Math.hypot(px.x - drag.startPx.x, px.y - drag.startPx.y) < DRAG_THRESHOLD_PX) return
        drag.moved = true
      }
      host.setCallouts(moveCalloutPoint(drag.before, drag.id, drag.which, { x: p.x - drag.grab.x, y: p.y - drag.grab.y }).list)
      host.changed()
    },
    // отпускание: перенос — одна запись истории; нажатие без протяжки по тексту выделенной выноски открывает поле ввода
    endDrag() {
      const d = drag
      drag = null
      if (!d) return
      if (d.moved) {
        const was = d.before.find((c) => c.id === d.id)
        const now = host.callouts().find((c) => c.id === d.id)
        if (was && now && (was[d.which].x !== now[d.which].x || was[d.which].y !== now[d.which].y)) {
          host.recordBefore(d.before)
          host.changed() // история сохраняется вместе с чертежом при следующей перерисовке
        }
      } else if (d.reopen) {
        const c = host.callouts().find((o) => o.id === d.id)
        if (c) openEditor({ kind: "edit", id: c.id }, c.target, c.at, c.text)
      }
      host.redraw()
    },
    pick,
    eraseAt(p) {
      const hit = pick(p)
      if (!hit) return false
      erase(hit.id)
      return true
    },
    deleteSelected() {
      if (selected === null) return false
      erase(selected)
      return true
    },
    deselect() {
      selected = null
    },
    commitEditor() {
      editor?.handle.commit()
    },
    reset() {
      draft = null
      cursor = null
      drag = null
      selected = null
      editor?.handle.close()
      editor = null
    },
  }
}
