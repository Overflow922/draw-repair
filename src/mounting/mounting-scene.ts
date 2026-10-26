import { EPS_CM, effectiveMarks, lengthOf } from "../demolition/mark-model"
import type { ResolvedMark } from "../demolition/mark-model"
import { batterySpan } from "../battery/battery-geometry"
import { bodySpan } from "../doorway/doorway-faces"
import type { Battery, Dimension, DimPoint, Drawing, Wall, WallElement } from "../types"
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
  // видимые батареи обмера, затем видимые собственные; wallId и offsetCm — относительно остатка (change add-battery, design D7)
  batteries: Battery[]
  // идентификаторы показанных батарей обмера: только чтение
  oldBatteryIds: ReadonlySet<string>
}

// полоса элемента вдоль оси исходной стены, от конца a
function stripOf(e: WallElement, len: number): [number, number] {
  return e.anchor === "a" ? [e.offsetCm, e.offsetCm + e.widthCm] : [len - e.offsetCm - e.widthCm, len - e.offsetCm]
}

// элемент или батарея, перенесённые на остаток [start, end] стены длиной len: расстояние считается от того же конца
interface Anchored {
  wallId: string
  anchor: "a" | "b"
  offsetCm: number
}

function onRemnant<T extends Anchored>(e: T, wall: Wall, len: number, start: number, end: number): T {
  return { ...e, wallId: remnantId(wall.id, start), offsetCm: e.anchor === "a" ? e.offsetCm - start : e.offsetCm - (len - end) }
}

// остаток, на котором лежит полоса [s, t]: концы остатка, совпадающие с концами исходной стены, продолжены на выступ
// тела стены за ось (spec mounting-plan «Старые элементы стены на плане «Монтаж»», design D4a); граница сноса не продолжается
function remnantOf(wall: Wall, walls: readonly Wall[], marks: readonly ResolvedMark[], len: number, s: number, t: number): [number, number] | undefined {
  const body = bodySpan(wall, walls)
  return remnantSpans(wall, marks).find(([start, end]) => {
    const from = start <= EPS_CM && body ? Math.min(0, body[0]) : start
    const to = end >= len - EPS_CM && body ? Math.max(len, body[1]) : end
    return from - EPS_CM <= s && t <= to + EPS_CM
  })
}

// старый элемент виден, только если его полоса не пересекает и не касается области сноса и лежит на остатке
function resolveOld(e: WallElement, walls: readonly Wall[], marks: readonly ResolvedMark[]): WallElement | null {
  const wall = walls.find((w) => w.id === e.wallId)
  if (!wall) return null
  const len = lengthOf(wall)
  const [s, t] = stripOf(e, len)
  if (marks.some((m) => m.wall.id === wall.id && t >= m.from - EPS_CM && s <= m.to + EPS_CM)) return null
  const piece = remnantOf(wall, walls, marks, len, s, t)
  return piece ? onRemnant(e, wall, len, piece[0], piece[1]) : null
}

// собственный элемент: на собственной стене остаётся как есть; на стене обмера — на остатке, целиком (включительно)
function resolveOwn(e: WallElement, own: readonly Wall[], walls: readonly Wall[], marks: readonly ResolvedMark[]): WallElement | null {
  if (own.some((w) => w.id === e.wallId)) return e
  const wall = walls.find((w) => w.id === e.wallId)
  if (!wall) return null
  const len = lengthOf(wall)
  const [s, t] = stripOf(e, len)
  const piece = remnantOf(wall, walls, marks, len, s, t)
  return piece ? onRemnant(e, wall, len, piece[0], piece[1]) : null
}

// старая батарея видна, если она не помечена сносом, её участок вдоль оси не пересекает и не касается области сноса стены
// и лежит на остатке (так же, как у старых элементов); перенос на остаток пересчитывает расстояние привязки
function resolveOldBattery(b: Battery, walls: readonly Wall[], marks: readonly ResolvedMark[]): Battery | null {
  const wall = walls.find((w) => w.id === b.wallId)
  if (!wall) return null
  const len = lengthOf(wall)
  const [s, t] = batterySpan(b, wall)
  if (marks.some((m) => m.wall.id === wall.id && t >= m.from - EPS_CM && s <= m.to + EPS_CM)) return null
  const piece = remnantOf(wall, walls, marks, len, s, t)
  return piece ? onRemnant(b, wall, len, piece[0], piece[1]) : null
}

// собственная батарея: на собственной стене остаётся как есть; на стене обмера — на остатке, целиком (включительно)
function resolveOwnBattery(b: Battery, own: readonly Wall[], walls: readonly Wall[], marks: readonly ResolvedMark[]): Battery | null {
  if (own.some((w) => w.id === b.wallId)) return b
  const wall = walls.find((w) => w.id === b.wallId)
  if (!wall) return null
  const len = lengthOf(wall)
  const [s, t] = batterySpan(b, wall)
  const piece = remnantOf(wall, walls, marks, len, s, t)
  return piece ? onRemnant(b, wall, len, piece[0], piece[1]) : null
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
  const doorways = [...old, ...mine]
  const dropped = new Set((drawing.batteryDemolition ?? []).map((m) => m.batteryId))
  const oldBatteries = (drawing.batteries ?? []).filter((b) => !dropped.has(b.id)).map((b) => resolveOldBattery(b, drawing.walls, marks)).filter(present)
  const ownBatteries = (drawing.mounting?.batteries ?? []).map((b) => resolveOwnBattery(b, own, drawing.walls, marks)).filter(present)
  const batteries = [...oldBatteries, ...ownBatteries]
  // точка-откос действует, пока её элемент виден в сцене, а его опорная стена есть среди стен сцены; угол — пока видна его батарея
  const visible = new Map(doorways.map((e) => [e.id, e.wallId]))
  const shown = new Set(batteries.map((b) => b.id))
  const resolvable = (p: DimPoint): boolean => {
    if (p.kind === "jamb") return ids.has(visible.get(p.elementId) ?? "")
    if (p.kind === "corner") return shown.has(p.batteryId)
    // приборов на «Монтаже» нет (change add-plumbing-plan)
    if (p.kind === "item") return false
    return ids.has(p.a.wallId) && ids.has(p.b.wallId)
  }
  const dimensions = (drawing.mounting?.dimensions ?? []).filter((d) => resolvable(d.from) && resolvable(d.to))
  return {
    remnants,
    own: [...own],
    walls,
    doorways,
    dimensions,
    oldElementIds: new Set(old.map((e) => e.id)),
    batteries,
    oldBatteryIds: new Set(oldBatteries.map((b) => b.id)),
  }
}
