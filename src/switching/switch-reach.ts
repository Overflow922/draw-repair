import type { Shape } from "../communications/shape"
import { hostOf, hostPoint, jambsT } from "../doorway/doorway-faces"
import { insideBodies, snapSconce } from "../ceiling/light-reach"
import type { Point, Wall, WallElement } from "../types"
import type { SwitchPlacement } from "./light-switch"

// Грани стен для выключателей (change add-light-switch, design D3): та же привязка к чистовой грани, что у бра (стена подложки,
// штукатурка и гипсокартон; обе стороны стены), но участки граней в проёмах, дверях и окнах не занимаются. Проём — прямоугольник
// между откосами, выходящий за обе грани стены на штукатурный запас; грань внутри него даёт «призрака нет». Чистые функции.

const OPENING_PAD_CM = 10 // запас проёма за грань стены: покрывает штукатурку и гипсокартон на грани

// тела проёмов, дверей и окон на стенах walls; элемент несуществующей стены ничего не занимает
export function openingBodies(walls: readonly Wall[], elements: readonly WallElement[]): Shape[] {
  return elements.flatMap((e): Shape[] => {
    const host = hostOf(e, walls)
    if (!host) return []
    const [t0, t1] = jambsT(e, host)
    const h = host.thicknessCm / 2 + OPENING_PAD_CM
    return [{ kind: "poly", pts: [hostPoint(host, t0, -h), hostPoint(host, t1, -h), hostPoint(host, t1, h), hostPoint(host, t0, h)] }]
  })
}

// положение призрака выключателя: ближайшая грань не дальше maxCm; точка в проёме — null
export function snapSwitch(cursor: Point, bodies: readonly Shape[], openings: readonly Shape[], maxCm: number): SwitchPlacement | null {
  const snap = snapSconce(cursor, bodies, maxCm)
  if (!snap || insideBodies(snap.at, openings)) return null
  return { at: snap.at, angle: snap.angleDeg }
}
