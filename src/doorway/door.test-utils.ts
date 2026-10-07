import type { Point, WallDoor } from "../types"
import { recorder } from "./doorway.test-utils"
import type { Op } from "./doorway.test-utils"

// change add-door: сцены, эталоны и записывающий контекст с дугами для тестов дверей
// (test-plan.md «Сцены»). Эталоны выводятся из спецификации (door «Отображение двери»), а не из продакшн-модулей.

export type Hinge = "a" | "b"
export type Swing = "left" | "right"

export const dr = (
  wallId: string,
  anchor: "a" | "b",
  offsetCm: number,
  hinge: Hinge = "a",
  swing: Swing = "left",
  widthCm = 90,
  heightCm = 210,
  id = "dr0",
): WallDoor => ({ kind: "door", id, wallId, anchor, offsetCm, widthCm, heightCm, hinge, swing })

// DR(h, s) — дверь на W: привязка a, 100, ширина 90 (участок x 100…190)
export const DR = (hinge: Hinge = "a", swing: Swing = "left"): WallDoor => dr("W", "a", 100, hinge, swing)

export const COS95 = Math.cos((95 * Math.PI) / 180)
export const SIN95 = Math.sin((95 * Math.PI) / 180)

// эталон обозначения по спецификации для стены с осью a → b, участком [t1, t2] по оси, толщиной t
export interface ExpectedLeaf {
  hinge: Point
  arcFrom: Point
  arcTo: Point
  n: Point // нормаль стороны открывания
  u: Point // от откоса петель ко второму откосу
}

export function expectedLeaf(a: Point, b: Point, t1: number, t2: number, thickness: number, hinge: Hinge, swing: Swing, width: number): ExpectedLeaf {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
  const left = { x: d.y, y: -d.x }
  const n = swing === "left" ? left : { x: -left.x, y: -left.y }
  const tHinge = hinge === "a" ? t1 : t2
  const u = hinge === "a" ? d : { x: -d.x, y: -d.y }
  const axis = { x: a.x + d.x * tHinge, y: a.y + d.y * tHinge }
  const h = { x: axis.x + (n.x * thickness) / 2, y: axis.y + (n.y * thickness) / 2 }
  const v = { x: u.x * COS95 + n.x * SIN95, y: u.y * COS95 + n.y * SIN95 }
  return {
    hinge: h,
    arcFrom: { x: h.x + u.x * width, y: h.y + u.y * width },
    arcTo: { x: h.x + v.x * width, y: h.y + v.y * width },
    n,
    u,
  }
}

// точка на дуге открывания под углом deg от закрытого положения в сторону n
export function arcPointAt(e: ExpectedLeaf, width: number, deg: number): Point {
  const r = (deg * Math.PI) / 180
  return {
    x: e.hinge.x + (e.u.x * Math.cos(r) + e.n.x * Math.sin(r)) * width,
    y: e.hinge.y + (e.u.y * Math.cos(r) + e.n.y * Math.sin(r)) * width,
  }
}

// --- записывающий контекст с дугами: центр, радиус и углы дуги в координатах устройства ---

export interface ArcCall {
  center: Point
  radius: number
  start: number
  end: number
  ccw: boolean
  strokeStyle: string
  lineWidth: number
  stroked: boolean // после дуги был stroke()
}

type M = [number, number, number, number, number, number] // a b c d e f
const ID: M = [1, 0, 0, 1, 0, 0]
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m: M, x: number, y: number): Point => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] })

