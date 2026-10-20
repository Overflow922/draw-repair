import { EPS_CM } from "../demolition/mark-model"
import { textDirection } from "../demolition/mark-dimensions"
import type { MarkNumberSpot } from "../demolition/mark-numbers"
import { hostOf, hostPoint, jambsT } from "../doorway/doorway-faces"
import type { Side } from "../doorway/doorway-faces"
import { CHAIN_OFFSET_EM, DIM_TEXT_GAP_PX } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { DimGeometry } from "../geometry"
import type { Unit, Wall, WallElement } from "../types"
import { add, dot, mul, pointInPolygon, sub, unit as unitVector } from "../wall-geometry"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { plasterRuns } from "./plaster-chain"
import type { PlasterRun, PlasterRunItem } from "./plaster-chain"
import { pieceFaceBounds } from "./plaster-face-bounds"
import { isSideMark } from "./rough-model"

// Размеры участка штукатурки (change plaster-dimension-corner-to-corner): один размер от угла до угла на непрерывную полосу
// плоскости, ширина делится по откосам проёмов; отсчёт от внешней стороны полосы; у внутреннего угла внешние поверхности двух
// полос сходятся раньше угла стены, и размер заканчивается в точке их схождения. Числа размеров не правятся.

// пробный отступ внутрь полосы от её конца и от внешней стороны, см
const PROBE_CM = 0.05
const ZERO = 1e-6

export interface PlasterDimension {
  side: Side
  target: "gapA" | "width" | "gapB" // расстояние до стыка в сторону a, сегмент ширины, расстояние до стыка в сторону b
  fromCm: number // вдоль оси опорной стены участка
  toCm: number
  valueCm: number
  text: string
  geom: DimGeometry
  spot: MarkNumberSpot // прямоугольник числа: клик по нему выделения не снимает, число не правится
}

// размеры одного участка: пометки, чьи куски в него входят, и сами размеры (расстояния до стыков показываются у выделенной)
export interface PlasterRunDimensions {
  markIds: string[]
  endPieces: PlasterPiece[] // полосы торцов в плоскости: их ширина входит в размер участка, собственного размера у них нет
  dimensions: PlasterDimension[]
}

// Укорочение цепочки у стыка (см вдоль оси) у начала (`from`) и у конца (`to`) цепочки грани куска. Внутренний угол: полоса
// соседней пометки перекрывает конец этой полосы — цепочка короче на толщину соседней. Внешний угол: за концом полосы стоит
// торцевая полоса, закрывающая угол, — цепочка длиннее на её толщину (отрицательная поправка).
type ChainTrim = (side: Side, atCm: number, end: "from" | "to") => number

function junctionTrim(piece: PlasterPiece, pieces: readonly PlasterPiece[], depthCm: number): ChainTrim {
  const lateral = piece.wall.thicknessCm / 2 + depthCm - PROBE_CM
  const others = pieces.filter((x) => x.mark.id !== piece.mark.id)
  const coverAt = (side: 1 | -1, alongCm: number, endsOnly: boolean): PlasterPiece | undefined => {
    const probe = hostPoint(piece.wall, alongCm, side * lateral)
    return others.find((x) => (!endsOnly || x.mark.face === "end") && pointInPolygon(probe, plasterStrip(x)))
  }
  return (side, atCm, end) => {
    const inward = end === "from" ? PROBE_CM : -PROBE_CM
    const inner = coverAt(side, atCm + inward, false)
    if (inner) return inner.mark.thicknessMm / 10
    const outer = coverAt(side, atCm - inward, true)
    return outer ? -outer.mark.thicknessMm / 10 : 0
  }
}

// положение стены куска на оси опорной стены участка: знак направления и расстояние до её конца a
interface Frame {
  sign: 1 | -1
  start: number
}

function frameOf(piece: PlasterPiece, run: PlasterRun): Frame {
  const sign = dot(unitVector(piece.wall.a, piece.wall.b), run.axis) >= 0 ? 1 : -1
  return { sign, start: dot(sub(piece.wall.a, run.ref.wall.a), run.axis) }
}

