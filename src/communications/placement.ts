import type { Communication, Point, Wall } from "../types"
import { RECOGNITION_DEPTH_CM } from "../wall-collision"
import { DIRECTION_VECTORS, communicationBox, communicationViolation, shapeOfCommunication, wallBody } from "./geometry"
import type { Direction } from "./geometry"
import { BISECT_ITERATIONS, CLEAR_CM, CONTACT_DEPTH_CM, penetration, sweep, translate } from "./shape"
import type { Shape } from "./shape"

// Размеры новых коммуникаций, призрак установки и перемещение (change add-communications, design D4, D12).

export const DEFAULT_RISER_DIAMETER_CM = 11
export const DEFAULT_DUCT_CM = { width: 30, depth: 20 } as const

// шаг пути не меньше этого: тонкие препятствия задают шаг, но не делают его бесконечно мелким
const MIN_STEP_CM = 0.05
const DIRECTIONS: readonly Direction[] = ["right", "left", "down", "up"]

const at = (c: Communication, x: number, y: number): Communication => ({ ...c, x, y })

type Box = readonly [number, number, number, number]

const boxesMeet = (p: Box, q: Box): boolean => p[0] <= q[2] && q[0] <= p[2] && p[1] <= q[3] && q[1] <= p[3]

// габарит тела стены с запасом на толщину
const wallBox = (w: Wall): Box => {
  const h = w.thicknessCm / 2
  return [Math.min(w.a.x, w.b.x) - h, Math.min(w.a.y, w.b.y) - h, Math.max(w.a.x, w.b.x) + h, Math.max(w.a.y, w.b.y) + h]
}

// меньший размер тела коммуникации поперёк движения не меньше: диаметр, ширина или глубина
const smallestSide = (c: Communication): number => (c.kind === "riser" ? c.diameterCm : Math.min(c.widthCm, c.depthCm))

// последнее допустимое положение на прямой от c к target (design D4): допустимое — без изменений, иначе остановка
// в касании без скольжения; уже стоящая в наложении коммуникация не углубляет его. Проверяются только препятствия в
// габарите пути; шаг пути — не больше половины суммы собственного размера и толщины самого тонкого из них, поэтому
// тело не проскакивает препятствие между шагами при любой длине пути
export function moveLimited(c: Communication, target: Point, walls: readonly Wall[], others: readonly Communication[]): Point {
  const [ax, ay, bx, by] = communicationBox(c)
  const [cx, cy, dx, dy] = communicationBox(at(c, target.x, target.y))
  const path: Box = [Math.min(ax, cx) - 1, Math.min(ay, cy) - 1, Math.max(bx, dx) + 1, Math.max(by, dy) + 1]
  const nearWalls = walls.filter((w) => boxesMeet(wallBox(w), path))
  const nearOthers = others.filter((o) => o.id !== c.id && boxesMeet(communicationBox(o), path))
  if (!nearWalls.length && !nearOthers.length) return target
  const violation = (p: Point): number => communicationViolation(at(c, p.x, p.y), nearWalls, nearOthers)
  const v0 = violation(c)
  const recognized = Math.max(v0, RECOGNITION_DEPTH_CM)
  const tol = Math.max(v0 + CLEAR_CM, CONTACT_DEPTH_CM)
  const along = (t: number): Point => ({ x: c.x + (target.x - c.x) * t, y: c.y + (target.y - c.y) * t })
  const thinnest = Math.min(...nearWalls.map((w) => w.thicknessCm), ...nearOthers.map(smallestSide))
  const step = Math.max(MIN_STEP_CM, (smallestSide(c) + thinnest) / 2)
  const n = Math.max(1, Math.ceil(Math.hypot(target.x - c.x, target.y - c.y) / step))
  let ok = 0
  let bad = -1
  for (let k = 1; k <= n && bad < 0; k++) {
    if (violation(along(k / n)) > recognized) bad = k / n
    else ok = k / n
  }
  if (bad < 0) return target
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (ok + bad) / 2
    if (violation(along(mid)) > tol) bad = mid
    else ok = mid
  }
  return along(ok)
}

function obstaclesOf(c: Communication, walls: readonly Wall[], others: readonly Communication[]): Shape[] {
  const bodies = walls.flatMap((w) => wallBody(w) ?? [])
  return [...bodies, ...others.filter((o) => o.id !== c.id).map(shapeOfCommunication)]
}

// сдвиг вдоль dir, после которого коммуникация, налагающаяся на препятствия, свободна от них; null — такого сдвига нет:
// наложение не убывает, сдвиг пришлось бы вести сквозь другое тело или препятствие остаётся
function pushOut(c: Communication, dir: Direction, obstacles: readonly Shape[]): number | null {
  const d = DIRECTION_VECTORS[dir]
  const body = shapeOfCommunication(c)
  const depthAt = (o: Shape, s: number): number => penetration(translate(body, { x: d.x * s, y: d.y * s }), o).depth
  let shift = 0
  const clear: Shape[] = []
  for (const o of obstacles) {
    const d0 = depthAt(o, 0)
    if (d0 <= CLEAR_CM) {
      clear.push(o)
      continue
    }
    if (depthAt(o, 1e-3) >= d0) return null
    let hi = 1
    while (depthAt(o, hi) > CLEAR_CM) {
      hi *= 2
      if (hi > 1e4) return null
    }
    let lo = 0
    for (let i = 0; i < BISECT_ITERATIONS; i++) {
      const mid = (lo + hi) / 2
      if (depthAt(o, mid) > CLEAR_CM) lo = mid
      else hi = mid
    }
    shift = Math.max(shift, hi)
  }
  if (shift === 0) return null
  for (const o of clear) {
    const hit = sweep(body, d, o)
    if (hit && hit.t < shift - CONTACT_DEPTH_CM) return null
  }
  const moved = translate(body, { x: d.x * shift, y: d.y * shift })
  return obstacles.every((o) => penetration(moved, o).depth <= CONTACT_DEPTH_CM) ? shift : null
}

// призрак установки: центр — курсор, округлённый до сантиметра; при наложении — ближайший допустимый сдвиг
// вдоль одной из осей до касания; null — допустимого положения нет
export function ghostPosition(proto: Communication, cursor: Point, walls: readonly Wall[], others: readonly Communication[]): Communication | null {
  // «+ 0» превращает −0 после округления в 0: центр не должен хранить отрицательный нуль
  const placed = at(proto, Math.round(cursor.x) + 0, Math.round(cursor.y) + 0)
  if (communicationViolation(placed, walls, others) <= RECOGNITION_DEPTH_CM) return placed
  const obstacles = obstaclesOf(placed, walls, others)
  let best: Communication | null = null
  let bestShift = Infinity
  for (const dir of DIRECTIONS) {
    const shift = pushOut(placed, dir, obstacles)
    if (shift === null || shift >= bestShift) continue
    const d = DIRECTION_VECTORS[dir]
    best = at(placed, placed.x + d.x * shift, placed.y + d.y * shift)
    bestShift = shift
  }
  return best
}