// оборачивает recorder(): все вызовы уходят в него, а arc/ellipse дополнительно фиксируются с текущей матрицей
export function arcRecorder(): { ctx: CanvasRenderingContext2D; ops: Op[]; arcs: ArcCall[] } {
  const { ctx, ops } = recorder()
  const arcs: ArcCall[] = []
  let m: M = [...ID]
  const stack: M[] = []
  let pending: ArcCall[] = []
  const target = ctx as unknown as Record<string | symbol, unknown>
  const call = (prop: string, args: unknown[]): unknown => {
    const fn = target[prop]
    return typeof fn === "function" ? (fn as (...a: unknown[]) => unknown).apply(ctx, args) : undefined
  }
  const pushArc = (cx: number, cy: number, rx: number, ry: number, rot: number, start: number, end: number, ccw: boolean): void => {
    const det = m[0] * m[3] - m[1] * m[2]
    const scale = Math.sqrt(Math.abs(det))
    const angle = Math.atan2(m[1], m[0]) + rot
    const mirrored = det < 0
    const arc: ArcCall = {
      center: apply(m, cx, cy),
      radius: ((rx + ry) / 2) * scale,
      start: mirrored ? -start - angle : start + angle,
      end: mirrored ? -end - angle : end + angle,
      ccw: mirrored ? !ccw : ccw,
      strokeStyle: String(target.strokeStyle),
      lineWidth: Number(target.lineWidth),
      stroked: false,
    }
    arcs.push(arc)
    pending.push(arc)
  }
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(t, prop) {
      if (prop === "save")
        return (): void => {
          stack.push([...m])
          call("save", [])
        }
      if (prop === "restore")
        return (): void => {
          m = stack.pop() ?? [...ID]
          call("restore", [])
        }
      if (prop === "translate")
        return (x: number, y: number): void => {
          m = mul(m, [1, 0, 0, 1, x, y])
          call("translate", [x, y])
        }
      if (prop === "scale")
        return (x: number, y: number): void => {
          m = mul(m, [x, 0, 0, y, 0, 0])
          call("scale", [x, y])
        }
      if (prop === "rotate")
        return (r: number): void => {
          m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0])
          call("rotate", [r])
        }
      if (prop === "transform")
        return (a: number, b: number, c: number, d: number, e: number, f: number): void => {
          m = mul(m, [a, b, c, d, e, f])
          call("transform", [a, b, c, d, e, f])
        }
      if (prop === "setTransform")
        return (a: number, b: number, c: number, d: number, e: number, f: number): void => {
          m = [a, b, c, d, e, f]
          call("setTransform", [a, b, c, d, e, f])
        }
      if (prop === "resetTransform")
        return (): void => {
          m = [...ID]
          call("resetTransform", [])
        }
      if (prop === "beginPath")
        return (): void => {
          pending = []
          call("beginPath", [])
        }
      if (prop === "stroke")
        return (...args: unknown[]): void => {
          for (const a of pending) {
            a.stroked = true
            a.strokeStyle = String(t.strokeStyle)
            a.lineWidth = Number(t.lineWidth)
          }
          call("stroke", args)
        }
      if (prop === "arc")
        return (x: number, y: number, r: number, s: number, e: number, ccw = false): void => {
          pushArc(x, y, r, r, 0, s, e, ccw)
          call("arc", [x, y, r, s, e, ccw])
        }
      if (prop === "ellipse")
        return (x: number, y: number, rx: number, ry: number, rot: number, s: number, e: number, ccw = false): void => {
          pushArc(x, y, rx, ry, rot, s, e, ccw)
          call("arc", [x, y, rx, s, e, ccw])
        }
      if (prop === "roundRect") return (x: number, y: number, w: number, h: number): void => void call("rect", [x, y, w, h])
      if (prop === "arcTo") return (x1: number, y1: number): void => void call("lineTo", [x1, y1])
      if (prop === "quadraticCurveTo") return (_cx: number, _cy: number, x: number, y: number): void => void call("lineTo", [x, y])
      if (prop === "bezierCurveTo")
        return (_a: number, _b: number, _c: number, _d: number, x: number, y: number): void => void call("lineTo", [x, y])
      if (prop === "strokeRect")
        return (x: number, y: number, w: number, h: number): void => {
          call("beginPath", [])
          call("rect", [x, y, w, h])
          call("stroke", [])
        }
      return t[prop]
    },
    set(t, prop, value) {
      t[prop] = value
      return true
    },
  }
  return { ctx: new Proxy(target, handler) as unknown as CanvasRenderingContext2D, ops, arcs }
}

const norm = (a: number): number => {
  const tau = 2 * Math.PI
  return ((a % tau) + tau) % tau
}

// дуга, нарисованная ломаной: точка лежит на хорде, оба конца которой — на окружности (center, radius),
// а длина хорды не больше радиуса (дуга ≤ 60°). Длинные линии, проходящие через точку (штриховка стен,
// грани), под это условие не подходят.
export function onPolylineArc(segs: readonly [Point, Point][], center: Point, radius: number, p: Point, tol: number): boolean {
  const onCircle = (q: Point): boolean => Math.abs(Math.hypot(q.x - center.x, q.y - center.y) - radius) <= tol
  return segs.some(([a, b]) => {
    if (!onCircle(a) || !onCircle(b)) return false
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len > radius) return false
    const t = len < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)))
    return Math.hypot(a.x + (b.x - a.x) * t - p.x, a.y + (b.y - a.y) * t - p.y) <= tol
  })
}

// лежит ли точка (в координатах устройства) на обведённой дуге: расстояние до центра ≈ радиус и угол внутри пролёта
export function onStrokedArc(arcs: readonly ArcCall[], p: Point, tol: number): ArcCall | null {
  for (const a of arcs) {
    if (!a.stroked) continue
    if (Math.abs(Math.hypot(p.x - a.center.x, p.y - a.center.y) - a.radius) > tol) continue
    const ang = norm(Math.atan2(p.y - a.center.y, p.x - a.center.x))
    const s = norm(a.start)
    const e = norm(a.end)
    // пролёт по часовой (ccw = false): от s к e по возрастанию угла
    const span = a.ccw ? norm(s - e) : norm(e - s)
    const off = a.ccw ? norm(s - ang) : norm(ang - s)
    const full = Math.abs(a.end - a.start) >= 2 * Math.PI - 1e-9
    if (full || off <= span + 1e-6) return a
  }
  return null
}
