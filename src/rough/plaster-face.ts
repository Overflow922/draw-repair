import { EPS_CM, MIN_WIDTH_CM } from "../demolition/mark-model"
import { faceRunsReaching, hostOf, jambsT } from "../doorway/doorway-faces"
import { wallNearBody } from "../doorway/doorway-scene"
import type { Point, Wall, WallElement } from "../types"
import { RIGHT_COS, degenerate, dist, dot, perp, sub, unit } from "../wall-geometry"
import { openEndRuns } from "./plaster-end"
import type { WallEnd } from "./plaster-end"

// Цель клика инструмента «Штукатурка» (changes plaster-click-whole-face, plaster-face-to-corners, design D1): плоскость стены под
// курсором — открытый участок грани «от угла до угла», сквозь все стены, чьи грани лежат на одной линии (любой материал,
// толщина, сдвиг осей); окна и проёмы его не прерывают. Чистая функция.

// допуск совпадения граней стен одной плоскости, см
export const FACE_TOL_CM = 0.5

// кусок цели на одной стене подложки: границы от конца a этой стены, грань — относительно оси этой стены
export interface SideTargetPiece {
  wall: Wall
  face: 1 | -1
  from: number
  to: number
}

// кусок цели на торце (change plaster-wall-end-face, design D5): end — конец стены, from/to — поперечные смещения от оси
export interface EndTargetPiece {
  wall: Wall
  face: "end"
  end: WallEnd
  from: number
  to: number
}

// кусок цели на откосе (change plaster-opening-reveals, design D3): элемент стены и его откос; from = to — положение откоса вдоль
// оси стены (протяжённость полосы зависит от толщины из панели и определяется при отрисовке)
export interface RevealTargetPiece {
  wall: Wall
  face: "reveal"
  element: WallElement
  jamb: "a" | "b"
  from: number
  to: number
}

export type PlasterTargetPiece = SideTargetPiece | EndTargetPiece | RevealTargetPiece

// торец конца end стены подложки — конец исходной стены (design D4); по умолчанию любой конец
export type SourceEnd = (wall: Wall, end: WallEnd) => boolean

export interface PlasterTarget {
  pieces: PlasterTargetPiece[]
  focusWallId: string // стена под курсором: её пометка выделяется после постановки
}

// стена плоскости: её положение на оси опорной стены и грань относительно собственной оси
export interface PlaneWall {
  wall: Wall
  face: 1 | -1
  same: boolean // ось направлена так же, как у опорной стены
  start: number // положение конца a на оси опорной стены
  lo: number // протяжённость на оси опорной стены
  hi: number
}

// грань, у которой лежит точка: сторона оси, на которой она находится
export const faceOf = (wall: Wall, p: Point): 1 | -1 => (dot(sub(p, wall.a), perp(unit(wall.a, wall.b))) >= 0 ? 1 : -1)

// Откос (design D3): курсор в пределах тела опорной стены, а его проекция на ось отстоит от линии откоса не дальше радиуса;
// из нескольких откосов выбирается ближайший. Вне тела (дальше граней) откосы не ищутся.
function revealTarget(p: Point, openings: readonly WallElement[], walls: readonly Wall[], radiusCm: number): PlasterTarget | null {
  let best: { piece: RevealTargetPiece; gap: number } | null = null
  for (const element of openings) {
    const wall = hostOf(element, walls)
    if (!wall) continue
    const axis = unit(wall.a, wall.b)
    const lateral = dot(sub(p, wall.a), perp(axis))
    if (Math.abs(lateral) > wall.thicknessCm / 2) continue
    const along = dot(sub(p, wall.a), axis)
    const [near, far] = jambsT(element, wall)
    for (const [jamb, at] of [["a", near], ["b", far]] as const) {
      const gap = Math.abs(along - at)
      if (gap <= radiusCm && (!best || gap < best.gap)) best = { piece: { wall, face: "reveal", element, jamb, from: at, to: at }, gap }
    }
  }
  return best ? { pieces: [best.piece], focusWallId: best.piece.wall.id } : null
}

