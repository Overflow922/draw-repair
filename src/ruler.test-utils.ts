import { expect } from "vitest"
import type { Point, Wall } from "./types"
import { W, rect, sceneR, shiftWalls } from "./room-area.test-utils"

// Тестовые утилиты change ruler-tool: сцены линейки, независимая геометрия проверки
// и записывающий контекст канваса, фиксирующий параметры дуг. Не импортируют модуль
// линейки, чтобы ожидания не выводились из реализации.

// ---------- геометрия проверки ----------

export const DEG = Math.PI / 180

// поворот вектора на deg градусов в мировых координатах (x вправо, y вниз)
export function rot(v: Point, deg: number): Point {
  const r = deg * DEG
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) }
}

export function unitTo(from: Point, to: Point): Point {
  const l = Math.hypot(to.x - from.x, to.y - from.y)
  return { x: (to.x - from.x) / l, y: (to.y - from.y) / l }
}

export const near = (p: Point, q: Point, tol: number): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= tol

export function expectPointNear(actual: Point, expected: Point, tol: number): void {
  expect(Math.hypot(actual.x - expected.x, actual.y - expected.y), `${JSON.stringify(actual)} ≈ ${JSON.stringify(expected)}`).toBeLessThanOrEqual(tol)
}

// внутренний угол выпуклой или невыпуклой вершины многоугольника со стороны его внутренности, градусы
export function interiorAngles(poly: Point[]): number[] {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  const orient = Math.sign(s)
  return poly.map((v, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length]
    const next = poly[(i + 1) % poly.length]
    const e1 = { x: v.x - prev.x, y: v.y - prev.y }
    const e2 = { x: next.x - v.x, y: next.y - v.y }
    const turn = Math.atan2(e1.x * e2.y - e1.y * e2.x, e1.x * e2.x + e1.y * e2.y) / DEG
    return 180 - orient * turn
  })
}

// пересечение прямых p1 + t·d1 и p2 + s·d2
export function intersectLines(p1: Point, d1: Point, p2: Point, d2: Point): Point {
  const den = d1.x * d2.y - d1.y * d2.x
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t }
}

// внутренний контур многоугольника осей (обход любой): каждая ось смещена внутрь на d
export function insetPolygon(axes: Point[], d: number): Point[] {
  let s = 0
  for (let i = 0; i < axes.length; i++) {
    const a = axes[i]
    const b = axes[(i + 1) % axes.length]
    s += a.x * b.y - b.x * a.y
  }
  const orient = Math.sign(s)
  const lines = axes.map((p, i) => {
    const u = unitTo(p, axes[(i + 1) % axes.length])
    const n = { x: -u.y * orient, y: u.x * orient }
    return { o: { x: p.x + n.x * d, y: p.y + n.y * d }, u }
  })
  return lines.map((l1, i) => {
    const l0 = lines[(i + lines.length - 1) % lines.length]
    return intersectLines(l0.o, l0.u, l1.o, l1.u)
  })
}

// ---------- сцены ----------

const closed = (axes: Point[]): Wall[] => axes.map((p, i) => W(p.x, p.y, axes[(i + 1) % axes.length].x, axes[(i + 1) % axes.length].y))

// Q: углы осей 90, 67,5 (правый верх), 112,5 (правый низ), 90
export const Q_C = 400 - 300 * Math.tan(22.5 * DEG)
export const Q_AXES: Point[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: Q_C, y: 300 },
  { x: 0, y: 300 },
]
export const sceneQ = (): Wall[] => closed(Q_AXES)

// Rseam: R, верхняя стена разбита на две коллинеарные
export const sceneRseam = (): Wall[] => [W(0, 0, 200, 0), W(200, 0, 420, 0), W(420, 0, 420, 320), W(420, 320, 0, 320), W(0, 320, 0, 0)]

// Rbend(θ): R, нижняя стена заменена двумя с изломом в (210, 320 + h); внутренний угол
// помещения у излома равен θ (θ > 180 — излом внутрь помещения, вверх)
export const bendH = (thetaDeg: number): number => 210 * Math.tan(((180 - thetaDeg) / 2) * DEG)
export const BEND_AXES = (thetaDeg: number): Point[] => [
  { x: 0, y: 0 },
  { x: 420, y: 0 },
  { x: 420, y: 320 },
  { x: 210, y: 320 + bendH(thetaDeg) },
  { x: 0, y: 320 },
]
export const sceneRbend = (thetaDeg: number): Wall[] => closed(BEND_AXES(thetaDeg))

// Twin: два здания R с промежутком; внешние грани x = 430 и x = 990
export const sceneTwin = (): Wall[] => [...sceneR(), ...shiftWalls(sceneR(), { x: 1000, y: 0 })]

// Col: две стены встык на одной прямой, граница форм — x = 200
export const sceneCol = (): Wall[] => [W(0, 0, 200, 0), W(200, 0, 500, 0)]

