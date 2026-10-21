import type { Point, RightAngleMark } from "../types"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { cornerKey } from "./plaster-corner"
import type { PlasterCorner } from "./plaster-corner"

// Пометки прямых углов плана «Черновые работы» (change plaster-right-angle, design D3): пометка хранит ссылки на пометки штукатурки
// и действует, пока по ним есть угол контура штукатурки; иначе остаётся в хранилище и не рисуется.

export interface ActiveRightAngle {
  mark: RightAngleMark
  corner: PlasterCorner
}

// Полосы двух пометок штукатурки угла (мировые координаты) — подсветка цели инструмента
export function cornerStrips(corner: PlasterCorner, pieces: readonly PlasterPiece[]): Point[][] {
  const ids = new Set(corner.corner.map((r) => r.markId))
  return pieces.filter((p) => ids.has(p.mark.id)).map(plasterStrip)
}

// Постановка пометки на угол одним новым элементом; угол с пометкой в списке не меняет список (тот же массив)
export function addRightAngle(marks: RightAngleMark[], corner: PlasterCorner, newId: () => string): RightAngleMark[] {
  const key = cornerKey(corner.corner)
  if (marks.some((m) => cornerKey(m.corner) === key)) return marks
  return [...marks, { id: newId(), corner: corner.corner }]
}

// Снятие пометки по идентификатору; нет такой — тот же массив
export function removeRightAngle(marks: RightAngleMark[], id: string): RightAngleMark[] {
  return marks.some((m) => m.id === id) ? marks.filter((m) => m.id !== id) : marks
}

// Действующие пометки по текущим углам; на один угол приходится не более одной пометки — стоящая раньше в списке
export function activeRightAngles(corners: readonly PlasterCorner[], marks: readonly RightAngleMark[]): ActiveRightAngle[] {
  const byKey = new Map(corners.map((c) => [cornerKey(c.corner), c]))
  const taken = new Set<string>()
  return marks.flatMap((mark): ActiveRightAngle[] => {
    const key = cornerKey(mark.corner)
    const corner = byKey.get(key)
    if (!corner || taken.has(key)) return []
    taken.add(key)
    return [{ mark, corner }]
  })
}