export function plasterTarget(
  p: Point,
  walls: readonly Wall[],
  radiusCm: number,
  isSourceEnd: SourceEnd = () => true,
  openings: readonly WallElement[] = [],
): PlasterTarget | null {
  const reveal = revealTarget(p, openings, walls, radiusCm)
  if (reveal) return reveal
  const host = wallNearBody(p, walls, radiusCm)
  if (!host || degenerate(host)) return null
  const face = faceOf(host, p)
  const axis = unit(host.a, host.b)
  const plane = planeWalls(host, face, walls)
  const len = dist(host.a, host.b)
  const along = dot(sub(p, host.a), axis)
  const end = endTarget(host, walls, p, along, len, isSourceEnd)
  if (end) return end
  // курсор за свободным концом, но вне тела поперёк, выбирает боковую грань, ближайшую к нему
  const t = Math.min(len, Math.max(0, along))
  const reachA = Math.max(0, ...plane.map((w) => -w.lo))
  const reachB = Math.max(0, ...plane.map((w) => w.hi - len))
  const run = faceRunsReaching(host, walls, face, reachA, reachB).find(([lo, hi]) => t >= lo - EPS_CM && t <= hi + EPS_CM)
  if (!run) return null
  const pieces = layPieces(plane, run, flushEnds(host, face, walls, isSourceEnd))
  return pieces.length === 0 ? null : { pieces, focusWallId: host.id }
}

// Торец перпендикулярной стены, лежащий в плоскости (change plaster-flush-end-in-plane, design D1): открытые части торца,
// переведённые на ось опорной стены. Торец принадлежит щели плоскости, если её закрывает только он.
export interface FlushEnd {
  piece: EndTargetPiece
  lo: number // протяжённость торца на оси опорной стены
  hi: number
}

export function flushEnds(host: Wall, face: 1 | -1, walls: readonly Wall[], isSourceEnd: SourceEnd): FlushEnd[] {
  const axis = unit(host.a, host.b)
  const outward = perp(axis)
  const out: FlushEnd[] = []
  for (const s of walls) {
    if (s === host || degenerate(s)) continue
    const dir = unit(s.a, s.b)
    if (Math.abs(dot(dir, outward)) < RIGHT_COS) continue
    for (const end of ["a", "b"] as const) {
      const point = end === "a" ? s.a : s.b
      // тело стены лежит с внутренней стороны плоскости, а торец — на линии грани опорной стены
      const inward = end === "a" ? dir : { x: -dir.x, y: -dir.y }
      if (face * dot(inward, outward) >= 0) continue
      if (Math.abs(face * dot(sub(point, host.a), outward) - host.thicknessCm / 2) > FACE_TOL_CM || !isSourceEnd(s, end)) continue
      const centre = dot(sub(point, host.a), axis)
      const sign = Math.sign(dot(perp(dir), axis))
      for (const [from, to] of openEndRuns(s, walls, end)) {
        const [lo, hi] = sign > 0 ? [centre + from, centre + to] : [centre - to, centre - from]
        out.push({ piece: { wall: s, face: "end", end, from, to }, lo, hi })
      }
    }
  }
  return out
}

// Торец (design D5): проекция курсора за концом оси, а поперёк курсор в пределах тела стены; цель — открытая часть торца
// под курсором. Закрытый торец и конец, не являющийся концом исходной стены, цели не дают — остаётся боковая грань.
function endTarget(host: Wall, walls: readonly Wall[], p: Point, along: number, len: number, isSourceEnd: SourceEnd): PlasterTarget | null {
  if (along >= 0 && along <= len) return null
  const end: WallEnd = along < 0 ? "a" : "b"
  const half = host.thicknessCm / 2
  const lateral = dot(sub(p, host.a), perp(unit(host.a, host.b)))
  if (Math.abs(lateral) > half || !isSourceEnd(host, end)) return null
  const run = openEndRuns(host, walls, end).find(([from, to]) => lateral >= from - EPS_CM && lateral <= to + EPS_CM)
  return run ? { pieces: [{ wall: host, face: "end", end, from: run[0], to: run[1] }], focusWallId: host.id } : null
}

