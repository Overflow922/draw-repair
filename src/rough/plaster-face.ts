import { EPS_CM, MIN_WIDTH_CM } from "../demolition/mark-model"
import { hostChains } from "../doorway/collinear-chain"
import { chainFaceRuns } from "../doorway/doorway-faces"
import { wallNearBody } from "../doorway/doorway-scene"
import type { Point, Wall } from "../types"
import { degenerate, dist, dot, perp, sub, unit } from "../wall-geometry"

// Цель клика инструмента «Штукатурка» (change plaster-click-whole-face, design D1–D4): открытый участок грани «от угла до угла»
// под курсором — сквозь коллинеарные отрезки стены любого материала, окна и проёмы его не прерывают. Чистая функция.

// кусок цели на одной стене подложки: границы от конца a этой стены, грань — относительно оси этой стены
export interface PlasterTargetPiece {
  wall: Wall
  face: 1 | -1
  from: number
  to: number
}

export interface PlasterTarget {
  pieces: PlasterTargetPiece[]
  focusWallId: string // стена под курсором: её пометка выделяется после постановки
}

// грань, у которой лежит точка: сторона оси, на которой она находится
export const faceOf = (wall: Wall, p: Point): 1 | -1 => (dot(sub(p, wall.a), perp(unit(wall.a, wall.b))) >= 0 ? 1 : -1)

export function plasterTarget(p: Point, walls: readonly Wall[], radiusCm: number): PlasterTarget | null {
  const host = wallNearBody(p, walls, radiusCm)
  if (!host || degenerate(host)) return null
  const face = faceOf(host, p)
  const axis = unit(host.a, host.b)
  const t = dot(sub(p, host.a), axis)
  const run = chainFaceRuns(host, walls, face).find(([lo, hi]) => t >= lo - EPS_CM && t <= hi + EPS_CM)
  if (!run) return null
  const chains = hostChains(host, walls, { ignoreMaterial: true })
  const pieces: PlasterTargetPiece[] = []
  // по порядку вдоль оси опорной стены
  for (const w of [...[...chains.a.walls].reverse(), host, ...chains.b.walls]) {
    const piece = pieceOn(w, host, axis, face, run)
    if (piece) pieces.push(piece)
  }
  return pieces.length === 0 ? null : { pieces, focusWallId: host.id }
}

// часть участка run (по оси опорной стены от её конца a) на стене w, в координатах w
function pieceOn(w: Wall, host: Wall, axis: Point, face: 1 | -1, run: [number, number]): PlasterTargetPiece | null {
  const len = dist(w.a, w.b)
  const same = dot(unit(w.a, w.b), axis) > 0
  const start = dot(sub(w.a, host.a), axis) // положение конца a стены w на оси опорной стены
  const lo = Math.max(run[0], same ? start : start - len)
  const hi = Math.min(run[1], same ? start + len : start)
  if (hi - lo < MIN_WIDTH_CM) return null
  return same ? { wall: w, face, from: lo - start, to: hi - start } : { wall: w, face: face === 1 ? -1 : 1, from: start - hi, to: start - lo }
}