// конец участка: боковой кусок, чьей границей он является, и его положение; торец или щель конца без бокового куска не правят
interface RunEnd {
  piece: PlasterPiece
  face: 1 | -1
  frame: Frame
}

function endOf(run: PlasterRun, at: "lo" | "hi"): RunEnd | null {
  const edge = at === "lo" ? run.lo : run.hi
  const item = run.items.find((x: PlasterRunItem) => isSideMark(x.piece.mark) && Math.abs((at === "lo" ? x.lo : x.hi) - edge) <= EPS_CM)
  const mark = item?.piece.mark
  return item && mark && isSideMark(mark) ? { piece: item.piece, face: mark.face, frame: frameOf(item.piece, run) } : null
}

// Конец участка (координаты вдоль оси опорной стены): граница ширины на грани не дальше стыка (грань упирается в соседнюю стену),
// расстояние от неё до стыка и поправка цепочки у стыка
interface ChainEnd {
  edge: number
  gap: number
  trim: number
}

function endChain(run: PlasterRun, at: "lo" | "hi", pieces: readonly PlasterPiece[], walls: readonly Wall[]): ChainEnd {
  const fallback = { edge: at === "lo" ? run.lo : run.hi, gap: 0, trim: 0 }
  const owner = endOf(run, at)
  const bounds = owner && pieceFaceBounds(owner.piece, walls, owner.face)
  if (!owner || !bounds) return fallback
  const { sign, start } = owner.frame
  // конец участка обращён к концу a оси куска или к концу b
  const towardA = (at === "lo") === (sign > 0)
  const along = towardA ? bounds.start : bounds.end
  const gap = towardA ? bounds.start - bounds.j0 : bounds.j1 - bounds.end
  const edge = sign > 0 ? start + along : start - along
  const chainEdge = at === "lo" ? edge - gap : edge + gap
  const trim = junctionTrim(owner.piece, pieces, owner.piece.mark.thicknessMm / 10)(owner.face, sign > 0 ? chainEdge - start : start - chainEdge, towardA ? "from" : "to")
  return { edge, gap, trim }
}

// глубина действующей полосы откоса jamb элемента: на неё граница сегмента сдвигается от откоса вглубь проёма (change
// plaster-reveal-dimensions); у откоса без действующего куска сдвига нет
function revealDepth(pieces: readonly PlasterPiece[], elementId: string, jamb: "a" | "b"): number {
  const piece = pieces.find((p) => p.mark.face === "reveal" && p.mark.elementId === elementId && p.mark.jamb === jamb)
  return piece ? piece.to - piece.from : 0
}

// откос проёма на оси участка и граница сегмента у него: у оштукатуренного откоса — внутренняя сторона его полосы
interface JambCut {
  jamb: number
  cut: number
}

function jambsOf(run: PlasterRun, pieces: readonly PlasterPiece[], walls: readonly Wall[], doorways: readonly WallElement[]): JambCut[] {
  return doorways.flatMap((d) => {
    const host = hostOf(d, walls)
    const item = host && run.items.find((x) => x.piece.mark.face !== "end" && x.piece.wall.id === host.id)
    if (!host || !item) return []
    const { sign, start } = frameOf(item.piece, run)
    const onAxis = (t: number): number => (sign > 0 ? start + t : start - t)
    const [near, far] = jambsT(d, host)
    return [
      { jamb: onAxis(near), cut: onAxis(near + revealDepth(pieces, d.id, "a")) },
      { jamb: onAxis(far), cut: onAxis(far - revealDepth(pieces, d.id, "b")) },
    ]
  })
}

