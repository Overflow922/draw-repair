import type { Material, Point, Wall } from "./types"

// Тестовые утилиты change room-area-labels: сцены, независимая геометрия проверки
// и записывающий фейковый CanvasRenderingContext2D. Не импортируют продакшн-модуль
// помещений, чтобы ожидания не выводились из реализации.

let seq = 0
export const W = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Material = "brick"): Wall => ({
  id: `r${++seq}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

// прямоугольник с совпадающими концами осей: (x0,y0)-(x1,y0)-(x1,y1)-(x0,y1)
export const rect = (x0: number, y0: number, x1: number, y1: number, t = 20): Wall[] => [
  W(x0, y0, x1, y0, t),
  W(x1, y0, x1, y1, t),
  W(x1, y1, x0, y1, t),
  W(x0, y1, x0, y0, t),
]

// R: внутренняя область [10,410]×[10,310] = 120 000 см²
export const sceneR = (): Wall[] => rect(0, 0, 420, 320)
// U: R без стены C
export const sceneU = (): Wall[] => [W(0, 0, 420, 0), W(420, 0, 420, 320), W(0, 320, 0, 0)]
// F: контур, замкнутый угловыми стыками на грани; внутренняя область [20,400]×[10,310] = 114 000
export const sceneF = (): Wall[] => [W(0, 0, 420, 0), W(410, 10, 410, 310), W(420, 320, 0, 320), W(10, 310, 10, 10)]
// R+P: комнаты 54 000 и 60 000
export const sceneRP = (): Wall[] => [...sceneR(), W(200, 0, 200, 320)]
// R+Pgap: разрыв 10 см, одно помещение 114 200
export const sceneRPgap = (): Wall[] => [...sceneR(), W(200, 0, 200, 300)]
// R+Pnarrow: разрыв 0,1 см, одно помещение 114 002
export const sceneRPnarrow = (): Wall[] => [...sceneR(), W(200, 0, 200, 309.9)]
// R3: 32 400, 36 000, коридор 40 000
export const sceneR3 = (): Wall[] => [...sceneR(), W(0, 200, 420, 200), W(200, 0, 200, 200)]
// Ropen: разрыв 50 см в наружной стене справа от перегородки; помещение 54 000
export const sceneRopen = (): Wall[] => [
  W(0, 0, 420, 0),
  W(420, 0, 420, 320),
  W(420, 320, 300, 320),
  W(250, 320, 0, 320),
  W(0, 320, 0, 0),
  W(200, 0, 200, 320),
]
// Risland: остров 100×20, помещение 118 000
export const sceneRisland = (): Wall[] => [...sceneR(), W(160, 160, 260, 160)]
// Rbox: внешнее помещение 755 900, внутри короба 36 100
export const sceneRbox = (): Wall[] => [...rect(0, 0, 1020, 820), ...rect(400, 300, 600, 500, 10)]
// L: внутренняя область — объединение [0,400]×[0,40] и [0,40]×[0,400], 30 400
export const sceneL = (): Wall[] => [
  W(-10, -10, 410, -10),
  W(410, -10, 410, 50),
  W(410, 50, 50, 50),
  W(50, 50, 50, 410),
  W(50, 410, -10, 410),
  W(-10, 410, -10, -10),
]
export const L_REGION: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 40 },
  { x: 40, y: 40 },
  { x: 40, y: 400 },
  { x: 0, y: 400 },
]
// Rslant: четырёхугольник с непрямыми углами (клинья)
export const RSLANT_AXES: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 300, y: 300 },
  { x: 0, y: 300 },
]
export const sceneRslant = (): Wall[] =>
  RSLANT_AXES.map((p, i) => {
    const q = RSLANT_AXES[(i + 1) % RSLANT_AXES.length]
    return W(p.x, p.y, q.x, q.y)
  })
// Rmixed: B — бетон 30 см, C — дерево; внутренняя область [10,405]×[10,310] = 118 500
export const sceneRmixed = (): Wall[] => [
  W(0, 0, 420, 0),
  W(420, 0, 420, 320, 30, "concrete"),
  W(420, 320, 0, 320, 20, "wood-long"),
  W(0, 320, 0, 0),
]
// Small(w,h): внутренняя область w×h
export const sceneSmall = (w: number, h: number): Wall[] => rect(0, 0, w + 20, h + 20)

export function transformWalls(walls: Wall[], deg: number, shift: Point): Wall[] {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const tr = (p: Point): Point => ({ x: p.x * c - p.y * s + shift.x, y: p.x * s + p.y * c + shift.y })
  return walls.map((w) => ({ ...w, a: tr(w.a), b: tr(w.b) }))
}

export function shiftWalls(walls: Wall[], shift: Point): Wall[] {
  return transformWalls(walls, 0, shift)
}

// перестановки массива: прямой, обратный, циклические сдвиги
export function orders<T>(items: T[]): T[][] {
  const out: T[][] = [items, [...items].reverse()]
  for (let k = 1; k < items.length; k++) out.push([...items.slice(k), ...items.slice(0, k)])
  return out
}

export function signedArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

export const area = (poly: Point[]): number => Math.abs(signedArea(poly))

export function insidePolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function distancePointSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

export function distToBoundary(p: Point, poly: Point[]): number {
  let d = Infinity
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distancePointSegment(p, poly[i], poly[(i + 1) % poly.length]))
  return d
}

// внутренняя область выпуклого контура осей: каждое ребро смещено внутрь на d,
// вершины — пересечения соседних смещённых прямых
export function insetConvex(axes: Point[], d: number): Point[] {
  const orient = Math.sign(signedArea(axes))
  const lines = axes.map((p, i) => {
    const q = axes[(i + 1) % axes.length]
    const len = Math.hypot(q.x - p.x, q.y - p.y)
    const u = { x: (q.x - p.x) / len, y: (q.y - p.y) / len }
    // внутренняя нормаль: для обхода против часовой (orient > 0) — левая
    const n = { x: -u.y * orient, y: u.x * orient }
    return { o: { x: p.x + n.x * d, y: p.y + n.y * d }, u }
  })
  return lines.map((l1, i) => {
    const l0 = lines[(i + lines.length - 1) % lines.length]
    const den = l0.u.x * l1.u.y - l0.u.y * l1.u.x
    const t = ((l1.o.x - l0.o.x) * l1.u.y - (l1.o.y - l0.o.y) * l1.u.x) / den
    return { x: l0.o.x + l0.u.x * t, y: l0.o.y + l0.u.y * t }
  })
}

// ---------- записывающий контекст канваса ----------

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

const mulM = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

const applyM = (m: Matrix, x: number, y: number): Point => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] })

export type DrawOp =
  | { kind: "fill"; index: number; fillStyle: string; rule: string; subpaths: Point[][]; hasArc: boolean }
  | { kind: "stroke"; index: number; strokeStyle: string; subpaths: Point[][] }
  | { kind: "fillRect"; index: number; fillStyle: string }
  | { kind: "fillText"; index: number; text: string; at: Point; font: string; textAlign: string; textBaseline: string; fillStyle: string }

interface CtxState {
  m: Matrix
  fillStyle: string
  strokeStyle: string
  font: string
  textAlign: string
  textBaseline: string
  lineWidth: number
  globalAlpha: number
  lineCap: string
  lineJoin: string
}

export interface Recorder {
  ctx: CanvasRenderingContext2D
  ops: DrawOp[]
}

// Фейк записывает операции рисования в координатах устройства (с учётом save/restore,
// scale, translate, rotate, setTransform). Возвращается как CanvasRenderingContext2D —
// так же, как PDF-экспорт передаёт контекст jsPDF.
export function recordingContext(): Recorder {
  const ops: DrawOp[] = []
  let state: CtxState = {
    m: IDENTITY,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
  }
  const stack: CtxState[] = []
  let subpaths: Point[][] = []
  let hasArc = false
  const current = (): Point[] => {
    if (!subpaths.length) subpaths.push([])
    return subpaths[subpaths.length - 1]
  }
  const fake = {
    get fillStyle(): string {
      return state.fillStyle
    },
    set fillStyle(v: string) {
      state.fillStyle = v
    },
    get strokeStyle(): string {
      return state.strokeStyle
    },
    set strokeStyle(v: string) {
      state.strokeStyle = v
    },
    get font(): string {
      return state.font
    },
    set font(v: string) {
      state.font = v
    },
    get textAlign(): string {
      return state.textAlign
    },
    set textAlign(v: string) {
      state.textAlign = v
    },
    get textBaseline(): string {
      return state.textBaseline
    },
    set textBaseline(v: string) {
      state.textBaseline = v
    },
    get lineWidth(): number {
      return state.lineWidth
    },
    set lineWidth(v: number) {
      state.lineWidth = v
    },
    get globalAlpha(): number {
      return state.globalAlpha
    },
    set globalAlpha(v: number) {
      state.globalAlpha = v
    },
    get lineCap(): string {
      return state.lineCap
    },
    set lineCap(v: string) {
      state.lineCap = v
    },
    get lineJoin(): string {
      return state.lineJoin
    },
    set lineJoin(v: string) {
      state.lineJoin = v
    },
    save(): void {
      stack.push({ ...state })
    },
    restore(): void {
      const s = stack.pop()
      if (s) state = s
    },
    scale(x: number, y: number): void {
      state.m = mulM(state.m, [x, 0, 0, y, 0, 0])
    },
    translate(x: number, y: number): void {
      state.m = mulM(state.m, [1, 0, 0, 1, x, y])
    },
    rotate(a: number): void {
      state.m = mulM(state.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
      state.m = [a, b, c, d, e, f]
    },
    beginPath(): void {
      subpaths = []
      hasArc = false
    },
    moveTo(x: number, y: number): void {
      subpaths.push([applyM(state.m, x, y)])
    },
    lineTo(x: number, y: number): void {
      current().push(applyM(state.m, x, y))
    },
    closePath(): void {},
    rect(x: number, y: number, w: number, h: number): void {
      subpaths.push([applyM(state.m, x, y), applyM(state.m, x + w, y), applyM(state.m, x + w, y + h), applyM(state.m, x, y + h)])
    },
    arc(): void {
      hasArc = true
    },
    fill(rule?: string): void {
      ops.push({
        kind: "fill",
        index: ops.length,
        fillStyle: state.fillStyle,
        rule: rule ?? "nonzero",
        subpaths: subpaths.map((sp) => [...sp]),
        hasArc,
      })
    },
    stroke(): void {
      ops.push({ kind: "stroke", index: ops.length, strokeStyle: state.strokeStyle, subpaths: subpaths.map((sp) => [...sp]) })
    },
    clip(): void {},
    fillRect(): void {
      ops.push({ kind: "fillRect", index: ops.length, fillStyle: state.fillStyle })
    },
    strokeRect(): void {},
    clearRect(): void {},
    setLineDash(): void {},
    fillText(text: string, x: number, y: number): void {
      ops.push({
        kind: "fillText",
        index: ops.length,
        text,
        at: applyM(state.m, x, y),
        font: state.font,
        textAlign: state.textAlign,
        textBaseline: state.textBaseline,
        fillStyle: state.fillStyle,
      })
    },
    strokeText(): void {},
    measureText(text: string): { width: number } {
      return { width: text.length * 7 }
    },
  }
  return { ctx: fake as unknown as CanvasRenderingContext2D, ops }
}

const WHITE = new Set(["#fff", "#ffffff", "white", "rgb(255, 255, 255)", "rgb(255,255,255)", "rgba(255, 255, 255, 1)"])
export const isWhite = (style: string): boolean => WHITE.has(style.trim().toLowerCase())

export const AREA_LABEL = / м²$/

export type FillOp = Extract<DrawOp, { kind: "fill" }>
export type TextOp = Extract<DrawOp, { kind: "fillText" }>
export type StrokeOp = Extract<DrawOp, { kind: "stroke" }>

// заливки помещений: белые заливки многоугольных путей (маркеры стены — дуги)
export const roomFills = (ops: DrawOp[]): FillOp[] =>
  ops.filter((o): o is FillOp => o.kind === "fill" && isWhite(o.fillStyle) && !o.hasArc)

export const areaLabels = (ops: DrawOp[]): TextOp[] =>
  ops.filter((o): o is TextOp => o.kind === "fillText" && AREA_LABEL.test(o.text))

export const otherTexts = (ops: DrawOp[]): TextOp[] =>
  ops.filter((o): o is TextOp => o.kind === "fillText" && !AREA_LABEL.test(o.text))

export const strokesOf = (ops: DrawOp[], style: string): StrokeOp[] =>
  ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === style)