// стены, у которых одна из граней лежит на линии грани опорной стены с той же стороны, по порядку вдоль её оси (опорная — тоже)
export function planeWalls(host: Wall, face: 1 | -1, walls: readonly Wall[]): PlaneWall[] {
  const axis = unit(host.a, host.b)
  const outward = perp(axis)
  const out: PlaneWall[] = []
  for (const w of walls) {
    if (degenerate(w)) continue
    const dir = unit(w.a, w.b)
    const along = dot(dir, axis)
    if (Math.abs(along) < RIGHT_COS) continue
    const same = along > 0
    const wallFace: 1 | -1 = same ? face : face === 1 ? -1 : 1
    // положение грани стены w поперёк опорной стены совпадает с гранью опорной
    const lateral = face * dot(sub(w.a, host.a), outward) + w.thicknessCm / 2
    if (w !== host && Math.abs(lateral - host.thicknessCm / 2) > FACE_TOL_CM) continue
    const start = dot(sub(w.a, host.a), axis)
    const len = dist(w.a, w.b)
    out.push({ wall: w, face: wallFace, same, start, lo: same ? start : start - len, hi: same ? start + len : start })
  }
  return out.sort((x, y) => x.lo - y.lo)
}

// участок run раскладывается по стенам плоскости без щелей и наложений: граница двух соседних стен — середина между
// концом предыдущей и началом следующей (щель, закрытая торцом перпендикулярной стены в плоскости, — самим торцом); первая
// стена начинается в начале участка, последняя кончается в его конце
function layPieces(plane: readonly PlaneWall[], run: [number, number], ends: readonly FlushEnd[]): PlasterTargetPiece[] {
  const [runLo, runHi] = run
  const inRun = plane.filter((w) => Math.min(w.hi, runHi) - Math.max(w.lo, runLo) > MIN_WIDTH_CM)
  const chain: PlaneWall[] = []
  for (const w of inRun) {
    const last = chain[chain.length - 1]
    if (!last || w.hi > last.hi + EPS_CM) chain.push(w)
  }
  const pieces: PlasterTargetPiece[] = []
  // у свободного конца граница участка совпадает с концом стены, а не с вычислительным шумом вокруг него
  const first = chain[0]
  const last = chain[chain.length - 1]
  const snap = (v: number, edge: number | undefined): number => (edge !== undefined && Math.abs(v - edge) <= EPS_CM ? edge : v)
  const endHi = snap(runHi, last?.hi)
  let pos = snap(runLo, first?.lo)
  chain.forEach((w, i) => {
    const next = chain[i + 1]
    // щель между стенами, закрытая торцами перпендикулярных стен в плоскости, отдаётся этим торцам: боковые куски доходят
    // до концов своих граней, а не до середины щели
    const gap = next ? ends.flatMap((e) => clipEnd(e, w.hi, next.lo)) : []
    const end = next ? Math.min(endHi, gap.length > 0 ? Math.max(pos, w.hi) : Math.max(pos, (w.hi + next.lo) / 2)) : endHi
    if (end - pos >= MIN_WIDTH_CM) pieces.push(pieceOn(w, pos, end))
    pieces.push(...gap)
    pos = next && gap.length > 0 ? Math.max(end, next.lo) : end
  })
  return pieces
}

// часть торца в щели [lo, hi] оси опорной стены, в поперечных смещениях торца; пусто, если перекрытие меньше MIN_WIDTH_CM
function clipEnd(e: FlushEnd, lo: number, hi: number): EndTargetPiece[] {
  const from = Math.max(e.lo, lo)
  const to = Math.min(e.hi, hi)
  if (to - from < MIN_WIDTH_CM) return []
  const near = e.piece.from + (from - e.lo) * ((e.piece.to - e.piece.from) / (e.hi - e.lo))
  const far = e.piece.from + (to - e.lo) * ((e.piece.to - e.piece.from) / (e.hi - e.lo))
  return [{ ...e.piece, from: Math.min(near, far), to: Math.max(near, far) }]
}

// часть участка [lo, hi] (по оси опорной стены) на стене w, в координатах w
const pieceOn = (w: PlaneWall, lo: number, hi: number): PlasterTargetPiece =>
  w.same ? { wall: w.wall, face: w.face, from: lo - w.start, to: hi - w.start } : { wall: w.wall, face: w.face, from: w.start - hi, to: w.start - lo }
