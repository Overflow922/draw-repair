import { EPS_CM, MIN_WIDTH_CM } from "../demolition/mark-model"
import { faceRuns } from "../doorway/doorway-faces"
import type { Wall } from "../types"
import { dist } from "../wall-geometry"
import type { PlasterPiece } from "./plaster"
import { flushEnds, planeWalls } from "./plaster-face"
import type { PlaneWall } from "./plaster-face"

// Щель между осями коллинеарных стен одной плоскости (change plaster-t-gap-opposite-face, design D1–D4): оси стен могут оканчиваться
// на гранях перпендикулярной стены, и между ними остаётся её толщина. Пометка хранится в пределах оси, поэтому каждый из двух
// кусков, доходящих до своего конца оси, продлевается до середины щели — как раскладывает плоскость клик (`layPieces`). Чистая функция.

interface Neighbour {
  entry: PlaneWall
  gap: number // ширина щели между осями, см
}

// ближайшая стена плоскости за концом end опорной стены, если между осями есть щель; стена внахлёст или вплотную щели не даёт
function neighbourAt(self: Wall, plane: readonly PlaneWall[], len: number, end: "a" | "b"): Neighbour | null {
  const others = plane.filter((w) => w.wall.id !== self.id)
  if (end === "b") {
    const next = others.filter((w) => w.hi > len + EPS_CM).sort((x, y) => x.lo - y.lo)[0]
    return next && next.lo > len + EPS_CM ? { entry: next, gap: next.lo - len } : null
  }
  const prev = others.filter((w) => w.lo < -EPS_CM).sort((x, y) => y.hi - x.hi)[0]
  return prev && prev.hi < -EPS_CM ? { entry: prev, gap: -prev.hi } : null
}

// кусок боковой грани соседа доходит до своего конца оси, обращённого к щели
function reachesGap(pieces: readonly PlasterPiece[], { entry }: Neighbour, end: "a" | "b"): boolean {
  const nearStart = end === "b" ? entry.same : !entry.same
  return pieces.some(
    (p) =>
      p.mark.face === entry.face &&
      p.wall.id === entry.wall.id &&
      (nearStart ? p.from <= EPS_CM : p.to >= dist(p.wall.a, p.wall.b) - EPS_CM),
  )
}

// щель принадлежит грани сплошной (её не прерывает стена с той же стороны) и не закрыта торцом перпендикулярной стены в плоскости
function gapIsOpenFace(piece: PlasterPiece, face: 1 | -1, walls: readonly Wall[], len: number, gap: number, end: "a" | "b"): boolean {
  const [lo, hi] = end === "b" ? [len, len + gap] : [-gap, 0]
  const continuous = faceRuns(piece.wall, walls, face).some(([r0, r1]) => r0 <= lo + EPS_CM && r1 >= hi - EPS_CM)
  const closedByEnd = flushEnds(piece.wall, face, walls, () => true).some((e) => Math.min(e.hi, hi) - Math.max(e.lo, lo) > MIN_WIDTH_CM)
  return continuous && !closedByEnd
}

export function bridgeJoints(pieces: readonly PlasterPiece[], walls: readonly Wall[]): PlasterPiece[] {
  return pieces.map((piece) => {
    const face = piece.mark.face
    if (face === "end") return piece
    const len = dist(piece.wall.a, piece.wall.b)
    const plane = planeWalls(piece.wall, face, walls)
    const reach = (end: "a" | "b"): number => {
      const touches = end === "b" ? piece.to >= len - EPS_CM : piece.from <= EPS_CM
      const neighbour = touches ? neighbourAt(piece.wall, plane, len, end) : null
      return neighbour && reachesGap(pieces, neighbour, end) && gapIsOpenFace(piece, face, walls, len, neighbour.gap, end) ? neighbour.gap / 2 : 0
    }
    const a = reach("a")
    const b = reach("b")
    return a === 0 && b === 0 ? piece : { ...piece, from: a > 0 ? -a : piece.from, to: b > 0 ? len + b : piece.to }
  })
}
