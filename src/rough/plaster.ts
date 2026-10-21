import { effectiveMarks, EPS_CM, lengthOf } from "../demolition/mark-model"
import { faceRuns, hostOf, hostPoint, jambsT } from "../doorway/doorway-faces"
import type { Side } from "../doorway/doorway-faces"
import { mountingScene } from "../mounting/mounting-scene"
import type { MountingScene } from "../mounting/mounting-scene"
import { remnantId, remnantSpans } from "../mounting/remnants"
import type { Drawing, EndPlasterMark, PlasterMark, Point, RevealPlasterMark, SidePlasterMark, Wall, WallElement } from "../types"
import { degenerate, pointInPolygon } from "../wall-geometry"
import { bridgeJoints } from "./plaster-bridge"
import { endStrip, openEndRuns } from "./plaster-end"
import { planeWalls } from "./plaster-face"
import { isSideMark } from "./rough-model"

// Штукатурка плана «Черновые работы» (change add-rough-works-plan, design D3, D4): пометка хранит участок грани исходной
// стены (стена обмера или собственная стена «Монтажа») от конца привязки; на подложке (остатки, собственные стены) она
// действует кусками — участок за вычетом снесённого. Чистые функции, входы не мутируются.

// пробный отступ от края куска и от линии грани при поиске соседней полосы у угла, см
const PROBE_CM = 0.05

// кусок действующей пометки на стене подложки: границы — от конца a стены подложки
export interface PlasterPiece {
  mark: PlasterMark
  wall: Wall
  from: number
  to: number
}

// стена подложки → исходная стена и расстояние от её конца a до начала стены подложки
export interface PlasterOrigin {
  source: Wall
  start: number
}

// границы пометки от конца a исходной стены без обрезки
export function plasterSpan(mark: SidePlasterMark, wall: Wall): [number, number] {
  const len = lengthOf(wall)
  return mark.anchor === "a" ? [mark.fromCm, mark.toCm] : [len - mark.toCm, len - mark.fromCm]
}

// стены, на которые ставится штукатурка: стены обмера и собственные стены «Монтажа»
export const plasterSources = (drawing: Drawing): Wall[] => [...drawing.walls, ...(drawing.mounting?.walls ?? [])]

// соответствие стен подложки исходным стенам: остаток — по идентификатору остатка, собственная стена — сама
export function plasterOrigins(drawing: Drawing): Map<string, PlasterOrigin> {
  const demolition = effectiveMarks(drawing.demolition ?? [], drawing.walls, drawing.doorways ?? [])
  const origins = new Map<string, PlasterOrigin>()
  for (const source of drawing.walls) {
    for (const [start] of remnantSpans(source, demolition)) origins.set(remnantId(source.id, start), { source, start })
  }
  for (const source of drawing.mounting?.walls ?? []) origins.set(source.id, { source, start: 0 })
  return origins
}

// кусок откоса (change plaster-opening-reveals, design D2): от откоса вглубь проёма на толщину, но не больше половины ширины
// проёма; элемент берётся из сцены «Монтажа» — снесённого или стёртого элемента там нет, и пометка не действует
export function revealSpan(element: WallElement, wall: Wall, jamb: "a" | "b", thicknessMm: number): [number, number] | null {
  const [near, far] = jambsT(element, wall)
  const depth = Math.min(thicknessMm / 10, (far - near) / 2)
  if (depth <= EPS_CM) return null
  return jamb === "a" ? [near, near + depth] : [far - depth, far]
}

function revealPiece(mark: RevealPlasterMark, scene: MountingScene): PlasterPiece | null {
  const element = scene.doorways.find((d) => d.id === mark.elementId)
  const wall = element && hostOf(element, scene.walls)
  const span = element && wall && revealSpan(element, wall, mark.jamb, mark.thicknessMm)
  return wall && span ? { mark, wall, from: span[0], to: span[1] } : null
}

