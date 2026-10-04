import type { Material, Point, Wall } from "./types"

// change fix-wall-move-joints: общие помощники тестов и фикстура чертежа пользователя.

export const wall = (ax: number, ay: number, bx: number, by: number, id: string, thicknessCm = 20, type: Material = "brick"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

export const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y })
export const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y
export const len = (p: Point): number => Math.hypot(p.x, p.y)
export const unitOf = (p: Point): Point => ({ x: p.x / len(p), y: p.y / len(p) })

// диагональ угла для стен 20 см и порог углового стыка с запасом 1 см (спецификация)
export const DIAG20 = 10 * Math.SQRT2
export const TOL20 = DIAG20 + 1

// снимок чертежа «Чертёж 1» пользователя до перемещения верхней стены на (10, 0)
const USER_WALLS: readonly Wall[] = [
  { id: "b9433dfb", a: { x: 570, y: 70 }, b: { x: 920, y: 70 }, thicknessCm: 20, type: "wood-long" },
  { id: "5912b043", a: { x: 910, y: 80 }, b: { x: 910, y: 320 }, thicknessCm: 20, type: "brick" },
  { id: "d266f629", a: { x: 900, y: 310 }, b: { x: 570, y: 310 }, thicknessCm: 20, type: "concrete" },
  { id: "93ed4f96", a: { x: 580, y: 300 }, b: { x: 580.18, y: 80 }, thicknessCm: 20, type: "brick" },
  { id: "d8cf088e", a: { x: 739.9189567633557, y: 178.976320723752 }, b: { x: 740.505, y: 300 }, thicknessCm: 20, type: "brick" },
  { id: "e7b0bec4", a: { x: 920, y: 70 }, b: { x: 1140, y: 70 }, thicknessCm: 20, type: "brick" },
  { id: "55dee509", a: { x: 1130, y: 80 }, b: { x: 1130, y: 290 }, thicknessCm: 20, type: "brick" },
  { id: "233d2375", a: { x: 1120, y: 280 }, b: { x: 920, y: 279.6500000000001 }, thicknessCm: 20, type: "brick" },
  { id: "32488b56", a: { x: 910, y: 320 }, b: { x: 910, y: 400 }, thicknessCm: 20, type: "brick" },
  { id: "20d54b0d", a: { x: 835.49, y: 80 }, b: { x: 835.49, y: 240 }, thicknessCm: 20, type: "brick" },
  { id: "d1b44d04", a: { x: 825.49, y: 230 }, b: { x: 750.3087823021198, y: 229.4549080984865 }, thicknessCm: 20, type: "brick" },
  { id: "7ff8537f", a: { x: 940, y: 560 }, b: { x: 940, y: 720 }, thicknessCm: 20, type: "brick" },
  { id: "b8318b6a", a: { x: 930, y: 710 }, b: { x: 550, y: 710 }, thicknessCm: 20, type: "brick" },
  { id: "f1757c1b", a: { x: 550, y: 710 }, b: { x: 400, y: 710 }, thicknessCm: 20, type: "brick" },
  { id: "0c530a55", a: { x: 410, y: 700 }, b: { x: 410, y: 540 }, thicknessCm: 20, type: "brick" },
  { id: "6cb75cc2", a: { x: 420, y: 550 }, b: { x: 940, y: 550 }, thicknessCm: 20, type: "brick" },
  { id: "7c7ccce5", a: { x: 420, y: 590.69 }, b: { x: 580, y: 590 }, thicknessCm: 20, type: "brick" },
  { id: "997998f4", a: { x: 910, y: 410 }, b: { x: 1180, y: 410 }, thicknessCm: 20, type: "brick" },
  { id: "08cbf0c2", a: { x: 1190, y: 410 }, b: { x: 1410, y: 410 }, thicknessCm: 20, type: "brick" },
  { id: "f4493b7b", a: { x: 1400, y: 400 }, b: { x: 1400, y: 110 }, thicknessCm: 20, type: "brick" },
  { id: "3eb78cc4", a: { x: 1390, y: 120 }, b: { x: 1140, y: 119.80899999999994 }, thicknessCm: 20, type: "brick" },
]

export const userWalls = (): Wall[] => USER_WALLS.map((w) => ({ ...w, a: { ...w.a }, b: { ...w.b } }))

export function byId(walls: readonly Wall[], id: string): Wall {
  const found = walls.find((w) => w.id === id)
  if (!found) throw new Error(`нет стены ${id}`)
  return found
}
