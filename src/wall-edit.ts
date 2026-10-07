import { planEdit } from "./edit-plan"
import type { EditPlan, Segment } from "./edit-plan"
import { doorwayGuard } from "./doorway/doorway-guard"
import type { DoorwayGuard } from "./doorway/doorway-guard"
import type { WallEnd } from "./ortho-stretch"
import { orthoAxisOf, otherEnd, projectEnd, projectMove, teeContext } from "./tee-bounds"
import type { TeeContext } from "./tee-bounds"
import type { Point, Wall, WallElement } from "./types"
import { collisionContext } from "./wall-collision"
import type { AxisSnap, CheckMode, CollisionContext, Verdict } from "./wall-collision"
import { add, cross, dist, dot, mul, sub, unit } from "./wall-geometry"

// Правки стен с ограничениями (change wall-move-bounds, design D1, D5, D7): примкнутая стена
// скользит вдоль опорной, стены не проходят сквозь друг друга. Текущая геометрия — начало правки;
// функции мутируют стены и возвращают фактический результат.

// snappedAxis — стена, к линии оси которой привязан перетаскиваемый конец или опорный конец
// перемещаемой стены (snapWithSource); doorways — проёмы чертежа, которые правка не должна
// нарушать (change add-doorway, design D5)
export interface EditMode {
  ortho: boolean
  snappedAxis?: Wall
  doorways?: readonly WallElement[]
}

export type ResizeResult =
  | { kind: "applied"; lengthCm: number }
  | { kind: "rejected"; reason: "both-ends-attached" | "no-change" }

const ZERO: Point = { x: 0, y: 0 }
const MAX_STEPS = 2000
const BISECT_ITERATIONS = 40
const SLIDE_ITERATIONS = 20
// смещение меньше этого — отсутствие смещения: стена в касании не сдвигается вовсе
const NO_MOVE_CM = 1e-4

const len = (v: Point): number => Math.hypot(v.x, v.y)

interface Problem {
  plan: EditPlan
  tee: TeeContext
  collision: CollisionContext
  doorways: DoorwayGuard | null
  project: (v: Point) => Point
  slide: boolean
}

function verdictAt(p: Problem, v: Point, mode: CheckMode): Verdict {
  const positions = p.plan.positions(v)
  if (!p.tee.holds(positions)) return { ok: false, normal: null }
  // нарушение проёма — недопустимость без нормали: остановка в касании без скольжения
  if (p.doorways && !p.doorways.holds(positions)) return { ok: false, normal: null }
  return p.collision.check(positions, mode)
}

const stepCount = (p: Problem, v: Point): number =>
  // шаг пути — четверть толщины самой тонкой стены: тело не проходит сквозь стену между шагами
  Math.min(MAX_STEPS, Math.max(1, Math.ceil(len(v) / (p.collision.minHalfThickness / 2))))

// путь по прямой от исходного положения: первый недопустимый шаг или null
function firstBlocked(p: Problem, v: Point, mode: CheckMode): { k: number; n: number } | null {
  const n = stepCount(p, v)
  for (let k = 1; k <= n; k++) if (!verdictAt(p, mul(v, k / n), mode).ok) return { k, n }
  return null
}

const pathClear = (p: Problem, v: Point, mode: CheckMode): boolean => firstBlocked(p, v, mode) === null

// наибольшая доля пути до касания и нормаль блокирующей пары
function contact(p: Problem, v: Point): { vc: Point; normal: Point | null } {
  const blocked = firstBlocked(p, v, "contact")
  if (!blocked) return { vc: v, normal: null }
  let ok = (blocked.k - 1) / blocked.n
  let bad = blocked.k / blocked.n
  let verdict = verdictAt(p, mul(v, bad), "contact")
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (ok + bad) / 2
    const vm = verdictAt(p, mul(v, mid), "contact")
    if (vm.ok) ok = mid
    else {
      bad = mid
      verdict = vm
    }
  }
  const vc = mul(v, ok)
  return { vc: len(vc) < NO_MOVE_CM ? ZERO : vc, normal: verdict.ok ? null : verdict.normal }
}

// ограничитель (design D5): допустимый запрос — без изменений; иначе касание и одно скольжение
function limit(p: Problem, request: Point): Point {
  const v = p.project(request)
  if (len(v) < 1e-12) return ZERO
  if (pathClear(p, v, "recognition")) return v
  const { vc, normal } = contact(p, v)
  if (!p.slide || !normal) return vc
  const r = sub(request, vc)
  const rt = sub(r, mul(normal, dot(r, normal)))
  const candidate = (s: number): Point => p.project(add(vc, mul(rt, s)))
  const full = candidate(1)
  if (len(sub(full, vc)) < 1e-9) return vc
  if (pathClear(p, full, "contact")) return full
  let ok = 0
  let bad = 1
  for (let i = 0; i < SLIDE_ITERATIONS; i++) {
    const mid = (ok + bad) / 2
    if (pathClear(p, candidate(mid), "contact")) ok = mid
    else bad = mid
  }
  const best = ok > 0 ? candidate(ok) : vc
  return len(best) < NO_MOVE_CM ? ZERO : best
}

