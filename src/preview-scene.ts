import type { Wall } from "./types"

// Сцена, по которой рисуется стена, пока тянется превью.
// Превью меняет вид только стен, которых оно касается; остальные берутся из сцены без превью,
// чей результат лежит в кэше геометрии (`scene-cache.ts`), и не пересчитываются на каждое движение курсора.

interface Box {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

function boxOf(wall: Wall, margin: number): Box {
  return {
    minX: Math.min(wall.a.x, wall.b.x) - margin,
    minY: Math.min(wall.a.y, wall.b.y) - margin,
    maxX: Math.max(wall.a.x, wall.b.x) + margin,
    maxY: Math.max(wall.a.y, wall.b.y) + margin,
  }
}

function overlap(p: Box, q: Box): boolean {
  return p.minX <= q.maxX && q.minX <= p.maxX && p.minY <= q.maxY && q.minY <= p.maxY
}

// stable: стены без превью; withPreview: они же плюс превью. Рамки осей стен, расширенные на толщины обеих, пересекаются
// у любой пары, чьи тела могут сходиться, — остальные стены от превью не зависят
export function previewSceneOf(preview: Wall | null, stable: Wall[], withPreview: Wall[]): (wall: Wall) => Wall[] {
  if (!preview) return () => stable
  return (wall) => (overlap(boxOf(wall, wall.thicknessCm), boxOf(preview, preview.thicknessCm)) ? withPreview : stable)
}
