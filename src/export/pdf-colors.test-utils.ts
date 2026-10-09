import type { jsPDF } from "jspdf"

// change demolition-plan: разбор цвета штриха операторов страницы jsPDF (без сжатия) — дополняет pdf-ops.test-utils,
// который цвет не читает. Серый цвет записывается оператором «g G», остальные — «r g b RG» (значения 0…1).
// Координаты — миллиметры страницы, начало в левом верхнем углу (ось y вниз), как в pdf-ops.test-utils.

export type Rgb = readonly [number, number, number]

export interface ColoredStroke {
  subpaths: readonly (readonly { x: number; y: number }[])[]
  widthMm: number
  color: Rgb
}

function pageContent(doc: jsPDF, pageIndex: number): string {
  doc.output("arraybuffer")
  const raw: unknown = doc.internal.pages[pageIndex]
  if (!Array.isArray(raw)) throw new Error(`страница ${pageIndex} без содержимого`)
  return raw.filter((line): line is string => typeof line === "string").join("\n")
}

interface GState {
  width: number
  color: Rgb
}

export function parseColoredStrokes(doc: jsPDF, pageIndex = 1): ColoredStroke[] {
  const k = doc.internal.scaleFactor
  const heightMm = doc.internal.pageSize.getHeight()
  const toMm = (pt: number): number => pt / k
  const content = pageContent(doc, pageIndex).replace(/BT[\s\S]*?ET/g, " ")
  const tokens = content.split(/\s+/).filter((t) => t.length > 0)

  const out: ColoredStroke[] = []
  const stack: number[] = []
  const saved: GState[] = []
  let state: GState = { width: 1, color: [0, 0, 0] }
  let subpaths: { x: number; y: number }[][] = []
  const point = (x: number, y: number): { x: number; y: number } => ({ x: toMm(x), y: heightMm - toMm(y) })

  for (const token of tokens) {
    const num = Number(token)
    if (token !== "" && Number.isFinite(num)) {
      stack.push(num)
      continue
    }
    const n = stack.length
    switch (token) {
      case "w":
        state = { ...state, width: stack[n - 1] ?? state.width }
        break
      case "G": {
        const g = stack[n - 1] ?? 0
        state = { ...state, color: [g, g, g] }
        break
      }
      case "RG":
        state = { ...state, color: [stack[n - 3] ?? 0, stack[n - 2] ?? 0, stack[n - 1] ?? 0] }
        break
      case "q":
        saved.push(state)
        break
      case "Q":
        state = saved.pop() ?? state
        break
      case "m": {
        const x = stack[n - 2]
        const y = stack[n - 1]
        if (x !== undefined && y !== undefined) subpaths.push([point(x, y)])
        break
      }
      case "l":
      case "c": {
        const x = stack[n - 2]
        const y = stack[n - 1]
        const last = subpaths[subpaths.length - 1]
        if (x !== undefined && y !== undefined && last) last.push(point(x, y))
        break
      }
      case "re": {
        const x = stack[n - 4]
        const y = stack[n - 3]
        const w = stack[n - 2]
        const h = stack[n - 1]
        if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
          subpaths.push([point(x, y), point(x + w, y), point(x + w, y + h), point(x, y + h), point(x, y)])
        }
        break
      }
      case "n":
        subpaths = []
        break
      case "S":
      case "s":
      case "B":
      case "B*":
      case "b":
      case "b*":
        out.push({ subpaths, widthMm: toMm(state.width), color: state.color })
        subpaths = []
        break
      case "f":
      case "F":
      case "f*":
        subpaths = []
        break
      default:
    }
    stack.length = 0
  }
  return out
}

export const isRed = (c: Rgb): boolean => c[0] > 0.5 && c[1] < 0.4 && c[2] < 0.4
export const isGray = (c: Rgb): boolean => Math.abs(c[0] - c[1]) < 0.01 && Math.abs(c[1] - c[2]) < 0.01

// «#rgb» и «#rrggbb» → компоненты 0…1
export const hexToRgb01 = (hex: string): Rgb => {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
  return [parseInt(full.slice(1, 3), 16) / 255, parseInt(full.slice(3, 5), 16) / 255, parseInt(full.slice(5, 7), 16) / 255]
}

export const sameColor = (a: Rgb, b: Rgb, tol = 0.01): boolean => Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol

// сегменты штрихов: пары последовательных вершин каждого подпути
export function colorSegments(strokes: readonly ColoredStroke[]): { a: { x: number; y: number }; b: { x: number; y: number }; widthMm: number; color: Rgb }[] {
  return strokes.flatMap((s) =>
    s.subpaths.flatMap((sp) =>
      sp.slice(1).map((q, i) => ({ a: sp[i] as { x: number; y: number }, b: q, widthMm: s.widthMm, color: s.color })),
    ),
  )
}