function apply(positions: ReadonlyMap<Wall, Segment>): void {
  for (const [w, s] of positions) {
    w.a = { x: s.a.x, y: s.a.y }
    w.b = { x: s.b.x, y: s.b.y }
  }
}

// конец стены group на линии оси привязанной стены в запрошенном положении (design D4)
function moveSnaps(group: readonly Wall[], v: Point, axis: Wall | undefined): AxisSnap[] {
  if (!axis) return []
  const d = unit(axis.a, axis.b)
  const l = dist(axis.a, axis.b)
  const out: AxisSnap[] = []
  for (const wall of group)
    for (const end of ["a", "b"] as const) {
      const rel = sub(add(wall[end], v), axis.a)
      const along = dot(rel, d)
      if (Math.abs(cross(d, rel)) <= 1e-6 && along >= -1e-6 && along <= l + 1e-6) out.push({ wall, end, axis })
    }
  return out
}

// при орто итог остаётся на оси орто запроса: скольжение без боковой составляющей (design D5)
function onOrthoAxis(u: Point, axis: Point | null): Point {
  return axis ? mul(axis, dot(u, axis)) : u
}

export function moveWallsBounded(walls: Wall[], group: readonly Wall[], v: Point, mode: EditMode): Point {
  if (len(v) === 0 || !group.length) return ZERO
  const tee = teeContext(walls)
  const axis = mode.ortho ? orthoAxisOf(v) : null
  const project = (u: Point): Point => onOrthoAxis(projectMove(u, group, tee, mode.ortho), axis)
  const plan = planEdit(walls, { kind: "move", group }, mode.ortho)
  const collision = collisionContext(walls, moveSnaps(group, project(v), mode.snappedAxis))
  const result = limit({ plan, tee, collision, doorways: doorwayGuard(walls, mode.doorways ?? []), project, slide: true }, v)
  if (len(result) === 0) return ZERO
  apply(plan.positions(result))
  return result
}

export function moveEndpointBounded(walls: Wall[], wall: Wall, end: WallEnd, target: Point, mode: EditMode): Point {
  const base = wall[end]
  const other = wall[otherEnd(end)]
  const tee = teeContext(walls)
  const att = tee.attachments.find((a) => a.leg === wall && a.end === end)
  // при орто конец остаётся на оси орто через противоположный конец
  const axis = mode.ortho ? orthoAxisOf(sub(target, other)) : null
  const onAxis = (u: Point): Point => (axis ? sub(add(other, onOrthoAxis(sub(add(base, u), other), axis)), base) : u)
  const project = att ? (u: Point): Point => sub(projectEnd(add(base, u), att, tee, mode.ortho), base) : onAxis
  const plan = planEdit(walls, { kind: "end", wall, end }, mode.ortho)
  const snaps: AxisSnap[] = mode.snappedAxis ? [{ wall, end, axis: mode.snappedAxis }] : []
  const doorways = doorwayGuard(walls, mode.doorways ?? [])
  const result = limit({ plan, tee, collision: collisionContext(walls, snaps), doorways, project, slide: true }, sub(target, base))
  const next = add(base, result)
  // нулевая длина не применяется
  if (len(result) === 0 || dist(next, other) < 1e-6) return base
  apply(plan.positions(result))
  return wall[end]
}

export function resizeWallBounded(walls: Wall[], wall: Wall, lengthCm: number, mode: EditMode): ResizeResult {
  const current = dist(wall.a, wall.b)
  if (!(lengthCm > 0) || current < 1e-9) return { kind: "rejected", reason: "no-change" }
  const tee = teeContext(walls)
  const attached = (end: WallEnd): boolean => tee.attachments.some((a) => a.leg === wall && a.end === end)
  // подвижный конец — непримкнутый: b, иначе a
  const movable: WallEnd | null = !attached("b") ? "b" : !attached("a") ? "a" : null
  if (!movable) return { kind: "rejected", reason: "both-ends-attached" }
  const fixed = wall[otherEnd(movable)]
  const base = wall[movable]
  const target = add(fixed, mul(unit(fixed, base), lengthCm))
  const request = sub(target, base)
  if (len(request) < 1e-9) return { kind: "rejected", reason: "no-change" }
  const plan = planEdit(walls, { kind: "end", wall, end: movable }, mode.ortho)
  const doorways = doorwayGuard(walls, mode.doorways ?? [])
  const result = limit({ plan, tee, collision: collisionContext(walls, []), doorways, project: (u) => u, slide: false }, request)
  if (len(result) === 0) return { kind: "rejected", reason: "no-change" }
  apply(plan.positions(result))
  const full = result.x === request.x && result.y === request.y
  return { kind: "applied", lengthCm: full ? lengthCm : dist(wall.a, wall.b) }
}