// действующие куски пометок: участок, обрезанный по исходной стене, по оставшимся (не снесённым) частям; пометка стены,
// которой нет, не действует, но остаётся в хранилище
export function plasterPieces(drawing: Drawing, scene: MountingScene = mountingScene(drawing)): PlasterPiece[] {
  const demolition = effectiveMarks(drawing.demolition ?? [], drawing.walls, drawing.doorways ?? [])
  const byId = new Map(scene.walls.map((w) => [w.id, w]))
  const own = new Set((drawing.mounting?.walls ?? []).map((w) => w.id))
  const pieces: PlasterPiece[] = []
  for (const mark of drawing.roughPlaster ?? []) {
    if (mark.face === "reveal") {
      const piece = revealPiece(mark, scene)
      if (piece) pieces.push(piece)
      continue
    }
    const source = drawing.walls.find((w) => w.id === mark.wallId) ?? (drawing.mounting?.walls ?? []).find((w) => w.id === mark.wallId)
    if (!source) continue
    const len = lengthOf(source)
    if (mark.face === "end") {
      pieces.push(...endPieces(mark, source, own.has(source.id), len, demolition, byId, scene.walls))
      continue
    }
    const [lo, hi] = plasterSpan(mark, source)
    const from = Math.max(0, lo)
    const to = Math.min(len, hi)
    if (to - from <= EPS_CM) continue
    const spans: [number, number][] = own.has(source.id) ? [[0, len]] : remnantSpans(source, demolition)
    for (const [start, end] of spans) {
      const a = Math.max(from, start)
      const b = Math.min(to, end)
      if (b - a <= EPS_CM) continue
      const piece = byId.get(own.has(source.id) ? source.id : remnantId(source.id, start))
      if (!piece) continue
      const near = a - start
      const far = b - start
      const reach = overhang(piece, scene.walls, mark.face, near, far)
      pieces.push({
        mark,
        wall: piece,
        from: lo <= start + EPS_CM ? near - reach.a : near,
        to: hi >= end - EPS_CM ? far + reach.b : far,
      })
    }
  }
  const bridged = bridgeJoints(pieces, scene.walls)
  const rank = new Map(plasterSources(drawing).map((w, i) => [w.id, i]))
  const wrapped = bridged.map((piece) => wrapSideCorners(piece, bridged, rank))
  return wrapped.map((piece) => wrapEndCorners(piece, wrapped))
}

// Внешний угол двух боковых полос (change plaster-corner-wrap, design D2–D3): угловой квадрат между внешними поверхностями
// закрывает ведущая полоса — полоса стены, стоящей в чертеже раньше: она продлевается за край грани на толщину соседней полосы.
// Сосед — боковой кусок, чья полоса примыкает к линии грани этого куска сразу за его краем, со стороны тела стены.
function wrapSideCorners(piece: PlasterPiece, pieces: readonly PlasterPiece[], rank: ReadonlyMap<string, number>): PlasterPiece {
  const mark = piece.mark
  if (!isSideMark(mark) || degenerate(piece.wall)) return piece
  const len = lengthOf(piece.wall)
  const half = piece.wall.thicknessCm / 2
  const probeLateral = mark.face * (half - PROBE_CM)
  const neighbour = (edge: number, outward: 1 | -1): PlasterPiece | undefined => {
    const probe = hostPoint(piece.wall, edge + outward * PROBE_CM, probeLateral)
    return pieces.find((x) => x.mark.id !== mark.id && isSideMark(x.mark) && pointInPolygon(probe, plasterStrip(x)))
  }
  const leads = (other: PlasterPiece): boolean =>
    isSideMark(other.mark) && (rank.get(mark.wallId) ?? Infinity) < (rank.get(other.mark.wallId) ?? Infinity)
  const atA = piece.from <= -EPS_CM ? neighbour(piece.from, -1) : undefined
  const atB = piece.to >= len + EPS_CM ? neighbour(piece.to, 1) : undefined
  return {
    ...piece,
    from: atA && leads(atA) ? piece.from - atA.mark.thicknessMm / 10 : piece.from,
    to: atB && leads(atB) ? piece.to + atB.mark.thicknessMm / 10 : piece.to,
  }
}

// Внешний угол выступа: полоса торца шире у края, дошедшего до боковой грани, если на этой грани у этого конца есть
// действующая полоса — угол закрывает торец; ширина расширения — толщина этой боковой полосы, чтобы внешние поверхности
// торца и боковой полосы сошлись в одну линию (change plaster-end-outer-corner, plaster-single-contour)
function wrapEndCorners(piece: PlasterPiece, pieces: readonly PlasterPiece[]): PlasterPiece {
  const mark = piece.mark
  if (mark.face !== "end") return piece
  const half = piece.wall.thicknessCm / 2
  const len = lengthOf(piece.wall)
  const reaching = (face: Side): PlasterPiece | undefined =>
    pieces.find(
      (x) =>
        x.mark.face === face &&
        x.wall.id === piece.wall.id &&
        (mark.anchor === "a" ? x.from <= EPS_CM : x.to >= len - EPS_CM),
    )
  const sideDepth = (face: Side): number => (reaching(face)?.mark.thicknessMm ?? 0) / 10
  // поперечное смещение +half — грань +1, −half — грань −1
  return {
    ...piece,
    from: piece.from <= -half + EPS_CM ? piece.from - sideDepth(-1) : piece.from,
    to: piece.to >= half - EPS_CM ? piece.to + sideDepth(1) : piece.to,
  }
}

