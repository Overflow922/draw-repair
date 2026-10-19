import { hostOf, jambsT, hostPoint } from "../doorway/doorway-faces"
import type { Side } from "../doorway/doorway-faces"
import type { Room } from "../room-area"
import type { Point, Screed, Wall, WallElement } from "../types"
import { isWindow } from "../types"
import { pointInPolygon } from "../wall-geometry"
import type { Seg } from "../wall-geometry"

// Стяжка на пороге проёма (change screed-floor-layers, design D1, D2): порог двери и проёма — участок вырезанной стены
// между откосами на всю толщину — делится серединой толщины на две половины, каждая принадлежит помещению со своей
// стороны. Половина штрихуется, если у этого помещения действует стяжка; линия по середине — если половины различаются.
// Чистая функция по данным вида, ничего не хранится.

export interface ActiveScreedRoom {
  screed: Screed
  room: Room
}

export interface ThresholdHalf {
  side: Side
  poly: Point[]
  thicknessMm: number
}

export interface ScreedThreshold {
  elementId: string
  halves: ThresholdHalf[] // только половины со стяжкой
  divider: Seg | null // вдоль оси опорной стены от откоса до откоса
}

const SIDES: Side[] = [1, -1]
const PROBE_CM = 0.5
const MIN_SPAN_CM = 1e-6

const inRoom = (p: Point, room: Room): boolean => pointInPolygon(p, room.outline) && !room.holes.some((hole) => pointInPolygon(p, hole))

const lengthOf = (host: Wall): number => Math.hypot(host.b.x - host.a.x, host.b.y - host.a.y)

function thresholdOf(d: WallElement, walls: readonly Wall[], screeds: readonly ActiveScreedRoom[]): ScreedThreshold | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const [j1, j2] = jambsT(d, host)
  const lo = Math.max(j1, 0)
  const hi = Math.min(j2, lengthOf(host))
  if (hi - lo <= MIN_SPAN_CM) return null
  const h = host.thicknessCm / 2
  const mid = (lo + hi) / 2
  const thicknessOf = (side: Side): number | null => {
    const probe = hostPoint(host, mid, side * (h + PROBE_CM))
    return screeds.find(({ room }) => inRoom(probe, room))?.screed.thicknessMm ?? null
  }
  const thickness = new Map(SIDES.map((side) => [side, thicknessOf(side)]))
  const halves = SIDES.flatMap((side): ThresholdHalf[] => {
    const thicknessMm = thickness.get(side) ?? null
    if (thicknessMm === null) return []
    return [{ side, poly: [hostPoint(host, lo, 0), hostPoint(host, hi, 0), hostPoint(host, hi, side * h), hostPoint(host, lo, side * h)], thicknessMm }]
  })
  if (!halves.length) return null
  const differ = thickness.get(1) !== thickness.get(-1)
  return { elementId: d.id, halves, divider: differ ? { p1: hostPoint(host, lo, 0), p2: hostPoint(host, hi, 0) } : null }
}

export function screedThresholds(walls: readonly Wall[], doorways: readonly WallElement[], screeds: readonly ActiveScreedRoom[]): ScreedThreshold[] {
  if (!screeds.length) return []
  return doorways.filter((d) => !isWindow(d)).flatMap((d) => thresholdOf(d, walls, screeds) ?? [])
}
