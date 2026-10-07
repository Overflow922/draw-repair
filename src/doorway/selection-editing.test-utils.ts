import { vi } from "vitest"
import type { Scene } from "../history"
import type { Room } from "../room-area"
import type { DoorHinge, Point, Unit, View, Wall, WallElement } from "../types"
import { PX_PER_CM, isDoor, isWindow } from "../types"
import type { ElementToolHost } from "./doorway-tool"
import type { NewElementParams } from "./element-kind"
import { recorder } from "./doorway.test-utils"
import type { Op, StrokeOp } from "./doorway.test-utils"

// change popups-buttons-only: фейковый хост адаптеров, поле ввода на месте числа, записывающий контекст со
// штриховкой линий и эталоны положения чисел подписи (test-plan.md). Эталоны выводятся из спецификации и
// design D1/D2 (оценка ширины текста 0.6 · кегль, вынос подписи), а не из продакшн-модулей.

export const LABEL_PX = 14 // кегль экранных подписей (SCREEN_METRICS.labelPx)
export const CHAR_PX = LABEL_PX * 0.6 // оценка ширины символа

// ---------- параметры новых элементов: независимый эталон spec «… и параметры новых …» ----------

export const INITIAL: NewElementParams = {
  doorway: { widthCm: 90, heightCm: 210 },
  door: { widthCm: 90, heightCm: 210, hinge: "a" },
  window: { widthCm: 120, heightCm: 150, sillCm: 85 },
}

export function expectedInherit(p: NewElementParams, e: WallElement): NewElementParams {
  if (isWindow(e)) return { ...p, window: { widthCm: e.widthCm, heightCm: e.heightCm, sillCm: e.sillCm } }
  if (isDoor(e)) return { ...p, door: { widthCm: e.widthCm, heightCm: e.heightCm, hinge: e.hinge } }
  return { ...p, doorway: { widthCm: e.widthCm, heightCm: e.heightCm } }
}

export const withDoorHinge = (p: NewElementParams, hinge: DoorHinge): NewElementParams => ({ ...p, door: { ...p.door, hinge } })

// ---------- фейковый хост ----------

const UNIT_CM: Record<Unit, number> = { m: 100, cm: 1, mm: 0.1 }

export interface HostState {
  elements: WallElement[]
  selected: WallElement[]
  added: WallElement[]
  records: number
  // порядок вызовов record / replace — запись истории до правки
  calls: string[]
  inherited: WallElement[]
  params: NewElementParams
  othersSelected: boolean
}

export interface FakeHost extends ElementToolHost {
  state: HostState
}

export interface HostOptions {
  unit?: Unit
  zoom?: number
  rooms?: Room[]
  params?: NewElementParams
  othersSelected?: boolean
}

export function fakeHost(walls: Wall[], elements: WallElement[], selected: WallElement[] = [], o: HostOptions = {}): FakeHost {
  const unit = o.unit ?? "cm"
  const state: HostState = {
    elements: [...elements],
    selected: [...selected],
    added: [],
    records: 0,
    calls: [],
    inherited: [],
    params: o.params ?? INITIAL,
    othersSelected: o.othersSelected ?? false,
  }
  const view: View = { zoom: o.zoom ?? 1, pan: { x: 0, y: 0 } }
  const snapshot = (): Scene => ({ walls, dimensions: [], doorways: [...state.elements] })
  return {
    state,
    walls: () => walls,
    elements: () => state.elements,
    selectedElements: () => state.selected,
    othersSelected: () => state.othersSelected,
    view: () => view,
    radiusCm: () => 3,
    formatCm: (cm: number) => {
      if (unit === "m") return (Math.round(cm) / 100).toString()
      return String(Math.round(cm / UNIT_CM[unit]))
    },
    parseCm: (text: string) => {
      const t = text.trim().replace(",", ".")
      return t === "" ? Number.NaN : Number(t) * UNIT_CM[unit]
    },
    unitLabel: () => unit,
    unit: () => unit,
    rooms: () => o.rooms ?? [],
    editorParent: { append: () => {} } as unknown as HTMLElement,
    snapshot,
    record: () => {
      state.records++
      state.calls.push("record")
    },
    recordSnapshot: () => {
      state.records++
      state.calls.push("record")
    },
    recordNudge: () => {
      state.records++
      state.calls.push("record")
    },
    add: (e: WallElement) => {
      state.elements = [...state.elements, e]
      state.added.push(e)
    },
    replace: (prev: WallElement, next: WallElement) => {
      state.calls.push("replace")
      state.elements = state.elements.map((e) => (e === prev ? next : e))
      state.selected = state.selected.map((e) => (e === prev ? next : e))
    },
    select: (e: WallElement) => {
      state.selected = [e]
    },
    clearSelection: () => {
      state.selected = []
    },
    changed: () => {},
    redraw: () => {},
    params: () => state.params,
    inherit: (e: WallElement) => {
      state.inherited.push(e)
      state.params = expectedInherit(state.params, e)
    },
  }
}

