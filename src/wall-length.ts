import type { Wall } from "./types"
import { collinearGapCm, dist } from "./wall-geometry"

// Длина стены от кромки до кромки (change fix-collinear-edge-to-edge-length, design D1–D3, D5): у стены,
// продолжающей раннюю коллинеарно с зазором, тело выступает за вершину оси до конца оси ранней стены; эта
// величина — выступ торца — входит в длину стены. У углов, T-примыканий и свободных торцов выступа нет.
// Выступ есть только у стен ранее сохранённых чертежей: вновь нарисованное продолжение сходится осью с торцом
// (change collinear-axes-meet, `wall-axes-meet.ts`), и его длина равна длине оси.

export const endOverhangCm = collinearGapCm

// длина видимого тела вдоль оси: ось плюс выступы торцов обоих концов
export function edgeLengthCm(wall: Wall, walls: Wall[]): number {
  return dist(wall.a, wall.b) + endOverhangCm(wall, "a", walls) + endOverhangCm(wall, "b", walls)
}

// длина оси, которая даёт введённую длину кромка-кромка; null — введённое не больше выступов
export function axisLengthForEdgeCm(wall: Wall, walls: Wall[], edgeCm: number): number | null {
  const axis = edgeCm - endOverhangCm(wall, "a", walls) - endOverhangCm(wall, "b", walls)
  return axis > 0 ? axis : null
}
