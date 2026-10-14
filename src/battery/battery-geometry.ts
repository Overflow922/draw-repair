import { shapeOfCommunication } from "../communications/geometry"
import { penetration, segmentShape } from "../communications/shape"
import type { Shape } from "../communications/shape"
import { hostPoint } from "../doorway/doorway-faces"
import type { Battery, Communication, Point, Wall } from "../types"
import { RECOGNITION_DEPTH_CM } from "../wall-collision"
import { degenerate, dist } from "../wall-geometry"

// Геометрия батареи (change add-battery, design D1, D2): прямоугольник в плане вычисляется от оси опорной стены, поэтому
// батарея всегда параллельна стене и следует за ней сама; проверка пересечений с другими объектами чертежа.
// Чистые функции без DOM и хранилища.

export type CornerEnd = "a" | "b"
export type CornerSide = "back" | "front"

// сцена проверки пересечений: всё, с чем батарея не должна налагаться
export interface BatteryScene {
  walls: readonly Wall[]
  batteries: readonly Battery[]
  communications: readonly Communication[]
}

// участок батареи вдоль оси опорной стены по t от конца a: [ближе к a, ближе к b]
export function batterySpan(b: Battery, wall: Wall): [number, number] {
  const len = dist(wall.a, wall.b)
  return b.anchor === "a" ? [b.offsetCm, b.offsetCm + b.lengthCm] : [len - b.offsetCm - b.lengthCm, len - b.offsetCm]
}

// поперечные положения задней и передней сторон от оси по нормали (−d.y, d.x)
function laterals(b: Battery, wall: Wall): [number, number] {
  const back = wall.thicknessCm / 2 + b.gapCm
  return [b.face * back, b.face * (back + b.thicknessCm)]
}

export function batteryCorner(b: Battery, wall: Wall, end: CornerEnd, side: CornerSide): Point {
  const [t0, t1] = batterySpan(b, wall)
  const [back, front] = laterals(b, wall)
  return hostPoint(wall, end === "a" ? t0 : t1, side === "back" ? back : front)
}

// четыре угла по обходу контура: задняя сторона a → b, затем передняя b → a
export function batteryRect(b: Battery, wall: Wall): Point[] {
  return [batteryCorner(b, wall, "a", "back"), batteryCorner(b, wall, "b", "back"), batteryCorner(b, wall, "b", "front"), batteryCorner(b, wall, "a", "front")]
}

export const batteryShape = (b: Battery, wall: Wall): Shape => ({ kind: "poly", pts: batteryRect(b, wall) })

const hostOf = (b: Battery, walls: readonly Wall[]): Wall | null => {
  const host = walls.find((w) => w.id === b.wallId)
  return host && !degenerate(host) ? host : null
}

// наибольшая глубина наложения батареи на другие объекты сцены: батареи (любых стен), тела других стен, коммуникации;
// опорная стена, элементы стены и сама батарея препятствиями не считаются. Нет опорной стены — наложения нет
export function batteryDepth(b: Battery, scene: BatteryScene): number {
  const host = hostOf(b, scene.walls)
  if (!host) return 0
  const mine = batteryShape(b, host)
  let depth = 0
  const take = (other: Shape | null): void => {
    if (other) depth = Math.max(depth, penetration(mine, other).depth)
  }
  for (const w of scene.walls) if (w.id !== host.id && !degenerate(w)) take(segmentShape(w.a, w.b, w.thicknessCm))
  for (const o of scene.batteries) {
    if (o.id === b.id) continue
    const oh = hostOf(o, scene.walls)
    if (oh) take(batteryShape(o, oh))
  }
  for (const c of scene.communications) take(shapeOfCommunication(c))
  return depth
}

// наложение не глубже допуска распознавания (касание допустимо)
export const batteryHolds = (b: Battery, scene: BatteryScene): boolean => batteryDepth(b, scene) <= RECOGNITION_DEPTH_CM
