import type { jsPDF } from "jspdf"

// change new-wall-materials: упорядоченный разбор операций рисования страницы jsPDF (без сжатия): штрихи (толщина, цвет,
// пунктир, вершины) и заливки (цвет заливки, габариты) в порядке вывода — дополняет pdf-style.test-utils, который
// заливки не различает. Координаты — миллиметры страницы, начало в левом верхнем углу (ось y вниз).

export type PaintRgb = readonly [number, number, number]

export interface PaintPoint {
  x: number
  y: number
}

export interface PaintBox {
  x: number
  y: number
  w: number
  h: number
}

export type PaintOp =
  | { kind: "stroke"; subpaths: readonly (readonly PaintPoint[])[]; widthMm: number; color: PaintRgb; dash: readonly number[] }
  | { kind: "fill"; subpaths: readonly (readonly PaintPoint[])[]; color: PaintRgb; box: PaintBox | null }

const boxOf = (pts: readonly PaintPoint[]): PaintBox | null => {
  if (pts.length === 0) return null
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function pageContent(doc: jsPDF, pageIndex: number): string {
  doc.output("arraybuffer")
  const raw: unknown = doc.internal.pages[pageIndex]
  if (!Array.isArray(raw)) throw new Error(`страница ${pageIndex} без содержимого`)
  return raw.filter((line): line is string => typeof line === "string").join("\n")
}

interface GState {
  width: number
  stroke: PaintRgb
  fill: PaintRgb
  dash: readonly number[]
}

export function parsePaint(doc: jsPDF, pageIndex = 1): PaintOp[] {
  const k = doc.internal.scaleFactor
  const heightMm = doc.internal.pageSize.getHeight()
  const toMm = (pt: number): number => pt / k
  const content = pageContent(doc, pageIndex)
    .replace(/BT[\s\S]*?ET/g, " ")
    .replace(/\[([^\]]*)\]\s*[-\d.]+\s+d(?=\s|$)/g, (_all, list: string) => ` DASH(${list.trim().split(/\s+/).filter((x) => x !== "").join(",")}) `)
  const tokens = content.split(/\s+/).filter((t) => t.length > 0)

  const out: PaintOp[] = []
  const stack: number[] = []
  const saved: GState[] = []
  let state: GState = { width: 1, stroke: [0, 0, 0], fill: [0, 0, 0], dash: [] }
  let subpaths: PaintPoint[][] = []
  const point = (x: number, y: number): PaintPoint => ({ x: toMm(x), y: heightMm - toMm(y) })
  const rect = (x: number, y: number, w: number, h: number): PaintPoint[] => [point(x, y), point(x + w, y), point(x + w, y + h), point(x, y + h), point(x, y)]

  for (const token of tokens) {
    if (token.startsWith("DASH(")) {
      const list = token.slice(5, -1)
      state = { ...state, dash: list === "" ? [] : list.split(",").map((v) => toMm(Number(v))) }
      continue
    }
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
        state = { ...state, stroke: [g, g, g] }
        break
      }
      case "g": {
        const g = stack[n - 1] ?? 0
        state = { ...state, fill: [g, g, g] }
        break
      }
      case "RG":
        state = { ...state, stroke: [stack[n - 3] ?? 0, stack[n - 2] ?? 0, stack[n - 1] ?? 0] }
        break
      case "rg":
        state = { ...state, fill: [stack[n - 3] ?? 0, stack[n - 2] ?? 0, stack[n - 1] ?? 0] }
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
        if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) subpaths.push(rect(x, y, w, h))
        break
      }
      case "n":
        subpaths = []
        break
      case "S":
      case "s":
        out.push({ kind: "stroke", subpaths, widthMm: toMm(state.width), color: state.stroke, dash: state.dash })
        subpaths = []
        break
      case "f":
      case "F":
      case "f*":
        out.push({ kind: "fill", subpaths, color: state.fill, box: boxOf(subpaths.flat()) })
        subpaths = []
        break
      case "B":
      case "B*":
      case "b":
      case "b*":
        out.push({ kind: "fill", subpaths, color: state.fill, box: boxOf(subpaths.flat()) })
        out.push({ kind: "stroke", subpaths, widthMm: toMm(state.width), color: state.stroke, dash: state.dash })
        subpaths = []
        break
      default:
    }
    stack.length = 0
  }
  return out
}