// Tee: P примкнута торцом к оси A
export const sceneTee = (): Wall[] => [W(0, 0, 400, 0), W(200, 0, 200, 300)]

export const sceneThin = (): Wall[] => rect(0, 0, 420, 320, 1)

// Step: R, у которой правая стена ниже y = 150 сдвинута наружу на 3 см — реальная ступенька
// внутреннего контура длиной 3 см (входящий угол 270° и угол 90°)
export const STEP_AXES: Point[] = [
  { x: 0, y: 0 },
  { x: 420, y: 0 },
  { x: 420, y: 150 },
  { x: 423, y: 150 },
  { x: 423, y: 320 },
  { x: 0, y: 320 },
]
export const sceneStep = (): Wall[] => closed(STEP_AXES)

// StepThin: R, у которой верхняя стена разбита на две на одной оси: 20 см слева и 19 см справа
// от x = 200 — ступенька внутренней грани 0,5 см: 270° в (200; 10) и 90° в (200; 9,5)
export const sceneStepThin = (): Wall[] => [W(0, 0, 200, 0, 20), W(200, 0, 420, 0, 19), W(420, 0, 420, 320), W(420, 320, 0, 320), W(0, 320, 0, 0)]

// Stub(y): R и перегородка от верхней стены вниз до y со свободным концом;
// торец свободного конца — (190, y)–(210, y)
export const sceneStub = (y: number): Wall[] => [...sceneR(), W(200, 0, 200, y)]

// Slant: R и косая перегородка от верхней стены со свободным концом у (300, 150)
export const SLANT_END: Point = { x: 300, y: 150 }
export const sceneSlant = (): Wall[] => [...sceneR(), W(200, 0, SLANT_END.x, SLANT_END.y)]

// Ledge: выступ из состыкованных стен в комнату R: (150,0)→(150,100)→(250,100)→(250,0);
// все концы состыкованы, входящие углы выступа — настоящие углы помещения
export const sceneLedge = (): Wall[] => [...sceneR(), W(150, 0, 150, 100), W(150, 100, 250, 100), W(250, 100, 250, 0)]

// Needle: прямоугольный треугольник с острым углом 5° у (2000, 0)
export const NEEDLE_AXES: Point[] = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 0, y: 2000 * Math.tan(5 * DEG) },
]
export const sceneNeedle = (): Wall[] => closed(NEEDLE_AXES)

// Sharp: прямоугольный треугольник с острым углом 20° у (600, 0)
export const SHARP_AXES: Point[] = [
  { x: 0, y: 0 },
  { x: 600, y: 0 },
  { x: 0, y: 600 * Math.tan(20 * DEG) },
]
export const sceneSharp = (): Wall[] => closed(SHARP_AXES)

// ---------- записывающий контекст ----------

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

// дуга в координатах устройства: сектор от start (рад) на signed sweep (рад);
// положительный sweep — рост угла atan2 (по часовой на экране с y вниз)
export interface ArcRec {
  center: Point
  r: number
  start: number
  sweep: number
}

export type Op =
  | { kind: "stroke"; style: string; widthPx: number; subpaths: Point[][]; arcs: ArcRec[] }
  | { kind: "fill"; style: string; subpaths: Point[][]; arcs: ArcRec[] }
  | { kind: "text"; text: string; at: Point; fontPx: number; style: string }
  | { kind: "textStroke"; text: string; at: Point; style: string; widthPx: number }
  | { kind: "rect"; style: string; fill: boolean }

interface State {
  m: Matrix
  fillStyle: string
  strokeStyle: string
  font: string
  lineWidth: number
}

const TAU = 2 * Math.PI
const mod = (x: number, m: number): number => ((x % m) + m) % m

// сектор canvas arc(start, end, anticlockwise) как знаковый поворот
function canvasSweep(start: number, end: number, ccw: boolean): number {
  const d = end - start
  if (!ccw) return d >= TAU ? TAU : mod(d, TAU)
  return d <= -TAU ? -TAU : -mod(-d, TAU)
}

const fontPx = (font: string): number => {
  const m = /(\d+(?:\.\d+)?)px/.exec(font)
  return m ? Number(m[1]) : NaN
}