function runDimensions(
  run: PlasterRun,
  pieces: readonly PlasterPiece[],
  walls: readonly Wall[],
  doorways: readonly WallElement[],
  unit: Unit,
  k: number,
  labelPx: number,
): PlasterDimension[] {
  const ref = run.ref.wall
  const depthCm = Math.max(...run.items.filter((x) => x.piece.mark.face !== "end").map((x) => x.piece.mark.thicknessMm / 10))
  const offsetCm = (CHAIN_OFFSET_EM * labelPx) / k
  const face = ref.thicknessCm / 2 + depthCm
  const lineDir = textDirection(run.axis)
  const up = { x: lineDir.y, y: -lineDir.x }
  const lift = (DIM_TEXT_GAP_PX + labelPx / 2) / k
  const make = (target: PlasterDimension["target"], fromCm: number, toCm: number): PlasterDimension[] => {
    const valueCm = toCm - fromCm
    if (valueCm <= ZERO) return []
    const geom = dimGeometry(hostPoint(ref, fromCm, run.side * face), hostPoint(ref, toCm, run.side * face), offsetCm * run.side)
    if (!geom) return []
    const text = formatLength(valueCm, unit)
    const spot: MarkNumberSpot = {
      side: run.side,
      target,
      text,
      valueCm,
      center: add(hostPoint(ref, (fromCm + toCm) / 2, run.side * (face + offsetCm)), mul(up, lift)),
      dir: lineDir,
      widthCm: (text.length * labelPx * CHAR_WIDTH) / k,
      heightCm: labelPx / k,
    }
    return [{ side: run.side, target, fromCm, toCm, valueCm, text, geom, spot }]
  }
  const lo = endChain(run, "lo", pieces, walls)
  const hi = endChain(run, "hi", pieces, walls)
  // поправка у стыка относится к первому размеру цепочки: расстоянию до стыка, а без него — ширине
  const widthFrom = lo.gap > ZERO ? lo.edge : lo.edge + lo.trim
  const widthTo = hi.gap > ZERO ? hi.edge : hi.edge - hi.trim
  // откос на краю цепочки границы не создаёт: участка грани перед ним нет
  const inside = (t: number): boolean => t > widthFrom + ZERO && t < widthTo - ZERO
  const cuts = jambsOf(run, pieces, walls, doorways)
    .filter((x) => inside(x.jamb) && inside(x.cut))
    .map((x) => x.cut)
    .sort((a, b) => a - b)
  const bounds = [widthFrom, ...cuts, widthTo]
  return [
    ...(lo.gap > ZERO ? make("gapA", lo.edge - lo.gap + lo.trim, lo.edge) : []),
    ...bounds.flatMap((from, i) => {
      const to = bounds[i + 1]
      return to === undefined ? [] : make("width", from, to)
    }),
    ...(hi.gap > ZERO ? make("gapB", hi.edge, hi.edge + hi.gap - hi.trim) : []),
  ]
}

// размеры всех участков плана: по одному на непрерывную полосу
export function plasterRunDimensions(
  pieces: readonly PlasterPiece[],
  walls: readonly Wall[],
  doorways: readonly WallElement[],
  unit: Unit,
  k: number,
  labelPx: number,
): PlasterRunDimensions[] {
  return plasterRuns(pieces).map((run) => ({
    markIds: [...new Set(run.items.map((x) => x.piece.mark.id))],
    endPieces: run.items.filter((x) => x.piece.mark.face === "end").map((x) => x.piece),
    dimensions: runDimensions(run, pieces, walls, doorways, unit, k, labelPx),
  }))
}

// Размеры участка, в который входит кусок piece. Кусок вне pieces (превью протяжки) даёт свой участок, поправки у стыков
// считаются по pieces. У куска торца размеров цепочки нет.
export function plasterDimensions(
  piece: PlasterPiece,
  pieces: readonly PlasterPiece[],
  walls: readonly Wall[],
  unit: Unit,
  k: number,
  labelPx: number,
  doorways: readonly WallElement[] = [],
): PlasterDimension[] {
  const known = pieces.includes(piece)
  const run = plasterRuns(known ? pieces : [piece]).find((r) => r.items.some((x) => x.piece === piece))
  return run ? runDimensions(run, pieces, walls, doorways, unit, k, labelPx) : []
}