// куски пометки торца (change plaster-wall-end-face, design D3–D4): торец — конец исходной стены, у остатка на срезе сноса
// торца для штукатурки нет; куском становится каждая открытая часть торца
function endPieces(
  mark: EndPlasterMark,
  source: Wall,
  isOwn: boolean,
  len: number,
  demolition: ReturnType<typeof effectiveMarks>,
  byId: ReadonlyMap<string, Wall>,
  sceneWalls: readonly Wall[],
): PlasterPiece[] {
  const spans: [number, number][] = isOwn ? [[0, len]] : remnantSpans(source, demolition)
  const span = spans.find(([start, end]) => (mark.anchor === "a" ? start <= EPS_CM : end >= len - EPS_CM))
  const wall = span && byId.get(isOwn ? source.id : remnantId(source.id, span[0]))
  if (!wall) return []
  return openEndRuns(wall, sceneWalls, mark.anchor).map(([from, to]) => ({ mark, wall, from, to }))
}

// выступ тела стены за концы оси до края открытой грани (change plaster-face-to-corners, design D2–D3); там, где плоскость
// продолжает другая стена, выступа нет — его закрывает кусок соседа
function overhang(wall: Wall, walls: readonly Wall[], face: Side, from: number, to: number): { a: number; b: number } {
  const len = lengthOf(wall)
  const run = faceRuns(wall, walls, face).reduce<[number, number] | null>(
    (best, r) => (!best || Math.min(r[1], to) - Math.max(r[0], from) > Math.min(best[1], to) - Math.max(best[0], from) ? r : best),
    null,
  )
  if (!run) return { a: 0, b: 0 }
  const neighbours = planeWalls(wall, face, walls).filter((w) => w.wall !== wall)
  const free = (lo: number, hi: number): boolean => !neighbours.some((w) => Math.min(w.hi, hi) - Math.max(w.lo, lo) > EPS_CM)
  return {
    a: run[0] < -EPS_CM ? (free(run[0], 0) ? -run[0] : trimA(wall, walls, face, from, to)) : trimA(wall, walls, face, from, to),
    b: run[1] > len + EPS_CM ? (free(len, run[1]) ? run[1] - len : 0) : trimB(wall, walls, face, from, to),
  }
}

// Внутренний угол (change plaster-corner-wrap, design D1): грань начинается дальше оси, и край куска у конца оси ставится на
// грань соседней стены, а не на ось в её теле. Возвращает отрицательный выступ; промежуточные участки грани (Т-примыкание
// внутри участка) край не меняют — полоса идёт сквозь них, как и раньше.
function overlapping(wall: Wall, walls: readonly Wall[], face: Side, from: number, to: number): [number, number][] {
  return faceRuns(wall, walls, face).filter((r) => Math.min(r[1], to) - Math.max(r[0], from) > EPS_CM)
}

function trimA(wall: Wall, walls: readonly Wall[], face: Side, from: number, to: number): number {
  const first = Math.min(...overlapping(wall, walls, face, from, to).map((r) => r[0]))
  return first > EPS_CM && first < Infinity ? -first : 0
}

function trimB(wall: Wall, walls: readonly Wall[], face: Side, from: number, to: number): number {
  const last = Math.max(...overlapping(wall, walls, face, from, to).map((r) => r[1]))
  return last < lengthOf(wall) - EPS_CM && last > -Infinity ? last - lengthOf(wall) : 0
}

// полоса пометки: прямоугольник, примыкающий к грани снаружи тела стены; вглубь — на толщину
export function plasterStrip(piece: PlasterPiece): Point[] {
  if (piece.mark.face === "end") return endStrip(piece.wall, piece.mark.anchor, piece.from, piece.to, piece.mark.thicknessMm)
  if (piece.mark.face === "reveal") {
    // откос лежит внутри тела стены: поперёк оси от грани до грани
    const half = piece.wall.thicknessCm / 2
    return [hostPoint(piece.wall, piece.from, -half), hostPoint(piece.wall, piece.to, -half), hostPoint(piece.wall, piece.to, half), hostPoint(piece.wall, piece.from, half)]
  }
  const half = piece.wall.thicknessCm / 2
  const near = piece.mark.face * half
  const far = piece.mark.face * (half + piece.mark.thicknessMm / 10)
  return [hostPoint(piece.wall, piece.from, near), hostPoint(piece.wall, piece.to, near), hostPoint(piece.wall, piece.to, far), hostPoint(piece.wall, piece.from, far)]
}
