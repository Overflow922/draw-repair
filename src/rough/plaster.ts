import { effectiveMarks, EPS_CM, lengthOf } from "../demolition/mark-model"
import { faceRuns, hostPoint } from "../doorway/doorway-faces"
import type { Side } from "../doorway/doorway-faces"
import { mountingScene } from "../mounting/mounting-scene"
import type { MountingScene } from "../mounting/mounting-scene"
import { remnantId, remnantSpans } from "../mounting/remnants"
import type { Drawing, PlasterMark, Point, Wall } from "../types"
import { planeWalls } from "./plaster-face"

// Штукатурка плана «Черновые работы» (change add-rough-works-plan, design D3, D4): пометка хранит участок грани исходной
// стены (стена обмера или собственная стена «Монтажа») от конца привязки; на подложке (остатки, собственные стены) она
// действует кусками — участок за вычетом снесённого. Чистые функции, входы не мутируются.

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
export function plasterSpan(mark: PlasterMark, wall: Wall): [number, number] {
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

// действующие куски пометок: участок, обрезанный по исходной стене, по оставшимся (не снесённым) частям; пометка стены,
// которой нет, не действует, но остаётся в хранилище
export function plasterPieces(drawing: Drawing, scene: MountingScene = mountingScene(drawing)): PlasterPiece[] {
  const demolition = effectiveMarks(drawing.demolition ?? [], drawing.walls, drawing.doorways ?? [])
  const byId = new Map(scene.walls.map((w) => [w.id, w]))
  const own = new Set((drawing.mounting?.walls ?? []).map((w) => w.id))
  const pieces: PlasterPiece[] = []
  for (const mark of drawing.roughPlaster ?? []) {
    const source = drawing.walls.find((w) => w.id === mark.wallId) ?? (drawing.mounting?.walls ?? []).find((w) => w.id === mark.wallId)
    if (!source) continue
    const len = lengthOf(source)
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
  return pieces
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
    a: run[0] < -EPS_CM && free(run[0], 0) ? -run[0] : 0,
    b: run[1] > len + EPS_CM && free(len, run[1]) ? run[1] - len : 0,
  }
}

// полоса пометки: прямоугольник, примыкающий к грани снаружи тела стены; вглубь — на толщину
export function plasterStrip(piece: PlasterPiece): Point[] {
  const half = piece.wall.thicknessCm / 2
  const near = piece.mark.face * half
  const far = piece.mark.face * (half + piece.mark.thicknessMm / 10)
  return [hostPoint(piece.wall, piece.from, near), hostPoint(piece.wall, piece.to, near), hostPoint(piece.wall, piece.to, far), hostPoint(piece.wall, piece.from, far)]
}
