import { EPS_CM, effectiveMarks, lengthOf } from "../demolition/mark-model"
import type { ResolvedMark } from "../demolition/mark-model"
import type { Dimension, Drawing, Wall, WallElement } from "../types"
import { remnantId, remnantSpans, remnantWalls } from "./remnants"

// Сцена плана «Монтаж» (change mounting-plan, design D2, D3, D5): остатки стен обмера после сноса + собственные
// объекты плана. Чистая функция, чертёж не мутируется.

export interface MountingScene {
  remnants: Wall[]
  own: Wall[]
  // remnants, затем own — для геометрии, привязок, контуров и отрисовки
  walls: Wall[]
  // видимые старые элементы обмера, затем видимые собственные; wallId и offsetCm — относительно остатка
  doorways: WallElement[]
  // собственные размеры, у которых все привязки есть среди walls
  dimensions: Dimension[]
  // идентификаторы показанных старых элементов: только чтение
  oldElementIds: ReadonlySet<string>
}

// полоса элемента вдоль оси исходной стены, от конца a
function stripOf(e: WallElement, len: number): [number, number] {
  return e.anchor === "a" ? [e.offsetCm, e.offsetCm + e.widthCm] : [len - e.offsetCm - e.widthCm, len - e.offsetCm]
}

// элемент, перенесённый на остаток [start, end] стены длиной len
function onRemnant(e: WallElement, wall: Wall, len: number, start: number, end: number): WallElement {
  return { ...e, wallId: remnantId(wall.id, start), offsetCm: e.anchor === "a" ? e.offsetCm - start : e.offsetCm - (len - end) }
}

// старый элемент виден, только если его полоса не пересекает и не касается области сноса и лежит на остатке
function resolveOld(e: WallElement, walls: readonly Wall[], marks: readonly ResolvedMark[]): WallElement | null {
  const wall = walls.find((w) => w.id === e.wallId)
  if (!wall) return null
  const len = lengthOf(wall)
  const [s, t] = stripOf(e, len)
  if (marks.some((m) => m.wall.id === wall.id && t >= m.from - EPS_CM && s <= m.to + EPS_CM)) return null
  const piece = remnantSpans(wall, marks).find(([start, end]) => start - EPS_CM <= s && t <= end + EPS_CM)
  return piece ? onRemnant(e, wall, len, piece[0], piece[1]) : null
}

// собственный элемент: на собственной стене остаётся как есть; на стене обмера — на остатке, целиком (включительно)
function resolveOwn(e: WallElement, own: readonly Wall[], walls: readonly Wall[], marks: readonly ResolvedMark[]): WallElement | null {
  if (own.some((w) => w.id === e.wallId)) return e
  const wall = walls.find((w) => w.id === e.wallId)
  if (!wall) return null
  const len = lengthOf(wall)
  const [s, t] = stripOf(e, len)
  const piece = remnantSpans(wall, marks).find(([start, end]) => start - EPS_CM <= s && t <= end + EPS_CM)
  return piece ? onRemnant(e, wall, len, piece[0], piece[1]) : null
}

const present = <T>(item: T | null): item is T => item !== null

export function mountingScene(drawing: Drawing): MountingScene {
  const marks = effectiveMarks(drawing.demolition ?? [], drawing.walls, drawing.doorways ?? [])
  const remnants = remnantWalls(drawing.walls, marks)
  const own = drawing.mounting?.walls ?? []
  const walls = [...remnants, ...own]
  const ids = new Set(walls.map((w) => w.id))
  const old = (drawing.doorways ?? []).flatMap((e) => {
    const resolved = resolveOld(e, drawing.walls, marks)
    return resolved ? [resolved] : []
  })
  const mine = (drawing.mounting?.doorways ?? []).map((e) => resolveOwn(e, own, drawing.walls, marks)).filter(present)
  const dimensions = (drawing.mounting?.dimensions ?? []).filter((d) =>
    [d.from.a, d.from.b, d.to.a, d.to.b].every((ref) => ids.has(ref.wallId)),
  )
  return { remnants, own: [...own], walls, doorways: [...old, ...mine], dimensions, oldElementIds: new Set(old.map((e) => e.id)) }
}
