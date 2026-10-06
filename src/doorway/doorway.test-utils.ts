import { expect } from "vitest"
import type { Doorway, Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"

// change add-doorway: сцены, независимые эталоны и записывающий контекст канваса для тестов
// проёмов (test-plan.md «Сцены»). Эталоны выводятся из спецификации и геометрии сцен,
// а не из продакшн-модулей проёмов.

export const w = (ax: number, ay: number, bx: number, by: number, id: string, thicknessCm = 20): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

export const door = (wallId: string, anchor: "a" | "b", offsetCm: number, widthCm = 90, heightCm = 210, id = "d0"): Doorway => ({
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm,
})

export interface SceneR {
  walls: Wall[]
  W: Wall
  R: Wall
  B: Wall
  L: Wall
}

// F — свободная стена W (0,0)-(500,0) t20
export const sceneF = (): { walls: Wall[]; W: Wall } => {
  const W = w(0, 0, 500, 0, "W")
  return { walls: [W], W }
}

// R — комната 500×400 по осям, углы с общими вершинами; помещение со стороны y > 0 у W
export const sceneR = (): SceneR => {
  const W = w(0, 0, 500, 0, "W")
  const R = w(500, 0, 500, 400, "R")
  const B = w(500, 400, 0, 400, "B")
  const L = w(0, 400, 0, 0, "L")
  return { walls: [W, R, B, L], W, R, B, L }
}

// RP — R + перегородка P (300,10)-(300,390) t10, торцы на внутренних гранях W и B
export const sceneRP = (): SceneR & { P: Wall } => {
  const r = sceneR()
  const P = w(300, 10, 300, 390, "P", 10)
  return { ...r, walls: [...r.walls, P], P }
}

// RT — R + перегородка Q (250,10)-(250,390) t10: две комнаты
export const sceneRT = (): SceneR & { Q: Wall } => {
  const r = sceneR()
  const Q = w(250, 10, 250, 390, "Q", 10)
  return { ...r, walls: [...r.walls, Q], Q }
}

// D0 — проём на W: привязка a, 100 см, ширина 90, высота 210
export const D0 = (): Doorway => door("W", "a", 100)
// UO — проём на W вплотную к углу с L (внутреннее расстояние 0)
export const UO = (): Doorway => door("W", "a", 10)

// мировая точка оси стены на расстоянии t от конца a
export function axisPoint(wall: Wall, t: number): Point {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  return { x: wall.a.x + ((wall.b.x - wall.a.x) / len) * t, y: wall.a.y + ((wall.b.y - wall.a.y) / len) * t }
}

// независимый эталон откосов по модели (spec doorway «Проём и опорная стена»)
export function expectedJambsT(d: Doorway, wall: Wall): [number, number] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  return d.anchor === "a" ? [d.offsetCm, d.offsetCm + d.widthCm] : [len - d.offsetCm - d.widthCm, len - d.offsetCm]
}

