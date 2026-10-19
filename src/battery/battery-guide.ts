import { hostPoint } from "../doorway/doorway-faces"
import type { Battery, Point, Wall } from "../types"

// вспомогательная пунктирная линия на холсте: от точки до точки в мировых координатах
export interface TrackLine {
  from: Point
  to: Point
}

// Риска центровки (change fix-battery-centering-and-numbers, design D2; spec battery «Риска центровки»): отрезок поперёк оси
// опорной стены через общий центр окна и батареи. Чистая функция.

// выступ риски за переднюю сторону батареи, экранные px (не масштабируется с зумом)
export const CENTER_GUIDE_OVERSHOOT_PX = 6

// centreT — центр окна по t от конца a; k — px на см чертежа; от дальней от батареи грани стены до передней стороны батареи
export function centerGuide(b: Battery, host: Wall, centreT: number, k: number, overshootPx: number): TrackLine {
  const half = host.thicknessCm / 2
  const frontLat = b.face * (half + b.gapCm + b.thicknessCm)
  return {
    from: hostPoint(host, centreT, -b.face * half),
    to: hostPoint(host, centreT, frontLat + (b.face * overshootPx) / k),
  }
}