export const byId = (list: readonly WallElement[], id: string): WallElement => {
  const e = list.find((x) => x.id === id)
  if (!e) throw new Error(`нет элемента ${id}`)
  return e
}

// ---------- поле ввода на месте числа: document.createElement подменён ----------

export interface EditorInput {
  value: string
  key(key: string): void
  blur(): void
}

export function stubEditorDom(): EditorInput[] {
  const editors: EditorInput[] = []
  vi.stubGlobal("document", {
    activeElement: null,
    createElement: (): unknown => {
      const handlers = new Map<string, ((e: { key: string; stopPropagation(): void }) => void)[]>()
      const fire = (type: string, key: string): void => {
        for (const fn of handlers.get(type) ?? []) fn({ key, stopPropagation: () => {} })
      }
      const input = {
        className: "",
        type: "",
        inputMode: "",
        value: "",
        style: {} as Record<string, string>,
        addEventListener(type: string, fn: (e: { key: string; stopPropagation(): void }) => void): void {
          handlers.set(type, [...(handlers.get(type) ?? []), fn])
        },
        remove(): void {},
        focus(): void {},
        select(): void {},
        key(key: string): void {
          fire("keydown", key)
        },
        blur(): void {
          fire("blur", "")
        },
      }
      editors.push(input)
      return input
    },
  })
  return editors
}

// ---------- эталоны положения чисел (мир, зум 1 по умолчанию) ----------

// вынос числа цепочки от грани: 1.2 · кегль экрана
export const chainOffsetCm = (zoom = 1): number => (LABEL_PX * 1.2) / (PX_PER_CM * zoom)

// центр текста числа цепочки над размерной линией: зазор 1.5 px + полкегля (базовая линия «bottom»)
export const chainTextLiftCm = (zoom = 1): number => (1.5 + LABEL_PX / 2) / (PX_PER_CM * zoom)

// отступ центра подписи от грани: полоса цепочки 2.2 · кегль + полувысота рамки (кегль/2 + поле 0.3 · кегль)
export const labelGapCm = (zoom = 1): number => (LABEL_PX * 2.2 + LABEL_PX / 2 + 0.3 * LABEL_PX) / (PX_PER_CM * zoom)

// смещение центра числа от центра подписи вдоль направления текста (px экрана):
// parts — части подписи, part — индекс части, prefix — длина префикса части («H=» — 2, «H под.=» — 7)
export function numberOffsetPx(parts: string[], part: number, prefix: number): number {
  const GAP = 2
  const total = parts.join("  ").length
  let start = 0
  for (let i = 0; i < part; i++) start += parts[i].length + GAP
  const digits = parts[part].length - prefix
  const center = start + prefix + digits / 2
  return (center - total / 2) * CHAR_PX
}

// ---------- записывающий контекст со штриховкой ----------

export interface DashedStroke {
  op: StrokeOp
  dash: number[]
}

