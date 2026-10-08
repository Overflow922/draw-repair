import type { jsPDF } from "jspdf"

// Разбор векторных операторов страницы jsPDF (без сжатия): пути, ширина линий, заливки.
// Координаты возвращаются в миллиметрах страницы, начало — левый верхний угол (ось y вниз).

export interface Pt {
  x: number
  y: number
}

export type PaintKind = "stroke" | "fill" | "both"

export interface PdfPath {
  points: readonly Pt[]
  closed: boolean
  paint: PaintKind
  widthMm: number
}

export interface Seg {
  a: Pt
  b: Pt
  widthMm: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const STROKE_OPS = new Set(["S", "s"])
const FILL_OPS = new Set(["f", "F", "f*"])
const BOTH_OPS = new Set(["B", "B*", "b", "b*"])
const CLOSING_OPS = new Set(["s", "b", "b*"])

function pageContent(doc: jsPDF, pageIndex: number): string {
  doc.output("arraybuffer")
  const raw: unknown = doc.internal.pages[pageIndex]
  if (!Array.isArray(raw)) throw new Error(`страница ${pageIndex} без содержимого`)
  return raw.filter((line): line is string => typeof line === "string").join("\n")
}

export function parsePaths(doc: jsPDF, pageIndex = 1): PdfPath[] {
  const k = doc.internal.scaleFactor
  const heightMm = doc.internal.pageSize.getHeight()
  const toMm = (pt: number): number => pt / k
  const content = pageContent(doc, pageIndex).replace(/BT[\s\S]*?ET/g, " ")
  const tokens = content.split(/\s+/).filter((t) => t.length > 0)

  const paths: PdfPath[] = []
  const stack: number[] = []
  const widthStack: number[] = []
  let widthPt = 1
  let subpaths: { points: Pt[]; closed: boolean }[] = []

  // клип-пути (W n) и пути без закраски отбрасываются: в результат попадает только то, что реально нарисовано
  const flush = (paint: PaintKind, closeAll: boolean): void => {
    for (const sp of subpaths) {
      if (sp.points.length === 0) continue
      paths.push({ points: sp.points, closed: sp.closed || closeAll, paint, widthMm: toMm(widthPt) })
    }
    subpaths = []
  }
  const point = (x: number, y: number): Pt => ({ x: toMm(x), y: heightMm - toMm(y) })
  const last = (): { points: Pt[]; closed: boolean } | undefined => subpaths[subpaths.length - 1]

  for (const token of tokens) {
    const num = Number(token)
    if (token !== "" && Number.isFinite(num)) {
      stack.push(num)
      continue
    }
    const n = stack.length
    switch (token) {
      case "w":
        widthPt = stack[n - 1] ?? widthPt
        break
      case "q":
        widthStack.push(widthPt)
        break
      case "Q":
        widthPt = widthStack.pop() ?? widthPt
        break
      case "m": {
        const x = stack[n - 2]
        const y = stack[n - 1]
        if (x !== undefined && y !== undefined) subpaths.push({ points: [point(x, y)], closed: false })
        break
      }
      case "l": {
        const x = stack[n - 2]
        const y = stack[n - 1]
        if (x !== undefined && y !== undefined) last()?.points.push(point(x, y))
        break
      }
      case "c": {
        const x = stack[n - 2]
        const y = stack[n - 1]
        if (x !== undefined && y !== undefined) last()?.points.push(point(x, y))
        break
      }
      case "re": {
        const x = stack[n - 4]
        const y = stack[n - 3]
        const w = stack[n - 2]
        const h = stack[n - 1]
        if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
          subpaths.push({ points: [point(x, y), point(x + w, y), point(x + w, y + h), point(x, y + h)], closed: true })
        }
        break
      }
      case "h": {
        const sp = last()
        if (sp) sp.closed = true
        break
      }
      case "n":
        subpaths = []
        break
      default:
        if (STROKE_OPS.has(token)) flush("stroke", CLOSING_OPS.has(token))
        else if (FILL_OPS.has(token)) flush("fill", false)
        else if (BOTH_OPS.has(token)) flush("both", CLOSING_OPS.has(token))
    }
    stack.length = 0
  }
  return paths
}

export function strokeSegments(paths: readonly PdfPath[]): Seg[] {
  const segs: Seg[] = []
  for (const p of paths) {
    if (p.paint !== "stroke" && p.paint !== "both") continue
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1]
      const b = p.points[i]
      if (a && b) segs.push({ a, b, widthMm: p.widthMm })
    }
    const first = p.points[0]
    const end = p.points[p.points.length - 1]
    if (p.closed && first && end && p.points.length > 2) segs.push({ a: end, b: first, widthMm: p.widthMm })
  }
  return segs
}

const TOL = 0.01

// Горизонтальный или вертикальный отрезок p→q покрыт штрихами заданной ширины (допускается разбиение на части).
export function covers(segs: readonly Seg[], p: Pt, q: Pt, widthMm: number, tol = TOL): boolean {
  const horizontal = Math.abs(p.y - q.y) < tol
  const vertical = Math.abs(p.x - q.x) < tol
  if (horizontal === vertical) throw new Error("covers: отрезок должен быть горизонтальным или вертикальным")
  const along = (pt: Pt): number => (horizontal ? pt.x : pt.y)
  const across = (pt: Pt): number => (horizontal ? pt.y : pt.x)
  const lo = Math.min(along(p), along(q))
  const hi = Math.max(along(p), along(q))
  const intervals = segs
    .filter((s) => Math.abs(s.widthMm - widthMm) < 0.005)
    .filter((s) => Math.abs(across(s.a) - across(p)) < tol && Math.abs(across(s.b) - across(p)) < tol)
    .map((s) => [Math.min(along(s.a), along(s.b)), Math.max(along(s.a), along(s.b))] as const)
    .sort((x, y) => x[0] - y[0])
  let reach = lo
  for (const [from, to] of intervals) {
    if (from > reach + tol) return false
    reach = Math.max(reach, to)
    if (reach >= hi - tol) return true
  }
  return reach >= hi - tol
}

export function rectEdgesDrawn(segs: readonly Seg[], r: Rect, widthMm: number): boolean {
  const tl = { x: r.x, y: r.y }
  const tr = { x: r.x + r.w, y: r.y }
  const br = { x: r.x + r.w, y: r.y + r.h }
  const bl = { x: r.x, y: r.y + r.h }
  return (
    covers(segs, tl, tr, widthMm) && covers(segs, tr, br, widthMm) && covers(segs, bl, br, widthMm) && covers(segs, tl, bl, widthMm)
  )
}

export function pathsBBox(paths: readonly PdfPath[]): Rect | null {
  const pts = paths.flatMap((p) => p.points)
  if (pts.length === 0) return null
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function insideRect(r: Rect, outer: Rect, tol = TOL): boolean {
  return r.x >= outer.x - tol && r.y >= outer.y - tol && r.x + r.w <= outer.x + outer.w + tol && r.y + r.h <= outer.y + outer.h + tol
}
