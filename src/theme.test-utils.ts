// Утилиты тестов change dark-theme: запись цветов, которыми закрашивается каждая операция рисования,
// и контраст цветов по WCAG.

export type PaintKind = "fill" | "stroke" | "fillRect" | "strokeRect" | "fillText" | "strokeText"

export interface PaintOp {
  kind: PaintKind
  style: string // fillStyle для заливок, strokeStyle для обводок
  text?: string
  hasArc: boolean // в текущем пути есть дуга (ручки, точка привязки, дуга угла)
}

interface StyleState {
  fillStyle: string
  strokeStyle: string
  globalAlpha: number
}

const FILL_KINDS: ReadonlySet<PaintKind> = new Set<PaintKind>(["fill", "fillRect", "fillText"])

// Фейковый 2D-контекст: запоминает стиль на каждой операции рисования с учётом save/restore.
// Прочие методы — пустые; measureText даёт ширину по числу символов.
export function styleRecorder(): { ctx: CanvasRenderingContext2D; ops: PaintOp[] } {
  const ops: PaintOp[] = []
  let state: StyleState = { fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1 }
  const stack: StyleState[] = []
  let hasArc = false
  const paint = (kind: PaintKind, text?: string): void => {
    ops.push({ kind, style: FILL_KINDS.has(kind) ? state.fillStyle : state.strokeStyle, text, hasArc })
  }
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => {
      stack.push({ ...state })
    },
    restore: () => {
      state = stack.pop() ?? state
    },
    beginPath: () => {
      hasArc = false
    },
    arc: () => {
      hasArc = true
    },
    fill: () => paint("fill"),
    stroke: () => paint("stroke"),
    fillRect: () => paint("fillRect"),
    strokeRect: () => paint("strokeRect"),
    fillText: (text) => paint("fillText", String(text)),
    strokeText: (text) => paint("strokeText", String(text)),
    measureText: (text) => ({ width: String(text).length * 7 }),
  }
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get(_t, key) {
      if (key === "fillStyle" || key === "strokeStyle" || key === "globalAlpha") return state[key]
      if (typeof key === "string" && key in methods) return methods[key]
      if (typeof key === "string" && key in target) return target[key]
      return () => undefined
    },
    set(_t, key, value) {
      if (key === "fillStyle" || key === "strokeStyle") state[key] = String(value)
      else if (key === "globalAlpha") state.globalAlpha = Number(value)
      else if (typeof key === "string") target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, ops }
}

// холст для drawPatternPreview: getContext отдаёт записывающий контекст
export function previewCanvas(width = 36, height = 14): { canvas: HTMLCanvasElement; ops: PaintOp[] } {
  const { ctx, ops } = styleRecorder()
  const canvas = { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement
  return { canvas, ops }
}

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export function parseColor(css: string): Rgba {
  const s = css.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1]
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s)
  if (fn) return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: fn[4] === undefined ? 1 : Number(fn[4]) }
  throw new Error(`не цвет: ${css}`)
}

// цвет поверх непрозрачного фона
export function over(fg: Rgba, bg: Rgba): Rgba {
  return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 }
}

function luminance({ r, g, b }: Rgba): number {
  const ch = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

// контраст WCAG цвета css (с учётом прозрачности) на непрозрачном фоне bg
export function contrast(css: string, bg: string): number {
  const back = parseColor(bg)
  const l1 = luminance(over(parseColor(css), back))
  const l2 = luminance(back)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

export const isLightColor = (css: string): boolean => luminance(parseColor(css)) > 0.5
export const isDarkColor = (css: string): boolean => luminance(parseColor(css)) < 0.05

// хранилище в памяти; failGet/failSet — бросать исключение, как заблокированный localStorage
export function memoryStorage(
  init: Record<string, string> = {},
  opts: { failGet?: boolean; failSet?: boolean } = {},
): { getItem(key: string): string | null; setItem(key: string, value: string): void; data: Map<string, string> } {
  const data = new Map(Object.entries(init))
  return {
    data,
    getItem(key: string): string | null {
      if (opts.failGet) throw new Error("SecurityError")
      return data.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      if (opts.failSet) throw new Error("QuotaExceededError")
      data.set(key, value)
    },
  }
}