export function dashRecorder(): { ctx: CanvasRenderingContext2D; ops: Op[]; dashed: DashedStroke[] } {
  const { ctx, ops } = recorder()
  const dashed: DashedStroke[] = []
  let dash: number[] = []
  const stack: number[][] = []
  const target = ctx as unknown as Record<string | symbol, unknown>
  const call = (prop: string, args: unknown[]): unknown => {
    const fn = target[prop]
    return typeof fn === "function" ? (fn as (...a: unknown[]) => unknown).apply(ctx, args) : undefined
  }
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(t, prop) {
      if (prop === "setLineDash")
        return (d: number[]): void => {
          dash = [...d]
        }
      if (prop === "getLineDash") return (): number[] => [...dash]
      if (prop === "save")
        return (): void => {
          stack.push(dash)
          call("save", [])
        }
      if (prop === "restore")
        return (): void => {
          dash = stack.pop() ?? []
          call("restore", [])
        }
      if (prop === "stroke")
        return (): void => {
          const before = ops.length
          call("stroke", [])
          const op = ops[before]
          if (op && op.kind === "stroke" && dash.some((x) => x > 0)) dashed.push({ op, dash: [...dash] })
        }
      if (prop === "arc")
        return (x: number, y: number, r: number, s: number, e: number): void => {
          // дуга ломаной из 16 отрезков — чтобы штриховые дуги были видны как отрезки
          const n = 16
          for (let i = 0; i <= n; i++) {
            const a = s + ((e - s) * i) / n
            call(i === 0 ? "moveTo" : "lineTo", [x + r * Math.cos(a), y + r * Math.sin(a)])
          }
        }
      if (prop === "roundRect") return (x: number, y: number, w: number, h: number): void => void call("rect", [x, y, w, h])
      return t[prop]
    },
    set(t, prop, value) {
      t[prop] = value
      return true
    },
  }
  return { ctx: new Proxy(target, handler) as unknown as CanvasRenderingContext2D, ops, dashed }
}

const segLen = (s: [Point, Point]): number => Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y)

// штриховое подчёркивание числа: отрезок длиной ≈ ширины числа, параллельный dir, середина — под точкой
// numberCenter на 1…12 px в сторону «вниз» текста (нормаль dir, повёрнутая по часовой на экране). Для числа
// подписи передаётся центр числа, для числа цепочки — точка привязки текста (низ текста над размерной линией)
export function underlineOf(dashed: DashedStroke[], numberCenter: Point, digits: number, dir: Point): boolean {
  const down = { x: -dir.y, y: dir.x }
  const width = digits * CHAR_PX
  return dashed.some(({ op }) =>
    op.subpaths.some((sp) => {
      for (let i = 1; i < sp.length; i++) {
        const s: [Point, Point] = [sp[i - 1], sp[i]]
        const len = segLen(s)
        if (Math.abs(len - width) > 2.5) continue
        const v = { x: (s[1].x - s[0].x) / len, y: (s[1].y - s[0].y) / len }
        if (Math.abs(v.x * dir.y - v.y * dir.x) > 0.02) continue
        const mid = { x: (s[0].x + s[1].x) / 2, y: (s[0].y + s[1].y) / 2 }
        const rel = { x: mid.x - numberCenter.x, y: mid.y - numberCenter.y }
        const along = rel.x * dir.x + rel.y * dir.y
        const below = rel.x * down.x + rel.y * down.y
        if (Math.abs(along) <= 2 && below >= 1 && below <= 12) return true
      }
      return false
    }),
  )
}

// есть ли штриховой отрезок с серединой в пределах r px от точки
export const dashedNear = (dashed: DashedStroke[], p: Point, r: number): boolean =>
  dashed.some(({ op }) =>
    op.subpaths.some((sp) => {
      for (let i = 1; i < sp.length; i++) {
        const mid = { x: (sp[i - 1].x + sp[i].x) / 2, y: (sp[i - 1].y + sp[i].y) / 2 }
        if (Math.hypot(mid.x - p.x, mid.y - p.y) <= r) return true
      }
      return false
    }),
  )