export function expectPoint(p: Point, x: number, y: number, digits = 3): void {
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

export const near = (v: number, expected: number, tol: number): boolean => Math.abs(v - expected) <= tol

// ---------- экран ----------

export const VIEW: View = { zoom: 1, pan: { x: -100, y: -100 } }

export const toScreen = (p: Point, view: View = VIEW): Point => {
  const k = PX_PER_CM * view.zoom
  return { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
}

// ---------- записывающий контекст с clip и толщиной линии ----------

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

export type Op =
  | { kind: "fill"; fillStyle: string; subpaths: Point[][]; hasArc: boolean }
  | { kind: "stroke"; strokeStyle: string; lineWidth: number; subpaths: Point[][] }
  | { kind: "clip"; subpaths: Point[][] }
  | { kind: "text"; text: string; at: Point; font: string }

interface State {
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

export function recorder(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = []
  let s: State = {
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
  const stack: State[] = []
  let paths: Point[][] = []
  let arc = false
  const cur = (): Point[] => {
    if (!paths.length) paths.push([])
    return paths[paths.length - 1]
  }
  const fake = {
    get fillStyle(): string {
      return s.fillStyle
    },
    set fillStyle(v: string) {
      s.fillStyle = v
    },
    get strokeStyle(): string {
      return s.strokeStyle
    },
    set strokeStyle(v: string) {
      s.strokeStyle = v
    },
    get font(): string {
      return s.font
    },
    set font(v: string) {
      s.font = v
    },
    get textAlign(): string {
      return s.textAlign
    },
    set textAlign(v: string) {
      s.textAlign = v
    },
    get textBaseline(): string {
      return s.textBaseline
    },
    set textBaseline(v: string) {
      s.textBaseline = v
    },
    get lineWidth(): number {
      return s.lineWidth
    },
    set lineWidth(v: number) {
      s.lineWidth = v
    },
    get globalAlpha(): number {
      return s.globalAlpha
    },
    set globalAlpha(v: number) {
      s.globalAlpha = v
    },
    get lineCap(): string {
      return s.lineCap
    },
    set lineCap(v: string) {
      s.lineCap = v
    },
    get lineJoin(): string {
      return s.lineJoin
    },
    set lineJoin(v: string) {
      s.lineJoin = v
    },
    save(): void {
      stack.push({ ...s })
    },
    restore(): void {
      const p = stack.pop()
      if (p) s = p
    },
    scale(x: number, y: number): void {
      s.m = mulM(s.m, [x, 0, 0, y, 0, 0])
    },
    translate(x: number, y: number): void {
      s.m = mulM(s.m, [1, 0, 0, 1, x, y])
    },
    rotate(a: number): void {
      s.m = mulM(s.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
      s.m = [a, b, c, d, e, f]
    },
    beginPath(): void {
      paths = []
      arc = false
    },
    moveTo(x: number, y: number): void {
      paths.push([applyM(s.m, x, y)])
    },
    lineTo(x: number, y: number): void {
      cur().push(applyM(s.m, x, y))
    },
    closePath(): void {},
    rect(x: number, y: number, rw: number, rh: number): void {
      paths.push([applyM(s.m, x, y), applyM(s.m, x + rw, y), applyM(s.m, x + rw, y + rh), applyM(s.m, x, y + rh)])
    },
    arc(): void {
      arc = true
    },
    fill(): void {
      ops.push({ kind: "fill", fillStyle: s.fillStyle, subpaths: paths.map((p) => [...p]), hasArc: arc })
    },
    stroke(): void {
      ops.push({ kind: "stroke", strokeStyle: s.strokeStyle, lineWidth: s.lineWidth, subpaths: paths.map((p) => [...p]) })
    },
    clip(): void {
      ops.push({ kind: "clip", subpaths: paths.map((p) => [...p]) })
    },
    fillRect(): void {},
    strokeRect(): void {},
    clearRect(): void {},
    setLineDash(): void {},
    fillText(text: string, x: number, y: number): void {
      ops.push({ kind: "text", text, at: applyM(s.m, x, y), font: s.font })
    },
    strokeText(): void {},
    measureText(text: string): { width: number } {
      return { width: text.length * 7 }
    },
  }
  return { ctx: fake as unknown as CanvasRenderingContext2D, ops }
}

export type StrokeOp = Extract<Op, { kind: "stroke" }>
export type TextOp = Extract<Op, { kind: "text" }>
export type ClipOp = Extract<Op, { kind: "clip" }>

export const strokes = (ops: Op[]): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke")
export const texts = (ops: Op[]): TextOp[] => ops.filter((o): o is TextOp => o.kind === "text")
export const clips = (ops: Op[]): ClipOp[] => ops.filter((o): o is ClipOp => o.kind === "clip")

// отрезки пути: последовательные пары вершин каждого подпути
export function segments(op: StrokeOp): [Point, Point][] {
  const out: [Point, Point][] = []
  for (const sp of op.subpaths) for (let i = 1; i < sp.length; i++) out.push([sp[i - 1], sp[i]])
  return out
}

const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y)

// отрезок совпадает с [p, q] в любом направлении
export const sameSegment = (s: [Point, Point], p: Point, q: Point, tol: number): boolean =>
  (dist(s[0], p) <= tol && dist(s[1], q) <= tol) || (dist(s[0], q) <= tol && dist(s[1], p) <= tol)

// точка лежит на отрезке (внутри, с допуском)
export function onSegment(p: Point, s: [Point, Point], tol: number): boolean {
  const [a, b] = s
  const len = dist(a, b)
  if (len < 1e-9) return dist(p, a) <= tol
  const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)
  if (t < -1e-9 || t > 1 + 1e-9) return false
  const foot = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  return dist(p, foot) <= tol
}

export function insidePolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

// точка внутри хотя бы одного пути отсечения (штриховки стен)
export const clippedIn = (ops: Op[], p: Point): boolean => clips(ops).some((c) => c.subpaths.some((sp) => insidePolygon(p, sp)))

export const AREA_LABEL = / м²$/
export const H_LABEL = /^H=/

// числа размеров: тексты без подписи площади и подписи высоты
export const numberTexts = (ops: Op[]): TextOp[] => texts(ops).filter((t) => !AREA_LABEL.test(t.text) && !H_LABEL.test(t.text))
export const heightTexts = (ops: Op[]): TextOp[] => texts(ops).filter((t) => H_LABEL.test(t.text))

export const sorted = (xs: string[]): string[] => [...xs].sort()