export function arcRecorder(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = []
  let st: State = { m: IDENTITY, fillStyle: "#000000", strokeStyle: "#000000", font: "10px sans-serif", lineWidth: 1 }
  const stack: State[] = []
  let subpaths: Point[][] = []
  let arcs: ArcRec[] = []
  const scaleOf = (m: Matrix): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))
  const fake = {
    get fillStyle(): string {
      return st.fillStyle
    },
    set fillStyle(v: string) {
      st.fillStyle = v
    },
    get strokeStyle(): string {
      return st.strokeStyle
    },
    set strokeStyle(v: string) {
      st.strokeStyle = v
    },
    get font(): string {
      return st.font
    },
    set font(v: string) {
      st.font = v
    },
    get lineWidth(): number {
      return st.lineWidth
    },
    set lineWidth(v: number) {
      st.lineWidth = v
    },
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    save(): void {
      stack.push({ ...st })
    },
    restore(): void {
      const s = stack.pop()
      if (s) st = s
    },
    scale(x: number, y: number): void {
      st.m = mulM(st.m, [x, 0, 0, y, 0, 0])
    },
    translate(x: number, y: number): void {
      st.m = mulM(st.m, [1, 0, 0, 1, x, y])
    },
    rotate(a: number): void {
      st.m = mulM(st.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
      st.m = [a, b, c, d, e, f]
    },
    beginPath(): void {
      subpaths = []
      arcs = []
    },
    moveTo(x: number, y: number): void {
      subpaths.push([applyM(st.m, x, y)])
    },
    lineTo(x: number, y: number): void {
      if (!subpaths.length) subpaths.push([])
      subpaths[subpaths.length - 1].push(applyM(st.m, x, y))
    },
    closePath(): void {},
    rect(x: number, y: number, w: number, h: number): void {
      subpaths.push([applyM(st.m, x, y), applyM(st.m, x + w, y), applyM(st.m, x + w, y + h), applyM(st.m, x, y + h)])
    },
    arc(x: number, y: number, r: number, start: number, end: number, ccw = false): void {
      const rotM = Math.atan2(st.m[1], st.m[0])
      const flip = st.m[0] * st.m[3] - st.m[1] * st.m[2] < 0
      const sweep = canvasSweep(start, end, ccw)
      arcs.push({ center: applyM(st.m, x, y), r: r * scaleOf(st.m), start: start + rotM, sweep: flip ? -sweep : sweep })
    },
    fill(): void {
      ops.push({ kind: "fill", style: st.fillStyle, subpaths: subpaths.map((s) => [...s]), arcs: [...arcs] })
    },
    stroke(): void {
      ops.push({ kind: "stroke", style: st.strokeStyle, widthPx: st.lineWidth * scaleOf(st.m), subpaths: subpaths.map((s) => [...s]), arcs: [...arcs] })
    },
    clip(): void {},
    fillRect(): void {
      ops.push({ kind: "rect", style: st.fillStyle, fill: true })
    },
    strokeRect(): void {
      ops.push({ kind: "rect", style: st.strokeStyle, fill: false })
    },
    clearRect(): void {},
    setLineDash(): void {},
    getLineDash(): number[] {
      return []
    },
    fillText(text: string, x: number, y: number): void {
      ops.push({ kind: "text", text, at: applyM(st.m, x, y), fontPx: fontPx(st.font) * scaleOf(st.m), style: st.fillStyle })
    },
    strokeText(text: string, x: number, y: number): void {
      ops.push({ kind: "textStroke", text, at: applyM(st.m, x, y), style: st.strokeStyle, widthPx: st.lineWidth * scaleOf(st.m) })
    },
    measureText(text: string): { width: number } {
      return { width: text.length * 7 }
    },
  }
  return { ctx: fake as unknown as CanvasRenderingContext2D, ops }
}

const r3 = (v: number): string => (Math.round(v * 1000) / 1000 + 0).toFixed(3)
const pts = (ps: Point[]): string => ps.map((p) => `${r3(p.x)},${r3(p.y)}`).join(" ")

export function opKey(op: Op): string {
  switch (op.kind) {
    case "stroke":
    case "fill":
      return `${op.kind}|${op.style}|${op.subpaths.map(pts).join(";")}|${op.arcs.map((a) => `${pts([a.center])} ${r3(a.r)} ${r3(a.start)} ${r3(a.sweep)}`).join(";")}`
    case "text":
      return `text|${op.text}|${pts([op.at])}|${op.style}`
    case "textStroke":
      return `textStroke|${op.text}|${pts([op.at])}|${op.style}|${r3(op.widthPx)}`
    case "rect":
      return `rect|${op.style}|${op.fill}`
  }
}

// операции, добавленные к базовому рисованию: общий префикс и общий суффикс отброшены
export function extraOps(base: Op[], withRuler: Op[]): { extra: Op[]; prefix: number; suffix: number } {
  const bk = base.map(opKey)
  const wk = withRuler.map(opKey)
  let prefix = 0
  while (prefix < bk.length && prefix < wk.length && bk[prefix] === wk[prefix]) prefix++
  let suffix = 0
  while (suffix < bk.length - prefix && suffix < wk.length - prefix && bk[bk.length - 1 - suffix] === wk[wk.length - 1 - suffix]) suffix++
  return { extra: withRuler.slice(prefix, withRuler.length - suffix), prefix, suffix }
}

// сектор как множество: нормализация к неотрицательному повороту
export function normSector(start: number, sweep: number): { start: number; sweep: number } {
  return sweep >= 0 ? { start: mod(start, TAU), sweep } : { start: mod(start + sweep, TAU), sweep: -sweep }
}

export function angleDiff(a: number, b: number): number {
  const d = mod(a - b, TAU)
  return Math.min(d, TAU - d)
}
