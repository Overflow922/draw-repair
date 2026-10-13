import type { Point, Wall } from "./types"
import type { StartRef } from "./wall-angle"
import { RIGHT_COS, collinearGapCm, dist, dot, sub } from "./wall-geometry"

// Длина стены от кромки до кромки (change fix-collinear-edge-to-edge-length, design D1–D3, D5): у стены,
// продолжающей раннюю коллинеарно с зазором, тело выступает за вершину оси до конца оси ранней стены; эта
// величина — выступ торца — входит в длину стены. У углов, T-примыканий и свободных торцов выступа нет.

const EPS = 1e-9

export const endOverhangCm = collinearGapCm

// длина видимого тела вдоль оси: ось плюс выступы торцов обоих концов
export function edgeLengthCm(wall: Wall, walls: Wall[]): number {
  return dist(wall.a, wall.b) + endOverhangCm(wall, "a", walls) + endOverhangCm(wall, "b", walls)
}

// выступ начала у свободного торца: расстояние вдоль сегмента от конца оси ранней стены до вершины, если
// опора — торец, а сегмент идёт коллинеарно наружной нормали торца (допуск прямого угла)
export function startOverhangCm(ref: StartRef | null, start: Point, dir: Point): number {
  if (!ref || ref.kind !== "cap" || !ref.anchor) return 0
  const len = Math.hypot(dir.x, dir.y)
  if (len < EPS) return 0
  const u = { x: dir.x / len, y: dir.y / len }
  if (dot(u, ref.normal) < RIGHT_COS) return 0
  return Math.max(0, dot(sub(start, ref.anchor), u))
}

// живая длина превью-сегмента: длина сегмента плюс выступ начала
export function previewEdgeLengthCm(ref: StartRef | null, start: Point, end: Point): number {
  const len = dist(start, end)
  if (len < EPS) return 0
  return len + startOverhangCm(ref, start, sub(end, start))
}

// длина оси, которая даёт введённую длину кромка-кромка; null — введённое не больше выступов
export function axisLengthForEdgeCm(wall: Wall, walls: Wall[], edgeCm: number): number | null {
  const axis = edgeCm - endOverhangCm(wall, "a", walls) - endOverhangCm(wall, "b", walls)
  return axis > 0 ? axis : null
}
