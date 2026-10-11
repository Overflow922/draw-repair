import type { jsPDF } from "jspdf"
import type { Rgb } from "./pdf-colors.test-utils"

// change pdf-legend: разбор штрихов страницы jsPDF (без сжатия) с рисунком линии: толщина, цвет, пунктир (оператор d)
// и наличие кривых (оператор c). Дополняет pdf-colors.test-utils, который пунктир и кривые не различает.
// Координаты — миллиметры страницы, начало в левом верхнем углу (ось y вниз).

export interface StyledPoint {
  x: number
  y: number
}

export interface StyledRect {
  x: number
  y: number
  w: number
  h: number
}

export interface StyledStroke {
  subpaths: readonly (readonly StyledPoint[])[]
  widthMm: number
  color: Rgb
  dash: readonly number[] // пустой — сплошная линия
  curved: boolean // в пути есть кривая (дуга, волна)
  clip: StyledRect | null // габариты пересечения действующих путей клиппинга (W n); null — клиппинга нет
}

const bboxOfPoints = (pts: readonly StyledPoint[]): StyledRect | null => {
  if (pts.length === 0) return null
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

const intersect = (a: StyledRect, b: StyledRect): StyledRect => {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) }
}

// Видимые габариты штриха: габариты его точек, обрезанные путём клиппинга (штриховка в потоке длиннее образца —
// её обрезает клиппинг, поэтому по сырой геометрии границы не определить). Надмножество настоящих видимых границ.
export function visibleBBox(s: StyledStroke): StyledRect | null {
  const raw = bboxOfPoints(s.subpaths.flat())
  if (raw === null) return null
  return s.clip === null ? raw : intersect(raw, s.clip)
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
  dash: readonly number[]
  clip: StyledRect | null
}

export function parseStyledStrokes(doc: jsPDF, pageIndex = 1): StyledStroke[] {
  const k = doc.internal.scaleFactor
  const heightMm = doc.internal.pageSize.getHeight()
  const toMm = (pt: number): number => pt / k
  // «[a b] 0 d» → одиночный токен DASH(a,b); «[] 0 d» → DASH()
  const content = pageContent(doc, pageIndex)
    .replace(/BT[\s\S]*?ET/g, " ")
    .replace(/\[([^\]]*)\]\s*[-\d.]+\s+d(?=\s|$)/g, (_all, list: string) => ` DASH(${list.trim().split(/\s+/).filter((x) => x !== "").join(",")}) `)
  const tokens = content.split(/\s+/).filter((t) => t.length > 0)

  const out: StyledStroke[] = []
  const stack: number[] = []
  const saved: GState[] = []
  let state: GState = { width: 1, color: [0, 0, 0], dash: [], clip: null }
  let subpaths: { x: number; y: number }[][] = []
  let curved = false
  let clipPending = false
  const point = (x: number, y: number): StyledPoint => ({ x: toMm(x), y: heightMm - toMm(y) })
  const paint = (): void => {
    out.push({ subpaths, widthMm: toMm(state.width), color: state.color, dash: state.dash, curved, clip: state.clip })
    subpaths = []
    curved = false
  }

  for (const token of tokens) {
    if (token.startsWith("DASH(")) {
      const list = token.slice(5, -1)
      state = { ...state, dash: list === "" ? [] : list.split(",").map(Number) }
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
      case "l": {
        const x = stack[n - 2]
        const y = stack[n - 1]
        const last = subpaths[subpaths.length - 1]
        if (x !== undefined && y !== undefined && last) last.push(point(x, y))
        break
      }
      case "c": {
        const x = stack[n - 2]
        const y = stack[n - 1]
        const last = subpaths[subpaths.length - 1]
        if (x !== undefined && y !== undefined && last) last.push(point(x, y))
        curved = true
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
      case "W":
      case "W*":
        clipPending = true
        break
      case "n": {
        if (clipPending) {
          const box = bboxOfPoints(subpaths.flat())
          if (box !== null) state = { ...state, clip: state.clip === null ? box : intersect(state.clip, box) }
          clipPending = false
        }
        subpaths = []
        curved = false
        break
      }
      case "S":
      case "s":
      case "B":
      case "B*":
      case "b":
      case "b*":
        paint()
        break
      case "f":
      case "F":
      case "f*":
        subpaths = []
        curved = false
        break
      default:
    }
    stack.length = 0
  }
  return out
}
