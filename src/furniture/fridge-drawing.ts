import type { Point } from "../types"
import { arc, closed } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"

// Рисунок двустворчатого холодильника (change add-furniture-kitchen-cabinet-fridge, design «Масштаб холодильника», «Створка двери — срез»):
// корпус со снежинкой в круге и две распахнутые двери у нижнего (при угле 0) края; прямоугольник предмета включает ход дверей.
// Числа в сантиметрах в системе предмета 100 × 90; k = min(1, w / 100, l / 90) уменьшает все детали.

const DEFAULT_WIDTH_CM = 100
const DEFAULT_LENGTH_CM = 90
const SWING_CM = 30
const LEAF_THICKNESS_CM = 2
const LEFT_DOOR_SHARE = 0.4
const CIRCLE_CENTRE_SHARE = 0.48
const CIRCLE_RADIUS_CM = 18.5
const SPOKE_CM = 15
const BARB_CM = 3.5
const BARB_TURN_DEG = 40
const SPOKES = 8

const toRad = (deg: number): number => (deg * Math.PI) / 180

interface Door {
  // петля — угол корпуса; mirror = true — правая дверь (числа получаются отражением x → w − x)
  hinge: Point
  widthCm: number
  mirror: boolean
}

// створка — незамкнутая ломаная A → E1 → E2 → (t / sin θ; b) (её замыкает нижний край корпуса) и дуга раскрытия с центром в петле
function doorLines({ hinge, widthCm: d, mirror }: Door, swing: number, t: number): [Point[], Point[]] {
  const sign = mirror ? -1 : 1
  const at = (dx: number, dy: number): Point => ({ x: hinge.x + sign * dx, y: hinge.y + dy })
  const edge = Math.sqrt(d * d - t * t)
  const theta = Math.asin(swing / edge)
  const e1 = at(edge * Math.cos(theta), edge * Math.sin(theta))
  const e2 = at(edge * Math.cos(theta) + t * Math.sin(theta), edge * Math.sin(theta) - t * Math.cos(theta))
  const leaf = [hinge, e1, e2, at(t / Math.sin(theta), 0)]
  const endDeg = (theta - Math.atan(t / edge)) * (180 / Math.PI)
  const sweep = arc(0, 0, d, 0, endDeg).map((p) => at(p.x, p.y))
  return [leaf, sweep]
}

function snowflake(centre: Point, k: number): Point[][] {
  return Array.from({ length: SPOKES }, (_, i) => {
    const a = toRad((i * 360) / SPOKES)
    const tip = { x: centre.x + SPOKE_CM * k * Math.cos(a), y: centre.y + SPOKE_CM * k * Math.sin(a) }
    const barb = (turnDeg: number): Point[] => {
      const back = a + Math.PI + toRad(turnDeg)
      return [tip, { x: tip.x + BARB_CM * k * Math.cos(back), y: tip.y + BARB_CM * k * Math.sin(back) }]
    }
    return [[centre, tip], barb(BARB_TURN_DEG), barb(-BARB_TURN_DEG)]
  }).flat()
}

export const fridgeDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, w / DEFAULT_WIDTH_CM, l / DEFAULT_LENGTH_CM)
  const swing = SWING_CM * k
  const depth = l - swing
  const thickness = LEAF_THICKNESS_CM * k
  const centre = { x: CIRCLE_CENTRE_SHARE * w, y: depth / 2 }
  const left: Door = { hinge: { x: 0, y: depth }, widthCm: LEFT_DOOR_SHARE * w, mirror: false }
  const right: Door = { hinge: { x: w, y: depth }, widthCm: (1 - LEFT_DOOR_SHARE) * w, mirror: true }
  const [leftLeaf, leftSweep] = doorLines(left, swing, thickness)
  const [rightLeaf, rightSweep] = doorLines(right, swing, thickness)
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  const body = closed([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: depth }, { x: 0, y: depth }])
  const circle = arc(centre.x, centre.y, CIRCLE_RADIUS_CM * k, 0, 360)
  return { outline, lines: [body, circle, ...snowflake(centre, k), leftLeaf, rightLeaf, leftSweep, rightSweep] }
}
