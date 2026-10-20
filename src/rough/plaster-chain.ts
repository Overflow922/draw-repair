import { EPS_CM } from "../demolition/mark-model"
import type { Point } from "../types"
import { RIGHT_COS, dot, mul, perp, sub, unit } from "../wall-geometry"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { FACE_TOL_CM } from "./plaster-face"

// Участок штукатурки одной плоскости (change plaster-dimension-corner-to-corner, design D1): куски одной грани, лежащие на одной
// линии и образующие непрерывную полосу, — стык коллинеарных стен любой толщины, T-примыкание, полоса торца в плоскости, —
// показывают один размер «от угла до угла». Чистая функция, входы не мутируются.

// кусок участка и его протяжённость вдоль оси опорного куска (от конца a его стены)
export interface PlasterRunItem {
  piece: PlasterPiece
  lo: number
  hi: number
}

// непрерывная полоса: все координаты вдоль оси опорного куска от конца a его стены
export interface PlasterRun {
  ref: PlasterPiece // первый боковой кусок плоскости: его стена задаёт ось и грань размера
  side: 1 | -1 // грань опорного куска относительно оси его стены
  axis: Point // единичная ось опорной стены
  lo: number
  hi: number
  items: PlasterRunItem[] // боковые куски и полосы торцов в плоскости
}

interface Plane {
  normal: Point // наружу от тела стены
  line: number // положение грани поперёк, по normal
  sides: PlasterPiece[]
}

const sideFace = (piece: PlasterPiece): 1 | -1 | null => (piece.mark.face === "end" ? null : piece.mark.face)

// плоскость бокового куска: наружная нормаль грани и положение грани по ней
function planeOf(piece: PlasterPiece, face: 1 | -1): { normal: Point; line: number } {
  const normal = mul(perp(unit(piece.wall.a, piece.wall.b)), face)
  return { normal, line: dot(normal, piece.wall.a) + piece.wall.thicknessCm / 2 }
}

function groupPlanes(pieces: readonly PlasterPiece[]): Plane[] {
  const planes: Plane[] = []
  for (const piece of pieces) {
    const face = sideFace(piece)
    if (face === null) continue
    const own = planeOf(piece, face)
    const plane = planes.find((x) => dot(x.normal, own.normal) >= RIGHT_COS && Math.abs(x.line - own.line) <= FACE_TOL_CM)
    if (plane) plane.sides.push(piece)
    else planes.push({ ...own, sides: [piece] })
  }
  return planes
}

// протяжённость полосы куска вдоль оси ref от конца a опорной стены
function extentOf(piece: PlasterPiece, ref: PlasterPiece, axis: Point): [number, number] {
  const ts = plasterStrip(piece).map((v) => dot(sub(v, ref.wall.a), axis))
  return [Math.min(...ts), Math.max(...ts)]
}

// торец лежит в плоскости, если его полоса примыкает к линии грани снаружи тела стены
function inPlane(end: PlasterPiece, plane: Plane, depthCm: number): boolean {
  const lateral = plasterStrip(end).map((v) => dot(plane.normal, v))
  const nearest = Math.min(...lateral)
  return Math.abs(nearest - plane.line) <= FACE_TOL_CM && Math.max(...lateral) <= plane.line + depthCm + FACE_TOL_CM
}

export function plasterRuns(pieces: readonly PlasterPiece[]): PlasterRun[] {
  const runs: PlasterRun[] = []
  for (const plane of groupPlanes(pieces)) {
    const ref = plane.sides[0]
    const side = ref && sideFace(ref)
    if (!ref || side === null) continue
    const axis = unit(ref.wall.a, ref.wall.b)
    const depthCm = Math.max(...plane.sides.map((p) => p.mark.thicknessMm / 10))
    const candidates = [...plane.sides, ...pieces.filter((p) => p.mark.face === "end" && inPlane(p, plane, depthCm))]
    const placed = candidates
      .map((piece): PlasterRunItem => {
        const [lo, hi] = extentOf(piece, ref, axis)
        return { piece, lo, hi }
      })
      .sort((a, b) => a.lo - b.lo)
    let current: PlasterRunItem[] = []
    let hi = -Infinity
    const flush = (): void => {
      // участок из одних торцов — отдельный размер торца, цепочки у него нет
      if (current.some((x) => x.piece.mark.face !== "end")) runs.push({ ref, side, axis, lo: Math.min(...current.map((x) => x.lo)), hi, items: current })
    }
    for (const item of placed) {
      if (current.length > 0 && item.lo > hi + EPS_CM) {
        flush()
        current = []
        hi = -Infinity
      }
      current.push(item)
      hi = Math.max(hi, item.hi)
    }
    flush()
  }
  return runs
}
