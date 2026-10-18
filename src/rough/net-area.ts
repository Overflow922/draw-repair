import { overlapAreaCm2 } from "../polygon-union"
import type { ExplicatedRoom } from "../room-explication"
import type { Point } from "../types"

// Площадь помещения после штукатурки (change add-rough-works-plan, design D5, spec room-explication «Экспликация плана
// «Черновые работы»»): площадь помещения минус площадь объединения полос штукатурки, лежащих внутри его контура вне
// островов. Полосы вне помещения (внешняя грань, соседнее помещение) его площадь не уменьшают.

export function netAreaCm2(item: ExplicatedRoom, strips: readonly Point[][]): number {
  if (strips.length === 0) return item.room.areaCm2
  const removed = overlapAreaCm2(item.room.outline, item.room.holes, strips)
  return item.room.areaCm2 - removed
}

// помещения экспликации с площадью после штукатурки; состав, номера и данные те же
export const netItems = (items: readonly ExplicatedRoom[], strips: readonly Point[][]): ExplicatedRoom[] =>
  items.map((item) => ({ ...item, room: { ...item.room, areaCm2: netAreaCm2(item, strips) } }))
