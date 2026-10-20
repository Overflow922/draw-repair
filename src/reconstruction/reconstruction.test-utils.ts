import { drawing as roughDrawing } from "../rough/rough.test-utils"
import type { RoughParts } from "../rough/rough.test-utils"
import type { Dimension, Drawing, DrywallWall, Point, ReconstructionContent } from "../types"

// change reconstruction-plan: сцены и независимые эталоны для тестов плана «Реконструкция».
// Числа выведены из спецификации (reconstruction-plan) и геометрии сцен, а не из продакшн-модулей плана.

export { W, plaster, rectWalls, wall, screed } from "../rough/rough.test-utils"

export const drywall = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm = 10, heightCm = 250): DrywallWall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "gkl",
  heightCm,
})

export interface ReconstructionParts extends RoughParts {
  reconstruction?: ReconstructionContent
}

export const drawing = (parts: ReconstructionParts = {}): Drawing => {
  const { reconstruction, ...rest } = parts
  return { ...roughDrawing(rest), ...(reconstruction !== undefined ? { reconstruction } : null) }
}

export const content = (walls: DrywallWall[], dimensions: Dimension[] = []): ReconstructionContent => ({ walls, dimensions })

export const ends = (w: { a: Point; b: Point }): [Point, Point] => (w.a.x < w.b.x || (w.a.x === w.b.x && w.a.y <= w.b.y) ? [w.a, w.b] : [w.b, w.a])
